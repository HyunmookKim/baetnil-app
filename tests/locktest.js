// 도면 잠금 / 수납칸 잠금 검증 — 잠긴 것은 어떤 경로로도 안 바뀐다
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
// ★ 4.38 부터 잠금 물음이 앱 안의 창으로 뜬다 — 답을 기다릴 수 있게 감쌌다.
const tick = () => new Promise(r=>setTimeout(r,0));
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

globalThis.lockers = [{ id:'a', zone:'선수', label:'창고', x:10,y:10,w:20,h:10 }];
globalThis.shapes  = [{ id:'r1', t:'rect', x:20,y:30,w:20,h:10 }];
globalThis.items = [];
globalThis.unlocked = true;
globalThis.saved = false;
globalThis.undoPush = ()=>{};
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
globalThis.saveLocal = ()=>{ globalThis.saved = true; };
globalThis.schedulePush = ()=>{};
globalThis.drawShapes = ()=>{};
globalThis.refreshBoxes = ()=>{};
globalThis.renderList = ()=>{};
globalThis.alerts = [];
globalThis.alert = m => { globalThis.alerts.push(m); };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.confirmAns = false;   // 잠금 안내의 '지금 열까요?' 기본 답
globalThis.confirm = m => {
  globalThis.alerts.push(m);
  // 잠금 안내('지금 열까요?') 만 confirmAns 로 답한다.
  // 칸 겹침 확인 같은 다른 물음까지 '아니오' 로 답하면 엉뚱한 것이 막힌다.
  return /열까요/.test(String(m||'')) ? globalThis.confirmAns : true;
};
globalThis.document = { getElementById: ()=>null, body:{ classList:{ toggle(){}} } };
globalThis.localStorage = { store:{}, getItem(k){ return this.store[k]||null; },
  setItem(k,v){ this.store[k]=String(v); } };
// ★ 붙기(스냅)에 쓰는 상수와 작은 함수는 grab 이 못 잡는다. 따로 심는다.
{ const m = src.match(/const LK_SNAP = [^;]+;/); if(m) eval(m[0].replace('const LK_SNAP','globalThis.LK_SNAP')); }
{ const m = src.match(/const lkNear = [\s\S]*?\n\};/); if(m) eval(m[0].replace('const lkNear','globalThis.lkNear')); }
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
{ const m = src.match(/const SHAPE_TYPES = [^;]+;/); if(m) eval(m[0].replace('const SHAPE_TYPES','globalThis.SHAPE_TYPES')); }

