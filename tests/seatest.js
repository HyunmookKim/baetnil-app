// 해상 예보구 경계 굽기 검사 (collect_jp.js 의 해역경계)
//
// ★ 気象庁·Geoshape 쪽은 검사에서 안 부른다. 남의 서버를 검사가 두들기면 안 되고,
//   검사가 남의 서버 사정에 따라 붉어지면 아무도 안 믿게 된다.
// ★ 검사는 남의 서버(Nominatim)를 안 부른다. 기다림도 0 으로 둔다 — 안 그러면 71곳 × 1.2초다.
process.env.NOMI_WAIT = '0';
const fs = require('fs');
const os = require('os');
const path = require('path');

let pass = 0, fail = 0;
const t = (n, ok, got) => { ok ? pass++ : (fail++, console.log('★ 실패:', n,
  got !== undefined ? ('→ ' + JSON.stringify(got).slice(0, 160)) : '')); };

const P = path.join(__dirname, '..', '..', 'webout', 'scripts', 'collect_jp.js');
const src = fs.readFileSync(P, 'utf8');
const cut = src.indexOf('\n(async () => {');
if(cut < 0){ console.log('★ 실패: collect_jp.js 에서 마지막 일감을 못 찾았습니다'); process.exit(1); }
const mod = new Function('require', 'module', 'process', '__dirname',
  src.slice(0, cut) + '\nreturn { 굵게, 테두리들, 해역경계, SEA_AREAS, SEA_TOL, SEA_BASE, MARINA_BOX, KRGOV, 한국관마리나, 이름씻기, 손, 안전하게쓰기, 줄어도되는몫 };'
)(
  // ★ 수집기가 옆 파일(spot_hand.js)을 부른다. 검사에서 그대로 require 하면
  //   검사 폴더에서 찾다가 없다고 한다 — 수집기 자리에서 찾게 해 준다.
  m => require(m.startsWith('.') ? path.join(path.dirname(P), m) : m),
  { exports: {} }, process, path.dirname(P));

// ── ⓪ 일본을 한 동네만 훑지 않는다 (사장님 지적, 2026-09-02)
//   전에는 세토내해·규슈북부 두 상자뿐이라 지도에 일본이 한 동네만 찍혔다.
{
  const B = mod.MARINA_BOX;
  const jp = Object.keys(B).filter(k => B[k].c === 'jp').map(k => B[k].box);
  t('★★★ 일본을 여러 바다로 나눠 훑는다', jp.length >= 10, jp.length);
  const 북 = Math.max(...jp.map(b => b[2])), 남 = Math.min(...jp.map(b => b[0]));
  const 동 = Math.max(...jp.map(b => b[3])), 서 = Math.min(...jp.map(b => b[1]));
  t('★★★ 홋카이도까지 든다 (북위 45도 위)', 북 >= 45, 북);
  t('★★★ 오키나와·야에야마까지 든다 (북위 24도 아래)', 남 <= 24.5, 남);
  t('★★★ 동쪽 끝(간토·이즈)까지 든다', 동 >= 141, 동);
  t('★★★ 서쪽 끝(야에야마)까지 든다', 서 <= 123.5, 서);
  // 세토내해는 여전히 들어 있어야 한다 (사장님이 먼저 채우라 하신 곳)
  const 세토 = jp.some(b => b[0] <= 34.35 && b[2] >= 34.35 && b[1] <= 134.05 && b[3] >= 134.05);
  t('★★ 세토내해(다카마쓰)가 든다', 세토);
  // 한국도 그대로 있어야 한다
  t('★★ 한국 바다도 그대로 훑는다',
    Object.keys(B).filter(k => B[k].c === 'kr').length >= 4,
    Object.keys(B).filter(k => B[k].c === 'kr').length);
}

// ── ⓪-2 한국 관 자료 마리나 (사장님 지적 — 이순신·원형이 안 나오던 것)
{
  const G = mod.KRGOV;
  t('★★★ 관 자료 마리나 목록이 있다', Array.isArray(G) && G.length >= 70, G && G.length);
  const 있나 = n => G.some(x => x.n === n);
  ['이순신마리나','원형마리나','여수낭만바다마리나','욕지항 요트계류시설',
   '부산북항마리나','해운대마리나','강정공공요트계류시설'].forEach(n =>
    t('★★★ 관 자료에 있다 — ' + n, 있나(n)));
  t('★★ 선석 수도 담는다', G.every(x => typeof x.berth === 'number'), G.filter(x => typeof x.berth !== 'number').slice(0,3));
  t('★★ 소재지와 권역도 담는다', G.every(x => x.at && x.reg), G.filter(x => !x.at || !x.reg).slice(0,3));
}
// ── ① 테두리 성글게 만들기
const 곧은줄 = [];
for(let i = 0; i <= 20; i++) 곧은줄.push([130 + i * 0.05, 34]);
t('곧은 줄은 두 점으로 준다', mod.굵게(곧은줄, 0.02).length === 2, mod.굵게(곧은줄, 0.02).length);
const 튄줄 = 곧은줄.slice();
튄줄[10] = [130.5, 34.5];
t('크게 꺾인 곳은 남긴다',
  mod.굵게(튄줄, 0.02).some(p => p[1] === 34.5), mod.굵게(튄줄, 0.02));
