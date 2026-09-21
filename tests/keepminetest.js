// 4.85 — 폰에서 고친 것을 클라우드가 덮지 못하게 (자료 사라짐 사고)
//
// ★ 사장님 기록이 실제로 날아갔다. 앱을 켜면 받아온 것으로 폰 기록을 통째로
//   갈아치웠기 때문이다. 어느 쪽이 나중 것인지 안 따졌다.
//   여기서 보는 것은 딱 하나 — 「폰에서 고친 것이 살아남는가」.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 앱에서 진짜 함수를 뽑아 온다 ──────────────────────────────
const from = src.indexOf('const strHash =');
const to   = src.indexOf('function unsentCount()');
T('자국 코드 덩어리가 있다', from > 0 && to > from);
const blk = src.slice(from, src.indexOf('\n}', to) + 2);

let DB = {};                       // 가짜 「폰 안 기록」
const head = `
  const SYNC_COLLS = ['items','maint','repair','lockers'];
  const localColl = k => DB[k] || [];
  let mrTrash = DB.__mrtrash || [];
  let trash   = DB.__trash   || [];
  const snapOf = arr => { const m={}; arr.forEach(i=>{ m[String(i.id)] = JSON.stringify(i); }); return m; };
  let db = null; const idbSet = ()=>Promise.resolve(); const idbGet = ()=>Promise.resolve(null);
  const bkey = n => n; const localStorage = { setItem(){}, getItem(){ return null; } };
`;
const F = new Function('DB', head + blk +
  '\nreturn { keepMine, pullInto, markFromSnap, rowMark, unsentCount, deadIds, stampEdits,'
  + ' setMark(o){ cloudMark = o; }, setTrash(m,t){ mrTrash = m||[]; trash = t||[]; } };');
const A = F(DB);
const setDB = o => { for(const k in DB) delete DB[k]; Object.assign(DB, o); };
// 「올린 그대로」 자국을 만든다
const markOf = rows => A.markFromSnap(
  rows.reduce((m, x) => (m[String(x.id)] = JSON.stringify(x), m), {}));

// ── 1. 폰에서 고친 줄을 클라우드가 덮지 않는다 ────────────────
{
  const 올린것 = [{ id:1, name:'임펠러', qty:1 }, { id:2, name:'연료필터', qty:2 }];
  A.setMark({ items: markOf(올린것) });
  setDB({ items: [{ id:1, name:'임펠러', qty:9 }, { id:2, name:'연료필터', qty:2 }] });  // 1번을 폰에서 고침
  const out = A.keepMine('items', 올린것);
  const one = out.find(x => x.id === 1);
  T('폰에서 고친 줄이 살아남는다', one && one.qty === 9);
  T('안 건드린 줄은 클라우드 것을 쓴다', out.find(x => x.id === 2).qty === 2);
  T('줄 수가 안 늘어난다', out.length === 2);
}

// ── 2. 폰에만 있는 새 줄이 안 사라진다 ────────────────────────
{
  const 올린것 = [{ id:1, name:'임펠러' }];
  A.setMark({ items: markOf(올린것) });
  setDB({ items: [{ id:1, name:'임펠러' }, { id:9, name:'아직 안 올린 것' }] });
  const out = A.keepMine('items', 올린것);
  T('폰에서 새로 만든 줄이 살아남는다', !!out.find(x => x.id === 9));
}

// ── 3. 다른 기기에서 고친 것은 넘어온다 ───────────────────────
{
  const 올린것 = [{ id:1, name:'임펠러', qty:1 }];
  A.setMark({ items: markOf(올린것) });
  setDB({ items: [{ id:1, name:'임펠러', qty:1 }] });          // 폰은 안 건드림
  const out = A.keepMine('items', [{ id:1, name:'임펠러', qty:5 }]);   // 다른 기기가 고침
  T('다른 기기가 고친 것이 넘어온다', out[0].qty === 5);
}

// ── 4. 다른 기기에서 지운 것은 여기서도 사라진다 ──────────────
{
  const 올린것 = [{ id:1, name:'임펠러' }, { id:2, name:'연료필터' }];
  A.setMark({ items: markOf(올린것) });
  setDB({ items: 올린것.map(x => ({ ...x })) });
  const out = A.keepMine('items', [{ id:1, name:'임펠러' }]);   // 2번을 다른 기기가 지움
  T('다른 기기가 지운 것은 여기서도 사라진다', out.length === 1 && out[0].id === 1);
}

