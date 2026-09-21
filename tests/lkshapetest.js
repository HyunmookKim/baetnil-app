// 수납칸 모양 (네모·동그라미·세모) 검증
//
// 칸은 지금까지 전부 네모였다. 배 안의 실제 칸은 둥근 것도, 삼각인 것도 있다.
// 좌표(x,y,w,h)는 그대로 두고 '모양'만 더한다 — 옛 칸은 손대지 않아도 네모로 나온다.
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
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

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 모양 목록
{ const m = js.match(/const LK_SHAPES = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const LK_SHAPES', 'globalThis.LK_SHAPES')); }
T('모양 목록(LK_SHAPES)이 있다', Array.isArray(globalThis.LK_SHAPES));
if(Array.isArray(globalThis.LK_SHAPES)){
  const ids = LK_SHAPES.map(s => s.id);
  T('네모가 있다', ids.includes('rect'));
  T('동그라미가 있다', ids.includes('circ'));
  T('세모가 있다', ids.includes('tri'));
  T('모양마다 사람이 읽는 이름이 있다', LK_SHAPES.every(s => s.id && s.name));
  T('네모가 기본값(첫 번째)이다', ids[0] === 'rect');
} else { fail += 5; console.log('★ 실패: 모양 목록이 없어 5건 건너뜀'); }

// ── lkShapeOf: 값이 없거나 이상하면 네모
const need = ['lkShapeOf', 'lkSetShape'];
const missing = need.filter(f => !grab(js, f));
if(missing.length){
  console.log('★ 실패: 함수가 없습니다 — ' + missing.join(', '));
  fail += 8;
} else {
  globalThis.lockers = [];
  globalThis.saveLocal = () => {};
  globalThis.schedulePush = () => {};
  globalThis.refreshBoxes = () => { globalThis.redrawn = true; };
  globalThis.undoPush = () => { globalThis.undos = (globalThis.undos || 0) + 1; };
  globalThis.lkCanEdit = () => globalThis.canEdit !== false;
  globalThis.canEdit = true;
  globalThis.alert = () => {};
  eval('globalThis.lkShapeOf = ' + grab(js, 'lkShapeOf'));
  eval('globalThis.lkSetShape = ' + grab(js, 'lkSetShape'));

  T('모양이 없는 옛 칸은 네모', lkShapeOf({ id:'a' }) === 'rect');
  T('모르는 모양은 네모로 떨어진다', lkShapeOf({ id:'a', shape:'ufo' }) === 'rect');
  T('동그라미를 그대로 돌려준다', lkShapeOf({ id:'a', shape:'circ' }) === 'circ');
  T('칸이 없어도 죽지 않는다', lkShapeOf(null) === 'rect');

  lockers = [{ id:'L1', label:'싱크대 아래', zone:'갤리', x:1, y:1, w:10, h:10 }];
  globalThis.undos = 0;
  T('모양을 바꾼다', lkSetShape('L1', 'tri') === true && lockers[0].shape === 'tri');
  T('모양 바꾸기도 되돌릴 수 있다', globalThis.undos === 1);
  T('모르는 모양은 받지 않는다', lkSetShape('L1', 'ufo') === false && lockers[0].shape === 'tri');
  globalThis.canEdit = false;
  T('잠겨 있으면 모양을 못 바꾼다', lkSetShape('L1', 'circ') === false && lockers[0].shape === 'tri');
  globalThis.canEdit = true;
}

// ── 화면에 실제로 반영되는가
const bb = grab(js, 'buildBoxes') || '';
T('칸을 그릴 때 모양을 반영한다', /lkShapeOf/.test(bb));
T('모양이 바뀌면 다시 그린다 (lockerKey 에 모양이 들어간다)',
  /shape|lkShapeOf/.test(grab(js, 'lockerKey') || ''));
T('CSS 에 동그라미가 있다', /\.s-circ\s*\{[^}]*border-radius:\s*50%/.test(css));
T('CSS 에 세모가 있다', /\.s-tri\s*\{[^}]*clip-path:\s*polygon/.test(css));

// ── 고치기 화면에서 눌러 고를 수 있는가 (배 위에서 숫자·prompt 금지)
const menu = grab(js, 'lkMenu') || '';
T('칸 고치기 화면에 모양 고르기가 있다', /type\s*:\s*'pick'/.test(menu) && /shape/.test(menu));
T('모양을 눌러서 고른다 (prompt 안 씀)', !/prompt\(/.test(menu));
T('저장할 때 모양도 함께 저장한다', /lkSetShape/.test(menu));

// ── 백업·클라우드로 나가는가 (칸은 통째로 저장되므로 모양도 따라간다)
T('칸은 통째로 저장돼 모양도 함께 나간다',
  /snapOf\(lockers\)|curL = snapOf\(lockers\)/.test(js));

// ── 이름이 뭘 가리키는지 알 수 있어야 한다
// '칸' 만 적으면 수납칸인지 뭔지 알 수 없다는 지적.
{
  const head = src.slice(src.indexOf('<header'), src.indexOf('</header>') + 9);
  T('잠금 버튼이 수납칸이라고 적는다', /id="lkLockBtn"[^>]*>\s*수납칸/.test(head));
  T('잠금 버튼이 도형이라고 적는다', /id="dgLockBtn"[^>]*>\s*도형/.test(head));
  const pl = grab(js, 'paintLockBtns') || '';
  T('눌렀다 뗄 때도 이름이 그대로다', /수납칸/.test(pl) && /도형/.test(pl));
}

// ── 도구 막대가 좁은 화면에서 글자가 세로로 쪼개지지 않는다
{
  const css = src.slice(0, src.indexOf('</style>'));
  const st = (css.match(/#stowTools[^{]*\{[^}]*\}/) || [''])[0];
  T('도구 막대가 줄바꿈 대신 옆으로 밀린다',
    /overflow-x:\s*auto/.test(st) && /nowrap/.test(st));
  T('도구 막대 버튼이 찌그러지지 않는다', /#stowTools[^{]*button[^{]*\{[^}]*flex:\s*(none|0 0 auto)/.test(css));
}

// ── 기존 칸을 눌러 고칠 수 있다는 안내
{
  const te = grab(js, 'toggleLkEdit') || '';
  T('그리기 모드 안내에 모양 바꾸기가 적혀 있다', /모양/.test(te));
}

// ── 크기도 눌러서 바꾼다 (배 위에서 모서리 끌기는 어렵다)
{
  const menu = grab(js, 'lkMenu') || '';
  // /size/ 만 보면 onOk 의 v.size 에 걸려 헛통과한다. 항목 자체를 본다.
  T('칸 고치기에 크기 고르기가 있다', /key\s*:\s*'size'/.test(menu));
  T('크기도 눌러서 고른다', /type\s*:\s*'pick'/.test(menu));
  T('크기 바꾸는 함수가 있다', !!grab(js, 'lkScale'));
  if(grab(js, 'lkScale')){
    eval('globalThis.lkScale = ' + grab(js, 'lkScale'));
    globalThis.lockers = [{ id:'S1', zone:'z', label:'a', x:20, y:20, w:10, h:10 }];
    globalThis.lkOverlapOk = () => true;
    T('크게 하면 커진다', lkScale('S1', 1.2) === true && lockers[0].w > 10);
    globalThis.lockers = [{ id:'S1', zone:'z', label:'a', x:20, y:20, w:10, h:10 }];
    T('작게 하면 작아진다', lkScale('S1', 0.8) === true && lockers[0].w < 10);
    globalThis.lockers = [{ id:'S1', zone:'z', label:'a', x:20, y:20, w:10, h:10 }];
    T('가운데는 그대로 둔다 (제자리에서 커진다)',
      lkScale('S1', 1.2) === true
      && Math.abs((lockers[0].x + lockers[0].w/2) - 25) < 0.6);
    globalThis.lockers = [{ id:'S1', zone:'z', label:'a', x:20, y:20, w:10, h:10 }];
    T('너무 작아지지는 않는다', lkScale('S1', 0.01) === false || lockers[0].w >= 1);
  } else { fail += 4; console.log('★ 실패: lkScale 이 없어 4건 건너뜀'); }
}

// ── 기존 수납칸을 눌러 고칠 수 있는가 (도구가 무엇이든)
//    2.11 까지: 도구가 선·네모·세모면 수납칸을 눌러도 도형 그리기로 넘어가
//    수납칸 확인 자체를 건너뛰었다. 그래서 '눌러도 안 바뀐다' 였다.
{
  const i = src.indexOf("map.addEventListener('pointerdown'");
  const down = src.slice(i, i + 2600);
  const boxAt   = down.indexOf(".closest('.box')");
  const shapeAt = down.indexOf("mode:'shape'");
  T('누른 곳에 수납칸이 있는지 먼저 본다',
    boxAt >= 0 && shapeAt >= 0 && boxAt < shapeAt);
  T('도구가 수납칸일 때만 보지 않는다',
    !/if\(lkTool !== 'locker'\)\{[\s\S]{0,200}?mode:'shape'[\s\S]{0,400}?closest\('\.box'\)/.test(down));
  T('수납칸을 눌렀으면 도형 그리기로 넘어가지 않는다',
    /수납칸을 먼저|칸이 먼저|먼저 본다/.test(down));
}
// 그리기 모드에서 수납칸이 도형 아래 깔리면 누를 수가 없다
T('그리기 모드에서 수납칸이 도형보다 위에 있다',
  /#map\.lkedit \.box\{[^}]*z-index:\s*[2-9]/.test(css));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
