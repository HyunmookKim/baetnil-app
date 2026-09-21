// 4.90 — 사진을 버릴 때 「덜 중요한 것부터」 버린다
//
// ★ 사장님 지적 — 「오래된 거 버리는 것도 내 배 내용이 아닌 별로 안 중요한
//   사진들부터 버리고, 내 배 내용은 좀 남겨놔야 하지 않나」
//
//   여태 두 가지가 어긋나 있었다 —
//   ① sw.js 의 trimPhotos 는 **아무 데서도 안 불렸다** (내 배 사진이 안 버려졌다)
//   ② 그것이 불렸다 해도 **넣은 순서**로 버렸다 (도면이 제일 먼저 죽는다)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const sw  = fs.readFileSync(__dirname + '/sw.js', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?' — '+JSON.stringify(w).slice(0,200):'')); } };

// ── 앱에서 진짜 함수를 뽑아 온다 ─────────────────────────────────────
const from = src.indexOf('function boatPhotoUrls(){');
const to   = src.indexOf('async function keepPhoto(url){');
T('사진 순서 코드가 있다', from > 0 && to > from);
const blk = src.slice(from, to);

const head = `
  let items=[], maint=[], repair=[], voyage=[], vdocs=[], posts=[], dgImgs={};
  const isGear = x => !!(x && x.typ === 'gear');
  const dgKeys = () => Object.keys(dgImgs);
  const window = { items:null, repair:null, voyage:null, vdocs:null, posts:null };
`;
const F = new Function('D', head + blk +
  `\n  items=D.items||[]; maint=D.maint||[]; repair=D.repair||[]; voyage=D.voyage||[];
     vdocs=D.vdocs||[]; posts=D.posts||[]; dgImgs=D.dgImgs||{};
     window.items=items; window.repair=repair; window.voyage=voyage;
     window.vdocs=vdocs; window.posts=posts;
     return boatPhotoUrls();`);

const U = (k,i) => 'https://x/'+k+i+'.jpg';
const 자료 = {
  dgImgs: { plan: U('도면',1), side: U('도면',2) },
  maint: [ { id:1, typ:'gear', photos:[U('장비',1)] },
           { id:2,             photos:[U('점검',1)] } ],
  repair: [ { id:3, photos:[U('수리',1)] } ],
  items:  [ { id:4, photos:[U('적재표',1)] } ],
  vdocs:  [ { id:5, photos:[U('서류',1)] } ],
  posts:  [ { id:6, photos:[U('게시판',1)] } ],
  voyage: [ { id:7, photos:[U('항해',1)] } ],
};
const 순서 = F(자료);
const 자리 = k => 순서.findIndex(u => u.indexOf('/'+k) === 8 || u.includes('/'+k));

console.log('  순서: ' + 순서.map(u=>u.split('/')[3].replace('.jpg','')).join(' → '));

// ══ 1. ★★★ 도면이 맨 앞이다 ═══════════════════════════════════════════
T('★★★ 도면이 제일 먼저 남는다 (없으면 화면이 통째로 못 쓴다)',
  순서[0].includes('도면') && 순서[1].includes('도면'), 순서);

// ══ 2. ★★★ 항해일지가 맨 뒤다 (제일 먼저 버려진다) ══════════════════
T('★★★ 항해일지가 제일 먼저 버려진다', 순서[순서.length-1].includes('항해'), 순서);

// ══ 3. ★★★ 사장님이 정하신 순서 그대로인가 ══════════════════════════
const 정한순서 = ['도면','장비','점검','수리','적재표','서류','게시판','항해'];
const 실제 = 순서.map(u => 정한순서.find(k => u.includes(k)));
const 본 = [...new Set(실제)];
T('★★★ 도면 · 장비 · 점검 · 수리 · 적재표 · 서류 · 게시판 · 항해 차례다',
  JSON.stringify(본) === JSON.stringify(정한순서), 본);

// ══ 4. 배에서 필요한 것이 추억보다 앞이다 ═════════════════════════════
T('★★ 장비가 항해일지보다 앞이다', 자리('장비') < 자리('항해'));
T('★★ 적재표가 항해일지보다 앞이다', 자리('적재표') < 자리('항해'));
T('★★ 도면이 적재표보다 앞이다', 자리('도면') < 자리('적재표'));

// ══ 5. 같은 사진이 두 번 안 들어간다 ══════════════════════════════════
T('★ 같은 사진은 한 번만 센다', 순서.length === new Set(순서).size);

// ══ 6. 자료가 비어도 안 터진다 ════════════════════════════════════════
let 빈것 = null;
try{ 빈것 = F({}); }catch(e){ 빈것 = e; }
T('★ 기록이 하나도 없어도 안 터진다', Array.isArray(빈것) && 빈것.length === 0, String(빈것));

// ══ 7. 문이 하나인가 — sw.js 는 내 배 사진을 안 버린다 ═══════════════
T('★★★ sw.js 에는 내 배 사진을 버리는 코드가 없다 (문 하나)',
  !/async function trimPhotos/.test(sw));
T('★★ sw.js 가 내 배 사진 한도 숫자를 따로 갖고 있지 않다',
  !/const PHOTO_KEEP\s*=/.test(sw));
T('★★ 남의 사진(SEEN) 자리는 sw.js 가 그대로 치운다', /async function trimSeen/.test(sw));

// ══ 8. 앱 쪽에 진짜로 버리는 코드가 있고, 불린다 ═════════════════════
T('★★★ 앱에 버리는 코드가 있다', /async function trimBoatPhotos\(\)/.test(src));
T('★★★ 그리고 실제로 불린다', /trimBoatPhotos\(\);/.test(src));
T('★★★ 빠듯하면 남의 사진부터 비운다', /async function seenDropIfTight\(\)/.test(src)
  && /seenDropIfTight\(\)/.test(src.slice(src.indexOf('async function keepBoatPhotos'))));

// ══ 9. 한도가 폰 여유를 본다 ══════════════════════════════════════════
T('★★★ 한도가 못박힌 숫자가 아니다', /async function photoKeepN\(\)/.test(src));
T('★★ 아무리 빠듯해도 400장은 담는다', /PHOTO_KEEP_MIN\s*=\s*400/.test(src));

// ══ 10. 기록이 통째로 날아가지 않게 표시해 둔다 ══════════════════════
T('★★★ persist() 를 부른다', /navigator\.storage[\s\S]{0,80}persist\(\)/.test(src)
  || /st\.persist\(\)/.test(src));
T('★★★ 그리고 실제로 불린다', /askPersist\(\);/.test(src));
T('★★ 이미 지켜지고 있으면 다시 안 묻는다', /persisted\(\)/.test(src));

// ══ 11. 아이폰 7일 규칙을 사람에게 말한다 ════════════════════════════
T('★★★ 아이폰 7일 규칙을 화면에 적어 둔다', /7일 넘게 앱을 안 열었을 때 기록을 지웁니다/.test(src));
T('★★ 아이폰일 때만 보여 준다', /isIOS\(\)\s*\?[\s\S]{0,200}7일 넘게/.test(src));

console.log('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
