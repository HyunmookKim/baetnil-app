// 되돌리기 / 다시하기 검증
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
// ★ 4.38 부터 지우기·되돌리기가 사람에게 물어보고 답을 기다린다.
//   그래서 이 검사도 통째로 기다릴 수 있게 감쌌다.
(async ()=>{
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

globalThis.lockers = [];
globalThis.shapes = [];
globalThis.items = [];
globalThis.unlocked = true;
globalThis.dgLocked = false;
globalThis.lkLocked = false;
globalThis.saved = false;
globalThis.saveLocal = ()=>{ globalThis.saved = true; };
globalThis.schedulePush = ()=>{};
globalThis.drawShapes = ()=>{};
globalThis.refreshBoxes = ()=>{};
globalThis.renderList = ()=>{};
globalThis.paintLockBtns = ()=>{};
globalThis.document = { getElementById: ()=>null };
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.confirm = ()=>true;
globalThis.setLkLock = ()=>{}; globalThis.setDgLock = ()=>{};
globalThis.localStorage = { store:{}, getItem(k){ return this.store[k]||null; }, setItem(k,v){ this.store[k]=String(v); } };
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
// 4.85 — 되돌리기가 도면도 함께 기억한다 (도면을 더하고 지울 수 있게 되었다)
globalThis.dgNames = {}; globalThis.dgImgs = {}; globalThis.dgSmall = {};
globalThis.dgRef = {};   globalThis.dgPub = {};
globalThis.applyStowDg = ()=>{}; globalThis.dgTabsPaint = ()=>{};
// ★ 붙기(스냅)에 쓰는 상수와 작은 함수는 grab 이 못 잡는다. 따로 심는다.
{ const m = src.match(/const LK_SNAP = [^;]+;/); if(m) eval(m[0].replace('const LK_SNAP','globalThis.LK_SNAP')); }
{ const m = src.match(/const lkNear = [\s\S]*?\n\};/); if(m) eval(m[0].replace('const lkNear','globalThis.lkNear')); }
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
{ const m = src.match(/const SHAPE_TYPES = [^;]+;/); if(m) eval(m[0].replace('const SHAPE_TYPES','globalThis.SHAPE_TYPES')); }
{ const m = src.match(/const UNDO_MAX = [^;]+;/); if(m) eval(m[0].replace('const UNDO_MAX','globalThis.UNDO_MAX')); }
globalThis.undoStack = [];
globalThis.redoStack = [];

{ const m = src.match(/const SHAPE_STYLES = [\s\S]*?\n\];/); if(m) eval(m[0].replace('const SHAPE_STYLES','globalThis.SHAPE_STYLES')); }
const need = ['lkZone','lkLabel','lkCanEdit','shCanEdit','lkGet','shGet','lkNewId','shNewId','lkCount','shBox',
              'undoPush','undoRun','redoRun','canUndo','canRedo','undoClear','undoSnap','undoApply',
              'lkAdd','lkMove','lkResize','lkDelete','lkRename','lkRezone',
              'shAdd','shMove','shResize','shDelete','shStyleOf','lkOverlap','lkOverlapOk',
              'lkSnapLines','lkSnap'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const reset = ()=>{ lockers = []; shapes = []; items = []; undoClear(); globalThis.saved=false; };

// ── 아무것도 안 했으면 되돌릴 게 없다
reset();
T('처음에는 되돌릴 것이 없다', canUndo()===false && canRedo()===false);
T('되돌릴 게 없으면 조용히 넘어간다', (await undoRun())===false);

// ── 칸 만들기 → 되돌리기
reset();
lkAdd({x:10,y:10,w:20,h:10}, '갤리', '싱크대 아래');
T('칸이 만들어졌다', lockers.length===1);
T('되돌릴 것이 생겼다', canUndo()===true);
await undoRun();
T('되돌리면 칸이 사라진다', lockers.length===0);
T('되돌린 뒤에는 다시하기가 가능하다', canRedo()===true);
await redoRun();
T('다시하면 칸이 돌아온다', lockers.length===1 && lockers[0].label==='싱크대 아래');

// ── 칸 지우기 → 되돌리기 (가장 중요)
reset();
lkAdd({x:10,y:10,w:20,h:10}, '갤리', '싱크대 아래');
const id = lockers[0].id;
items = [{id:'i1', name:'구명조끼', lockerId:id}];
await lkDelete(id);
T('칸이 지워졌다', lockers.length===0);
await undoRun();
T('지운 칸이 되살아난다', lockers.length===1 && lockers[0].id===id);
T('안의 물품도 그대로 붙어 있다', items.length===1 && items[0].lockerId===id);

// ── 옮기기·크기·이름
reset();
lkAdd({x:10,y:10,w:20,h:10}, '갤리', '싱크대');
const id2 = lockers[0].id;
lkMove(id2, 50, 50);
await undoRun();
T('옮긴 것을 되돌린다', lkGet(id2).x===10 && lkGet(id2).y===10);
lkResize(id2, 40, 40);
await undoRun();
T('크기 바꾼 것을 되돌린다', lkGet(id2).w===20 && lkGet(id2).h===10);
lkRename(id2, '새이름');
await undoRun();
T('이름 바꾼 것을 되돌린다', lkGet(id2).label==='싱크대');
lkRezone(id2, '선수');
await undoRun();
T('구역 바꾼 것을 되돌린다', lkGet(id2).zone==='갤리');

// ── 도형도 똑같이
reset();
shAdd('rect', {x:20,y:30,w:20,h:10});
const sid = shapes[0].id;
shMove(sid, 10, 10);
await undoRun();
T('도형 옮긴 것을 되돌린다', shGet(sid).x===20);
shDelete(sid);
T('도형이 지워졌다', shapes.length===0);
await undoRun();
T('지운 도형이 되살아난다', shapes.length===1 && shGet(sid).t==='rect');

// ── 여러 번 연속
reset();
lkAdd({x:10,y:10,w:10,h:10}, 'z', '1번');
lkAdd({x:30,y:10,w:10,h:10}, 'z', '2번');
lkAdd({x:50,y:10,w:10,h:10}, 'z', '3번');
await undoRun(); undoRun();
T('세 번 만들고 두 번 되돌리면 하나 남는다', lockers.length===1 && lockers[0].label==='1번');
await redoRun();
T('다시하면 두 개', lockers.length===2 && lockers[1].label==='2번');

// ── 새로 그리면 다시하기는 사라진다 (그림 앱과 같은 규칙)
reset();
lkAdd({x:10,y:10,w:10,h:10}, 'z', '1번');
await undoRun();
T('되돌린 상태', lockers.length===0 && canRedo()===true);
lkAdd({x:60,y:60,w:10,h:10}, 'z', '새거');
T('새로 그리면 다시하기가 사라진다', canRedo()===false);

// ── 기록이 무한정 쌓이지 않는다
reset();
for(let i=0;i<200;i++) lkAdd({x:1,y:1,w:5,h:5}, 'z', '칸'+i);
T('되돌리기 기록에 상한이 있다', typeof UNDO_MAX==='number' && UNDO_MAX>0 && UNDO_MAX<=100);

// ── 잠긴 상태에서는 되돌리기도 막는다
reset();
lkAdd({x:10,y:10,w:10,h:10}, 'z', '1번');
lkLocked = true; dgLocked = true;
await undoRun();
T('둘 다 잠기면 되돌리지 않는다', lockers.length===1);
lkLocked = false; dgLocked = false;

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);

})();
