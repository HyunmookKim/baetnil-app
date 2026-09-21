// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 도면 도형(선·네모·세모) 검증 — 수납칸과 완전히 별개로 저장된다
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
globalThis.confirm = ()=> globalThis.answerYes;
globalThis.answerYes = true;
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }

{ const m = src.match(/const SHAPE_TYPES = [^;]+;/); if(m) eval(m[0].replace('const SHAPE_TYPES','globalThis.SHAPE_TYPES')); }
{ const m = src.match(/const SHAPE_STYLES = [\s\S]*?\n\];/); if(m) eval(m[0].replace('const SHAPE_STYLES','globalThis.SHAPE_STYLES')); }
const need = ['lkCanEdit','shAdd','shGet','shDelete','shNewId','shSvg','shCanEdit','shStyleOf'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// 1. 세 가지 도형을 만든다
shapes = []; globalThis.saved = false;
const r = shAdd('rect', {x:10,y:10,w:20,h:15});
const l = shAdd('line', {x:30,y:40,w:25,h:-10});
const tr = shAdd('tri',  {x:50,y:60,w:18,h:12});   // t 는 사전 이름이라 못 쓴다
T('네모를 만든다', !!r && r.t==='rect' && r.w===20);
T('선을 만든다 (반대 방향도 된다)', !!l && l.t==='line' && l.h===-10);
T('세모를 만든다', !!tr && tr.t==='tri');
T('세 개가 남는다', shapes.length===3);
T('도형을 그리면 저장한다', globalThis.saved===true);

// 2. 수납칸과 섞이지 않는다
T('도형은 수납칸 목록에 안 들어간다', lockers.length===0);

// 3. id 가 겹치지 않는다
const ids = new Set(shapes.map(s=>s.id));
T('도형 id 가 겹치지 않는다', ids.size===3);

// 4. 너무 작은 것은 안 만든다
shapes = [];
T('점 찍듯 누른 것은 도형이 안 된다', shAdd('rect', {x:5,y:5,w:0.3,h:0.3})===null && shapes.length===0);
T('짧은 선도 안 된다', shAdd('line', {x:5,y:5,w:0.2,h:0.2})===null);
T('긴 선은 가로세로 한쪽만 길어도 된다', !!shAdd('line', {x:5,y:5,w:30,h:0}));

// 5. 모르는 종류는 거절
shapes = [];
T('모르는 종류는 안 만든다', shAdd('별모양', {x:5,y:5,w:20,h:20})===null);

// 6. 지우기 — 물품·수납칸에 영향 없음
shapes = [];
const a = shAdd('rect', {x:10,y:10,w:20,h:15});
lockers = [{id:'L1', zone:'z', label:'창고', x:1,y:1,w:5,h:5}];
items = [{id:'i1', name:'구명조끼', lockerId:'L1'}];
shDelete(a.id);
T('도형이 지워진다', shapes.length===0);
T('도형을 지워도 수납칸은 그대로', lockers.length===1);
T('도형을 지워도 물품은 그대로', items.length===1);

// 7. 잠금
shapes = []; unlocked = false;
T('잠금 상태에서는 도형을 못 그린다', shAdd('rect', {x:10,y:10,w:20,h:15})===null);
unlocked = true;

// 8. 화면에 그릴 SVG 를 만든다
const svg = shSvg([
  {id:'s1', t:'rect', x:10, y:20, w:30, h:15},
  {id:'s2', t:'line', x:0,  y:0,  w:50, h:50},
  {id:'s3', t:'tri',  x:60, y:60, w:20, h:20}
]);
T('네모가 그려진다', /<rect/.test(svg));
T('선이 그려진다', /<line/.test(svg));
T('세모가 그려진다', /<polygon/.test(svg));
T('세모 꼭짓점이 숫자로 나온다 (퍼센트는 안 먹는다)',
  /<polygon[^>]*points="[-0-9. ,]+"/.test(svg) && !/%/.test(svg));
T('세모가 위쪽 꼭짓점 하나 + 아래 두 점', (svg.match(/<polygon[^>]*points="([^"]*)"/)[1].split(' ').length===3));
T('도형이 없으면 빈 그림', shSvg([]).indexOf('<rect')===-1);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
