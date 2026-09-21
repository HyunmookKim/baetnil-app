// 기록 중인 항적이 화면에 보이는가
//
// ★ 왜 필요한가
//   저장은 [멈추기] 때 딱 한 번 일어났다. 그래서 기록하는 내내 지도가 비어 있었고,
//   화면 숫자는 새로고침을 눌러야만 늘었다. 사장님이 배 위에서 21점을 모아 놓고도
//   「점은 안 찍혀 있네. 이건 뭐지 도대체?」 라고 하셨다.
//   앱은 알고 있는데 사람에게 안 보여 준 것이다 — 4.25 항적 사고와 같은 종류다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// ── 진짜 함수를 떼어 온다. 스텁으로 두면 「버퍼를 그린다」가 검사되지 않는다.
const need = ['trkRaw','trkLine','trkHas','trkFlush','trkLive','trkPush','trkSimplify','trkPoints',
              'trkTooFast','trkSkip','trkClean','trkClean1','trkBackTrack',    // 4.51 — 튄 점 거르기
              'trkGap',                              // 4.116 — 기록이 끊긴 데는 선을 안 잇는다
              'trkSmooth','trkSmoothReset'];        // 4.79 — 떨림 고르개
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}

globalThis.voyage = [];
globalThis.trkNow = null;
globalThis.mapS = null;
globalThis.document = { getElementById: () => null };
let saveLocalN = 0, savePushN = 0;
globalThis.saveLocal    = () => { saveLocalN++; };
globalThis.save         = () => { savePushN++; };
globalThis.saveMR       = () => { savePushN++; };
globalThis.schedulePush = () => { savePushN++; };
globalThis.mapPaint     = () => {};
globalThis.trkKeep      = () => {};
globalThis.trkBlurWarn = () => {};
globalThis.hav = (a1,o1,a2,o2) => {           // km
  const R=6371, r=Math.PI/180;
  const d1=(a2-a1)*r, d2=(o2-o1)*r;
  const x=Math.sin(d1/2)**2 + Math.cos(a1*r)*Math.cos(a2*r)*Math.sin(d2/2)**2;
  return 2*R*Math.asin(Math.sqrt(x));
};
{ const m = src.match(/const TRK_DIST\s*=\s*[^;]+;/);  if(m) eval(m[0].replace('const TRK_DIST','globalThis.TRK_DIST')); }
{ const m = src.match(/const TRK_TOL\s*=\s*[^;]+;/);   if(m) eval(m[0].replace('const TRK_TOL','globalThis.TRK_TOL')); }
{ const m = src.match(/const TRK_MAX\s*=\s*[^;]+;/);   if(m) eval(m[0].replace('const TRK_MAX','globalThis.TRK_MAX')); }
{ const m = src.match(/const TRK_FLUSH\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_FLUSH','globalThis.TRK_FLUSH')); }
// 4.51 — 엉뚱한 점 거르는 한도
{ const m = src.match(/const TRK_ACC\s*=\s*[^;]+;/);   if(m) eval(m[0].replace('const TRK_ACC','globalThis.TRK_ACC')); }
{ const m = src.match(/const TRK_GPS_ACC\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_GPS_ACC','globalThis.TRK_GPS_ACC')); }
{ const m = src.match(/const TRK_Q\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_Q','globalThis.TRK_Q')); }
globalThis.trkKal = null;
{ const m = src.match(/const TRK_MAXKT\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_MAXKT','globalThis.TRK_MAXKT')); }
{ const m = src.match(/const TRK_LOST\s*=\s*[^;]+;/);  if(m) eval(m[0].replace('const TRK_LOST','globalThis.TRK_LOST')); }
// 4.79 — 되돌아간 점 거르기 (뒤늦게 하네스에 없어서 검사가 통째로 터졌다)
{ const m = src.match(/const TRK_BACK_M\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_BACK_M','globalThis.TRK_BACK_M')); }
{ const m = src.match(/const TRK_BACK_R\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_BACK_R','globalThis.TRK_BACK_R')); }
// 4.116 — 기록이 끊긴 데를 가리는 한도
{ const m = src.match(/const TRK_GAP_S\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_GAP_S','globalThis.TRK_GAP_S')); }
{ const m = src.match(/const TRK_GAP_M\s*=\s*[^;]+;/); if(m) eval(m[0].replace('const TRK_GAP_M','globalThis.TRK_GAP_M')); }
globalThis.trkOn = () => !!globalThis.trkNow;
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

T('TRK_FLUSH 이 정해져 있다', typeof TRK_FLUSH === 'number' && TRK_FLUSH > 0);

// ── 1. 기록 중이면 아직 저장 안 된 점을 그린다
const mkPts = n => { const a=[]; for(let i=0;i<n;i++) a.push({ la:34.74+i*0.001, lo:127.75+i*0.001, t:'2026-08-27T09:'+String(i).padStart(2,'0')+':00Z' }); return a; };

voyage = [{ id:'v1', trk:[] }];
trkNow = { vid:'v1', from:'2026-08-27T09:00:00Z', pts: mkPts(21), id:null, saved:0 };
T('기록 중이면 버퍼를 그린다', trkRaw(voyage[0]).length === 21);
T('기록 중이면 선이 그려진다', (trkLine(voyage[0])||[]).length === 21);
T('기록 중이면 지도에 보일 것이 있다', trkHas(voyage[0]) === true);

// 다른 항해를 보고 있으면 그 항해 것만 나온다
voyage.push({ id:'v2', trk:[] });
T('다른 항해에는 남의 버퍼가 안 샌다', trkRaw(voyage[1]).length === 0);

// ── 2. 기록 중이 아니면 저장된 것을 그린다
trkNow = null;
voyage[0].trk = mkPts(5);
T('멈춘 뒤에는 저장된 항적을 그린다', trkRaw(voyage[0]).length === 5);
T('멈춘 뒤에도 선이 그려진다', (trkLine(voyage[0])||[]).length === 5);

// 아무것도 없으면 없다고 한다
voyage[0].trk = [];
globalThis.trkPoints = () => [];
T('점이 없으면 지도에 보일 것이 없다', trkHas(voyage[0]) === false);
T('점이 없으면 선도 없다', trkLine(voyage[0]) === null);
voyage[0].trk = [{ la:34.7, lo:127.7, t:'' }];
T('점 하나로는 선을 그리지 않는다', trkLine(voyage[0]) === null);

// 출발·도착 표시만 있어도 지도는 보여 준다
voyage[0].trk = [];
globalThis.trkPoints = () => [{ lat:34.7, lon:127.7 }];
T('표시만 있어도 지도를 보여 준다', trkHas(voyage[0]) === true);

// ── 3. 중간 저장 — 기기에만 넣는다. 클라우드로는 안 올린다 (배터리)
voyage = [{ id:'v1', trk:[] }];
trkNow = { vid:'v1', from:'2026-08-27T09:00:00Z', pts: mkPts(30), id:null, saved:0 };
saveLocalN = 0; savePushN = 0;
const flushed = trkFlush();
T('중간 저장이 된다', flushed === true && voyage[0].trk.length >= 2);
T('중간 저장은 기기에 한다', saveLocalN === 1);
T('★ 중간 저장이 클라우드를 안 부른다', savePushN === 0);
T('어디까지 넣었는지 기억한다', trkNow.saved === 30);

// 점이 둘이 안 되면 넣지 않는다 (선도 안 그려지는데 자리만 차지한다)
voyage = [{ id:'v1', trk:[] }];
trkNow = { vid:'v1', pts: mkPts(1), id:null, saved:0 };
saveLocalN = 0;
T('점 하나로는 중간 저장을 안 한다', trkFlush() === false && saveLocalN === 0);

// 기록 중이 아니면 아무 일도 없다
trkNow = null;
T('기록 중이 아니면 중간 저장이 없다', trkFlush() === false);

// ── 4. 점이 들어오면 저절로 화면이 고쳐진다
voyage = [{ id:'v1', trk:[] }];
trkNow = { vid:'v1', from:'2026-08-27T09:00:00Z', pts:[], id:null, saved:0 };
let liveN = 0;
const realLive = globalThis.trkLive;
globalThis.trkLive = () => { liveN++; };
let la = 34.74, lo = 127.75;
// ★ 4.51 — 1초에 222m 는 432노트다. 앱이 옳게 걸러낸다.
//   검사 자료를 실제로 있을 법한 속도로 고친다 (60초에 222m = 7.2노트).
for(let i=0;i<25;i++){ la += 0.002; trkPush({ latitude:la, longitude:lo, accuracy:8, time:Date.now()+i*60000 }); }
T('점이 쌓인다', trkNow.pts.length === 25);
T('★ 점이 들어올 때마다 화면을 고친다', liveN === 25);
T('★ 쌓이는 동안 저절로 중간 저장이 된다', (voyage[0].trk||[]).length >= 2);
globalThis.trkLive = realLive;

// 너무 가까운 점은 버린다 (정박 중에 선이 자라면 안 된다)
const before = trkNow.pts.length;
trkPush({ latitude:la, longitude:lo, time:Date.now() });
T('제자리에서는 점이 안 는다', trkNow.pts.length === before);

// ── 5. trkLive 는 화면을 통째로 다시 그리지 않는다
const liveSrc = grab(src, 'trkLive') || '';
T('★ trkLive 가 화면을 통째로 다시 그리지 않는다',
   !/renderVoyage\s*\(|openMR\s*\(/.test(liveSrc));
T('trkLive 가 숫자를 제자리에서 고친다', /trkcnt/.test(liveSrc));
T('trkLive 가 지도 선을 고친다', /mapPaint\s*\(/.test(liveSrc));
T('trkLive 가 남의 지도를 안 건드린다', /S\.vid|\.vid/.test(liveSrc));

// ── 6. 저장된 것만 읽는 자리가 남아 있으면 안 된다
const lineSrc = grab(src, 'trkLine') || '';
const nearSrc = grab(src, 'trkNearOnLine') || '';
T('★ trkLine 이 it.trk 를 직접 안 읽는다',  !/it\s*&&\s*it\.trk|it\.trk/.test(lineSrc));
T('★ 선을 짚는 자리도 같은 문을 쓴다',      /trkRaw\s*\(/.test(nearSrc) && !/it\.trk/.test(nearSrc));
T('trkLine 이 trkRaw 를 쓴다',              /trkRaw\s*\(/.test(lineSrc));

// ── 7. 화면에 「점」이 두 뜻으로 쓰이면 안 된다
T('★ 지도 밑에 헷갈리는 점 개수가 없다', src.indexOf('점 {n}개 · 끌어서 이동') < 0);
T('지도 조작 안내는 그대로 있다',        src.indexOf('끌어서 이동 · 두 손가락으로 확대') > 0);

// ── 8. 기록 중 안내 문구 — 지어낸 부호와 명령형을 쓰지 않는다
const boxSrc = grab(src, 'trkBox') || '';
T('★ 기록 중 안내에 낫표가 없다', boxSrc.indexOf('「') < 0);
T('★ 기록 중 안내에 명령형이 없다', boxSrc.indexOf('마십시오') < 0 && boxSrc.indexOf('십시오') < 0);
T('알림을 지우면 멈춘다고 알려 준다', /알림을 지우면/.test(boxSrc));
T('숫자를 제자리에서 고칠 자리가 있다', /trkcnt/.test(boxSrc));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
