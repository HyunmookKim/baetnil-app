// 화면 말은 한국 앱 출처가 있어야 들어온다 (5.37)
// 사장님 (2026-10-04): 「이게 정검 목록이냐? … 도데체 내가 이걸 몇번이나 반복적으로 지적해야되냐 … 근본적인 문제부터 찾아와라」
// 근본 원인: 화면 말을 한국 앱에서 가져오지 않고 머릿속에서 만들었다. 금지어 검사는 이미 걸린 말만 잡아서
//   새로 지어낸 말은 모든 검사를 지났다.
// → 이 검사: 사전(I18N)에 새 화면 말이 생기면, tests/wordsrc.json 의 sources 에 「어느 한국 앱이 이 말을 쓰는지」 가
//   들어 있어야 지난다. (baseline = 5.37 때 이미 있던 말)
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'www', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const W = JSON.parse(fs.readFileSync(path.join(__dirname, 'wordsrc.json'), 'utf8'));
const i = src.indexOf('const I18N = {'), j = src.indexOf('\n};', i);
const blk = src.slice(i, j);
const keys = new Set();
for(const m of blk.matchAll(/^\s*'([^'\n]*[가-힣][^'\n]*)'\s*:/gm)) keys.add(m[1]);
for(const m of blk.matchAll(/^\s*"([^"\n]*[가-힣][^"\n]*)"\s*:/gm)) keys.add(m[1]);
const base = new Set(W.baseline), srcs = W.sources || {};
const 없는 = [...keys].filter(k => !base.has(k) && !(srcs[k] && String(srcs[k]).trim()));
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 400) : '')); } };
T('새 화면 말은 모두 한국 앱 출처가 있다 (wordsrc.json sources)', 없는.length === 0, 없는.join(' | '));
T('출처 칸이 빈 말이 없다', Object.values(srcs).every(v => String(v).trim().length > 1));
['점검 목록 수정','초기화 주기','날마다','주마다','수동 초기화','받아오는 중…','옮기기'].forEach(w =>
  T('사장님이 지적한 말 「' + w + '」 이 사전에 없다', !keys.has(w)));
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
