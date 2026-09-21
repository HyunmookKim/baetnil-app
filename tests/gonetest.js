// 4.89 — 완전삭제한 것이 되살아나던 나머지 절반 (묘비)
//
// ★ 사장님이 겪으신 일 — 정기점검 초안을 싹 지웠는데 판본을 바꾸니 다시 올라와 있었다.
//   4.88 에서 절반 고쳤다(휴지통에 있으면 안 싣는다). 남은 절반은 이것이다 —
//   휴지통까지 비우면 표가 사라져서, 며칠 꺼져 있던 다른 기기가 옛 줄을 도로 올린다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?' — '+JSON.stringify(w).slice(0,200):'')); } };

// ── 앱에서 진짜 코드를 뽑아 온다 ─────────────────────────────────────
const from = src.indexOf('const GONE_DAYS');
const to   = src.indexOf('function unsentCount()');
T('묘비 코드와 자국 코드가 있다', from > 0 && to > from);
const blk = src.slice(from, src.indexOf('\n}', to) + 2);

const head = `
  const SYNC_COLLS = ['items','maint','repair'];
  const localColl = k => DB[k] || [];
  let mrTrash = [], trash = [];
  const strHash = s => { let h=0; const x=String(s);
    for(let i=0;i<x.length;i++) h=(h*31+x.charCodeAt(i))|0; return h.toString(36); };
  let cloudMark = {};
  const markFromSnap = snap => { const o={}; for(const k in (snap||{})) o[k]=strHash(snap[k]); return o; };
  const rowMark = x => strHash(JSON.stringify(x));
  const markSave = ()=>{};
  const snapOf = arr => { const m={}; arr.forEach(i=>{ m[String(i.id)]=JSON.stringify(i); }); return m; };
  let db=null; const idbSet=()=>Promise.resolve(); const idbGet=()=>Promise.resolve(null);
  const bkey=n=>n; const localStorage={setItem(){},getItem(){return null;}};
`;
const F = new Function('DB', head + blk +
  '\nreturn { keepMine, deadIds, isGone, goneStub, gonePrune, trashShown, mrTrashShown,'
  + ' markFromSnap, rowMark,'
  + ' setMark(o){ cloudMark = o; },'
  + ' put(m,t){ mrTrash = m||[]; trash = t||[]; },'
  + ' get(){ return { mrTrash, trash }; } };');
const DB = {};
const A = F(DB);
const setDB = o => { for(const k in DB) delete DB[k]; Object.assign(DB, o); };
const markOf = rows => A.markFromSnap(
  rows.reduce((m,x)=>(m[String(x.id)]=JSON.stringify(x),m),{}));
const 어제 = new Date(Date.now()-86400000).toISOString();
const 옛날 = new Date(Date.now()-200*86400000).toISOString();   // 반 년 하고도 더 전

// ══ 1. 표는 「지운 것」으로 센다 ══════════════════════════════════════
{
  const 표 = { id:'maint_7', kind:'maint', data:{id:7}, gone:true, goneAt:어제 };
  A.put([표], []);
  T('★★★ 완전삭제한 표도 「지운 것」으로 친다', A.deadIds('maint').has('7'));
  A.put([], [{ id:11, gone:true, goneAt:어제 }]);
  T('★★★ 적재표 물품도 마찬가지', A.deadIds('items').has('11'));
}

// ══ 2. ★ 사장님이 겪으신 일 그대로 ═══════════════════════════════════
//    ① 정기점검 초안을 지운다 → 휴지통
//    ② 휴지통까지 비운다 → 표만 남는다
//    ③ 며칠 꺼져 있던 폰이 돌아와 옛 줄을 도로 올린다
//    ④ 그 줄이 클라우드에서 내려온다 — 되살아나면 안 된다
{
  const 초안 = { id:7, name:'엔진오일 및 필터 교채', _m:1000 };
  const 표 = A.goneStub({ id:'maint_7', kind:'maint', data:{id:7},
                          delAt:어제, name:'x', 큰것:'사진 데이터' });
  T('★ 표에는 속이 안 남는다 (번호만)', !표.큰것 && !표.name && 표.data.id === 7, 표);
  T('★ 표에 지운 때가 찍힌다', !!표.goneAt);

  A.put([표], []);
  setDB({ maint: [] });                       // 내 폰에는 이미 없다
  A.setMark({ maint: markOf([초안]) });        // 예전에 이 줄을 올린 적이 있다
  const 결과 = A.keepMine('maint', [초안]);     // 꺼져 있던 폰이 도로 올린 것이 내려온다
  T('★★★ 휴지통까지 비운 뒤에도 되살아나지 않는다',
    결과.findIndex(x=>String(x.id)==='7') < 0, 결과);
}

