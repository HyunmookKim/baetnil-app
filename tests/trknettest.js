// 기지국·와이파이로 지어낸 자리를 걸러내는가 (4.78) + 떨림을 고르는가 (4.79)
//
// ★ 사장님 항적이 여수 시내와 산으로 뻗쳤다. accuracy 하나만 보고 있었기 때문이다.
//   위성 자리는 speed·bearing 을 함께 준다. 기지국 자리는 둘 다 null 이다.
//
// ★ 4.79 — 「무엇을 왜 버렸는지」 를 화면에 적던 것을 뺐다.
//   사람이 알고 싶은 것은 「내 길이 제대로 찍히나」 하나다. 그것만 보여 준다.
//   그래서 이 검사도 「화면에 안 나온다」 를 못으로 박는다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

T('★★★ 지어낸 자리(simulated)를 버린다', /pos\.simulated === true/.test(src));
// ★ 5.37 — 「speed·bearing 둘 다 없으면 위성 아님」 은 다른 앱 근거 없이 정한 것이라 없앴다. OsmAnd 는 정확도(50m)로만 본다.
T('★★★ speed·bearing 으로 가르지 않는다 (OsmAnd)', !/\(pos\.speed != null\) \|\| \(pos\.bearing != null\)/.test(grab(src, 'trkPush')));
{
  const m = src.match(/const TRK_GPS_ACC = (\d+)/);
  const v = m ? Number(m[1]) : 0;
  // ★ 이 값이 크면 문이 열린 것과 같다. 위성 자리는 보통 5~20m 다.
  T('★★★ 위성 또렷함 기준이 실제로 좁다 (지금 ' + v + 'm)', v > 0 && v <= 50, v);
}
// ★★★ 사람에게 진단을 들이밀지 않는다 (4.79 — 사장님 지적)
T('★★★ 화면에 「기지국 n · 거짓 n」 을 안 적는다', !/기지국 \{n\}/.test(src) && !/거짓 \{n\}/.test(src));
T('★★★ 「폰을 하늘이 보이는 곳에 두라」 고 안 시킨다', !/하늘이 보이는 곳에/.test(src));
T('★★★ 흐리다고 사람을 부르는 창(trkBlurWarn)이 없다', !/trkBlurWarn/.test(src));
{
  const f = grab(src, 'trkCountText');
  T('★★★ 기록 중 한 줄은 점 수만 보여 준다',
    /\{n\}개 지점/.test(f) && !/버림/.test(f)  // 5.30 — 문구 바뀜 ({n}점 → {n}개 지점)
      && !/정확도/.test(f), f.slice(0, 200));
}
// ★★★★ 5.37 — 흔들림 고르기(칼만)·입항 때 걷어내기는 OsmAnd 에 없다. OsmAnd 는 받은 좌표를 그대로 남기고 줄이지 않는다.
T('★★★ 담을 때 흔들림을 고르지 않는다 (받은 좌표 그대로 — OsmAnd)', !/trkSmooth\(la, lo, ac, tms, spd\)/.test(grab(src, 'trkPush')) && /la:\+la\.toFixed\(5\)/.test(grab(src, 'trkPush')));
T('★★★ 입항할 때 점을 지우지 않는다 (OsmAnd)', !/trkSimplify\(trkClean\(cur\.pts/.test(src) && /const pts = \(cur\.pts \|\| \[\]\)\.filter/.test(src));
T('★★★ 기록 중 저장(trkFlush)도 줄이지 않는다', !/trkSimplify\(trkNow\.pts \|\| \[\], TRK_TOL\)/.test(src));

// 실제로 돌려 본다
{
  const env = `
    const TRK_ACC=60, TRK_GPS_ACC=30, TRK_DIST=50, TRK_LOST=5, TRK_MAX=9999, TRK_TOL=1, TRK_FLUSH=9999, TRK_MAXKT=20, TRK_STILL_MS=0.3;
    let trkNow = { vid:'v', from:new Date(Date.now()-600000).toISOString(), pts:[], id:null };   // 켠 지 10분 — 첫 점 문(5.12)은 이미 지났다
    const hav=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,dLa=r(c-a),dLo=r(d-b);
      const q=Math.sin(dLa/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
    ${require('./trkspd_pre.js')(src)}${grab(src,'trkTooFast')}
    const trkSkip=()=>{ trkNow.drop=(trkNow.drop||0)+1; trkNow.skip=(trkNow.skip||0)+1; };
    const trkKeep=()=>{}, trkFlush=()=>{}, trkLive=()=>{}, trkSimplify=a=>a;
    ${(src.match(/const TRK_Q = [^;]+;/)||['const TRK_Q = 0;'])[0]} let trkKal = null;
    ${grab(src,'trkSmooth')}
    ${grab(src,'trkPush')}
    return { trkPush, get:()=>trkNow };`;
  const F = new Function(env)();
  const base = { latitude:34.7400, longitude:127.7400, accuracy:8, speed:2.1, bearing:180, time:Date.now() };
  T('★★ 위성 자리는 받는다', F.trkPush(base) === true);

  // 기지국 자리 — 흐리고 speed·bearing 이 없다
  T('★★★ 기지국 자리는 버린다 (흐리고 speed·bearing 없음)',
    F.trkPush({ latitude:34.7600, longitude:127.6900, accuracy:600, time:Date.now()+60000 }) === false);
  T('★★★ 버린 까닭을 센다 (흐림)', (F.get().blur || 0) === 1, F.get());
  T('★★ 정확도 50m 는 남긴다 · 51m 는 안 남긴다 (OsmAnd)',
    F.trkPush({ latitude:34.7405, longitude:127.7405, accuracy:51, time:Date.now()+70000 }) === false
    && F.trkPush({ latitude:34.7406, longitude:127.7406, accuracy:50, time:Date.now()+80000 }) === true);
  T('★★ 5초 안에 온 위치는 안 남긴다 (OsmAnd)',
    F.trkPush({ latitude:34.7407, longitude:127.7407, accuracy:5, time:Date.now()+84000 }) === false);

  // ★ 5.37 — OsmAnd: 정확도를 안 주는 위치는 남기지 않는다 (!location.hasAccuracy())
  T('★★ 정확도를 안 주는 위치는 안 남긴다 (OsmAnd)',
    F.trkPush({ latitude:34.7440, longitude:127.7440, speed:3.0, time:Date.now()+600000 }) === false);
  // accuracy 도 speed 도 bearing 도 없다 — 못 믿는다
  T('★★★ 아무 신호도 없으면 안 받는다',
    F.trkPush({ latitude:34.7480, longitude:127.7480, time:Date.now()+1200000 }) === false);
  // 멈춰 있는 배 — speed·bearing 이 없어도 또렷하면 받는다
  T('★★★ 멈춰 있어도 또렷하면 받는다 (정박 중에 항적이 끊기면 안 된다)',
    F.trkPush({ latitude:34.7480, longitude:127.7480, accuracy:9, time:Date.now()+1800000 }) === true);
  // 거짓 위치
  T('★★★ 지어낸 자리는 또렷해도 버린다',
    F.trkPush({ latitude:34.7520, longitude:127.7520, accuracy:5, speed:2, simulated:true, time:Date.now()+2400000 }) === false);
  T('★★ 거짓 자리도 센다', (F.get().mock || 0) === 1);
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
