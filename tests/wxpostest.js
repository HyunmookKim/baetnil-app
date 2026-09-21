// 항해일지 날씨는 '그 자리' 날씨여야 한다.
//
// ★ 왜 이 검사가 있나
//   좌표를 찍는 기능을 만들어 놓고, 날씨는 '날씨 탭에서 고른 한 지점' 에서만 받았다.
//   4시간 동안 4해리를 내려간 항해인데 출발·중간·중간·도착 네 칸의 파고가
//   전부 0.4m 로 똑같이 찍혔다. 좌표가 바로 옆 줄에 있는데도 쓰지를 않았다.
//   게다가 화면에는 그 지점 이름만 적혀 있어서 '배가 개도에 있었다' 로 읽혔다.
//
//   여기서 지켜야 할 것이 넷이다.
//    ① 그 칸에 찍힌 좌표가 있으면 그 좌표로 받는다. 없을 때만 고른 지점.
//    ② 물때도 마찬가지다 — 그 좌표에서 가장 가까운 관측소.
//    ③ 화면에 어디 예보인지 밝힌다 (「이 위치 예보」 / 「개도 예보」).
//    ④ 자동 기록은 위치를 먼저 잡고 그다음에 날씨를 받는다.
//       위치는 비동기다. 날씨를 먼저 부르면 좌표는 언제나 아직 없다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let pass = 0, fail = 0;
const T = (n, c, extra) => {
  if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); }
};

