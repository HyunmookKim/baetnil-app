// 앱이 **저 혼자** 기록을 만들지 않는가 (4.112)
//
// ★ 왜 이 검사가 있나 — 사장님이 잡아 주셨다.
//   「전기 점검이나 뭐 이런 거 내가 몇 개 완료했다고. 버튼 누르면 이게 자동으로
//    계속 정비수첩으로 제멋대로 올라가거든. 야 이거 좀 오류인 거 같은데.
//    이거 정비수첩으로 자동으로 뭐든지 올라가는 거 못 하게 해라. 이거 내가 결정을 해야지.
//    왜 자꾸 자동으로 올라가 버리냐?」
//
//   4.111 까지 정기점검 「완료 처리」 는 **먼저 정비수첩을 만들고 나서** 물었다.
//   「적어 둘까요?」 에 아니오를 눌러도 빈 껍데기는 이미 만들어져 있었다.
//   정기점검 열 개를 완료 처리하면 빈 정비수첩 열 개가 쌓였다.
//
// ★ 규칙 — **기록은 사람이 「+」 를 눌렀을 때만 생긴다.**
//   배를 처음 만들 때 깔리는 초안(정기점검·점검표·연락처)만 예외다. 그것은 사장님이 정하신 것이다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
function grab(name){
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
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 300) : '')); } };

