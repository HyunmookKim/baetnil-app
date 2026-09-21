// 정비 절차 — 「했다/안 했다」가 아니라 「이렇게 한다」
//
// ★ 왜 (4.54, STEP 3-A)
//   민카라 整備手帳 은 사진 25장에 사진마다 설명이 붙는다. 사실상 「1단계 = 사진 1장 + 설명 1줄」 이다.
//   그래서 그것은 기록이 아니라 설명서다. 500만 건이 쌓인 까닭이 그것이다.
//   우리 정비 기록은 날짜·항목·메모뿐이라 남이 보고 따라할 수 있는 물건이 아니었다.
//
// ★ 규칙 — 기존 기록은 안 건드린다. 위에 얹는다. 안 쓰면 예전과 똑같이 보인다.
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
const num = n => { const m = src.match(new RegExp('const ' + n + '\\s*=\\s*(-?[\\d.]+)')); return m ? Number(m[1]) : null; };
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

// ── ① 한도
const MAX = num('HOW_MAX');
T('★ 단계 수 한도가 있다 (HOW_MAX)', MAX !== null && MAX > 0, MAX);
T('★★ 민카라와 같은 25단계다', MAX === 25, MAX);

// ── ② 단계 다루기
const STEPS = grab('howSteps'), ADD = grab('howAdd'), DEL = grab('howDel'), MOVE = grab('howMove');
T('★ 단계를 읽는 곳이 있다 (howSteps)', !!STEPS);
T('★ 단계를 더하는 곳이 있다 (howAdd)', !!ADD);
T('★ 단계를 지우는 곳이 있다 (howDel)', !!DEL);
T('★ 단계 순서를 바꾸는 곳이 있다 (howMove)', !!MOVE);
if(STEPS){
  const F = new Function(`${STEPS}\nreturn howSteps;`)();
  T('절차가 없으면 빈 목록이다 (옛 기록이 그대로 열린다)', F({}).length === 0 && F(null).length === 0);
  T('망가진 값이 들어 있어도 안 터진다', F({ how:'글자' }).length === 0, F({ how:'글자' }));
  T('★ 단계는 그대로 읽는다', F({ how:[{v:'볼트를 푼다'},{v:'임펠러를 뺀다'}] }).length === 2);
}

// ── ③ 공개 — 기록마다 따로 켠다 (항적과 같은 방식)
const PUBW = grab('howPublic');
T('★ 공개용으로 거르는 곳이 있다 (howPublic)', !!PUBW);
if(PUBW){
  const F2 = new Function('M', `
    const HOW_MAX = ${MAX};
    const photoBudget = (a, kb) => ({ kept: (a||[]).slice(0, 2), ok:true, dropped:0 });
    ${STEPS}
    ${PUBW}
    return howPublic(M);
  `);
  const rec = { id:'m1', name:'임펠러 교체', grp:'추진', lastDate:'2026-08-01',
                note:'김사장 010-1234-5678 에게 연락', pub:true,
                hard:3, work:1.5, cost:'35000', used:'임펠러 A-3, 육각렌치',
                how:[{v:'해수 씨콕을 잠근다', p:'p1'},{v:'펌프 커버를 연다', p:'p2'},{v:'임펠러를 뺀다', p:'p3'}] };
  const r = F2(rec);
  T('★★ 절차가 그대로 나간다', r.how && r.how.length === 3, r.how);
  T('★ 난이도·걸린 시간·든 돈·쓴 것이 나간다',
    r.hard === 3 && r.work === 1.5 && r.cost === '35000' && /임펠러 A-3/.test(r.used || ''), r);
  // ★ 4.73 — 메모가 나간다 (사장님이 정하신 것 — 「사람들 보라고 메모 쓰는 건데」).
  //   앱이 임의로 막지 않는다. 무엇을 적을지는 쓰는 사람이 정하고,
  //   앱은 「나간다」 고 화면에서 미리 말한다.
  T('★★★ 메모가 나간다 (남 보라고 쓴 것이다)', r.note !== undefined && !!r.note, r.note);
  T('★ 사진은 용량 안에서만 나간다', F2(rec).how.filter(x=>x.p).length <= 3);
  // 공개를 안 켠 기록
  const r2 = F2(Object.assign({}, rec, { pub:false }));
  T('★★ 공개를 안 켜면 절차가 안 나간다', !r2.how, r2);
  T('★ 그래도 항목·날짜는 예전처럼 나간다',
    r2.name === '임펠러 교체' && r2.lastDate === '2026-08-01', r2);
  const r3 = F2(Object.assign({}, rec, { pub:undefined }));
  T('★★ 기본은 비공개다 (사람이 켜야 나간다)', !r3.how, r3);
}

// ── ④ 공개 자료에 실제로 붙는다
const BP = grab('buildPublic');
T('공개 자료 만드는 곳이 있다', !!BP);
T('★★ 정비를 내보낼 때 howPublic 을 지난다', /howPublic\s*\(/.test(BP || ''), (BP||'').slice((BP||'').indexOf('maint'), (BP||'').indexOf('maint')+300));

// ── ⑤ 화면
T('★ 기록 창에 「정비 절차」 가 있다', /정비 절차/.test(src));
T('★ 단계를 더하는 단추가 있다', /howAdd\(/.test(src));
T('★ 단계마다 사진을 넣을 수 있다', /howPhoto\(/.test(src));
T('★ 난이도 칸이 있다', /mrField\('hard'/.test(src));
T('★ 걸린 시간이 시·분 두 칸이다', /durRow\('걸린 시간'|durRow\('작업 시간'/.test(src));
T('★ 든 돈 칸이 있다', /mrField\('cost'/.test(src));
T('★★ 이 기록을 공개하는 스위치가 있다', /mrField\('pub'|howPubToggle\(/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
