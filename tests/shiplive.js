// 5.35 — 내보내는 파일(tools/ship.js)이 원본과 똑같이 도는가
// ★ 사장님: 「더 빠르게 이건 어플의 기존 기능을 해치지 않냐?」 → 「응 한다음에 조금이라도 문제 생기면 되돌려라」
//   원본과 내보낸 파일을 같은 브라우저에 띄워
//   ① 오류 없이 켜지나 ② 네 나라 말 모두 사전 글이 원본과 한 글자도 안 다른가
//   ③ 말 바꾸기(한→영→러→일→한)가 되나 ④ 화면 글이 원본과 같은가 ⑤ 판 번호 줄이 그대로인가 를 본다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = path.resolve(process.argv[2] || '../www/index.html');
const OUT = path.join(__dirname, 'ship_built.html');
cp.execFileSync('node', [path.join(__dirname, '../tools/ship.js'), SRC, OUT], { stdio: 'inherit' });
const files = { '/src.html': SRC, '/ship.html': OUT };
const server = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  const f = files[u] || path.join(path.dirname(SRC), u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    if(f.endsWith('.html')) rs.setHeader('Content-Type', 'text/html; charset=utf-8');
    if(/\.m?js$/.test(f)) rs.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    if(f.endsWith('.json')) rs.setHeader('Content-Type', 'application/json');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 260) : '')); } };

const shipped = fs.readFileSync(OUT, 'utf8'), orig = fs.readFileSync(SRC, 'utf8');
const ver = orig.match(/const APP_VER = '([^']+)'/)[1];
T('판 번호 줄이 원본 꼴 그대로 (build.gradle 이 읽는다)', shipped.includes("const APP_VER = '" + ver + "'"));
T('내보낸 파일이 더 작다', shipped.length < orig.length * 0.9, [orig.length, shipped.length]);
T('사전 JSON 칸 셋 (en·ru·ja)', ['en', 'ru', 'ja'].every(k => new RegExp('<script type="application/json" id="i18n-' + k + '">').test(shipped)));

(async () => {
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // 원본 사전 열쇠 (ko 기준 글)
  const keys = await (async () => {
    const ctx = await br.newContext(); const pg = await ctx.newPage();
    await pg.goto(base + '/src.html', { waitUntil: 'networkidle' });
    const ks = await pg.evaluate(() => Object.keys(I18N.en || {}));
    await ctx.close(); return ks;
  })();
  T('원본 사전 열쇠를 읽었다', keys.length > 3000, keys.length);

  const run = async (file, lang) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await ctx.addInitScript((l, ks) => { try{ localStorage.setItem('bt_lang', l); }catch(e){} window.__k = ks; }, lang, keys);
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    pg.on('console', m => { if(m.type() === 'error' && !/Failed to load resource|net::|404|Could not reach Cloud Firestore/.test(m.text())) errs.push('console: ' + m.text().slice(0, 160)); });
    await pg.goto(base + file, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(1500);
    const out = await pg.evaluate(() => ({
      ver: APP_VER,
      text: document.body.innerText.replace(/\s+/g, ' ').slice(0, 3000),
      tr: (window.__k || []).map(k => t(k)),
      cov: typeof langCoverage === 'function' ? (() => { try{ return JSON.stringify(langCoverage()); }catch(e){ return 'ERR ' + e.message; } })() : null
    }));
    await ctx.close();
    return { out, errs };
  };

  for(const lang of ['ko', 'en', 'ru', 'ja']){
    const a = await run('/src.html', lang), b = await run('/ship.html', lang);
    T(lang + ' — 내보낸 파일이 오류 없이 켜진다', b.errs.length === 0, b.errs);
    T(lang + ' — 원본도 오류 없이 (비교 기준)', a.errs.length === 0, a.errs);
    const diff = []; a.out.tr.forEach((x, i) => { if(x !== b.out.tr[i]) diff.push([keys[i], x, b.out.tr[i]]); });
    T(lang + ' — 사전 ' + keys.length + '개 글이 원본과 모두 같다', diff.length === 0, diff.slice(0, 3));
    T(lang + ' — 첫 화면 글이 원본과 같다', a.out.text === b.out.text, [a.out.text.slice(0, 120), b.out.text.slice(0, 120)]);
    T(lang + ' — 말 사전 채움 비율이 같다', a.out.cov === b.out.cov, [a.out.cov, b.out.cov]);
    T(lang + ' — 판 번호', b.out.ver === ver);
  }

  // 말 바꾸기 — 한 화면 안에서 차례로 (사전을 그때 읽는다)
  {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pg = await ctx.newPage();
    const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    await pg.goto(base + '/ship.html', { waitUntil: 'networkidle' });
    await pg.waitForTimeout(800);
    const seq = [];
    for(const l of ['en', 'ru', 'ja', 'ko']){
      await Promise.all([pg.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => {}), pg.evaluate(v => setLang(v), l)]);
      await pg.waitForTimeout(600);
      seq.push(await pg.evaluate(() => t('저장') + '|' + langNow()));
    }
    T('말 바꾸기 영→러→일→한 이 된다 (내보낸 파일, 앱의 setLang)', /\|en$/.test(seq[0]) && /\|ru$/.test(seq[1]) && /\|ja$/.test(seq[2]) && seq[3] === '저장|ko' && new Set(seq.map(x => x.split('|')[0])).size === 4, seq);
    T('말 바꾸기 중 오류 없음', errs.length === 0, errs);
    await ctx.close();
  }

  await br.close(); server.close();
  try{ fs.unlinkSync(OUT); }catch(e){}
  console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 멈춤 — ' + e.message); process.exit(1); });
