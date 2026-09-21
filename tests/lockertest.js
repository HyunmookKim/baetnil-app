// 1단계(칸 저장소 분리) 검증
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const src  = fs.readFileSync(FILE, 'utf8');
// ★ 견본 백업(만들어 낸 자료)을 쓴다. 사장님 진짜 기록은 여기 두지 않는다 —
//   실제 기록은 계속 바뀌고, 검사가 남의 자료를 붙들고 있을 까닭이 없다.
const CANDS = [process.argv[3], __dirname + '/sample-backup.json'].filter(Boolean);
const BKP = CANDS.find(f => { try{ fs.accessSync(f); return true; }catch(e){ return false; } });
if(!BKP){ console.log('★ 실패: 백업 파일을 못 찾았습니다 — ' + CANDS.join(' , ')); process.exit(1); }
console.log('백업 파일: ' + BKP);
const raw  = fs.readFileSync(BKP, 'utf8');

function grab(n){
  const i = src.indexOf('function ' + n + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j]==='{') d++;
    else if(src[j]==='}'){ d--; if(d===0){ j++; break; } }
  }
  return src.slice(i, j);
}

const results = [];
function chk(name, cond, detail){
  results.push((cond?'통과  ':'실패  ') + name + (detail?'  → '+detail:''));
}

// 기본 칸 목록
const seedSrc = src.match(/const LOCKER_SEED = \[[\s\S]*?\n\];/);
eval(seedSrc[0].replace('const LOCKER_SEED =', 'globalThis.LOCKER_SEED ='));
globalThis.deepCopy = o => (o===null||typeof o!=='object') ? o : JSON.parse(JSON.stringify(o));
globalThis.lockers = [];
globalThis.items = []; globalThis.trash = [];

globalThis.FLOORPLAN = 'seed-plan'; globalThis.SIDEVIEW = 'seed-side';
globalThis.dgImgs = { plan:null, side:null };
for(const f of ['zoneOrder','seedLockersIfNeeded','strayItems','migrate','dgArr','dgFromArr','seedDgIfNeeded']){
  const c = grab(f); if(!c) throw new Error('함수 없음: ' + f);
  eval(c); globalThis[f] = eval(f);
}
const gl = src.match(/const getLocker = [^;]+;/)[0];
eval(gl.replace('const getLocker =', 'globalThis.getLocker ='));

// ===== 1. 구역 순서를 칸에서 뽑아낸다 =====
lockers = deepCopy(LOCKER_SEED);
const zo = zoneOrder();
chk('구역 13개를 칸 순서에서 뽑는다', zo.length === 13, zo.length + '개');
chk('첫 구역이 선수, 끝이 코크핏',
    zo[0] === '선수' && zo[zo.length-1].startsWith('코크핏'), zo[0] + ' … ' + zo[zo.length-1]);

// ===== 2. 씨앗: 새 배에는 남의 도면을 넣지 않는다 =====
lockers = []; items = []; trash = [];
chk('물품이 없는 새 배에는 칸을 넣지 않는다', seedLockersIfNeeded() === false && lockers.length === 0);

// ===== 3. 씨앗: 옛 기록이 있으면 71칸을 되살린다 =====
lockers = [];
items = [{id:1, name:'커피포트', lockerId:'gal_sh2'}];
trash = [];
const seeded = seedLockersIfNeeded();
chk('옛 71칸 기록이 있으면 칸을 되살린다', seeded === true && lockers.length === 71, lockers.length + '칸');

// ===== 4. 씨앗: 무관한 칸 번호면 건드리지 않는다 =====
lockers = []; items = [{id:1, name:'뭔가', lockerId:'남의배칸1'}];
chk('모르는 칸 번호면 남의 도면을 넣지 않는다', seedLockersIfNeeded() === false && lockers.length === 0);

// ===== 5. 미배치 물품을 골라낸다 =====
lockers = deepCopy(LOCKER_SEED);
items = [
  {id:1, name:'있음', lockerId:'gal_sh2'},
  {id:2, name:'없음', lockerId:'사라진칸'},
];
chk('칸이 사라진 물품을 골라낸다', strayItems().length === 1 && strayItems()[0].name === '없음');

