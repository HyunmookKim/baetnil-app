// 회원 명부 검증 — 회비·출입 주기·부재·메모
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

globalThis.window = { __user:{ uid:'u1', name:'현묵' } };
globalThis.alerts = [];
globalThis.alert = m => globalThis.alerts.push(m);
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.confirm = ()=>true;
globalThis.saveLocal = ()=>{};
globalThis.newId = (()=>{ let n=0; return ()=>'x'+(++n); })();
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
globalThis.today = () => '2026-08-10';
{ const m = src.match(/const PERMS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PERMS','globalThis.PERMS')); }
{ const m = src.match(/const PERM_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const PERM_LEVELS','globalThis.PERM_LEVELS')); }
{ const m = src.match(/const PERM_ORDER = [^;]+;/); if(m) eval(m[0].replace('const PERM_ORDER','globalThis.PERM_ORDER')); }
{ const m = src.match(/const RANK_SEED = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const RANK_SEED','globalThis.RANK_SEED')); }
{ const m = src.match(/const DUES_CYCLES = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const DUES_CYCLES','globalThis.DUES_CYCLES')); }
{ const m = src.match(/const CYCLE_MONTHS = [^;]+;/); if(m) eval(m[0].replace('const CYCLE_MONTHS','globalThis.CYCLE_MONTHS')); }

const need = ['mkPerms','seedRanks','rankList','rankOf','myRank','myPos','permOf','can','canTouchMember',
              'rosterOf','setRoster','duesDue','nextDueDate','isAway','rosterAlerts','payDues','dropDues',
              'dParts','dStr','addDay'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const boat = () => {
  const b = { id:'b1', name:'현묵호', members:{}, memberNames:{}, roster:{} };
  seedRanks(b);
  const L = rankList(b);
  b.members = { u1:L[0].id, u2:L[1].id, u3:L[3].id };
  b.memberNames = { u1:'현묵', u2:'김항해', u3:'박크루' };
  return b;
};

// 회비 주기
T('회비 주기가 여러 가지', Array.isArray(DUES_CYCLES) && DUES_CYCLES.length>=3);
T('주기마다 이름이 있다', DUES_CYCLES.every(c=>('v' in c) && c.name));

// 빈 명부
let b = boat();
const r = rosterOf(b, 'u3');
T('명부가 없어도 빈 것을 준다', !!r && typeof r === 'object');
T('빈 명부에는 회비 주기가 없다', !r.duesCycle);

// 적기
b = boat();
setRoster(b, 'u3', { duesCycle:'m', duesFrom:'2026-01-15',
                     visitNote:'한 달에 한 번', memo:'낚시 담당' });
T('명부를 적는다', rosterOf(b,'u3').duesCycle==='m');
T('메모가 남는다', rosterOf(b,'u3').memo==='낚시 담당');
T('오는 주기 메모가 남는다', rosterOf(b,'u3').visitNote==='한 달에 한 번');
T('구성원이 아니면 못 적는다', setRoster(b,'없는사람',{memo:'x'})===null);

// 다음 납부일
T('월 단위 다음 납부일', nextDueDate('2026-01-15','m','2026-08-10')==='2026-08-15');
T('이미 지난 달이면 다음 달로', nextDueDate('2026-01-15','m','2026-08-20')==='2026-09-15');
T('연 단위', nextDueDate('2026-03-01','y','2026-08-10')==='2027-03-01');
T('주기가 없으면 없음', nextDueDate('2026-01-15','','2026-08-10')===null);

// 밀린 회비
b = boat();
setRoster(b,'u3',{ duesCycle:'m', duesFrom:'2026-06-15' });
T('안 냈으면 밀린 것으로 본다', duesDue(b,'u3','2026-08-10')===true);
payDues(b,'u3','2026-08-05');
T('내면 기록이 쌓인다', (rosterOf(b,'u3').pays||[]).length===1);
// ★ 3.82 — 얼마를 냈는지는 안 담는다. 돈거래는 앱 밖의 일이다.
T('납부 기록에 금액이 없다',
  (rosterOf(b,'u3').pays||[]).every(p=>!('amount' in p)));
T('납부 기록에 날짜는 있다', (rosterOf(b,'u3').pays||[])[0].date==='2026-08-05');
T('내면 밀린 것이 풀린다', duesDue(b,'u3','2026-08-10')===false);
T('다음 주기가 오면 다시 밀린다', duesDue(b,'u3','2026-09-20')===true);
T('회비가 없으면 밀릴 일이 없다', duesDue(b,'u2','2026-08-10')===false);

// 부재
b = boat();
setRoster(b,'u3',{ awayTo:'2026-08-20', awayNote:'출장' });
T('부재 중이다', isAway(b,'u3','2026-08-10')===true);
T('부재가 끝나면 아니다', isAway(b,'u3','2026-08-21')===false);
T('부재 적힌 게 없으면 아니다', isAway(b,'u2','2026-08-10')===false);

// 알림
b = boat();
setRoster(b,'u3',{ duesCycle:'m', duesFrom:'2026-06-15' });
setRoster(b,'u2',{ awayTo:'2026-08-20', awayNote:'출장' });
const al = rosterAlerts(b, '2026-08-10');
T('밀린 회비를 알린다', al.some(x=>x.uid==='u3' && x.kind==='dues'));
T('부재를 알린다', al.some(x=>x.uid==='u2' && x.kind==='away'));
T('알림에 이름이 붙는다', al.every(x=>x.name && x.name.length>0));

// 권한
b = boat();
window.__user = { uid:'u3' };   // 크루 — 회비 권한 기본 없음
T('크루는 회비를 못 본다', can(b,'dues','view')===false);
T('크루는 명부는 볼 수 있다', can(b,'roster','view')===true);
window.__user = { uid:'u2' };   // 공동 관리자
T('공동 관리자는 회비를 쓴다', can(b,'dues','write')===true);
window.__user = { uid:'u1' };

// ── 옛 배에 남아 있던 회비 금액을 지운다 (3.82)
// ★ 화면에서 감추기만 하면 값은 그대로 남는다. 남으면 뺀 뜻이 없다.
{
  const b2 = boat();
  b2.roster = {
    u2:{ duesAmount:50000, duesCycle:'m', duesFrom:'2026-01-01',
         pays:[{ id:'p1', date:'2026-02-01', amount:50000 }] },
    u3:{ duesCycle:'y', duesFrom:'2026-01-01' }
  };
  const hit = dropDues(b2);
  T('지울 것이 있으면 알려 준다', hit === true);
  T('적어 둔 금액이 지워진다', !b2.roster.u2.duesAmount);
  T('납부 기록의 금액도 지워진다', !('amount' in b2.roster.u2.pays[0]));
  T('납부 날짜는 안 건드린다', b2.roster.u2.pays[0].date === '2026-02-01');
  T('회비 주기는 안 건드린다', b2.roster.u2.duesCycle === 'm' && b2.roster.u3.duesCycle === 'y');
  T('지울 것이 없으면 안 건드린다', dropDues(b2) === false);
  T('명부가 없어도 안 터진다', dropDues({ id:'x' }) === false);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
