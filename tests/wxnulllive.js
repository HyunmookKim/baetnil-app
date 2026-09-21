// F3 — 파주기·시정·조류가 「자료 없는 자리」에서 어떻게 되나.
//
// 왜 이 검사를 만들었나
//   Open-Meteo 는 뭍 한가운데를 물어도 화를 내지 않는다. wave_period 자리에 null 을 담아
//   그대로 돌려준다. 조류(krCurrentKt)는 우리 물때 자료가 있는 자리에서만 값이 나온다.
//   그러니 「자료 없음」은 오류가 아니라 평소에 늘 있는 일이다.
//   앱이 이때 0 으로 읽거나 NaN 을 화면에 내면, 배를 모는 사람이 없는 숫자를 믿게 된다.
//   ★ 앱은 숫자를 지어내지 않는다 — 그 약속을 지키는지 본다.
//
// ★ 인터넷은 안 쓴다. 실제 Open-Meteo 는 컨테이너에서 막혀 있고,
//   어차피 보고 싶은 것은 「null 이 왔을 때 앱이 하는 일」이다. 그래서 값을 심어 놓고 본다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const __ARG  = process.argv[2];
const __BASE = __ARG ? path.dirname(path.resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? path.basename(__ARG) : 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  await pg.route('**/*.json*', r=>r.fulfill({ status:200, body:'{}' }));
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);

  // ── ① 함수가 다 있나
  const has = await pg.evaluate(()=>['wxAt','wxWarnings','krCurrentKt','boatSpec']
    .map(n=>[n, typeof window[n]]));
  T('파주기·시정·조류를 다루는 함수가 다 있다', has.every(h=>h[1]==='function'), has);

  // ── ② 뭍 한가운데처럼 파주기가 null 인 자리
  const inland = await pg.evaluate(()=>{
    const N = 24;
    const mk = v => Array(N).fill(v);
    // ★ 앱의 wxData 는 let 으로 잡혀 있어 window 에 안 붙는다.
    //   window.wxData = ... 로는 앱이 보는 값이 안 바뀐다. 이름 그대로 넣어야 한다.
    wxData = {
      _t0: Date.now(),
      w: { hourly: { time: mk(''), wind_speed_10m: mk(5), wind_gusts_10m: mk(8),
                     visibility: mk(25400) } },
      m: { hourly: { wave_height: mk(null), wave_period: mk(null) } }
    };
    const a = window.wxAt(0);
    return { period:a.period, vis:a.vis, wave:a.wave, current:a.current };
  });
  T('파주기 자료가 없으면 null 로 남는다 (0 이 되지 않는다)', inland.period === null, inland);
  T('시정은 m 를 km 로 바꾼다 (25400 → 25.4)', Math.abs(inland.vis - 25.4) < 0.001, inland);
  T('파고 자료가 없으면 null 로 남는다', inland.wave === null, inland);
  T('물때 자료가 없는 자리에서는 조류가 null 이다', inland.current === null, inland);

  // ── ③ 값이 없는데 경고를 만들어 내지는 않나 (제일 중요한 자리)
  const warn = await pg.evaluate(()=>{
    const out = {};
    out.빈값 = window.wxWarnings({ wind:null, gust:null, wave:null, period:null, vis:null, current:null }).map(w=>w.key);
    out.아무것도안줌 = window.wxWarnings(null).map(w=>w.key);
    out.NaN = window.wxWarnings({ wind:NaN, gust:NaN, wave:NaN, period:NaN, vis:NaN, current:NaN }).map(w=>w.key);
    out.빈문자 = window.wxWarnings({ wind:'', gust:'', wave:'', period:'', vis:'', current:'' }).map(w=>w.key);
    return out;
  });
  T('값이 하나도 없으면 경고를 하나도 내지 않는다', warn.빈값.length === 0, warn.빈값);
  T('아무것도 안 넘겨도 터지지 않고 경고도 없다', warn.아무것도안줌.length === 0, warn.아무것도안줌);
  T('NaN 이 와도 경고를 내지 않는다', warn.NaN.length === 0, warn.NaN);
  // ★ 빈 문자열은 Number('') === 0 이라 조심해야 한다.
  //   「파주기 0초」「시정 0km」는 기준보다 작으니, 안 거르면 없는 위험을 지어내게 된다.
  T('빈 글자가 와도 경고를 내지 않는다 (Number("")는 0 이다)', warn.빈문자.length === 0, warn.빈문자);

  // ── ④ 값이 있을 때는 제대로 경고하나 — 반대쪽도 봐야 검사가 뜻이 있다
  const live = await pg.evaluate(()=>{
    // 기준을 직접 넣고 본다. boatSpec 을 잠깐 바꾼다.
    const 원래 = window.boatSpec;
    window.boatSpec = k => ({ maxWind:10, maxGust:15, maxWave:1.5, maxPeriod:4, minVis:2, maxCurrent:3 })[k] || 0;
    const 넘음  = window.wxWarnings({ wind:12, gust:20, wave:2.0, period:2.5, vis:0.8, current:5 }).map(w=>w.key);
    const 괜찮음 = window.wxWarnings({ wind:5,  gust:7,  wave:0.5, period:8,   vis:20,  current:1 }).map(w=>w.key);
    // ★ 이 줄이 5.1 에서 고친 자리다.
    //   Number(null) === 0 이라, 기준을 넣어 둔 배에서는 파주기 0초·시정 0km 로 읽혀
    //   「파주기가 짧아 배가 심하게 흔들립니다」가 없는 자료 위에 떴었다.
    const 일부없음 = window.wxWarnings({ wind:12, gust:null, wave:null, period:null, vis:null, current:null }).map(w=>w.key);
    const 빈글자섞임 = window.wxWarnings({ wind:12, gust:'', wave:'', period:'', vis:'', current:'' }).map(w=>w.key);
    const 없는칸 = window.wxWarnings({ wind:12 }).map(w=>w.key);
    window.boatSpec = 원래;
    return { 넘음, 괜찮음, 일부없음, 빈글자섞임, 없는칸 };
  });
  T('한계를 넘으면 여섯 가지가 모두 경고된다', live.넘음.length === 6, live.넘음);
  T('한계 안이면 경고가 없다', live.괜찮음.length === 0, live.괜찮음);
  T('있는 값만 판단하고 null 은 건너뛴다', live.일부없음.length === 1 && live.일부없음[0] === 'maxWind', live.일부없음);
  T('빈 글자가 섞여도 그 칸은 건너뛴다',   live.빈글자섞임.length === 1 && live.빈글자섞임[0] === 'maxWind', live.빈글자섞임);
  T('아예 없는 칸도 건너뛴다',             live.없는칸.length === 1 && live.없는칸[0] === 'maxWind', live.없는칸);

  // ── ⑤ 파주기·시정은 「작을수록 나쁨」, 나머지는 「클수록 나쁨」 — 방향이 뒤집혀 있지 않나
  const dir = await pg.evaluate(()=>{
    const 원래 = window.boatSpec;
    window.boatSpec = k => ({ maxPeriod:4, minVis:2, maxWave:1.5 })[k] || 0;
    const r = {
      짧은파주기: window.wxWarnings({ period:2 }).map(w=>w.key),
      긴파주기:   window.wxWarnings({ period:9 }).map(w=>w.key),
      나쁜시정:   window.wxWarnings({ vis:0.5 }).map(w=>w.key),
      좋은시정:   window.wxWarnings({ vis:30 }).map(w=>w.key),
      높은파고:   window.wxWarnings({ wave:3 }).map(w=>w.key),
      낮은파고:   window.wxWarnings({ wave:0.2 }).map(w=>w.key)
    };
    window.boatSpec = 원래;
    return r;
  });
  T('파주기는 짧을 때만 경고한다', dir.짧은파주기.length===1 && dir.긴파주기.length===0, dir);
  T('시정은 나쁠 때만 경고한다',   dir.나쁜시정.length===1   && dir.좋은시정.length===0, dir);
  T('파고는 높을 때만 경고한다',   dir.높은파고.length===1   && dir.낮은파고.length===0, dir);

  // ── ⑥ ★ 값이 없으면 「못 쟀다」고 말하나 — 조용히 넘어가면 안 된다
  //   이것이 제일 위험했던 자리다. 값이 없을 때 카드에 「정해 둔 기준 안에 있습니다」 가
  //   그대로 떴다. 재 보지도 않고 괜찮다고 말한 셈이다.
  const nodata = await pg.evaluate(()=>{
    const 원래 = window.boatSpec;
    window.boatSpec = k => ({ maxWind:10, maxWave:1.5, maxPeriod:4, minVis:2 })[k] || 0;
    const r = {
      전부없음: window.wxMissing({ wind:null, gust:null, wave:null, period:null, vis:null, current:null }).map(m=>m.key),
      일부없음: window.wxMissing({ wind:12, gust:null, wave:null, period:null, vis:null, current:null }).map(m=>m.key),
      다있음:   window.wxMissing({ wind:12, gust:9, wave:1, period:6, vis:10, current:1 }).map(m=>m.key),
      빈글자:   window.wxMissing({ wind:'', wave:'', period:'', vis:'' }).map(m=>m.key),
      기준없음: (()=>{ window.boatSpec = ()=>0;
                      const x = window.wxMissing({}).map(m=>m.key);
                      window.boatSpec = k => ({ maxWind:10, maxWave:1.5, maxPeriod:4, minVis:2 })[k] || 0;
                      return x; })()
    };
    window.boatSpec = 원래;
    return r;
  });
  T('기준 넣은 칸이 전부 비면 넷 다 「못 쟀다」로 잡는다', nodata.전부없음.length === 4, nodata.전부없음);
  T('들어온 값은 빼고 못 쟀다고 한다',                   nodata.일부없음.length === 3 && nodata.일부없음.indexOf('maxWind') < 0, nodata.일부없음);
  T('값이 다 있으면 못 쟀다는 말이 없다',                 nodata.다있음.length === 0, nodata.다있음);
  T('빈 글자도 「못 쟀다」로 잡는다',                     nodata.빈글자.length === 4, nodata.빈글자);
  T('기준을 안 넣었으면 못 쟀다는 말도 안 한다',          nodata.기준없음.length === 0, nodata.기준없음);

  // ── ⑦ 파도 자료가 빈 자리를 둘레 바다에서 찾는 문이 있나
  const ring = await pg.evaluate(()=>{
    if(typeof window.wxRingPts !== 'function' || typeof window.wxMarineNear !== 'function'
       || typeof window.wxHasWave !== 'function') return { 없음:true };
    const pts = window.wxRingPts(34.74, 127.73);
    const 다름 = new Set(pts.map(p=>p.join(','))).size;
    return {
      칸수: pts.length, 다른자리: 다름,
      빈것을빈것으로: window.wxHasWave({ hourly:{ wave_height:[null,null], wave_period:[null,null] } }),
      있는것을있다고: window.wxHasWave({ hourly:{ wave_height:[null,1.2], wave_period:[null,null] } }),
      아무것도없을때: window.wxHasWave(null)
    };
  });
  T('둘레 바다 자리를 만들어 주는 문이 있다', !ring.없음 && ring.칸수 === 48, ring);
  T('둘레 자리가 서로 겹치지 않는다',        ring.다른자리 === ring.칸수, ring);
  T('파도 값이 없으면 없다고 한다',          ring.빈것을빈것으로 === false, ring);
  T('파도 값이 하나라도 있으면 있다고 한다', ring.있는것을있다고 === true, ring);
  T('아무것도 안 넘겨도 터지지 않는다',      ring.아무것도없을때 === false, ring);

  // ── ⑧ 기준을 안 넣었으면 아무 판단도 하지 않는다
  const nospec = await pg.evaluate(()=>{
    const 원래 = window.boatSpec;
    window.boatSpec = () => 0;
    const r = window.wxWarnings({ wind:99, gust:99, wave:99, period:0.1, vis:0.01, current:99 }).map(w=>w.key);
    window.boatSpec = 원래;
    return r;
  });
  T('기준을 안 넣었으면 아무 경고도 하지 않는다', nospec.length === 0, nospec);

  await br.close(); server.close();
  console.log(bad ? ('★ 실패 '+bad+'개 / 통과 '+ok) : ('모두 통과 '+ok+'개'));
  process.exit(bad?1:0);
})().catch(e=>{ console.log('★ 실패: '+e.message); process.exit(1); });
