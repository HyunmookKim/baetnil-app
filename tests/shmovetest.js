// 도형 옮기기·크기 조절 검증
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

globalThis.shapes = [];
globalThis.lockers = [];
globalThis.items = [];
globalThis.unlocked = true;
globalThis.dgLocked = false;
globalThis.lkLocked = false;
globalThis.saved = false;
globalThis.undoPush = ()=>{};
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
globalThis.saveLocal = ()=>{ globalThis.saved = true; };
globalThis.schedulePush = ()=>{};
globalThis.drawShapes = ()=>{};
globalThis.refreshBoxes = ()=>{};
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
{ const m = src.match(/const SHAPE_TYPES = [^;]+;/); if(m) eval(m[0].replace('const SHAPE_TYPES','globalThis.SHAPE_TYPES')); }

const need = ['lkCanEdit','shGet','shMove','shResize','shBox','shCanEdit'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const reset = ()=>{ shapes = [
  { id:'r1', t:'rect', x:20, y:30, w:20, h:10 },
  { id:'l1', t:'line', x:50, y:50, w:-20, h:10 },
  { id:'t1', t:'tri',  x:70, y:70, w:15, h:15 }
]; globalThis.saved = false; };

// ── 감싸는 사각형 (눌렀는지 판정에 쓴다)
reset();
const b1 = shBox(shGet('r1'));
T('네모의 테두리 상자', b1.x===20 && b1.y===30 && b1.w===20 && b1.h===10);
const b2 = shBox(shGet('l1'));
T('거꾸로 그은 선도 상자로 바꾼다', b2.x===30 && b2.y===50 && b2.w===20 && b2.h===10);

// ── 옮기기
reset();
shMove('r1', 5, 8);
T('도형이 옮겨진다', shGet('r1').x===25 && shGet('r1').y===38);
T('크기는 그대로', shGet('r1').w===20 && shGet('r1').h===10);
T('옮기면 저장한다', globalThis.saved===true);
T('다른 도형은 그대로', shGet('t1').x===70);

reset();
shMove('l1', -60, 0);
T('거꾸로 그은 선도 도면 밖으로 안 나간다',
  Math.min(shGet('l1').x, shGet('l1').x + shGet('l1').w) >= 0);

reset();
shMove('r1', 200, 200);
T('오른쪽 아래로도 안 넘어간다',
  shGet('r1').x + shGet('r1').w <= 100 && shGet('r1').y + shGet('r1').h <= 100);

// ── 크기
reset();
shResize('r1', 40, 25);
T('크기가 바뀐다', shGet('r1').w===40 && shGet('r1').h===25);
T('위치는 그대로', shGet('r1').x===20 && shGet('r1').y===30);

reset();
shResize('r1', 0.1, 0.1);
T('네모는 너무 작아지지 않는다', Math.abs(shGet('r1').w)>=1 && Math.abs(shGet('r1').h)>=1);

reset();
shResize('l1', -30, 0);
T('선은 한쪽만 길어도 된다', Math.abs(shGet('l1').w)>=1);

reset();
shResize('r1', 500, 500);
T('도면 밖으로 커지지 않는다',
  shGet('r1').x + shGet('r1').w <= 100 && shGet('r1').y + shGet('r1').h <= 100);

// ── 없는 도형 · 잠금
reset(); globalThis.saved = false;
T('없는 도형은 조용히 무시', shMove('없음',5,5)===null && shResize('없음',5,5)===null
  && globalThis.saved===false);
reset(); unlocked = false;
T('잠금 상태에서는 못 바꾼다',
  shMove('r1',5,5)===null && shResize('r1',5,5)===null && shGet('r1').x===20);
unlocked = true;

// ── 수납칸·물품에 영향 없음
reset();
lockers = [{id:'L1', zone:'z', label:'창고', x:1,y:1,w:5,h:5}];
items = [{id:'i1', name:'구명조끼', lockerId:'L1'}];
shMove('r1', 9, 9); shResize('r1', 30, 30);
T('도형을 바꿔도 수납칸·물품은 그대로',
  lockers.length===1 && lockers[0].x===1 && items.length===1);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
