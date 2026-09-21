// 수에 따라 낱말이 바뀌는가 (4.115)
//
// ★★★ 왜 이 검사가 있나
//   한국어에는 없는 문제라 여태 못 보고 있었다.
//   한국어 「{n}일 남음」 은 1이든 5든 그대로다. 그런데
//     · 영어   — 1 day / 2 days                 (두 갈래)
//     · 러시아어 — 1 день / 2 дня / 5 дней       (세 갈래, 11~14 는 예외)
//   그래서 앱이 영어로 **「1 days left」**, 러시아어로 **「1 отзывов」** 라고 말하고 있었다.
//   러시아 사람에게 「1 отзывов」 는 외국인이 쓴 글로 바로 보인다.
//
// ★ 사전에 갈래를 [[하나|둘~넷|다섯 이상]] 으로 적어 두면 tsub 가 골라 준다.
//   갈래를 안 적은 글은 하나도 안 바뀐다 — 3천 줄을 한꺼번에 손대지 않으려고 그렇게 만들었다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 220) : '')); } };
function grab(name){
  const a = src.indexOf('function ' + name + '(');
  if(a < 0) return '';
  let d = 0, j = src.indexOf('{', a);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(a, j);
}
function dicts(){
  const i = src.indexOf('const I18N = {');
  let d = 0, j = src.indexOf('{', i), k;
  for(k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0){ k++; break; } }
  }
  const g = {};
  (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g);
  return g.I18N;
}
const I = dicts();

// ── ① 문이 있는가
T('①-1 ★★ 갈래를 정하는 셈이 있다 (plForm)', !!grab('plForm'));
T('①-2 ★★ 갈래를 고르는 셈이 있다 (plPick)', !!grab('plPick'));
{
  const B = grab('tsub');
  const 고르는곳 = B.indexOf('plPick(');
  const 끼우는곳 = B.indexOf('for(const k in vals)');
  T('①-3 ★★★ tsub 가 숫자를 끼우기 **전에** 갈래를 고른다',
    고르는곳 > 0 && 끼우는곳 > 고르는곳, B.slice(0, 300));
  T('①-4 ★★ 숫자를 끼우는 자리가 하나뿐이다 (둘이면 앞뒤가 어긋난다)',
    (B.match(/for\(const k in vals\)/g) || []).length === 1, B.slice(0, 300));
}

// ── ② 실제로 돌려 본다
let M = null;
try{
  let LANG = 'en';
  const F = new Function('I', 'setL', 'getL',
    'const langNow = () => getL();' +
    'const t = k => { const L = getL(); return (I[L] && I[L][k] !== undefined) ? I[L][k] : k; };' +
    grab('plForm') + grab('plPick') + grab('tsub') +
    'return { tsub, plForm, set:setL };');
  const box = { L:'en' };
  M = F(I, v => { box.L = v; }, () => box.L);
}catch(e){ console.log('★ 셈을 못 세웠다: ' + e.message); }
T('②-0 갈래 셈을 꺼내 돌릴 수 있다', !!M);

