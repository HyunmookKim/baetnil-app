// ══════════════════════════════════════════════════════════════════════
// 5.2 — 조화상수 물때를 **관(官) 물때표와 실제로 맞대 본다**
//
//   ★ 왜 이 검사가 있나
//     물때는 틀려도 화면에 티가 안 난다. 숫자가 나오니까 맞는 줄 안다.
//     그래서 앱 안에 든 그 셈을 그대로 돌려, 미국 NOAA·일본 기상청이
//     낸 공식 물때표와 분 단위로 맞대 본다. 몇 분 넘게 어긋나면 실패다.
//
//   ★ 여기 박아 둔 관 물때표 (2026-10-01 ~ 10-04)
//     NOAA — 샌프란시스코·보스턴·시애틀·버지니아키 (UTC, MLLW 기준)
//     기상청 — 다카마쓰·히로시마 (일본 시각, 기준면 위 m)
//     인터넷 없이 돌아가도록 값을 그대로 적어 둔다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SRC = process.argv[2] || '../../work.html';
const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const T = (name, ok) => { if(ok){ pass++; console.log('통과: ' + name); } else { fail++; console.log('★ 실패: ' + name); } };

// ── 앱에서 조화상수 대목만 떼어 낸다
const MARK = '// ★★★ 5.2 — 물때를 **조화상수로 직접 셈한다**';
const i = src.indexOf(MARK);
T('앱 안에 조화상수 대목이 있다', i > 0);
if(i < 0){ console.log('\n통과 ' + pass + ' · 실패 ' + fail); process.exit(1); }
const endMark = 'function hcTidePts(lat, lon){';
let j = src.indexOf(endMark, i);
// 함수 끝까지 괄호를 센다
let d = 0, end = -1;
for(let k = src.indexOf('{', j); k < src.length; k++){
  if(src[k] === '{') d++;
  else if(src[k] === '}'){ d--; if(!d){ end = k + 1; break; } }
}
const block = src.slice(i, end);
const hav = (() => { const a = src.indexOf('function hav('); let dd=0; for(let k=src.indexOf('{',a);k<src.length;k++){ if(src[k]==='{')dd++; else if(src[k]==='}'){dd--; if(!dd) return src.slice(a,k+1);} } })();

let api = null, err = '';
try{
  api = new Function('atob', hav + '\n' + block + '\n return { hcUnpack, hcAll, hcNearest, hcTidePts, HC_NEAR_KM, HC_SAFE_KM, NEAPS: globalThis.NEAPS };')
        (s => Buffer.from(s, 'base64').toString('binary'));
}catch(e){ err = e.message; }
T('조화상수 대목이 그대로 돌아간다' + (err ? ' — ' + err : ''), !!api);
if(!api){ console.log('\n통과 ' + pass + ' · 실패 ' + fail); process.exit(1); }

const rows = api.hcAll();
T('관측소를 풀었다 — ' + (rows ? rows.length : 0) + '곳', !!rows && rows.length > 1000);
T('관측소마다 위도·경도·기준면·분조가 다 있다',
  rows.every(r => isFinite(r.lat) && isFinite(r.lon) && r.cons.length >= 4 && r.name));
T('기준면(기본수준면 위 높이로 바꿀 값)을 아는 곳이 거의 전부다',
  rows.filter(r => r.off != null).length > rows.length * 0.99);
T('위도·경도가 상식 안에 있다',
  rows.every(r => r.lat >= -90 && r.lat <= 90 && r.lon >= -180 && r.lon <= 180));
T('진폭이 음수인 분조가 없다', rows.every(r => r.cons.every(c => c.amplitude >= 0)));
T('위상이 0~360 안에 있다', rows.every(r => r.cons.every(c => c.phase >= 0 && c.phase < 360)));
T('★ 조석 계산기(NEAPS)가 붙어 있다', !!(api.NEAPS && api.NEAPS.createTidePredictor));

