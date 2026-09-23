// 5.14 — 웹에서 켤 때 화면 파일을 통째로 받지 않는다 (안 바뀌었으면 304). 바뀌면 바로 받는다.
//   실제 브라우저(크로미움)로 서비스워커를 돌려 본다. 서버는 파일 날짜(Last-Modified)로 304 를 준다 —
//   baetnil.com 이 실제로 그렇게 답한다(2026-09-23 확인).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const SRC = process.argv[2] || '../../work.html';
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x ? ' — ' + x : '')); } };
const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'sw304-'));
fs.copyFileSync(SRC, path.join(ROOT, 'index.html'));
fs.copyFileSync(path.join(path.dirname(SRC), 'sw.js'), path.join(ROOT, 'sw.js'));
const log = [];
const srv = http.createServer((q, res) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? '/index.html' : u);
  if(!fs.existsSync(f) || fs.statSync(f).isDirectory()){ res.writeHead(404); res.end(); return; }
  const lm = new Date(fs.statSync(f).mtimeMs).toUTCString();
  const isDoc = u === '/' || u.endsWith('index.html');
  if(q.headers['if-modified-since'] === lm){ if(isDoc) log.push(304); res.writeHead(304); res.end(); return; }
  if(isDoc) log.push(200);
  res.writeHead(200, { 'Content-Type': u.endsWith('.js') ? 'text/javascript' : 'text/html', 'Last-Modified': lm, 'Cache-Control': 'max-age=600' });
  fs.createReadStream(f).pipe(res);
});
(async () => {
  await new Promise(r => srv.listen(0, r));
  const PORT = srv.address().port;
  const br = await chromium.launch(); const pg = await (await br.newContext()).newPage();
  await pg.goto('http://127.0.0.1:' + PORT + '/index.html', { waitUntil:'load' });
  await pg.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout:30000 }).catch(()=>{});
  await pg.reload({ waitUntil:'load' }); await pg.waitForTimeout(1200);
  log.length = 0;
  await pg.reload({ waitUntil:'load' }); await pg.waitForTimeout(1200);
  await pg.reload({ waitUntil:'load' }); await pg.waitForTimeout(1200);
  T('★★★ 안 바뀌었으면 켤 때 화면 파일을 통째로 안 받는다 (304 만) — ' + log.join(','), log.length >= 2 && log.every(x => x === 304));
  const f = path.join(ROOT, 'index.html');
  fs.appendFileSync(f, '\n<!-- 새 버전 표시 -->\n'); const t = new Date(Date.now() + 5000); fs.utimesSync(f, t, t);
  log.length = 0;
  await pg.reload({ waitUntil:'load' }); await pg.waitForTimeout(1500);
  const got = await pg.evaluate(() => new XMLSerializer().serializeToString(document).includes('새 버전 표시'));
  T('★★★ 서버 파일이 바뀌면 바로 받아서 화면에 쓴다 — ' + log.join(','), log.includes(200) && got);
  await br.close(); srv.close();
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})();
