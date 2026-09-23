/* 뱃일 — 효율 재기 (아이폰 시뮬레이터 · 안드로이드 에뮬레이터용)
 *
 * ★ 스토어에 나가는 앱에는 들어가지 않는다. ios-perf.yml · android-perf.yml 이
 *   재기용 빌드를 만들 때만 index.html 끝에 <script src="perf.js"> 로 끼워 넣는다.
 * ★ 앱을 고치지 않는다. 재기만 한다 (사장님: 「재기만 하고 보고해라」).
 *
 * 앱을 세 번 켠다 (깃허브 기계가 껐다 켠다).
 *   1번째 · 2번째 · 3번째 켤 때마다 — 켜지는 단계별 시간 (두 번째부터 빨라지는가 = 엔진이 코드를 담아 두는가)
 *   2번째 켰을 때 한 번만 —
 *     ① 항적 한 번 저장 값 (점 100 · 1,000 · 3,000 · 6,000 · 9,000)
 *     ② 폰 저장소(localStorage) 한도 — 몇 MB 에서 막히는가
 *     ③ 6노트로 한 시간 — 첫 시간 · 넷째 시간 CPU
 *     ④ 화면 끈 동안 쌓인 점 몰아 받기 값
 *   결과 줄: [baetnil-perf] <이름> <JSON>
 */
