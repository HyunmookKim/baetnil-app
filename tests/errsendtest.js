// 오류 보내기 — 앱이 터졌을 때 운영자가 알 수 있는 길.
//
// ★ 왜 이 검사가 있나
//   남의 폰에서 앱이 터지면 그 사람은 그냥 지우고 나간다. 우리는 영영 모른다.
//   그래서 오류줄에 [이 오류 보내기] 를 달았다. 여기서 지켜야 할 것이 넷이다.
//    ① 스스로 보내지 않는다 — 오류 글에 사람이 넣은 값이 섞일 수 있다. 눌러야 간다.
//    ② 같은 오류를 두 번 보내지 않는다 — 한 오류가 되풀이되면 그만큼 문서가 쌓인다.
//    ③ 한 번 켠 동안 보낼 수 있는 수에 한도가 있다 — 오류가 쏟아져도 요금이 안 샌다.
//    ④ 오류 글을 innerHTML 로 넣지 않는다 — 무엇이 섞여 있을지 모른다. 그게 곧 구멍이다.
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
let pass = 0, fail = 0;
const T = (n, c, extra) => {
  if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (extra !== undefined ? ' — ' + String(extra) : '')); }
};

const show = grab('showErr'), send = grab('errSend'), paint = grab('errPaint'), sup = grab('sendSupport');

T('오류줄이 있다', !!show);
T('보내는 곳이 있다', !!send);
T('오류줄을 그리는 곳이 따로 있다', !!paint);

// ── ① 스스로 보내지 않는다
T('오류를 잡자마자 보내지 않는다 (showErr 이 errSend 를 안 부른다)', !/errSend\s*\(/.test(show));
T('사람이 누를 단추가 있다', /이 오류 보내기/.test(show + paint));
T('단추를 눌러야 보낸다', /onclick\s*=\s*errSend|b\.onclick\s*=\s*errSend/.test(paint));

// ── ② 같은 오류는 한 번만
T('보낸 오류를 기억한다', /ERR_SENT/.test(src));
T('이미 보낸 오류면 단추를 안 낸다', /!ERR_SENT\.has\(/.test(show));
T('보내기 전에 한 번 더 본다', /ERR_SENT\.has\(/.test(send));
T('보내면 기억에 넣는다', /ERR_SENT\.add\(/.test(send));

// ── ③ 한도
T('한 번 켠 동안의 한도가 있다', /const ERR_MAX\s*=\s*\d+/.test(src));
T('한도를 넘으면 단추를 안 낸다', /errSentN\s*<\s*ERR_MAX/.test(show));
T('보낼 때마다 센다', /errSentN\+\+|errSentN \+= 1/.test(send));
// ★ 인터넷이 없으면 눌러 봐야 안 간다. 안 되는 단추를 내놓지 않는다.
T('인터넷이 없으면 단추를 안 낸다', /onLine === false/.test(show));

// ── ④ 오류 글을 그대로 넣지 않는다
T('오류 글을 textContent 로 넣는다', /\.textContent\s*=\s*text/.test(paint));
T('오류 글을 innerHTML 로 넣지 않는다', !/innerHTML\s*=\s*[^'"`\n]*text\b/.test(paint));
// ★ 4.18 부터 오류에 '어디서 났는지'(파일·줄·스택)를 붙인다 — 그래서 300자로는 모자란다.
//   자르는 것 자체를 없애면 안 된다. 끝없는 글이 그대로 서버로 간다.
//   그래서 '자르는가' 는 그대로 두고, 얼마나 자르는지에 위 끝을 둔다.
const S = src;
const cap = (show.match(/slice\(0,\s*(\d+)\)/) || [])[1];
T('오류 글 길이를 자른다', !!cap && Number(cap) <= 1000, cap);
// 화면 줄에는 앞 한 줄만 — 스택까지 띄우면 화면을 덮는다
T('화면에는 앞 한 줄만 띄운다', /split\('\\n'\)\[0\]/.test(show), show.slice(0,0));
// 어디서 났는지가 실제로 담기는가 — 이것이 없어서 옛 오류 하나를 끝내 못 짚었다
T('오류에 파일·줄·칸을 담는다',
  /function errWhere\(/.test(S) && /e\.lineno/.test(S) && /e\.colno/.test(S) && /filename/.test(S));
T('스택도 담는다', /e\.error\s*&&\s*e\.error\.stack/.test(S));
T('오류를 잡을 때 errWhere 를 거친다', /addEventListener\('error',\s*e=>showErr\(errWhere\(e\)\)\)/.test(S));

// ── 조용히 보내기 (오류줄이 이미 상태를 보여 준다 — 알림창까지 뜨면 두 번 말하는 것)
T('sendSupport 가 조용히도 보낼 수 있다', /function sendSupport\(kind, text, quiet\)/.test(sup));
T('조용할 때는 알림창을 안 띄운다', /if\(!quiet\) tell\(/.test(sup));
T('됐는지를 돌려준다', /return true;/.test(sup) && /return false;/.test(sup));
// ★ 5.6 — 삼항(ok ?)이든 if/else 든 「답을 보고 글을 바꾸는가」 를 본다.
T('오류줄이 그 답을 보고 글을 바꾼다',
  /\bok\b/.test(send) && /보냈습니다/.test(send) && /errPaint\(/.test(send));
// ★ 5.6 — 로그인 전에는 서버 규칙에 막혀 앱으로 못 보낸다. 그때도 길이 있어야 한다.
T('★★ 앱으로 못 보내면 메일 길로 넘긴다', /supportMail\('bug'/.test(send) && /errCanApp\(\)/.test(send));
// 갈래는 '오류 신고'(bug) 로 보낸다 — 접수함에서 갈래별로 갈라 보기 위해서다
T('오류 갈래로 보낸다', /sendSupport\('bug'/.test(send));

// ── 사전이 죽어 있어도 오류줄은 떠야 한다
// ★ 사전(I18N)이 만들어지기 전에 터지면 t() 가 죽는다. 그때 오류줄까지 안 뜨면
//   무슨 일이 났는지 아무도 모른다. 실제로 사전을 스크립트 맨 앞으로 옮긴 뒤에 생긴 걱정이다.
T('사전이 죽어도 한국어 원문으로 뜬다 (errSay)', /const errSay = k => \{ try\{ return t\(k\); \}catch\(_\)\{ return k; \} \}/.test(src));
T('오류줄이 errSay 를 쓴다', /errSay\(/.test(show) && /errSay\(/.test(send));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
