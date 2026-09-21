// 4.85 — 지어낸 말 잡기
//
// ★ 사장님이 여러 번 지적하신 것이다 — 「기존에 쓰던 좋은 말이 있는데
//   왜 니 멋대로 새 말을 만드냐」. 「고칠 곳」·「해 온 일」·「초안 빼고」·
//   「미기록」·「장비 만들어 매달기」 가 다 그렇게 들어갔다.
//   조심하겠다는 말로는 또 샌다. 그래서 기계가 잡게 한다.
//
// 보는 것
//  1) 화면에 나가는 한국어가 전부 사전에 있는가  (없으면 = 새로 만든 말이다)
//  2) 세 나라 말에 다 있는가                    (하나라도 빠지면 그 화면만 한국어로 남는다)
//  3) t() 를 안 거치고 화면으로 바로 나가는 한국어가 있는가
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (x === undefined ? '' : ' — ' + x)); } };
const HAN = /[가-힣]/;

// ── 사전 열쇠를 말별로 모은다
// ★ 한 줄에 여러 쌍이 들어 있는 자리가 있다 —
//   '취소':'Cancel', '확인':'OK', '닫기':'Close', …
//   줄 앞만 보면 뒤의 것들을 통째로 놓친다. 실제로 47개를 놓쳤다.
const LANG_AT = tag => { const m = new RegExp('^  ' + tag + '\\s*:\\s*\\{', 'm').exec(src);
  return m ? m.index : -1; };
function dictOf(tag){
  const order = ['ko', 'en', 'ru', 'ja'];
  const i = LANG_AT(tag);
  if(i < 0) return null;
  const next = order.slice(order.indexOf(tag) + 1).map(LANG_AT).filter(x => x > i);
  const end = next.length ? Math.min(...next) : src.indexOf('\n};', i);
  const blk = src.slice(i, end);
  const set = new Set();
  for(const m of blk.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'/g)) set.add(m[1]);
  return set;
}
const EN = dictOf('en'), RU = dictOf('ru'), JA = dictOf('ja');
T('사전 세 벌을 찾았다', !!(EN && RU && JA), EN && `en ${EN.size} · ru ${RU.size} · ja ${JA.size}`);

// ── 화면으로 나가는 한국어 모으기
// t('…') · tsub('…') · hung('…'  — hung 은 장비 화면의 묶음 제목을 옮긴다
const used = new Set();
for(const re of [/\bt\(\s*'((?:[^'\\]|\\.)*)'/g,
                 /\btsub\(\s*'((?:[^'\\]|\\.)*)'/g,
                 /\bhung\(\s*'((?:[^'\\]|\\.)*)'/g])
  for(const m of src.matchAll(re)) if(HAN.test(m[1])) used.add(m[1]);
T('화면 글자를 찾았다', used.size > 500, used.size + '개');

// ★ data-t="…" 도 화면에 나가는 글자다. 여기에 사전에 없는 말을 적으면
//   그 단추만 한국어로 남는다 — 실제로 「사용기」 단추가 그랬다.
for(const m of src.matchAll(/data-tt?="([^"]+)"/g)) if(HAN.test(m[1])) used.add(m[1]);

const 없음 = [...used].filter(k => !EN.has(k)).sort();
T('사전에 없는 말이 없다 (= 새로 지어낸 말)', 없음.length === 0,
  없음.length ? 없음.length + '개: ' + 없음.slice(0, 8).join(' / ') : '');

const 빠짐 = [...used].filter(k => EN.has(k) && (!RU.has(k) || !JA.has(k))).sort();
T('세 나라 말에 다 있다', 빠짐.length === 0,
  빠짐.length ? 빠짐.length + '개: ' + 빠짐.slice(0, 8).join(' / ') : '');

// ── 3) 옮기지 않고 바로 화면에 박은 한국어
// 「'한국어'」 가 esc(...) 안이나 innerHTML 안에 t() 없이 들어간 자리.
// 전부 잡으려 들면 잡음이 너무 많아, 실제로 사고가 났던 모양만 본다.
const 생글 = [];
for(const m of src.matchAll(/\besc\(\s*'((?:[^'\\]|\\.)*)'\s*\)/g))
  if(HAN.test(m[1])) 생글.push(m[1]);
for(const m of src.matchAll(/\bchip\(\s*'[a-z]+'\s*,\s*'((?:[^'\\]|\\.)*)'/g))
  if(HAN.test(m[1])) 생글.push(m[1]);
T('옮기지 않고 화면에 박은 한국어가 없다', 생글.length === 0,
  생글.length ? 생글.slice(0, 6).join(' / ') : '');

console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