// ══ 3. 표가 없으면 되살아난다 — 시험이 진짜로 보고 있다는 증거 ═══════
{
  const 초안 = { id:7, name:'엔진오일 및 필터 교채', _m:1000 };
  A.put([], []);                              // 표가 없는 옛 방식
  setDB({ maint: [] });
  A.setMark({ maint: markOf([초안]) });
  const 결과 = A.keepMine('maint', [초안]);
  T('★★★ (대조) 표가 없으면 되살아난다 — 그래서 표가 필요하다',
    결과.findIndex(x=>String(x.id)==='7') >= 0, 결과);
}

// ══ 4. 표는 사람 눈에 안 보인다 ══════════════════════════════════════
{
  A.put([{ id:'maint_7', kind:'maint', data:{id:7}, gone:true, goneAt:어제 },
         { id:'maint_8', kind:'maint', data:{id:8}, delAt:어제 }],
        [{ id:11, gone:true, goneAt:어제 }, { id:12, name:'임펠러' }]);
  T('★★★ 비운 것은 휴지통에 안 보인다 (정비·기록)',
    A.mrTrashShown().length === 1 && A.mrTrashShown()[0].id === 'maint_8');
  T('★★★ 비운 것은 휴지통에 안 보인다 (적재표)',
    A.trashShown().length === 1 && A.trashShown()[0].id === 12);
  T('★★ 그래도 「지운 것」으로는 여전히 센다',
    A.deadIds('maint').has('7') && A.deadIds('items').has('11'));
}

// ══ 5. 반 년 지난 표는 걷어낸다 (묘비를 영원히 들지 않는다) ══════════
{
  A.put([{ id:'maint_7', kind:'maint', data:{id:7}, gone:true, goneAt:옛날 },
         { id:'maint_9', kind:'maint', data:{id:9}, gone:true, goneAt:어제 }],
        [{ id:11, gone:true, goneAt:옛날 }, { id:12, name:'임펠러' }]);
  const 바뀜 = A.gonePrune();
  const g = A.get();
  T('★★ 걷어낼 것이 있으면 알려 준다', 바뀜 === true);
  T('★★★ 반 년 지난 표는 걷어낸다', g.mrTrash.length === 1 && g.mrTrash[0].id === 'maint_9', g.mrTrash);
  T('★★★ 아직 안 지난 표는 그대로 둔다', A.deadIds('maint').has('9'));
  T('★★★ 표가 아닌 진짜 휴지통 줄은 절대 안 건드린다',
    g.trash.length === 1 && g.trash[0].id === 12, g.trash);
}

// ══ 6. 걷어낼 것이 없으면 아무것도 안 한다 ═══════════════════════════
{
  A.put([{ id:'maint_9', kind:'maint', data:{id:9}, gone:true, goneAt:어제 }],
        [{ id:12, name:'임펠러' }]);
  T('★★ 걷어낼 것이 없으면 「안 바뀌었다」 고 한다', A.gonePrune() === false);
  T('★★ 사람 기록은 그대로다', A.get().trash.length === 1);
}

// ══ 7. 날짜가 깨져 있어도 표를 함부로 버리지 않는다 ══════════════════
{
  A.put([{ id:'maint_9', kind:'maint', data:{id:9}, gone:true, goneAt:'이상한 값' }], []);
  A.gonePrune();
  T('★★★ 지운 때를 못 읽으면 표를 남긴다 (버리는 쪽으로 안 기운다)',
    A.get().mrTrash.length === 1);
}

console.log('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
