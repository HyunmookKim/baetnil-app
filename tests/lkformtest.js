// 칸 이름·구역 바꾸기 검증
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
globalThis.refreshBoxes = ()=>{};
globalThis.renderList = ()=>{};
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }

const need = ['lkCanEdit','lkGet','lkRename','lkRezone','shCanEdit'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const reset = ()=>{ lockers = [{ id:'a', zone:'선수', label:'창고', x:10,y:10,w:20,h:10 }];
  items = [{id:'i1', name:'구명조끼', lockerId:'a'}]; globalThis.saved = false; };

reset();
lkRename('a', '  앵커함  ');
T('이름이 바뀐다', lkGet('a').label==='앵커함');
T('앞뒤 공백을 지운다', lkGet('a').label==='앵커함');
T('이름을 바꾸면 저장한다', globalThis.saved===true);
T('안의 물품은 그대로', items.length===1 && items[0].lockerId==='a');

reset();
T('빈 이름은 거절한다', lkRename('a','   ')===null && lkGet('a').label==='창고');
T('거절하면 저장도 안 한다', globalThis.saved===false);

reset();
lkRezone('a', ' 갤리 ');
T('구역이 바뀐다', lkGet('a').zone==='갤리');
T('구역만 바뀌고 이름은 그대로', lkGet('a').label==='창고');

reset();
T('빈 구역은 거절한다', lkRezone('a','')===null && lkGet('a').zone==='선수');

reset();
T('없는 칸은 조용히 무시', lkRename('없는칸','x')===null && lkRezone('없는칸','y')===null);

reset(); unlocked = false;
T('잠금 상태에서는 못 바꾼다',
  lkRename('a','새이름')===null && lkRezone('a','새구역')===null && lkGet('a').label==='창고');
unlocked = true;

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
