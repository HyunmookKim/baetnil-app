// 정비수첩 — 「한 번 작업 = 한 건」 (4.63)
//
// ★ 이 검사가 지키는 것
//   ① 절차를 쓰는 자리가 하나다. 정기점검에도 있고 정비수첩에도 있으면 아무도 어느 쪽을 고칠지 모른다
//   ② 옛 판(4.54~4.62)이 정기점검에 붙여 둔 절차는 버리지 않고 옮긴다
//   ③ 켜지 않은 정비수첩은 밖으로 안 나간다. 메모와 장비 번호는 어떤 경우에도 안 나간다
//   ④ 옛 판이 이미 올려 둔 남의 기록도 계속 보인다 (안 그러면 하루아침에 사라진 것처럼 보인다)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) i = src.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };

// ── ① 갈래가 셋이다 (정비 · 장비 · 정비수첩이 한 배열에 산다)
T('★ 정비수첩을 가르는 곳이 있다', /const isMlog\s*= x => !!\(x && x\.typ === 'log'\)/.test(src));
const MR = grab('maintRows');
T('★★★ 정비 목록에 정비수첩이 안 섞인다', /!isGear\(x\) && !isMlog\(x\)/.test(MR||''), MR);
T('★ 정비수첩만 골라 주는 곳이 있다 (mlogRows)', !!grab('mlogRows'));
T('★★ 항해일지의 「중간 기록」(logRows) 과 이름이 안 부딪힌다',
  (src.match(/function logRows\(/g)||[]).length === 1
  && /function logRows\(it\)/.test(src) && /function mlogRows\(\)/.test(src));

// ── ② 쓰는 자리가 하나
T('★★★ 정기점검 창에 절차(howBlock)를 안 붙인다',
  !/history\.map\(x=>x\.date\)\.join\(' · '\)\}<\/div>`:''\}`\s*\+ howBlock/.test(src)
  && (src.match(/\+ howBlock\(it\);/g)||[]).length === 1, (src.match(/\+ howBlock\(it\);/g)||[]).length);
