// 정기점검 거르기 검증
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
globalThis.alert = ()=>{};
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.maint = [];
globalThis.mStatus = it => ({ days: it._d });   // 남은 일수만 흉내낸다

const need = ['maintCounts','maintFilter','maintRows'];   // 4.56 — 장비는 정비가 아니다
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
globalThis.isGear = x => !!(x && x.typ === 'gear');   // 4.56
globalThis.isMlog = x => !!(x && x.typ === 'log');   // 4.63 — 정비수첩
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const setup = ()=>{ maint = [
  { id:'a', name:'밀린 것',   _d:-5 },
  { id:'b', name:'곧',        _d:12 },
  { id:'c', name:'여유',      _d:200 },
  { id:'d', name:'미기록',    _d:null },
  { id:'e', name:'초안',      _d:null, seed:true }
]; };

setup();
const c = maintCounts();
T('밀린 것을 센다', c.late===1);
T('곧 할 것을 센다 (30일 이내)', c.soon===1);
T('미기록을 센다', c.none===2);
T('전체를 센다', c.all===5);
T('초안을 따로 센다', c.seed===1);

T('전체는 다 나온다', maintFilter('all').length===5);
T('밀림만', maintFilter('late').map(x=>x.id).join()==='a');
T('곧만', maintFilter('soon').map(x=>x.id).join()==='b');
// ★ 4.85 — 「미기록」·「초안 빼고」 두 단추를 없앴다 (사장님 지적).
//   「미기록」은 목록에 멀쩡히 있는 항목을 「기록이 없다」 고 적은 거짓말이었고,
//   「초안 빼고」는 아무도 안 쓰는 거르기였다. 갈래도 같이 지웠다.
T('없앤 거르기는 전체로 떨어진다',
  maintFilter('none').length === 5 && maintFilter('real').length === 5);
T('모르는 값은 전체로 본다', maintFilter('엉뚱').length===5);

maint = [];
T('빈 목록도 죽지 않는다', maintFilter('late').length===0 && maintCounts().all===0);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