// ===== 6. 실제 백업 복원 =====
async function runRestore(bk, startLockers){
  globalThis.lockers = startLockers;
  globalThis.items=[]; globalThis.trash=[]; globalThis.maint=[]; globalThis.repair=[];
  globalThis.voyage=[]; globalThis.fuel=[]; globalThis.runs=[]; globalThis.contacts=[];
  globalThis.vdocs=[]; globalThis.checkt=[]; globalThis.mrTrash=[];
  globalThis.selected=null; globalThis.inBox=null; globalThis.moveId=null; globalThis.mergeId=null;
  let msg='', done='';
  globalThis.save=()=>{};
  // ★ 앱은 confirm/alert 를 안 쓴다. 자기 창(ask/tell)을 띄우고, restoreData 는 async 다.
  //   예전 검사가 confirm 을 가로채고 있어서 복원이 아예 안 돌았다.
  globalThis.confirm=m=>{ msg=m; return true; };
  globalThis.alert=m=>{ done=m; };
  globalThis.ask=m=>{ msg=m; return Promise.resolve(true); };
  globalThis.tell=m=>{ done=m; return Promise.resolve(); };
  if(typeof globalThis.t !== 'function') globalThis.t = x => x;
  if(typeof globalThis.tsub !== 'function')
    globalThis.tsub = (m,o)=>String(m).replace(/\{(\w+)\}/g,(a,k)=>(o&&o[k]!=null)?o[k]:a);
  globalThis.updateHeader=()=>{}; globalThis.renderPanelItems=()=>{};
  globalThis.refreshBoxes=()=>{}; globalThis.renderList=()=>{}; globalThis.updateTrashTab=()=>{};
globalThis.clearSyncBase = ()=>{};   // 3.28 증분 동기화가 들어오며 필요해졌다
globalThis.shapes = [];
globalThis.posts = [];
globalThis.drawShapes = ()=>{};
  // 도면 그림은 이 검사가 볼 것이 아니다 — 자리만 채워 둔다
  globalThis.dgSmall = { plan:null, side:null };
  globalThis.dgRef   = { plan:null, side:null };
  globalThis.dgPub   = { plan:false, side:false };
  globalThis.dgSeedUrl      = ()=>null;   // 기본 도면 그림 — 이 검사가 볼 것이 아니다
  globalThis.dgFromArr      = ()=>({plan:null,side:null});
  globalThis.dgSmallFromArr = ()=>({plan:null,side:null});
  globalThis.dgRefFromArr   = ()=>({plan:null,side:null});
  globalThis.dgPubFromArr   = ()=>({plan:false,side:false});
  globalThis.dgResolve = ()=>{};
  // 4.85 — 도면이 여러 장이 되면서 늘어난 것들. 이 검사가 볼 것은 아니다.
  globalThis.dgNames = {};
  globalThis.dgBlank = v => ({ plan:v, side:v });
  globalThis.dgNamesFromArr = ()=>({});
  globalThis.FileReader = class { readAsText(){ this.result = bk; this.onload(); } };
  eval(grab('restoreData'));
  restoreData({ target:{ files:[{}], value:'' } });
  // ★ restoreData 는 async 다. 끝날 때까지 기다린 뒤에 결과를 본다.
  for(let i=0;i<5;i++) await new Promise(r=>setTimeout(r,0));
  return { msg, done };
}

(async ()=>{
// 6-1. 칸 정보가 없는 옛 백업
//  ★ 견본 백업에서 lockers 만 떼어
//    같은 모양(칸 정보 없는 옛 백업)을 만들어 쓴다.
//    개수를 못 박지 않고 「넣은 만큼 그대로 나오나」를 본다 — 그게 진짜 봐야 할 것이다.
const 원본 = JSON.parse(raw);
const N물품 = (원본.items || []).filter(i => i && i.lockerId && i.name).length;
const 옛백업 = JSON.parse(raw); delete 옛백업.lockers;
let r = await runRestore(JSON.stringify(옛백업), []);
chk('옛 백업: 물품 ' + N물품 + '개 전부 복원', items.length === N물품, items.length + '개');
chk('옛 백업: 칸 71개를 함께 되살림', lockers.length === 71, lockers.length + '칸');
chk('옛 백업: 미배치 0개', strayItems().length === 0, strayItems().length + '개');
chk('옛 백업: 확인창이 칸 복원을 알림', r.msg.includes('수납칸 71개'), (r.msg||'').split('\n')[1] || '');

// 6-2. 칸 정보가 들어 있는 새 백업
const withL = JSON.parse(raw);
withL.lockers = deepCopy(LOCKER_SEED).slice(0, 40);   // 40칸만 있는 배
r = await runRestore(JSON.stringify(withL), []);
const stray = strayItems().length;
chk('새 백업: 백업에 든 칸 40개를 그대로 씀', lockers.length === 40, lockers.length + '칸');
chk('새 백업: 갈 곳 없는 물품을 버리지 않음', items.length === N물품, items.length + '개');
chk('새 백업: 미배치를 세어 알림', stray > 0 && r.msg.includes(String(stray) + '개는 해당하는 수납칸이 없습니다'),
    '미배치 ' + stray + '개');
chk('새 백업: 완료 알림에도 미배치를 알림', (r.done||'').includes('못 찾은 물품이 ' + stray + '개'));

console.log(results.join('\n'));
const fail = results.filter(x=>x.startsWith('실패')).length;
console.log('\n합계: ' + (results.length-fail) + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
})();
