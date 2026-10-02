// 5.32 — 항적: 위성 점만 · 기기별 정확도 기준 · GPS 없는 기기 안내 (사장님, 2026-10-02)
//   「왜 기지국이 자꾸 찍히는거같지?」 · 「내 요트랑 핸드폰 기준으로만 대충 눈가리고 아웅식으로 고치지 말고」
//   · 「아이폰 안드로이드 둘다 고쳐라」
//
// ★ 사장님 항해 한 번으로 정한 숫자를 맞추는 검사가 아니다.
//   배 종류(카약 2노트 · 요트 6노트 · 표류 1노트 · 모터보트 30노트 · 수상오토바이 50노트)와
//   기기(안드로이드 gps 공급원 · 아이폰)마다 만든 항적에 건물 반사로 튄 점·흐린 구간·섞인 위치를 넣고,
//   ① 튄 점이 하나도 안 남는가 ② 진짜 길은 끊기지 않고 남는가 를 본다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const grab = (js, name) => { const i = js.indexOf('function ' + name + '('); if(i < 0) return '';
  let d = 0, st = js.indexOf('{', i);
  for(let j = st; j < js.length; j++){ if(js[j] === '{') d++; else if(js[j] === '}'){ d--; if(!d) return js.slice(i, j + 1); } }
  return ''; };
const agrab = (js, name) => { const i = js.indexOf('async function ' + name + '('); if(i < 0) return '';
  let d = 0, st = js.indexOf('{', i);
  for(let j = st; j < js.length; j++){ if(js[j] === '{') d++; else if(js[j] === '}'){ d--; if(!d) return js.slice(i, j + 1); } }
  return ''; };
const C = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*([\\d.]+)')); return m ? m[1] : 'undefined'; };

// ── 겉모양: 고친 자리가 실제로 있나
T('부품 점은 trkFromPart 로 간다', /else trkFromPart\(pos\); \}\);/.test(src));
T('우리 기록 장치가 돌면 부품 점을 항적에 안 넣는다', /if\(trkNow && trkNow\.nat\)\{[\s\S]{0,200}return false;\s*\}\s*return trkPush\(pos\);/.test(grab(src, 'trkFromPart')));
T('기록 장치 점은 trkSatPt 로 가른다', /if\(!trkSatPt\(q, ac\)\)/.test(agrab(src, 'trkBufDrain')));
T('기기별 정확도 기준을 trkPush 와 trkBufDrain 둘 다 쓴다',
  /trkAccJump\(ac, trkNow\.acr\)/.test(grab(src, 'trkPush')) && /trkAccJump\(ac, trkNow\.acr\)/.test(agrab(src, 'trkBufDrain')));
T('GPS 없는 기기 안내 넷이 다 있다', ['no-gps', 'gps-off', 'coarse'].every(w => grab(src, 'trkNoSatWhy').includes("'" + w + "'")));
T('기록이 안 켜지면 까닭을 사람에게 말한다', /return trkAttachWhy \|\| '위치를 받지 못했습니다/.test(src));
{
  const keys = ['이 기기에는 위성 위치(GPS) 장치가 없어 항적을 기록할 수 없습니다.',
                '이 기기에서 위성 위치(GPS)가 잡히지 않습니다. 와이파이 전용 아이패드처럼 GPS 장치가 없는 기기는 항적을 기록할 수 없습니다.'];
  for(const k of keys){
    const n = src.split("'" + k + "':").length - 1;
    T('세 나라 말이 있다 — ' + k.slice(0, 20), n === 3, n);
  }
}
// 네이티브 쪽 — 안드로이드·아이폰 둘 다
{
  const A = fs.readFileSync(__dirname + '/../android/app/src/main/java/kr/baetnil/app/BaetnilTrack.java', 'utf8');
  T('안드로이드: GPS 장치 없음을 FEATURE_LOCATION_GPS 로 본다', /FEATURE_LOCATION_GPS/.test(A) && /"no-gps"/.test(A));
  T('안드로이드: 정확한 위치 권한이 없으면 coarse', /ACCESS_FINE_LOCATION\)\s*!= PackageManager\.PERMISSION_GRANTED\) return "coarse"/.test(A));
  T('안드로이드: GPS 꺼짐이면 gps-off', /isProviderEnabled\(android\.location\.LocationManager\.GPS_PROVIDER\)\) return "gps-off"/.test(A));
  const S = fs.readFileSync(__dirname + '/../android/app/src/main/java/kr/baetnil/app/BaetnilTrackService.java', 'utf8');
  T('안드로이드: 기록 장치는 GPS_PROVIDER 만 받는다', /requestLocationUpdates\(LocationManager\.GPS_PROVIDER/.test(S) && !/NETWORK_PROVIDER, ASK/.test(S));
  const I = fs.readFileSync(__dirname + '/../ios/App/App/BaetnilTrack.swift', 'utf8');
  T('아이폰: 정확한 위치가 꺼져 있으면 coarse', /accuracyAuthorization == \.reducedAccuracy/.test(I) && /"why": "coarse"/.test(I));
  T('아이폰: 아이패드인지 알려 준다', /"pad": pad/.test(I));
  T('아이폰: 기록 장치는 배 항해 모드(.otherNavigation)', /activityType = \.otherNavigation/.test(I));
  T('아이폰: 속도를 모르면(-1) sp 를 안 적는다', /if l\.speed >= 0/.test(I));
}

