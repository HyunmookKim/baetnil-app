// 4.20 안전장치 부수기 — 열어 준 것과 여전히 막아야 할 것, 둘 다 검사가 잡는가.
const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html', 'utf8');
const RUL = fs.readFileSync('firestore_rules.txt', 'utf8');
let ok = 0, bad = 0;

// [무엇을, 어느 파일에서, 무엇을 무엇으로, 어느 검사가 잡아야 하나]
const CASES = [
  ['글판을 다시 로그인해야 보게 한다', 'app',
   '  // ★ 4.20 — 로그인 없이도 읽는다.',
   '  if(!window.__user){ W.innerHTML = "글판은 로그인해야 볼 수 있습니다"; return; }\n  //',
   'openlive.js'],
  ['정박지를 다시 막는다', 'app',
   '  // 4.20 — 로그인 없이도 읽는다\n  if(off){',
   '  if(!off && !window.__user){ W.innerHTML="x"; return; }\n  if(off){',
   'openlive.js'],
  ['로그인 문을 없앤다 (말만 하고 길은 안 알려 준다)', 'app',
   "  try{ openAccount(); }catch(_){}\n  return true;",
   "  return true;",
   'openlive.js'],
  ['글쓰기가 그 문을 안 쓴다', 'app',
   "  if(needLogin('로그인해야 글을 쓸 수 있습니다')) return;",
   "  if(!window.__user){ alert('로그인해야 글을 쓸 수 있습니다'); return; }",
   'openlive.js'],
  // ── 규칙 쪽 — 열어야 할 것을 안 열었을 때
  ['연재를 다시 로그인해야 읽게 한다', 'rules',
   'match /series/{sid} {\n      allow read: if true;          // 누구나 본다 — 로그인은 쓸 때만',
   'match /series/{sid} {\n      allow read: if signedIn();',
   'opentest.js'],
  ['글판 규칙을 다시 닫는다', 'rules',
   'match /community/{postId} {\n      allow read: if true;          // 누구나 본다 — 로그인은 쓸 때만',
   'match /community/{postId} {\n      allow read: if signedIn();',
   'opentest.js'],
  // ── 규칙 쪽 — 열면 안 되는 것을 열었을 때 (이쪽이 훨씬 무섭다)
  ['배 안의 물품 기록까지 열어 버린다', 'rules',
   "match /items/{docId}    { allow read: if allowed(boatId,'stow','view');",
   "match /items/{docId}    { allow read: if true;",
   'opentest.js'],
  // ★ 좋아요 자국은 글판·정박지·장터 세 군데에 같은 모양으로 있다. 셋 다 부순다.
  ['좋아요 자국을 남이 보게 한다 (세 군데 다)', 'rules',
   'match /likes/{uid} {\n        allow read: if signedIn() && request.auth.uid == uid;',
   'match /likes/{uid} {\n        allow read: if true;',
   'opentest.js', 'all'],
  ['글판에 로그인 없이 글을 쓰게 한다', 'rules',
   'match /community/{postId} {\n      allow read: if true;          // 누구나 본다 — 로그인은 쓸 때만',
   'match /community/{postId} {\n      allow read: if true;\n      allow create: if true;',
   'opentest.js'],
];

for(const [name, which, from, to, test, all] of CASES){
  const base = which === 'app' ? SRC : RUL;
  const n = base.split(from).length - 1;
  const want = all ? n >= 1 : n === 1;
  if(!want){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  const broken = all ? base.split(from).join(to) : base.replace(from, to);
  let args;
  if(which === 'app'){
    fs.writeFileSync('work.sab.html', broken);
    args = [test, 'work.sab.html'];
  }else{
    fs.writeFileSync('rules.sab.txt', broken);
    args = [test, 'work.html', 'rules.sab.txt'];
  }
  const r = cp.spawnSync('node', args,
                         { encoding:'utf8', env:Object.assign({}, process.env, {TZ:'Asia/Seoul'}) });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name + '   (' + test + ')'); }
  else { bad++; console.log('★ 못 잡음 ← ' + name + '   (' + test + ')'); }
}
['work.sab.html','rules.sab.txt'].forEach(f=>{ try{ fs.unlinkSync(f); }catch(_){} });
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad ? 1 : 0);
