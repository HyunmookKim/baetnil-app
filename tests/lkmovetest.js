// 칸 옮기기·크기 조절 검증
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
const fs = require('fs');
function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
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
globalThis.items = [];
globalThis.unlocked = true;
globalThis.dgLocked = false;
globalThis.lkLocked = false;
globalThis.saved = false;
globalThis.undoPush = ()=>{};
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
globalThis.confirm = ()=>true;
globalThis.saveLocal = ()=>{ globalThis.saved = true; };
globalThis.schedulePush = ()=>{};
globalThis.refreshBoxes = ()=>{};
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);

// ★ 붙기(스냅)에 쓰는 상수와 작은 함수는 grab 이 못 잡는다. 따로 심는다.
{ const m = src.match(/const LK_SNAP = [^;]+;/); if(m) eval(m[0].replace('const LK_SNAP','globalThis.LK_SNAP')); }
{ const m = src.match(/const lkNear = [\s\S]*?\n\};/); if(m) eval(m[0].replace('const lkNear','globalThis.lkNear')); }
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
const need = ['lkZone','lkLabel','lkMove','lkResize','lkGet','lkCanEdit','shCanEdit','lkOverlap','lkOverlapOk',
              'lkSnapLines','lkSnap'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T = (name, cond)=>{ if(cond){pass++; console.log('통과: '+name);} else {fail++; console.log('★ 실패: '+name);} };
const reset = ()=>{ lockers = [
  { id:'a', zone:'선수', label:'창고', x:10, y:10, w:20, h:10 },
  { id:'b', zone:'갤리', label:'싱크대', x:50, y:50, w:10, h:10 }
]; globalThis.saved = false; };

// ── 옮기기
reset();
lkMove('a', 30, 40);
T('칸이 옮겨진다', lkGet('a').x===30 && lkGet('a').y===40);
T('크기는 그대로', lkGet('a').w===20 && lkGet('a').h===10);
T('옮기면 저장한다', globalThis.saved===true);
T('다른 칸은 안 건드린다', lkGet('b').x===50 && lkGet('b').y===50);

reset();
lkMove('a', -50, -50);
T('왼쪽 위로 넘어가지 않는다', lkGet('a').x===0 && lkGet('a').y===0);

reset();
lkMove('a', 200, 200);
T('오른쪽 아래로 넘어가지 않는다',
  lkGet('a').x===80 && lkGet('a').y===90);   // 100 - w, 100 - h

reset();
globalThis.saved = false;
lkMove('없는칸', 10, 10);
T('없는 칸을 옮겨도 죽지 않는다', lockers.length===2 && globalThis.saved===false);

// ── 크기 조절
reset();
lkResize('a', 40, 25);
T('크기가 바뀐다', lkGet('a').w===40 && lkGet('a').h===25);
T('위치는 그대로', lkGet('a').x===10 && lkGet('a').y===10);
T('크기를 바꾸면 저장한다', globalThis.saved===true);

reset();
lkResize('a', 0.1, 0.1);
T('너무 작게 못 줄인다 (손가락으로 못 누를 만큼)',
  lkGet('a').w>=1 && lkGet('a').h>=1);

reset();
lkResize('a', 500, 500);
T('도면 밖으로 커지지 않는다',
  lkGet('a').x + lkGet('a').w <= 100 && lkGet('a').y + lkGet('a').h <= 100);

reset();
globalThis.saved = false;
lkResize('없는칸', 10, 10);
T('없는 칸 크기를 바꿔도 죽지 않는다', lockers.length===2 && globalThis.saved===false);

// ── 소수점이 지저분해지지 않는다
reset();
lkMove('a', 33.333333, 44.444444);
T('좌표가 소수 한 자리로 정리된다',
  String(lkGet('a').x).length<=5 && String(lkGet('a').y).length<=5);

// ── 안에 든 물품은 절대 건드리지 않는다
reset();
items = [{ id:'i1', name:'구명조끼', lockerId:'a' }];
lkMove('a', 5, 5); lkResize('a', 30, 30);
T('칸을 옮겨도 안의 물품은 그대로',
  items.length===1 && items[0].lockerId==='a');

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