// ── 5. 자국이 아예 없으면 하나도 안 버린다 ────────────────────
{
  A.setMark({});
  setDB({ items: [{ id:1, name:'ㄱ' }, { id:2, name:'ㄴ' }] });
  const out = A.keepMine('items', [{ id:3, name:'ㄷ' }]);
  T('자국이 없으면 폰 것을 하나도 안 버린다', out.length === 3);
}

// ── 6. 빈 것·안 온 것으로 폰 기록을 건드리지 않는다 ───────────
{
  A.setMark({ items: {} });
  setDB({ items: [{ id:1, name:'ㄱ' }] });
  T('빈 목록이 와도 안 비운다', A.pullInto('items', []).length === 1);
  T('안 온 칸(null)은 그대로 둔다', A.pullInto('items', null).length === 1);
  T('안 온 칸(undefined)도 그대로 둔다', A.pullInto('items', undefined).length === 1);
}

// ── 7. 아직 못 올린 것을 셀 수 있다 (화면에 정직하게 적기 위해) ─
{
  const 올린것 = [{ id:1, a:1 }, { id:2, a:2 }];
  A.setMark({ items: markOf(올린것), maint:{}, repair:{}, lockers:{} });
  setDB({ items: [{ id:1, a:9 }, { id:2, a:2 }, { id:3, a:3 }] });
  T('못 올린 줄 수를 센다 (고친 것 1 + 새것 1)', A.unsentCount() === 2);
}

// ── 7-나. ★★★ 여기서 지운 것은 클라우드에서 와도 안 되살아난다
//   사장님이 안 쓰는 정기점검 초안을 다 지워 두셨는데, 판을 올리자 전부 되살아났다.
//   「자국이 없으면 하나도 안 버린다」 가 「지운 것도 되살린다」 가 되어 있었다.
{
  A.setMark({});                                   // 자국이 아예 없는 첫 판
  setDB({ maint: [{ id:'m2', name:'남긴 것' }] });
  A.setTrash([{ id:'maint_m1', kind:'maint', data:{ id:'m1', name:'지운 초안' } }], []);
  const out = A.keepMine('maint', [{ id:'m1', name:'지운 초안' }, { id:'m2', name:'남긴 것' }]);
  T('★★★ 휴지통에 있는 것은 클라우드에서 와도 안 되살아난다',
    out.length === 1 && out[0].id === 'm2', out);
  // 되살리기를 누르면(휴지통에서 빠지면) 다시 실린다
  A.setTrash([], []);
  setDB({ maint: [{ id:'m1', name:'지운 초안' }, { id:'m2', name:'남긴 것' }] });
  T('★ 되살리면 다시 실린다',
    A.keepMine('maint', [{ id:'m1', name:'지운 초안' }, { id:'m2', name:'남긴 것' }]).length === 2);
  // 적재표는 제 휴지통(trash)을 본다
  A.setMark({});
  setDB({ items: [{ id:9, name:'남긴 물품' }] });
  A.setTrash([], [{ id:8, name:'지운 물품' }]);
  T('★★ 적재표도 휴지통에 있는 것은 안 되살아난다',
    A.keepMine('items', [{ id:8, name:'지운 물품' }, { id:9, name:'남긴 물품' }]).length === 1);
  A.setTrash([], []);
}

// ── 7-다. ★★★ 여기서 더 나중에 고친 것을 클라우드 옛것이 덮지 않는다
//   사장님이 나중에 고친 내용이 옛 내용으로 돌아갔다. 자국만으로는
//   「어느 쪽이 나중 것인가」 를 알 수 없었기 때문이다. 이제 기록마다 고친 시각(_m)을 찍는다.
{
  A.setTrash([], []);
  // ★ 자국은 「올린 그대로」 라고 말한다 — 그 말만 믿으면 클라우드 것이 이긴다.
  //   시각이 없으면 여기서 사장님 자료가 옛것으로 돌아간다. 그래서 시각이 이겨야 한다.
  const 내줄 = { id:'m1', name:'나중에 고친 것', _m: 2000 };
  A.setMark({ maint: markOf([내줄]) });
  setDB({ maint: [내줄] });
  const out = A.keepMine('maint', [{ id:'m1', name:'옛 내용', _m: 1000 }]);
  T('★★★ 여기 것이 더 나중이면 클라우드 옛것이 못 덮는다 (자국이 뭐라 하든)',
    out.length === 1 && out[0].name === '나중에 고친 것', out);
  A.setMark({});
  setDB({ maint: [{ id:'m1', name:'여기 옛것', _m: 1000 }] });
  const out2 = A.keepMine('maint', [{ id:'m1', name:'남이 나중에 고친 것', _m: 3000 }]);
  T('★★ 남이 더 나중에 고쳤으면 그것이 온다',
    out2.length === 1 && out2[0].name === '남이 나중에 고친 것', out2);
  // 시각이 없는 옛 기록끼리는 예전 규칙(자국)을 따른다
  setDB({ maint: [{ id:'m1', name:'시각 없는 것' }] });
  T('★ 시각이 없어도 안 죽는다', A.keepMine('maint', [{ id:'m1', name:'클라우드 것' }]).length === 1);
}

