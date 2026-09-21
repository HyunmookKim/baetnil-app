// 도형의 평면/측면 구분 검증
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
globalThis.unlocked = true;
globalThis.dgLocked = false;
globalThis.lkLocked = false;
globalThis.undoPush = ()=>{};
globalThis.saveLocal = ()=>{};
globalThis.schedulePush = ()=>{};
globalThis.drawShapes = ()=>{};
globalThis.alert = ()=>{};
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
{ const m = src.match(/const SHAPE_TYPES = [^;]+;/); if(m) eval(m[0].replace('const SHAPE_TYPES','globalThis.SHAPE_TYPES')); }

{ const m = src.match(/const SHAPE_STYLES = [\s\S]*?\n\];/); if(m) eval(m[0].replace('const SHAPE_STYLES','globalThis.SHAPE_STYLES')); }
const need = ['shCanEdit','shGet','shNewId','shAdd','shSvg','shOf','shMapOf','shStyleOf'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// 1. 새로 그린 도형에 어느 도면인지 적힌다
shapes = [];
const a = shAdd('rect', {x:10,y:10,w:20,h:10}, 'plan');
const b = shAdd('line', {x:10,y:50,w:30,h:0}, 'side');
T('평면도 도형에 표시가 남는다', a.map==='plan');
T('측면도 도형에 표시가 남는다', b.map==='side');

// 2. 도면별로 갈라 준다
T('평면도 도형만 골라낸다', shOf('plan').length===1 && shOf('plan')[0].id===a.id);
T('측면도 도형만 골라낸다', shOf('side').length===1 && shOf('side')[0].id===b.id);

// 3. 옛 도형(표시 없음)은 평면도로 본다 — 이미 그린 것을 잃지 않는다
shapes = [{ id:'old1', t:'rect', x:5,y:5,w:10,h:10 }];
T('표시 없는 옛 도형은 평면도로 본다', shMapOf(shapes[0])==='plan');
T('옛 도형이 평면도에 나온다', shOf('plan').length===1);
T('옛 도형이 측면도에는 안 나온다', shOf('side').length===0);

// 4. 그림도 도면별로 따로 그린다
shapes = [
  { id:'p1', t:'rect', x:10,y:10,w:20,h:10, map:'plan' },
  { id:'s1', t:'line', x:10,y:50,w:30,h:0,  map:'side' }
];
T('평면도 그림에 측면도 도형이 안 섞인다',
  /data-id="p1"/.test(shSvg(shOf('plan'))) && !/data-id="s1"/.test(shSvg(shOf('plan'))));
T('측면도 그림에 평면도 도형이 안 섞인다',
  /data-id="s1"/.test(shSvg(shOf('side'))) && !/data-id="p1"/.test(shSvg(shOf('side'))));

// 5. 도면을 바꾸면 그 도면 도형만 다룬다 (정비 화면)
shapes = [
  { id:'p1', t:'rect', x:10,y:10,w:20,h:10, map:'plan' },
  { id:'p2', t:'line', x:10,y:40,w:20,h:0,  map:'plan' },
  { id:'s1', t:'line', x:10,y:50,w:30,h:0,  map:'side' }
];
T('평면도에는 두 개', shOf('plan').length===2);
T('측면도에는 하나', shOf('side').length===1);
const added = shAdd('tri', {x:5,y:5,w:10,h:10}, 'side');
T('측면도에 그리면 측면도에만 늘어난다',
  shOf('side').length===2 && shOf('plan').length===2 && added.map==='side');

// 6. 모르는 이름을 주면 평면도로 본다
shapes = [];
const c = shAdd('rect', {x:1,y:1,w:10,h:10}, '엉뚱한값');
T('모르는 도면 이름은 평면도로 본다', c.map==='plan');

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
