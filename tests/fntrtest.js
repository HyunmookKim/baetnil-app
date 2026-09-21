// 서버 함수(tr · trText) 의 안전장치 — 코드를 읽어서 확인한다.
//
// ★ 왜 이 검사가 있나
//   번역은 부를 때마다 돈이 나간다. 앱에서 아무 글이나 받아 옮겨 주면
//   한 사람이 긴 글을 계속 밀어 넣어 요금을 태울 수 있다.
//   그리고 이 함수는 관리자 자격으로 돌아 규칙을 거치지 않는다 —
//   남의 배 안(boats) 을 옮길 수 있게 열어 두면 번역을 통해 통째로 새어 나간다.
const fs = require('fs');
// ★ 검사 돌리개는 인자로 work.html 을 넘긴다. 이 검사가 볼 것은 서버 함수다.
const a = process.argv[2];
const FN = (!a || /\.html$/.test(a)) ? 'fn/functions/index.js' : a;
const src = fs.readFileSync(FN, 'utf8');

let pass = 0, fail = 0;
const T = (n, c, extra) => {
  if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (extra !== undefined ? ' — ' + String(extra) : '')); }
};
function grab(name){
  const i = src.indexOf("exports." + name + " = onCall(");
  if(i < 0) return '';
  let d = 0, j = src.indexOf('(', i);
  for(; j < src.length; j++){ if(src[j]==='(') d++; else if(src[j]===')'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
const tr = grab('tr'), txt = grab('trText');

// ── 1. 두 함수가 다 있다
T('글 옮기기(tr) 가 있다', !!tr);
T('글자 옮기기(trText) 가 있다', !!txt);

// ── 2. 로그인한 사람만
T('tr — 로그인 안 했으면 막는다', /req\.auth[^]{0,120}unauthenticated/.test(tr));
T('trText — 로그인 안 했으면 막는다', /req\.auth[^]{0,120}unauthenticated/.test(txt));

// ── 3. 옮길 수 있는 곳을 목록으로 못 박는다
const ok = (src.match(/const OK = \{[\s\S]*?\n\};/) || [''])[0];
T('옮길 수 있는 곳이 목록으로 적혀 있다', ok.length > 40);
T('목록에 없는 곳은 안 받는다', /const spec = OK\[coll\];[\s\S]{0,120}if \(!spec\)/.test(tr));
// ★ 여기가 핵심이다 — 남의 배 안을 열면 번역으로 통째로 새어 나간다
T('배 안(boats) 은 옮길 수 있는 곳에 없다', !/\bboats\s*:/.test(ok), ok.slice(0, 80));
T('사람(users) 도 없다', !/\busers\s*:/.test(ok));
T('신고(reports) 도 없다', !/\breports\s*:/.test(ok));
T('가입 신청(invites) 도 없다', !/\binvites\s*:/.test(ok));

// ── 4. 길이 한도
T('한 칸 길이 한도(MAX) 가 있다', /const MAX\s*=\s*\d+/.test(src));
T('댓글 한도가 셋 다 있다',
  /const CMT_ONE\s*=\s*\d+/.test(src) && /const CMT_TOTAL\s*=\s*\d+/.test(src) && /const CMT_N\s*=\s*\d+/.test(src));
T('글자 옮기기도 한 도막·도막 수·합계 한도가 있다',
  /const TXT_ONE\s*=\s*\d+/.test(src) && /const TXT_N\s*=\s*\d+/.test(src) && /const TXT_TOTAL\s*=\s*\d+/.test(src));
T('trText 가 도막 수를 센다',  /texts\.length > TXT_N/.test(txt));
T('trText 가 도막 길이를 자른다', /slice\(0, TXT_ONE\)/.test(txt));
T('trText 가 합계 길이를 센다', /total > TXT_TOTAL/.test(txt));

// ── 5. 사람마다 하루 한도
T('하루 한도(DAY_CAP) 가 있다', /const DAY_CAP\s*=\s*\d+/.test(src));
T('하루 한도를 세는 곳이 있다', /function spend\(/.test(src));
T('넘으면 막는다', /resource-exhausted/.test(src));
T('trText 가 하루 한도를 센다', /await spend\(/.test(txt));

// ── 6. 담아 둔 것이 있으면 번역을 다시 안 부른다 (값이 안 든다)
T('trText — 담아 둔 것을 먼저 본다', /const had = await cache\.get\(\)[\s\S]{0,120}if \(had\.exists\) return/.test(txt));
// ★ 순서가 중요하다. 한도를 먼저 세면, 담아 둔 것을 읽기만 해도 한도가 깎인다.
const iCache = txt.indexOf('if (had.exists) return');
const iSpend = txt.indexOf('await spend(');
T('담아 둔 것 확인이 하루 한도보다 먼저다 (읽기만 하면 한도를 안 깎는다)',
  iCache > 0 && iSpend > iCache, iCache + ' / ' + iSpend);
T('trText — 말과 글을 함께 해시한다 (말이 다르면 다른 결과다)',
  /createHash\('sha256'\)[\s\S]{0,80}lang/.test(txt));

// ── 7. 담는 곳은 함수만 손댄다
const rules = fs.existsSync('firestore_rules.txt') ? fs.readFileSync('firestore_rules.txt', 'utf8') : '';
if(rules){
  T('규칙에 앱이 trtext 를 쓰게 열어 둔 곳이 없다', !/match \/trtext/.test(rules));
  T('규칙에 앱이 trquota 를 쓰게 열어 둔 곳이 없다', !/match \/trquota/.test(rules));
  T('규칙 맨 끝이 전부 막기다', /match \/\{document=\*\*\}[\s\S]{0,80}if false/.test(rules));
} else { console.log('(규칙 파일이 없어 3개는 건너뜁니다)'); }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
