// 5.33 — 늦게 끝난 일(항적 멈추기·날씨 받기)이 다른 화면을 항해일지로 덮던 것
//   에뮬레이터 검사 「승선 이력 종이 — 기다려도 안 됨: 종이도 안내도 안 뜸」(#54 5.29 · #57):
//   「지금 도착」 → 항해일지가 뜸 → 승선 이력 종이를 띄움 → 몇 초 뒤 항적 멈추기가 끝나 openMR 이 항해일지를 다시 그림.
//   종이(paperOpen)는 같은 창(#mrPanel)을 쓰지만 mrOpenType·mrOpenId 를 그대로 두기 때문이다.
// 이 검사: ① 「기록 창이 떠 있나」 를 mrShown 한 곳에서 본다 ② 늦게 다시 그리는 자리 넷이 모두 mrShown 을 쓴다
//          ③ mrShown 이 실제로 종이·닫힌 창·다른 기록에서 false 인지 돌려 본다
const fs = require('fs');
const path = require('path');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '../www/index.html'), 'utf8');

T('기록 창이 떠 있나는 mrShown 한 곳에서 본다', /function mrShown\(kind, id\)\{/.test(src));
T('늦게 다시 그리는 자리에 옛 꼴(mrOpenType 만 보고 openMR)이 남아 있지 않다',
  !/if\(mrOpenType\s*===\s*'voyage'\s*&&\s*String\(mrOpenId\)\s*===\s*String\([a-zA-Z.]+\)\)\s*openMR/.test(src));
T('「지금 도착」 뒤 항적 멈추기가 끝나면 — 항해일지가 아직 떠 있을 때만 다시 그린다',
  /voyArrived\(it, true\)\.then\(\(\)=>\{ try\{\s*if\(mrShown\('voyage', it\.id\)\) openMR\('voyage', it\.id\);/.test(src));
T('날씨 받기(wxCapture)·위치 찍기도 mrShown 을 쓴다', (src.match(/if\(mrShown\('voyage', id\)\) openMR\('voyage', id\);/g) || []).length === 3);
T('openMR 은 그린 뒤 rec 를 넣고, showPanel 은 다른 것을 띄울 때 rec 를 뺀다',
  /showPanel\(P\);\s*P\.classList\.add\('rec'\);/.test(src) && /P\.classList\.remove\('rec'\);/.test(src));
T('종이(paperOpen)는 showPanel 로 띄운다 (rec 가 빠진다)', /function paperOpen\(name, html, saveJs\)\{[\s\S]{0,900}?showPanel\(P\);/.test(src));

// ③ 돌려 보기
const grab = name => { const i = src.indexOf('function ' + name + '('); let d = 0, st = src.indexOf('{', i);
  for(let j = st; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(i, j + 1); } } return ''; };
const mk = () => { const cls = new Set(); return { classList: { add: (...a) => a.forEach(x => cls.add(x)), remove: (...a) => a.forEach(x => cls.delete(x)), contains: x => cls.has(x) } }; };
const P = mk();
const F = new Function('document', 'S', grab('mrShown').replace(/mrOpenType/g, 'S.type').replace(/mrOpenId/g, 'S.id') + '; return mrShown;');
const S = { type: 'voyage', id: 'v1' };
const shown = F({ getElementById: () => P }, S);
P.classList.add('open', 'full'); P.classList.add('rec');
T('항해일지가 떠 있으면 true', shown('voyage', 'v1') === true);
T('같은 창에 종이를 띄우면(rec 빠짐) false — 덮지 않는다', (P.classList.remove('rec'), shown('voyage', 'v1') === false));
P.classList.add('rec');
T('다른 항해 기록이면 false', shown('voyage', 'v2') === false);
T('창을 닫았으면 false', (P.classList.remove('open', 'full'), shown('voyage', 'v1') === false));
P.classList.add('open'); S.type = null; S.id = null;
T('기록이 열려 있지 않으면 false', shown('voyage', 'v1') === false);

console.log(`\n${ok} 통과 · ${bad} 실패`);
process.exit(bad ? 1 : 0);