// ── ① 정기점검 완료 처리는 완료만 한다
const MC = grab('mrComplete');
T('①-1 완료 처리하는 자리가 있다', !!MC);
T('①-2 ★★★ 완료 처리가 정비수첩을 만들지 않는다',
  !!MC && !/mlogNew\s*\(/.test(MC), (MC || '').match(/[^\n]*mlogNew[^\n]*/) || '');
T('①-3 ★★★ 완료 처리가 정비수첩을 열지도 않는다',
  !!MC && !/openMR\('mlog'/.test(MC), (MC || '').match(/[^\n]*openMR\('mlog'[^\n]*/) || '');
T('①-4 ★★ 완료 처리가 정비수첩 이야기를 묻지도 않는다',
  !!MC && !/정비수첩/.test(MC.replace(/\/\/[^\n]*/g, '')),
  (MC || '').replace(/\/\/[^\n]*/g, '').match(/[^\n]*정비수첩[^\n]*/) || '');
T('①-5 ★ 완료 처리는 여전히 한 번 묻는다 (실수로 눌리면 안 된다)',
  !!MC && /await ask\(tsub\('"\{name\}" — 오늘\(\{d\}\) 완료 처리할까요\?'/.test(MC));   // 5.0 — 반말을 존댓말로 고침
T('①-6 ★ 마지막 한 날과 이력은 그대로 남긴다',
  !!MC && /it\.history\.unshift/.test(MC) && /it\.lastDate = today\(\)/.test(MC));
T('①-7 ★ 그때의 엔진 시간도 그대로 찍는다 (다음 주기의 기준이다)',
  !!MC && /it\.lastH = engNow\(\)/.test(MC));

// ── ② 수리 상태를 완료로 바꿔도 정비수첩이 안 생긴다
const MS = grab('mrStatus');
T('②-1 수리 상태를 바꾸는 자리가 있다', !!MS);
T('②-2 ★★★ 수리 완료가 정비수첩을 만들지 않는다',
  !!MS && !/addMlogForRepair/.test(MS), (MS || '').match(/[^\n]*addMlog[^\n]*/) || '');
T('②-3 ★★ 수리 완료가 정비수첩 이야기를 묻지도 않는다',
  !!MS && !/ask\(/.test(MS), (MS || '').match(/[^\n]*ask\([^\n]*/) || '');
T('②-4 ★ 완료로 바꾼 날짜는 그대로 찍는다',
  !!MS && /it\.doneDate = v==='done' \? today\(\) : ''/.test(MS));

// ── ③ 정비수첩을 만드는 문은 「사람이 누르는 것」 뿐이다
{
  // mlogNew 를 부르는 자리를 다 찾는다
  const 부르는곳 = [];
  // ★ 'function mlogNew(' 자기 자신은 부르는 것이 아니다 — 빼고 센다
  const re = /(?<!function\s)mlogNew\s*\(/g; let m;
  while((m = re.exec(src))){
    // 그 앞쪽에서 제일 가까운 function 이름을 찾는다
    const 앞 = src.slice(0, m.index);
    const f = 앞.match(/function\s+([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{(?![\s\S]*function\s+[A-Za-z0-9_]+\s*\()/);
    const nm = (앞.match(/function\s+([A-Za-z0-9_]+)/g) || []).pop() || '?';
    부르는곳.push(nm.replace('function ', ''));
  }
  // 허락된 자리: addMlog(사람이 「+ 정비수첩」 을 누름) · mlogMoveOld(4.63 한 번 돌고 마는 이사)
  const 허락 = ['addMlog', 'mlogMoveOld'];
  const 몰래 = 부르는곳.filter(x => 허락.indexOf(x) < 0);
  T('③-1 ★★★ 정비수첩을 만드는 자리가 「+ 정비수첩」 과 옛 자료 이사 둘뿐이다',
    몰래.length === 0, 부르는곳.join(', '));
  T('③-2 ★ 그 둘은 그대로 있다', 부르는곳.indexOf('addMlog') >= 0);
}
T('③-3 ★ 「+ 정비수첩」 단추가 정기점검 상세에 있다',
  /onclick="addMlogForItem\('\$\{it\.id\}'\)"/.test(src));
T('③-4 ★ 「+ 정비수첩」 단추가 수리 상세에도 있다',
  /onclick="addMlogForRepair\('\$\{it\.id\}'\)"/.test(src));
// 4.120 — 기록 창의 「할 일」 단추를 mrActs() 한 곳에서 정하게 바뀌었다.
// 장비 상세는 더 이상 onclick 을 직접 적지 않고 여기에 줄을 얹는다.
T('③-5 ★ 「+ 정비수첩」 단추가 장비 상세에도 있다',
  /kind === 'gear'[\s\S]{0,200}?name:'\+ 정비수첩',\s*edit:true,\s*run:\s*\(\)\s*=>\s*addMlogForGear\(it\.id\)/.test(src));

// ── ④ 빈 화면 안내가 사실과 맞는가 (거짓말을 남겨 두면 사람이 그것을 믿는다)
T('④-1 ★★ 「완료 처리를 누르면 저절로 만들어집니다」 라는 말이 없어졌다',
  src.indexOf('완료 처리」를 누르면 한 건이 저절로 만들어집니다') < 0);
// 4.132 말 전수점검에서 「정비수첩」 뒤 띄어쓰기가 붙어 「」을 로 다듬어졌다
T('④-2 ★ 대신 「+ 정비수첩」 을 누르라고 알려 준다',
  /정기점검·수리 화면의 「\+ 정비수첩」을 누르면 그 항목에 붙은 채로 시작합니다\./.test(src));

// ── ⑤ 다른 갈래도 저 혼자 만들지 않는가
{
  // 사람이 누르는 자리(add*)와 되살리기(mrRestore)·초안 깔기 말고 push 하는 데가 있는지 본다
  const 검사할것 = [
    ['maint',   /maint\.push\(/g],
    ['repair',  /repair\.push\(/g],
    ['voyage',  /voyage\.push\(/g],
    ['reviews', /reviews\.push\(/g],
    ['fuel',    /fuel\.push\(/g],
    ['vdocs',   /vdocs\.push\(/g]
  ];
  // ★ 허락된 자리 — 다 「사람이 눌러야 도는」 것들이다.
  //   addMlog·addGear·addMaintForGear·addRepairForGear·addReview·addVoyage·addPlan·addFuel·addVdoc — 「+」 단추
  //   pinNewRec   — 도면에 핀을 찍고 「여기서 새 기록」 을 누른 것
  //   gearReplace — 장비 「교체」 를 누른 것
  //   gearMakeFor — 정비·수리 기록에서 「장비 만들어 매달기」 를 누른 것
  //   mrRestore   — 휴지통에서 되살린 것
  //   mlogMoveOld — 4.63 옛 자료 이사. 한 번 돌고 그 칸을 지워서 다시는 안 돈다
  const 허락 = ['addMlog','mlogMoveOld','mrAdd','mrRestore','addGear','gearSwap','addMaintForGear',
                'addRepairForGear','addReview','addVoyage','addPlan','addFuel','addVdoc','addContact',
                'pinNewRec','gearReplace','gearMakeFor','restoreAll','importAll'];
  const 몰래 = [];
  for(const [nm, re] of 검사할것){
    re.lastIndex = 0; let m;
    while((m = re.exec(src))){
      const 앞 = src.slice(0, m.index);
      const f = (앞.match(/function\s+([A-Za-z0-9_]+)/g) || []).pop() || '?';
      const fn = f.replace('function ', '');
      if(허락.indexOf(fn) < 0) 몰래.push(nm + ' ← ' + fn);
    }
  }
  T('⑤-1 ★★ 사람이 안 누른 자리에서 기록을 만드는 데가 없다',
    몰래.length === 0, 몰래.join(' | '));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
