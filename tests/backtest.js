// 나가는 길 검증 — 목록 버튼 · 뒤로가기
//
// 지적 세 가지
//  1) 보기 전용인데 '저장 후 닫기' 가 뜬다. 그리고 고치는 중에도
//     저장 안 하고 그냥 목록으로 가고 싶을 때가 있다.
//  2) 남의 배 페이지에서 '목록' 을 눌러도 아무 일도 안 일어난다.
//  3) 안드로이드에서 화면 왼쪽을 밀면 뒤로가기가 아니라 앱이 꺼진다.
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 기록 화면 버튼
{
  const mr = grab(js, 'openMR') || '';
  T('보기 전용이면 저장 버튼을 안 보여준다', /unlocked\s*$|\$\{unlocked/.test(mr) && /저장 후 닫기/.test(mr));
  // ★ 3.88 부터 사전을 거친다 — `>${esc(t('목록'))}<` 모양이다
  const LIST_BTN = /closeMR\(\)">\$\{esc\(t\('목록'\)\)\}/g;
  T('보기 전용에도 나갈 길이 있다', LIST_BTN.test(mr));
  T('고치는 중에도 그냥 목록으로 갈 수 있다',
    (mr.match(LIST_BTN) || []).length >= 2);
  T('저장 후 닫기는 고치는 중에만 나온다',
    /\$\{unlocked[\s\S]{0,200}저장 후 닫기/.test(mr));
}

// ── 2. 목록으로 돌아가기
{
  T('목록으로 돌아가는 함수가 있다', !!grab(js, 'backToExplore'));
  const bt = grab(js, 'backToExplore') || '';
  T('덮개를 먼저 닫는다 (안 닫으면 뒤에 그려도 안 보인다)', /closeBoat\(\)/.test(bt));
  T('커뮤니티 탭으로 간다', /switchTab\('community'\)/.test(bt));
  T('보던 쪽(모아보기·영업)으로 돌아간다', /exploreBiz/.test(bt) && /comSub/.test(bt));
  T('배 페이지 목록 버튼이 그 함수를 쓴다',
    /onclick="backToExplore\(\)">(목록|\$\{esc\(t\('목록'\)\)\})/.test(src));
  T('덮개 위에서 openExplore 를 바로 부르지 않는다',
    !/onclick="openExplore\(\$\{exploreBiz\}\)">목록/.test(src));
}

// ── 3. 안드로이드 뒤로가기
{
  T('뒤로가기 칸을 쌓는 함수가 있다', !!grab(js, 'navPush'));
  T('pushState 로 쌓는다', /history\.pushState/.test(grab(js, 'navPush') || ''));
  const sp = grab(js, 'showPanel') || '';
  // ★ 발자국은 screenPush 한 군데에서만 남긴다.
  //   showPanel 에서도 남기면 한 화면에 두 칸이 쌓여, 뒤로 가기를 두 번 눌러야 닫힌다.
  T('여는 곳에서는 발자국을 또 남기지 않는다', !/navPush\(/.test(sp));
  T('이미 쌓여 있으면 또 쌓지 않는다',
    /SCREEN_STACK\.indexOf\(id\) >= 0/.test(grab(js, 'screenPush') || ''));
  const of = grab(js, 'openForm') || '';
  T('입력 화면도 한 칸 쌓는다', /navPush\(/.test(of));

  // ★ 4.23 부터 「무엇을 물릴까」 판단이 popstate 안이 아니라 문 두 개로 나와 있다.
  //   브라우저 뒤로가기와 앱(안드로이드)의 뒤로가기 단추가 같은 것을 봐야 하기 때문이다.
  //   앱 단추는 popstate 로 안 온다 — 4.22 까지 그래서 앱이 통째로 꺼졌다.
  const ps = (grab(js, 'navBackKind') || '') + (grab(js, 'navDoBack') || '');
  T('뒤로가기 판단이 한 곳에 있다', ps.length > 200, ps.length);
  T('브라우저 뒤로가기가 그 문을 쓴다',
    /navDoBack\(\)/.test(js.slice(js.indexOf("addEventListener('popstate'"), js.indexOf("addEventListener('popstate'") + 200)));
  // 앱의 뒤로가기 단추도 같은 문을 쓰고, 더 물릴 것이 없을 때만 닫는다
  const nb = grab(js, 'navNativeBack') || '';
  T('앱 뒤로가기도 그 문을 쓴다', /navDoBack\(\)/.test(nb), nb.slice(0,80));
  T('앱 뒤로가기는 한 번에 안 닫는다', /navExitAt/.test(nb) && /navSayExit\(\)/.test(nb));
  T('앱일 때만 손을 붙인다', /isNative\(\)/.test(grab(js, 'navAttachNative') || ''));
  // ★ 3.60 부터는 뒤로가기가 '떠 있는 화면 중 맨 위 것' 을 닫는다.
  //   전에는 입력·내 배·물품 목록 셋만 손으로 적어 놨고, 휴지통·도움말·할 일은 빠져 있었다.
  //   그래서 물품 목록에서 왼쪽 끝을 쓸어 넘기면 앱이 통째로 닫혔다.
  T('뒤로가기가 떠 있는 화면을 닫는다', /SCREEN_STACK\.length/.test(ps) && /closeTopScreen\(\)/.test(ps));
  const cts = grab(js, 'closeTopScreen') || '';
  ['mrPanel','panel','formOv','trashView','helpOv','hatPanelOv'].forEach(id=>{
    T('뒤로가기가 ' + id + ' 도 닫는다', cts.indexOf(id + ':') >= 0);
  });
  T('화면을 열면 발자국을 남긴다 (안 남기면 앱이 닫힌다)',
    /navPush\('screen:'/.test(grab(js, 'screenPush') || ''));
  // ★ 덮개(사진·고르기·서랍)도 발자국이 있어야 뒤로 가기로 걷힌다.
  //   없으면 사진은 그대로 있고 뒤 화면만 물러난다 — 실제로 그랬다.
  T('덮개도 발자국을 남긴다', /navPush\('over:'/.test(grab(js, 'overlayPush') || ''));
  T('뒤로가기가 덮개부터 걷는다',
    /OVERLAY_STACK\.length/.test(ps) && ps.indexOf('closeTopOverlay') < ps.indexOf('closeTopScreen'));
  const cto = grab(js, 'closeTopOverlay') || '';
  // ★ 목록을 손으로 적어 두면 덮개를 하나 더 만들 때마다 검사가 깨진다.
  //   그러면 사람이 검사를 고치면서 「덮개마다 걷는 길이 있나」를 안 보게 된다.
  //   그래서 목록을 소스에서 읽어 와 그 하나하나를 본다.
  const OVL = (js.match(/const OVERLAY_IDS = \[([^\]]*)\]/) || [,''])[1]
                .split(',').map(x=>x.trim().replace(/^'|'$/g,'')).filter(Boolean);
  T('덮개 목록이 한 군데에 모여 있다',
    (js.match(/const OVERLAY_IDS = \[/g) || []).length === 1 && OVL.length >= 4);
  ['photoView','recPick','dgPick','drawerOv','tellOv'].forEach(id=>{
    T(id + ' 이 덮개 목록에 있다', OVL.indexOf(id) >= 0);
  });
  // 새 덮개를 만들 때 걷는 길을 안 만들면 또 같은 일이 생긴다
  OVL.forEach(id=>{
    T('뒤로가기가 ' + id + ' 도 걷는다', cto.indexOf(id + ':') >= 0);
  });
  T('그리기 중이면 한 걸음 물린다', /undoRun\(\)/.test(ps));
  T('마지막에는 오늘로 간다', /switchTab\('home'\)/.test(ps));
  // 닫을 것이 없을 때 또 쌓으면 영영 못 나간다
  T('오늘에서는 더 쌓지 않는다 (앱을 닫을 수 있어야 한다)',
    /curTab !== 'home'/.test(ps));
}

// ── ★ 복원 버튼은 감추지 않는다
{
  // 예전에는 보기 전용일 때 CSS 로 감췄다. 그러면 '데이터 백업' 은 보이는데
  // '백업 복원' 만 없어서 기능이 사라진 줄 안다 — 실제로 그렇게 물어보셨다.
  T('복원 버튼을 감추지 않는다', !/body\.locked #restoreBtn\{display:none\}/.test(src));
  const d = grab(js, 'drawerRestore') || '';
  T('복원 버튼이 있다', d.length > 0);
  T('무엇이 갈아 끼워지는지 알려 준다', /갈아 끼/.test(d));
  T('그러고 나서 파일을 고르게 한다', /restoreFile/.test(d));

  // ★ 잠금 판단은 한 곳에만 둔다 — 곳곳에 흩어 놓으면 또 하나를 빠뜨린다.
  //   실제로 백업 복원에서 한 번, 배 등록하기에서 또 한 번 같은 일을 겪었다.
  const ne = grab(js, 'needEdit') || '';
  T('잠금 판단이 한 곳에 있다', ne.length > 0);
  T('그 곳이 묻는다', /ask\(/.test(ne));
  T('아니라고 하면 멈춘다', /if\(!await ask\([\s\S]*?\) return;/.test(ne));
  T('그 자리에서 편집 중으로 바꿔 준다', /toggleLock\(/.test(ne));
  T('바꾼 뒤 하려던 일을 이어서 한다', /fn\(\);/.test(ne));
  T('이미 편집 중이면 그냥 한다', /if\(unlocked\)\{ fn\(\); return; \}/.test(ne));
  T('복원도 그 곳을 쓴다', /needEdit\(/.test(d));

  // ★ 감춰 놓은 버튼이 남아 있으면 또 '기능이 없다' 는 말을 듣는다
  const hidden = [...js.matchAll(/unlocked \? `<button[^`]{0,120}/g)].map(m=>m[0].slice(0,70));
  T('보기 전용에서 감춘 버튼이 없다 — ' + (hidden.join(' | ') || '없음'), hidden.length === 0);

  // 배는 여러 척 등록할 수 있어야 한다
  const fl = grab(js, 'openFleet') || '';
  T('배 목록에 등록 버튼이 있다', /배 등록하기/.test(fl));
  T('그 버튼이 늘 보인다', !/unlocked \? `<div class="mrrow"[^`]*배 등록하기/.test(fl));
  T('그 버튼도 잠금 판단을 거친다', /needEdit\([^)]*addBoat\)/.test(fl));
  T('참여 코드 버튼도 있다', /needEdit\([^)]*joinByCode\)/.test(fl));
  T('배가 여러 척일 수 있다고 알려 준다', /여러 척/.test(fl));
}


// ══════════════════════════════════════════════════════════════════════
// ★★★ 앱이 저장하는 것은 **모두** 파일 백업에 들어가야 한다 (4.114)
//
// ★ 왜 이 검사가 있나 — 사장님이 물으셨다 (2026-09-08).
//   「이번에 달력 기능 추가했는데 이것도 백업데이터에 들어가냐?」
//
//   달력은 자기 자료가 없다. 항해일지·정기점검·정비수첩·수리·문서에서 그때그때
//   만들어 그린다. 그래서 그 다섯이 백업에 있으면 달력도 그대로 돌아온다.
//
// ★ 그런데 그 물음의 진짜 무게는 여기다 — **새 기록칸을 만들 때마다
//   백업에 넣는 것을 잊으면, 사람은 그 사실을 「복원하고 나서」 안다.**
//   그때는 이미 늦다. 그래서 사람 기억이 아니라 검사가 지킨다.
//
//   규칙: saveLocal 이 저장하는 칸은 backupData 에 **다 있어야 한다.**
{
  const SL = grab(js, 'saveLocal') || '';
  const BD = grab(js, 'backupData') || '';
  T('저장하는 곳이 있다 (saveLocal)', !!SL);
  T('파일로 저장하는 곳이 있다 (backupData)', !!BD);

  // saveLocal 이 담는 칸 이름 — idbSet(bkey('xxx'), …)
  const 저장칸 = [...new Set([...SL.matchAll(/idbSet\(bkey\('([a-z]+)'\)/g)].map(m => m[1]))];
  T('★ 저장하는 칸을 열 개 넘게 찾았다 (' + 저장칸.length + '개)', 저장칸.length > 10);

  // backupData 가 담는 것 — { items:items, maint:maint, … }
  const 백업칸 = [...new Set([...BD.matchAll(/([a-zA-Z]+)\s*:\s*[a-zA-Z]/g)].map(m => m[1]))];

  // ★ dgimgs 는 dgArr() 로 담으므로 이름만 맞으면 된다
  const 빠진것 = 저장칸.filter(k => 백업칸.indexOf(k) < 0
                                 && 백업칸.indexOf(k === 'all' ? 'items' : k) < 0);
  T('★★★ 저장하는 칸이 하나도 빠짐없이 백업에 들어간다',
    빠진것.length === 0, );
  if(빠진것.length) console.log('   빠진 칸: ' + 빠진것.join(' · '));

  // 배 목록과 지금 배도 따라가야 한다 — 없으면 복원해도 어느 배 것인지 모른다
  T('★★ 배 목록도 백업에 들어간다', /\bboats\s*:\s*boats\b/.test(BD));
  T('★★ 지금 배도 백업에 들어간다', /\bboat\s*:\s*curBoat\(\)/.test(BD));

  // ── 달력이 기대는 다섯 곳이 다 백업에 있는가 (사장님 물음 그대로)
  const CI = grab(js, 'calItems') || '';
  T('달력을 만드는 곳이 있다 (calItems)', !!CI);
  T('★★★ 달력은 자기 자료를 따로 담지 않는다 (있는 기록에서 만든다)',
    !!CI && !/localStorage\.setItem|idbSet\(/.test(CI));
  const 달력밑천 = [['항해일지·예정', /voyage/], ['정기점검', /maintRows\(\)/],
                    ['정비수첩', /mlogRows\(\)/], ['수리', /\brepair\b/], ['문서', /\bvdocs\b/]];
  달력밑천.forEach(([이름, re]) => {
    T('★★ 달력이 쓰는 「' + 이름 + '」 을 달력이 읽는다', re.test(CI));
  });
  ['voyage','maint','repair','vdocs'].forEach(k =>
    T('★★★ 달력 밑천 「' + k + '」 이 백업에 들어간다',
      new RegExp('\\b' + k + '\\s*:\\s*' + k + '\\b').test(BD)));

  // ★ 4.111 에 넣은 출항 시각은 항해일지 기록의 한 칸이라 voyage 와 함께 담긴다
  T('★★ 출항 시각은 항해일지 기록의 한 칸이다 (따로 담을 것이 없다)',
    /timeOut/.test(js) && !/idbSet\(bkey\('timeout'\)/i.test(SL));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
