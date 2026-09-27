// 보기 전용인데 고치는 단추가 떠 있다 (4.69)
//
// ★ 왜 (2026-08-29 사장님 지적, 정비수첩 화면 사진)
//   「보기 전용」 인데 사진 밑에 「사진 빼기」 가 그대로 떠 있었다.
//
// ★ 이 앱의 규칙은 둘로 갈린다. 둘 다 까닭이 있다.
//   ① 「무엇을 시작하는」 단추 — 첫 항목 추가 · 배 등록 · 백업 복원.
//      잠겨 있어도 **보인다.** 감추면 그 기능이 아예 없는 줄 안다.
//      (실제로 '데이터 백업' 은 보이는데 '백업 복원' 만 없어서 사라진 줄 알았던 적이 있다.)
//      누르면 needEdit 이 「보기 전용입니다, 편집 중으로 바꿀까요」 를 물어 준다.
//   ② 이미 있는 것에 붙은 「고치는·빼는」 단추 — 사진 빼기 · 단계 빼기 · 순서 바꾸기 · 삭제.
//      **감춘다(class 에 edt).** 눌러도 안 되는 단추가 널려 있으면 화면이 거짓말을 한다.
//
//   ★ 새 화면을 만들 때 ②를 자꾸 빠뜨린다. 그래서 검사로 못 박는다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };

// 잠그면 사라지게 하는 규칙이 살아 있나
T('★★ 잠그면 edt 가 사라지는 규칙이 있다', /body\.locked \.edt\{display:none!important\}/.test(src));

// ── ② 갈래 — 이미 있는 것에 붙은 고치는 단추. 여기에 edt 가 없으면 실패다.
//   「이 …를」 「이 단계」 처럼 **그것 하나를** 가리키는 말이 들어간 것이 ② 갈래다.
{
  const 나쁜 = [];
  const re = /<button[^>]*onclick="[^"]*needEdit\('([^']*)'/g;
  let m;
  while((m = re.exec(src))){
    const what = m[1];
    // ① 갈래(시작하는 것)는 건너뛴다
    // 「사용기」 가 「리뷰」 로 바뀌었다 — 빈 화면의 시작 단추라 ① 갈래 그대로다
    if(/^(배를|참여 코드로|정비 항목을 넣습니다|수리 항목을 넣습니다|장비를 넣습니다|리뷰를 씁니다|배 리뷰를 씁니다|정비수첩을 씁니다|날씨 지점을)/.test(what)) continue;
    const seg = src.slice(m.index, m.index + 260);
    const cls = (seg.match(/class="([^"]*)"/) || ['',''])[1];
    if(!/(^|[\s}])edt([\s"]|$)/.test(cls) && !/\bedt\b/.test(cls)){
      나쁜.push({ 무엇: what, 클래스: cls });
    }
  }
  T('★★★ 고치는 단추에 edt 가 다 붙어 있다', 나쁜.length === 0, 나쁜);
}

// ── 사장님이 잡아 주신 그 자리를 하나하나 짚는다
[['이 단계의 사진을 뺍니다.', '사진 빼기'],
 ['이 단계에 사진을 넣습니다.', '사진 넣기'],
 ['이 단계를 뺍니다.', '단계 빼기'],
 ['단계 순서를 바꿉니다.', '순서 바꾸기'],
 ['정비 절차에 단계를 더합니다.', '단계 추가'],
 ['홈포트 위치를 지도에서 정합니다.', '홈포트 정하기']].forEach(([what, 이름])=>{
  const i = src.indexOf("needEdit('" + what);
  const st = src.lastIndexOf('<button', i);
  const cls = (src.slice(st, i).match(/class="([^"]*)"/) || ['',''])[1];
  T('★★ ' + 이름 + ' 는 보기 전용에서 사라진다', /\bedt\b/.test(cls), cls);
});

// ── ① 갈래 — 5.18 에서 바뀌었다 (사장님 2026-09-27 「보기전용인데 버튼 왜 다 살아있냐」)
//   전에는 「첫 정비수첩 쓰기」·「첫 리뷰 쓰기」 도 잠겨 있어도 보이고 누르면 되물었다.
//   이제 이 배의 기록을 늘리는 단추는 보기 전용이면 전부 감춘다 (needEdit 를 부르는 단추는 CSS 가 감춘다).
//   남는 것은 지금 배를 고치는 일이 아닌 「배 등록하기」·「참여 코드로 신청」 뿐 — 누르면 바로 편집 중으로 (editGo).
T('★ needEdit 를 부르는 단추는 보기 전용이면 감춘다', /body\.locked \[onclick\*="needEdit\("\]\{display:none!important\}/.test(src));
['addBoat', 'joinByCode'].forEach(fn=>{
  T('★ ' + fn + ' 단추는 잠겨 있어도 보이고 누르면 바로 편집 중으로 (editGo)', src.includes('onclick="editGo(' + fn + ')"'));
});

// ── 공개 스위치는 단추만 감추고 「지금 어떤 상태인지」 는 남긴다
{
  // ★ 4.72 — 공개 줄은 항해일지·정비수첩·리뷰가 같은 문(pubLvRow)을 쓴다.
  //   잠겨 있으면 고르는 칸을 감추되, 지금 어느 단계인지는 글자로 남긴다.
  const i = src.indexOf('function pubLvRow(');
  const seg = src.slice(i, i + 1400);
  T('★★ 공개 단추는 감추되', /unlocked/.test(seg) && /<select onchange="pubLvSet/.test(seg), seg.slice(0,700));
  T('★★ 지금 올라가 있는지는 잠겨 있어도 보인다',
    /: `<b class="mrv">\$\{esc\(t\(one\.name\)\)\}<\/b>`/.test(seg), seg.slice(0,900));
  T('★★ 뜻을 적은 줄은 잠겨 있어도 보인다', /esc\(t\(one\.sub\)\)/.test(seg));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
