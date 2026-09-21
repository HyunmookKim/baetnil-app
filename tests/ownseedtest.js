// 4.102 — 내 배·내 나라 값을 **남의 기본값으로 심지 않는다** (사장님이 정하신 것 14)
//
// ★ 사장님 말씀
//   「이 어플이 그냥 얀마 엔진만 쓰는 사람이 쓰는 어플이냐?」
//   「내가 지금 모든 사람이 다 쓸 수 있는 그런 범용 어플을 만들고 있는데,
//    어플을 만드는 기본 개념부터 모르고 있어서 내 정보를 가지고만 일한다.
//    지금 어플에 그냥 거기에 박아놓은 게 몇 개인지 하나하나 다 찾아내」
//
// ★ 무엇을 어겼나 — 얀마 3YM30 정기점검표의 250·1000시간을 **모든 사람의 기본 정비 항목**에
//   박아 넣었다. 볼보펜타·베타·나니·선외기 쓰는 사람에게 남의 엔진 숫자가 정비 주기로 뜬다.
//   그리고 해양경찰 122·기상콜센터 131 이 **모든 나라 사람의 기본 연락처**였다.
//   일본·러시아에서 사고가 나면 그 번호를 누른다. 목숨이 걸린 자리다.
//
// ★ 잣대 (세 갈래)
//   ① 모든 배에 참인 것 → 그대로 넣는다
//   ② 배마다·나라마다 다른 것 → **비워 두거나 그 나라 것을 준다**
//   ③ 보기로만 보여 줄 것 → 「예:」 라고 밝힌다
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '/home/claude/work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; } else { bad++;
  console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 400) : '')); } };