// ── 실제로 돌려 본다
function harness(){
  const env = `
    const TRK_ACC=${C('TRK_ACC')}, TRK_GPS_ACC=${C('TRK_GPS_ACC')}, TRK_DIST=${C('TRK_DIST')}, TRK_LOST=${C('TRK_LOST')},
          TRK_MAX=99999, TRK_TOL=1, TRK_FLUSH=99999, TRK_STILL_MS=${C('TRK_STILL_MS')}, TRK_SOON_MS=1;
    ${require('./trkspd_pre.js')(src)}
    ${grab(src, 'trkTooFast')}
    const hav=(a,b,c,d)=>{const R=6371,r=x=>x*Math.PI/180,dLa=r(c-a),dLo=r(d-b);
      const q=Math.sin(dLa/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(q));};
    let trkNow = null, trkDraining = false, trkSoonTimer = null, BUF = [];
    const trkP = () => ({ drain: async () => { const pts = BUF; BUF = []; return { pts }; } });
    const trkSkip=()=>{ trkNow.drop=(trkNow.drop||0)+1; trkNow.skip=(trkNow.skip||0)+1; };
    const trkKeep=()=>{}, trkFlush=()=>{}, trkLive=()=>{}, trkBufMark=()=>{}, trkSimplify=a=>a;
    ${(src.match(/const TRK_Q = [^;]+;/) || ['const TRK_Q = 5;'])[0]} let trkKal = null;
    ${grab(src, 'trkSmooth')}
    ${grab(src, 'trkPush')}
    ${agrab(src, 'trkBufDrain')}
    ${grab(src, 'trkFromPart')}
    return {
      start(nat){ trkNow = { vid:'v', from:new Date(Date.now() - 3600e3).toISOString(), pts:[], id:null, nat:!!nat }; trkKal = null; BUF = []; },
      feed(arr){ BUF = BUF.concat(arr); }, drain: () => trkBufDrain(), part: p => trkFromPart(p),
      get: () => trkNow, soon: () => trkSoonTimer };`;
  return new Function(env)();
}

// 항적 만들기 — 바다 위 한 점에서 시작해 가끔 방향을 꺾는다. 1초마다 한 점.
const M_LAT = 111320, M_LON = 111320 * Math.cos(34.7 * Math.PI / 180);
function makeTrack({ kn, minutes, acc, pv, seed }){
  let la = 34.700, lo = 127.700, hd = 200, t = Date.now() - 3000e3;
  let r = seed || 1; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647; };
  const v = kn * 0.514444, out = [];
  for(let i = 0; i < minutes * 60; i++){
    if(i % 300 === 0 && i) hd += (rnd() < .5 ? -1 : 1) * (40 + rnd() * 50);    // 5분마다 꺾는다 (태킹·변침)
    la += v * Math.cos(hd * Math.PI / 180) / M_LAT;
    lo += v * Math.sin(hd * Math.PI / 180) / M_LON;
    const a = acc + rnd() * acc * .5;
    // 진짜 위치에 정확도만큼의 흔들림
    const e = a * .5 * (rnd() - .5);
    const p = { t: t + i * 1000, la: la + e / M_LAT, lo: lo + e / M_LON, ac: a, pv, true_la: la, true_lo: lo };
    if(pv === 'gps' || pv === 'ios') p.sp = v + (rnd() - .5) * .2;
    out.push(p);
  }
  return out;
}
// 진짜 길에서 가장 가까운 거리 (m)
const dist = (a, b) => Math.hypot((a.la - b.la) * M_LAT, (a.lo - b.lo) * M_LON);
function offPath(p, truth){ let m = 1e9; for(const q of truth) m = Math.min(m, dist(p, { la:q.true_la, lo:q.true_lo })); return m; }

