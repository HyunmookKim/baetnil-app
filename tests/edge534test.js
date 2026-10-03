// 5.34 — 안드로이드 14 이하도 화면 끝까지 그린다 (플레이 권장 「더 넓은 화면」 — EdgeToEdge.enable) · 아래 내비게이션 줄 비켜 가기
//   ① 앱 껍데기: 14 이하에서 EdgeToEdge.enable · 지원 중단된 setStatusBarColor 안 부름 · 위(14 이하)·아래(모든 판) 높이를 웹에 알림
//   ② 웹: 아래 여백은 한 곳(--sab) · 안드로이드가 알려 주면 탭 줄이 그만큼 늘고 탭 줄 위에 붙는 것들이 그만큼 올라감
//   ③ 아이폰·웹은 그대로 (--sab = env(safe-area-inset-bottom))
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const src = fs.readFileSync(FILE, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const M = fs.readFileSync(__dirname + '/../android/app/src/main/java/kr/baetnil/app/MainActivity.java', 'utf8');
const G = fs.readFileSync(__dirname + '/../android/app/build.gradle', 'utf8');
T('14 이하에서 EdgeToEdge.enable 을 super.onCreate 앞에서 부른다',
  /if \(Build\.VERSION\.SDK_INT < 35\) \{\s*try \{ EdgeToEdge\.enable\(this\); \}[\s\S]{0,80}\}\s*super\.onCreate\(savedInstanceState\);/.test(M));
T('MainActivity 는 지원 중단된 setStatusBarColor 를 부르지 않는다', !/\.setStatusBarColor\(/.test(M));
T('14 이하용 시스템 UI 표시 지우기(5.21)를 뺐다', !/setSystemUiVisibility\(/.test(M));
T('위 높이는 14 이하에서만 __sat 으로 보낸다', /Build\.VERSION\.SDK_INT < 35 && top > 0[\s\S]{0,240}window\.__sat/.test(M));
T('아래 높이(내비게이션 줄)는 모든 판에서 __sab 으로 보낸다', /navigationBars\(\)\)\.bottom/.test(M) && /window\.__sab&&window\.__sab\(/.test(M));
T('화면 파일을 다시 읽을 때마다 다시 보낸다', /onPageLoaded[\s\S]{0,200}host\.post\(sendBars\)/.test(M));
T('웹뷰가 아니라 바깥 틀에 처리기를 건다(5.15 교훈)', /setOnApplyWindowInsetsListener\(host,/.test(M) && !/setOnApplyWindowInsetsListener\(wv,/.test(M));
T('androidx.activity 를 앱에 직접 넣었다', /implementation "androidx\.activity:activity:\$androidxActivityVersion"/.test(G));
// 웹
T('아래 여백을 env 로 직접 쓰는 곳이 없다 (--sab 한 곳)', !/env\(safe-area-inset-bottom/.test(src.replace(':root{--sab:env(safe-area-inset-bottom,0px)}', '').replace('예전처럼 env(safe-area-inset-bottom).', '')));
T('--sab 기본값은 env (아이폰·웹 그대로)', src.includes(':root{--sab:env(safe-area-inset-bottom,0px)}'));
T('__sab 이 있다', /window\.__sab = function\(px\)/.test(src));
T('적어 둔 아래 높이는 안드로이드 앱에서만 켤 때 쓴다', /C\.getPlatform\(\) === 'android'\)\{\s*const s0 = localStorage\.getItem\('bt_sab'\)/.test(src));

const { chromium } = require('playwright'), http = require('http');
const server = http.createServer((q, r) => { const f = q.url === '/' ? FILE : path.join(path.dirname(FILE), decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200); r.end(d); }); });
(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const look = async (mode, after) => {
    const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, locale: 'ko-KR' });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    if(mode !== 'web') await ctx.addInitScript(p => { window.Capacitor = { isNativePlatform: () => true, getPlatform: () => p, Plugins: {} }; }, mode);
    const pg = await ctx.newPage(); await pg.goto(url, { waitUntil: 'load' }); await pg.waitForTimeout(1200);
    await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} try{ switchTab('home'); }catch(_){} });
    if(after) await pg.evaluate(after);
    await pg.waitForTimeout(600);
    const m = await pg.evaluate(() => { const tb = document.getElementById('tabbar'); const r = tb.getBoundingClientRect();
      const bb = Math.max(...[...tb.querySelectorAll('button')].map(x => x.getBoundingClientRect().bottom));
      const mp = document.getElementById('mrPanel'); const ps = getComputedStyle(mp);
      return { sabn: document.documentElement.classList.contains('sabn'), tbH: Math.round(r.height), tbBottom: Math.round(r.bottom), btn: Math.round(bb), H: innerHeight,
               panelBottom: ps.bottom, sat: getComputedStyle(document.querySelector('header')).paddingTop, stored: localStorage.getItem('bt_sab') }; });
    return { m, pg, ctx };
  };
  const w = await look('web');
  T('웹: 표시 없음 · 탭 줄 그대로', !w.m.sabn && w.m.tbBottom === w.m.H, w.m);
  const i = await look('ios', () => { try{ localStorage.setItem('bt_sab', '48'); }catch(_){} });
  await i.pg.reload({ waitUntil: 'load' }); await i.pg.waitForTimeout(1000);
  const i2 = await i.pg.evaluate(() => document.documentElement.classList.contains('sabn'));
  T('아이폰: 적어 둔 값이 있어도 안 쓴다', !i2);
  await i.ctx.close();
  const a = await look('android', () => { window.__sab(144); window.__sat(108); });   // 기기 픽셀 (dpr 3 → 48 · 36)
  T('안드로이드: __sab 받으면 표시가 붙는다', a.m.sabn, a.m);
  T('안드로이드: 탭 단추가 내비게이션 줄(48) 위에 있다', a.m.btn <= a.m.H - 48 + 1, a.m);
  T('안드로이드: 탭 줄 바탕은 화면 끝까지 (내비게이션 줄 뒤까지 칠함)', a.m.tbBottom === a.m.H, a.m);
  T('안드로이드: 탭 줄 위 창은 62+48 위에 붙는다', a.m.panelBottom === '110px', a.m.panelBottom);
  T('안드로이드: 머리줄 위 여백 = 시계 줄 36', a.m.sat === '36px', a.m.sat);
  T('안드로이드: 받은 값을 적어 둔다', a.m.stored === '48', a.m.stored);
  await a.pg.reload({ waitUntil: 'load' }); await a.pg.waitForTimeout(1000);
  const a2 = await a.pg.evaluate(() => ({ c: document.documentElement.classList.contains('sabn'), v: document.documentElement.style.getPropertyValue('--sabn') }));
  T('안드로이드: 다시 켜면 앱이 알려 주기 전부터 적어 둔 값으로 비킨다', a2.c && a2.v === '48px', a2);
  await a.pg.evaluate(() => window.__sab(0)); await a.pg.waitForTimeout(300);
  const a3 = await a.pg.evaluate(() => document.documentElement.classList.contains('sabn'));
  T('안드로이드: 내비게이션 줄이 없으면(0) 표시를 뗀다', !a3);
  await a.ctx.close();
  await br.close(); server.close();
  console.log('\n' + ok + ' 통과 · ' + bad + ' 실패'); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 터짐 — ' + e.message); process.exit(1); });
