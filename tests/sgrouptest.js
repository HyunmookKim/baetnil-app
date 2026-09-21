// 연재 묶음 — 같은 연재 이름끼리 묶어서 보여 주는가
// ★ 왜 필요한가
//   연재는 한 가지만 도는 게 아니다. 여러 사람이 여러 연재를 이어 간다.
//   편 번호만 있으면 다른 연재의 3편과 내 연재의 3편이 뒤섞인다.
//   그래서 글마다 '어느 연재인가'(sname)를 달고, 그것으로 묶는다.
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const S = fs.readFileSync(FILE, 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,180):''));} };

// ── 1. 올릴 때 연재 이름을 받는가
T('글쓰기 창에 연재 이름 칸이 있다',
  /key:\s*'sname'/.test(S) && /label:\s*'연재 이름'/.test(S));
T('연재 이름 칸이 몇 편보다 위에 있다',
  S.indexOf("key:'sname'") >= 0 && S.indexOf("key:'no'") >= 0
    ? S.indexOf("key:'sname'") < S.indexOf("key:'no'")
    : /key:\s*'sname'[\s\S]{0,400}key:\s*'no'/.test(S));
T('이미 있는 연재 이름을 단추로 보여 준다',
  /chips:\s*seriesNames\(\)/.test(S));
T('저장할 때 연재 이름을 담는다',
  /sname:\s*String\(v\.sname/.test(S));

// ── 2. 묶는 판단이 한 곳에만 있다 (문 하나)
// ★ 같은 판단이 목록·글 화면 두 곳에 흩어지면 한쪽만 고쳐진다. 이 앱이 계속 당한 함정이다.
T('묶음 이름을 읽는 문이 하나다', /function\s+seriesName\s*\(/.test(S));
T('묶는 함수가 하나다', /function\s+seriesGroups\s*\(/.test(S));
T('연재 이름 목록을 만드는 함수가 있다', /function\s+seriesNames\s*\(/.test(S));
const useName = (S.match(/seriesName\(/g)||[]).length;
T('묶음 이름을 여러 곳에서 그 문으로만 읽는다', useName >= 4, useName);
T('목록이 seriesGroups 를 쓴다',
  /function\s+seriesHtml[\s\S]{0,1600}seriesGroups\(/.test(S));
// ★ 글 화면도 목록과 똑같은 문으로 묶어야 한다.
//   여기서 따로 묶으면 목록에서는 묶였는데 글 아래에서는 안 묶이는 일이 난다.
T('글 아래 목록도 같은 문으로 묶는다',
  /function\s+seriesAlso[\s\S]{0,900}seriesName\(/.test(S)
  && /function\s+seriesAlso[\s\S]{0,900}seriesGroups\(/.test(S));

// ── 3. 글 아래에 같은 연재의 다른 편
T('글 아래에 다른 편 목록을 붙이는 함수가 있다', /function\s+seriesAlso\s*\(/.test(S));
T('openSeries 가 그것을 부른다',
  /function\s+openSeries[\s\S]{0,3000}seriesAlso\(/.test(S));
T('지금 보는 편을 표시한다', /srnow/.test(S));

// ── 4. 옛 글을 버리지 않는다
// ★ 연재 이름이 없는 옛 글이 목록에서 사라지면 그건 자료를 잃은 것과 같다.
T('연재 이름이 없는 글도 자리가 있다', /묶지 않은 글/.test(S));

// ── 5. 규칙 — 새 칸 때문에 저장이 막히면 안 된다
const R = fs.readFileSync('firestore_rules.txt','utf8');
T('규칙이 연재 이름을 강제하지 않는다 (옛 글이 못 고쳐지면 안 된다)',
  !/sname/.test(R) || /get\('sname'/.test(R), 'sname 을 필수로 걸면 옛 글 고치기가 막힌다');

// ── 6. 저장이 매달리지 않게 막았는가 (사진 올리다 앱이 멈춘 사고)
T('저장에 시간 제한을 씌우는 문이 있다', /function\s+netWait\s*\(/.test(S));
T('파이어스토어 저장이 그 문을 지난다',
  /const\s+setDoc\s*=\s*\([\s\S]{0,120}netWait\(/.test(S));
T('사진 올리기가 그 문을 지난다',
  /const\s+uploadString\s*=\s*\([\s\S]{0,120}netWait\(/.test(S));
T('목록을 못 받으면 빈 목록으로 적어 두지 않는다',
  !/catch\(e\)\{\s*seriesList\s*=\s*\[\];\s*\}/.test(S));
T('올리다 실패하면 쓰던 글을 도로 열어 준다', /formReopen/.test(S));

console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad?1:0);
