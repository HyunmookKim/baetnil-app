// 3.98 에서 고친 네 가지가 다시 무너지지 않게 잡아 둔다.
//
// ★ 왜 이 검사가 있나
//   넷 다 '터지지 않는 고장' 이었다. 오류창도 안 뜨고, 검사도 다 통과하는데,
//   화면만 조용히 거짓말을 했다. 그런 것은 코드를 읽어서 잡는 수밖에 없다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let pass=0, fail=0;
const T=(n,c,w)=>{ if(c){pass++;console.log('통과: '+n);}
  else {fail++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,140):''));} };

// ── ① 내 할 일 — 번역 함수를 가리지 않는다
{
  const my = grab('openMyTasks');
  T('내 할 일 화면이 있다', !!my);
  T('줄 만드는 함수가 t 를 매개변수로 쓰지 않는다', !/const row = t =>/.test(my));
  // 안에서 t('…') 를 부르는데 그 t 가 가려져 있으면 터진다
  const arrow = (my.match(/const row = (\w+) =>/) || [])[1];
  T('줄 만드는 함수 매개변수 이름을 따로 지었다', !!arrow && arrow !== 't', arrow);
  T('그 안에서 번역을 부른다', /t\('정기점검'\)/.test(my));
  T('할 일 값은 그 이름으로 읽는다',
    !!arrow && new RegExp('\\b' + arrow + '\\.kind').test(my) && new RegExp('\\b' + arrow + '\\.name').test(my));
}

// ── ② 출항 전 점검 카드 — 진짜 체크 수를 센다
{
  const rh = grab('renderHome');
  T('오늘 화면이 있다', !!rh);
  T('없는 값(x.done)으로 세지 않는다', !/filter\(x => x\.done\)/.test(rh));
  T('진짜 체크 목록(ckDone)에서 센다', /ckDone\(cur\.id, cur\.cycle\)/.test(rh));
  T('고른 목록을 함수로 읽는다 (값처럼 쓰지 않는다)',
    /ckCurId === 'function'\) \? ckCurId\(\)/.test(rh) && !/String\(typeof ckCurId!=='undefined' \? ckCurId :/.test(rh));
  // x.done 은 앱 어디에도 넣는 곳이 없다 — 다시 쓰면 안 된다
  T('x.done 을 넣는 곳이 여전히 없다', !/\.done\s*=\s*(true|!)/.test(src));
}

// ── ③ 마지막 항해 — 예정은 빼고 고른다
{
  const rh = grab('renderHome');
  T('예정 항해를 걸러낸다', /filter\(x => x && !x\.plan\)/.test(rh));
  // '마지막 항해' 카드를 만드는 대목 바로 앞에서 걸러야 한다
  const i = rh.indexOf("t('마지막 항해')");
  const seg = rh.slice(Math.max(0, i-600), i);
  T('마지막 항해를 고르는 자리에서 거른다', /!x\.plan/.test(seg), seg.slice(-200));
}

// ── ④ 소수점 찌꺼기
{
  const bw = grab('boatWxCard') || src;
  T('경고 값을 그대로 찍지 않는다', !/<span>\$\{w\.value\}/.test(src));
  T('값을 다듬는 함수가 있다', /const wxNum = \(v, key\)/.test(src));
  T('파고·조류는 한 자리까지', /maxWave' \|\| key === 'maxCurrent'\) \? String\(Math\.round\(n\*10\)\/10\)/.test(src));
  T('나머지는 정수로', /String\(Math\.round\(n\)\)/.test(src));
  T('「기준」도 사전을 거친다', /tsub\('기준 \{v\}'/.test(src));
}

// ── ⑤ 숫자 검사
{
  const sb = grab('setBoatSpec');
  T('제원에 성한 범위가 있다', /const SPEC_MAX = \{/.test(src));
  T('제원 검사 함수가 있다', /function specNumOk\(key, n\)/.test(src));
  T('음수를 막는다', /if\(n < 0\) return '0보다 작은 값은 넣을 수 없습니다\.'/.test(src));
  T('너무 큰 값을 막는다', /if\(mx && n > mx\)/.test(src));
  T('막히면 저장하지 않는다', /if\(bad\)\{[\s\S]{0,160}return;/.test(sb));
  T('제원이 parseFloat 결과를 그냥 넣지 않는다',
    !/b\.spec\[key\] = \(BOAT_SPEC\[key\] && BOAT_SPEC\[key\]\.text\) \? t : parseFloat\(t\)/.test(src));

  const mf = grab('mrField');
  T('기록 칸에도 숫자 검사가 있다', /const NUM_FIELD = \{/.test(src));
  T('주유량·가동시간이 검사 목록에 있다', /liters:\{/.test(src) && /hours: *\{/.test(src) && /engineH:\{/.test(src));
  T('mrField 가 검사를 거친다', /const spec = NUM_FIELD\[k\]/.test(mf));
  // ★ 4.101 — 큰 창이 아니라 **그 칸 바로 아래 빨간 한 줄**로 말한다 (사장님이 정하신 것 ①)
  T('막히면 값을 안 넣는다', /fieldErr\(칸, t\(spec\.name\)[\s\S]{0,90}return;/.test(mf));
  T('★★ 어느 칸이 잘못됐는지 그 칸에 붙여 준다', /const 칸 = evEl\(\);/.test(mf));
}

// ── 사전
{
  const i = src.indexOf('const I18N = {'), j = src.indexOf('\n};', i);
  const en = src.slice(src.indexOf('\n  en: {', i), j);
  const ru = src.slice(src.indexOf('\n  ru: {', i), j);
  ['숫자를 넣어 주세요.', '0보다 작은 값은 넣을 수 없습니다.', '{n}까지 넣을 수 있습니다.', '기준 {v}']
    .forEach(k=>{
      T('영어 사전에 있다: ' + k, en.indexOf("'" + k + "':") > 0);
      T('러시아어 사전에 있다: ' + k, ru.indexOf("'" + k + "':") > 0);
    });
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
