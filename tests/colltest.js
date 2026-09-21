// 컬렉션 목록이 네 곳에서 어긋나지 않는가
//
// ★ 왜 이 검사가 있나 (4.56)
//   한 배의 기록이 어느 저장 칸에 흩어져 있는지가 네 곳에 손으로 나열돼 있다.
//     ① BOAT_DATA   — 배를 지울 때 기기에서 지울 칸
//     ② SYNC_COLLS  — 동기화가 훑는 칸
//     ③ 받아오기(CO) — 클라우드에서 바뀐 것만 받아올 칸
//     ④ __delBoat   — 클라우드에서 지울 칸
//   여기에 새 칸을 더할 때 한 곳만 빠뜨려도 조용히 구멍이 난다 —
//   지운 배의 기록이 남거나, 새 자료가 영영 동기화되지 않는다.
//   인수인계 문서에도 「조건문에 컬렉션 이름을 손으로 나열하지 말 것」 이라고 적혀 있다.
//   목록을 하나로 합치는 것은 모듈 경계를 넘어야 해서 더 위험하다. 대신 여기서 맞춰 본다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };

const lists = (re) => {
  const m = src.match(re);
  if(!m) return null;
  return (m[0].match(/'[^']+'/g) || []).map(x => x.slice(1, -1));
};
const A = lists(/const BOAT_DATA = \[[\s\S]*?\];/);
const B = lists(/const SYNC_COLLS = \[[\s\S]*?\];/);
const C = lists(/const CO = \[[\s\S]*?\];/);
const D = lists(/const colls = \[[\s\S]*?\];/);

T('① 배 지우기 목록이 있다 (BOAT_DATA)', !!A, A);
T('② 동기화 목록이 있다 (SYNC_COLLS)', !!B, B);
T('③ 받아오기 목록이 있다 (CO)', !!C, C);
T('④ 클라우드 지우기 목록이 있다 (__delBoat colls)', !!D, D);

if(A && B && C && D){
  // 'all' 은 물품의 옛 이름이다. 'meta' 는 클라우드에만 있다. 그 둘만 예외로 둔다.
  const norm = a => [...new Set(a.map(x => x === 'all' ? 'items' : x))]
                      .filter(x => x !== 'meta').sort();
  const nA = norm(A), nB = norm(B), nC = norm(C), nD = norm(D);
  const diff = (x, y) => x.filter(v => y.indexOf(v) < 0);
  T('★★ 배 지우기와 동기화 목록이 같다', diff(nA,nB).length===0 && diff(nB,nA).length===0,
    { 지우기만: diff(nA,nB), 동기화만: diff(nB,nA) });
  T('★★ 동기화와 받아오기 목록이 같다', diff(nB,nC).length===0 && diff(nC,nB).length===0,
    { 동기화만: diff(nB,nC), 받아오기만: diff(nC,nB) });
  T('★★ 클라우드 지우기 목록이 나머지를 다 덮는다', diff(nB,nD).length===0,
    { 클라우드에서_안지움: diff(nB,nD) });
  T('★ 물품이 네 목록에 다 있다',
    [nA,nB,nC,nD].every(x => x.indexOf('items') >= 0));
  T('★ 빠진 것 없이 열다섯 칸이다 — ' + nB.join(' '), nB.length >= 15, nB);
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
