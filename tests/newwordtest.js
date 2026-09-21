// 새로 넣은 말은 **다른 데는 어떻게 쓰는지 확인한 뒤에** 나간다 (4.85 → 4.102 에서 바꿈)
//
// ★ 왜 이것을 만들었나 — 2026-08-31 하루에 아홉 번 지적받았다.
//   「고칠 곳」·「해 온 일」·「초안 빼고」·「미기록」·「안 보는 사람」·
//   「장비 만들어 매달기」·「찍어 둔 자리」·「고르기」·「이 칸 보기」·「안에 3개」.
//   앞서 만든 wordtest.js 는 **사전에 없는 말**만 잡는다. 내가 지어낸 뒤
//   사전에 등록해 버리면 그냥 통과한다. 그 구멍으로 전부 새어 나갔다.
//
// ★★★ 4.102 — 사장님께 **묻지 않는다** (사장님이 정하신 것 15)
//
//   사장님: 「50개 단어는 또 뭐냐? 내가 계속 말하잖아 알아서 찾아서 넣으라고」
//
//   전에는 「사장님이 보시고 정해 주십시오」 하고 목록을 들이밀었다. 그건 내 일을
//   사장님께 떠넘긴 것이다. **다른 앱·기관이 실제로 쓰는 말을 내가 찾아서 정하고
//   내가 넣는다.** 확인이 끝난 말은 곧바로 words-shipped.json 으로 옮긴다.
//
// ★ 그래도 이 검사는 남는다. 하는 일이 바뀌었을 뿐이다 —
//   「확인 없이 지어낸 말이 몰래 새어 나가지 않았나」 를 보는 자리다.
//   새 말이 걸리면 **묻지 말고**, 다른 데는 어떻게 쓰는지 찾아보고, 정하고, 옮긴다.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const BASE = path.join(__dirname, 'words-shipped.json');

const L = src.split('\n');
const at = re => L.findIndex(l => re.test(l)) + 1;
const i = at(/^  en\s*:\s*\{/), j = at(/^  ru\s*:\s*\{/);
const cur = new Set();
for(const line of L.slice(i - 1, j))
  for(const m of line.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'/g)) cur.add(m[1]);

let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (x === undefined ? '' : '\n' + x)); } };

T('말 목록을 읽었다', cur.size > 1000, cur.size + '개');
let base = null;
try{ base = new Set(JSON.parse(fs.readFileSync(BASE, 'utf8')).열쇠); }catch(e){}
T('지난 판 말 목록(words-shipped.json)이 있다', !!base && base.size > 1000);

if(base){
  const 새말 = [...cur].filter(k => !base.has(k)).sort();
  T('확인 안 하고 새어 나간 말이 없다', 새말.length === 0,
    새말.length ? '  새로 넣은 말 ' + 새말.length + '개 — **사장님께 묻지 말 것.**\n'
      + '  다른 앱·기관이 실제로 쓰는 말인지 찾아보고, 정하고,\n'
      + '  hv/tests/words-shipped.json 에 옮긴다 (사장님이 정하신 것 15).\n'
      + 새말.map(x => '   · ' + x).join('\n') : '');
  const 없앤말 = [...base].filter(k => !cur.has(k)).sort();
  // 없앤 것은 실패로 치지 않는다 — 지어낸 말을 걷어내는 것도 일이다. 다만 적어 둔다.
  if(없앤말.length) console.log('  (없앤 말 ' + 없앤말.length + '개: ' + 없앤말.slice(0,10).join(' / ') + ')');
}
console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
