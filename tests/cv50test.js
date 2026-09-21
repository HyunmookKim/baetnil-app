// 5.0 — 배 이력서: 제원 전부 + 계통별 요약 / 아이폰 애플 로그인 / 도면 단추
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c) => { if (c) { ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n); } };
const grab = (s, fn) => { const i = s.indexOf('function ' + fn + '('); return i < 0 ? '' : s.slice(i, i + 24000); };

// ── 안 쓰이던 제원 열두 칸 (A8)
const cd = grab(src, 'cvData');
T('이력서 자료에 제원을 전부 담는다', /specs: Object\.keys\(BOAT_SPEC\)/.test(cd));
T('적어 둔 것만 담는다', /String\(v\)\.trim\(\) === ''\) return null/.test(cd));
T('위 표에 이미 있는 넷은 빼고 담는다', /\['loa','draft','engine','fuelTank'\]/.test(cd));
T('단위를 붙여 담는다', /d\.unit \? ' ' \+ d\.unit/.test(cd));
const ch = grab(src, 'cvHtml');
T('이력서에 제원 표가 나온다', /제원몸 \? `<h2>\$\{E\(t\('제원'\)\)\}<\/h2>/.test(ch));
T('제원이 없으면 표를 안 만든다', /\$\{제원몸 \?/.test(ch));

// ── 계통별 요약 (A13)
T('계통별로 센다', /const 계통표 = \{\}/.test(ch));
T('장비 · 정비수첩 · 수리를 계통마다 센다',
  /D\.gear\.forEach/.test(ch) && /D\.mlog\.forEach/.test(ch) && /D\.repair\.forEach/.test(ch));
T('아직 안 끝난 수리를 따로 센다', /r\.status !== 'done'/.test(ch));
T('마지막 정비 날짜를 잡는다', /x\.date > o\.last/.test(ch));
T('수첩·수리에 계통이 담겨 있다', /sys: g \? gearSysOf\(g\)/.test(cd));
T('빈 계통은 줄을 안 만든다', /계통몸 \? `<h2>/.test(ch));

// ── 제원 안내가 거짓말을 안 한다
T('계산에 쓰는 것만 계산에 쓴다고 적는다', /앱이 계산에 사용하는 것은 <b>연료 탱크<\/b>/.test(src));
T('나머지는 이력서에 실린다고 적는다', /나머지 제원은 <b>배 이력서<\/b>와 배 소개에 그대로 실립니다/.test(src));
T('옛 안내(제원은 계산에 쓰입니다)는 없다', !/제원은 계산에 쓰입니다/.test(src));

// ── 아이폰 애플 로그인 (B1)
const ap = src.slice(src.indexOf('async apple(){'), src.indexOf('async apple(){') + 2500);
T('앱에서는 네이티브로 간다', /if\(isNative\(\)\)\{/.test(ap));
T('부품에게 애플 로그인을 시킨다', /fa\.signInWithApple\(\{ skipNativeAuth: true/.test(ap));
T('★ rawNonce 를 같이 넘긴다 (안 넘기면 애플이 거절한다)', /rawNonce: c\.nonce/.test(ap));
T('★ 애플이 처음 한 번만 주는 이름을 받아 둔다', /updateProfile\(fauth\.currentUser/.test(ap));
T('updateProfile 을 들여온다', /updateProfile(?:, initializeAuth, indexedDBLocalPersistence)? \} =/.test(src));
T('안 되면 조용히 웹 방식으로 내려간다', /const ap = new OAuthProvider\('apple\.com'\);/.test(ap));
T('사람이 그만둔 것은 고장으로 안 친다', /cancel\|1001/.test(ap));

// ── 도면 단추 세 개 (A12)
T("앱에 없는 class=\"btn\" 을 안 쓴다", (src.match(/<button class="btn"/g) || []).length === 0);
T('앱이 쓰는 단추(.mrbtn)로 바꿨다', /<button class="mrbtn big ok" onclick="dgPickBuiltin/.test(src));
T('셋을 세로로 같은 너비로 세운다', /\.dgpick\{display:flex;flex-direction:column/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