function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0){ i = src.indexOf('async function ' + name + '('); if(i < 0) return ''; }
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
function block(head, open, close){
  const i = src.indexOf(head);
  if(i < 0) return '';
  let d = 0, j = src.indexOf(open, i);
  for(; j < src.length; j++){ if(src[j] === open) d++; else if(src[j] === close){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}

// ── ① 엔진 주기 시간을 기본 항목에 박지 않는다
const seed = block('const MAINT_SEED', '[', ']') + block('const MAINT_BY_TYPE', '{', '}');
T('★★★ 기본 정비 항목에 엔진 가동시간 숫자가 없다 (엔진마다 다르다)',
  !/\bhrs\s*:\s*\d/.test(seed),
  (seed.match(/hrs\s*:\s*\d+/g) || []).join(', '));
T('★★ 그 대신 「설명서를 보라」 고 알려 준다', /엔진 시간」 칸에 넣으세요|엔진 설명서를 보세요/.test(seed));

// ★ 도움말에도 **숫자 보기**를 적지 않는다 — 보기로 적어도 사람은 그 값을 쓴다
// ★ 4.102 — 「?」 를 줄이면서 hrs 도움말을 cycle 안으로 합쳤다 (화면이 스스로 말하게 고쳤다).
const help = src.slice(src.indexOf('  cycle: [t('), src.indexOf('  cycle: [t(') + 1800);
T('★★★ 도움말에 시간 숫자 보기를 적지 않는다',
  !/250\s*시간|500\s*시간|1000\s*시간/.test(help), help.slice(0, 300));
T('★★★ 도움말이 「엔진마다 다르다」 고 밝힌다', /주기는 엔진마다 다릅니다/.test(help));

// ── ② 긴급 연락처는 나라마다 다르다 (★ 안전)
T('★★★ 나라별 연락처 표가 있다', /const CONTACT_BY_CC\s*=/.test(src));
const byCc = block('const CONTACT_BY_CC', '{', '}');
// ★★ 4.110 — 122 를 119 로 바꿨다.
//   한국의 해양 긴급신고 122 는 2016년 긴급신고 통합으로 119 에 합쳐졌다
//   (정책브리핑 korea.kr/news/policyNewsView.do?newsId=148906821).
//   앱이 122 를 「사고·구조 번호」 라고 알려 주면 사람이 그것을 믿는다.
T('★★★ 한국 것이 있다 (긴급신고 119)', /kr:\s*\[[\s\S]{0,400}'119'/.test(byCc), byCc.slice(0,200));
T('★★★ 122 를 그대로 알려 주지 않는다 (2016년 119 로 합쳐졌다)',
  !/kr:\s*\[[\s\S]{0,400}phone:'122'/.test(byCc), byCc.slice(0,200));
T('★★★ 일본 것이 있다 (해상보안청 118)', /jp:\s*\[[\s\S]{0,400}'118'/.test(byCc), byCc.slice(0,200));
T('★★★ 러시아 것이 있다 (단일 긴급번호 112)', /ru:\s*\[[\s\S]{0,400}'112'/.test(byCc));
const cd = grab('contactDefaults');
T('★★★ 나라를 모르면 **아무것도 안 넣는다** (틀린 번호보다 빈 칸이 낫다)',
  /CONTACT_BY_CC\[cc\] \|\| \[\]/.test(cd), cd);
T('★★★ 새 배를 만들 때 그 나라 것을 넣는다',
  /contacts = contactDefaults\(\);/.test(src) && !/contacts = deepCopy\(CONTACT_DEFAULTS\)/.test(src));

// ── ③ 약최고고조위 — 표에 없는 바다에서는 아무 곳도 안 고른다 (★ 안전)
const near = grab('wxNearestRegion');
T('★★★ 못 찾으면 「여수」 로 떨어지지 않는다', !/let best='여수'/.test(near), near.slice(0, 200));
T('★★★ 너무 멀면 빈 값을 돌려준다 (도쿄만 배가 여수 값으로 다리 높이를 재면 안 된다)',
  /HAT_NEAR_KM/.test(near) && /bd <= HAT_NEAR_KM/.test(near), near);

// ── ④ 한 나라 법 이야기는 그 나라 배에만
T('★★★ 「원거리 수상레저활동 신고」 는 한국 배에만 나온다',
  /boatCc\(\) === 'kr'\)[\s\S]{0,200}원거리 수상레저활동 신고/.test(src));
T('★★★ 점검표의 한국 전용 줄에 cc 가 적혀 있다',
  /원거리 수상레저 신고 \(해당 시\)[\s\S]{0,120}cc:'kr'/.test(src));
T('★★ 점검표를 나라로 거른다', /function checkDefaults\(\)/.test(src)
  && /!r\.cc \|\| r\.cc === cc/.test(grab('checkDefaults')));
T('★★ 새 배를 만들 때 그 나라 점검표를 넣는다',
  /checkt = checkDefaults\(\);/.test(src) && !/checkt = deepCopy\(CHECK_DEFAULTS\)/.test(src));

// ── ⑤ 화폐 단위를 「원」 으로 못 박지 않는다
T('★★★ 나라별 화폐 단위 표가 있다', /const CUR_BY_CC\s*=/.test(src));
T('★★★ 장터 값에 「원」 을 박지 않는다', !/tsub\('\{n\}원'/.test(src));
T('★★ 올릴 때 그 사람 나라 단위를 함께 담는다', /cur: curNow\(\)/.test(src));
T('★★ 옛 기록은 「원」 으로 본다 (여태 다 한국 기록이었다)',
  /return t\('원'\);\s*\/\/ 옛 기록/.test(grab('curOf')));

// ── ⑥ 나라를 가리는 문이 하나다
const bc = grab('boatCc');
T('★★★ 배가 어느 나라인지 가리는 문이 하나다', bc.length > 0 && /countryOf\(\{ lat:b\.lat, lon:b\.lon \}\)/.test(bc));
T('★★★ 모르면 빈 값이다 (짐작하지 않는다)', /return '';\s*\/\/ 모른다/.test(bc), bc);
T('★★ 나라 표에 러시아가 있다 (앱이 러시아어를 쓴다)', /k:'ru', name:'러시아'/.test(src));

// ── ⑦ 사장님 배 값이 남의 기본값으로 새지 않았나
T('★★★ 새 배에 사장님 배의 수납칸 71칸이 안 들어간다',
  /물품이 하나도 없는 새 배에는 넣지 않는다/.test(src)
  && /if\(hit === 0\) return false;/.test(grab('seedLockersIfNeeded')));
T('★★ 사장님 배 도면은 **고르는 것**이지 기본값이 아니다',
  /first45: \{ name:'베네토 퍼스트 45f5'/.test(src));

console.log('ownseedtest: ' + ok + ' 통과, ' + bad + ' 실패');
if(bad) process.exitCode = 1;
