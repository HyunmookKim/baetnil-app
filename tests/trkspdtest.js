// ★★★ 5.10 — 항적 위치를 정해진 속도 한도로 자르지 않는다 (사장님 지적, 2026-09-22)
//   「그럼 100키로 이상으로 주행하는 차들은 어떻게 네비를 찍냐?」
//   다른 기록·내비게이션 앱처럼 ① GPS 위치만 받고 ② 정확도로 거르고
//   ③ 속도는 GPS 칩이 잰 속도와 위치 이동이 맞지 않을 때만 본다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };
const grab = name => { const i = src.indexOf('function ' + name + '('); if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i); for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) break; } }
  return src.slice(i, j + 1); };
const PRE = require('./trkspd_pre.js')(src);

T('★★★ 정해진 속도 한도(TRK_MAXKT·trkMaxKt)가 없다', !/const TRK_MAXKT\s*=/.test(src) && !/trkMaxKt\(/.test(src));
T('★★ trkTooFast 가 GPS 칩 속도(trkSpd)로 판단한다', /trkSpd\(a\)/.test(grab('trkTooFast')));
T('★★ 기록할 때 칩 속도를 위치에 남긴다 (p.sp)', /p\.sp = Math\.round\(spd \* 10\) \/ 10/.test(grab('trkPush')));
T('★★ 자바 쪽에서 가져온 위치도 칩 속도를 남긴다', /p\.sp = Math\.round\(qs \* 10\) \/ 10/.test(src));
T('★★ 기지국·와이파이 위치(pv network)는 버린다', /q\.pv === 'network'/.test(src));
T('★★ 흔들림 고르기가 칩 속도를 쓴다 (빠를수록 덜 뒤처짐)', /trkSmooth\(la, lo, ac, tms, spd\)/.test(src));
T('★ trkQuality 도 같은 판단(trkTooFast)을 쓴다', /trkTooFast\(a\[i-1\], a\[i\]\)/.test(grab('trkQuality')));

// 안드로이드 기록 서비스가 GPS 만 받는가
const JAVA = [path.join(__dirname, '../../bh/android/app/src/main/java/kr/baetnil/app/BaetnilTrackService.java'),
              '/home/claude/bh/android/app/src/main/java/kr/baetnil/app/BaetnilTrackService.java'].find(f => fs.existsSync(f));
if(JAVA){
  const j = fs.readFileSync(JAVA, 'utf8');
  T('★★★ 안드로이드 기록 서비스가 기지국·와이파이 위치를 안 받는다', !/requestLocationUpdates\(LocationManager\.NETWORK_PROVIDER/.test(j));
  T('★★ 안드로이드 기록 서비스가 GPS 위치를 받는다', /requestLocationUpdates\(LocationManager\.GPS_PROVIDER/.test(j));
}

const hav = 'function hav(a,b,c,d){const R=6371,t=x=>x*Math.PI/180;const dLat=t(c-a),dLon=t(d-b);' +
  'const q=Math.sin(dLat/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}';
const F = new Function('A','B', `${hav}\n${PRE}\n${grab('trkTooFast')}\nreturn trkTooFast(A,B);`);
const T0 = Date.parse('2026-09-22T00:00:00Z');
const P = (la, s, ac, sp) => { const o = { la, lo: 127.7, t: new Date(T0 + s * 1000).toISOString() };
  if(ac != null) o.ac = ac; if(sp != null) o.sp = sp; return o; };
// 위도 0.0027° ≈ 300m
T('★★★ 시속 108km(58노트)로 달린 위치를 버리지 않는다', F(P(34.7000, 0, 5, 30), P(34.7027, 10, 5, 30)) === false);
T('★★★ 시속 300km 로 움직인 위치도 칩 속도와 맞으면 받는다', F(P(34.7027, 10, 5, 83), P(34.7102, 20, 5, 83)) === false);
T('★★★ 칩은 6노트라는데 10초에 2km 를 뛴 위치는 이상하다고 본다', F(P(34.7000, 0, 5, 3), P(34.7180, 10, 8, 3)) === true);
T('★★ 정확도로 이미 거른 위치(칩 속도 없음)는 속도로 자르지 않는다', F(P(34.7000, 0, 5), P(34.7090, 10, 5)) === false);
T('★★ 5분 넘게 끊겼다 이어진 것은 속도로 판단하지 않는다', F(P(34.7000, 0, 5, 3), P(34.8000, 400, 5, 3)) === false);
T('★★ 몇 분 벌어진 두 위치(화면 끈 동안)는 칩 속도로 판단하지 않는다 — 그 사이 속도가 바뀌었을 수 있다', F(P(34.7000, 0, 5, 1), P(34.7170, 240, 5, 1)) === false);
T('★ 음수 속도(iOS 가 모를 때 -1)는 속도가 없는 것으로 본다', F(P(34.7000, 0, 5, -1), P(34.7090, 10, 5, -1)) === false);
T('★ 칩 속도가 한쪽만 있어도 판단한다 (출발 직후)', F(P(34.7000, 0, 5), P(34.7005, 10, 5, 5)) === false);
T('★ 옛 기록(정확도·칩 속도 모두 없음)에서 수백 노트로 튄 위치는 걸러진다', F(P(34.7000, 0), P(34.7500, 30)) === true);
T('★ 옛 기록이라도 보통 속도는 받는다', F(P(34.7000, 0), P(34.7010, 60)) === false);

// 사장님 실제 항적(9/02 이후)이 한 개도 버려지지 않는가 — 정확도 기록이 있는 항해
const BK = ['/root/.claude/uploads/b2d0b648-0154-505a-aa4d-c7a93c03288c/4642ba8f-baetnil-backup-20260920.json']
  .find(f => fs.existsSync(f));
if(BK){
  const d = JSON.parse(fs.readFileSync(BK, 'utf8'));
  let n = 0, cut = 0;
  for(const v of d.voyage || []){
    const a = v.trk; if(!Array.isArray(a) || a.length < 2 || !a.every(p => p.ac != null)) continue;
    for(let i = 1; i < a.length; i++){ n++; if(F(a[i-1], a[i])) cut++; }
  }
  T('★★★ 사장님 실제 항적(정확도 기록 있는 것)에서 이상하다고 보는 위치가 없다', n > 100 && cut === 0, { n, cut });
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
