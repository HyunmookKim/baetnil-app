// 항적에 섞여 들어오는 엉뚱한 점 — 걸러지는가
//
// ★ 왜 이 검사가 있나 (4.51)
//   사장님이 여수 앞바다에서 기록한 항적이 시내와 산으로 몇 km 씩 뻗쳤다.
//   GPS 가 흔들린 것이 아니다. 흔들림은 몇 m 다.
//   폰은 하늘이 안 보이면 기지국·와이파이로 자리를 「지어낸다」. 그 점은
//   accuracy 가 1000m 를 넘고, 시내 한복판에 찍힌다.
//   앱이 그것을 그대로 받아 그린 것이다 — 폰 잘못이 아니라 우리 잘못이다.
const fs = require('fs');
const SRC = process.argv[2] || 'work.html';
const src = fs.readFileSync(SRC, 'utf8');

function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) i = src.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(!d){ j++; break; } }
  }
  return src.slice(i, j);
}
function num(name){
  const m = src.match(new RegExp('const ' + name + '\\s*=\\s*(-?[\\d.]+)'));
  return m ? Number(m[1]) : null;
}

let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };

// ── 한도가 있는가
const ACC = num('TRK_ACC'), MAXKT = 0, LOST = num('TRK_LOST');
T('★ 흐린 점을 버리는 한도가 있다 (TRK_ACC)', ACC !== null && ACC > 0 && ACC <= 200, ACC);
// ★ 5.10 — 정해진 최고 속도로 자르지 않는다 (사장님: 「100키로 넘게 달리는 차는 어떻게 찍냐」)
T('★★★ 정해진 속도 한도(TRK_MAXKT)가 없다', !/const TRK_MAXKT\s*=/.test(src) && !/trkMaxKt\(/.test(src));
T('★★ GPS 칩 속도로 판단하는 값이 있다 (TRK_SPD_X)', num('TRK_SPD_X') > 1, num('TRK_SPD_X'));
T('연달아 버리면 기준을 다시 잡는 한도가 있다 (TRK_LOST)', LOST !== null && LOST >= 2, LOST);

// ── 받침대
const HAV = grab('hav');
T('거리 셈(hav)이 있다', !!HAV);

// ── ① trkPush — 흐린 점을 안 받는다
const PUSH = grab('trkPush');
T('trkPush 가 있다', !!PUSH);
if(PUSH && HAV && ACC){
  const base = { la: 34.7200, lo: 127.7300 };
  const T0 = Date.parse('2026-08-27T08:00:00Z');
  const F = new Function('IN', `
    ${HAV}
    const TRK_DIST=50, TRK_TOL=25, TRK_MAX=4000, TRK_FLUSH=1e9;
    const TRK_ACC=${ACC}, TRK_MAXKT=${MAXKT}, TRK_LOST=${LOST};
    const TRK_BLUR_WARN=${num('TRK_BLUR_WARN')};
    const TRK_GPS_ACC=${num('TRK_GPS_ACC')}, TRK_Q=${num('TRK_Q')}; let trkKal=null;
    ${grab('trkSmooth') || ''}
    let 말 = [];
    const tsub = (m,o)=>String(m).replace(/\\{(\\w+)\\}/g,(a,k)=>(o&&o[k]!=null)?o[k]:a);
    const tell = m => { 말.push(String(m)); return Promise.resolve(); };
    let trkNow = { vid:'v1', from:new Date(Date.now()-600000).toISOString(), pts: [], saved: 0 };   // 켠 지 10분 — 첫 점 문(5.12)은 이미 지났다
    function trkKeep(){} function trkFlush(){} function trkLive(){}
    ${grab('trkSimplify') || ''}
    ${require('./trkspd_pre.js')(src)}${grab('trkTooFast') || ''}
    ${grab('trkBlurWarn') || ''}
    ${grab('trkSkip') || ''}
    ${PUSH}
    const took = IN.map(p => trkPush(p));
    return { took, pts: trkNow.pts, skip: trkNow.skip || 0,
             got: trkNow.got || 0, drop: trkNow.drop || 0, ac: trkNow.ac, 말: 말 };
  `);

  // 또렷한 점 세 개 — 3노트로 남쪽으로
  const good = [0,1,2].map(i => ({
    latitude: base.la - i*0.0015, longitude: base.lo, accuracy: 8,
    time: T0 + i*120000 }));
  let r = F(good);
  T('★ 또렷한 점은 그대로 받는다', r.pts.length === 3, r.pts.length);

  // 가운데에 흐린 점(기지국) 하나 — 시내 쪽으로 4km
  const withBlur = [good[0],
    { latitude: 34.7480, longitude: 127.6800, accuracy: 2200, time: T0 + 60000 },
    good[1], good[2]];
  r = F(withBlur);
  T('★★ 흐린 점(accuracy 2200m)은 버린다', r.pts.length === 3
     && !r.pts.some(p => Math.abs(p.lo - 127.68) < 0.01), r.pts.map(p=>p.lo));

  // accuracy 를 안 주는 기기 — 받아야 한다 (안 받으면 그 기기는 항적이 통째로 빈다)
  const noAcc = good.map(p => ({ latitude:p.latitude, longitude:p.longitude, time:p.time }));
  r = F(noAcc);
  T('★ accuracy 를 안 주는 기기의 점은 받는다', r.pts.length === 3, r.pts.length);

  // 또렷한데 말이 안 되는 속도 — accuracy 는 좋지만 1분에 4km (130노트)
  const jump = [good[0],
    { latitude: 34.7550, longitude: 127.7300, accuracy: 10, time: T0 + 60000 },
    good[1], good[2]];
  r = F(jump);
  T('★★ 또렷해도 배가 낼 수 없는 속도로 뛴 점은 버린다', r.pts.length === 3
     && !r.pts.some(p => p.la > 34.75), r.pts.map(p=>p.la));

  // ★ 4.52 — 점마다 정확도를 남긴다. 이게 없으면 다음에도 또 추측만 하게 된다.
  r = F(good);
  T('★★ 점마다 정확도(ac)를 남긴다', r.pts.every(p => p.ac === 8), r.pts);
  T('★ 받은 수와 버린 수를 센다', r.got === 3 && r.drop === 0, { got:r.got, drop:r.drop });
  r = F(withBlur);
  T('★ 흐린 점도 받은 수에는 들어간다', r.got === 4 && r.drop === 1, { got:r.got, drop:r.drop });
  T('★ 지금 정확도를 들고 있다 (화면에 보여 주려면 있어야 한다)', r.ac === 8 || r.ac === 2200, r.ac);
  // 흐린 점만 계속 오면 사람에게 말한다
  const 계속흐림 = [0,1,2,3,4,5,6,7,8,9,10,11].map(i => ({
    latitude: 34.7480 + i*0.001, longitude: 127.6800, accuracy: 1500, time: T0 + i*30000 }));
  r = F(계속흐림);
  T('★★ 흐린 점만 계속 오면 그 자리에서 알려 준다', r.말.length >= 1, r.말.slice(0,1));
  T('★ 같은 말을 되풀이하지 않는다 (배 위에서 방해가 된다)', r.말.length === 1, r.말.length);
  T('★ 그때 점은 하나도 안 담긴다', r.pts.length === 0, r.pts.length);

  // 오래 끊겼다 이어진 경우 — 두 시간 뒤 10해리면 5노트다. 버리면 안 된다.
  const gap = [good[0],
    { latitude: 34.5533, longitude: 127.7300, accuracy: 10, time: T0 + 2*3600*1000 }];
  r = F(gap);
  T('★★ 오래 끊겼다 이어진 것은 안 버린다 (2시간에 10해리 = 5노트)',
    r.pts.length === 2, r.pts.length);

  // 기준점이 망가졌을 때 영영 못 받으면 안 된다
  // 튄 점이 매번 다른 자리로 온다 — 한 번도 못 받으면 안 되고, 다 받아도 안 된다
  const stuck = [good[0]].concat([1,2,3,4,5,6,7,8].map(i => ({
    latitude: 34.9000 + i*0.01, longitude: 127.9000 + i*0.01,
    accuracy: 10, time: T0 + i*30000 })));
  r = F(stuck);
  T('★ 연달아 버리다가도 결국 기준을 다시 잡는다 (영영 막히지 않는다)',
    r.pts.length >= 2, r.pts.length);
  T('★★ 그렇다고 튄 점을 줄줄이 받지도 않는다', r.pts.length <= 3, r.pts.length);
}

// ── ①-2 폰에게는 촘촘히 달라고 한다
const ASK = num('TRK_ASK');
T('★ 폰에 요청하는 주기가 따로 있다 (TRK_ASK)', ASK !== null && ASK > 0, ASK);
T('★★ 폰에게는 우리 저장 간격보다 촘촘히 달라고 한다',
  ASK !== null && num('TRK_DIST') !== null && ASK < num('TRK_DIST'), { ASK, DIST: num('TRK_DIST') });
T('★★ addWatcher 가 그 값을 쓴다 (폰이 걸러 주게 두지 않는다)',
  /distanceFilter:\s*TRK_ASK/.test(src), (src.match(/distanceFilter:[^\n]*/) || [''])[0]);
T('★ 확인자료의 수집주기도 실제로 받는 주기로 적는다',
  /every:[^\n]*TRK_ASK/.test(src), (src.match(/every:[^\n]*/) || [''])[0]);

// ── ② trkClean — 이미 저장된 항적을 다듬는다
const CLEAN = grab('trkClean');
T('★ 이미 저장된 항적을 다듬는 곳이 있다 (trkClean)', !!CLEAN);
if(CLEAN && HAV){
  const C = new Function('PTS', `
    ${HAV}
    const TRK_MAXKT=${MAXKT}, TRK_LOST=${LOST};
    ${require('./trkspd_pre.js')(src)}${grab('trkTooFast') || ''}
    ${grab('trkClean1') || ''}
    ${CLEAN}
    return trkClean(PTS);
  `);
  const T0 = Date.parse('2026-08-27T08:00:00Z');
  const line = [0,1,2,3,4].map(i => ({ la: 34.72 - i*0.0015, lo: 127.73,
                                       t: new Date(T0 + i*120000).toISOString() }));
  let out = C(line);
  T('멀쩡한 항적은 한 점도 안 버린다', out.pts.length === 5, out);

  const dirty = [line[0], line[1],
    { la: 34.7480, lo: 127.6800, t: new Date(T0 + 150000).toISOString() },   // 시내로 튐
    line[2], line[3],
    { la: 34.7600, lo: 127.6500, t: new Date(T0 + 390000).toISOString() },   // 또 튐
    line[4]];
  out = C(dirty);
  T('★★ 튄 점만 골라 버린다', out.pts.length === 5 && out.dropped === 2, out);
  T('★ 몇 개를 버렸는지 말해 준다', out.dropped === 2, out.dropped);
  T('★ 처음 점은 남는다', out.pts[0] && out.pts[0].la === line[0].la, out.pts[0]);
  T('★ 끝 점은 남는다', out.pts[out.pts.length-1]
     && out.pts[out.pts.length-1].la === line[4].la, out.pts[out.pts.length-1]);
  T('원본을 건드리지 않는다', dirty.length === 7, dirty.length);

  // ★★ 한 번만 돌리면 부족하다 — 기준점이 튄 점이면 그 옆의 멀쩡한 점이 살아남는다
  //   사장님 8/28 항적에서 실제로 겪었다: 한 번 64점(최대 88kn) → 되풀이 49점(최대 19.8kn)
  const T1 = Date.parse('2026-08-27T09:00:00Z');
  const at = (i, la, lo) => ({ la, lo, t: new Date(T1 + i*30000).toISOString() });
  const 연속튐 = [ at(0, 34.7200, 127.7300),
                   at(1, 34.7600, 127.6900),   // 튐
                   at(2, 34.7650, 127.6850),   // 또 튐 (앞의 튄 점 기준으로는 느리다)
                   at(3, 34.7205, 127.7300),   // 진짜
                   at(4, 34.7210, 127.7300) ]; // 진짜
  const oo = C(연속튐);
  T('★★ 연달아 튄 점도 되풀이해서 걸러낸다', oo.pts.length === 3
    && oo.pts.every(p => p.lo > 127.72), oo.pts.map(p=>[p.la,p.lo]));

  const QQ = grab('trkQuality');
  T('★ 항적을 믿어도 되는지 재는 곳이 있다 (trkQuality)', !!QQ);
  if(QQ){
    const Q = new Function('PTS', `
      ${HAV}
      const TRK_MAXKT=${MAXKT}, TRK_LOST=${LOST};
      ${require('./trkspd_pre.js')(src)}${grab('trkTooFast') || ''}
      ${QQ}
      return trkQuality(PTS);
    `);
    const good = [0,1,2,3].map(i => ({ la: 34.72 - i*0.0015, lo: 127.73,
                                       t: new Date(T1 + i*120000).toISOString() }));
    T('★ 멀쩡한 항적은 믿을 만하다고 한다', Q(good).ok === true, Q(good));
    T('★★ 말 안 되는 항적은 못 믿는다고 한다', Q(연속튐).ok === false, Q(연속튐));
    T('★ 거리와 평균 속도를 알려 준다', Q(good).nm > 0 && Q(good).kt > 0, Q(good));
  }
}


// ── ★★★ 5.10 — 빠른 배·차량도 칩이 잰 속도대로면 그대로 받는다
{
  const HAV2 = grab('hav');
  const F5 = new Function('A','B', `${HAV2}\n${require('./trkspd_pre.js')(src)}\n${grab('trkTooFast')}\nreturn trkTooFast(A,B);`);
  const T0 = Date.parse('2026-09-22T00:00:00Z');
  // 시속 108km = 30m/s. 10초에 300m. 칩도 30m/s 라고 한다.
  const a = { la: 34.7000, lo: 127.7000, t: new Date(T0).toISOString(), ac: 5, sp: 30 };
  const b = { la: 34.7027, lo: 127.7000, t: new Date(T0 + 10000).toISOString(), ac: 5, sp: 30 };
  T('★★★ 시속 108km(58노트)로 달린 위치도 버리지 않는다 (칩 속도와 맞음)', F5(a, b) === false);
  // 시속 300km = 83m/s — 칩도 83m/s
  const c = { la: 34.7075, lo: 127.7000, t: new Date(T0 + 20000).toISOString(), ac: 5, sp: 83 };
  T('★★★ 시속 300km 로 움직인 위치도 칩 속도와 맞으면 받는다', F5(b, c) === false);
  // 칩은 3m/s(6노트)라는데 10초에 2km 를 뛰었다 → 이상한 위치
  const d = { la: 34.7000, lo: 127.7000, t: new Date(T0).toISOString(), ac: 5, sp: 3 };
  const e = { la: 34.7180, lo: 127.7000, t: new Date(T0 + 10000).toISOString(), ac: 8, sp: 3 };
  T('★★★ 칩 속도와 맞지 않게 크게 뛴 위치만 이상하다고 본다', F5(d, e) === true);
  // 정확도가 있고 칩 속도가 없는 위치 — 속도로 자르지 않는다
  const f = { la: 34.7000, lo: 127.7000, t: new Date(T0).toISOString(), ac: 5 };
  const g = { la: 34.7090, lo: 127.7000, t: new Date(T0 + 10000).toISOString(), ac: 5 };
  T('★★ 정확도로 이미 거른 위치는 속도로 다시 자르지 않는다', F5(f, g) === false);
  // 5분 넘게 끊겼다 이어진 것은 판단하지 않는다
  const h = { la: 34.8000, lo: 127.7000, t: new Date(T0 + 400000).toISOString(), ac: 5, sp: 3 };
  T('★★ 오래 끊겼다 이어진 것은 속도로 판단하지 않는다', F5(d, h) === false);
  // iOS 는 모르면 speed -1 을 준다 — 그것은 속도가 없는 것으로 본다
  const i1 = { la: 34.7000, lo: 127.7000, t: new Date(T0).toISOString(), ac: 5, sp: -1 };
  const i2 = { la: 34.7090, lo: 127.7000, t: new Date(T0 + 10000).toISOString(), ac: 5, sp: -1 };
  T('★ 음수 속도(iOS 가 모를 때)는 속도가 없는 것으로 본다', F5(i1, i2) === false);
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
