// 앱 안의 알림창 — 브라우저 창(alert/confirm)을 쓰지 않는가
//
// ★ 왜 필요한가
//   브라우저의 alert()·confirm() 은 단추 이름을 앱이 못 정한다. 명세(WHATWG HTML)가
//   버튼을 브라우저 몫으로 두고 있어서, 한국어 앱인데 CANCEL·OK 가 영어로 나온다.
//   사장님이 사진으로 잡아 주셨다.
//   구글 Material 3: "Avoid using vague terms like Done, OK, or Close."
//   애플 HIG:        "The meaning of 'OK' can be unclear."
//   그래서 앱 안에 창을 하나 만들고 부르는 자리를 전부 그리로 보낸다.
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
// 퀼(Quill)은 밖에서 가져온 덩어리다. 우리 코드만 본다.
const q = src.indexOf('!function(t,e){"object"==typeof exports');
const app = q > 0 ? src.slice(0, q) : src;

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// ── 1. 문이 있는가
for(const f of ['tell','ask','tellShow','tellNext','tellDone','tellClose'])
  T(f + ' 이 있다', !!grab(src, f));

// ── 2. 브라우저 창을 안 쓴다
T('★ 앱에 alert( 이 남아 있지 않다', (app.match(/\balert\(/g) || []).length === 0);
T('창을 못 만들 때만 브라우저 창으로 물러선다',
  /window\.alert|globalThis\.alert/.test(grab(src,'tell') || ''));

// ── 3. 단추 이름 — 영어 OK/CANCEL 이 아니고, 취소가 아니라 닫기
const askSrc  = grab(src, 'ask')  || '';
const tellSrc = grab(src, 'tell') || '';
T("확인 단추 이름이 한국어다",  /t\('확인'\)/.test(tellSrc) || /t\('확인'\)/.test(grab(src,'tellShow')||''));
T("★ 취소 쪽 기본이 '닫기' 다", /t\('닫기'\)/.test(askSrc));
T("★ 취소 쪽 기본이 '취소' 가 아니다", !/no\s*[:=]\s*t\('취소'\)/.test(askSrc));

// ── 4. 사전에 낱말이 다 있다
for(const k of ['확인','닫기'])
  T("'" + k + "' 이 영어·러시아어에 다 있다", (src.split("'" + k + "':").length - 1) >= 2);

// ── 5. 창이 화면에 있고, 뒤로 가기가 닫는다
T('창 자리가 몸통에 있다', /id="tellOv"/.test(src));
T('덮개 목록에 들어 있다', /OVERLAY_IDS = \[[^\]]*'tellOv'/.test(src));
T('★ 뒤로 가기가 이 창을 닫는다', /tellOv:\s*\(\)\s*=>/.test(src));

// ── 6. 배 위에서 누를 수 있는 크기인가 (38 × 34 아래로 내려가지 않는다)
const css = (src.match(/\.tellbtns button\{[^}]*\}/) || [''])[0];
const mh = (css.match(/min-height:(\d+)px/) || [])[1];
T('★ 단추가 38px 보다 작지 않다', mh && Number(mh) >= 38);

// ── 7. 줄 세우기 — 연달아 불러도 하나가 다른 하나를 덮지 않는다
const showSrc = grab(src, 'tellShow') || '';
T('★ 연달아 오면 줄을 세운다', /push\(/.test(showSrc) && /Promise/.test(showSrc));
T('닫을 때 다음 것을 꺼낸다', /tellNext\(\)/.test(grab(src,'tellDone') || ''));

// ── 8. 글자가 그대로 나가면 안 된다 (남이 쓴 글이 창에 들어온다)
const nx = grab(src, 'tellNext') || '';
T('★ 글자를 글자로 넣는다 (남의 글이 코드로 돌면 안 된다)',
  /mg\.textContent\s*=/.test(nx) && !/mg\.innerHTML/.test(nx));
T('제목도 글자로 넣는다', /tt\.textContent\s*=/.test(nx) && !/tt\.innerHTML/.test(nx));
// ★ 4.100 — 알림창 글도 사전을 지나게 했다 (t(String(...))). 글자로 넣는 것은 그대로다.
T('단추 이름도 글자로 넣는다', /\.textContent = t\(String\(b\.name/.test(nx));

// ── 9. 옛 이름을 되살리면 안 된다 — setupUseGPS 안의 say 와 겹친다
T('say 라는 이름을 쓰지 않았다', !/function say\(/.test(src));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
