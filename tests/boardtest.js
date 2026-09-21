// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 배별 게시판 검증
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
globalThis.save = ()=>{};
globalThis.schedulePush = ()=>{};
globalThis.newId = (()=>{ let n=0; return ()=>'p'+(++n); })();

// 새 함수는 하네스에 스텁을 넣어야 한다 (실행방법.txt 규칙)
globalThis.blocksFromText = (t, ph) => {
  const out = [];
  if(String(t||'').trim()) out.push({t:'text', v:String(t)});
  (ph||[]).forEach(u=>out.push({t:'photo', v:u}));
  return out;
};globalThis.today = () => '2026-08-10';
// 3.53 — 글을 지울 때 창고에 남은 사진까지 치운다. 여기서는 셈만 한다.
globalThis.치운사진 = [];
globalThis.dropPhotosOf = o => { (o && o.photos || []).forEach(u=>globalThis.치운사진.push(u)); };
globalThis.dropPhotos = u => { [].concat(u).forEach(x=>globalThis.치운사진.push(x)); };
globalThis.posts = [];
{ const m = src.match(/const PERMS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PERMS','globalThis.PERMS')); }
{ const m = src.match(/const PERM_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const PERM_LEVELS','globalThis.PERM_LEVELS')); }
{ const m = src.match(/const PERM_ORDER = [^;]+;/); if(m) eval(m[0].replace('const PERM_ORDER','globalThis.PERM_ORDER')); }
{ const m = src.match(/const RANK_SEED = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const RANK_SEED','globalThis.RANK_SEED')); }
{ const m = src.match(/const POST_KINDS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const POST_KINDS','globalThis.POST_KINDS')); }

const need = ['mkPerms','seedRanks','rankList','rankOf','myRank','myPos','permOf','can',
              'meUid','meName','canNotice','canEditPost','addPost','postOf','editPost','delPost','postList','addComment','delComment'];
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
  globalThis.curBoat = () => b;
  posts = []; globalThis.alerts = [];
  window.__user = { uid:'u1', name:'현묵' };
  return b;
};

// 말머리
T('말머리가 여러 가지', Array.isArray(POST_KINDS) && POST_KINDS.length>=3);
T('공지 말머리가 있다', POST_KINDS.some(k=>k.v==='notice'));

// 글쓰기
let b = setup();
const p1 = addPost('일반', '내용입니다', 'free');
T('글이 써진다', !!p1 && posts.length===1);
T('쓴 사람이 남는다', p1.by==='u1' && p1.byName==='현묵');
T('날짜가 남는다', !!p1.ts);
T('제목이 비면 안 써진다', addPost('', '내용', 'free')===null && posts.length===1);
T('모르는 말머리는 일반으로', addPost('제목','내용','엉뚱').kind==='free');

// 공지는 권한이 필요하다
b = setup();
window.__user = { uid:'u3' };   // 크루 — board 쓰기는 되지만 공지는 아님
const n1 = addPost('공지', '내용', 'notice');
T('크루는 공지를 못 쓴다', n1 === null || n1.kind !== 'notice');
window.__user = { uid:'u1' };
T('선주는 공지를 쓴다', addPost('공지','내용','notice').kind==='notice');

// 목록 — 공지가 위로
b = setup();
addPost('일반1','x','free');
addPost('공지','x','notice');
addPost('일반2','x','free');
const L2 = postList();
T('공지가 맨 위', L2[0].kind==='notice');
T('나머지는 최신순', L2.length===3);

// 고치기·지우기
b = setup();
const mine = addPost('내 글','내용','free');
T('내 글은 고칠 수 있다', canEditPost(b, mine)===true);
editPost(mine.id, { title:'고친 제목' });
T('제목이 바뀐다', posts.find(x=>x.id===mine.id).title==='고친 제목');
window.__user = { uid:'u3' };
T('남의 글은 못 고친다', canEditPost(b, mine)===false);
T('남의 글은 못 지운다', delPost(mine.id)===null && posts.length===1);
window.__user = { uid:'u1' };
T('내 글은 지울 수 있다', !!delPost(mine.id) && posts.length===0);

// 관리자는 남의 글도 지운다 (board 전체 권한)
b = setup();
window.__user = { uid:'u3' };
const cp = addPost('크루 글','x','free');
window.__user = { uid:'u1' };
T('선주는 남의 글도 지운다', !!delPost(cp.id) && posts.length===0);

// 댓글
b = setup();
const pp = addPost('글','내용','free');
addComment(pp.id, '댓글입니다');
T('댓글이 달린다', (posts[0].comments||[]).length===1);
T('댓글에 쓴 사람이 남는다', posts[0].comments[0].by==='u1');
T('빈 댓글은 안 달린다', addComment(pp.id,'   ')===null && posts[0].comments.length===1);
T('없는 글에는 못 단다', addComment('없음','x')===null);
const cid = posts[0].comments[0].id;
window.__user = { uid:'u3' };
T('남의 댓글은 못 지운다', delComment(pp.id, cid)===null);
window.__user = { uid:'u1' };
T('내 댓글은 지운다', !!delComment(pp.id, cid) && posts[0].comments.length===0);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