// ── 관 물때표 (박아 둔 것)
const 관 = {
  '샌프란시스코': { lat:37.807, lon:-122.465, tz:0, rows:'10-01T04:00L-0.08,10-01T11:24H1.346,10-01T15:36L0.948,10-01T21:58H1.896,10-02T05:04L-0.057,10-02T12:47H1.316,10-02T16:41L1.049,10-02T22:58H1.833,10-03T06:17L-0.029,10-03T14:11H1.347,10-03T18:12L1.08,10-04T00:11H1.765,10-04T07:34L-0.022,10-04T15:16H1.421,10-04T19:48L1.001' },
  '보스턴':      { lat:42.354, lon:-71.050, tz:0, rows:'10-01T00:46L-0.149,10-01T06:56H2.952,10-01T12:58L0.167,10-01T19:08H3.338,10-02T01:39L-0.063,10-02T07:50H2.837,10-02T13:52L0.277,10-02T20:04H3.25,10-03T02:38L0.04,10-03T08:51H2.735,10-03T14:52L0.377,10-03T21:06H3.152,10-04T03:41L0.123,10-04T09:57H2.683,10-04T15:57L0.433,10-04T22:13H3.08' },
  '시애틀':      { lat:47.602, lon:-122.339, tz:0, rows:'10-01T02:18H3.355,10-01T09:28L-0.51,10-01T16:38H3.294,10-01T21:54L2.217,10-02T02:58H3.219,10-02T10:21L-0.447,10-02T17:53H3.222,10-02T23:04L2.42,10-03T03:48H3.03,10-03T11:21L-0.297,10-03T19:23H3.201,10-04T00:45L2.457,10-04T05:00H2.814,10-04T12:29L-0.121,10-04T20:45H3.262' },
  '버지니아키':  { lat:25.731, lon:-80.162, tz:0, rows:'10-01T04:29H0.805,10-01T10:46L0.112,10-01T17:23H0.822,10-01T23:20L0.248,10-02T05:26H0.784,10-02T11:49L0.137,10-02T18:21H0.798,10-03T00:23L0.266,10-03T06:28H0.767,10-03T12:55L0.158,10-03T19:23H0.78,10-04T01:28L0.27,10-04T07:36H0.759,10-04T14:02L0.172,10-04T20:27H0.776' },
  '다카마쓰':    { lat:34.351, lon:134.057, tz:9, rows:'10-01T00:32H2.25,10-01T14:09H2.49,10-01T07:12L0.35,10-01T20:21L1.31,10-02T01:11H2.12,10-02T15:18H2.44,10-02T08:00L0.35,10-02T21:33L1.44,10-03T01:59H1.95,10-03T16:44H2.41,10-03T08:58L0.43,10-03T23:12L1.49,10-04T03:10H1.76,10-04T18:15H2.42,10-04T10:14L0.55' },
  '히로시마':    { lat:34.350, lon:132.467, tz:9, rows:'10-01T12:35H3.54,10-01T06:04L0.32,10-01T18:32L1.41,10-02T00:12H3.18,10-02T13:27H3.3,10-02T06:44L0.49,10-02T19:19L1.74,10-03T00:48H2.91,10-03T14:38H3.07,10-03T07:33L0.74,10-03T20:30L2.01,10-04T01:40H2.62,10-04T16:28H2.98,10-04T08:47L1.01,10-04T22:54L2.04' },
};
function 관읽기(o){
  return o.rows.split(',').map(x => {
    const m = x.match(/^(\d\d)-(\d\d)T(\d\d):(\d\d)([HL])(-?[\d.]+)$/);
    return { t: Date.UTC(2026, +m[1]-1, +m[2], +m[3] - o.tz, +m[4]), hi: m[5]==='H', v: +m[6] };
  }).sort((a,b) => a.t - b.t);
}
const 중앙 = a => { a = a.slice().sort((x,y)=>x-y); return a[Math.floor(a.length/2)]; };

for(const [이름, o] of Object.entries(관)){
  const near = api.hcNearest(o.lat, o.lon);
  T(이름 + ' — 가까운 관측소를 찾았다: ' + (near ? near.row.name + ' ' + near.dist.toFixed(1) + 'km' : '없음'),
    !!near && near.dist < 8);
  if(!near) continue;
  const 표 = 관읽기(o);
  const 셈 = api.NEAPS.createTidePredictor(near.row.cons)
    .getExtremesPrediction({ start: new Date(표[0].t - 6*3600e3), end: new Date(표[표.length-1].t + 6*3600e3) })
    .map(e => ({ t: +e.time, hi: !!e.high, v: e.level + near.row.off }));
  const dt = [], dv = [];
  for(const a of 표){
    const cs = 셈.filter(e => e.hi === a.hi); if(!cs.length) continue;
    const b = cs.reduce((x,e) => Math.abs(e.t-a.t) < Math.abs(x.t-a.t) ? e : x);
    if(Math.abs(b.t - a.t) > 3*3600e3) continue;
    dt.push(Math.abs(b.t - a.t)/60000); dv.push(Math.abs(b.v - a.v));
  }
  const mt = 중앙(dt), mv = 중앙(dv);
  T(`★★★ ${이름} — 만조·간조 시각이 관 물때표와 10분 안 (중앙값 ${mt.toFixed(1)}분, ${dt.length}건)`,
    dt.length >= 10 && mt <= 10);
  T(`★★★ ${이름} — 높이가 관 물때표와 15cm 안 (중앙값 ${(mv*100).toFixed(1)}cm)`,
    dv.length >= 10 && mv <= 0.15);
}

// ── 거리 관문
{
  const 먼바다 = api.hcTidePts(0, -140);          // 태평양 한가운데 — 관측소가 없다
  T('★★★ 관측소가 없는 바다에서는 빈손으로 돌려준다 (지어내지 않는다)', 먼바다 === null);
  const 가까이 = api.hcTidePts(37.807, -122.465);
  T('관측소 가까이에서는 물때를 돌려준다', !!가까이 && 가까이.pts.length >= 4);
  T('★ 만조와 간조가 번갈아 나온다',
    !!가까이 && 가까이.pts.every((p,k) => k === 0 || p.hi !== 가까이.pts[k-1].hi));
  T('★ 시각이 오름차순이다', !!가까이 && 가까이.pts.every((p,k) => k === 0 || p.t > 가까이.pts[k-1].t));
  T('★ 다리·수심에 써도 되는지 표가 달려 있다', !!가까이 && typeof 가까이.safe === 'boolean');
  T('★ 가까운 관측소는 safe 가 참이다', !!가까이 && 가까이.safe === true);
  T('★ 관측소 이름과 거리를 함께 돌려준다', !!가까이 && !!가까이.spot.name && 가까이.spot.dist >= 0);
  T('★ 거리 한도가 두 가지다 (보여줄 거리 · 다리수심 거리)',
    api.HC_NEAR_KM > api.HC_SAFE_KM && api.HC_SAFE_KM > 0);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
