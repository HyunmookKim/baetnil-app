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
T('★★★ speed·bearing 이 둘 다 없으면 위성 자리로 안 본다',
  /\(pos\.speed != null\) \|\| \(pos\.bearing != null\)/.test(src));
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
    /\{n\}점/.test(f) && !/버림/.test(f) && !/정확도/.test(f), f.slice(0, 200));
}
// ★★★ 떨림 고르개 (4.79) — 다른 기록 앱들이 쓰는 칼만 고르개를 그대로 쓴다
T('★★★ 떨림 고르개가 있다', /function trkSmooth\(/.test(src));
T('★★★ 담기 전에 실제로 고른다', /trkSmooth\(la, lo, ac, tms, spd\)/.test(src));
T('★★★ 고른 자리를 담는다 (받은 그대로가 아니다)', /la:\+sm\.la\.toFixed\(5\)/.test(src));
T('★★ 항해를 새로 켜면 고르개도 새로 시작한다', /trkSmoothReset\(\);\n  trkNow = \{ vid/.test(src));
T('★★ 입항하면 튄 점을 알아서 걷어낸다 (사람이 누르지 않아도)',
  /trkSimplify\(trkClean\(cur\.pts \|\| \[\]\)\.pts, TRK_TOL\)/.test(src));

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
  T('★★★ 버린 까닭을 센다', (F.get().net || 0) === 1, F.get());

  // accuracy 를 아예 안 주는 기기 — speed 가 있으면 위성 자리다
  T('★★ 정확도를 안 주는 기기라도 speed 가 있으면 받는다',
    F.trkPush({ latitude:34.7440, longitude:127.7440, speed:3.0, time:Date.now()+600000 }) === true);
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
// ── 고르개가 실제로 떨림을 줄이는가 (셈으로 확인한다)
{
  const env2 = `
    ${(src.match(/const TRK_Q = [^;]+;/)||['const TRK_Q = 0;'])[0]} let trkKal = null;
    ${grab(src,'trkSmooth')}
    ${grab(src,'trkSmoothReset')}
    return { trkSmooth, trkSmoothReset, kal:()=>trkKal };`;
  const S = new Function(env2)();
  // 배는 곧게 간다. GPS 만 좌우로 흔들린다 — 고른 뒤에는 흔들림이 줄어야 한다.
  const t0 = 1000000;
  let 날 = 0, 곤 = 0;
  const 참 = [];
  for(let i = 0; i < 40; i++) 참.push(34.7400 + i * 0.0001);
  const 흔 = 참.map((v,i) => v + ((i % 2) ? 0.00008 : -0.00008));   // 지그재그
  S.trkSmoothReset();
  const 고 = 흔.map((v,i) => S.trkSmooth(v, 127.74, 8, t0 + i * 4000).la);
  for(let i = 0; i < 참.length; i++){
    날 += Math.abs(흔[i] - 참[i]);
    곤 += Math.abs(고[i] - 참[i]);
  }
  T('★★★ 고르개가 떨림을 실제로 줄인다 (날것 ' + 날.toFixed(5) + ' → 고른 것 ' + 곤.toFixed(5) + ')',
    곤 < 날 * 0.95, { 날, 곤 });
  // ★ 너무 고르면 선이 배보다 뒤처진다 — 바다에서는 그게 더 위험하다.
  // ★ 실제로 재 보면 떨림은 8.9m → 4.9m 로 반이 되고, 뒤처짐은 0.2m 다.
  //   한도를 2m 로 못 박는다 — 이보다 뒤처지면 Q 를 잘못 만진 것이다.
  {
    const 뒤m = Math.abs(고[고.length-1] - 참[참.length-1]) * 111320;
    T('★★★ 그러면서 배보다 심하게 뒤처지지 않는다 (지금 ' + 뒤m.toFixed(1) + 'm)',
      뒤m < 2, 뒤m);
  }
  // ★ 오래 끊겼다 이어지면 앞 점에 끌려가면 안 된다
  S.trkSmoothReset();
  S.trkSmooth(34.7400, 127.7400, 8, t0);
  const 뒤 = S.trkSmooth(34.9000, 127.9000, 8, t0 + 600000);   // 10분 뒤
  T('★★★ 오래 끊겼다 이어지면 새 자리를 그대로 받는다 (앞 점에 안 끌린다)',
    Math.abs(뒤.la - 34.9000) < 1e-9, 뒤);
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
