// MOB — 사람이 빠졌다
//
// ★ 왜 (4.53)
//   사람이 빠지면 몇 초 안에 그 자리를 박아 둬야 한다. 배는 계속 가고,
//   눈을 떼면 바다에서 사람을 다시 찾기가 거의 불가능하다.
//   그래서 이 기능의 규칙은 하나다 — 「묻지 말고 먼저 찍는다」.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) i = src.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

// ── ① 셈 — 방위와 거리
const BRG = grab('mobBearing'), CMP = grab('mobCompass');
T('★ 방위를 재는 곳이 있다 (mobBearing)', !!BRG);
T('★ 방위를 사람 말로 바꾸는 곳이 있다 (mobCompass)', !!CMP);
if(BRG && CMP){
  const F = new Function(`${BRG}\n${CMP}\nreturn { mobBearing, mobCompass };`)();
  const { mobBearing, mobCompass } = F;
  const r1 = Math.round(mobBearing(34.70, 127.70, 34.80, 127.70));
  const r2 = Math.round(mobBearing(34.70, 127.70, 34.70, 127.80));
  const r3 = Math.round(mobBearing(34.70, 127.70, 34.60, 127.70));
  const r4 = Math.round(mobBearing(34.70, 127.70, 34.70, 127.60));
  T('★★ 북쪽은 000도', r1 === 0 || r1 === 360, r1);
  T('★★ 동쪽은 090도', r2 === 90, r2);
  T('★★ 남쪽은 180도', r3 === 180, r3);
  T('★★ 서쪽은 270도', r4 === 270, r4);
  T('★ 같은 자리면 0도 (터지지 않는다)', isFinite(mobBearing(34.7,127.7,34.7,127.7)), mobBearing(34.7,127.7,34.7,127.7));
  T('★ 방위를 16방위로 읽어 준다', mobCompass(0) === '북' && mobCompass(90) === '동'
     && mobCompass(180) === '남' && mobCompass(270) === '서',
     [mobCompass(0), mobCompass(90), mobCompass(180), mobCompass(270)]);
  T('★ 사이 방위도 읽는다', mobCompass(45) === '북동' && mobCompass(225) === '남서',
     [mobCompass(45), mobCompass(225)]);
  T('★ 360 을 넘겨도 안 깨진다', mobCompass(370) === '북', mobCompass(370));
}

