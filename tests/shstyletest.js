// 도형 색·굵기 검증
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
globalThis.unlocked = true; globalThis.dgLocked = false; globalThis.lkLocked = false;
globalThis.undoPush = ()=>{}; globalThis.saveLocal = ()=>{};
globalThis.schedulePush = ()=>{}; globalThis.drawShapes = ()=>{};
globalThis.alert = ()=>{}; globalThis.confirm = ()=>true;
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.setLkLock = ()=>{}; globalThis.setDgLock = ()=>{}; globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
{ const m = src.match(/const lkRound = [^;]+;/); if(m) eval(m[0].replace('const lkRound','globalThis.lkRound')); }
{ const m = src.match(/const SHAPE_TYPES = [^;]+;/); if(m) eval(m[0].replace('const SHAPE_TYPES','globalThis.SHAPE_TYPES')); }
{ const m = src.match(/const SHAPE_STYLES = [\s\S]*?\];/); if(m) eval(m[0].replace('const SHAPE_STYLES','globalThis.SHAPE_STYLES')); }

const need = ['shCanEdit','shGet','shNewId','shAdd','shSvg','shOf','shMapOf','shStyleOf','shSetStyle'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

T('고를 수 있는 모양이 여러 가지다', Array.isArray(SHAPE_STYLES) && SHAPE_STYLES.length>=3);
T('모양마다 이름이 붙어 있다', SHAPE_STYLES.every(x=>x.id && x.name));

// 새로 그릴 때 모양이 저장된다
shapes = [];
const a = shAdd('line', {x:10,y:10,w:30,h:0}, 'plan', 'wall');
T('고른 모양이 저장된다', a.s==='wall');

// 표시 없는 옛 도형은 기본 모양
shapes = [{ id:'old', t:'line', x:1,y:1,w:10,h:0 }];
T('옛 도형은 기본 모양으로 본다', shStyleOf(shapes[0]).id === SHAPE_STYLES[0].id);

// 모르는 모양은 기본으로
shapes = [{ id:'x', t:'line', x:1,y:1,w:10,h:0, s:'없는모양' }];
T('모르는 모양은 기본으로 본다', shStyleOf(shapes[0]).id === SHAPE_STYLES[0].id);

// 그림에 색·굵기가 실린다
shapes = [{ id:'w1', t:'line', x:10,y:10,w:30,h:0, map:'plan', s:SHAPE_STYLES[1].id }];
const svg = shSvg(shOf('plan'));
T('그림에 색이 실린다', /stroke="#/.test(svg));
T('그림에 굵기가 실린다', /stroke-width="/.test(svg));
T('고른 모양의 색이 쓰인다', svg.includes(SHAPE_STYLES[1].color));

// 이미 그린 도형의 모양을 바꾼다
shapes = [{ id:'w1', t:'line', x:10,y:10,w:30,h:0, map:'plan', s:SHAPE_STYLES[0].id }];
shSetStyle('w1', SHAPE_STYLES[2].id);
T('나중에 모양을 바꿀 수 있다', shGet('w1').s === SHAPE_STYLES[2].id);
T('없는 도형은 조용히 무시', shSetStyle('없음', SHAPE_STYLES[1].id)===null);
dgLocked = true;
T('도면이 잠기면 모양도 못 바꾼다', shSetStyle('w1', SHAPE_STYLES[1].id)===null);
dgLocked = false;

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
