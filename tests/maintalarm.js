// 정비 알람 브라우저 검사 — 앱인 척하고 진짜로 알람이 걸리는지 본다
//
// ★ 소스만 봐서는 「알람이 정말 걸리나」를 못 잡는다. 알람은 앱에서만 도는 기능이라
//   캐퍼시터 다리(window.Capacitor)를 화면이 뜨기 전에 심어 놓고, 부품이 실제로
//   받은 값을 그대로 꺼내 본다.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';

const srv = http.createServer((req,res)=>{
  let f = req.url.split('?')[0];
  if(f === '/' || f === '/index.html') f = '/' + SRC;
  const p = path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const ext = path.extname(p);
  res.writeHead(200, { 'content-type':
    ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript':
    ext==='.json'?'application/json':'application/octet-stream' });
  res.end(fs.readFileSync(p));
});

// 앱인 척하는 가짜 다리. 부품이 받은 값을 그대로 쌓아 둔다.
const FAKE = `
window.__log = { sched: [], cancel: [], channel: [] };
window.__pending = [];
window.Capacitor = {
  isNativePlatform: () => true,
  Plugins: {
    LocalNotifications: {
      async checkPermissions(){ return { display:'granted' }; },
      async requestPermissions(){ return { display:'granted' }; },
      async createChannel(o){ window.__log.channel.push(o); },
      async getPending(){ return { notifications: window.__pending }; },
      async cancel(o){ window.__log.cancel.push(o);
        const ids = (o.notifications||[]).map(x=>String(x.id));
        window.__pending = window.__pending.filter(n=>ids.indexOf(String(n.id))<0); },
      async schedule(o){ window.__log.sched.push(o);
        (o.notifications||[]).forEach(n=>window.__pending.push({ id:n.id, extra:n.extra })); }
    }
  }
};`;