// ── 7-라. 고친 시각을 실제로 찍는가 (saveLocal 이 부르는 그 함수)
{
  const row = { id:'m9', name:'처음' };
  setDB({ maint: [row] });
  A.stampEdits();                       // 처음 본 판 — 안 찍는다
  T('★ 처음 읽은 판에는 시각을 안 찍는다', row._m === undefined, row);
  row.name = '고침';
  A.stampEdits();                       // 바뀌었다
  T('★★★ 고치면 시각을 찍는다', typeof row._m === 'number' && row._m > 0, row);
  const 찍힌때 = row._m;
  A.stampEdits();                       // 안 바뀌었다
  T('★ 안 바뀐 것은 시각을 다시 안 찍는다', row._m === 찍힌때);
}

// ── 7-마. ★★★ 휴지통을 먼저 합쳐야 한다 (순서가 곧 버그였다)
//   다른 기기에서 지운 것이 이번 받아오기에 실려 와도, 휴지통을 나중에 합치면
//   그 표가 아직 없어서 그대로 되살아난다.
{
  const 소스 = src;
  const i휴 = 소스.indexOf("keepMine('mrtrash'");
  const i정 = 소스.indexOf("pullInto('maint'");
  T('★★★ 휴지통을 정비·적재표보다 먼저 합친다', i휴 > 0 && i정 > 0 && i휴 < i정,
    { 휴지통: i휴, 정비: i정 });
  T('★ 적재표 휴지통도 먼저 합친다',
    소스.indexOf("keepMine('trash'") > 0 && 소스.indexOf("keepMine('trash'") < 소스.indexOf("keepMine('items'"));
}

// ── 8. 옛 「갈아치우기」 코드가 남아 있으면 안 된다 ────────────
// ★ 주석에 남긴 옛 코드는 세지 않는다 — 왜 고쳤는지 적어 두는 것은 있어야 한다
const 산코드 = src.split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
const 갈아치움 = /if\(Array\.isArray\(r\.(maint|repair|voyage|lockers|reviews)\)[^\n]*\)\s*\1\s*=\s*r\./;
T('cloudPull 이 통째로 갈아치우지 않는다', !갈아치움.test(산코드));
T('cloudPull 이 합치는 문을 쓴다', /maint\s*=\s*pullInto\('maint',\s*r\.maint\)/.test(src));
T('적재표도 합치는 문을 쓴다', /items\s*=\s*cloudI\.length\s*\?\s*keepMine\('items'/.test(src));
T('휴지통도 합친다', /trash\s*=\s*keepMine\('trash'/.test(src));
T('도면도 합친다', /keepMine\('dgimgs'/.test(src));

// ── 9. 자국을 읽고 찍는 자리가 제대로 있나 ────────────────────
T('배 기록을 읽을 때 자국도 읽는다', /await markLoad\(\)/.test(src));
T('올리기 성공 때 자국을 찍는다', /markSet\('maint', curM\)/.test(src));
T('받아온 뒤 자국을 찍는다', /cloudMark\[k\] = markFromSnap\(snapOf\(PULLED\[k\]\)\)/.test(src));
// ★ 합치기가 자국 갱신보다 먼저여야 한다. 자국을 먼저 갈면 무엇이 폰 것인지 알 수 없다.
T('합치기가 자국 갱신보다 먼저다',
  src.indexOf("items = cloudI.length ? keepMine('items'") < src.indexOf("markSet('items', lastCloud)"));

console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