T('★ 정기점검 창에서 정비수첩으로 바로 간다', /addMlogForItem\(/.test(src));
T('★ 수리 창에서도 정비수첩으로 간다', /addMlogForRepair\(/.test(src));
T('★ 장비 카드에서도 간다', /addMlogForGear\(/.test(src));
// ★★★ 4.112 에서 **뒤집혔다** (사장님 지적, 2026-09-08)
//   「정기점검 몇 개 완료했다고 버튼 누르면 자동으로 계속 정비수첩으로 제멋대로 올라가거든.
//    이거 정비수첩으로 자동으로 뭐든지 올라가는 거 못 하게 해라. 이거 내가 결정을 해야지.」
//   그래서 여기 세 줄은 **반대로** 잰다. 옛 규칙을 그대로 두면 검사가 흠을 지켜 준다.
T('★★★ 「완료 처리」 가 정비수첩을 저절로 만들지 않는다',
  !/mlogNew\s*\(/.test(grab('mrComplete')||''), (grab('mrComplete')||'').match(/[^\n]*mlogNew[^\n]*/)||'');
T('★★★ 수리를 「완료」 로 바꿔도 묻지 않는다',
  !/ask\(/.test(grab('mrStatus')||''), (grab('mrStatus')||'').match(/[^\n]*ask\([^\n]*/)||'');
T('★★ 정비수첩은 사람이 「+ 정비수첩」 을 눌러야 생긴다',
  /addMlogForItem\(/.test(src) && /addMlogForRepair\(/.test(src));

// ── ③ 이사
const MV = grab('mlogMoveOld');
T('★ 옮기는 곳이 있다 (mlogMoveOld)', !!MV);
if(MV){
  const F = new Function(`
    const t = x => x; const tsub = (x,o) => x;
    const isGear = x => !!(x && x.typ === 'gear');
    const isMlog = x => !!(x && x.typ === 'log');
    let ID = 0; const newId = () => 'n' + (++ID);
    const today = () => '2026-08-29';
    let saved = 0; const saveMR = () => { saved++; };
    let maint = [];
    ${grab('maintRows')}
    ${grab('howSteps')}
    ${grab('mlogNew')}
    ${MV}
    return { set:a=>{ maint = a; }, get:()=>maint, run:mlogMoveOld, saves:()=>saved };`)();
  F.set([
    { id:'m1', name:'임펠러 교체', lastDate:'2026-06-01', gearId:'g1',
      how:[{v:'하나'},{v:'둘',p:'d'}], hard:3, work:'1.5', cost:'32000', used:'임펠러', pub:true },
    { id:'m2', name:'아연 교체', lastDate:'2026-05-01' }
  ]);
  const n = F.run();
  const rows = F.get();
  const lg = rows.find(x => x.typ === 'log');
  const old = rows.find(x => x.id === 'm1');
  T('★★ 절차가 있는 것만 옮긴다', n === 1, n);
  T('★★★ 옮긴 뒤 정기점검에서 지운다 (두 자리에 같은 것을 안 남긴다)',
    !('how' in old) && !('hard' in old) && !('work' in old) && !('cost' in old) && !('used' in old), old);
  T('★★★ 버리지 않는다 — 단계가 그대로 옮겨졌다',
    lg && lg.how.length === 2 && lg.how[1].p === 'd', lg && lg.how);
  T('★★ 난이도·시간·돈·부품도 함께 옮긴다',
    lg.hard === 3 && lg.work === '1.5' && lg.cost === '32000' && lg.used === '임펠러', lg);
  T('★★ 날짜는 그 항목의 마지막 정비일을 쓴다', lg.date === '2026-06-01', lg.date);
  T('★★ 어느 항목·어느 장비 것인지 이어 둔다', lg.maintId === 'm1' && lg.gearId === 'g1', lg);
  T('★★ 공개해 두었던 것은 공개인 채로 옮긴다', lg.pub === true);
  T('★★★ 두 번 돌려도 두 벌이 안 생긴다', F.run() === 0 && F.get().filter(x=>x.typ==='log').length === 1,
    F.get().filter(x=>x.typ==='log').length);
  T('★ 절차 없는 항목은 안 건드린다', !F.get().find(x=>x.id==='m2').typ);
}
T('★ 앱을 켤 때 한 번 돈다', /mlogMoveOld\(\);/.test(grab('normalizeMaint')||''));

// ── ④ 밖으로 나가는 문
const PUB = grab('mlogPublic');
T('★ 나가는 문이 하나다 (mlogPublic)', !!PUB);
if(PUB){
  const F = new Function(`
    const t = x => x; const tsub = (x,o) => x;
    const HOW_MAX = 25; const PROD_ALIAS = {};
    const isMlog = x => !!(x && x.typ === 'log');
    const PUB_LEVELS = [{k:'com'},{k:'boat'},{k:'none'}];
    ${(src.match(/const PUB_OUT = \{[\s\S]*?\n\};/)||[''])[0]}
    ${grab('pubPlain')}
    ${grab('pubLvOf')}
    const mlogLv = m => pubLvOf(m, 'none');
    const photoBudget = (a,n) => ({ kept: a });
    ${grab('prodNorm')} ${grab('prodMaker')} ${grab('prodKey')}
    ${grab('howSteps')}
    let GEARS = [];
    const gearRows = () => GEARS;
    const gearAll  = () => GEARS;      // 4.91 — gearOf 가 교체된 것까지 본다
    const GEAR_SYS = ['추진'];
    ${grab('gearOf')} ${grab('gearName')} ${grab('gearLabel')} ${grab('gearSysOf')}
    let maint = [];
    const maintRows = () => [];
    const repair = [];
    ${grab('mlogRows')} ${grab('mlogTitle')}
    ${PUB}
    return { set:(g,m)=>{ GEARS = g; maint = m; }, pub: mlogPublic };`)();
  F.set([{ id:'g1', typ:'gear', name:'', kind:'해수펌프', maker:'Jabsco', model:'50080', sys:'추진' }], []);
  const R = { id:'l1', typ:'log', date:'2026-06-01', title:'임펠러 교체',
              gearId:'g1', maintId:'m1', repairId:'r1',
              how:[{v:'커버를 푼다',p:'PIC'}], hard:2, work:'1.5', cost:'32000', used:'임펠러 A-3',
              note:'갤리 서랍3 · 김선장 010-1234-5678', photos:[], pub:false };
  T('★★★ 안 켜면 아예 안 나간다', F.pub(R) === null);
  const o = F.pub({ ...R, pub:true });
  const js = JSON.stringify(o);
  T('★★ 켜면 단계가 나간다', o.how.length === 1 && o.how[0].p === 'PIC', o.how);
  // ★ 4.73 — 메모가 나간다 (사장님이 정하신 것 — 「사람들 보라고 메모 쓰는 건데」).
  //   앱이 임의로 막지 않는다. 무엇을 적을지는 쓰는 사람이 정하고,
  //   앱은 「나간다」 고 화면에서 미리 말한다.
  T('★★★ 메모가 나간다 (남 보라고 쓴 것이다)', ('note' in o) && !!o.note, o.note);
  T('★★★ 어느 장비 번호인지 안 나간다', !('gearId' in o) && !/"g1"/.test(js));
  T('★★★ 어느 정기점검·수리 번호인지 안 나간다',
    !('maintId' in o) && !('repairId' in o) && !/"m1"/.test(js) && !/"r1"/.test(js));
  T('★★ 어느 제품에 한 일인지는 나간다 (이게 있어야 찾아 들어온다)',
    o.maker === 'Jabsco' && o.model === '50080' && o.key === 'jabsco|50080', o);
  T('★ 난이도·시간·돈·부품이 나간다',
    o.hard === 2 && o.work === '1.5' && o.cost === '32000' && o.used === '임펠러 A-3');
  T('빈 것을 넣어도 안 터진다', F.pub(null) === null && F.pub({ pub:true, id:'x' }) !== null);
}
T('★★ 공개 자료에 이 문으로만 실린다',
  /o\.mlog = mlogRows\(\)\.map\(x => mlogPublic\(x\)\)\.filter\(Boolean\)/.test(src),
  (src.match(/o\.mlog = [^\n]*/)||[''])[0]);

// ── ⑤ 옛 판이 올린 것도 계속 보인다
T('★★★ 남의 배 정비수첩이 새 자리와 옛 자리를 다 읽는다',
  /expFlat\('mlog'\)/.test(src) && /expFlat\('maint'\)/.test(src) && /_old:true/.test(src));
T('★ 배 페이지에 정비수첩 갈래가 있다', /\['mlog',t\('정비수첩'\)\]/.test(src));
T('★★ 단계 화면을 두 벌로 안 만든다 (pubHowBody 하나)',
  !!grab('pubHowBody') && (src.match(/class="howstep"/g)||[]).length <= 2,
  (src.match(/class="howstep"/g)||[]).length);
T('★ 눌러 들어오면 맞는 갈래로 간다', /const inNew = \(x\.mlog\|\|\[\]\)\.some/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
