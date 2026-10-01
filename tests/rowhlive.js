// 5.29 — 기록 창 칸 높이 맞춤(min-height 70)은 기록 창에만 (안드로이드 15 에뮬레이터 꺼짐 원인)
//   5.27 에서 모든 화면에 건 `#mrPanel.full .mrrow{min-height:70px}` 하나 때문에 로그인 화면에서 키보드가 뜨면
//   에뮬레이터가 통째로 꺼졌다. 검사용 가지로 나눠 확인(e2e-check-528-mrh 만 되돌려 55/0).
//   ① 기록 창(정기점검)은 5.27 처럼 줄 높이가 고르다 (사장님 「들죽날죽이다」)
//   ② 로그인·계정 화면은 5.26 처럼 이 규칙이 안 걸린다
//   ③ 기록 창을 열었다가 로그인 화면으로 가면 규칙이 풀린다
// 사용: node rowhlive.js ../www/index.html
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'work.html'), ROOT = path.dirname(FILE);
const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200); r.end(d); }); });
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
(async () => {
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale: 'ko-KR', viewport: { width: 412, height: 924 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo/, r => r.abort());
  await ctx.addInitScript(() => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); }catch(_){} });
  const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/');
  await pg.waitForFunction(() => typeof openMR === 'function' && typeof openAccount === 'function'); await pg.waitForTimeout(1500);
  const rows = () => pg.evaluate(() => { const P = document.getElementById('mrPanel');
    return { rec: P.classList.contains('rec'), mh: [...P.querySelectorAll('.mrrow')].filter(r => !r.classList.contains('edt') && r.innerHTML.trim()).map(r => getComputedStyle(r).minHeight) }; });
  await pg.evaluate(() => { unlocked = true; maint.push({ id:'m77', name:'엔진오일', grp:'추진', months:12, unit:'m', lastDate:'2026-08-18' }); openMR('maint', 'm77'); });
  await pg.waitForTimeout(400);
  const a = await rows();
  T('① 기록 창에는 줄 높이 맞춤이 걸린다', a.rec && a.mh.length > 3 && a.mh.every(x => x === '70px'), a);
  await pg.evaluate(() => openAccount()); await pg.waitForTimeout(400);
  const b = await rows();
  T('② 로그인 화면에는 안 걸린다 (5.26 과 같다)', !b.rec && b.mh.every(x => x !== '70px'), b);
  await pg.evaluate(() => openMR('maint', 'm77')); await pg.waitForTimeout(300);
  await pg.evaluate(() => openWipe && null);
  const c = await rows();
  T('③ 다시 기록 창을 열면 다시 걸린다', c.rec, c);
  T('오류 없음', !errs.length, errs.slice(0, 3));
  await br.close(); srv.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})();
