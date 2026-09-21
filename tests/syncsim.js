// 3.28 — 바뀐 것만 받아오기: 가짜 클라우드로 실제로 돌려 본다
//
// ★ 이건 자료가 오가는 길이다. 여기가 틀리면 배 기록이 사라진다.
//   글자 검사만으로는 모자라서, 가짜 Firestore 를 만들어 놓고
//   앱 코드에서 뽑아낸 진짜 함수들을 그 위에서 돌린다.
//
// 보는 것
//  1) 처음에는 통째로 받는가
//  2) 두 번째부터 읽기 횟수가 실제로 줄어드는가
//  3) 다른 기기가 고친 것이 넘어오는가
//  4) ★ 다른 기기가 지운 것을 알아채는가 (지운 것은 자국이 안 남는다)
//  5) ★ 아무것도 안 바뀌었을 때 로컬을 비우지 않는가
//  6) 백업 복원처럼 로컬이 바뀌면 지난 셈을 버리는가
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
function grabM(s, name){
  const re = new RegExp('(?:^|[\\n{,])\\s*(?:async\\s+)?' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(s);
  if(!m) return null;
  let d = 0;
  for(let j = m.index + m[0].length - 1; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0) return s.slice(m.index, j + 1); }
  }
  return null;
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const js  = src.slice(src.indexOf('<script>') + 8, src.indexOf('</script>', src.indexOf('<script>')));
const mod = src.slice(src.indexOf('<script type="module">'));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 가짜 Firestore ────────────────────────────────────────────
// 서버 자료: { coll: { id: doc } }
const SERVER = {};
let READS = 0;               // 읽은 문서 수 (요금이 매겨지는 단위)
const CO = ['items','trash','maint','repair','voyage','fuel','runs','contacts',
            'vdocs','checkt','mrtrash','lockers','shapes','posts','dgimgs'];
CO.forEach(k => SERVER[k] = {});

const col = name => ({ _c: name });
function query(c, w){ return { _c: c._c, _w: w }; }
function where(field, op, val){ return { field, op, val }; }
async function getDocs(q){
  const rows = Object.values(SERVER[q._c] || {}).filter(d=>{
    if(!q._w) return true;
    const v = d[q._w.field];
    if(v === undefined) return false;      // ★ 필드가 없는 문서는 안 잡힌다 (실제 동작)
    return q._w.op === '>' ? v > q._w.val : true;
  });
  READS += Math.max(1, rows.length);        // 빈 결과도 1회로 친다
  return { size: rows.length, docs: rows.map(d=>({ data: () => JSON.parse(JSON.stringify(d)) })) };
}
async function getCountFromServer(c){
  READS += 1;
  const n = Object.keys(SERVER[c._c] || {}).length;
  return { data: () => ({ count: n }) };
}
// 다른 기기가 올린 것처럼 서버를 고친다 (앱의 push 와 같은 방식으로 _u 를 찍는다)
function serverSet(coll, body, stamp){ SERVER[coll][String(body.id)] = Object.assign({}, body, { _u: stamp }); }
function serverDel(coll, id){ delete SERVER[coll][String(id)]; }

// ── 앱·모듈에서 진짜 함수를 뽑아낸다 ──────────────────────────
const rowsOf   = new Function(grab(mod,'rowsOf') + '\n return rowsOf;')();
const fullColl = new Function('col','getDocs','rowsOf',
  grab(mod,'fullColl') + '\n return fullColl;')(col, getDocs, rowsOf);
const diffColl = new Function('col','getDocs','query','where','getCountFromServer','rowsOf',
  grab(mod,'diffColl') + '\n return diffColl;')(col, getDocs, query, where, getCountFromServer, rowsOf);