(async ()=>{
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ locale:'ko-KR', viewport:{width:411,height:900} });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  let pass=0, fail=0;
  const t=(n,ok,w)=>{ok?pass++:(fail++,console.log('★ 실패:',n,(w!==undefined?' — '+JSON.stringify(w).slice(0,220):'')));};
  const errs=[];
  page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);

  // ── 정비 목록을 심는다. 날짜를 손으로 잡아 언제 울려야 하는지 미리 안다.
  //    m1  : 30일 뒤가 기한   → 7일 전(23일 뒤) · 당일(30일 뒤) · 지난 뒤 3·6·9일
  //    m2  : 이미 지난 것     → 지난 뒤에 걸 것만 (앞의 둘은 이미 지났다)
  //    m3  : 한 번도 안 함    → 아예 안 건다
  //    m4  : 알림 꺼 둔 것    → 안 건다
  //    m5  : 미뤄 둔 것       → 안 건다
  const setup = async (patch)=> page.evaluate(async (p)=>{
    const day = n => { const d = new Date(); d.setDate(d.getDate()+n);
      const z = x => String(x).padStart(2,'0');
      return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); };
    maint = [
      { id:'m1', name:'엔진 오일', lastDate: day(0),    months:30, unit:'d' },
      { id:'m2', name:'프로펠러',  lastDate: day(-100), months:30, unit:'d' },
      { id:'m3', name:'한 적 없음', lastDate:'',        months:30, unit:'d' },
      { id:'m4', name:'꺼 둔 것',   lastDate: day(0),   months:30, unit:'d', noti:false },
      { id:'m5', name:'미뤄 둔 것', lastDate: day(0),   months:30, unit:'d', snooze: day(90) }
    ];
    notiSet(Object.assign({ on:true, maint:true, quiet:true, from:'22:00', to:'06:00',
                            maintBefore:7, maintAgain:3, maintAt:'09:00' }, p||{}));
    window.__log = { sched: [], cancel: [], channel: [] };
    await maintAlarmSync();
    const s = window.__log.sched[0];
    return {
      n: s ? s.notifications.length : 0,
      ns: s ? s.notifications.map(x=>({ id:x.id, body:x.body, ch:x.channelId,
             bt:(x.extra||{}).bt, at:new Date(x.schedule.at).toISOString() })) : [],
      channel: window.__log.channel[0] || null,
      last: maintAlarmLast
    };
  }, patch);

  const r = await setup();

  t('알람을 실제로 걸었다', r.n > 0, r.n);
  t('안드로이드 채널을 먼저 만들었다', !!r.channel && r.channel.id === 'baetnil-maint', r.channel);
  t('채널 중요도가 높다 (소리가 난다)', r.channel && r.channel.importance === 4, r.channel);
  t('전부 우리 것으로 표시했다', r.ns.every(x=>x.bt==='maint'));
  t('전부 그 채널로 간다', r.ns.every(x=>x.ch==='baetnil-maint'));

  const names = s => r.ns.filter(x=>x.body.indexOf(s)===0).length;
  t('기한이 남은 것은 다섯 번 (7일 전·당일·지난 뒤 셋)', names('엔진 오일') === 5, r.ns.map(x=>x.body));
  t('한 번도 안 한 것은 안 건다', names('한 적 없음') === 0);
  t('알림 꺼 둔 항목은 안 건다', names('꺼 둔 것') === 0);
  t('미뤄 둔 항목은 안 건다', names('미뤄 둔 것') === 0);
  t('이미 지난 것도 다시 부른다', names('프로펠러') > 0, r.ns.filter(x=>x.body.indexOf('프로펠러')===0).map(x=>x.body));

  t('전부 앞으로 올 시각이다', r.ns.every(x=>new Date(x.at) > new Date()), r.ns.map(x=>x.at));
  t('번호가 겹치지 않는다', new Set(r.ns.map(x=>x.id)).size === r.ns.length);
  t('번호가 안드로이드가 받는 크기다', r.ns.every(x=>x.id >= 0 && x.id < 2147483647));
  t('고른 시각(09:00)에 울린다', r.ns.every(x=>new Date(x.at).getHours() === 9), r.ns.map(x=>x.at));
  t('무엇이 언제인지 글에 적혀 있다',
    r.ns.some(x=>/일 뒤가 기한/.test(x.body)) && r.ns.some(x=>/오늘이 기한/.test(x.body))
    && r.ns.some(x=>/기한이 지났/.test(x.body)), r.ns.map(x=>x.body));
  t('몇 개 걸었는지 들고 있다', r.last && r.last.n === r.n && !r.last.why, r.last);

  // ── 사람이 고른 값이 진짜로 먹히는가
  const r2 = await setup({ maintBefore:0, maintAgain:0 });
  t('「당일에만」을 고르면 한 번만 건다',
    r2.ns.filter(x=>x.body.indexOf('엔진 오일')===0).length === 1, r2.ns.map(x=>x.body));
  const r3 = await setup({ maintBefore:14, maintAgain:1 });
  t('「14일 전」을 고르면 그날 건다', (()=>{
    const x = r3.ns.find(y=>/엔진 오일/.test(y.body) && /일 뒤가 기한/.test(y.body));
    if(!x) return false;
    const d = Math.round((new Date(x.at) - new Date())/864e5);
    return d >= 15 && d <= 17;                    // 30일 뒤 기한 - 14일
  })(), r3.ns.map(x=>x.body+' @ '+x.at));
  const r4 = await setup({ maintAt:'07:30' });
  t('시각을 바꾸면 그 시각에 울린다',
    r4.ns.every(x=>new Date(x.at).getHours()===7 && new Date(x.at).getMinutes()===30), r4.ns[0]);

  // ── 밤에는 안 울린다
  const r5 = await setup({ maintAt:'03:00', quiet:true, from:'22:00', to:'06:00' });
  t('밤 시각을 골라도 아침으로 밀린다',
    r5.ns.every(x=>new Date(x.at).getHours()===6), r5.ns.slice(0,3).map(x=>x.at));
  const r6 = await setup({ maintAt:'03:00', quiet:false });
  t('밤에 안 울리기를 끄면 그대로 그 시각',
    r6.ns.every(x=>new Date(x.at).getHours()===3), r6.ns.slice(0,3).map(x=>x.at));

  // ── 끄면 안 걸린다 · 다시 걸 때 옛것을 지운다
  const off = await page.evaluate(async ()=>{
    window.__log = { sched: [], cancel: [], channel: [] };
    notiSet({ maint:false });
    await maintAlarmSync();
    return { sched: window.__log.sched.length, cancel: window.__log.cancel.length,
             pending: window.__pending.length };
  });
  t('정비를 끄면 하나도 안 건다', off.sched === 0 || (off.sched===1 && off.pending===0), off);
  t('끌 때 걸어 뒀던 것을 지운다', off.pending === 0, off);

  const again = await page.evaluate(async ()=>{
    notiSet({ maint:true });
    await maintAlarmSync();
    const first = window.__pending.length;
    window.__log = { sched: [], cancel: [], channel: [] };
    await maintAlarmSync();
    return { first, cancel: window.__log.cancel.length, after: window.__pending.length };
  });
  t('두 번 걸어도 두 배가 되지 않는다', again.after === again.first, again);
  t('다시 걸 때 옛것을 지운다', again.cancel === 1, again);

  // ── 전체를 끄면
  const allOff = await page.evaluate(async ()=>{
    notiSet({ on:false });
    await maintAlarmSync();
    return window.__pending.length;
  });
  t('알림 전체를 끄면 걸어 둔 것이 없어진다', allOff === 0, allOff);

  // ── 화면에 실제로 보이는가
  const shown = await page.evaluate(async ()=>{
    notiSet({ on:true, maint:true });
    await maintAlarmSync();
    openNoti();
    await new Promise(r=>setTimeout(r,250));
    const P = document.getElementById('mrPanel');
    const opts = [...P.querySelectorAll('.optb')].map(e=>({
      txt: e.textContent.trim(), on: e.classList.contains('on'),
      w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) }));
    return { text: P.innerText, opts };
  });
  t('고르는 단추가 화면에 나온다', shown.opts.length >= 8, shown.opts.length);
  t('고른 것이 켜져 보인다', shown.opts.some(o=>o.on));
  t('고르는 단추가 손가락 크기다', shown.opts.every(o=>o.w>=38 && o.h>=38), shown.opts[0]);
  t('몇 개 걸어 뒀는지 화면에 나온다', /걸어 둔 알람/.test(shown.text), shown.text.slice(0,400));
  t('며칠 전·지나면 다시·울리는 시각이 다 보인다',
    /며칠 전에/.test(shown.text) && /지나면 다시/.test(shown.text) && /울리는 시각/.test(shown.text));
  t('정비는 폰이 스스로 울린다고 말한다', /폰이 스스로 울립니다/.test(shown.text), shown.text.slice(-300));

  t('앱이 터지지 않았다 — ' + (errs[0]||''), errs.length === 0);

  console.log(`\n${pass}/${pass+fail} 통과`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{ console.log('★ 검사가 돌지 못했다:', e.message); srv.close(); process.exit(1); });
