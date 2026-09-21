// 4.101 — 어떤 말이 크게 뜨고 어떤 말이 잠깐 뜨는가 (사장님이 정하신 다섯 갈래)
//
// ★ 사장님 말씀
//   「휴지통이나 이런 것들은 확실하게 알람이 떠 가지고 크게 뜨잖아.
//    「같은 물품이 없습니다」 이거는 그냥 조그맣게 이렇게 올라오잖아.
//    너는 그거를 아예 구분을 못 하는 거 같구나」
//   그리고 「1 그렇게 / 2 물려라 / 3 그렇게 해라」 로 이렇게 정하셨다:
//
//     ① 입력칸 잘못  → 그 칸 **바로 아래 빨간 한 줄** (formErr · fieldErr)
//     ② 됐다         → 잠깐 알림 (초록)
//     ③ 실패         → 잠깐 알림 (빨강), 되돌릴 수 있으면 단추 하나
//     ④ 규칙상 못 함 → 잠깐 알림
//     ⑤ 막힘         → **큰 창** ({ big:true }) — 앱 밖에서 뭘 해야 풀리는 것
//     ③ 3초 / 단추 붙은 것·긴 글은 5초
//
// ★ 이 검사는 **글을 읽어서** 갈래가 어긋난 자리를 잡는다.
//   숫자를 박아 두지 않고 **잣대**를 둔다 — 자리가 늘어도 잣대를 지키면 통과한다.
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
// tell( ... ) 하나를 통째로 떠 온다 — 글자열 안의 괄호에 안 속게
function closeOf(s, i){
  let d = 0, q = null;
  for(let j = i; j < s.length; j++){
    const c = s[j];
    if(q){ if(c === '\\'){ j++; continue; } if(c === q) q = null; continue; }
    if(c === '\'' || c === '"' || c === '`'){ q = c; continue; }
    if(c === '(') d++;
    else if(c === ')'){ d--; if(!d) return j; }
  }
  return -1;
}
const 자리 = [];
const re = /(?<![A-Za-z0-9_$.])tell\(/g;
let m;
while((m = re.exec(src))){
  const op = m.index + m[0].length - 1;
  const cl = closeOf(src, op);
  if(cl < 0) continue;
  const inner = src.slice(op + 1, cl);
  const 줄 = src.slice(0, op).split('\n').length;
  const 글 = (inner.match(/'((?:[^'\\]|\\.)*)'/g) || []).join('').replace(/'/g, '');
  자리.push({ 줄, inner, 글, big: /big\s*:\s*true/.test(inner),
              kind: (inner.match(/kind\s*:\s*'(good|bad)'/) || [])[1] || '',
              act: /act\s*:/.test(inner) });
}

