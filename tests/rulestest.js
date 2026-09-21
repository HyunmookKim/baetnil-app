// 앱이 쓰는 컬렉션이 규칙에 다 있는지 검사
// ★ 'items' 가 규칙에 없어서 물품이 클라우드에 안 올라간 적이 있다.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let rules = '';
for(const p of [process.argv[3], 'firestore_rules.txt',
                '/mnt/user-data/outputs/firestore_rules.txt']){
  try{ if(p){ rules = fs.readFileSync(p, 'utf8'); break; } }catch(_){}
}
let pass=0, fail=0;
const T=(n,c,extra)=>{ if(c){pass++;console.log('통과: '+n);}
  else {fail++;console.log('★ 실패: '+n + (extra?' — '+extra:''));} };

if(!rules){
  console.log('★ 실패: firestore_rules.txt 를 찾지 못했습니다');
  console.log('\n합계: 0개 통과 / 1개 실패');
  process.exit(1);
}

// 앱이 실제로 손대는 컬렉션 이름을 뽑는다
const used = new Set();
for(const m of src.matchAll(/ops\.push\(\['(?:set|del)','([a-z]+)'/g)) used.add(m[1]);
for(const m of src.matchAll(/getDocs\(col\('([a-z]+)'\)\)/g)) used.add(m[1]);
for(const m of src.matchAll(/doc\(fdb, boatPath\(\), '([a-z]+)'/g)) used.add(m[1]);

// 규칙에 이름이 적힌 컬렉션
const ruled = new Set();
for(const m of rules.matchAll(/match \/([a-z]+)\/\{docId\}/g)) ruled.add(m[1]);

T('앱이 쓰는 컬렉션을 찾았다', used.size >= 10, [...used].join(','));
const missing = [...used].filter(c => !ruled.has(c));
T('앱이 쓰는 컬렉션이 규칙에 모두 있다', missing.length===0, missing.join(','));

// 배 경로에 'default' 같은 폴백이 없어야 한다
T('배가 없을 때 엉뚱한 곳에 쓰지 않는다',
  !/boats\/' \+ String\(window\.currentBoatId \|\| /.test(src));

// 규칙 기본 검사
// ★ 주석 안의 괄호까지 세면 안 된다. '// 1) 글쓴이가…' 같은 줄에 걸려
//   멀쩡한 규칙을 틀렸다고 잡는다. 주석을 걷어내고 센다.
// ★ 따옴표 안의 // 까지 주석으로 보면 안 된다.
//   matches('https?://.*') 같은 줄에서 뒤쪽 괄호가 통째로 사라져 멀쩡한 규칙을 틀렸다고 잡는다.
const stripLine = l => {
  let q = null, out = '';
  for(let i = 0; i < l.length; i++){
    const c = l[i];
    if(q){ out += c; if(c === q) q = null; continue; }
    if(c === "'" || c === '"'){ q = c; out += c; continue; }
    if(c === '/' && l[i+1] === '/') break;
    out += c;
  }
  return out;
};
const bare = rules.split('\n').map(stripLine).join('\n');
T('규칙 중괄호가 맞는다', (bare.match(/\{/g)||[]).length === (bare.match(/\}/g)||[]).length);
T('규칙 괄호가 맞는다', (bare.match(/\(/g)||[]).length === (bare.match(/\)/g)||[]).length);
T('옛 배 대비(legacy)가 들어 있다', /function legacy\(/.test(rules));
T('맨 아래 전부 막기가 있다', /match \/\{document=\*\*\}/.test(rules));
T('규칙이 목록 거르기를 쓰지 않는다', !/\.where\(/.test(rules));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
