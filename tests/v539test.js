// 5.39 — 검정·흰 화면에서 붙여 둔 줄이 진회색·회색 띠가 되던 것
// 사장님 (2026-10-05): 「검은색이랑 흰색 바탕에서는 안 고친 건 아니지」 · 「그띠가 왜 만든건지부터 고민해야하는거 아니냐」
//   · 「다른어플들은 어떻게 하는지 그리고 어플의 디자인철학을 안해치는선에서 해결책 찾아서 고쳐라」
// 띠가 있는 까닭: 밑으로 지나가는 글을 흐려 붙어 있는 줄의 글씨를 읽히게 하려고(4.123 · 5.30 · 5.37).
// 애플 HIG Toolbars: 막대에 따로 바탕색을 깔지 말고 밑의 내용이 막대 색을 정하게 · Scroll views: 가장자리 효과는 흐림·서서히, 가리거나 어둡게 하지 않는다.
// → 노을과 같은 문(흐림·같은 옅기·아래 끝 서서히·맨 위에서는 안 보임), 색만 그 화면의 바탕색.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'www', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 200) : '')); } };
const css = src.slice(0, src.indexOf('</style>'));
// 화면 색 바꾸는 문 안의 붙여 둔 줄 규칙
const blk = (src.match(/5\.39 — 붙어 있는 줄[\s\S]{0,3000}?: ''\)/) || [''])[0];
T('① 화면 색 문에 붙여 둔 줄 규칙이 있다', blk.length > 0);
T('①-1 바탕색: 흰 화면 255,255,255 · 검정 화면 0,0,0', /theme === 'light' \? '255,255,255' : '0,0,0'/.test(blk), blk.slice(0, 300));
T('①-2 맨 윗줄 — 노을과 같은 옅기(.55→.18)', /header\{background:linear-gradient\(to bottom,rgba\(\$\{c\},\.55\),rgba\(\$\{c\},\.18\)\) !important\}/.test(blk));
T('①-3 내렸을 때 맨 윗줄 — 노을과 같은 옅기(.62→.42)', /body\.scrolled header\{background:linear-gradient\(to bottom,rgba\(\$\{c\},\.62\),rgba\(\$\{c\},\.42\)\) !important\}/.test(blk));
T('①-4 갈래 줄·기록 창 머리줄 흐림 판 — .42', /\.pinbar::before,#mrPanel \.mrhead::before,#mrPanel > \.mrtop::before\{background:rgba\(\$\{c\},\.42\) !important\}/.test(blk));
T('①-5 아래 탭 줄 — 노을과 같은 옅기(.35→.86)', /#tabbar\{background:linear-gradient\(to bottom,rgba\(\$\{c\},\.35\),rgba\(\$\{c\},\.86\)\) !important\}/.test(blk));
T('①-6 흐리기를 못 쓰는 기기 — .86 (노을과 같은 값)', /@supports not[\s\S]{0,200}rgba\(\$\{c\},\.86\) !important/.test(blk));
T('①-7 선을 새로 긋지 않는다', !/border/.test(blk));
// 노을은 그대로
T('② 노을 흐림 판은 그대로 (.42)', /\.pinbar::before\{[\s\S]{0,200}background:rgba\(6,18,31,\.42\)/.test(css));
// 같은 꼴 — 띠를 통째로 깔던 붙여 두는 줄
const hd = (css.match(/\.helphd\{[^}]*\}/) || [''])[0];
T('③-1 도움말 머리: 바탕·아래 선·자체 sticky 없음', hd && !/background/.test(hd) && !/border/.test(hd) && !/sticky/.test(hd), hd);
T('③-2 도움말 머리는 붙여 두는 줄(.pinbar)', /<div class="helphd pinbar">/.test(src));
const tc = (css.match(/#trashBody \.trchips\{[^}]*\}/) || [''])[0];
T('③-3 휴지통 갈래 칩: 바탕·자체 sticky 없음', tc && !/background/.test(tc) && !/sticky/.test(tc), tc);
T('③-4 휴지통 갈래 칩은 바깥 껍데기 .pinbar 안', /<div class="pinbar"><div class="tfilt trchips">/.test(src));
T('판 5.39', /const APP_VER = '5\.39';/.test(src));
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
