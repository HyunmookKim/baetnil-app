// 등급 체계 검증 — 순위·이름·권한 스위치·안전장치
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
globalThis.newId = (()=>{ let n=0; return ()=>'r'+(++n); })();
globalThis.deepCopy = o => JSON.parse(JSON.stringify(o));
{ const m = src.match(/const PERMS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PERMS','globalThis.PERMS')); }
{ const m = src.match(/const PERM_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const PERM_LEVELS','globalThis.PERM_LEVELS')); }
{ const m = src.match(/const PERM_ORDER = [^;]+;/); if(m) eval(m[0].replace('const PERM_ORDER','globalThis.PERM_ORDER')); }
{ const m = src.match(/const RANK_SEED = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const RANK_SEED','globalThis.RANK_SEED')); }

const need = ['mkPerms','seedRanks','rankList','migrateRanks','rankOf','ownerRank','myRank','myPos','permOf','can','canTouchRank','canTouchMember',
              'addRank','editRank','delRank','setPerm','assignRank'];
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
  const b = { id:'b1', name:'현묵호', members:{}, memberNames:{} };
  seedRanks(b);
  const L = rankList(b);
  const own = L[0].id, adm = L[1].id, crew = L[3].id;
  b.members = { u1:own, u2:adm, u3:crew };
  b.memberNames = { u1:'현묵', u2:'김항해', u3:'박크루' };
  return b;
};

// ── 권한 항목
T('권한 항목이 17개다', Array.isArray(PERMS) && PERMS.length===17);
T('권한 항목마다 이름이 있다', PERMS.every(p=>p.k && p.name));
T('권한 단계가 있다', Array.isArray(PERM_LEVELS) && PERM_LEVELS.length>=3);

// ── 기본 등급
let b = boat();
T('기본 등급 다섯이 깔린다', rankList(b).length===5);
T('선주가 0순위', rankList(b)[0].pos===0 && rankList(b)[0].owner===true);
T('순위가 겹치지 않는다', new Set(rankList(b).map(r=>r.pos)).size===5);
T('이미 등급이 있으면 다시 깔지 않는다',
  (()=>{ const n=rankList(b).length; seedRanks(b); return rankList(b).length===n; })());

// ── 이름은 자유
b = boat();
editRank(b, rankList(b)[0].id, { name:'캡틴' });
T('선주 등급 이름은 바꿀 수 있다', rankList(b)[0].name==='캡틴');
T('선주 표시는 그대로', rankList(b)[0].owner===true && rankList(b)[0].pos===0);

// ── 선주 등급 권한은 못 깎는다
b = boat();
globalThis.alerts = [];
T('선주 권한은 못 낮춘다', setPerm(b, rankList(b)[0].id, 'stow', 'none')===null);
T('선주 등급은 못 지운다', delRank(b, rankList(b)[0].id)===null && rankList(b).length===5);
T('왜 안 되는지 알려준다', globalThis.alerts.length>0);

// ── 권한 판정
b = boat();
window.__user = { uid:'u3' };   // 크루
T('크루는 물품을 볼 수 있다', can(b,'stow','view')===true);
T('크루는 구성원 관리를 못 한다', can(b,'members','write')===false);
window.__user = { uid:'u1' };   // 선주
T('선주는 무엇이든 된다', can(b,'members','write')===true && can(b,'ranks','write')===true);
window.__user = { uid:'없는사람' };
T('구성원이 아니면 아무것도 안 된다', can(b,'stow','view')===false);
window.__user = { uid:'u1' };

// ── 순위 규칙
b = boat();
const RL = rankList(b); const own = RL[0], adm = RL[1], crew = RL[3];
window.__user = { uid:'u2' };   // 공동 관리자(1순위)
// 등급 관리 권한은 기본으로 꺼져 있다 — 줄지 말지는 선주가 정한다
T('등급 관리 권한이 없으면 아래 등급도 못 건드린다', canTouchRank(b, crew.id)===false);
adm.perms.ranks = 'write';     // 선주가 권한을 줬다고 치고
T('권한을 주면 아래 등급은 건드릴 수 있다', canTouchRank(b, crew.id)===true);
T('권한이 있어도 같은 등급은 못 건드린다', canTouchRank(b, adm.id)===false);
T('권한이 있어도 위 등급은 못 건드린다', canTouchRank(b, own.id)===false);
T('권한이 있어도 선주 등급은 못 건드린다', canTouchRank(b, own.id)===false);
T('아래 사람은 건드릴 수 있다', canTouchMember(b, 'u3')===true);
T('같은 급 사람은 못 건드린다', canTouchMember(b, 'u2')===false);
T('내 자신은 못 건드린다', canTouchMember(b, 'u2')===false);
window.__user = { uid:'u1' };
T('선주는 아래 전부 건드린다', canTouchMember(b,'u2')===true && canTouchMember(b,'u3')===true);
T('선주도 자기 자신은 못 건드린다', canTouchMember(b,'u1')===false);

// ── 등급 만들기·지우기
b = boat();
const nr = addRank(b, '기관장');
T('등급을 만든다', !!nr && rankList(b).length===6);
T('새 등급은 맨 아래 순위', nr.pos === Math.max(...rankList(b).map(r=>r.pos)));
b = boat();
const cid = rankList(b)[3].id;
delRank(b, cid);
T('등급을 지운다', rankList(b).length===4 && !rankOf(b,cid));
T('그 등급이던 사람은 맨 아래 등급으로 내려간다',
  b.members.u3 === rankList(b)[rankList(b).length-1].id);

// ── 사람에게 등급 주기
b = boat();
window.__user = { uid:'u1' };
assignRank(b, 'u3', rankList(b)[1].id);
T('등급을 매긴다', b.members.u3 === rankList(b)[1].id);
globalThis.alerts = [];
T('나보다 높은 등급은 못 준다',
  (()=>{ window.__user={uid:'u2'}; const r=assignRank(b,'u3',rankList(b)[0].id); window.__user={uid:'u1'}; return r===null; })());

// ── 마지막 선주 보호
b = boat();
globalThis.alerts = [];
T('선주가 하나뿐이면 그 사람 등급을 못 내린다',
  assignRank(b, 'u1', rankList(b)[1].id)===null && b.members.u1===rankList(b)[0].id);

// ── 옛 3역할로 저장된 배가 잠기지 않는다
{
  const old = { id:'b9', name:'옛배',
    members:{ u1:'owner', u2:'admin', u3:'viewer', u4:'뭔가이상한값' },
    memberNames:{ u1:'현묵', u2:'김', u3:'박', u4:'최' } };
  migrateRanks(old);
  T('옛 배에도 등급이 깔린다', rankList(old).length===5);
  T('옛 선주가 선주 등급으로 간다', rankOf(old, old.members.u1).owner===true);
  T('옛 관리자가 1순위로 간다', rankOf(old, old.members.u2).pos===1);
  T('옛 보기전용이 맨 아래로 간다',
    rankOf(old, old.members.u3).pos === Math.max(...rankList(old).map(r=>r.pos)));
  T('모르는 값도 등급을 받는다', !!rankOf(old, old.members.u4));
  T('아무도 등급 없이 남지 않는다',
    Object.values(old.members).every(id => !!rankOf(old, id)));
  // 두 번 돌려도 안 망가진다
  const before = JSON.stringify(old.members);
  migrateRanks(old);
  T('두 번 옮겨도 그대로', JSON.stringify(old.members)===before);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