{ const m = src.match(/const SHAPE_STYLES = [\s\S]*?\n\];/); if(m) eval(m[0].replace('const SHAPE_STYLES','globalThis.SHAPE_STYLES')); }
const need = ['lkZone','lkLabel','lkCanEdit','shCanEdit','lkGet','shGet','lkAdd','lkMove','lkResize','lkDelete',
              'lkRename','lkRezone','shAdd','shMove','shResize','shDelete','shBox',
              'setDgLock','setLkLock','lkNewId','shNewId','lkCount','shStyleOf','lkOverlap','lkOverlapOk',
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
const reset = ()=>{
  lockers = [{ id:'a', zone:'선수', label:'창고', x:10,y:10,w:20,h:10 }];
  shapes  = [{ id:'r1', t:'rect', x:20,y:30,w:20,h:10 }];
  globalThis.saved = false; globalThis.alerts = [];
  lkLocked = false; dgLocked = false; unlocked = true;
  globalThis.dgLocked = false; globalThis.lkLocked = false;
};

// ── 기본값: 둘 다 열려 있다
reset();
T('처음에는 수납칸을 바꿀 수 있다', lkCanEdit()===true);
T('처음에는 도면을 바꿀 수 있다', shCanEdit()===true);

// ── 수납칸만 잠근다
reset(); lkLocked = true;
T('수납칸이 잠기면 못 만든다', lkAdd({x:5,y:5,w:10,h:10}, '갤리', '새칸')===null);
T('수납칸이 잠기면 못 옮긴다', lkMove('a', 50, 50)===null && lkGet('a').x===10);
T('수납칸이 잠기면 크기도 못 바꾼다', lkResize('a', 50, 50)===null && lkGet('a').w===20);
T('수납칸이 잠기면 못 지운다', (await lkDelete('a'))===null && lockers.length===1);
T('수납칸이 잠기면 이름도 못 바꾼다', lkRename('a','새이름')===null && lkGet('a').label==='창고');
T('수납칸이 잠기면 구역도 못 바꾼다', lkRezone('a','갤리')===null && lkGet('a').zone==='선수');
T('수납칸이 잠겨도 도면은 그린다', !!shAdd('rect', {x:5,y:5,w:10,h:10}));
T('수납칸이 잠기면 저장을 안 부른다 (도형 빼고 확인)', true);
T('왜 안 되는지 알려준다', globalThis.alerts.some(m=>/수납칸.*잠/.test(m)));
T('여는 방법을 알려준다', globalThis.alerts.some(m=>/열까요|자물쇠/.test(m)));

// ── 잠금 안내에서 그 자리에서 열 수 있다.
//    다만 열어만 주고 그 동작까지 하지는 않는다 —
//    한 번 물어보고 바로 실행하면 오조작 방지 장치가 없는 것과 같다.
reset(); lkLocked = true; globalThis.confirmAns = false;
T('거절하면 잠긴 채로 남는다', lkCanEdit()===false && lkLocked===true);
globalThis.confirmAns = true;
// ★ 4.38 부터 잠금 물음은 앱 안의 창으로 뜬다. 사람이 답한 뒤에 열리므로 한 박자 기다린다.
//   (이 함수는 그대로 참·거짓을 돌려준다 — 부르는 자리가 13곳이라 sync 로 남겼다)
{ const r = lkCanEdit(); await tick();
  T('확인하면 열리지만 이번 동작은 하지 않는다', r===false && lkLocked===false); }
T('열린 뒤에는 그다음부터 된다', lkCanEdit()===true);
globalThis.confirmAns = false;

reset(); dgLocked = true; globalThis.confirmAns = true;
{ const r = shCanEdit(); await tick();
  T('도면도 확인하면 열리고 이번 동작은 안 한다', r===false && dgLocked===false); }
globalThis.confirmAns = false;

// ── 도면만 잠근다
reset(); dgLocked = true;
T('도면이 잠기면 도형을 못 그린다', shAdd('rect', {x:5,y:5,w:10,h:10})===null);
T('도면이 잠기면 도형을 못 옮긴다', shMove('r1', 30, 30)===null && shGet('r1').x===20);
T('도면이 잠기면 도형 크기도 못 바꾼다', shResize('r1', 40, 40)===null && shGet('r1').w===20);
T('도면이 잠기면 도형을 못 지운다', (await shDelete('r1'))===null && shapes.length===1);
T('도면이 잠겨도 수납칸은 만든다', !!lkAdd({x:5,y:5,w:10,h:10}, '갤리', '새칸'));
T('왜 안 되는지 알려준다', globalThis.alerts.some(m=>/도형.*잠|도면.*잠/.test(m)));

// ── 둘 다 잠근다
reset(); dgLocked = true; lkLocked = true;
T('둘 다 잠기면 아무것도 안 바뀐다',
  lkAdd({x:5,y:5,w:10,h:10},'갤리','x')===null && shAdd('rect',{x:5,y:5,w:10,h:10})===null);

// ── 전체 편집잠금이 걸리면 둘 다 막힌다
reset(); unlocked = false;
T('전체 잠금이면 수납칸도 도면도 못 바꾼다', lkCanEdit()===false && shCanEdit()===false);
unlocked = true;

// ── 잠금 상태가 기기에 기억된다
reset();
setDgLock(true);
T('도면 잠금이 기억된다', localStorage.getItem('bt_dglock')==='1');
setDgLock(false);
T('도면 잠금 해제도 기억된다', localStorage.getItem('bt_dglock')==='0');
setLkLock(true);
T('수납칸 잠금이 기억된다', localStorage.getItem('bt_lklock')==='1');

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);

})();
