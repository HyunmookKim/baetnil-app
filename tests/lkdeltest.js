// 칸 지우기 검증 — 핵심: 칸을 지워도 물품은 절대 지우지 않는다
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
globalThis.items = [];
globalThis.trash = [];
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
globalThis.closePanel = ()=>{};
globalThis.selected = null;
globalThis.lastAlert = '';
globalThis.lastConfirm = '';
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.confirm = m => { globalThis.lastConfirm = m; return globalThis.answerYes; };
globalThis.answerYes = true;

{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
const need = ['lkZone','lkLabel','lkCanEdit','lkGet','lkDelete','lkCount','shCanEdit'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T = (name, cond)=>{ if(cond){pass++; console.log('통과: '+name);} else {fail++; console.log('★ 실패: '+name);} };
const reset = ()=>{
  lockers = [
    { id:'a', zone:'선수', label:'창고', x:10, y:10, w:20, h:10 },
    { id:'b', zone:'갤리', label:'싱크대', x:50, y:50, w:10, h:10 }
  ];
  items = [
    { id:'i1', name:'구명조끼', lockerId:'a' },
    { id:'i2', name:'연막신호', lockerId:'a' },
    { id:'i3', name:'국자',     lockerId:'b' }
  ];
  trash = [{ id:'t1', name:'헌 로프', lockerId:'a' }];
  globalThis.saved = false; globalThis.lastAlert = ''; globalThis.lastConfirm = '';
  globalThis.answerYes = true;
};

// ── 빈 칸 지우기
reset();
items = []; trash = [];
await lkDelete('a');
T('빈 칸이 지워진다', lockers.length===1 && !lkGet('a'));
T('지우면 저장한다', globalThis.saved===true);

// ── 물품이 든 칸: 물품은 살아남는다
reset();
await lkDelete('a');
T('칸은 지워진다', !lkGet('a'));
T('안에 있던 물품이 지워지지 않는다', items.length===3);
T('물품 기록에 칸 번호가 그대로 남는다',
  items.filter(i=>i.lockerId==='a').length===2);
T('다른 칸 물품은 영향 없다', items.find(i=>i.id==='i3').lockerId==='b');
T('휴지통 물품도 지워지지 않는다', trash.length===1);

// ── 물품이 있으면 먼저 물어본다
reset();
await lkDelete('a');
T('물품이 있으면 개수를 알려준다', /2/.test(globalThis.lastConfirm));
T('물품이 남는다고 알려준다', /미배치|남습니다|남아/.test(globalThis.lastConfirm));

// ── 아니오를 고르면 아무 일도 없다
reset();
globalThis.answerYes = false;
await lkDelete('a');
T('아니오면 칸이 그대로', !!lkGet('a') && lockers.length===2);
T('아니오면 저장도 안 한다', globalThis.saved===false);

// ── 없는 칸
reset();
await lkDelete('없는칸');
T('없는 칸을 지워도 죽지 않는다', lockers.length===2 && globalThis.saved===false);

// ── 잠금
reset();
unlocked = false;
await lkDelete('a');
T('잠금 상태에서는 못 지운다', lockers.length===2 && globalThis.saved===false);
unlocked = true;

// ── 칸 안 물품 세기
reset();
T('칸 안 물품을 센다 (휴지통 포함 안 함)', lkCount('a')===2 && lkCount('b')===1);
T('없는 칸은 0개', lkCount('없는칸')===0);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);

})();
