// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 할 일 배정 검증 — 정기점검·체크리스트에 담당자를 붙인다
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

globalThis.window = { __user:{ uid:'u1', name:'현묵' } };
globalThis.alerts = [];
globalThis.alert = m => globalThis.alerts.push(m);
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.saveLocal = ()=>{};
globalThis.save = ()=>{};
globalThis.saveMR = ()=>{};
globalThis.newId = (()=>{ let n=0; return ()=>'x'+(++n); })();
globalThis.today = () => '2026-08-10';
globalThis.fmtDate = d => d.toISOString().slice(0,10);
globalThis.engNow = () => 0;   // 엔진 시간은 검사에서 안 쓴다 (달력만 본다)
globalThis.maint = [];
globalThis.checkt = [];
globalThis.boats = [];
{ const m = src.match(/const PERMS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PERMS','globalThis.PERMS')); }
{ const m = src.match(/const PERM_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const PERM_LEVELS','globalThis.PERM_LEVELS')); }
{ const m = src.match(/const PERM_ORDER = [^;]+;/); if(m) eval(m[0].replace('const PERM_ORDER','globalThis.PERM_ORDER')); }
{ const m = src.match(/const RANK_SEED = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const RANK_SEED','globalThis.RANK_SEED')); }

const need = ['mkPerms','seedRanks','rankList','rankOf','myRank','myPos','permOf','can',
              'taskItem','assignTask','taskOwnerName','myTasks','openTasksOf','taskCount','mStatus','mHourLeft','addPeriod','addMonths'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
// ★ 앱은 화면 글자를 사전(t)을 거쳐 낸다. 한국어에서는 원문을 그대로 내주므로
//   여기서는 그대로 돌려주는 t 를 끼워 두면 검사의 뜻이 그대로 산다.
globalThis.t = x => x;
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const setup = ()=>{
  const b = { id:'b1', name:'현묵호', members:{}, memberNames:{} };
  seedRanks(b);
  const L = rankList(b);
  b.members = { u1:L[0].id, u2:L[1].id, u3:L[3].id };
  b.memberNames = { u1:'현묵', u2:'김항해', u3:'박크루' };
  boats = [b];
  globalThis.curBoat = () => b;
  maint = [
    { id:'m1', grp:'엔진', name:'엔진오일 교체', months:6, unit:'m', lastDate:'2026-01-01', history:[] },
    { id:'m2', grp:'전기', name:'배터리 점검',   months:3, unit:'m', lastDate:'2026-07-01', history:[] },
    { id:'m3', grp:'안전', name:'소화기 점검',   months:12, unit:'m', lastDate:'2026-06-01', history:[] }
  ];
  checkt = [
    { id:'kl1', typ:'list', name:'출항 전', cycle:'d' },
    { id:'c1', label:'연료 확인', list:'kl1' },
    { id:'c2', label:'빌지 확인', list:'kl1' }
  ];
  globalThis.alerts = [];
  return b;
};

// 배정
let b = setup();
assignTask('maint', 'm1', 'u3');
T('정기점검에 담당자가 붙는다', maint.find(x=>x.id==='m1').who==='u3');
assignTask('check', 'c1', 'u2');
T('체크리스트 항목에도 붙는다', checkt.find(x=>x.id==='c1').who==='u2');
T('담당자를 뗄 수 있다',
  (()=>{ assignTask('maint','m1',''); return !maint.find(x=>x.id==='m1').who; })());
T('없는 것에 배정해도 죽지 않는다', assignTask('maint','없음','u3')===null);
T('모르는 종류는 거절', assignTask('엉뚱','m1','u3')===null);
T('구성원이 아닌 사람에게는 못 맡긴다', assignTask('maint','m1','남')===null);

// 이름
b = setup();
T('담당자 이름을 찾는다', taskOwnerName(b,'u3')==='박크루');
T('담당자가 없으면 빈 것', taskOwnerName(b,'')==='');
T('모르는 사람은 안내 문구', taskOwnerName(b,'zz').length>0);

// 내 할 일
b = setup();
assignTask('maint','m1','u1');   // 기한 지남 (2026-01-01 + 6개월 = 07-01)
assignTask('maint','m2','u3');
assignTask('check','c1','u1');
const mine = myTasks(b);
T('내가 맡은 것만 나온다', mine.every(t=>t.who==='u1'));
T('정기점검과 체크리스트가 함께', mine.some(t=>t.kind==='maint') && mine.some(t=>t.kind==='check'));
T('남의 것은 안 나온다', !mine.some(t=>t.id==='m2'));
T('기한 지난 것에 표시가 있다', mine.some(t=>t.kind==='maint' && t.late===true));

// 남의 할 일 (관리자용)
b = setup();
assignTask('maint','m1','u3');
const his = openTasksOf(b,'u3');
T('특정 사람이 맡은 것을 본다', his.length===1 && his[0].id==='m1');
const free = taskCount(b,'');
T('아무도 안 맡은 것을 셀 수 있다', free.length===4);   // 정기점검 2 + 체크리스트 2
T('맡긴 것은 빠진다', !free.some(t=>t.id==='m1'));

// 권한
b = setup();
window.__user = { uid:'u3' };   // 크루 — task 는 보기만
T('크루는 할 일을 볼 수 있다', can(b,'task','view')===true);
T('크루는 배정을 못 한다', can(b,'task','write')===false);
window.__user = { uid:'u2' };   // 공동 관리자
T('공동 관리자는 배정한다', can(b,'task','write')===true);
window.__user = { uid:'u1' };

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
