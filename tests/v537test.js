// 5.37 — 사장님 (2026-10-04): 「다시 똑바로 만들어라 … 무조건 다른 어플 따라서 만들으라고 … 티끌만한거라도 정하지 마라」
//   10/4 항해: 기록 장치 81개 → 앱이 21개 → 입항 때 5개로 줄임 → 「3곳에서 끊겼습니다」 · 출발 표시가 129m 짜리 위치에
//   항적 규칙을 OsmAnd 원본 코드(SavingTrackHelper · OsmandSettings) 그대로 바꿨는지 본다.
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const src = fs.readFileSync(FILE, 'utf8');
const swift = fs.readFileSync(path.join(__dirname, '..', 'ios', 'App', 'App', 'BaetnilTrack.swift'), 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const grab = name => { const i = src.indexOf('function ' + name + '('); if(i < 0) return '';
  let d = 0, st = src.indexOf('{', i);
  for(let j = st; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(i, j + 1); } }
  return ''; };
const num = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*([0-9.]+)')); return m ? +m[1] : null; };

// ① OsmAnd 기본값 그대로
T('5초 간격 (SAVE_TRACK_INTERVAL 5000)', num('TRK_OSM_MS') === 5000);
T('정확도 50m (SAVE_TRACK_PRECISION 50)', num('TRK_OSM_ACC') === 50);
T('끊김 6분 · 10배 (collectDBTracks)', num('TRK_OSM_SEG_MS') === 360000 && num('TRK_OSM_SEG_X') === 10);
// ② 그 밖의 거르기·줄이기는 기록 경로에 없다
const 기록 = grab('trkPush') + (src.slice(src.indexOf('async function trkBufDrain('), src.indexOf('function trkBufMark(')));
['trkAccJump(', 'trkFirstWait(', 'trkTooFast(', 'trkSmooth(', 'TRK_DIST', 'TRK_STILL_MS'].forEach(k =>
  T('기록 경로에 「' + k + '」 가 없다 (OsmAnd 에 없는 거르기)', !기록.includes(k)));
T('입항 때 줄이지 않는다', !/trkSimplify\(trkClean\(cur\.pts/.test(src) && !/trkSimplify\(trkNow\.pts \|\| \[\], TRK_TOL\)/.test(src));
// ★ 위치를 받는 방식(아이폰 distanceFilter·안드로이드 2초)은 5.36 그대로 둔다 — 사장님 (10/4): 「5초에 한번씩 … 베터리만 빨리 달거같은데 … 다른데는 정확한 위치 어떻게 받는지 확인해라」 → 받는 방식은 조사 보고 뒤 사장님이 정한다
T('위치 받는 방식은 5.36 그대로 (아이폰 5m)', /m\.distanceFilter = 5\b/.test(swift));
T('버린 까닭별 개수를 항해에 남긴다 (blur·often·net)', /\['blur', 'often', 'net'\]\.forEach/.test(grab('trkStop')) && /it\.trkRule = 'osmand'/.test(grab('trkStop')));

// ③ trkOsmWhy 를 실제로 돌린다
const W = new Function(`const TRK_OSM_MS=5000, TRK_OSM_ACC=50; ${grab('trkOsmWhy')} return trkOsmWhy;`)();
const at = s => new Date(Date.parse('2026-10-04T07:48:30Z') + s * 1000).toISOString();
T('첫 점 · 정확도 4m → 남긴다', W({ t: at(0), ac: 4 }, null) === '');
T('정확도 129m (10/4 출발 위치) → 안 남긴다', W({ t: at(0), ac: 129 }, null) === 'blur');
T('정확도 모름 → 안 남긴다', W({ t: at(0) }, null) === 'blur');
T('5초 → 안 남긴다 · 6초 → 남긴다', W({ t: at(5), ac: 4 }, { t: at(0) }) === 'often' && W({ t: at(6), ac: 4 }, { t: at(0) }) === '');

// ④ 10/4 처럼 천천히 95분 세일 — 2초마다 받은 위치가 얼마나 남고, 끊김이 몇 곳인가
{
  const G = new Function(`const TRK_OSM_SEG_MS=360000, TRK_OSM_SEG_X=10; ${grab('trkGap')} return trkGap;`)();
  const pts = []; let last = null;
  for(let s = 0; s <= 95 * 60; s += 2){
    const p = { la: 34.726 + s * 0.0000008, lo: 127.670 - s * 0.0000006, t: at(s), ac: 4 + (s % 7) };
    if(W(p, last) === ''){ pts.push(p); last = p; }
  }
  let gaps = 0; for(let i = 1; i < pts.length; i++) if(G(pts[i-1], pts[i], pts[i-2])) gaps++;
  T('95분 · 2초마다 → 5초를 넘긴 6초마다 남아 약 950개 (OsmAnd: 앞 점에서 5초 「넘게」)', pts.length >= 940 && pts.length <= 960, pts.length);
  T('그 항적에 「끊김」 이 없다', gaps === 0, gaps);
}

// ⑤ 출발·도착 표시는 항적의 첫 점·끝 점 (OsmAnd 처럼)
{
  const tp = grab('trkPoints');
  T('출발 표시 — 항적이 있으면 첫 점', /push\(줄\.length > 1 \? 끝점\(줄\[0\]\) : it\.posOut, t\('출발'\)/.test(tp));
  T('도착 표시 — 항적이 있으면 끝 점 (기록 중이 아닐 때)', /\(줄\.length > 1 && !기록중\) \? 끝점\(줄\[줄\.length - 1\]\) : it\.posIn/.test(tp));
}
// ⑥ 판 번호
T('판 5.37', /const APP_VER = '5\.37';/.test(src));

console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
process.exit(bad ? 1 : 0);
