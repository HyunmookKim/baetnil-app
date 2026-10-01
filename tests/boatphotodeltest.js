// 5.29 — 배를 통째로 지울 때 그 안의 내 사진도 창고에서 치운다 (사장님 「다 그렇게 해라」)
//   ① 기록·배 문서·소개에 들어 있던 사진 주소를 모아, 배를 다 지운 뒤에 치운다.
//   ② 내 커뮤니티 글에 들어간 사진(정비 기록을 글에 넣으면 같은 주소)은 남긴다 — 탈퇴해도 글은 남는다.
//   ③ 배 문서를 못 지우면(남의 배) 사진도 안 치운다.
// 사용: node boatphotodeltest.js ../www/index.html
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const a = src.indexOf('    async function keepPhotoSet(){'), b = src.indexOf('    // ── 신고', a);
T('배 지우기 코드를 찾았다', a > 0 && b > a);
const code = src.slice(a, b);
function photoUrlsOf(o){
  const out = []; if(!o) return out;
  const add = x => (Array.isArray(x) ? x : []).forEach(u => { if(typeof u === 'string' && /^https?:/.test(u)) out.push(u); });
  add(o.photos); add(o.thumbs);
  (Array.isArray(o.blocks) ? o.blocks : []).forEach(x => { if(x && x.t === 'photo') out.push(x.v); });
  return [...new Set(out)];
}
function env(opts){
  opts = opts || {};
  const dropped = [];
  const store = {
    'boats/B': { name:'써니', intro:[{ t:'photo', v:'https://p/me/intro.jpg' }, { t:'text', v:'안녕' }] },
    'boats/B/maint': [{ photos:['https://p/me/m1.jpg', 'https://p/me/shared.jpg'] }],
    'boats/B/repair': [{ photos:['https://p/crew/r1.jpg'], thumbs:['https://p/me/r1t.jpg'] }],
    'community': [{ by:'me', blocks:[{ t:'photo', v:'https://p/me/shared.jpg' }] }]
  };
  const api = {
    fauth: { currentUser: { uid:'me' } }, fdb: {},
    collection: (_, ...p) => ({ path: p.join('/') }),
    doc: (_, ...p) => ({ path: p.join('/') }),
    query: (c) => c, where: () => ({}),
    async getDoc(r){ const x = store[r.path]; return { exists: () => !!x, data: () => x }; },
    async getDocs(c){ const arr = store[c.path] || []; return { docs: arr.map(x => ({ ref:{}, data: () => x })) }; },
    writeBatch: () => ({ delete(){}, async commit(){} }),
    async deleteDoc(r){ if(opts.deny && r.path === 'boats/B'){ const e = new Error('x'); e.code = 'permission-denied'; throw e; } },
    dropPhotos: async (urls) => { dropped.push(...urls); return urls.length; }
  };
  const w = { __boatIndex: { del: async () => {} } };
  const f = new Function('window','fauth','fdb','collection','doc','query','where','getDoc','getDocs','writeBatch','deleteDoc','dropPhotos','photoUrlsOf',
    code + '\nreturn window;');
  f(w, api.fauth, api.fdb, api.collection, api.doc, api.query, api.where, api.getDoc, api.getDocs, api.writeBatch, api.deleteDoc, api.dropPhotos, photoUrlsOf);
  return { w, dropped };
}
(async () => {
  {
    const e = env(); const r = await e.w.__delBoat('B');
    T('배를 지웠다', r === true, r);
    const d = e.dropped.slice().sort();
    T('① 기록·썸네일·소개 사진을 치운다', ['https://p/me/m1.jpg','https://p/me/r1t.jpg','https://p/me/intro.jpg'].every(u => d.includes(u)), d);
    T('② 내 커뮤니티 글에 들어간 사진은 남긴다', !d.includes('https://p/me/shared.jpg'), d);
    T('남(구성원)의 사진도 목록에는 들지만 창고 규칙이 막는다 — 앱은 지우려 해도 된다', d.includes('https://p/crew/r1.jpg'));
  }
  {
    const e = env({ deny:true }); const r = await e.w.__delBoat('B');
    T('③ 배 문서를 못 지우면 사진도 안 치운다', r === 'denied' && e.dropped.length === 0, { r, d: e.dropped });
  }
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})();