t('처음과 끝은 언제나 남긴다',
  mod.굵게(튄줄, 0.02)[0][0] === 130 && mod.굵게(튄줄, 0.02).slice(-1)[0][0] === 131);

// ── ② 바깥 테두리만 · 구멍은 뺀다
const 네모 = (x0, y0, x1, y1) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
const gj = { type:'FeatureCollection', features:[ { type:'Feature', geometry:{
  type:'MultiPolygon',
  coordinates:[ [ 네모(130,33,135,35), 네모(131,33.5,131.5,34) ],   // 바깥 + 구멍(섬)
                [ 네모(136,33,137,34) ] ] } } ] };
const rings = mod.테두리들(gj);
t('덩이마다 바깥 테두리 하나씩', rings.length === 2, rings.length);
t('구멍(섬)은 안 담는다', rings.every(r => r[0][0] !== 131), rings.map(r => r[0]));

// ── ③ 처음부터 끝까지 (자료 받는 자리는 흉내로 막는다)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sea-'));
const 원래 = process.cwd();
const 부른곳 = [];
async function 굽기(모양){
  globalThis.fetch = async (u) => {
    부른곳.push(String(u));
    const body = 모양(String(u));
    return { ok: !!body, status: body ? 200 : 404, json: async () => body };
  };
  process.chdir(tmp);
  try{ return await mod.해역경계(); }
  finally{ process.chdir(원래); }
}

