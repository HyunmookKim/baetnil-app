// 칸 그리기(3단계-1) 검증
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
globalThis.unlocked = true;
globalThis.dgLocked = false;
globalThis.lkLocked = false;
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
const need = ['lkRect','lkNewId','lkAdd','lkCanEdit','shCanEdit','lkOverlap','lkOverlapOk',
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

// 1. 드래그 방향과 상관없이 같은 사각형
const a = lkRect(30, 40, 10, 20), b = lkRect(10, 20, 30, 40);
T('거꾸로 끌어도 같은 사각형', a.x===10 && a.y===20 && a.w===20 && a.h===20
  && JSON.stringify(a)===JSON.stringify(b));

// 2. 도면 밖으로 나가지 않는다
const c = lkRect(-30, -10, 150, 120);
T('도면 밖은 잘라낸다', c.x===0 && c.y===0 && c.w===100 && c.h===100);

// 3. 새 id 는 기존 칸과 겹치지 않는다
lockers = [{id:'lk1', zone:'선수', label:'창고', x:1,y:1,w:5,h:5}];
const ids = new Set();
for(let i=0;i<50;i++){ const id = lkNewId(); ids.add(id); lockers.push({id, zone:'z', label:'l', x:0,y:0,w:1,h:1}); }
T('새 칸 id 가 겹치지 않는다', ids.size===50 && !ids.has('lk1'));

// 4. 칸 하나 추가
lockers = [];
globalThis.saved = false;
const made = lkAdd({x:10,y:20,w:8,h:6}, '선수', '앵커함');
T('그린 칸이 목록에 들어간다', !!made && lockers.length===1
  && lockers[0].zone==='선수' && lockers[0].label==='앵커함'
  && lockers[0].x===10 && lockers[0].w===8);
T('칸을 그리면 저장한다', globalThis.saved===true);

// 5. 너무 작으면 만들지 않는다 (손가락 툭 친 것)
lockers = [];
const tiny = lkAdd({x:10,y:20,w:0.4,h:0.4}, '선수', '앵커함');
T('너무 작으면 칸을 만들지 않는다', tiny===null && lockers.length===0);

// 6. 이름이 비면 만들지 않는다
lockers = [];
T('이름이 비면 만들지 않는다',
  lkAdd({x:10,y:20,w:8,h:6}, '선수', '   ')===null && lockers.length===0);

// 7. 구역이 비면 만들지 않는다
lockers = [];
T('구역이 비면 만들지 않는다',
  lkAdd({x:10,y:20,w:8,h:6}, '', '앵커함')===null && lockers.length===0);

// 8. 잠금 상태에서는 편집할 수 없다
unlocked = false;
globalThis.lastAlert = '';
T('잠금 상태에서는 칸을 못 그린다', lkCanEdit()===false && /잠금/.test(globalThis.lastAlert||''));
unlocked = true;
T('열린 상태에서는 칸을 그릴 수 있다', lkCanEdit()===true);

// 9. 기존 칸을 건드리지 않는다
lockers = [{id:'bow', zone:'선수', label:'창고', x:43,y:5.5,w:14,h:3.5}];
lkAdd({x:10,y:20,w:8,h:6}, '갤리', '싱크대 아래');
T('새 칸을 더해도 원래 칸은 그대로',
  lockers.length===2 && lockers[0].id==='bow' && lockers[0].x===43);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
