// 먼바다 해상경보 — WMO 가 막히면 NOAA 사본(WWJP27)으로 받는가 (2026-10-27)
//   사장님: 「실패했을때 백업으로 쓸 수 있는 소스 뭐 없는지 잘 찾아서 넣어라」
//   ★ 표본 metafx/wwjp27-271200.txt 는 2026-10-27 tgftp 에서 본 실제 전문의 앞부분이다.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const SRC = process.env.METAREA_SRC || '/home/claude/webout/scripts/collect_metarea.js';
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 300) : '')); } };
const src = fs.readFileSync(SRC, 'utf8');
const M = require(SRC);
const fx = fs.readFileSync(path.join(__dirname, 'metafx', 'wwjp27-271200.txt'), 'utf8');

// ── 읽기
const p = M.parse(fx, 'WWJP27');
T('★★ WWJP27 머리말을 읽는다', p.head === 'WWJP27 RJTD 271200', p.head);
T('★★ 발표·유효 시각', p.issued === '271200' && p.valid === '281200', p.issued + ' ' + p.valid);
T('★★ 폭풍 경보 둘', p.warnings.length === 2 && p.warnings.every(w => w.kind === 'STORM WARNING'), JSON.stringify(p.warnings.map(w => w.kind)));
T('★★ 중심·반경을 뽑는다', JSON.stringify(p.warnings[0].circles[0]) === JSON.stringify([62, 174, 800]), JSON.stringify(p.warnings[0].circles));
T('★ 베링해 이름을 알아본다', (p.warnings[0].areas || []).includes('BERING SEA'));
T('★ 머리말을 안 주면 예전처럼 WWJP90 을 찾는다', (() => { try{ M.parse(fx); return false; }catch(e){ return /WWJP90 없음/.test(e.message); } })());

// ── 발표 시각
const now = new Date(Date.UTC(2026, 9, 27, 15, 0));
T('★ 발표 시각 셈', M.issuedAt('271200', now).toISOString() === '2026-10-27T12:00:00.000Z');
T('★ 달이 바뀌는 날 (1일에 받은 31일 발표)', M.issuedAt('312300', new Date(Date.UTC(2026, 10, 1, 2, 0))).toISOString() === '2026-10-31T23:00:00.000Z');

// ── 실제로 돌려 본다 (fetch 흉내)
function run(wmo, noaa, nowIso){
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'meta-'));
  const out = path.join(dir, 'w.json');
  const shim = path.join(dir, 'shim.js');
  fs.writeFileSync(shim, `
    const RealDate = Date; const NOW = new RealDate(${JSON.stringify(nowIso)}).getTime();
    global.Date = class extends RealDate { constructor(...a){ if(a.length) super(...a); else super(NOW); } static now(){ return NOW; } };
    global.fetch = async (u) => {
      const s = String(u);
      const r = /wmo\\.int/.test(s) ? ${JSON.stringify(wmo)} : ${JSON.stringify(noaa)};
      if(r === 'THROW') throw new Error('fetch failed');
      return new Response(r.body, { status: r.status });
    };`);
  let code = 0, err = '';
  try{ execFileSync(process.execPath, ['-r', shim, SRC, out], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch(e){ code = e.status; err = String(e.stderr || ''); }
  const j = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null;
  return { code, err, j };
}
const MAINT = { status: 200, body: '<html>Le site est actuellement en maintenance.</html>' };
const W90 = { status: 200, body: '<html><p>' + fx.replace(/WWJP27/g, 'WWJP90') + '</p></html>' };
const N27 = { status: 200, body: fx };

let r = run(W90, N27, '2026-10-27T15:00:00Z');
T('★★★ WMO 가 되면 WMO 것을 쓴다', r.code === 0 && r.j && r.j.via === 'wmo' && /WWJP90/.test(r.j.head), r.err || JSON.stringify(r.j && r.j.via));
r = run(MAINT, N27, '2026-10-27T15:00:00Z');
T('★★★ WMO 가 점검 중이면 NOAA 사본(WWJP27)으로 받는다', r.code === 0 && r.j && r.j.via === 'noaa' && r.j.warnings.length === 2, r.err);
T('★★ 어디서 받았는지 적는다', r.j && /tgftp\.nws\.noaa\.gov/.test(r.j.link) && /WWJP27/.test(r.j.from) && /WWJP90 없음/.test(r.j.wmoFail || ''));
r = run({ status: 503, body: '' }, N27, '2026-10-27T15:00:00Z');
T('★★ WMO 가 503 이어도 NOAA 로', r.code === 0 && r.j && r.j.via === 'noaa', r.err);
r = run('THROW', N27, '2026-10-27T15:00:00Z');
T('★★ WMO 에 아예 못 닿아도 NOAA 로', r.code === 0 && r.j && r.j.via === 'noaa', r.err);
r = run(MAINT, N27, '2026-10-28T03:00:00Z');
T('★★★ 사본이 낡았으면(12시간 넘음) 쓰지 않고 실패한다 — 옛 경보를 새것처럼 내지 않는다', r.code === 1 && !r.j && /낡음/.test(r.err), r.err);
r = run(MAINT, { status: 404, body: '' }, '2026-10-27T15:00:00Z');
T('★★★ 둘 다 못 받으면 실패하고 파일을 안 만든다 (옛 파일을 그대로 둔다)', r.code === 1 && !r.j, r.err);

// ── 고친 자리
T('★ 예비 자료처의 근거(気象庁 카탈로그)를 적어 두었다', /make_product_page\.cgi\?id=KaijoKei/.test(src));
console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad ? 1 : 0);
