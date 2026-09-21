// 항적이 켜지는가, 안 켜지면 말해 주는가.
//
// ★ 사고 (2026-08-25 실제 항해)
//   [+ 기록] 으로 항해를 만들고 나갔는데 항적이 하나도 안 그려졌다.
//   항적을 켜는 자리가 예정 항해 → [출항했습니다] 하나뿐이었기 때문이다.
//   바로 나가는 사람은 켤 길이 아예 없었고, 화면에는 아무 말도 안 떴다.
//   trkStart 가 여섯 군데에서 조용히 false 만 돌려줬다.
//
// ★ 그리고 위치정보지원센터 회신(2026-08-25)에 맞춰 확인자료 칸을 채웠다.
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const S = fs.readFileSync(FILE, 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,220):''));} };

function grab(name){
  const i = S.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = S.indexOf('{', i), st = j;
  for(; j < S.length; j++){
    if(S[j] === '{') d++;
    else if(S[j] === '}'){ d--; if(d === 0) break; }
  }
  return S.slice(st, j + 1);
}

// ── 1. 켜는 길이 둘 다 있는가
const add = grab('addVoyage');
T('★ [+ 기록] 으로 만들어도 항적을 켠다', /trkStartSay\(/.test(add), add.slice(-200));
const plan = grab('planStart');
T('예정 항해 → 출항했습니다 도 켠다', /trkStartSay\(/.test(plan), plan.slice(-160));
// ★ 두 길이 같은 문을 지나야 한다. 따로 부르면 한쪽만 고쳐진다.
T('두 길이 같은 문을 쓴다',
  /trkStartSay\(/.test(add) && /trkStartSay\(/.test(plan) && !/trkStart\((?!Say)/.test(add));

// ── 2. 안 켜지면 까닭을 말하는가
const st = grab('trkStart');
T('웹이면 까닭을 돌려준다', /웹에서는 항적을 기록하지 않습니다/.test(st));
T('부품이 없으면 까닭을 돌려준다', /이 버전에는 항적 기능이 없습니다\. 앱을 새로 받아 주세요\./.test(st));
T('로그인·동의가 없으면 까닭을 돌려준다', /로그인하고 위치 이용에 동의하셔야/.test(st));
T('위치를 못 받으면 까닭을 돌려준다', /위치를 받지 못했습니다/.test(st));
// ★ 조용히 false 로 끝나던 길이 남아 있으면 또 같은 사고가 난다
T('조용히 false 만 돌려주는 길이 없다', !/return false;/.test(st), st.slice(0,400));
const say = grab('trkStartSay');
T('까닭을 사람에게 알린다', /tell\(t\(why\)\)/.test(say));
T('그만두겠다고 한 것은 말하지 않는다', /quiet/.test(say) && /if\(!await trkGuide\(\)\) return '';/.test(st));

// ── 3. 화면에서 켜고 끌 수 있는가
const bx = grab('trkBox');
T('★ 아직 안 켠 항해에 켜는 단추가 있다', /항적 기록 시작/.test(bx) && /trkStartSay\(/.test(bx));
// ★ 4.132 — 「멈추기」 를 「중지」 로 정했다.
T('기록 중이면 멈추는 단추가 있다', /t\('중지'\)/.test(bx) && /trkStopSay\(\)/.test(bx));
T('예정 항해에는 안 보인다', /isPlan\(it\)\) return ''/.test(bx));
T('이미 도착까지 적은 항해에는 안 보인다', /it\.timeIn/.test(bx));
T('다른 항해를 기록 중이면 안 보인다', /if\(trkOn\(\)\) return ''/.test(bx));
// ★ 4.117 — 점 개수 글은 trkCountText() 한 군데서만 짓는다. 두 곳을 다 본다.
// 주석에 적힌 이름에 속지 않도록, 주석을 걷어 내고 본다 (http:// 는 안 건드린다).
const nocmt = s => String(s||'').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const cnt = grab('trkCountText');
T('몇 점 찍혔는지 보여 준다',
  /trkCountText\(\)/.test(nocmt(bx)) && /trkNow\.pts/.test(cnt) && /\{n\}점/.test(cnt), cnt.slice(0,200));

// ── 4. 확인자료 — 센터가 요구한 칸 (좌표는 여전히 안 담는다)
const la = grab('lgAdd');
T('수집요청인을 남긴다', /row\.who/.test(la));
T('수집방법을 남긴다', /row\.how/.test(la));
T('수집이면 방법이 비지 않는다', /단말기 GPS/.test(la));
T('좌표는 여전히 스위치가 꺼져 있으면 안 담는다', /LG_KEEP_POS/.test(la));
T('수집요청인을 정하는 문이 하나다', /function lgWho\(/.test(S));
const tr = grab('lgTrack');
T('항적 묶음에 시작·종료가 있다', /from: from/.test(tr) && /to: to/.test(tr));
T('항적 묶음에 건수가 있다', /n: n/.test(tr));
T('항적 묶음에 수집주기가 있다', /every:/.test(tr) && /TRK_DIST/.test(tr));
T('항적 묶음에 수집방법이 있다', /how:/.test(tr));
// ★ 확인자료는 위치정보 자체를 담는 자료가 아니다 (법 제2조). 좌표를 넣으면 안 된다.
T('항적 묶음에 좌표를 넣지 않는다', !/lat|lon|\bla\b|\blo\b/.test(tr), tr);

// ── 5. 새 말이 영어·러시아어에도 있다
['웹에서는 항적을 기록하지 않습니다. 앱으로 여셔야 합니다.','항적 기록 시작','중지',
 '아직 기록하지 않고 있습니다'].forEach(k=>{
  const n = S.split("'" + k + "':").length - 1;
  T("'" + k.slice(0,20) + "' 이 영어·러시아어에 다 있다", n >= 2, n);
});

console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad?1:0);
