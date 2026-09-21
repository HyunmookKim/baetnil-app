// 앱인 척하고 진짜 브라우저에서 열어 본다.
// ★ 소스만 봐서는 "앱에서 자료 자리가 어디로 잡히나" 를 못 잡는다.
//   캐퍼시터 다리(window.Capacitor)를 화면이 뜨기 전에 심어 놓고 실제로 확인한다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
//   실제로 4.44 에서 이 검사가 4.41 짜리 옛 파일을 보고 「다 지났다」고 했다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';
// ★ 주소를 여기 박아 두면 안 된다.
//   4.26 에서 자료 자리를 baetnil.com/app/ 으로 옮겼는데 이 검사만 옛 주소를 물고 있었다.
//   앱이 쓰는 값(DATA_SITE)을 그대로 읽고, 대신 「우리 도메인인가」로 날을 세운다.
const SRC = fs.readFileSync((path.isAbsolute(__MAIN) ? __MAIN : path.join(__BASE, __MAIN)), 'utf8');
const SITE = (SRC.match(/const DATA_SITE = '([^']+)'/) || [])[1] || '';
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(__MAIN)) ? __MAIN : path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── ① 앱일 때 — 자료를 사이트에서 받아 온다
  {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
    // 화면이 뜨기 전에 다리를 심는다 — 캐퍼시터가 하는 것과 같다
    await ctx.addInitScript(()=>{ window.Capacitor = { isNativePlatform: ()=>true, Plugins:{} }; });
    const pg = await ctx.newPage();
    const got = [];
    await pg.route('**/*.json*', r=>{ got.push(r.request().url()); r.fulfill({ status:200, body:'{}' }); });
    await pg.goto(url, { waitUntil:'networkidle' });
    await pg.waitForTimeout(900);
    const base = await pg.evaluate(()=>DATA_BASE);
    T('앱이면 자료를 사이트에서 받는다', !!SITE && base === SITE, base);
    // ★ 남의 도메인(github.io)으로 돌아가면 애플 조직 심사도, 우리 주소도 무너진다
    T('자료 자리가 우리 도메인이다', /^https:\/\/baetnil\.com\//.test(SITE), SITE);
    T('앱 자리(app/)를 가리킨다', /\/app\/$/.test(SITE), SITE);
    await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){}
      switchTab('community'); setComSub('news'); renderNews(true); });
    await pg.waitForTimeout(1200);
    const asked = got.filter(u=>/news\.json|kr\.json/.test(u));
    T('뉴스를 사이트 주소로 부른다', asked.length > 0 && asked.every(u=>u.startsWith(SITE)), asked.slice(0,3));
    T('제 안(localhost)에서 안 찾는다', !asked.some(u=>/127\.0\.0\.1|localhost/.test(u)), asked.slice(0,3));
    await ctx.close();
  }

  // ── ② 웹일 때 — 예전 그대로 앱이 놓인 자리를 따라간다
  {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800} });
    const pg = await ctx.newPage();
    const got = [];
    await pg.route('**/*.json*', r=>{ got.push(r.request().url()); r.fulfill({ status:200, body:'{}' }); });
    await pg.goto(url, { waitUntil:'networkidle' });
    await pg.waitForTimeout(900);
    const base = await pg.evaluate(()=>DATA_BASE);
    T('웹이면 앱이 놓인 자리를 그대로 쓴다', base === url, base);
    await ctx.close();
  }

  // ── ③ 위 시계·배터리 자리를 비켜 간다
  {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
    const pg = await ctx.newPage();
    await pg.goto(url, { waitUntil:'networkidle' });
    await pg.waitForTimeout(700);
    const v = await pg.evaluate(()=>{
      const m = document.querySelector('meta[name="viewport"]');
      return { vp: m ? m.getAttribute('content') : '',
               sat: getComputedStyle(document.documentElement).getPropertyValue('--sat').trim() };
    });
    T('viewport 에 viewport-fit=cover 가 있다', /viewport-fit=cover/.test(v.vp), v.vp);
    // 이 브라우저에는 노치가 없으니 값은 0 이어야 한다 — 웹 화면이 안 밀려야 한다
    const before = await pg.evaluate(()=>document.querySelector('header').getBoundingClientRect().top);
    T('노치가 없으면 아무것도 안 밀린다', before === 0, before);
    // 노치가 있는 척해서 진짜로 밀리는지 본다
    await pg.addStyleTag({ content: ':root{--sat:44px !important}' });
    await pg.waitForTimeout(200);
    const pad = await pg.evaluate(()=>({
      header: getComputedStyle(document.querySelector('header')).paddingTop,
      drawer: getComputedStyle(document.getElementById('drawer')).paddingTop,
      panel:  getComputedStyle(document.getElementById('panel')).paddingTop,
      form:   getComputedStyle(document.getElementById('formOv')).paddingTop
    }));
    T('머리줄이 그만큼 내려온다', pad.header === '44px', pad);
    T('서랍도 내려온다', parseFloat(pad.drawer) >= 44, pad.drawer);
    T('오른쪽 화면도 내려온다', parseFloat(pad.panel) >= 44, pad.panel);
    T('글쓰기 창도 내려온다', parseFloat(pad.form) >= 44, pad.form);
    await ctx.close();
  }

  // ── ④ 날씨 — 못 받은 까닭을 제대로 말한다
  {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
    const pg = await ctx.newPage();
    pg.on('dialog', d=>d.dismiss());
    await pg.goto(url, { waitUntil:'networkidle' });
    await pg.waitForTimeout(800);
    // ★ 까닭이 **셋**이다 — 로그인 안 함 · 동의 안 함 · 폰이 막음.
    //   셋을 한 말로 묶으면, 앱 안에서 동의를 거절한 사람이
    //   멀쩡한 폰 설정을 뒤지다 앱이 고장난 줄 알게 된다 (5.0 에서 갈람).
    const say = async (signedIn, agreed) => pg.evaluate(async ([inn, ag])=>{
      try{ skipWelcome(); }catch(_){}
      window.__user = inn ? { uid:'U1', email:'a@b.c', name:'김' } : null;
      try{ me = window.__user; }catch(_){}
      try{ locSet(!!ag); }catch(_){}
      wxCur = null; wxGeoTried = true; wxSpots = [];
      switchTab('home'); setHomeSub('weather');
      await new Promise(r=>setTimeout(r,400));
      const el = document.querySelector('#weatherWrap .emptybox') || document.querySelector('.emptybox');
      return (el ? el.innerText : document.body.innerText);
    }, [signedIn, agreed]);

    const out = await say(false, false);
    T('로그인 안 했으면 로그인 얘기를 한다', /로그인하신 분에게만/.test(out), out.slice(0,160));
    T('그때 권한 얘기는 안 한다', !/설정에서 위치 권한/.test(out), out.slice(0,160));
    T('로그인 단추가 있다',
      await pg.evaluate(()=>!!document.querySelector('#weatherWrap .emptybox button[onclick*="openAccount"]')));

    // ② 로그인은 했지만 앱 안에서 동의를 안 했다
    const out2 = await say(true, false);
    T('★★★ 동의를 안 했으면 동의 얘기를 한다', /동의하지 않으셨습니다/.test(out2), out2.slice(0,160));
    T('★★★ 그때 폰 설정 얘기는 안 한다 (멀쩡한 데를 뒤지게 만들지 않는다)',
      !/설정에서 위치 권한/.test(out2), out2.slice(0,160));
    T('그때도 다시 해 볼 단추가 있다',
      await pg.evaluate(()=>!!document.querySelector('#weatherWrap .emptybox button[onclick*="wxRetryGPS"]')));

    // ③ 로그인도 하고 동의도 했는데 못 받았다 — 그때서야 폰 설정 얘기다
    const out3 = await say(true, true);
    T('로그인·동의 다 했는데 못 받으면 권한 얘기를 한다', /설정에서 위치 권한/.test(out3), out3.slice(0,160));
    T('그때는 다시 시도 단추가 있다',
      await pg.evaluate(()=>!!document.querySelector('#weatherWrap .emptybox button[onclick*="wxRetryGPS"]')));
    T('세 갈래가 서로 다른 말을 한다', out !== out2 && out2 !== out3 && out !== out3);
    await ctx.close();
  }

  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  await br.close(); server.close();
  process.exit(bad?1:0);
})();