(async () => {
  const boats = [
    { name:'카약 2노트', kn:2 }, { name:'요트 6노트', kn:6 }, { name:'표류 1노트', kn:1 },
    { name:'모터보트 30노트', kn:30 }, { name:'수상오토바이 50노트', kn:50 }];
  for(const dev of ['gps', 'ios']){
    const 기기 = dev === 'gps' ? '안드로이드' : '아이폰';
    for(const b of boats){
      const F = harness();
      F.start(true);
      const tr = makeTrack({ kn:b.kn, minutes:30, acc:5, pv:dev, seed: b.kn * 7 + (dev === 'ios' ? 3 : 0) });
      // 건물·물 반사로 튄 점 — 정확도는 흐리고(40~55m) 자리는 150~300m 밖. 속도값도 붙어 온다.
      const spikes = [];
      for(let k = 120; k < tr.length; k += 211){
        const p = tr[k], off = 150 + (k % 150);
        const s = { t: p.t + 300, la: p.true_la + off / M_LAT, lo: p.true_lo - off / M_LON, ac: 40 + (k % 16), pv: dev, sp: 7.3, spike:true };
        spikes.push(s);
      }
      // 아이폰 와이파이·기지국 위치 — 속도 -1(안 적힘), 정확도 65m
      const wifi = dev === 'ios' ? tr.filter((_, i) => i % 97 === 50).map(p => ({ t:p.t + 500, la:p.true_la + 400 / M_LAT, lo:p.true_lo, ac:65, pv:'ios', spike:true })) : [];
      const all = tr.concat(spikes, wifi).sort((x, y) => x.t - y.t);
      // 화면이 켜졌다 꺼졌다 — 몇 분 단위로 몰아 받는다
      for(let i = 0; i < all.length; i += 180){ F.feed(all.slice(i, i + 180)); await F.drain(); }
      const pts = F.get().pts;
      const 튐 = pts.filter(p => offPath(p, tr) > 60).length;
      T(`${기기} · ${b.name}: 튄 점이 하나도 안 남는다`, 튐 === 0, { 튐, n: pts.length });
      // 진짜 길이 끊기지 않았나 — 5분 넘게 빈 데가 없어야 한다
      let gap = 0; for(let i = 1; i < pts.length; i++) gap = Math.max(gap, Date.parse(pts[i].t) - Date.parse(pts[i-1].t));
      T(`${기기} · ${b.name}: 길이 끊기지 않는다 (가장 긴 빈 데 ${Math.round(gap/1000)}초)`, pts.length > 10 && gap < 300e3, { n: pts.length, gap });
    }
  }

  // ── 흐린 곳이 길게 이어질 때 (선실 안·높은 건물 사이) — 그 구간이 통째로 비면 안 된다
  for(const dev of ['gps', 'ios']){
    const F = harness(); F.start(true);
    const a = makeTrack({ kn:6, minutes:10, acc:4, pv:dev, seed:11 });
    const b = makeTrack({ kn:6, minutes:10, acc:30, pv:dev, seed:12 }).map(p => Object.assign(p, { t: p.t + 600e3 }));
    F.feed(a.concat(b)); await F.drain();
    const later = F.get().pts.filter(p => Date.parse(p.t) >= b[0].t);
    T(`${dev === 'gps' ? '안드로이드' : '아이폰'}: 정확도 4m 에서 30m 로 길게 흐려져도 그 구간이 남는다 (${later.length}점)`, later.length >= 20, later.length);
  }

  // ── 우리 기록 장치가 돌면 부품 점(구글 섞은 위치)은 항적에 안 들어간다
  {
    const F = harness(); F.start(true);
    const r = F.part({ latitude:34.7391, longitude:127.67757, accuracy:49, speed:7.3, bearing:10, time:Date.now() });
    T('부품 점은 항적에 안 들어간다 (10/2 계류장 안 7.3m/s 점)', r === false && F.get().pts.length === 0, F.get());
    T('부품 점이 오면 기록 장치 점을 곧 가져오게 한다', !!F.soon());
  }
  {
    const F = harness(); F.start(false);
    const r = F.part({ latitude:34.7400, longitude:127.7400, accuracy:6, speed:2, bearing:90, time:Date.now() });
    T('우리 기록 장치가 없는 곳(웹·옛 앱)에서는 예전처럼 받는다', r === true && F.get().pts.length === 1, F.get());
  }

  // ── 10/2 「아버지 지인」 항해 출항 4분 — 실제 받은 점 그대로 (안드로이드 gps 공급원이었다면)
  {
    const F = harness(); F.start(true);
    const t0 = Date.parse('2026-10-02T07:38:06Z');
    const real = [
      { t:t0,           la:34.73864, lo:127.67887, ac:7,  sp:0,   pv:'gps' },
      { t:t0 + 20e3,    la:34.73870, lo:127.67880, ac:6,  sp:.5,  pv:'gps' },
      { t:t0 + 40e3,    la:34.73875, lo:127.67872, ac:5,  sp:.6,  pv:'gps' },
      { t:t0 + 60e3,    la:34.73880, lo:127.67865, ac:5,  sp:.7,  pv:'gps' },
      { t:t0 + 80e3,    la:34.73884, lo:127.67858, ac:6,  sp:.7,  pv:'gps' },
      { t:t0 + 259e3,   la:34.73935, lo:127.67919, ac:41, sp:1.1, pv:'gps' },
      { t:t0 + 353e3,   la:34.7391,  lo:127.67757, ac:49, sp:7.3, pv:'gps' },
      { t:t0 + 513e3,   la:34.73996, lo:127.6752,  ac:51, sp:1.3, pv:'gps' },
    ];
    F.feed(real); await F.drain();
    const left = F.get().pts.filter(p => p.ac >= 40);
    T('10/2 출항 직후 41·49·51m 점 셋은 남지 않는다', left.length === 0, F.get().pts);
  }

  // ── 아이폰 공급원 판정
  {
    const env = `${require('./trkspd_pre.js')(src)} const TRK_GPS_ACC=${C('TRK_GPS_ACC')}; return trkSatPt;`;
    const sat = new Function(env)();
    T('안드로이드 gps 공급원은 위성', sat({ pv:'gps' }, 50) === true);
    T('안드로이드 network·fused 는 위성 아님', sat({ pv:'network', sp:1 }, 5) === false && sat({ pv:'fused', sp:1 }, 5) === false);
    T('아이폰: 속도를 준 점은 위성', sat({ pv:'ios', sp:0 }, 12) === true);
    T('아이폰: 속도 없고 65m(와이파이) 는 위성 아님', sat({ pv:'ios' }, 65) === false);
    T('아이폰: 속도 없어도 8m 로 또렷하면 위성', sat({ pv:'ios' }, 8) === true);
  }

  // ── 아이패드 — 3분 넘게 위치는 오는데 위성 점이 없으면 한 번 말한다
  {
    let said = 0;
    const env = `const TRK_PAD_S=${C('TRK_PAD_S')}; let trkNow;
      const trkKeep=()=>{}, t=x=>x, tell=()=>{ said++; };
      ${grab(src, 'trkPadCheck')}
      return { set:o=>{ trkNow=o; }, run:()=>trkPadCheck() };`;
    const F = new Function('said', env.replace(/said\+\+/, 'S.n++').replace('let trkNow;', 'let trkNow; const S=arguments[0];'))({ n:0 });
    const S = { n:0 };
    const G = new Function(env.replace(/said\+\+/, 'S.n++').replace('let trkNow;', 'let trkNow; const S=arguments[0];')).call(null, S);
    void F;
    G.set({ pad:true, sat:0, bufGot:40, from:new Date(Date.now() - 200e3).toISOString() });
    T('아이패드: 3분 지나 위성 점 0 이면 알린다', G.run() === true && S.n === 1);
    T('아이패드: 두 번은 안 알린다', G.run() === false && S.n === 1);
    G.set({ pad:true, sat:3, bufGot:40, from:new Date(Date.now() - 200e3).toISOString() });
    T('아이패드: 위성 점이 있으면 안 알린다', G.run() === false);
    G.set({ pad:false, sat:0, bufGot:40, from:new Date(Date.now() - 200e3).toISOString() });
    T('아이폰: 이 안내는 안 뜬다', G.run() === false);
  }

  console.log(`\n${ok} 통과 · ${bad} 실패`);
  process.exit(bad ? 1 : 0);
})();
