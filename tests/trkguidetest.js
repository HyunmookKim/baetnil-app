// 항적을 켜기 전에 무엇을 눌러야 하는지 정확히 알려 주는가.
//
// ★ 왜 필요한가 (부품 소스를 열어 보고 알아낸 것)
//   ① 안드로이드 11부터 위치 팝업에 「항상 허용」이 아예 안 나온다.
//   ② 그런데 이 부품은 「항상 허용」을 요구하지 않는다 —
//      알림(전면 서비스)이 떠 있는 동안은 「앱 사용 중에만」으로도 화면을 꺼도 받는다.
//      진짜 신호등은 권한이 아니라 알림이다.
//   ③ 안드로이드 13+ 는 그 알림을 띄우려면 앱이 따로 허락을 받아야 한다.
//   ④ 아이폰은 「항상」 으로 올려야 한다 — 폰마다 눌러야 할 것이 다르다.
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const S = fs.readFileSync(FILE, 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,200):''));} };

function grab(name){
  const i = S.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = S.indexOf('{', i), st = j;
  for(; j < S.length; j++){
    if(S[j] === '{') d++;
    else if(S[j] === '}'){ d--; if(d === 0) break; }
  }
  return S.slice(st, j + 1);
}

// ── 1. 켜기 전에 알려 주는가
const start = grab('trkStart');
T('항적 켜기 전에 안내를 한다', /trkGuide\(\)/.test(start), start.slice(0,200));
T('안내가 먼저, 붙이기가 나중이다',
  start.indexOf('trkGuide(') >= 0 && start.indexOf('trkGuide(') < start.indexOf('trkAttach('));
T('알림 허락도 미리 청한다', /trkAskNoti\(\)/.test(start));
T('알림 허락도 붙이기 전에 청한다',
  start.indexOf('trkAskNoti(') >= 0 && start.indexOf('trkAskNoti(') < start.indexOf('trkAttach('));
// ★ 4.25 부터 trkStart 는 false 가 아니라 「왜 안 켜졌는지」 를 글자로 돌려준다.
//   사람이 그만두겠다고 한 것은 까닭이 아니므로 빈 글자를 돌려준다 (말 걸지 않는다).
T('안내를 거절하면 켜지 않는다', /if\(!await trkGuide\(\)\) return '';/.test(start));

// ── 2. 폰마다 다른 말을 한다
const gt = grab('trkGuideText');
T('폰 갈래를 가른다', /trkIsIOS\(\)/.test(gt));
T('아이폰에는 「항상 허용」 으로 올리라고 한다', /항상 허용/.test(gt));
T('안드로이드에는 「앱 사용 중에만 허용」 을 누르라고 한다', /앱 사용 중에만 허용/.test(gt));
// ★ 이것이 이 판의 핵심이다 — 없으면 사람이 그 창에서 「항상 허용」을 찾다가 헤맨다
T('안드로이드 팝업에 「항상 허용」이 안 나온다고 미리 말해 준다',
  /안드로이드가 안 보여 줍니다/.test(gt));
T('알림이 진짜 신호등이라고 말해 준다', /알림이 떠 있는 동안 기록됩니다/.test(gt));
T('알림을 지우면 멈춘다고 말해 준다', /알림을 지우면 기록이 멈춥니다/.test(gt));

// ── 3. 한 번 보고 나면 또 안 묻는다
const g = grab('trkGuide');
T('이미 본 사람에게는 또 안 묻는다', /trkGuideSeen\(\)/.test(g));
T('보고 나면 봤다고 적어 둔다', /trkGuideDone\(\)/.test(g));
T('웹에서는 아무 말도 안 한다', /if\(!isNative\(\)\) return true;/.test(g));

// ── 4. 알림 허락
const an = grab('trkAskNoti');
T('알림 허락을 청하는 문이 있다', an.length > 60);
T('이미 받았으면 또 안 묻는다', /checkPermissions\(\)/.test(an) && /granted/.test(an));
// ★ 거절해도 막지 않는다 — 막으면 아무것도 못 하게 된다
T('거절해도 항적을 막지는 않는다', !/return false/.test(an));

// ── 5. 못 받았을 때 하는 말
const er = grab('trkErr');
T('못 받으면 설정으로 데려간다', /openSettings\(\)/.test(er));
// ★ 옛 말은 「항상 허용으로 두셔야 합니다」 였다. 그건 사실이 아니다 (부품이 요구하지 않는다).
// ★ 주석에도 「항상 허용」 이야기가 있다 (왜 그게 아닌지 적어 뒀다).
//   검사는 사람이 '보는 글' 만 봐야 한다 — t('...') 안쪽만 꺼낸다.
const erSays = (er.match(/t\('((?:[^'\\]|\\.)*)'\)/g) || []).join(' ');
T('「항상 허용이어야 한다」 는 틀린 말을 안 한다', !/항상 허용/.test(erSays), erSays.slice(0,200));
T('위치 기능이 꺼졌는지부터 보라고 한다', /위치 기능이 켜져 있는지/.test(er));

// ── 6. 도는 동안 화면에 보인다
const bx = grab('trkBox');
T('항해일지에 기록 중 표시가 있다', bx.length > 80);
T('앱에서만 보인다', /isNative\(\)/.test(bx));
T('이 항해를 기록할 때만 보인다', /trkNow\.vid/.test(bx));
// ★ 4.117 — 점 개수 글은 trkCountText() 한 군데서만 정한다. 그래서 두 곳을 다 본다
//   (화면이 그 문을 부르는가 + 그 문이 진짜 점 수로 글을 짓는가).
// 주석에 적힌 이름에 속지 않도록, 주석을 걷어 내고 본다 (http:// 는 안 건드린다).
const nocmt = s => String(s||'').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
const cnt = grab('trkCountText');
T('몇 점 찍혔는지 보여 준다',
  /trkCountText\(\)/.test(nocmt(bx)) && /trkNow\.pts/.test(cnt) && /\{n\}점/.test(cnt),
  cnt.slice(0,200));
T('알림을 지우면 멈춘다고 여기에도 적어 둔다', /알림을 지우면 기록도 멈춥니다/.test(bx));
// ★ 지어낸 부호와 명령형이 다시 들어오면 잡는다.
//   상용 앱(스트라바·컴풋·올트레일즈·한국 앱 12곳)은 UI 문구에 낫표도 명령형도 안 쓴다.
T('낫표를 쓰지 않는다', bx.indexOf('「') < 0);
T('명령형을 쓰지 않는다', bx.indexOf('십시오') < 0);
T('항해일지 화면이 그것을 그린다', /\+ trkBox\(it\)/.test(S));

// ── 7. 새 말이 영어·러시아어에도 있다
['항적을 기록하려면 두 가지가 필요합니다.','기록 중','{n}점',
 '알림이 떠 있는 동안 기록됩니다. 알림을 지우면 기록도 멈춥니다.',
 '입항을 기록하면 저절로 멈추고 저장됩니다.'].forEach(k=>{
  const n = S.split("'" + k + "':").length - 1;
  T("'" + k.slice(0,20) + "' 이 영어·러시아어에 다 있다", n >= 2, n);
});

console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad?1:0);
