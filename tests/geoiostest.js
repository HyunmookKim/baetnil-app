// 6.0 — 아이폰에서 위치를 웹뷰가 아니라 앱 부품(BaetnilTrack.once)으로 읽는가
//   웹뷰로 읽으면 「"localhost" would like to use your current location」 창이 한 번 더 뜬다
//   (2026-09-22 아이폰 시뮬레이터 검사 2회째 화면 사진). 그리고 날씨 지점을 빨리 바꾸면
//   앞 지점 날씨가 뒤 지점 이름으로 붙던 것 · 보는 날씨 지점이 일본이면 일본 물때를 받는 것도 본다.
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

(async () => {
  const gg = grab(src, 'geoGet'), gi = grab(src, 'geoIosPlugin');
  T('geoGet · geoIosPlugin 이 있다', !!gg && !!gi);
  function make(platform, native, onceImpl){
    const log = { web:0, once:[], lg:[] };
    const win = { Capacitor: native ? {
      isNativePlatform: () => true, getPlatform: () => platform,
      Plugins: { BaetnilTrack: onceImpl ? { once: (o) => { log.once.push(o); return onceImpl(o); } } : {} } } : undefined };
    const nav = { geolocation: { getCurrentPosition: (ok) => { log.web++; ok({ coords:{ latitude:1, longitude:2 }, timestamp:5 }); } } };
    const f = new Function('window','navigator','locMay','lgAdd', gi + '\n' + gg + '\n return geoGet;')(win, nav, async () => true, (k, w) => log.lg.push(k + ':' + w));
    return { f, log };
  }
  // ① 아이폰 앱 — 부품으로 읽는다, 웹뷰는 안 부른다
  {
    const { f, log } = make('ios', true, async () => ({ lat:34.74, lon:127.74, acc:12, spd:1.5, t:1000, sim:true }));
    const got = await new Promise(r => f('날씨', p => r(p), e => r({ err:e }), { enableHighAccuracy:true, timeout:9000, maximumAge:300000 }));
    T('★★★ 아이폰: 웹뷰 위치(navigator.geolocation)를 안 부른다', log.web === 0);
    T('아이폰: 부품 once 를 한 번 부른다', log.once.length === 1);
    T('아이폰: 정확도·시간·maxAge 를 넘긴다', log.once[0] && log.once[0].high === true && log.once[0].timeout === 9000 && log.once[0].maxAge === 300000);
    T('아이폰: 받은 것을 웹과 같은 모양으로 넘긴다', got.coords && got.coords.latitude === 34.74 && got.coords.longitude === 127.74 && got.coords.accuracy === 12 && got.coords.speed === 1.5 && got.timestamp === 1000);
    T('아이폰: 받았을 때 확인자료를 남긴다', log.lg.length === 1 && log.lg[0] === '수집:날씨');
  }
  // ② 아이폰 — 거절하면 code 1, 확인자료를 안 남긴다
  {
    const { f, log } = make('ios', true, async () => { const e = new Error('denied'); e.code = '1'; throw e; });
    const got = await new Promise(r => f('날씨', p => r(p), e => r({ err:e }), {}));
    T('아이폰: 거절은 code 1 로 돌아온다', got.err && got.err.code === 1);
    T('아이폰: 거절하면 확인자료를 안 남긴다', log.lg.length === 0 && log.web === 0);
  }
  // ③ 안드로이드 · 웹 — 예전 그대로 웹뷰로 읽는다
  {
    const { f, log } = make('android', true, async () => ({ lat:0, lon:0 }));
    await new Promise(r => f('날씨', r, r, {}));
    T('안드로이드: 예전처럼 웹뷰로 읽는다(창이 한 번 더 안 뜨는 판)', log.web === 1 && log.once.length === 0);
    const w = make('web', false, null);
    await new Promise(r => w.f('날씨', r, r, {}));
    T('웹: 웹뷰로 읽는다', w.log.web === 1);
  }
  // ④ 옛 아이폰 빌드(부품에 once 가 없다) — 웹뷰로 내려간다
  {
    const { f, log } = make('ios', true, null);
    await new Promise(r => f('날씨', r, r, {}));
    T('once 가 없는 아이폰 빌드: 웹뷰로 내려간다(멈추지 않는다)', log.web === 1);
  }
  // ⑤ 날씨 — 받는 사이 지점을 바꾸면 앞 지점 날씨를 뒤 지점 이름으로 붙이지 않는다
  {
    const rw = grab(src, 'renderWeather');
    T('★★★ renderWeather: 부르기 전에 열쇠를 잡아 둔다', /const wxKey0 = wxCur\.lat\+','\+wxCur\.lon;/.test(rw));
    T('★★★ renderWeather: 받은 뒤 지점이 바뀌었으면 버리고 다시 그린다', /!== wxKey0\) return renderWeather\(\);\s*\n\s*wxData = \{ key: wxKey0/.test(rw));
    T('renderWeather: 받은 뒤 wxCur 로 열쇠를 다시 만들지 않는다', !/wxData = \{ key: wxCur\.lat\+','\+wxCur\.lon/.test(rw));
    const ew = grab(src, 'ensureWx');
    T('ensureWx: 잡아 둔 자리로 받는다', /wxFetch\(wxLat0, wxLon0\)/.test(ew) && !/wxFetch\(wxCur\.lat, wxCur\.lon\)/.test(ew));
    T('ensureWx: 지점이 바뀌었으면 wxData 를 안 바꾼다', (ew.match(/wxSame\(\)/g) || []).length >= 3);
    // 실제로 돌려 본다 — 여수를 받는 동안 도쿄로 바꾼다
    let wxCur = { lat:34.74, lon:127.74 }, wxData = null, calls = [], L = { innerHTML:'' };
    let release;
    const env = {
      document: { getElementById: () => L },
      wxFetch: (la, lo) => { calls.push(la + ',' + lo); if(calls.length === 1) return new Promise(r => { release = () => r({ w:'여수날씨' }); }); return Promise.resolve({ w:'도쿄날씨' }); },
    };
    // renderWeather 앞쪽(자료 받기)만 떼어 돌린다
    const body = rw.slice(rw.indexOf('if(!wxData || wxData.key !== wxCur.lat'), rw.indexOf('    }\n  }', rw.indexOf('if(!wxData || wxData.key !== wxCur.lat')) + 10);
    const fn = new Function('S', 'env', `
      let { document, wxFetch } = env;
      const t = x => x, esc = x => x, head = '';
      return async function renderWeather(){
        let wxCur = S.cur(), wxData = S.data();
        const L = document.getElementById('weatherList');
        ${body.replace(/wxData = \{/g, 'wxData = S.set({')
              .replace(/\.\.\.d \};/g, '...d });')
              .replace(/(\(wxCur\.lat\+','\+wxCur\.lon\) !== wxKey0)/g, '(S.cur().lat+\',\'+S.cur().lon) !== wxKey0')}
        return 'done';
      };`);
    const S = { cur: () => wxCur, data: () => wxData, set: v => (wxData = v) };
    const rwf = fn(S, env);
    const p1 = rwf();                              // 여수를 받기 시작
    await new Promise(r => setTimeout(r, 5));
    wxCur = { lat:35.62, lon:139.77 };             // 사람이 도쿄로 넘긴다
    release();                                     // 이제 여수 날씨가 도착한다
    await p1;
    T('★★★ 여수 날씨가 도쿄 이름으로 붙지 않는다', !(wxData && wxData.key === '35.62,139.77' && wxData.w === '여수날씨'));
    T('도쿄로 다시 받아 도쿄 날씨가 도쿄 이름으로 붙는다', wxData && wxData.key === '35.62,139.77' && wxData.w === '도쿄날씨');
  }
  // ⑥ 보는 날씨 지점이 일본이면 일본 물때를 받는다
  {
    const rw = grab(src, 'renderWeather');
    T('renderWeather: 날씨 지점 자리로 나라 물때 꾸러미를 받는다', /spotPacksFor\(wxCur\.lat, wxCur\.lon\)/.test(rw) && /await tidePackGet\(pk\)/.test(rw));
    const jp = (src.match(/\{ k:'jp', cc:'jp'[^\n]*/) || [''])[0];
    T('일본 꾸러미에 물때 파일이 있다', /tide:'tide-jp\.json'/.test(jp));
  }
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  process.exit(fail ? 1 : 0);
})();
