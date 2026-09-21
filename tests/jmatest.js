// 일본 해상경보 읽기 검사 (worker.js 의 /app/warn-jp.json)
//
// ★ 표본은 気象庁이 실제로 낸 전문이다 (2026-09-02 발표분, jmafx/ 에 그대로 담았다).
//   지어낸 전문으로 검사하면 「내가 상상한 모양」 만 맞춰 보게 된다.
const fs = require('fs');
const path = require('path');
const D = __dirname;

let pass = 0, fail = 0;
const t = (n, ok, got) => { ok ? pass++ : (fail++, console.log('★ 실패:', n,
  got !== undefined ? ('→ ' + JSON.stringify(got).slice(0, 160)) : '')); };

const FX = f => fs.readFileSync(path.join(D, 'jmafx', f), 'utf8');

(async () => {
  const src = fs.readFileSync(path.join(D, '..', '..', 'webout', 'scripts', 'worker.js'), 'utf8')
                .replace(/^export default[\s\S]*?^};\s*$/m, '');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(
    src + '\nexport { jmaOne, jmaAll, jmaFeedRows, jmaFeedPick, jmaParse, jmaLive, jmaWarnJson, JMA_FEEDS };'
  ).toString('base64'));

  const feed = FX('other.xml');
  const feedL = FX('other_l.xml');
  const kobe = FX('VPCU51_280000.xml');
  const send = FX('VPCU51_040000.xml');

  // ── ① 이름칸이 붙어도 이름표를 잡는다
  t('이름칸 붙은 이름표', mod.jmaOne('<jmx_eb:Synopsis type="x">가</jmx_eb:Synopsis>', 'Synopsis') === '가');
  t('Head 를 Headline 로 착각하지 않는다', mod.jmaOne('<Headline><Text/></Headline>', 'Head') === '');

  // ── ② 소식줄 고르기 (잦은 것 + 긴 것을 합친다)
  const rows = mod.jmaFeedPick(feed, feedL);
  t('해상경보만 고른다 · 기상대마다 하나', rows.length === 2, rows.map(r => r.who));
  t('예보(VPCY)는 안 고른다', rows.every(r => r.href.indexOf('VPCU51') > 0), rows.map(r => r.href));
  const kobeRow = rows.find(r => r.who.indexOf('神戸') > 0);
  t('신고베는 가장 새로 낸 것', kobeRow && kobeRow.href.indexOf('20260902143503') > 0, kobeRow);
  // ★ 긴 소식줄이 한 발 늦어도(9/1) 잦은 소식줄의 9/2 것이 이긴다.
  t('늦은 소식줄이 새것을 밀어내지 않는다', kobeRow && kobeRow.href.indexOf('20260901') < 0, kobeRow);
  t('긴 소식줄에만 있는 기상대도 담는다', rows.some(r => r.who.indexOf('仙台') > 0), rows.map(r => r.who));
  t('발표 시각 차례로 세운다', rows[0].at >= rows[1].at, rows.map(r => r.at));
  // ★ 소식줄을 어느 차례로 넣든 결과가 같아야 한다 — 「먼저 온 것이 최신」 이라고 믿지 않는다.
  const rev = mod.jmaFeedPick(feedL, feed);
  const kobeRev = rev.find(r => r.who.indexOf('神戸') > 0);
  t('소식줄 차례가 바뀌어도 최신 것', kobeRev && kobeRev.href.indexOf('20260902143503') > 0, kobeRev);
  // ★ 같은 기상대의 「예보」 가 「경보」 보다 새것이어도 예보를 집으면 안 된다.
  t('예보가 더 새것이어도 경보를 집는다',
    rows.filter(r => r.who.indexOf('仙台') > 0).every(r => r.href.indexOf('VPCU51') > 0),
    rows.filter(r => r.who.indexOf('仙台') > 0));

  // ── ③ 전문 읽기 — 신고베
  const a = mod.jmaParse(kobe);
  t('해상기상대 이름', a.office === '神戸海上気象', a.office);
  t('낸 곳', a.by === '高松地方気象台', a.by);
  t('발표 시각', a.at === '2026-09-02T23:35:00+09:00', a.at);
  t('유효 시각', a.until === '2026-09-03T21:00:00+09:00', a.until);
  t('경보 한 줄', a.zones.length === 1, a.zones);
  t('경보 이름 그대로', a.zones[0].kind === '海上風警報', a.zones[0]);
  t('경보 번호 그대로', a.zones[0].code === '20', a.zones[0]);
  t('해역 이름 그대로', a.zones[0].reg === '四国沖南部', a.zones[0]);
  t('해역 번호 그대로', a.zones[0].regCode === '4030', a.zones[0]);
  // ★ 気象要因(4000 · 四国沖及び瀬戸内海)은 경보가 아니다. 세면 없는 경보를 만든다.
  t('기상요인 해역을 경보로 세지 않는다', a.zones.every(z => z.regCode !== '4000'), a.zones);

  // ── ④ 전문 읽기 — 센다이 (두 종류)
  const b = mod.jmaParse(send);
  t('두 줄을 다 읽는다', b.zones.length === 2, b.zones);
  t('짙은 안개도 읽는다', b.zones.some(z => z.kind === '海上濃霧警報' && z.regCode === '2020'), b.zones);

  // ── ⑤ 해제·경보없음은 경보가 아니다
  const none = kobe.replace('<Name>海上風警報</Name>\n<Code>20</Code>',
                            '<Name>海上警報解除</Name>\n<Code>00</Code>');
  t('해제는 경보로 안 센다', mod.jmaParse(none).zones.length === 0, mod.jmaParse(none).zones);

  // ── ⑥ 유효 시각이 지난 전문은 안 쓴다
  const now = Date.parse('2026-09-03T00:00:00+09:00');
  t('아직 유효하면 쓴다', mod.jmaLive(a, now) === true);
  t('유효 시각이 지나면 안 쓴다',
    mod.jmaLive(a, Date.parse('2026-09-04T00:00:00+09:00')) === false);
  t('경보가 없는 전문은 안 쓴다', mod.jmaLive({ zones: [], until: '' }, now) === false);

  // ── ⑦ 처음부터 끝까지 (気象庁 자리는 흉내로 막는다)
  const seen = [];
  globalThis.fetch = async (u) => {
    seen.push(String(u));
    const s = String(u);
    const body = s.indexOf('other.xml') > 0 ? feed
               : s.indexOf('other_l.xml') > 0 ? feedL
               : s.indexOf('VPCU51_280000') > 0 ? kobe
               : s.indexOf('VPCU51_040000') > 0 ? send : '';
    return { ok: !!body, status: body ? 200 : 404, text: async () => body };
  };
  // ★ 넣어 둔 전문은 2026-09-03 21:00 까지 유효하다. 그 시각이 지나면 이 검사가
  //   저절로 빨개진다 — 앱이 고장 난 것이 아니라 달력이 지난 것이다.
  //   그러면 검사가 거짓말을 한다. 그 전문이 살아 있던 때를 넣어 부른다.
  const out = await mod.jmaWarnJson(now);
  t('읽었다고 말한다', out.ok === true, out.ok);
  t('출처를 담는다', /気象庁/.test(out.from || ''), out.from);
  t('전문 둘', out.reports.length === 2, out.reports.length);
  t('경보 셋', out.zones.length === 3, out.zones);
  t('경보마다 어느 기상대인지 담는다', out.zones.every(z => z.office), out.zones[0]);
  t('전문 주소를 그대로 부른다',
    seen.some(x => x === 'https://www.data.jma.go.jp/developer/xml/data/20260902143503_0_VPCU51_280000.xml'),
    seen);
  t('소식줄 둘을 다 부른다',
    seen.filter(x => x.indexOf('/feed/') > 0).length === 2, seen.filter(x => x.indexOf('/feed/') > 0));

  // ── ⑧ 못 읽으면 빈 목록이 아니라 성을 낸다
  globalThis.fetch = async () => ({ ok: false, status: 503, text: async () => '' });
  let threw = false;
  try{ await mod.jmaWarnJson(); }catch(e){ threw = true; }
  t('못 읽으면 빈 목록을 안 준다 (성을 낸다)', threw === true);

  console.log(`jmatest: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 →', e && e.message); process.exit(1); });