// ── ② 규칙 — 묻지 말고 먼저 찍는다
const MOB = grab('mobMark');
T('★ 찍는 곳이 있다 (mobMark)', !!MOB);
if(MOB){
  T('★★ 찍기 전에 묻지 않는다 (몇 초가 사람 목숨이다)',
    !/\bawait\s+ask\s*\(/.test(MOB) && !/\bconfirm\s*\(/.test(MOB), MOB.slice(0,400));
  T('★★ 이미 아는 자리로 먼저 찍는다 (GPS 를 기다리지 않는다)',
    /mobLastKnown\s*\(/.test(MOB), MOB.slice(0,600));
  T('★ 그다음 새 위치를 받아 고친다', /geoGet\s*\(/.test(MOB), MOB.slice(0,900));
  T('★★ 화면을 바로 연다', /mobPaint\s*\(|mobOpen\s*\(/.test(MOB), MOB.slice(0,600));
}
const LK = grab('mobLastKnown');
T('★ 이미 아는 자리를 찾는 곳이 있다 (mobLastKnown)', !!LK);
if(LK){
  const F2 = new Function('S', `
    const trkNow = S.trkNow, voyage = S.voyage, wxCur = S.wxCur;
    const curBoat = () => S.boat;
    ${LK}
    return mobLastKnown();
  `);
  const now = { trkNow: { pts: [{la:34.71, lo:127.71, t:'2026-08-28T09:00:00Z'}] }, voyage: [], wxCur: null, boat: null };
  T('★★ 항적 기록 중이면 마지막 점을 쓴다',
    (F2(now)||{}).lat === 34.71, F2(now));
  const noTrk = { trkNow: null, voyage: [{ id:'v', posOut:{lat:34.72, lon:127.72} }], wxCur:null, boat:null };
  T('★ 항적이 없으면 항해일지의 자리라도 쓴다', (F2(noTrk)||{}).lat === 34.72, F2(noTrk));
  T('★ 아무것도 없으면 없다고 한다 (지어내지 않는다)',
    F2({ trkNow:null, voyage:[], wxCur:null, boat:null }) === null,
    F2({ trkNow:null, voyage:[], wxCur:null, boat:null }));
}

// ── ③ 화면
T('★★ 누를 단추가 있다', /mobMark\(\)/.test(src));
T('★ 사람이 빠졌다는 말이 있다', /사람 빠짐|사람이 빠졌/.test(src));
// ★★ 4.110 에서 이 줄을 뒤집었다.
//   여태 「tel:122 가 있는가」 를 봤는데, 그것이 바로 흠이었다 —
//   122 는 한국 번호였고, 그마저 2016년 119 로 합쳐졌다.
//   일본 바다에서 122 를 누르면 아무 데도 안 닿는다 (거기는 118 이다).
//   그래서 이제는 「어디서든 122 로 걸지 않는가」 와
//   「나라를 보고 번호를 정하는가」 를 본다.
T('★★★ 아무 데서나 122 로 걸지 않는다 (일본에서는 안 닿는 번호다)', !/tel:122/.test(src));
T('★★ 바로 걸 수 있는 단추가 여전히 있다', /id="mobSos"/.test(src) && /'tel:' \+ s\.n/.test(src));
T('★★ 나라를 보고 번호를 정한다 (한국 119 · 일본 118)',
  /kr: \{ n:'119'/.test(src) && /jp: \{ n:'118'/.test(src));
T('★ 항해일지에 한 줄로 남는다', /mobLog\s*\(|'사람 빠짐'/.test(src));
T('★ 끌 수 있다', /mobClose\s*\(/.test(src));

// ── ④ 자리 (4.66) — 항해 중에만 뜬다
//
//   ★ 왜 옮겼나
//     4.53~4.65 는 오늘 화면 맨 위에 빨간 막대를 박아 두었다. 사장님이 잡으셨다 —
//     앱을 여는 까닭의 대부분은 날씨·물때·정비다. 정박해 있는 배에서 첫 화면을
//     빨간 덩어리가 잡아먹을 까닭이 없고, 잘못 누를 자리만 된다.
//     사람이 빠지는 것은 어느 화면을 보고 있든 일어나므로, 항해 중에는
//     화면에 떠 있어야 하고 정박 중에는 아예 없어야 한다.
{
  const HOME = grab('renderHome');
  T('★★ 오늘 화면(renderHome)에는 MOB 단추가 없다', !!HOME && !/mobMark\s*\(/.test(HOME));
  T('★★ 화면에 떠 있는 단추가 있다 (#mobFab)', /id="mobFab"[^>]*onclick="mobMark\(\)"/.test(src));
  T('★ 옛 오늘 화면 막대(.mobbar)는 안 남아 있다', !/\.mobbar\b/.test(src));

  // 기본이 숨김이어야 한다. 기본이 보임이면 정박 중에도 뜬다.
  const css = (src.match(/\.mobfab\{[^}]*\}/) || [''])[0];
  T('★★ 기본은 숨김이다 (display:none)', /display:\s*none/.test(css), css.slice(0,120));
  T('★★ .on 일 때만 보인다', /\.mobfab\.on\{[^}]*display:\s*(flex|block)/.test(src));
  T('★ 아래 단추줄을 안 가린다 (bottom 이 62px 보다 위)',
    /bottom:\s*calc\(\s*(\d+)px/.test(css) && Number(RegExp.$1) >= 62, css.slice(0,160));

  // 켜고 끄는 문이 하나여야 한다
  const SY = grab('mobFabSync');
  T('★★ 켜고 끄는 문이 하나 있다 (mobFabSync)', !!SY);
  T('★★ trkOn() 으로 정한다', !!SY && /trkOn\s*\(\s*\)/.test(SY), SY);

  if(SY){
    // 실제로 켜고 꺼지는지 돌려 본다
    let cls = { on:false };
    const el = { classList: { toggle:(n,v)=>{ cls[n] = !!v; } } };
    const run = new Function('trkNow', `
      const document = { getElementById: () => arguments0 };
      const trkOn = () => !!trkNow;
      ${SY}
      mobFabSync();
    `.replace('arguments0','EL'));
    const mk = (trkNow) => {
      cls = { on:null };
      const fn = new Function('trkNow','EL', `
        const document = { getElementById: (id) => id === 'mobFab' ? EL : null };
        const trkOn = () => !!trkNow;
        ${SY}
        mobFabSync();`);
      fn(trkNow, el);
      return cls.on;
    };
    T('★★ 항해 중이면 뜬다', mk({ vid:'v1', pts:[] }) === true, cls);
    T('★★ 정박 중이면 안 뜬다', mk(null) === false, cls);
  }

  // trkNow 를 건드리는 곳마다 불러야 한다. 안 부르면 배에서 내렸는데 빨간 단추가 남는다.
  const START = grab('trkStart'), STOP = grab('trkStop'), RES = grab('trkResume'), SW = grab('switchTab');
  T('★★ 항적을 켤 때 부른다 (trkStart)',   !!START && /mobFabSync\s*\(/.test(START));
  T('★★ 항적을 끌 때 부른다 (trkStop)',    !!STOP  && /mobFabSync\s*\(/.test(STOP));
  T('★ 앱을 다시 켤 때 부른다 (trkResume)', !!RES   && /mobFabSync\s*\(/.test(RES));
  T('★ 탭을 옮겨도 따라온다 (switchTab)',   !!SW    && /mobFabSync\s*\(/.test(SW));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
