// 5.30 — 자동검사 계정과 그 글은 실제 앱 어디에도 안 보인다 (사장님: 「검사 계정이든 글이든 다 … 진짜 어플에 안보이게 해라」)
//   5.27 은 커뮤니티·정박지·장터 목록만 거렀다. 운영자 화면(회원·신고·배·고객센터)과 배 둘러보기에는 보였다.
// 사용: node e2eadmintest.js ../www/index.html
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const a = src.indexOf('    const E2E_RE ='), b = src.indexOf('    window.__e2eHideAdmin = e2eHideAdmin;', a);
T('검사 계정 거르기 코드를 찾았다', a > 0 && b > a);
const code = src.slice(a, b) + '\nreturn { e2eHideAdmin, e2eHide, e2eNamed, setMe(e){ me = e; } };';
function make(users, boatIndex){
  let me = 'owner@gmail.com';
  const fauth = { get currentUser(){ return { email: me }; } };
  const fdb = {};
  const collection = (_, n) => n;
  const getDocs = async n => ({ docs: (n === 'users' ? users : boatIndex).map(x => ({ id: x.id, data: () => x })) });
  const f = new Function('fauth', 'fdb', 'collection', 'getDocs', code.replace('return { e2eHideAdmin', 'let me; return { e2eHideAdmin'));
  const api = f(fauth, fdb, collection, getDocs);
  return { api, set(e){ me = e; } };
}
(async () => {
  const users = [{ id:'U1', name:'김명준' }, { id:'T1', name:'', e2e:true }, { id:'T0', name:'' }];
  const bi = [{ id:'B1', name:'SHUNSHINE', owner:'U1' }, { id:'B9', name:'자동검사배2', owner:'T0' }];
  const m = make(users, bi);
  const people = await m.api.e2eHideAdmin(users.map(x => Object.assign({ uid: x.id }, x)), ['uid']);
  T('회원 — 표가 있는 검사 계정은 안 나온다', !people.some(x => x.uid === 'T1'), people);
  T('회원 — 표가 생기기 전 검사 계정(자동검사배 선주)도 안 나온다', !people.some(x => x.uid === 'T0'), people);
  T('회원 — 진짜 회원은 나온다', people.some(x => x.uid === 'U1'));
  const boats = await m.api.e2eHideAdmin(bi, ['owner']);
  T('배 — 자동검사배는 안 나온다', boats.length === 1 && boats[0].id === 'B1', boats);
  const reps = await m.api.e2eHideAdmin([
    { id:'r1', by:'T1', snap:{ title:'[자동검사] 지워질 글 x' } },
    { id:'r2', by:'U1', snap:{ title:'진짜 글' } },
    { id:'r3', by:'U2', snap:{ title:'[자동검사] 글' } }], ['by']);
  T('신고 — 검사 계정의 신고·검사 글 신고는 안 나온다', reps.length === 1 && reps[0].id === 'r2', reps);
  const sup = await m.api.e2eHideAdmin([{ id:'s1', by:'T1' }, { id:'s2', kind:'mail', byName:'IARC' }], ['by']);
  T('고객센터 — 검사 계정 문의는 안 나오고 메일은 나온다', sup.length === 1 && sup[0].id === 's2', sup);
  T('명부에 검사 계정 표를 남긴다', /\.\.\.\(amE2E\(\) \? \{ e2e: true \} : \{\}\)/.test(src));
  ['users', 'boatIndex', 'reports'].forEach(n =>
    T(n + ' 목록이 거른다', new RegExp("getDocs\\(collection\\(fdb, '" + n + "'\\)\\);\\s*\\n\\s*return e2eHideAdmin\\(").test(src)));
  T('고객센터 목록이 거른다', /limit\(300\)\)\);\s*\n\s*return e2eHideAdmin\(/.test(src));
  T('배 둘러보기가 거른다', /E2E_NAME\.test\(String\(x\.name \|\| ''\)\)/.test(src));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})();