if(M){
  const 봄 = (l, key, n) => { M.set(l); return M.tsub(key, { n:n }); };
  // 영어 — 하나면 홑, 아니면 겹
  T('②-1 ★★★ 영어 1은 홑수다', 봄('en','{n}일 남음',1) === '1 day left', 봄('en','{n}일 남음',1));
  T('②-2 ★★★ 영어 2 이상은 겹수다', 봄('en','{n}일 남음',5) === '5 days left', 봄('en','{n}일 남음',5));
  T('②-3 ★★ 영어 0도 겹수다 (0 days 가 맞다)', /0 days/.test(봄('en','{n}일 남음',0)), 봄('en','{n}일 남음',0));
  // 러시아어 — 세 갈래. 11~14 는 1·2·4 로 끝나도 셋째 갈래다.
  const R = n => 봄('ru','{n}일 남음',n);
  T('②-4 ★★★ 러시아어 1 → день', R(1) === 'осталось 1 день', R(1));
  T('②-5 ★★★ 러시아어 2 → дня', R(2) === 'осталось 2 дня', R(2));
  T('②-6 ★★★ 러시아어 5 → дней', R(5) === 'осталось 5 дней', R(5));
  T('②-7 ★★★ 러시아어 11 → дней (1로 끝나지만 예외다)', R(11) === 'осталось 11 дней', R(11));
  T('②-8 ★★★ 러시아어 12·13·14 도 дней', R(12) === 'осталось 12 дней' && R(13) === 'осталось 13 дней' && R(14) === 'осталось 14 дней', R(12) + ' / ' + R(13));
  T('②-9 ★★★ 러시아어 21 → день', R(21) === 'осталось 21 день', R(21));
  T('②-10 ★★★ 러시아어 22 → дня', R(22) === 'осталось 22 дня', R(22));
  T('②-11 ★★★ 러시아어 25 → дней', R(25) === 'осталось 25 дней', R(25));
  T('②-12 ★★ 러시아어 101 → день', R(101) === 'осталось 101 день', R(101));
  T('②-13 ★★ 러시아어 111 → дней', R(111) === 'осталось 111 дней', R(111));
  // 한국어·일본어는 수에 따라 안 바뀐다
  T('②-14 ★★ 일본어는 수에 따라 안 바뀐다', 봄('ja','{n}일 남음',1) === 봄('ja','{n}일 남음',5).replace('5','1'), 봄('ja','{n}일 남음',5));
  T('②-15 ★★ 한국어는 그대로다', 봄('ko','{n}일 남음',3) === '3일 남음', 봄('ko','{n}일 남음',3));
  // 갈래를 안 적은 글은 하나도 안 바뀐다
  M.set('en');
  T('②-16 ★★★ 갈래를 안 적은 글은 지금까지와 똑같다',
    M.tsub('{n}개 목록 중', { n:3 }) === 'across 3 lists', M.tsub('{n}개 목록 중', { n:3 }));
  T('②-17 ★ 갈래가 셋인데 영어면 둘째까지만 쓴다 (넘치면 마지막 갈래)',
    !/\|/.test(봄('en','이 등급인 {n}명은 맨 아래 등급으로 내려갑니다.',1)),
    봄('en','이 등급인 {n}명은 맨 아래 등급으로 내려갑니다.',1));
}

// ── ③ 사전에 남은 갈래 표시가 새어 나가지 않는가
//   ★ 화면에 「[[day|days]]」 가 글자로 찍히면 사람은 앱이 깨진 줄 안다.
{
  for(const L of ['ko','en','ru','ja']){
    const D = I[L] || {};
    const 갈래있음 = Object.keys(D).filter(k => /\[\[/.test(String(D[k])));
    // 갈래를 적은 글은 반드시 tsub 로 부르는 글이라야 한다 — 곧 {n} 같은 자리표가 있어야 한다
    const 자리표없음 = 갈래있음.filter(k => !/\{[a-zA-Z]/.test(String(D[k])));
    T('③-' + L + ' ★★★ 갈래를 적은 글에는 반드시 자리표가 있다 (' + 갈래있음.length + '곳 중)',
      자리표없음.length === 0, 자리표없음.slice(0, 3).join(' | '));
    const 짝안맞음 = 갈래있음.filter(k => (String(D[k]).match(/\[\[/g) || []).length
                                      !== (String(D[k]).match(/\]\]/g) || []).length);
    T('③-' + L + '-짝 ★★★ [[ 와 ]] 의 짝이 맞는다', 짝안맞음.length === 0, 짝안맞음.slice(0, 3).join(' | '));
    const 빈갈래 = 갈래있음.filter(k => /\[\[\s*\]\]|\|\s*\||\[\[\s*\||\|\s*\]\]/.test(String(D[k])));
    T('③-' + L + '-빈칸 ★★ 빈 갈래가 없다', 빈갈래.length === 0, 빈갈래.slice(0, 3).join(' | '));
  }
  // 러시아어에 갈래를 적었으면 셋이라야 한다 (둘만 적으면 5개 이상에서 틀린다)
  const 러 = Object.keys(I.ru).filter(k => /\[\[/.test(String(I.ru[k])));
  const 둘뿐 = 러.filter(k => [...String(I.ru[k]).matchAll(/\[\[([^\]]*)\]\]/g)]
                              .some(m => m[1].split('|').length < 3));
  T('③-러-갈래수 ★★★ 러시아어 갈래는 셋이다 (' + 러.length + '곳)', 둘뿐.length === 0,
    둘뿐.slice(0, 3).map(k => I.ru[k]).join(' | '));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
