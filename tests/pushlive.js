// 서버 알림 등록 — 앱인 척하고 진짜로 토큰이 서버로 가는지 본다
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';
// ★ 뿌리(/) 요청이 절대경로 파일이면 cwd 를 붙이지 말고 그대로 연다.
//   전에는 process.cwd() 를 무조건 앞에 붙여 절대경로를 못 받고
//   ERR_HTTP_RESPONSE_CODE_FAILURE 로 검사가 아예 돌지 못했다.
const __MAIN = path.isAbsolute(SRC) ? SRC : path.join(process.cwd(), SRC);
const __BASE = path.dirname(__MAIN);
const __pick = u => {
  const f = u.split('?')[0];
  if(f === '/' || f === '/index.html') return __MAIN;
  const rel = f.replace(/^\//,'');
  for(const d of [__BASE, __dirname, process.cwd()]){ const c = path.join(d, rel); if(fs.existsSync(c)) return c; }
  return path.join(__BASE, rel);
};
const srv = http.createServer((req,res)=>{
  const p = __pick(req.url);
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const e = path.extname(p);
  res.writeHead(200,{'content-type': e==='.html'?'text/html; charset=utf-8':e==='.js'?'text/javascript':'application/octet-stream'});
  res.end(fs.readFileSync(p));
});
// 가짜 다리 — 부품이 받은 값을 그대로 쌓아 둔다
const FAKE = `
window.__pushlog = { reg:0, perm:0, listen:[], local:[] };
window.__grant = 'granted';
window.__token = 'TOK-1111';
window.Capacitor = { isNativePlatform: () => true, Plugins: {
  PushNotifications: {
    async checkPermissions(){ return { receive: window.__grant === 'granted' ? 'granted' : 'prompt' }; },
    async requestPermissions(){ window.__pushlog.perm++; return { receive: window.__grant }; },
    async addListener(name, cb){ window.__pushlog.listen.push(name); window['__cb_'+name] = cb; return {remove(){}}; },
    async register(){ window.__pushlog.reg++;
      setTimeout(()=>{ const c = window.__cb_registration; if(c) c({ value: window.__token }); }, 10); }
  },
  LocalNotifications: {
    async checkPermissions(){ return { display:'granted' }; },
    async requestPermissions(){ return { display:'granted' }; },
    async createChannel(o){ window.__pushlog.local.push(['ch', o.id]); },
    async getPending(){ return { notifications: [] }; },
    async cancel(){}, async schedule(o){ window.__pushlog.local.push(['sched', o.notifications[0]]); }
  }
} };`;
(async ()=>{
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ locale:'ko-KR', viewport:{width:411,height:900} });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  let pass=0, fail=0;
  const t=(n,ok,w)=>{ok?pass++:(fail++,console.log('★ 실패:',n,(w!==undefined?' — '+JSON.stringify(w).slice(0,220):'')));};
  const errs=[]; page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // 로그인한 척 + 파이어스토어 문을 가짜로
  await page.evaluate(()=>{
    window.__user = { uid:'U1', email:'a@b.c', name:'나' };
    window.__saved = [];
    window.__fail = false;
    window.__fcm = {
      async save(body, tok){ if(window.__fail) throw new Error('permission-denied');
        window.__saved.push({ body, tok }); return 'U1'; },
      async get(){ return null; }, async drop(){}
    };
  });

  // ── 알림을 켜지 않았으면 등록하지 않는다
  let r = await page.evaluate(async ()=>{ notiSet({ on:false }); return await fcmRegister(); });
  t('알림을 안 켰으면 등록하지 않는다', r.why === 'off' && !r.ok, r);

  // ── 켜면 등록한다
  r = await page.evaluate(async ()=>{
    window.__saved = []; notiSet({ on:true, myComment:true, series:['돛'], krCats:['기상'], wwCats:[] });
    await fcmRegister();
    await new Promise(z=>setTimeout(z,120));
    return { st: fcmState, saved: window.__saved, log: window.__pushlog,
             tok: localStorage.getItem('bt_pushtok') };
  });
  t('등록을 실제로 불렀다', r.log.reg >= 1, r.log);
  t('토큰 오는 귀를 먼저 열었다', r.log.listen.indexOf('registration') >= 0, r.log.listen);
  t('등록 실패도 듣는다', r.log.listen.indexOf('registrationError') >= 0, r.log.listen);
  t('앱을 켜 둔 채로 오는 것도 듣는다', r.log.listen.indexOf('pushNotificationReceived') >= 0, r.log.listen);
  t('토큰을 서버에 적었다', r.saved.length >= 1 && r.saved[0].tok === 'TOK-1111', r.saved);
  t('이 폰에도 기억해 둔다', r.tok === 'TOK-1111', r.tok);
  t('상태가 「됐다」로 바뀐다', r.st.ok === true && !r.st.why, r.st);

  const body = r.saved[0].body;
  t('설정을 그대로 올린다', body.on === true && body.myComment === true
      && JSON.stringify(body.series) === '["돛"]' && JSON.stringify(body.krCats) === '["기상"]', body);
  t('시간대를 같이 올린다', typeof body.tz === 'string' && body.tz.length > 0, body.tz);
  t('글 내용·배·위치는 안 올린다',
    !('title' in body) && !('body' in body) && !('boat' in body) && !('lat' in body), Object.keys(body));

  // ── 설정을 바꾸면 서버 것도 바뀐다
  r = await page.evaluate(async ()=>{
    window.__saved = [];
    notiSet({ krCats:['기상','안전'] });
    await new Promise(z=>setTimeout(z,1100));
    return window.__saved;
  });
  t('설정을 바꾸면 서버 것도 바뀐다', r.length >= 1 && JSON.stringify(r[r.length-1].body.krCats) === '["기상","안전"]', r);

  // ── 끄면 서버에도 껐다고 알린다
  r = await page.evaluate(async ()=>{
    window.__saved = []; notiSet({ on:false });
    await new Promise(z=>setTimeout(z,1100));
    return window.__saved;
  });
  t('끄면 서버에도 껐다고 알린다', r.some(x=>x.body && x.body.on === false), r);

  // ── 폰이 막으면 그렇다고 말한다
  r = await page.evaluate(async ()=>{
    window.__grant = 'denied'; notiSet({ on:true });
    const st = await fcmRegister();
    window.__grant = 'granted';
    return st;
  });
  t('폰이 막으면 denied 로 잡는다', r.why === 'denied', r);

  // ── 서버에 못 적으면 그렇다고 말한다
  r = await page.evaluate(async ()=>{
    window.__fail = true; localStorage.removeItem('bt_pushtok');
    await fcmRegister(); await new Promise(z=>setTimeout(z,120));
    window.__fail = false;
    return fcmState;
  });
  t('서버에 못 적으면 까닭을 잡는다', r.why.indexOf('save:') === 0, r);

  // ── 화면에 사람 말로 나온다
  const shown = await page.evaluate(async ()=>{
    localStorage.setItem('bt_pushtok','TOK-1111');
    await fcmRegister(); await new Promise(z=>setTimeout(z,150));
    openNoti(); await new Promise(z=>setTimeout(z,200));
    const P = document.getElementById('mrPanel');
    // ★ 4.120 뒤로 「글판」이 「게시판」으로 바뀌었다.
    //   말이 또 바뀌어도 잡히도록, 줄의 겉말이 아니라 「댓글 줄이 있고 그 밑에
    //   붙는 곳이 적혀 있다」를 스위치까지 함께 본다.
    const rows = [...P.querySelectorAll('.notirow')];
    const cr = rows.find(r => /댓글/.test(r.innerText));
    return { text: P.innerText, line: !!P.querySelector('.fcmline'),
             cmtRow: cr ? cr.innerText.replace(/\s+/g,' ').trim() : null,
             cmtSw:  !!(cr && cr.querySelector('.notisw')),
             cmtFn:  cr ? (cr.querySelector('.notisw')||{}).getAttribute
                        ? (cr.querySelector('.notisw').getAttribute('onclick')||'') : '' : '' };
  });
  t('알림 화면에 이 폰 상태 줄이 있다', shown.line);
  t('등록됐다고 사람 말로 말한다', /이 폰이 등록됐습니다/.test(shown.text), shown.text.slice(0,500));
  t('없는 스위치를 안 그린다', !/내 연재에 댓글/.test(shown.text));
  t('내 글에 댓글 줄이 있다', /내 글에 댓글/.test(shown.text), shown.text.slice(0,500));
  t('그 줄에 켜고 끄는 스위치가 달려 있다', shown.cmtSw, shown.cmtRow);
  t('그 스위치가 myComment 를 잡는다', /notiToggle\('myComment'\)/.test(shown.cmtFn||''), shown.cmtFn);
  t('댓글이 붙는 곳만 적는다',
    /게시판/.test(shown.cmtRow||'') && /정박지/.test(shown.cmtRow||'') && !/장터/.test(shown.cmtRow||''),
    shown.cmtRow);

  // ── 로그인 안 했으면
  const nol = await page.evaluate(async ()=>{
    window.__user = null;
    const st = await fcmRegister();
    openNoti(); await new Promise(z=>setTimeout(z,200));
    return { st, text: document.getElementById('mrPanel').innerText };
  });
  t('로그인 안 했으면 login 으로 잡는다', nol.st.why === 'login', nol.st);
  t('로그인하라고 사람 말로 말한다', /로그인하셔야/.test(nol.text), nol.text.slice(0,400));

  // ── 두 채널을 다 만든다
  const ch = await page.evaluate(async ()=>{
    window.__pushlog.local = [];
    await maintChannel();
    return window.__pushlog.local.filter(x=>x[0]==='ch').map(x=>x[1]);
  });
  t('정비 채널과 소식 채널을 다 만든다',
    ch.indexOf('baetnil-maint') >= 0 && ch.indexOf('baetnil-news') >= 0, ch);

  // ── 앱을 켜 둔 채로 오면 우리가 띄운다
  const fg = await page.evaluate(async ()=>{
    window.__pushlog.local = [];
    const cb = window.__cb_pushNotificationReceived;
    if(cb) cb({ title:'제목', body:'내용' });
    await new Promise(z=>setTimeout(z,80));
    return window.__pushlog.local.filter(x=>x[0]==='sched').map(x=>x[1]);
  });
  t('앱을 켜 둔 채로 와도 하나 띄운다', fg.length === 1 && fg[0].title === '제목', fg);
  t('그것도 소식 채널로 간다', fg[0] && fg[0].channelId === 'baetnil-news', fg[0]);

  t('앱이 터지지 않았다 — ' + (errs[0]||''), errs.length === 0);
  console.log(`\n${pass}/${pass+fail} 통과`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{ console.log('★ 검사가 돌지 못했다:', e.message); srv.close(); process.exit(1); });
