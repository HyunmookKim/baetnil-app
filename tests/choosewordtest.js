// 5.17 — 「고르다」 를 화면 말에 다시 넣지 않는다 (사장님 지적 2026-09-26, 2026-08-31 에도 「고르기」 지적)
//   「여전히 고르다는 좆같은 문장이 있네」 — 항해일지 「종류」 칸의 「고르거나 직접 입력하세요」.
//   안드로이드 한국어판(시스템·설정 앱)은 「선택」 만 쓰고 「고르다」 는 한 번도 안 쓴다. 앱도 4.132 에서 「선택」 으로 정했다.
//   사용: node choosewordtest.js ../www/index.html
const fs = require('fs');
const S = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };
const L = S.split('\n');
const i = L.findIndex(l => /^  en\s*:\s*\{/.test(l)), j = L.findIndex(l => /^  ru\s*:\s*\{/.test(l));
T('영어 사전을 찾았다', i > 0 && j > i);
const keys = [];
for(const l of L.slice(i, j)) for(const m of l.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'/g)) keys.push(m[1]);
// 신고를 · 파고를 · 참고를 같은 낱말은 빼고 본다
const STEM = /골라|고른|고르거나|고르면|고르세요|고르신|고르실|고를 |고를$|골랐|고르기|고름/;
const hit = keys.filter(k => STEM.test(k.replace(/신고를|파고를|참고를|광고를|경고를|보고를|사고를|재고를|창고를/g, '')));
T('화면 말에 「고르다」 가 없다 (「선택」 으로)', hit.length === 0, hit.slice(0, 8).join(' / '));
T('항해일지 종류 칸은 「선택하거나 직접 입력하세요」', S.includes("t('선택하거나 직접 입력하세요')"));
T('함께 탄 사람이 없을 때 「아직 선택하지 않았습니다」', S.includes("'아직 선택하지 않았습니다'"));
console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad ? 1 : 0);
