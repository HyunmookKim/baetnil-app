// 5.29 — 탈퇴해도 커뮤니티 글·댓글은 남고 글쓴이는 「탈퇴한 회원」
//   사장님 (2026-10-01): 「다른 커뮤니티들은 어떻게 하는지 봐라 내가 알기론 그대로 놔두고
//   그사람 누군지 보면 탈퇴한 계정이라고 나오는거 같던데」 → 조사(다음·네이버·레딧) → 「2는 2로」
//
// 이 검사가 지키는 것
//  ① 탈퇴하면 정박지·중고 장터는 지우고, 커뮤니티 글은 남기되 이름·배 이름을 비우고 gone 표를 단다.
//     찾기 낱말(kw)에서도 이름이 빠진다.
//  ② 내가 쓴 댓글은 어느 글이든(커뮤니티·정박지·공개 배) 이름을 비우고 gone 표를 단다.
//  ③ 이름을 못 비우면 그 글·댓글은 지운다 — 이름이 남는 것보다 낫다.
//  ④ 세기만 할 때는 아무것도 바꾸지 않는다.
//  ⑤ 화면: gone 이면 「탈퇴한 회원」, 누를 수 없다. 차단 단추도 없다.
//  ⑥ 약관·처리방침 네 나라 말에 같은 말이 있고, 버전이 올라갔다.
//  ⑦ 규칙: 댓글은 본인이 이름 두 칸(byName·gone)만 고칠 수 있고, 내 댓글을 모아 찾을 수 있다.
// 사용: node leavetest.js ../www/index.html [규칙 파일]
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(_){}
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };

// ── ①~④ 탈퇴 처리 (모듈의 __account 를 가짜 파이어스토어로 돌린다)
const mod = src.slice(src.indexOf('<script type="module">'));
const a0 = mod.indexOf('window.__account = {'), a1 = mod.indexOf('window.__auth = {');
const accSrc = mod.slice(a0, a1);
function makeDb(opts){
  opts = opts || {};
  const db = {
    spots: [{ id:'s1', by:'me', name:'내 정박지', photos:['https://x/photos/me/a.jpg'] }, { id:'s2', by:'you', name:'남', photos:['https://x/photos/you/b.jpg'] }],
    market: [{ id:'m1', by:'me', title:'팝니다', photos:['https://x/photos/me/c.jpg'] }],
    community: [{ id:'c1', by:'me', byName:'김명준', boatName:'써니', title:'엔진 오일 교환기', kw:['김명준','엔진'] },
                { id:'c2', by:'you', byName:'남', title:'남의 글' }],
    comments: [{ path:'community/c2/comments/k1', by:'me', byName:'김명준', text:'좋네요' },
               { path:'spots/s2/comments/k2', by:'me', byName:'김명준', text:'수심 3m' },
               { path:'bpMeta/b1/comments/k3', by:'me', byName:'김명준', text:'멋진 배' },
               { path:'community/c2/comments/k4', by:'you', byName:'남', text:'고맙습니다' }]
  };
  const log = [];
  const ref = (coll, x) => ({ coll, x });
  const api = {
    fauth: { currentUser: { uid:'me' } },
    fdb: {},
    collection: (_, name) => ({ name }),
    collectionGroup: (_, name) => ({ group: name }),
    where: (f, op, v) => ({ f, v }),
    query: (c, w) => ({ c, w }),
    async getDocs(q){
      if(q.c.group === 'comments'){
        if(opts.noGroup) throw new Error('index');
        return { docs: db.comments.filter(x => x[q.w.f] === q.w.v).map(x => ({ ref: ref('comments', x), data: () => x })) };
      }
      return { docs: db[q.c.name].filter(x => x[q.w.f] === q.w.v).map(x => ({ ref: ref(q.c.name, x), data: () => x })) };
    },
    async updateDoc(r, patch){
      if(opts.failUpdate && opts.failUpdate(r)) throw new Error('permission-denied');
      log.push(['upd', r.coll, r.x.id || r.x.path, patch]); Object.assign(r.x, patch);
    },
    async deleteDoc(r){
      log.push(['del', r.coll, r.x.id || r.x.path]);
      const arr = db[r.coll]; arr.splice(arr.indexOf(r.x), 1);
    },
    doc: () => ({}),
    deleteUser: async () => {}
  };
  return { db, log, api };
}
function run(env){
  const w = { __dropMinePhotos: async (set) => { env.dropped = [...set]; } };
  const kwOf = function(){ const o = new Set(); for(const a of arguments){ String(a||'').split(/\s+/).filter(Boolean).forEach(x=>o.add(x)); } return [...o]; };
  const photoUrlsOf = o => ((o && o.photos) || []).filter(u => /^https?:/.test(u));
  const f = new Function('window','fauth','fdb','collection','collectionGroup','where','query','getDocs','updateDoc','deleteDoc','doc','deleteUser','kwOf','photoUrlsOf',
    accSrc + '\nreturn window.__account;');
  const A = env.api;
  return f(w, A.fauth, A.fdb, A.collection, A.collectionGroup, A.where, A.query, A.getDocs.bind(A), A.updateDoc.bind(A), A.deleteDoc.bind(A), A.doc, A.deleteUser, kwOf, photoUrlsOf);
}
(async () => {
  T('계정 창구를 찾았다', a0 > 0 && a1 > a0);
  {
    const e = makeDb(); const acc = run(e);
    const r = await acc.minePosts(false);
    T('④ 세기만 할 때는 사진도 안 지운다', !e.dropped);
    T('④ 세기 — 지울 것 2 · 남길 글 1 · 남길 댓글 3', r.del === 2 && r.keep === 1 && r.cmt === 3, r);
    T('④ 세기만 할 때는 아무것도 안 바꾼다', e.log.length === 0, e.log);
  }
  {
    const e = makeDb(); const acc = run(e);
    await acc.minePosts(true);
    T('① 내 정박지·장터는 지운다', !e.db.spots.some(x => x.id === 's1') && !e.db.market.length, e.log);
    T('① 남의 정박지는 그대로', e.db.spots.some(x => x.id === 's2'));
    const c1 = e.db.community.find(x => x.id === 'c1');
    T('① 내 커뮤니티 글은 남는다', !!c1);
    T('① 이름·배 이름이 비고 gone 표', c1 && c1.byName === '' && c1.boatName === '' && c1.gone === true, c1);
    T('① 찾기 낱말에서 이름이 빠진다', c1 && !c1.kw.includes('김명준') && c1.kw.includes('엔진'), c1 && c1.kw);
    T('① 글 내용·글쓴이 번호는 그대로 (운영자 처리·신고 기록용)', c1 && c1.title === '엔진 오일 교환기' && c1.by === 'me');
    const mine = e.db.comments.filter(x => x.by === 'me');
    T('② 내 댓글 셋 모두 남는다(커뮤니티·정박지·공개 배)', mine.length === 3);
    T('② 내 댓글 이름이 비고 gone 표', mine.every(x => x.byName === '' && x.gone === true && x.text), mine);
    const yours = e.db.comments.find(x => x.by === 'you');
    T('② 남의 댓글은 손대지 않는다', yours && yours.byName === '남' && !yours.gone);
    const upd = e.log.filter(x => x[0] === 'upd' && x[1] === 'comments');
    T('② 댓글은 이름 두 칸만 고친다(규칙과 같게)', upd.every(x => Object.keys(x[3]).sort().join() === 'byName,gone'), upd);
    T('남의 글은 손대지 않는다', e.db.community.find(x => x.id === 'c2').byName === '남');
    T('★ 지운 정박지·장터의 내 사진을 창고에서 치운다 (남의 것은 안 건드림)',
      JSON.stringify((e.dropped || []).sort()) === JSON.stringify(['https://x/photos/me/a.jpg','https://x/photos/me/c.jpg']), e.dropped);
  }
  {
    const e = makeDb({ failUpdate: r => r.coll === 'community' || (r.x.path || '').indexOf('spots/') === 0 });
    const acc = run(e);
    await acc.minePosts(true);
    T('③ 글 이름을 못 비우면 글을 지운다', !e.db.community.some(x => x.id === 'c1'), e.log);
    T('③ 댓글 이름을 못 비우면 그 댓글만 지운다', !e.db.comments.some(x => x.path === 'spots/s2/comments/k2')
      && e.db.comments.some(x => x.path === 'community/c2/comments/k1' && x.gone));
    T('③ 이름이 남은 내 것이 없다', !e.db.community.concat(e.db.comments).some(x => x.by === 'me' && x.byName));
  }
  {
    const e = makeDb({ noGroup: true }); const acc = run(e);
    let threw = false; try{ await acc.minePosts(true); }catch(_){ threw = true; }
    T('댓글 찾기가 안 되어도 탈퇴는 멈추지 않는다', !threw);
  }

  // ── ⑤ 화면
  {
    const fnSrc = n => { let i = src.indexOf('function ' + n + '('); let d = 0, j = src.indexOf('{', i); for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } } } return src.slice(i, j); };
    const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const t = s => s, jsq = s => String(s);
    const f = new Function('esc','t','jsq', fnSrc('whoName') + '\n' + fnSrc('whoLink') + '\nreturn {whoName, whoLink};')(esc, t, jsq);
    const g = f.whoLink('me', '', 'talk:1', true);
    T('⑤ gone 이면 「탈퇴한 회원」', /탈퇴한 회원/.test(g), g);
    T('⑤ 누를 수 없다(프로필을 안 연다)', !/onclick/.test(g) && !/openProfile/.test(g), g);
    T('⑤ 아니면 예전처럼 누를 수 있다', /openProfile/.test(f.whoLink('u1', '김', 'talk:1')));
    T('⑤ whoName', f.whoName({ gone:true, byName:'' }) === '탈퇴한 회원' && f.whoName({ byName:'김' }) === '김');
    const n = (src.match(/whoLink\(c\.by, c\.byName, [^)]*, c\.gone\)/g) || []).length;
    T('⑤ 댓글 네 곳(커뮤니티·배 게시판·공개 배·정박지)이 gone 을 넘긴다', n === 4, n);
    T('⑤ 커뮤니티 글 목록·본문이 gone 을 넘긴다', (src.match(/whoLink\(po\.by, po\.byName, [^)]*, po\.gone\)/g) || []).length === 2);
    T('⑤ 탈퇴한 회원은 「이 사람 차단」 이 없다', /po\.by && !po\.gone && String\(po\.by\)/.test(src));
    T('⑤ 흐린 이름 모양이 있다', /\.whogone\{/.test(src));
  }

  // ── ⑥ 약관·처리방침
  {
    const ver = (src.match(/const LEGAL_VER\s*=\s*'([\d.]+)'/) || [])[1];
    T('⑥ 법 문서 버전이 2.2 (5.45 원문 사실 바로잡기 — 다시 동의를 받는다)', ver === '2.2', ver);
    T('⑥ 시행일이 네 나라 말 모두 10월 15일', /ko:'2026년 10월 15일', en:'October 15, 2026', ru:'15 октября 2026 г\.',\s*ja:'2026年10月15日'/.test(src));
    // ★ 5.45 — 전수조사로 「탈퇴」 를 Leave·Выход(로그아웃처럼 읽힘)에서 Deleting your account·При удалении аккаунта 로 바꿨다
    const need = {
      ko: ['② 탈퇴해도 커뮤니티에 쓴 글과 댓글은 지워지지 않습니다', '커뮤니티 글·댓글: 이용자가 지울 때까지. 탈퇴해도 지워지지 않고', '커뮤니티에 쓴 글과 댓글은 지우지 않고'],
      en: ['2. Deleting your account does not delete the posts and comments you wrote', 'Community posts and comments: until you delete them. They are not deleted when you delete your account', 'The posts and comments you wrote in the community are not deleted'],
      ru: ['2. При удалении аккаунта ваши посты и комментарии в сообществе сохраняются', 'Посты и комментарии в сообществе: до удаления вами', 'Посты и комментарии в сообществе не удаляются'],
      ja: ['② 退会しても、コミュニティに書いた投稿とコメントは削除されません', 'コミュニティの投稿・コメント：利用者が削除するまで', 'コミュニティに書いた投稿とコメントは削除せず']
    };
    for(const [k, arr] of Object.entries(need)) T('⑥ ' + k + ' 약관 제11조·처리방침 4번·16번', arr.every(x => src.includes(x)), arr.filter(x => !src.includes(x)));
    T('⑥ 옛 약속(「게시물: … 탈퇴할 때까지」)이 남아 있지 않다', !src.includes('배 기록·게시물: 이용자가 지울 때까지, 또는 탈퇴할 때까지')
      && !src.includes('Boat records and posts: until you delete them, or until you leave'));
    T('⑥ 화면 말 「탈퇴한 회원」 이 네 나라 말에 있다', /'탈퇴한 회원':'Deleted account'/.test(src) && /'탈퇴한 회원':'Удалённый аккаунт'/.test(src) && /'탈퇴한 회원':'退会したユーザー'/.test(src));
  }

  // ── ⑦ 규칙
  if(rules){
    T('⑦ 내 댓글을 모아 찾을 수 있다(컬렉션 그룹, 내 것만)', /match \/\{path=\*\*\}\/comments\/\{cmtId\} \{\s*allow read: if request\.auth != null && resource\.data\.by == request\.auth\.uid;/.test(rules));
    const blocks = rules.split('match /comments/{cmtId} {').slice(1).map(b => b.slice(0, 1400));
    T('⑦ 댓글 방 셋', blocks.length === 3, blocks.length);
    T('⑦ 셋 모두 본인이 이름 두 칸만 고칠 수 있다', blocks.every(b => /allow update: if signedIn\(\) && resource\.data\.by == request\.auth\.uid\s*&& request\.resource\.data\.diff\(resource\.data\)\.affectedKeys\(\)\.hasOnly\(\['byName', 'gone'\]\)\s*&& request\.resource\.data\.byName == ''\s*&& request\.resource\.data\.gone == true;/.test(b)));
    T('⑦ 댓글 고치기를 막던 줄이 남아 있지 않다', blocks.every(b => !/allow update: if false;/.test(b.split('match /')[0])));
  } else console.log('  (규칙 파일 없음 — ⑦ 건너뜀)');

  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})();
