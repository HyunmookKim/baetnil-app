// 화면(패널) 덮기 검증
//
// 사용자가 여러 번 지적한 것:
//  1) 화면을 열면 뒤에 이전 탭이 그대로 보인다 (반쯤만 덮는다)
//  2) 오른쪽 위 '닫기' 버튼 말고 삼선 메뉴만 있으면 된다
//
// 원인: --hdrH 를 <header> 전체 높이로 쟀는데, header 안에는 머리줄뿐 아니라
//       적재표 도구줄(목록·가나다순·칸 그리기)과 검색창까지 들어 있다.
//       그래서 '전체 화면' 패널이 그 아래에서 시작해 도구줄이 뒤에 남았다.
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
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const css = src.slice(0, src.indexOf('</style>'));
const head = src.slice(src.indexOf('<header'), src.indexOf('</header>') + 9);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 머리줄 높이는 '머리줄만' 재야 한다
T('머리줄 안에 도구줄과 검색창이 들어 있다 (전제)',
  /id="stowTools"/.test(head) && /id="searchWrap"/.test(head));
T('머리줄 한 줄(.hrow)이 따로 있다', /class="hrow"/.test(head));
{
  const mh = grab(js, 'measureHeader') || '';
  T('--hdrH 는 header 전체가 아니라 머리줄 한 줄만 잰다',
    /hrow/.test(mh));
  T('header 전체 높이를 그대로 쓰지 않는다',
    !/querySelector\(\s*'header'\s*\)[\s\S]{0,200}offsetHeight/.test(mh)
    || /hrow/.test(mh));
}

// ── 2. 전체 화면은 아래 탭줄을 남긴다 (2.4 의 교훈: 나갈 길을 없애지 말 것)
{
  const full = (css.match(/#mrPanel\.full\{[^}]*\}/) || [''])[0];
  T('.full 규칙이 있다', full.length > 0);
  T('.full 이 머리줄 아래에서 시작한다', /top:\s*var\(--hdrH/.test(full));
  // padding-bottom 에도 'bottom:' 이 들어 있어 그냥 찾으면 헛것을 본다
  const bot = (full.match(/[{;]\s*bottom:\s*([^;}]+)/) || ['',''])[1].trim();
  T('.full 이 아래 탭줄을 덮지 않는다 — 나갈 길을 남긴다 (지금: bottom:' + (bot||'없음') + ')',
    !!bot && bot !== '0');
}

// ── 3. 닫기 버튼은 없애고 삼선 메뉴로 나간다
T('패널 안에 닫기 버튼이 없다',
  !/onclick="closeBoat\(\)">닫기/.test(src));
T('머리줄에 삼선 메뉴가 있다', /id="menuBtn"/.test(head) && /openDrawer\(\)/.test(head));
T('아래 탭을 누르면 열려 있던 화면이 닫힌다',
  /closeBoat\(\)/.test(grab(js, 'switchTab') || ''));
// ★ 3.12 에서 뒤집혔다.
// 예전에는 배가 없으면 어느 탭을 눌러도 배 등록으로 되돌아왔다.
// 그래서 로그인해도 아무것도 못 하는 막다른 골목이 됐다. 이제 막지 않는다.
// (배가 필요한 화면만 안내를 보여 준다 — starttest.js 가 자세히 본다)
T('배가 없다고 탭을 막지 않는다',
  !/openBoatSetup\(/.test(grab(js, 'switchTab') || ''))

// ── 4. 반쯤 덮는 패널이 남아 있지 않은가
{
  // mrPanel 을 여는 곳은 전부 full 이어야 한다
  const halves = [...js.matchAll(/([A-Za-z_$][\w$]*)\.classList\.add\('open'\)/g)]
    .map(m => m[1]);
  const bad = halves.filter(v => /^(P|_p|mrPanel)$/.test(v));
  T('mrPanel 을 반쯤만 여는 곳이 없다 — 남은 곳: ' + (bad.join(', ') || '없음'),
    bad.length === 0);
  // 2.12 부터 화면 열기는 showPanel() 한 곳으로 모았다
  T('mrPanel 을 여는 곳이 여럿이다 (전제)',
    (js.match(/showPanel\(/g) || []).length >= 15);
}

// ── 5. 화면을 열 때 높이를 다시 잰다 (도구줄이 접히면 머리줄 높이가 바뀐다)
// 높이 재기는 showPanel 안에서 한 번만 하면 된다 — 모든 화면이 거기로 지난다
T('전체 화면을 열 때 머리줄 높이를 다시 잰다',
  /measureHeader\(\)/.test(grab(js, 'showPanel') || ''));

// ── 7. '닫기' 라고 적힌 버튼이 화면에 남아 있지 않은가
//    2.8 에서 onclick="closeBoat()" 인 것만 지웠다. 같은 '닫기' 인데
//    onclick 이 다른 버튼이 아홉 개 더 남아 있었다. 글자로 찾아야 한다.
{
  const btns = [...src.matchAll(/<button[^>]*onclick="([^"]+)"[^>]*>\s*닫기\s*<\/button>/g)]
    .map(m => m[1]);
  // 작은 안내창(도움말·기준값)은 화면이 아니라 쪽지창이라 남겨 둔다
  // actClose 도 같다 — #actOv 는 tellov(쪽지창) 위에 뜨는 고르기 시트이고,
  // 맨 아래 「닫기」 는 아이폰·안드로이드 액션시트가 다 두는 그만두기 줄이다.
  const screenBtns = btns.filter(f => !/closeHelp|hatClose|actClose/.test(f));
  T('화면에 닫기 버튼이 남아 있지 않다 — 남은 것: ' + (screenBtns.join(', ') || '없음'),
    screenBtns.length === 0);
}
// 되돌아가는 버튼은 '닫기' 가 아니라 어디로 가는지 적어야 한다
T('되돌아가기 버튼은 갈 곳을 적는다', /←\s*내 배/.test(src));
// 기록 화면은 고치는 중이므로 '저장 후 닫기'
{
  const mr = grab(js, 'openMR') || '';
  T('기록 화면 버튼은 저장 후 닫기다', /저장 후 닫기/.test(mr));
  T('저장 후 닫기가 실제로 저장한다', !!grab(js, 'mrSaveClose'));
  const sc = grab(js, 'mrSaveClose') || '';
  T('저장하고 나서 닫는다', /save|schedulePush/.test(sc) && /closeMR/.test(sc));
}
T('closeMR 이 전체화면 표시도 걷어낸다',
  /remove\('full'\)|remove\('open', 'full'\)|classList\.remove\('open','full'\)/.test(grab(js, 'closeMR') || ''));

// ── 8. 물품 목록도 전체 화면
{
  const pn = (css.match(/#panel\{[^}]*\}/) || [''])[0];
  const mob = css.slice(css.indexOf('@media'));
  T('물품 목록이 반쪽짜리 높이가 아니다',
    !/#panel\{[^}]*height:\s*6[0-9]vh/.test(mob));
  T('물품 목록도 머리줄 아래에서 시작한다', /#panel\{[^}]*var\(--hdrH/.test(mob) || /var\(--hdrH/.test(pn));
}

// ── 9. 어느 버전이 돌고 있는지 알 수 있어야 한다
T('서랍에서 강제 새로고침을 할 수 있다', /forceReload\(\)/.test(src));
T('강제 새로고침이 저장된 파일을 지운다',
  /caches\.delete|caches\.keys/.test(grab(js, 'forceReload') || ''));
T('강제 새로고침이 서비스워커도 푼다',
  /unregister/.test(grab(js, 'forceReload') || ''));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
