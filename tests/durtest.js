// 시간을 사람 말로 — 0.8h 가 아니라 48분
//
// ★ 왜 (4.52) — 사장님: 「0.8 이런 식이면 직관적이지 못하다. 40분 이렇게 나와야지」
//   저장은 그대로 십진 시간이다 (연료 계산·엔진 누계가 그 숫자를 쓴다).
//   바꾸는 것은 보여 주는 방식과 넣는 방식뿐이다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w):''));} };

const TXT = grab('durText'), PARTS = grab('durParts'), JOIN = grab('durJoin'), ROW = grab('durRow'), SET = grab('durSet');
T('★ 사람 말로 바꾸는 곳이 있다 (durText)', !!TXT);
T('★ 시·분으로 쪼개는 곳이 있다 (durParts)', !!PARTS);
T('★ 시·분을 합치는 곳이 있다 (durJoin)', !!JOIN);
T('★ 기록 창에 넣는 두 칸이 있다 (durRow)', !!ROW);

if(TXT && PARTS && JOIN){
  const F = new Function(`
    const tsub = (m,o)=>String(m).replace(/\\{(\\w+)\\}/g,(a,k)=>(o&&o[k]!=null)?o[k]:a);
    ${TXT} ${PARTS} ${JOIN}
    return { durText, durParts, durJoin };
  `)();
  const { durText, durParts, durJoin } = F;

  T('★★ 0.8 은 48분이다', durText(0.8) === '48분', durText(0.8));
  T('★★ 1.6 은 1시간 36분이다', durText(1.6) === '1시간 36분', durText(1.6));
  T('★ 딱 떨어지면 분을 안 붙인다', durText(2) === '2시간', durText(2));
  T('한 시간 안이면 분만 말한다', durText(0.25) === '15분', durText(0.25));
  T('0 은 0분이다', durText(0) === '0분', durText(0));
  T('빈 값은 아무 말도 안 한다', durText('') === '' && durText(null) === '' && durText('abc') === '',
    [durText(''), durText(null), durText('abc')]);
  T('음수는 아무 말도 안 한다', durText(-1) === '', durText(-1));
  T('★ 긴 시간도 시간으로 말한다 (일로 안 바꾼다)', durText(123.4) === '123시간 24분', durText(123.4));

  T('★ 0.8 을 시·분으로 쪼개면 0시간 48분', durParts(0.8).h === 0 && durParts(0.8).m === 48, durParts(0.8));
  T('1.6 을 쪼개면 1시간 36분', durParts(1.6).h === 1 && durParts(1.6).m === 36, durParts(1.6));
  T('빈 값을 쪼개면 빈 칸', durParts('').h === '' && durParts('').m === '', durParts(''));

  T('★★ 1시간 36분을 합치면 1.6', durJoin(1, 36) === 1.6, durJoin(1,36));
  T('0시간 48분을 합치면 0.8', durJoin(0, 48) === 0.8, durJoin(0,48));
  T('★ 둘 다 비면 빈 값이다 (0 이 아니다)', durJoin('', '') === '', durJoin('',''));
  T('★ 넣은 것을 되읽어도 그대로다 (0.8 → 시·분 → 0.8)',
    durJoin(durParts(0.8).h, durParts(0.8).m) === 0.8);
  T('★ 1.6 도 되읽어서 그대로다', durJoin(durParts(1.6).h, durParts(1.6).m) === 1.6);
  T('★ 음수는 0 으로 본다', durJoin(-3, -5) === '', durJoin(-3,-5));
}

// ── 화면에서 실제로 쓰이는가
T('★★ 항해 시간이 두 칸으로 바뀌었다', /durRow\('항해 시간'/.test(src));
T('★★ 엔진 시간이 두 칸으로 바뀌었다', /durRow\('엔진 시간'/.test(src));
T('★ 엔진 가동 기록도 두 칸이다', /durRow\('가동시간'/.test(src));
T('★★ 어디에도 「h」로 그냥 찍는 자리가 안 남았다',
  !/\$\{it\.hours\|\|'—'\} h/.test(src) && !/\$\{it\.engineH\|\|'—'\} h/.test(src));
T('★ 세일로 간 시간도 사람 말로 나온다', /durText\(a-b\)/.test(src));
T('★ 총 가동시간도 사람 말로 나온다', /durText\(eh\.total\)/.test(src));
T('★ 공개 항해 보기에서도 사람 말로 나온다', /durText\(v\.hours\)/.test(src));
// ★ 저장 모양은 그대로여야 한다 — 연료·엔진 누계가 이 숫자를 쓴다
T('★★ 저장은 여전히 십진 시간이다 (연료 계산이 쓰는 값)',
  /parseFloat\(v\.engineH\)/.test(src) && /parseFloat\(r\.hours\)/.test(src));
T('★ 분이 60 을 넘으면 시간으로 올려 준다', /M >= 60/.test(SET || ''), (SET||'').slice(0,300));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