(async () => {
  // 전부 받았을 때
  const out = await 굽기(() => gj);
  t('예보구를 다 담는다', out && out.areas.length === mod.SEA_AREAS.length, out && out.areas.length);
  t('세토내해가 들어 있다', !!(out && out.areas.find(a => a.c === '4010')),
    out && out.areas.map(a => a.c));
  const 세토 = out.areas.find(a => a.c === '4010');
  t('해역 이름은 気象庁 것 그대로', 세토.n === '瀬戸内海', 세토.n);
  t('윗 예보구도 담는다', 세토.p === '4000' && 세토.pn === '四国沖及び瀬戸内海', [세토.p, 세토.pn]);
  t('테두리 상자를 잰다', String(세토.box) === String([33,130,35,137]), 세토.box);
  t('테두리를 담는다', 세토.rings.length === 2, 세토.rings.length);
  t('출처를 담는다', /気象庁/.test(out.from) && /CC BY 4.0/.test(out.from), out.from);
  t('파일을 쓴다', fs.existsSync(path.join(tmp, 'sea-jp.json')));
  t('부모 없는 해역(対馬海峡)도 담는다',
    !!out.areas.find(a => a.c === '5000' && a.p === ''), out.areas.find(a => a.c === '5000'));

  // 일부만 못 받았을 때 — 나머지는 쓰고, 못 받은 것을 적어 둔다
  fs.rmSync(path.join(tmp, 'sea-jp.json'));
  const 일부 = await 굽기(u => (u.indexOf('4010') > 0 ? null : gj));
  t('일부를 못 받아도 나머지는 담는다', 일부 && 일부.areas.length === mod.SEA_AREAS.length - 1,
    일부 && 일부.areas.length);
  t('못 받은 것을 적어 둔다', 일부 && 일부.했나.못받음.length === 1, 일부 && 일부.했나.못받음);

  // 하나도 못 받았을 때 — 파일을 안 건드린다
  fs.writeFileSync(path.join(tmp, 'sea-jp.json'), '{"지난것":true}');
  const 빈것 = await 굽기(() => null);
  t('하나도 못 받으면 아무것도 안 준다', 빈것 === null, 빈것);
  t('하나도 못 받으면 지난 파일을 안 건드린다',
    fs.readFileSync(path.join(tmp, 'sea-jp.json'), 'utf8') === '{"지난것":true}',
    fs.readFileSync(path.join(tmp, 'sea-jp.json'), 'utf8'));

  // ── ③-2 남의 서버가 안 될 때 (2026-09-04 — 일감이 실제로 죽었다)
//   香川 182곳 · 広島 246곳을 이미 받아 놓고 兵庫 에서 overpass 다섯 대가 다 504 를 내자
//   **통째로 죽어서 이미 받은 428곳까지 버려졌다.**
{
  const src2 = fs.readFileSync(P, 'utf8');
  t('★★★ 한 현이 막혀도 다음 현으로 넘어간다',
    /cache\[v\.pref\] = await osmIn\(box\);[\s\S]{0,400}?catch\(e\)\{[\s\S]{0,200}?못받은현\.push/.test(src2));
  t('★★★ 못 받은 현을 자료에 남긴다 (조용히 넘어가지 않는다)',
    /못받은현,/.test(src2) && /못받은현\.length \? /.test(src2));
  t('★★★ 서버가 다 바쁘면 쉬었다 한 바퀴 더 돈다 (504 는 「지금 바쁘다」 다)',
    /OV_ROUNDS/.test(src2) && /ov한바퀴/.test(src2));

  // ★★★ 적게 받은 날 지난 자료를 덮어쓰지 않는다
  const tmp2 = fs.mkdtempSync(path.join(os.tmpdir(), 'safe-'));
  const f2 = path.join(tmp2, 'spots-x.json');
  fs.writeFileSync(f2, JSON.stringify({ rows: new Array(100).fill(0).map((_, i) => ({ i })) }));
  const 적게 = mod.안전하게쓰기(f2, { rows: new Array(50).fill(0).map((_, i) => ({ i })) });
  t('★★★ 지난 판보다 크게 줄면 **안 쓴다**', 적게 === false, 적게);
  t('★★★ 그리고 지난 자료가 그대로 남는다',
    JSON.parse(fs.readFileSync(f2, 'utf8')).rows.length === 100);
  const 비슷 = mod.안전하게쓰기(f2, { rows: new Array(95).fill(0).map((_, i) => ({ i })) });
  t('★★ 조금 줄어든 것은 쓴다 (자료는 늘 조금씩 움직인다)', 비슷 === true, 비슷);
  const 처음 = mod.안전하게쓰기(path.join(tmp2, '없던것.json'), { rows: [{ i: 1 }] });
  t('★★ 지난 파일이 없으면 그냥 쓴다 (처음 만드는 때)', 처음 === true);
  t('★★ 몫이 사람이 읽을 수 있게 적혀 있다', mod.줄어도되는몫 > 0.5 && mod.줄어도되는몫 < 1, mod.줄어도되는몫);
}

// ── ④ 관 자료 마리나에 자리 붙이기
  //   ★ 자리를 못 찾으면 **안 싣는다** — 엉뚱한 점을 찍으면 그 점을 믿고 배를 몬다
  {
    globalThis.fetch = async () => ({ ok:true, status:200, json: async () => [] });   // 아무것도 못 찾는다
    const r = await mod.한국관마리나([{ n:'해운대마리나', la:35.158, lo:129.16 }]);
    // ★ 4.102 — 사람이 눈으로 찍어 둔 자리(spot_hand.js)는 지도가 없어도 늘 실린다.
    //   그것이 이 표를 둔 까닭이다 — 기계가 못 찾아도 그 마리나는 있다.
    const 손갯수 = Object.keys(mod.손.손으로찍은자리).length;
    t('★★★ 지도 훑기에서 찾은 곳은 싣는다', r.rows.some(x => x.n === '해운대마리나'), r.rows.length);
    t('★★★ 사람이 눈으로 찍은 자리는 지도가 비어도 실린다',
      Object.keys(mod.손.손으로찍은자리).every(n => r.rows.some(x => x.n === n)),
      손갯수 + ' / 실린 것 ' + r.rows.length);
    // ★ 지도에서 찾은 「해운대마리나」 는 사람이 찍은 표에도 들어 있으면 두 번 안 센다.
    const 더한것 = mod.손.손으로찍은자리['해운대마리나'] ? 0 : 1;
    t('★★★ 그 밖에 자리를 못 찾은 곳은 안 싣는다', r.rows.length === 손갯수 + 더한것, r.rows.length);
    t('★★★ 못 찾은 곳 이름을 남긴다',
      r.못찾음.length === mod.KRGOV.length - 손갯수 - 더한것, r.못찾음.length);
    t('★★★ 관 자료는 「확인 안 됨」 딱지를 안 붙인다', r.rows.every(x => x.v === 1), r.rows[0]);
    t('★★ 출처를 줄마다 적는다', /전국 마리나 현황/.test(r.rows[0].t), r.rows[0].t);
  }
  {
    // 주소로 물어봤을 때 — 우리나라 밖 답은 버린다
    let 물음 = 0;
    globalThis.fetch = async () => { 물음++;
      return { ok:true, status:200, json: async () => [{ lat:'1.35', lon:'103.8', display_name:'Singapore' }] }; };
    const r = await mod.한국관마리나([]);
    // ★ 사람이 찍어 둔 자리는 그대로 남고, **물어봐서 온 답은 하나도 안 쓴다**
    t('★★★ 우리나라 밖 답은 버린다', r.어디서.물어봄 === 0, r.어디서);
    t('★★★ 밖에서 온 답으로 실린 곳이 없다',
      r.rows.every(x => !!mod.손.손으로찍은자리[x.n]), r.rows.map(x => x.n).slice(0, 5));
    t('★★ 못 찾은 것은 다 적어 둔다',
      r.못찾음.length === mod.KRGOV.length - Object.keys(mod.손.손으로찍은자리).length, r.못찾음.length);
  }
  {
    // ★ 4.100 — 주소로 물어보면 곳마다 다른 점이 온다. 그걸 그대로 흉내 낸다.
    //   ★ 예전 흉내는 **무엇을 물어도 한 점**을 주었다. 그건 실제로 일어나지 않는 일이고,
    //     그 흉내 때문에 「형산강마리나와 여남요트계류장이 한 점」 인 것을 못 잡았다.
    //     이제 같은 점은 **소재지와 항 구분이 같을 때만** 받는다.
    let 몇 = 0;
    globalThis.fetch = async (u) => {
      const q = decodeURIComponent(String(u).split('&q=')[1] || '');
      const 여수 = /여수/.test(q);
      몇++;
      return { ok:true, status:200, json: async () => [ 여수
        ? { lat:'34.7401', lon:'127.7386', display_name:'여수' }
        : { lat:(35 + 몇 / 1000).toFixed(5), lon:(128 + 몇 / 1000).toFixed(5), display_name:'어딘가' } ] };
    };
    const r = await mod.한국관마리나([]);
    const 이순신 = r.rows.find(x => x.n === '이순신마리나');
    t('★★★ 이순신마리나가 실린다', !!이순신, r.rows.length);
    t('★★★ 원형마리나가 실린다', r.rows.some(x => x.n === '원형마리나'));
    t('★★★ 소재지·항 구분이 같으면 같은 점을 나눠 가진다 (여수시·연안 셋)',
      ['소호마리나','이순신마리나','원형마리나'].every(n => r.rows.some(x => x.n === n)),
      r.rows.filter(x => /소호|이순신|원형/.test(x.n)).map(x => x.n + ' ' + x.la));
    t('★★ 자리는 소수 다섯째 자리까지', 이순신 && String(이순신.la).split('.')[1].length <= 5, 이순신 && 이순신.la);
    t('★★ 선석 수를 한 줄에 적는다', 이순신 && /계류 150척/.test(이순신.t), 이순신 && 이순신.t);
  }
  {
    // ★★★ 곳이 다른데 같은 점이 오면 **못 찾은 것**으로 친다 (형산강·여남)
    globalThis.fetch = async () => ({ ok:true, status:200,
      json: async () => [{ lat:'36.01893', lon:'129.34294', display_name:'포항시' }] });
    const r = await mod.한국관마리나([]);
    const 포항것 = r.rows.filter(x => /형산강|여남/.test(x.n));
    t('★★★ 소재지가 달라도 한 점으로 떨어지면 하나만 싣는다', 포항것.length <= 1,
      포항것.map(x => x.n + ' ' + x.la + ',' + x.lo));
    t('★★★ 나머지는 못 찾은 것으로 이름을 남긴다', r.못찾음.length > 0, r.못찾음.length);
    // 이름을 씻으면 겹치는 곳(도두 공공/민간)이 있어도 번호가 겹치면 안 된다
    const 번호 = r.rows.map(x => x.i);
    t('★★★ 번호가 겹치지 않는다 (도두 공공/민간)', new Set(번호).size === 번호.length,
      번호.filter((x, i) => 번호.indexOf(x) !== i));
  }

  fs.rmSync(tmp, { recursive:true, force:true });
  console.log(`seatest: ${pass} 통과, ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 →', e && e.message); process.exit(1); });
