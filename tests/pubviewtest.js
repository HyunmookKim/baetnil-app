// 내보낸 것과 보여 주는 것이 같은가 (4.70)
//
// ★ 왜 (2026-08-29 사장님 지적)
//   「실제로는 더 많은 정보를 남겨놨는데 왜 공개 게시판에는 사진하고 설명만 올라가냐?
//    그럼 왜 가격이랑 제품이랑 이런 걸 왜 적냐?」
//
//   자료는 다 나가 있었다. 화면이 옅은 회색 한 줄로 뭉개고 있었을 뿐이다 —
//   「★☆☆☆☆ · 걸린 시간 10분 · 든 돈 4,700원 · 한솔캠록 R7」.
//   적을 때는 칸마다 이름이 붙어 있는데 볼 때는 한 줄이라, 적은 사람은 자기 것이 안 실린 줄 안다.
//
// ★ 이 검사가 지키는 것 — **내보내는 칸은 화면에도 제 이름을 달고 나온다.**
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(n){
  let i = src.indexOf('function ' + n + '('); if(i < 0) i = src.indexOf('async function ' + n + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

// ── 정비수첩
{
  const V = grab('pubHowBody');
  T('★ 공개 정비수첩 화면을 찾았다', !!V);
  // 내보내는 칸(mlogPublic)이 화면에 제 이름을 달고 나오는가
  [['한 날','date'],['장비','gear'],['난이도','hard'],['걸린 시간','work'],
   ['든 돈','cost'],['부품·공구','used'],['계통','sys']].forEach(([lbl, f])=>{
    T('★★ 정비수첩 — 「' + lbl + '」 이 칸 이름을 달고 나온다',
      V.indexOf("'" + lbl + "'") >= 0 && V.indexOf('m.' + f) >= 0, lbl);
  });
  // ★★★ 옅은 한 줄로 몰아넣던 옛 방식이 안 남아 있어야 한다
  T('★★★ 옅은 한 줄(postmeta)로 몰아넣지 않는다',
    !/postmeta[^]{0,80}meta/.test(V) && !/const meta = \[/.test(V), V.slice(0,300));
  T('★ 절차 앞에 이름표가 있다', /정비 절차/.test(V));
}

// ── 리뷰
{
  const i = src.indexOf("if(k === 'review')");
  // ★ 4.102 — 칸이 늘어 이 토막이 3,000자를 넘었다. 넉넉히 뜬다.
  const V = src.slice(i, i + 7000);
  T('★ 공개 리뷰 화면을 찾았다', i > 0);
  [['제품','maker'],['종류','kind'],['계통','sys'],['연식','year'],
   ['또 살까','again'],['산 값','price']].forEach(([lbl, f])=>{
    T('★★ 리뷰 — 「' + lbl + '」 이 칸 이름을 달고 나온다',
      V.indexOf("'" + lbl + "'") >= 0 && V.indexOf('r.' + f) >= 0, lbl);
  });
  T('★★ 써 본 기간·탄 기간을 배·제품에 맞게 부른다', /탄 기간/.test(V) && /써 본 기간/.test(V));
  T('★★★ 옛 방식(tags 한 줄)이 안 남아 있다', !/tags\.join/.test(V), V.slice(0,300));
  T('★ 제조사·모델이 나온다 (전에는 아예 안 보였다)', /r\.maker/.test(V) && /r\.model/.test(V));
}

// ── 항해일지 (이쪽은 원래 제대로 되어 있었다 — 되돌아가지 않게 지킨다)
{
  const i = src.indexOf("if(k === 'voyage'){");
  // ★ 4.102 — 칸이 늘어 이 토막이 3,000자를 넘었다. 넉넉히 뜬다.
  const V = src.slice(i, i + 7000);
  // ★★★ 4.102 — 남의 배 항해일지도 **내 화면과 같은 칸**으로 보여 준다 (사장님 지적).
  //   「중간 기록」 이라는 이름표는 없어지고, 기록마다 색 띠가 붙은 제 칸이 생겼다.
  ['출발','도착','거리','항해 시간','메모'].forEach(lbl=>
    T('★ 항해일지 — 「' + lbl + '」 이 나온다', V.indexOf("'" + lbl + "'") >= 0 || V.indexOf("t('" + lbl + "')") >= 0, lbl));
  T('★★★ 기록마다 제 칸이 있다', /class="legc \$\{갈래\}"/.test(V) && /class="legc mid"/.test(V), V.slice(0,200));
  T('★★★ 날씨가 나온다 (사장님이 공개하라 하심)', /날씨줄/.test(V) && /wxText\(/.test(V));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
