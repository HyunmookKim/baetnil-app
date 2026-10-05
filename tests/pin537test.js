// 5.37 — 붙여 둔 줄에 검은 띠를 깔지 않는다
// 사장님 (2026-10-04): 「그냥 검은띠 만들어놓은거잖아 … 이거 엣날에도 분명 지적했는데 … 똑같은 좆같고 성의없는 짓거리를 해놨네」
// 9/10(4.123) 사장님: 「꼭 검정 선을 넣어서 글 읽는 칸을 잘라먹어야 하나 … 좀 더 예쁘고 자연스러운 거 없을까」
//   → 정한 것: 색을 칠하지 않고 뒤만 흐린다(애플 뉴스·사파리) · 아래 끝은 선 없이 서서히 · 맨 위에서는 안 보인다.
// 5.35 가 갈래 줄(.pinbar)에 거의 검정(.94)+그림자를, 5.30 이 맨 윗줄에 거의 검정(.96)+선을 다시 깔았다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'www', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 200) : '')); } };
const css = src.slice(0, src.indexOf('</style>'));

// ① 붙여 둔 줄 자신에 바탕색을 칠하지 않는다
const 줄 = css.match(/[^{}]*\.pinbar\s*\{[^}]*\}/g) || [];
T('①-1 .pinbar 규칙이 있다', 줄.length > 0);
줄.forEach(r => {
  const 머리 = r.slice(0, r.indexOf('{'));
  if(/::before/.test(머리)) return;
  T('①-2 「' + 머리.trim().slice(-40) + '」 에 바탕색·그림자가 없다', !/background\s*:/.test(r) && !/box-shadow/.test(r), r);
});
T('①-3 예전 검정 바탕(rgba(6,18,31,.94))이 없다', !/rgba\(6,18,31,\.94\)/.test(css));

// ② 흐림 판 — 4.123 과 같은 문
const 판 = (css.match(/\.pinbar::before\s*\{[^}]*\}/) || [''])[0];
T('②-1 뒤를 흐린다', /backdrop-filter:\s*blur\(/.test(판), 판);
T('②-2 옅게만 어둡게 (.42)', /rgba\(6,18,31,\.42\)/.test(판), 판);
T('②-3 아래 끝은 선 없이 서서히 (mask)', /mask-image:\s*linear-gradient\(to bottom/.test(판), 판);
T('②-4 맨 위에서는 안 보인다 (opacity:0, 내리면 1)', /opacity:\s*0/.test(판) && /body\.scrolled \.pinbar::before[^{]*\{\s*opacity:\s*1/.test(css));
T('②-5 좌우를 숫자로 박지 않는다 (화면 밖으로 넘치면 옆으로 밀린다)', /var\(--pbl/.test(판) && /var\(--pbr/.test(판) && !/left:\s*-24px/.test(판), 판);
T('②-6 좌우 길이를 재는 문이 있다 (pinbarEdges)', /function pinbarEdges\(/.test(src));

// ③ 옆으로 밀리는 칸(tfilt·subrow)은 안에 두고 .pinbar 는 바깥 껍데기 — 흐림 판이 안 잘리게
T('③-1 「tfilt pinbar」 한 몸이 없다', !/class="tfilt pinbar"/.test(src));
T('③-2 「subrow pinbar」 한 몸이 없다', !/class="subrow pinbar"/.test(src));
const 껍데기 = (src.match(/<div class="pinbar"><div class="(tfilt|subrow)[ "]/g) || []).length;
T('③-3 껍데기로 감싼 줄 7곳 (이야기·둘러보기·장터·정박지·문서·소식 + 5.39 휴지통)', 껍데기 === 7, 껍데기);

// ④ 맨 윗줄도 같은 꼴을 고친다 (한 곳만 고치지 않는다)
const 윗줄 = (css.match(/body\.scrolled header\s*\{[^}]*\}/g) || []).join('\n');
T('④-1 내려도 맨 윗줄에 검정(.96)을 안 칠한다', !/rgba\(10,24,40,\.96\)/.test(윗줄), 윗줄);
T('④-2 내려도 맨 윗줄 아래 선이 없다', /border-bottom:\s*none/.test(윗줄) && !/border-bottom:\s*1px/.test(윗줄), 윗줄);
T('④-3 맨 윗줄은 뒤를 흐린다', /backdrop-filter:\s*blur\(/.test(윗줄), 윗줄);

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
