// 토막난 문장이 사전에 들어오지 못하게 막는다.
//
// ★ 왜 이 검사가 있나
//   <b> 로 한 낱말을 굵게 하려고 문장을 '앞 · 굵은말 · 뒤' 셋으로 잘라 사전에 넣은 적이 있다.
//   한국어로는 이어 붙어서 멀쩡해 보였지만, 말 차례가 다른 말로 옮기면 뜻이 통하지 않는다.
//   「입니다.」 한 조각만 사전에 있는 자리도 있었다. 그건 옮길 방법이 아예 없다.
//   고치는 법: <b> 를 열쇠 안에 넣고 통째로 옮긴다. 숫자·이름은 tsub 의 {n} 자리로 뺀다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

const DI = src.indexOf('const I18N = {');
const DE = src.indexOf('\n};\n', DI);
const blk = src.slice(DI, DE);

// 한국어 열쇠만 모은다 (ko 는 비어 있으므로 en 덩이에서 뽑는다)
const i = blk.indexOf('\n  en: {');
let d = 0, j = blk.indexOf('{', i), e = j;
for(; e < blk.length; e++){ if(blk[e] === '{') d++; else if(blk[e] === '}'){ d--; if(!d) break; } }
const seg = blk.slice(j, e);
const un = x => x.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const keys = [...seg.matchAll(/'((?:[^'\\]|\\.)*)'\s*:/g)].map(m => un(m[1]));

// ★ 예외 — 뒤에 까닭(오류 글)을 붙이는 자리다. 어느 말에서나 '…: 까닭' 으로 읽힌다.
const OK_TAIL_COLON = / $/;
// ★ 예외 — 괄호로 덧붙이는 말. 어느 말에서나 뒤에 붙어도 읽힌다.
const OK_LEAD_PAREN = /^ ?\(/;

const JOSA_HEAD = /^(은|는|이|가|을|를|에|의|와|과|도|만|로|으로|에서|부터|까지|입니다)([ .,)]|$)/;
const DANGLE_TAIL = /(하고|이며|이고|되어|하여|처럼|같이|에게|보다)$/;

let pass = 0, fail = 0;
const bad = [];
const T = (n, c) => { if(c){ pass++; } else { fail++; bad.push(n); } };

const isFrag = k => {
  // 낱글자는 글자 견본이다 (편집기의 「가」, 단위의 「만」)
  if(k.trim().length <= 1) return null;
  // '이 배' '그 사람' 처럼 꾸미는 말은 조사가 아니다 — 뒤에 빈칸+낱말이 온다
  if(/^(이|그|저) [가-힣A-Za-z0-9]/.test(k)) return null;
  // '만 14세' 의 '만' 은 나이를 세는 말이지 조사가 아니다
  if(/^만 ?[0-9]/.test(k)) return null;
  if(JOSA_HEAD.test(k)) return '조사로 시작';
  if(/^ /.test(k) && !OK_LEAD_PAREN.test(k)) return '앞이 빈칸';
  // 문장을 다 맺고 뒤에 까닭·숫자를 덧붙이는 자리는 괜찮다 — 어느 말에서나 그대로 읽힌다
  if(/ $/.test(k) && !/[.?!:] $/.test(k)) return '뒤가 빈칸';
  if(DANGLE_TAIL.test(k) && k.length > 4) return '이어지는 말로 끝';
  return null;
};

for(const k of keys){
  if(!/[가-힣]/.test(k)){ pass++; continue; }
  const why = isFrag(k);
  T((why || '') + ': ' + JSON.stringify(k.replace(/\n/g, '/').slice(0, 46)), !why);
}

// ── 사보타주 확인. 실제로 있었던 토막들이다. 이 검사가 헛것이 아님을 보인다.
const SAMPLES = ['입니다.', '를 누릅니다', '은 글과 함께 사라집니다.', '제원 ', '항해 내내 엔진을 켠 것으로 보고 '];
const caught = SAMPLES.filter(x => isFrag(x)).length;
T('견본 토막 다섯을 모두 잡는다 — ' + caught + '개', caught === SAMPLES.length);
// 멀쩡한 글은 잡지 않는다 (헛경보 확인)
const FINE = ['이 배', '바꾸지 못했습니다: ', ' (현재 위치)', '오늘', '배 등록하기'];
const wrong = FINE.filter(x => isFrag(x));
T('멀쩡한 글은 잡지 않는다' + (wrong.length ? ' — ' + JSON.stringify(wrong) : ''), !wrong.length);

bad.slice(0, 20).forEach(x => console.log('★ 실패: ' + x));
if(bad.length > 20) console.log('★ … 그리고 ' + (bad.length - 20) + '개 더');
console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
