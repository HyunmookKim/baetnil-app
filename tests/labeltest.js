// 5.13 — 칸 이름은 「질문」 이 아니라 「이름」 으로 (사장님 폰 화면 지적: 「적어!」 가 뭐냐)
//
//   ★ 지적받은 것
//     물품 추가 칸의 「적어도」 — 한국 앱 어디에서도 이 칸을 이렇게 안 부른다(박스히어로: 「최소 수량」).
//     게다가 칸이 좁아 「적어!」 · 「단!」 로 잘려 보였다.
//   ★ 같은 꼴을 앱 전체에서 훑었다 — 칸 이름을 질문처럼 달아 둔 곳 열한 군데:
//     몇 자리 · 무슨 항해 · 어떤 분 · 언제까지 · 어떤 글인가요 · 몇 편 · 잡은 것 · 무슨 일 ·
//     언제까지 못 오는지 · 어떤 글을 올리시겠습니까 · 어떤 글을 쓰시나요 · 어느 장비 것
//     → 한국 앱이 실제로 쓰는 이름으로 (모집 인원 · 항해 종류 · 모집 대상 · 모집 마감 · 글 종류 ·
//       회차 · 조과 · 정비 내용 · 복귀 예정일 · 쓰실 글 소개 · 장비)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x ? ' — ' + x : '')); } };

// ① 칸 이름(openForm 의 label · 상세 화면의 mrlbl)이 질문꼴이 아니다
const Q = /^(몇|무슨|어느|어떤|언제|누가|누구|얼마)\s|^(몇|무슨|어느|어떤|언제)[가-힣]*$|(나요|습니까|는지|인가요)$| 것$/;
const labels = [...src.matchAll(/label:'([^']+)'/g)].map(m => m[1])
  .concat([...src.matchAll(/class="mrlbl">\$\{esc\(t\('([^']+)'\)\)\}/g)].map(m => m[1]))
  .concat([...src.matchAll(/class="fglbl" data-t="([^"]+)"/g)].map(m => m[1]));
const bad = [...new Set(labels.filter(l => Q.test(l)))];
T('★★★ 칸 이름이 질문꼴이 아니다 (' + labels.length + '개 봄)', bad.length === 0, bad.join(' · '));

// ② 지적받은 말이 다시 안 들어온다
for(const w of ['적어도', '어느 장비 것', '몇 자리', '무슨 항해', '몇 편', '잡은 것', '무슨 일', '언제까지 못 오는지']){
  const n = (src.match(new RegExp("'" + w + "'", 'g')) || []).length
          + (src.match(new RegExp('"' + w + '"', 'g')) || []).length;
  T(`「${w}」 가 칸 이름·사전에 없다`, n === 0, n + '곳');
}

// ③ 최소 수량 칸
T('★ 물품 추가의 그 칸 이름이 「최소 수량」 이다', /id="fMin"[^>]*placeholder="최소 수량"/.test(src));
T('★ 목록·오늘 화면에도 「최소」 로 나온다',
  /tsub\('최소 수량 \{n\}'/.test(src) && /tsub\('최소 \{n\}'/.test(src) && /tsub\('\(최소 \{n\}\)'/.test(src));

// ④ 칸 폭 — px 로만 박지 않는다 (폰 글자를 크게 해 둔 사람도 안 잘리게)
const css = (src.match(/\.row \.q\{[^}]+\}\.row \.u\{[^}]+\}\.row \.m\{[^}]+\}/) || [''])[0];
T('★★★ 수량·단위·최소 수량 칸 폭이 글자 크기를 따라간다 (em)', /em/.test(css) && !/\.row \.q\{width:\d+px\}/.test(css), css);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
