// 5.30 — 「셈하다」 를 화면 말에 다시 넣지 않는다 (사장님 2026-10-01: 「앱이 셈한 값은 도데체 어느나라 말이냐?」)
//   5.0(2026-09-15) 에 「셈하다→계산」 으로 정했는데 5.24 연료 화면에서 제가 다시 넣었다. 앱은 「계산」 을 쓴다
//   (「출발·도착 시각으로 계산」·「날씨 한계값 다시 계산」·「다리 통과를 계산하지 않습니다」).
//   사용: node semwordtest.js ../www/index.html
const fs = require('fs');
const S = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };
const L = S.split('\n');
const i = L.findIndex(l => /^  en\s*:\s*\{/.test(l)), j = L.findIndex(l => /^  ru\s*:\s*\{/.test(l));
T('영어 사전을 찾았다', i > 0 && j > i);
const keys = [];
for(const l of L.slice(i, j)) for(const m of l.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'/g)) keys.push(m[1]);
const hit = keys.filter(k => /셈한|셈했|셈합|셈하|셈을|셈으로|셈입니다|셉니다|셀 수 없/.test(k));
T('화면 말에 「셈하다」 가 없다 (「계산」 으로)', hit.length === 0, hit.slice(0, 8).join(' / '));
T('연료 화면 되돌리는 단추는 「계산값으로 되돌리기」', S.includes("t('계산값으로 되돌리기')"));
console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad ? 1 : 0);