const pullFn = new Function('CO','fullColl','diffColl','getDoc','doc','fdb','boatPath',
  'const api = { ' + grabM(mod,'pull').replace(/^[\n{,\s]+/, '') + ' }; return api.pull;')(
  CO, fullColl, diffColl, async ()=>({ exists: ()=>true }), ()=>0, null, ()=>'boats/B1');
const mergeColl = new Function(grab(js,'mergeColl') + '\n return mergeColl;')();
const collHash  = new Function(grab(js,'collHash') + '\n return collHash;')();

// ── 앱 흉내 (로컬 자료 + 지난 셈) ──────────────────────────────
const LOCAL = {}; CO.forEach(k => LOCAL[k] = []);
let BASE = null;
const SYNC_FULL_MS = Number((js.match(/const SYNC_FULL_MS = ([0-9e.]+)/) || [0,'432e5'])[1]);
const localColl = k => LOCAL[k] || [];

// ★ 판단은 흉내내지 않는다. 앱에서 그대로 뽑아 쓴다.
//   흉내내면 앱을 망가뜨려도 시험이 통과해 버린다 (실제로 그랬다).
const syncPlan = new Function('SYNC_COLLS','SYNC_FULL_MS','collHash','localColl',
  grab(js,'syncPlan') + '\n return syncPlan;')(CO, SYNC_FULL_MS, collHash, localColl);
const syncReconcile = new Function('SYNC_COLLS','mergeColl','localColl',
  grab(js,'syncReconcile') + '\n return syncReconcile;')(CO, mergeColl, localColl);

// ── 올리기도 앱의 진짜 push 를 쓴다 (여기서 _u 를 찍는다)
const batches = [];
function writeBatch(){
  const ops = [];
  return { set:(r,b)=>ops.push(['set',r,b]), delete:(r)=>ops.push(['del',r]),
           commit: async ()=>{ ops.forEach(o=>{
             if(o[0]==='set') SERVER[o[1].c][o[1].id] = JSON.parse(JSON.stringify(o[2]));
             else delete SERVER[o[1].c][o[1].id]; }); } };
}
const pushFn = new Function('writeBatch','fdb','dc',
  'const api = { ' + grabM(mod,'push').replace(/^[\n{,\s]+/, '') + ' }; return api.push;')(
  writeBatch, null, (c,id)=>({ c, id: String(id) }));

// 다른 기기가 앱으로 올린 것처럼 (진짜 push 를 통과시킨다)
async function otherDevicePush(p){ await pushFn(p); }

async function appPull(now){
  const base = syncPlan(BASE, now);
  const r = await pullFn(Object.keys(base).length ? base : null);
  const C = await syncReconcile(r.colls || {}, k => fullColl(k));
  CO.forEach(k=>{ if(C[k] && Array.isArray(C[k].rows)) LOCAL[k] = C[k].rows; });
  BASE = { at: now, c: {} };
  CO.forEach(k=>{ BASE.c[k] = { n: LOCAL[k].length, u: (C[k] && C[k].u) || '', h: collHash(LOCAL[k]) }; });
  return C;
}

(async ()=>{
  // ── 준비: 물품 354개 + 나머지 조금 (사장님 배와 비슷하게)
  for(let i=0;i<354;i++) serverSet('items', { id:'i'+i, name:'물건'+i }, '2026-08-01T00:00:00.000Z');
  for(let i=0;i<71;i++)  serverSet('lockers', { id:'L'+i, name:'칸'+i }, '2026-08-01T00:00:00.000Z');
  for(let i=0;i<40;i++)  serverSet('maint', { id:'m'+i, t:'점검'+i }, '2026-08-01T00:00:00.000Z');
  for(let i=0;i<13;i++)  serverSet('trash', { id:'t'+i }, '2026-08-01T00:00:00.000Z');
  const 서버총수 = CO.reduce((a,k)=>a+Object.keys(SERVER[k]).length, 0);

  // 1) 처음 — 통째로
  READS = 0;
  await appPull(1000);
  const 첫읽기 = READS;
  T('처음에는 다 받아온다 — 물품 ' + LOCAL.items.length + '개', LOCAL.items.length === 354);
  T('칸도 다 받았다 — ' + LOCAL.lockers.length + '개', LOCAL.lockers.length === 71);
  T('첫 받아오기는 통째로 읽는다 — ' + 첫읽기 + '번 (서버 문서 ' + 서버총수 + '개)', 첫읽기 >= 서버총수);
  // ★ _u 가 앱 자료에 섞이면 백업 파일과 화면에 알 수 없는 값이 들어간다
  T('_u 가 앱 자료에 섞이지 않았다', LOCAL.items.every(x=>x._u === undefined));

  // 2) 아무것도 안 바뀐 채 다시 열기
  READS = 0;
  await appPull(2000);
  const 둘째읽기 = READS;
  T('두 번째는 훨씬 적게 읽는다 — ' + 둘째읽기 + '번 (첫 번째 ' + 첫읽기 + '번)', 둘째읽기 < 첫읽기 / 5);
  T('아무것도 안 바뀌면 로컬이 그대로다 — 물품 ' + LOCAL.items.length, LOCAL.items.length === 354);
  T('빈 자료로 덮어쓰지 않았다', LOCAL.lockers.length === 71 && LOCAL.maint.length === 40);

  // 3) 다른 기기가 하나 고치고 하나 넣음
  // ★ 진짜 push 를 통과시킨다 — _u 를 찍는 것도 앱 코드가 한다
  await otherDevicePush({ setI:[{ id:'i7', name:'고친 물건' }, { id:'new1', name:'새 물건' }],
    delI:[], setT:[], delT:[], setM:[], delM:[], setR:[], delR:[] });
  READS = 0;
  await appPull(3000);
  T('바뀐 것만 읽었다 — ' + READS + '번', READS < 60);
  T('고친 것이 넘어왔다', (LOCAL.items.find(x=>x.id==='i7')||{}).name === '고친 물건');
  T('새것이 들어왔다', !!LOCAL.items.find(x=>x.id==='new1'));
  T('나머지는 그대로 — ' + LOCAL.items.length + '개', LOCAL.items.length === 355);

  // 4) ★ 다른 기기가 지움 — 자국이 안 남는다
  await otherDevicePush({ setI:[], delI:['i100','i101'],
    setT:[], delT:[], setM:[], delM:[], setR:[], delR:[] });
  READS = 0;
  await appPull(4000);
  T('지운 것을 알아챘다 — ' + LOCAL.items.length + '개', LOCAL.items.length === 353);
  T('지운 것이 목록에서 빠졌다', !LOCAL.items.find(x=>x.id==='i100'));
  T('그 칸만 다시 읽었다 — ' + READS + '번', READS > 300 && READS < 600);

  // 5) 지우고 넣기가 같이 일어나 개수가 같은 경우 (제일 놓치기 쉬운 자리)
  await otherDevicePush({ setI:[{ id:'new2', name:'또 하나' }], delI:['i200'],
    setT:[], delT:[], setM:[], delM:[], setR:[], delR:[] });
  await appPull(5000);
  T('개수가 같아도 지운 것을 알아챈다', !LOCAL.items.find(x=>x.id==='i200'));
  T('같이 들어온 새것도 있다', !!LOCAL.items.find(x=>x.id==='new2'));
  T('개수가 맞는다 — ' + LOCAL.items.length, LOCAL.items.length === 353);

  // 6) 백업 복원 흉내 — 로컬을 통째로 갈아 끼운다
  LOCAL.items = [{ id:'z1', name:'복원본' }];
  READS = 0;
  await appPull(6000);
  T('로컬이 바뀌면 지문이 어긋나 통째로 다시 받는다 — ' + LOCAL.items.length + '개',
    LOCAL.items.length === 353);
  T('복원본이 클라우드 자료로 덮였다', !LOCAL.items.find(x=>x.id==='z1'));

  // 6-2) ★ 개수는 같은데 내용이 다른 복원 — 개수 맞추기로는 못 잡는다.
  //     여기서 지문이 일한다. 지문이 없으면 남의 배 물건 353개를 그대로 안고 산다.
  LOCAL.items = LOCAL.items.map((x,i)=>({ id:'other'+i, name:'남의 물건'+i }));
  await appPull(6500);
  T('개수가 같아도 내용이 다르면 다시 받는다',
    !LOCAL.items.find(x=>String(x.id).startsWith('other')) && LOCAL.items.length === 353);

  // 7) 반나절이 지나면 무조건 통째로 (옛 판 앱이 _u 없이 올릴 수 있다)
  SERVER.items['i300'] = { id:'i300', name:'옛 판이 고친 것' };   // _u 없이
  READS = 0;
  await appPull(6500 + SYNC_FULL_MS + 1);
  T('반나절 지나면 통째로 받는다 — ' + READS + '번', READS >= 400);
  T('_u 없이 올라온 것도 결국 받아온다',
    (LOCAL.items.find(x=>x.id==='i300')||{}).name === '옛 판이 고친 것');

  // 8) 한 달치 읽기 견적
  READS = 0;
  for(let d=0; d<10; d++) await appPull(9e9 + d * 1000);   // 하루 열 번, 바뀐 것 없음
  T('하루 열 번 열어도 ' + READS + '번 (예전이면 ' + (서버총수*10) + '번)', READS < 서버총수 * 2);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})();