(function(){
  'use strict';
  var TAG = '[baetnil-perf] ';
  var FS = null;
  try{ FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem; }catch(_){}
  var fq = Promise.resolve();
  function fileLog(line){
    if(!FS) return;
    fq = fq.then(function(){
      return FS.appendFile({ path:'perf.txt', directory:'DOCUMENTS', data: line + '\n', encoding:'utf8' })
        .catch(function(){ return FS.writeFile({ path:'perf.txt', directory:'DOCUMENTS', data: line + '\n', encoding:'utf8' }); });
    }).catch(function(){});
  }
  function log(name, obj){
    var line = TAG + name + ' ' + JSON.stringify(obj);
    try{ console.log(line); }catch(_){}
    fileLog(line);
  }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  var plat = 'web';
  try{ plat = window.Capacitor.getPlatform(); }catch(_){}
  var n = 0;
  try{ n = (Number(localStorage.getItem('perf_boot')) || 0) + 1; localStorage.setItem('perf_boot', String(n)); }catch(_){}

  function navTimes(){
    var o = {};
    try{
      var e = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]) || null;
      if(e){
        o.화면파일_받기 = Math.round(e.responseEnd - e.requestStart);
        o.화면파일_해석 = Math.round(e.domInteractive - e.responseEnd);
        o.DOM완성 = Math.round(e.domContentLoadedEventEnd - e.startTime);
        o.load = Math.round(e.loadEventEnd - e.startTime);
      }else if(performance.timing){
        var t = performance.timing;
        o.화면파일_받기 = t.responseEnd - t.requestStart;
        o.화면파일_해석 = t.domInteractive - t.responseEnd;
        o.DOM완성 = t.domContentLoadedEventEnd - t.navigationStart;
        o.load = t.loadEventEnd - t.navigationStart;
        o.옛방식 = true;
      }
      var fcp = performance.getEntriesByName && performance.getEntriesByName('first-contentful-paint')[0];
      if(fcp) o.첫그리기 = Math.round(fcp.startTime);
    }catch(e){ o.오류 = String(e && e.message); }
    return o;
  }

  function 저장값(){
    var out = {};
    function pt(i){ return { la:34.74+i*0.00009, lo:127.74+i*0.00009, t:new Date(Date.now()+i*9000).toISOString(), ac:8, sp:3.1 }; }
    [100, 1000, 3000, 6000, 9000].forEach(function(k){
      var now = { vid:'perf', from:new Date().toISOString(), pts: Array.from({length:k}, function(_, i){ return pt(i); }), id:null, saved:0 };
      var a = performance.now(), ok = true;
      for(var r = 0; r < 5; r++){ try{ localStorage.setItem('__perf', JSON.stringify(now)); }catch(e){ ok = false; out[k+'점_오류'] = String(e && e.name); break; } }
      out[k+'점'] = ok ? +((performance.now() - a) / 5).toFixed(1) : null;
    });
    try{ localStorage.removeItem('__perf'); }catch(_){}
    return out;
  }

  function 저장한도(){
    // 256KB(글자 수) 덩어리를 막힐 때까지 넣어 본다. 끝나면 다 지운다.
    var chunk = new Array(256 * 1024 + 1).join('a');
    var used = 0, i = 0, why = '';
    try{ for(var k = 0; k < localStorage.length; k++){ var kk = localStorage.key(k); used += kk.length + (localStorage.getItem(kk) || '').length; } }catch(_){}
    for(i = 0; i < 400; i++){
      try{ localStorage.setItem('__fill' + i, chunk); }
      catch(e){ why = String(e && e.name); break; }
    }
    for(var j = 0; j < i; j++){ try{ localStorage.removeItem('__fill' + j); }catch(_){} }
    return { 이미쓰던_글자: used, 더넣은_글자: i * chunk.length, 합_MB_글자기준: +((used + i * chunk.length) / 1048576).toFixed(2), 막힌까닭: why || '안 막힘(100MB 까지)' };
  }

  function 한시간(){
    var out = {};
    if(typeof trkPush !== 'function'){ out.오류 = 'trkPush 없음'; return out; }
    var 담기 = Math.round(3600 * 3.09 / 10);   // 6노트 · 10m 마다
    out.담는점 = 담기;
    [0, 3000].forEach(function(시작){
      var base = Date.now() - 3600000;
      trkNow = { vid:'perf', from:new Date(base - 600000).toISOString(),
        pts: Array.from({length:시작}, function(_, i){ return { la:34.74+i*0.00009, lo:127.74+i*0.00007, t:new Date(base+i*3200).toISOString(), ac:8, sp:3.1 }; }),
        id:null, saved:시작 };
      var la = 34.74 + 시작*0.00009, lo = 127.74 + 시작*0.00007, t = base + 시작*3200;
      var 참 = 0, a = performance.now();
      for(var i = 0; i < 담기; i++){
        la += 0.00009; lo += 0.00001 * Math.sin(i / 7); t += 3200;   // 조금씩 휘는 길 (곧은 줄이면 솎기가 너무 많이 된다)
        try{ if(trkPush({ latitude:la, longitude:lo, accuracy:8, speed:3.09, bearing:45, time:t })) 참++; }catch(e){ out.오류 = String(e && e.message); break; }
      }
      out[(시작 ? '넷째' : '첫') + '_시간_ms'] = Math.round(performance.now() - a);
      out[(시작 ? '넷째' : '첫') + '_시간_담긴점'] = 참;
    });
    try{ trkNow = null; if(typeof trkKeep === 'function') trkKeep(); }catch(_){}
    return out;
  }

  function 몰아받기(){
    var out = {};
    function hav(a,b,c,d){ var R=6371,r=function(x){return x*Math.PI/180;},dLa=r(c-a),dLo=r(d-b);var q=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLo/2)*Math.sin(dLo/2);return 2*R*Math.asin(Math.sqrt(q)); }
    [1000, 3000, 4000].forEach(function(N){
      var t0 = Date.now() - N * 3200;
      var pts = Array.from({length:N}, function(_, i){ return { la:34.74+i*0.00009, lo:127.74, t:new Date(t0+i*3200).toISOString(), ac:8, sp:3.1 }; });
      var cand = Array.from({length:60}, function(_, i){ return { la:34.74+(N+i)*0.00009, lo:127.74, t:new Date(t0+(N+i)*3200).toISOString(), ac:8, sp:3.1 }; });
      var a = performance.now();
      var all = pts.concat(cand).sort(function(x, y){ return (Date.parse(x.t)||0) - (Date.parse(y.t)||0); });
      var o = [], prev = -1;
      for(var i = 0; i < all.length; i++){ var p = all[i], tt = Date.parse(p.t)||0; if(tt === prev) continue; var L = o[o.length-1]; if(L && hav(L.la,L.lo,p.la,p.lo)*1000 < 6) continue; o.push(p); prev = tt; }
      try{ localStorage.setItem('__perf', JSON.stringify({ pts:o })); }catch(_){}
      out[N+'점'] = +(performance.now() - a).toFixed(1);
    });
    try{ localStorage.removeItem('__perf'); }catch(_){}
    return out;
  }

  async function run(){
    var t0 = Date.now();
    // 파이어베이스까지 붙는 데 걸린 시간 (앱이 남기는 자국으로 본다)
    var fb = -1;
    for(var i = 0; i < 240; i++){
      var b = String(window.__boot || '');
      if(/붙었습니다|못 불러옴/.test(b)){ fb = Date.now() - t0; break; }
      await sleep(250);
    }
    var m = {};
    try{ if(performance.memory) m.메모리_MB = Math.round(performance.memory.usedJSHeapSize / 1e6); }catch(_){}
    log('BOOT', Object.assign({ 몇번째: n, 기기: plat, 앱: (typeof APP_VER !== 'undefined' ? APP_VER : '?'),
      load뒤_파이어베이스까지_ms: fb, 부팅자국: String(window.__boot || '').slice(-40) }, navTimes(), m));
    if(n === 2){
      await sleep(3000);
      try{ log('저장값_ms', 저장값()); }catch(e){ log('저장값_오류', String(e && e.message)); }
      try{ log('저장한도', 저장한도()); }catch(e){ log('저장한도_오류', String(e && e.message)); }
      try{ log('한시간', 한시간()); }catch(e){ log('한시간_오류', String(e && e.message)); }
      try{ log('몰아받기_ms', 몰아받기()); }catch(e){ log('몰아받기_오류', String(e && e.message)); }
    }
    log('DONE', { 몇번째: n });
    // 깃허브 기계가 알아보기 쉬운 영문 표시 (로그가 한글을 깨뜨려도 알아본다)
    try{ console.log(TAG + 'DONE-ASCII n=' + n); }catch(_){}
    fileLog(TAG + 'DONE-ASCII n=' + n);
  }
  if(document.readyState === 'complete') run();
  else window.addEventListener('load', function(){ run(); });
})();
