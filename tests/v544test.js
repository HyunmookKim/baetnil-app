// 5.44 — 받아오기: 권한이 없는 칸만 건너뛴다 (사장님 2026-10-06: 「권한이 없으면 없는것만 건너뛰어야지」)
//   등급에서 「없음」 인 칸 하나를 규칙이 거부하면 받아오기 전체가 멎던 것. 진짜 pull 함수 몸을 떼어 와서 돌려 본다.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
T('판 5.44 이상', /const APP_VER = '5\.(4[4-9])';/.test(src));
const a = src.indexOf('      async pull(base){'), z = src.indexOf('      async pullColl(name){', a);
const body = a > 0 && z > a ? src.slice(a + '      async '.length, z).trim().replace(/,\s*$/, '') : '';
T('pull 함수를 찾았다', !!body);
const CO = ['items','voyage','fuel','board'];
function make(fail){
  const deny = n => { const e = new Error('Missing or insufficient permissions.'); e.code = fail[n] || 'permission-denied'; throw e; };
  const env = {
    CO, fdb:{}, boatPath: () => 'boats/x',
    doc: () => ({}), getDoc: async () => ({ exists: () => true }),
    fullColl: async n => { if(fail[n]) deny(n); return { mode:'full', rows:[{ id:n }], n:1, u:'' }; },
    diffColl: async n => { if(fail[n]) deny(n); return { mode:'diff', rows:[], n:1, u:'' }; }
  };
  const fn = new Function(...Object.keys(env), 'return { async ' + body + ' };');
  return fn(...Object.values(env));
}
(async () => {
  let r = await make({ voyage:'permission-denied', fuel:'permission-denied' }).pull(null);
  T('권한 없는 칸(항해일지·연료)은 rows 없이 건너뛴다', r.colls.voyage.rows === null && r.colls.fuel.rows === null && r.colls.voyage.mode === 'skip', r.colls);
  T('나머지 칸(적재표·게시판)은 정상으로 받는다', Array.isArray(r.colls.items.rows) && r.colls.items.rows.length === 1 && r.colls.board.rows.length === 1, r.colls);
  let err = '';
  try{ await make({ voyage:'unavailable' }).pull(null); }catch(e){ err = e.code; }
  T('권한 말고 다른 오류(인터넷 끊김 등)는 예전처럼 전체를 멈춘다', err === 'unavailable', err);
  // 건너뛴 칸은 기기 것을 그대로 둔다 — pullInto 가 배열이 아니면 기기 것을 돌려준다
  T('건너뛴 칸은 기기 기록을 그대로 둔다 (pullInto)', /function pullInto\(coll, rows\)\{\s*const mine = localColl\(coll\);\s*if\(!Array\.isArray\(rows\)\) return mine;/.test(src));
  T('건너뛴 칸은 자국(cloudMark)을 안 지운다', /if\(Array\.isArray\(PULLED\[k\]\)\) cloudMark\[k\] = /.test(src));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})();
