// 수납칸 겹침 검증 — 겹치면 어느 칸을 누른 건지 알 수 없다
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

globalThis.lockers = []; globalThis.items = []; globalThis.shapes = [];
globalThis.unlocked = true; globalThis.dgLocked = false; globalThis.lkLocked = false;
globalThis.undoPush = ()=>{}; globalThis.saveLocal = ()=>{};
globalThis.schedulePush = ()=>{}; globalThis.refreshBoxes = ()=>{}; globalThis.renderList = ()=>{};
globalThis.alerts = []; globalThis.alert = m => globalThis.alerts.push(m);
globalThis.answerYes = true;
globalThis.confirm = m => { globalThis.alerts.push(m); return globalThis.answerYes; };
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm(x));
// ★ 붙기(스냅)에 쓰는 상수와 작은 함수는 grab 이 못 잡는다. 따로 심는다.
{ const m = src.match(/const LK_SNAP = [^;]+;/); if(m) eval(m[0].replace('const LK_SNAP','globalThis.LK_SNAP')); }
{ const m = src.match(/const lkNear = [\s\S]*?\n\};/); if(m) eval(m[0].replace('const lkNear','globalThis.lkNear')); }
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }

const need = ['lkZone','lkLabel','lkCanEdit','lkGet','lkNewId','lkOverlap','lkOverlapOk','lkAdd','lkMove','lkResize',
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
const reset = ()=>{ lockers = [{ id:'a', zone:'z', label:'창고', x:20,y:20,w:20,h:20 }];
  globalThis.alerts = []; globalThis.answerYes = true; };

// 겹침 찾기
reset();
T('완전히 겹치면 찾아낸다', lkOverlap({x:20,y:20,w:20,h:20}).length===1);
T('일부만 겹쳐도 찾아낸다', lkOverlap({x:30,y:30,w:20,h:20}).length===1);
T('안 겹치면 없다', lkOverlap({x:60,y:60,w:10,h:10}).length===0);
T('모서리만 닿는 것은 겹침이 아니다', lkOverlap({x:40,y:20,w:10,h:20}).length===0);
T('자기 자신은 빼고 본다', lkOverlap({x:20,y:20,w:20,h:20}, 'a').length===0);

// 겹치게 만들면 물어본다
reset();
lkAdd({x:25,y:25,w:20,h:20}, 'z', '겹치는칸');
T('겹치면 먼저 물어본다', globalThis.alerts.some(m=>/겹/.test(m)));
T('예 하면 만들어진다', lockers.length===2);

reset(); globalThis.answerYes = false;
lkAdd({x:25,y:25,w:20,h:20}, 'z', '겹치는칸');
T('아니오 하면 안 만든다', lockers.length===1);

reset(); globalThis.answerYes = false;
lkAdd({x:60,y:60,w:10,h:10}, 'z', '안겹침');
T('안 겹치면 묻지 않는다', lockers.length===2 && !globalThis.alerts.some(m=>/겹/.test(m)));

// 옮기다 겹쳐도 물어본다
reset();
lockers.push({ id:'b', zone:'z', label:'다른칸', x:60,y:60,w:10,h:10 });
globalThis.answerYes = false;
lkMove('b', 22, 22);
T('옮기다 겹치면 되돌린다', lkGet('b').x===60 && lkGet('b').y===60);
globalThis.answerYes = true;
lkMove('b', 22, 22);
T('예 하면 옮겨진다', lkGet('b').x===22);

// 크기 키우다 겹쳐도
reset();
lockers.push({ id:'b', zone:'z', label:'다른칸', x:10,y:20,w:5,h:5 });
globalThis.answerYes = false;
lkResize('b', 40, 40);       // 10~50 으로 커지면 20~40 인 'a' 와 겹친다
T('크기 키우다 겹치면 되돌린다', lkGet('b').w===5);
globalThis.answerYes = true;
lkResize('b', 40, 40);
T('예 하면 커진다', lkGet('b').w===40);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