const need = ['wxCapture','posOf','posPut','wxLine','posHere'];
const missing = need.filter(f => !grab(f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}

// ── 받침대
globalThis.t = x => x;
globalThis.tsub = (k, v) => String(k).replace(/\{(\w+)\}/g, (_, n) => v[n]);
globalThis.esc = x => String(x == null ? '' : x);
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.saveMR = () => {};
globalThis.renderVoyage = () => {};
globalThis.openMR = () => {};
globalThis.mrOpenType = ''; globalThis.mrOpenId = '';
globalThis.unlocked = true;
globalThis.tsOf = () => 1755400000000;
globalThis.fmtWhen = () => '2026-08-17 13:36';
globalThis.dirName = () => '남남서';
globalThis.wxHourIndex = () => 3;
globalThis.wxCur = { id:'s1', name:'개도', lat:34.6250, lo:0, lon:127.5900 };

// 받아 오는 흉내 — 자리마다 다른 값을 준다. 그래야 어느 자리를 썼는지 보인다.
let asked = [];
const fakeHourly = v => ({
  time: [], temperature_2m:[0,0,0,27], wind_speed_10m:[0,0,0,v],
  wind_direction_10m:[0,0,0,200], wind_gusts_10m:[0,0,0,v+4]
});
globalThis.wxAtPoint = async (lat, lon) => {
  asked.push([+Number(lat).toFixed(4), +Number(lon).toFixed(4)]);
  const v = Math.round(Math.abs(lat) * 100) % 40;      // 자리마다 다른 풍속
  return { w:{ hourly: fakeHourly(v) }, m:{ hourly:{ time:[], wave_height:[0,0,0, lat > 34.72 ? 1.9 : 0.4] } } };
};
let tidePlaceCalls = [], tideSourceCalls = 0;
globalThis.tideAtPlace = (lat, lon) => { tidePlaceCalls.push([lat, lon]); return { v: 1.23, spot:{ name:'여수' } }; };
globalThis.tideSource = () => { tideSourceCalls++; return { pts:[1,2], spot:{ name:'고정관측소' } }; };
globalThis.tideAt = () => 0.55;

// 4.03 — 저장된 숫자로 글을 다시 짓는다. wxLine 이 이것을 부른다.
globalThis.dirName = d => ['북','북북동','북동','동북동','동','동남동','남동','남남동',
  '남','남남서','남서','서남서','서','서북서','북서','북북서'][Math.round(((d%360)/22.5))%16];
for(const f of ['posOf','posPut','wxText','wxLine']) eval('globalThis.' + f + ' = ' + grab(f));
eval('globalThis.wxCapture = ' + grab('wxCapture'));

const IT = () => ({
  id:'v1', date:'2026-08-17', timeOut:'13:36', timeIn:'18:04',
  posOut:{ lat:34.73893, lon:127.67897, acc:38 },
  posIn:null,
  logs:[{ id:'g1', time:'14:22', pos:{ lat:34.70033, lon:127.66658, acc:4 }, wx:null }],
  wxOut:null, wxIn:null
});

(async () => {
  // ── ① 찍힌 좌표가 있으면 그 좌표로 받는다
  let it = IT(); globalThis.voyage = [it]; asked = [];
  await wxCapture('wxOut', 'v1');
  T('출발 — 고른 지점이 아니라 찍힌 좌표로 받는다',
    asked.length === 1 && asked[0][0] === 34.7389 && asked[0][1] === 127.679, asked);
  T('출발 — 저장한 값에 그 좌표가 남는다',
    it.wxOut.lat === 34.73893 && it.wxOut.lon === 127.67897, [it.wxOut.lat, it.wxOut.lon]);
  T('출발 — 좌표에서 받았다는 표시(pos)가 있다', it.wxOut.pos === 1, it.wxOut.pos);
  T('출발 — 지점 이름은 비운다 (배가 개도에 있었던 게 아니다)', it.wxOut.spot === '', it.wxOut.spot);

  // ── 중간기록도 같다. 그리고 출발과 다른 값이 나와야 한다.
  asked = [];
  await wxCapture('log:g1', 'v1');
  T('중간기록 — 그 칸에 찍힌 좌표로 받는다',
    asked.length === 1 && asked[0][0] === 34.7003, asked);
  const g = it.logs[0];
  T('중간기록 날씨가 출발 날씨와 다르다 (한 지점을 돌려쓰지 않는다)',
    g.wx.text !== it.wxOut.text, [it.wxOut.text, g.wx.text]);
  T('중간기록 — 파고도 자리를 따라간다', g.wx.wave === 0.4 && it.wxOut.wave === 1.9,
    [it.wxOut.wave, g.wx.wave]);

  // ── ② 좌표가 없으면 고른 지점으로 떨어진다
  asked = [];
  await wxCapture('wxIn', 'v1');
  T('도착 — 좌표가 없으면 고른 지점으로 받는다',
    asked.length === 1 && asked[0][0] === 34.625, asked);
  T('도착 — 이때는 지점 이름을 남긴다', it.wxIn.spot === '개도', it.wxIn.spot);
  T('도착 — 좌표 표시(pos)는 0 이다', !it.wxIn.pos, it.wxIn.pos);

  // ── ③ 물때도 그 자리 기준
  T('좌표가 있으면 물때를 그 좌표에서 찾는다', tidePlaceCalls.length >= 1, tidePlaceCalls);
  T('물때도 출발·중간이 각각 제 자리로 간다',
    tidePlaceCalls.length === 2 && tidePlaceCalls[0][0] !== tidePlaceCalls[1][0], tidePlaceCalls);
  T('좌표가 없을 때만 고정 관측소를 쓴다', tideSourceCalls === 1, tideSourceCalls);

  // ── ④ 화면 — 어디 예보인지 밝힌다
  T('좌표에서 받은 것은 「이 위치 예보」로 그린다', /이 위치 예보/.test(wxLine(it.wxOut, '')), wxLine(it.wxOut,''));
  T('지점에서 받은 것은 「개도 예보」로 그린다', /개도 예보/.test(wxLine(it.wxIn, '')), wxLine(it.wxIn,''));
  T('이름만 덜렁 적지 않는다 (위치로 읽힌 원인)',
    !/· 개도<\/span>/.test(wxLine(it.wxIn, '')), wxLine(it.wxIn,''));
  // 옛 기록에는 pos 가 없다 — 그래도 지점 이름은 나와야 한다
  T('옛 기록(pos 없음)도 지점 이름이 나온다',
    /개도 예보/.test(wxLine({ text:'남 10kt', at:'', spot:'개도' }, '')));
  T('둘 다 없으면 아무것도 안 붙인다',
    !/예보/.test(wxLine({ text:'남 10kt', at:'', spot:'' }, '')));

  // ── ⑤ 순서 — 위치를 먼저 잡고 그다음에 날씨
  const ph = grab('posHere');
  T('posHere 가 끝난 뒤 알려 줄 자리(done)를 받는다', /function posHere\(key, vid, quiet, done\)/.test(ph));
  T('위치를 잡으면 알려 준다', /fin\(\);/.test(ph));
  T('위치를 못 잡아도 알려 준다 (날씨까지 막히면 안 된다)',
    (ph.match(/fin\(\);/g) || []).length >= 3, (ph.match(/fin\(\);/g) || []).length);

  // 자동 기록 네 곳 — posHere 안에서 wxCapture 를 부르고, 밖에서 먼저 부르지 않는다
  for(const [fn, key] of [['planStart','wxOut'],['addVoyage','wxOut'],['logAdd','log:'],['arriveNow','wxIn']]){
    const body = grab(fn) || '';
    const iPos = body.indexOf('posHere(');
    const iWx  = body.indexOf('wxCapture(');
    T(fn + ' — 위치를 먼저 잡고 그 뒤에 날씨를 받는다',
      iPos >= 0 && iWx > iPos, { iPos, iWx });
    T(fn + ' — 날씨를 posHere 의 뒤처리로 부른다',
      /posHere\([^)]*,\s*\(\)\s*=>\s*wxCapture\(/.test(body.replace(/\n/g,' ')), body.slice(iPos, iPos+120));
  }

  // ── ⑥ 담아 두기 — 자리가 다르면 따로, 같으면 한 번만
  T('자리별 담는 통이 있다', /const WX_PT = \{\}/.test(src));
  T('담는 통에 한도가 있다 (끝없이 쌓이면 안 된다)', /WX_PT_MAX/.test(src));
  T('담는 열쇠가 좌표다', /const wxPtKey = \(lat, lon\)/.test(src));
  const ap = grab('wxAtPoint') || '';
  T('같은 자리는 다시 안 받는다', /if\(WX_PT\[k\]\) return WX_PT\[k\]/.test(ap));
  T('화면용 통(wxData)을 덮어쓰지 않는다', !/\bwxData\s*=/.test(ap), ap.match(/wxData[^;]*/g));

  // ── 사보타주 확인 — 예전 코드로 되돌리면 잡히는가
  const oldWay = "let d = (wxData && wxData.key === wxCur.lat+','+wxCur.lon) ? wxData : null;";
  T('옛 방식(고른 지점 고정)이 코드에 남아 있지 않다', src.indexOf(oldWay) < 0);
  T('wxCapture 안에서 wxCur 로 직접 받지 않는다',
    !/wxFetch\(wxCur\.lat/.test(grab('wxCapture') || ''));

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})();