// ── ① 기본이 잠깐 알림인가 (문 하나)
const tell = grab('tell');
T('★★★ tell() 은 { big:true } 가 없으면 잠깐 알림으로 간다',
  /if\(!d\.big\) return snack\(/.test(tell), tell.slice(0, 400));
T('★★ 큰 창은 부르는 쪽이 밝힌다 (기본이 큰 창이 아니다)',
  !/if\(d\.snack\)/.test(tell));

// ── ② 시간 (사장님이 「3그렇게 해라」)
T('★★★ 짧은 알림은 3초다', /const SNACK_MS\s*=\s*3000/.test(src));
T('★★★ 단추가 붙은 것은 5초다', /const SNACK_MS_LONG\s*=\s*5000/.test(src));
const snack = grab('snack');
T('★★ 긴 글에도 5초를 준다 (3초로는 못 읽는다)', /글\.length > 40/.test(snack), snack);
T('★★ 저절로 꺼진다', /setTimeout\(snackHide/.test(snack), snack);
T('★★★ 알림 글도 사전을 지난다 (문 하나)', /const 글 = t\(String\(msg/.test(snack), snack);
T('★★★ 남의 글을 그대로 넣지 않는다 (esc)', /esc\(글\)/.test(snack), snack);
T('★★ 창을 못 만든 때에도 말은 남긴다', /console\.log\(글\)/.test(snack), snack);
T('★★ 밀어서·톡 눌러서 없앨 수 있다', /민거리 > 24 \|\| 민거리 < 8/.test(grab('snackBind')));
T('★★★ 밀 때 손가락을 붙잡는다 (알림 밖으로 나가도 뗀 것을 듣는다)',
  /setPointerCapture/.test(grab('snackBind')), grab('snackBind'));

// ── ③ ⑤ 막힘만 큰 창이다 — 큰 창에 붙은 글은 **앱 밖에서 할 일**을 알려 주는 글이어야 한다
const 큰것 = 자리.filter(x => x.big);
T('★★ 큰 창으로 뜨는 자리가 있다', 큰것.length > 0);
// ★ 잣대 — 큰 창은 **읽어야 할 글**이 있을 때만이다.
//   한 줄짜리 짧은 말을 큰 창으로 띄우면 확인을 누르는 손가락만 늘어난다.
//   (글이 붙박이 글자열이 아닌 자리는 여기서 못 재므로 건너뛴다)
큰것.forEach(x => {
  const 글 = x.글.replace(/\\n/g, '\n');
  if(!글.trim()) return;                       // cloudErrHelp(e) 처럼 만들어 내는 글
  T('★★★ 큰 창 ' + x.줄 + '줄 — 읽어야 할 만큼의 글이다 (한 줄짜리는 잠깐 알림으로)',
    글.length >= 30 || 글.indexOf('\n') >= 0, 글.slice(0, 120));
});

// ── ④ 긴 글을 잠깐 알림으로 흘려보내지 않는다 (3초에 못 읽는다)
//   ★ 잣대: 빈 줄(\n\n)로 문단이 나뉜 **안내문**은 큰 창이어야 한다.
const 흘린것 = 자리.filter(x => !x.big && /\\n\\n/.test(x.inner) && x.글.replace(/\\n/g, '').length > 60);
T('★★★ 문단이 나뉜 긴 안내문은 잠깐 알림으로 흘리지 않는다 — ' + 흘린것.length + '곳',
  흘린것.length === 0, 흘린것.map(x => x.줄 + ': ' + x.글.slice(0, 70)).join('\n   '));

// ── ⑤ 됐다·실패가 눈으로 구별되는가
const 됐다말 = /했습니다|했어요|지웠습니다|되돌렸|올렸습니다|켰습니다|껐습니다|바꿨습니다|만들었습니다|보냈습니다|받았습니다|넣었습니다|옮겼습니다|뺐습니다/;
const 실패말 = /못했습니다|못합니다|실패했|못 /;
const 안붙은실패 = 자리.filter(x => !x.big && !x.kind && 실패말.test(x.글));
T('★★★ 실패는 모두 빨강으로 뜬다 — 안 붙은 곳 ' + 안붙은실패.length,
  안붙은실패.length === 0, 안붙은실패.map(x => x.줄 + ': ' + x.글.slice(0, 60)).join('\n   '));
const 안붙은됐다 = 자리.filter(x => !x.big && !x.kind && 됐다말.test(x.글) && !실패말.test(x.글));
T('★★★ 됐다는 모두 초록으로 뜬다 — 안 붙은 곳 ' + 안붙은됐다.length,
  안붙은됐다.length === 0, 안붙은됐다.map(x => x.줄 + ': ' + x.글.slice(0, 60)).join('\n   '));

// ── ⑥ 되돌릴 수 있는 일에는 단추 하나가 붙는다 (머티리얼 — 스낵바 단추는 하나까지)
T('★★ 되돌리기 단추가 붙은 자리가 있다', 자리.some(x => x.act && /되돌리기/.test(x.inner)));
자리.filter(x => x.act).forEach(x => {
  const n = (x.inner.match(/act\s*:/g) || []).length;
  T('★★★ ' + x.줄 + '줄 — 잠깐 알림에 단추는 하나까지다', n === 1, x.inner.slice(0, 120));
});

// ── ⑦ ① 입력칸 잘못은 큰 창도 잠깐 알림도 아니다 — 칸 아래 한 줄이다
T('★★ formErr 가 있다', grab('formErr').length > 0);
T('★★ fieldErr 가 있다 (입력창을 안 쓰는 화면의 칸)', grab('fieldErr').length > 0);
T('★★★ formErr 는 false 를 돌려준다 (return formErr(...) 로 쓴다)',
  /return false;\s*\/\/ 그대로/.test(grab('formErr')) || /\n  return false;/.test(grab('formErr')));
T('★★★ 잘못을 새로 알릴 때 앞의 빨간 줄은 끈다', /formErrClear\(\);/.test(grab('formErr')));
T('★★★ 입력창을 닫을 때도 빨간 줄을 끈다', /formErrClear\(\)/.test(grab('closeForm')), grab('closeForm'));
T('★★ 그 칸으로 커서를 옮긴다', /\.focus\(\)/.test(grab('formErr')));
T('★★ 칸이 화면 밖이면 그리로 굴려 준다', /scrollIntoView/.test(grab('formErr')));
T('★★★ 칸이 없으면 그래도 말은 한다 (조용히 삼키지 않는다)',
  /if\(!el\)\{ snack\(msg\); return false; \}/.test(grab('formErr')));

// ★★★ 입력창(openForm) 의 onOk 안에서 잘못을 알릴 때 tell 을 쓰면 안 된다 —
//   고쳐야 할 칸을 창이 덮는다. 여기서 그 자리를 통째로 찾아낸다.
const 새는곳 = [];
{
  const rr = /onOk:\s*(?:async\s*)?(?:v|\(\s*v\s*\))\s*=>\s*\{/g;
  let z;
  while((z = rr.exec(src))){
    let d = 0, j = src.indexOf('{', z.index + 5);
    let e = j;
    for(; e < src.length; e++){ if(src[e] === '{') d++; else if(src[e] === '}'){ d--; if(!d) break; } }
    const body = src.slice(j, e);
    const 줄 = src.slice(0, j).split('\n').length;
    // 되지 않았다고 알리고 **그 자리에서 멈추는** tell 만 잡는다 (return false 가 뒤따르는 것)
    // ★ **칸에 적은 것이 잘못됐다**고 말하는 자리만 잡는다.
    //   「인터넷에 연결되어 있지 않습니다」 같은 것은 칸의 잘못이 아니라 잠깐 알림이 맞다.
    const 칸말 = /넣어 주세요|적어 주세요|골라 주세요|입력해 주세요|넣어주세요|고쳐 주세요|넣을 수 없습니다|적을 수 없습니다|처럼 넣어|보다 큰|이상의|사이로/;
    const t2 = /(?<![A-Za-z0-9_$.])tell\([^\n]*\);\s*return false;/g;
    let y;
    while((y = t2.exec(body))) if(칸말.test(y[0])) 새는곳.push(줄 + ': ' + y[0].slice(0, 90));
  }
}
T('★★★ 입력창 안의 잘못은 tell 이 아니라 formErr 로 알린다 — 샌 곳 ' + 새는곳.length,
  새는곳.length === 0, 새는곳.join('\n   '));

console.log('snacktest: ' + ok + ' 통과, ' + bad + ' 실패  (tell 자리 ' + 자리.length
  + ' · 큰 창 ' + 큰것.length + ' · 초록 ' + 자리.filter(x=>x.kind==='good').length
  + ' · 빨강 ' + 자리.filter(x=>x.kind==='bad').length + ')');
if(bad) process.exitCode = 1;
