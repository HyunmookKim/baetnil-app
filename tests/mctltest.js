// 4.105 — 지도·도면 위의 **도구는 표 하나(mctl)로 막는다**
//
// ★ 왜 이 검사가 있나 (사장님 지적 두 번)
//   4.104: 「저장」이 확대 단추 밑에 깔려 안 눌렸다 → 단추를 아래로 내렸다
//   4.105: 이번엔 「저장」을 누르니 **그 단추 밑의 자리**가 저장됐다.
//          지도가 도구의 손가락까지 같이 먹었기 때문이다.
//
// ★ 뿌리는 하나다 — 막는 줄이 `closest('.mzoom')` 처럼 **이름을 하나하나 적어 둔 것**이었다.
//   지도 위에 도구가 하나 늘 때마다 그 줄을 같이 고쳐야 했고, 나는 안 고쳤다.
//   (사장님이 정하신 것 3 — 사본을 만들면 반드시 어긋난다.)
//
// ★ 그래서 규칙을 하나로 만들었다.
//   ① 지도·도면 위에 얹히는 도구에는 `mctl` 표를 붙인다.
//   ② 손가락을 받는 판은 `closest('.mctl')` **하나만** 보고 막는다.
//   이 검사는 그 둘이 지켜지는지 글로 센다. 새 도구를 표 없이 올리면 여기서 걸린다.
const fs = require('fs');
const h = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0,300) : '')); } };

// ── 1. 지도·도면 위에 얹히는 도구는 다 `mctl` 표를 달았다
const 도구들 = ['mzoom', 'mapbtm', 'mapbar', 'mhotbar', 'mapzoom', 'mrzoom'];
const 표없는것 = 도구들.filter(c => {
  // class="… c …" 또는 `<div class="c …"` 꼴을 찾아 mctl 이 같이 있는지 본다
  const re = new RegExp('class="([^"]*\\b' + c + '\\b[^"]*)"', 'g');
  let m, 봤나 = false, 다붙었나 = true;
  while((m = re.exec(h))){ 봤나 = true; if(!/\bmctl\b/.test(m[1])) 다붙었나 = false; }
  return !봤나 || !다붙었나;
});
T('★★★ 지도 위 도구 여섯에 다 `mctl` 표가 붙어 있다', 표없는것.length === 0,
  '표가 없는 것: ' + 표없는것.join(', '));

// ── 2. 손가락을 받는 판은 **이름을 하나하나 적지 않는다**
//   `closest('.mzoom')` 같은 줄이 남아 있으면 그 판은 새 도구를 못 막는다.
// ★ 주석은 빼고 센다 — 왜 그렇게 고쳤는지 적어 둔 설명까지 세면 검사가 거짓말한다.
const 코드만 = h.replace(/^\s*\/\/.*$/gm, '');
const 이름박은줄 = [];
도구들.forEach(c => {
  const re = new RegExp("closest\\(\\s*['\"]\\." + c + "['\"]\\s*\\)", 'g');
  const n = (코드만.match(re) || []).length;
  if(n) 이름박은줄.push(c + ' ×' + n);
});
T('★★★ 막는 줄에 도구 이름을 박아 두지 않았다 (전부 `.mctl` 로 본다)',
  이름박은줄.length === 0, '아직 이름으로 막는 것: ' + 이름박은줄.join(', '));

// ── 3. 손가락을 받는 판 셋이 다 `.mctl` 로 막는다
const 막는줄수 = (h.match(/closest\(\s*['"]\.mctl['"]\s*\)/g) || []).length;
T('★★★ `.mctl` 로 막는 줄이 넷 이상이다 (지도 누름·지도 뗌·창고 지도·도면·그리기)',
  막는줄수 >= 4, '지금 ' + 막는줄수 + '줄');

// ── 4. 지도는 **뗄 때도** 막는다 (누를 때만 막으면 도구 위에서 뗀 것이 새어 나간다)
T('★★ 손을 뗄 때도 도구를 막는다',
  /el\.onpointerup = e=>\{[\s\S]{0,200}도구인가\(e\)/.test(h));

// ── 5. 두 손가락 확대도 도구 위에서는 안 걸린다
T('★★ 두 손가락 확대도 도구 위에서는 안 걸린다',
  /el\.ontouchstart = e=>\{\s*\n\s*if\(도구인가\(e\)\) return;/.test(h));

// ── 6. 「저장」은 지도 아래에 있고 확대 단추 자리를 비켜 있다 (4.104 에서 정한 것)
T('★★ 저장·취소는 지도 아래에 있다', /\.mapbtm\{position:absolute;left:8px;right:60px;bottom:8px/.test(h));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
