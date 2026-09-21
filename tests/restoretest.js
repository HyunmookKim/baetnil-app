// 실제 백업 파일로 restoreData 를 그대로 돌려 본다.
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
function grabConst(src, name){
  const i = src.indexOf('const ' + name + ' = [');
  if(i < 0) return null;
  return src.slice(i, src.indexOf('\n];', i) + 3);
}

const src  = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
// ★ 올려 주신 자리가 사라지면 옆에 둔 사본을 쓴다.
const CANDS = [process.argv[3], __dirname + '/sample-backup.json'].filter(Boolean);
const path = CANDS.find(f => { try{ fs.accessSync(f); return true; }catch(e){ return false; } });
if(!path){ console.log('★ 실패: 백업 파일을 못 찾았습니다 — ' + CANDS.join(' , ')); process.exit(1); }
console.log('백업 파일: ' + path);
const raw  = fs.readFileSync(path, 'utf8');

console.log('백업 파일 크기: ' + (raw.length/1024/1024).toFixed(1) + ' MB');

// ---- 모의 환경 ----
eval(grabConst(src, 'LOCKER_SEED').replace('const LOCKER_SEED =', 'globalThis.LOCKER_SEED ='));
globalThis.deepCopy = o => (o===null||typeof o!=='object') ? o : JSON.parse(JSON.stringify(o));
globalThis.lockers = deepCopy(LOCKER_SEED);
for(const f of ['seedLockersIfNeeded','strayItems']){ eval(grab(src,f)); globalThis[f]=eval(f); }
// 도면 이미지 관련 (2단계): 기본 도면은 무겁게 통째로 넣지 않고 표식만 둔다
globalThis.FLOORPLAN = 'seed-plan'; globalThis.SIDEVIEW = 'seed-side';
globalThis.dgImgs = { plan:null, side:null };
for(const f of ['dgArr','dgFromArr','seedDgIfNeeded']){ eval(grab(src,f)); globalThis[f]=eval(f); }
// getLocker 는 화살표 상수라 function 으로 잡히지 않는다
const gl = src.match(/const getLocker = [^;]+;/)[0];
eval(gl.replace('const getLocker =', 'globalThis.getLocker ='));
eval(grab(src, 'migrate')); globalThis.migrate = eval('migrate');

globalThis.items=[]; globalThis.trash=[]; globalThis.maint=[]; globalThis.repair=[];
globalThis.voyage=[]; globalThis.fuel=[]; globalThis.runs=[{id:'기존런',h:1}];
globalThis.contacts=[]; globalThis.vdocs=[]; globalThis.checkt=[]; globalThis.mrTrash=[];
globalThis.selected=null; globalThis.inBox=null; globalThis.moveId=null; globalThis.mergeId=null;

let saved=false, alerted='', confirmed=null;
globalThis.save = ()=>{ saved=true; };
globalThis.alert = m=>{ alerted = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.confirm = m=>{ confirmed = m; return true; };
globalThis.updateHeader=()=>{}; globalThis.renderPanelItems=()=>{};
globalThis.refreshBoxes=()=>{}; globalThis.renderList=()=>{}; globalThis.updateTrashTab=()=>{};
globalThis.clearSyncBase = ()=>{};   // 3.28 증분 동기화가 들어오며 필요해졌다
globalThis.shapes = [];
globalThis.posts = [];
globalThis.drawShapes = ()=>{};

// FileReader 흉내
globalThis.FileReader = class {
  readAsText(){ this.result = raw; this.onload(); }
};

// ★ 이 검사가 볼 것이 아닌 자리는 자리만 채운다 (없으면 restoreData 가 조용히 터진다)
globalThis.dgSeedUrl = ()=>null;
globalThis.dgSmallFromArr = ()=>({plan:null,side:null});
globalThis.dgRefFromArr   = ()=>({plan:null,side:null});
globalThis.dgPubFromArr   = ()=>({plan:false,side:false});
globalThis.dgResolve = ()=>{};
// 4.85 — 도면이 여러 장이 되면서 늘어난 것들
globalThis.dgNames = {};
globalThis.dgBlank = v => ({ plan:v, side:v });
globalThis.dgNamesFromArr = ()=>({});
globalThis.dgSmall = { plan:null, side:null };
globalThis.dgRef   = { plan:null, side:null };
globalThis.dgPub   = { plan:false, side:false };
if(typeof globalThis.t !== 'function') globalThis.t = x => x;
if(typeof globalThis.tsub !== 'function')
  globalThis.tsub = (m,o)=>String(m).replace(/\{(\w+)\}/g,(a,k)=>(o&&o[k]!=null)?o[k]:a);

eval(grab(src, 'restoreData'));

const before = JSON.parse(raw);
// ★ restoreData 는 async 다. 끝나기를 기다린 뒤에 결과를 본다.
//   기다리지 않아 「전부 0」 으로 나오는 것을 4.50 에서 잡았다.
(async ()=>{
restoreData({ target: { files: [{}], value: '' } });
for(let i=0;i<8;i++) await new Promise(r=>setTimeout(r,0));

// ---- 결과 대조 ----
const rows = [
  ['물품(items)',   before.items.length,    items.length],
  ['휴지통(trash)', before.trash.length,    trash.length],
  ['정기점검(maint)',before.maint.length,   maint.length],
  ['수리(repair)',  before.repair.length,   repair.length],
  ['항해일지',       before.voyage.length,   voyage.length],
  ['주유(fuel)',    before.fuel.length,     fuel.length],
  ['연락처',         before.contacts.length, contacts.length],
  ['문서(vdocs)',   before.vdocs.length,    vdocs.length],
  ['체크리스트',     before.checkt.length,   checkt.length],
  ['정비휴지통',     before.mrtrash.length,  mrTrash.length],
];
let fail = 0;
console.log('\n항목            백업 → 복원   결과');
for(const [n,a,b] of rows){
  const ok = (a === b);
  if(!ok) fail++;
  console.log(n.padEnd(14) + String(a).padStart(4) + ' → ' + String(b).padStart(4) + '   ' + (ok?'일치':'★ 불일치'));
}

// 세부 확인
const photoCount = items.filter(i=>i.photos && i.photos.length).length;
// 도면 이미지 복원 결과
const dgState = (dgImgs.plan==='seed-plan' && dgImgs.side==='seed-side') ? '기본 도면으로 시드'
              : (dgImgs.plan||dgImgs.side) ? '백업의 도면 복원'
              : '도면 없음';
console.log('도면 이미지: ' + dgState);
const boxCount   = items.filter(i=>i.box).length;
const childCount = items.filter(i=>i.parentId).length;
const badLocker  = items.filter(i=>!getLocker(i.lockerId)).length;
const lostParent = items.filter(i=>{
  const orig = before.items.find(o=>o.id===i.id);
  return orig && orig.parentId && !i.parentId;
}).length;

console.log('\n사진 있는 물품: ' + photoCount);
console.log('상자 물품: ' + boxCount + ' / 상자 안 물품: ' + childCount);
console.log('칸을 못 찾은 물품: ' + badLocker);
console.log('상자 소속이 끊긴 물품: ' + lostParent);
console.log('엔진가동(runs) 보존: ' + (runs.length===1 ? '예 (백업에 없어 그대로 둠)' : '★ 사라짐'));
console.log('\n확인창 문구: ' + confirmed);
console.log('완료 알림: ' + alerted);
console.log('저장 호출됨: ' + saved);
process.exit(fail ? 1 : 0);
})();
