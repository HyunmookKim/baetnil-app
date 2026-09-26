// 같이 타기 · 예정 항해 검사
// ★ 여기서 지키려는 것 두 가지
//   1) 금액을 적을 자리를 만들지 않는다 (무등록 유상 운송)
//   2) '크루' 라는 요트 말을 쓰지 않는다 (낚시배·모터보트도 쓴다)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };
const grab = (js, name) => {
  const i = js.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, st = js.indexOf('{', i);
  for(let j = st; j < js.length; j++){
    if(js[j] === '{') d++;
    else if(js[j] === '}'){ d--; if(!d) return js.slice(i, j + 1); }
  }
  return '';
};

// ── 말
// ★ 배 구성원 등급의 '크루' 는 원래 있던 것이라 건드리지 않는다.
//   여기서 보는 것은 '같이 타기' 기능 안에 요트 말이 새로 들어갔는가다.
const rideZone = (src.match(/const RIDE_TRIP[\s\S]*?const rideName/) || [''])[0]
               + (src.match(/\{ v:'ride',[^}]*\}/) || [''])[0];
T("'크루' 라는 말을 새 기능에 안 쓴다",
  rideZone.length > 100 && !/크루/.test(rideZone)
  && /\{ v:'ride',\s*name:\s*(t\()?'같이 타기'/.test(src));
T('말머리에 같이 타기가 있다', /v:'ride'/.test(src));

// ── 돈
const edit = grab(src, 'rideEdit');
T('비용은 고르기 두 가지뿐이다',
  /const RIDE_COST = \[[\s\S]*?\];/.test(src)
  && (src.match(/const RIDE_COST = \[[\s\S]*?\];/)||[''])[0].split("v:'").length - 1 === 2);
T('비용 칸에 숫자를 넣는 자리가 없다',
  !/key:'cost'[\s\S]{0,200}type:'(?!pick)/.test(edit));
T('한마디에 금액을 적으면 막는다', /원\|만원\|천원/.test(edit) && /금액은 적을 수 없습니다/.test(edit));
T('법 안내를 한 곳에서만 정한다',
  (src.match(/const RIDE_LAW =/g) || []).length === 1
  && /낚시어선업 신고나 마리나선박 대여업 등록/.test(src));
T('법 안내가 글 쓰는 화면과 글 안에 모두 나온다',
  /sub: RIDE_LAW/.test(edit) && /esc\(RIDE_LAW\)/.test(src));

// ── 예정 항해
// ★ 4.12x — 「+」 단추는 화면마다 fabActs() 가 짝을 지어 내놓는다.
//   항해일지 화면에 「+ 예정」 이 실제로 실려 있어야 한다.
T('예정 항해를 만드는 길이 있다',
  /function addPlan\(/.test(src)
  && /\['\+ 예정', 'addPlan\(\)'\]/.test(src)
  && /b === 'voyage'\) return \[[\s\S]{0,120}?'addPlan\(\)'\]\];/.test(src));
T('예정은 plan 표시를 단다', /plan:true/.test(grab(src, 'addPlan')));
T('예정 항해는 올해 항해 수에 안 들어간다', /!isPlan\(v\) && \(v\.date\|\|''\)\.startsWith\(y\)/.test(src));
// ★ 4.70 — 항해 공개가 켬·끔 둘에서 3단계(voyLv)로 바뀌었다.
//   「나만」 만 안 나가고, 「내 배에 들어온 사람만」 은 나가되 목록에는 안 실린다.
//   예정 항해는 단계와 상관없이 안 나간다 — 아직 있지도 않은 항해다.
T('예정 항해는 밖으로 안 나간다', /voyLv\(v\) !== 'none' && !v\.plan/.test(src));
T('출항하면 시각·위치·날씨를 잡는다',
  /function planStart\(/.test(src)
  && /wxCapture\('wxOut'/.test(grab(src, 'planStart'))
  && /posHere\('wxOut'/.test(grab(src, 'planStart')));
T('출항하면 모집이 닫힌다', /rideStop\(it, true\)/.test(grab(src, 'planStart')));
// ★ 4.111 — 예정 칸에 「출항 시각」 이 앞에 하나 더 붙었다 (사장님 지적: 「시간이 없네」).
//   그래도 「나간 뒤」 칸(도착·거리·항해시간·항적)은 여전히 안 보여야 한다.
// ★★★ 4.132 — 시각 칸은 hmRow 로 바뀌고 **날짜 바로 아래**로 올라갔다.
//   (사장님 지적: 「예정 쓸 때는 시간이 날짜 바로 아래 있어야 쉽지 않을까?」)
//   ① 예정일 때만 뜬다  ② 날짜 바로 아래다  ③ 출발지·도착지도 예정에 뜬다
T("예정에는 출항 시각 칸이 뜬다 (예정일 때만)",
  /\+ \(isPlan\(it\) \? hmRow\('출항 시각', it\.timeOut,[^\n]*\) : ''\)/.test(src),
  (src.match(/\+ \(isPlan\(it\) \? hmRow\([\s\S]{0,160}/) || [''])[0]);
{
  const i날짜 = src.indexOf("tf('날짜','date',it.date");
  const i시각 = src.indexOf("hmRow('출항 시각', it.timeOut");
  const i종류 = src.indexOf('+ tripKindRow(it)');
  T("출항 시각이 날짜 바로 아래에 있다 (한참 밑이 아니다)",
    i날짜 > 0 && i시각 > i날짜 && i종류 > i시각,
    { 날짜:i날짜, 시각:i시각, 종류:i종류 });
}
T("예정에는 출발지·도착지를 보여 준다",
  /\+ \(isPlan\(it\)\n[\s\S]{0,400}?\? tf\('출발지','from',it\.from\) \+ tf\('도착지\(예정\)','to',it\.to\)/.test(src),
  (src.match(/\+ \(isPlan\(it\)\n[\s\S]{0,400}/) || [''])[0].slice(0, 300));
T("예정에는 '나간 뒤' 칸(도착·거리·항적)을 안 보여 준다",
  /tf\('출발지','from',it\.from\) \+ tf\('도착지\(예정\)','to',it\.to\)\n\s*: \(''/.test(src),
  (src.match(/tf\('도착지\(예정\)'[\s\S]{0,80}/) || [''])[0]);

// ── 모집
T('모집 칸은 예정 항해에서만 보인다', /if\(!isPlan\(it\)\) return '';/.test(grab(src, 'rideBox')));
T('모집 내용을 한 곳에서만 만든다', (src.match(/function rideInfo\(/g) || []).length === 1);
T('어떤 분을 하나도 안 고르면 막는다', /어떤 분을 구하시는지 하나 이상 선택해 주세요/.test(edit));
T('모집을 켜면 글판에 올라간다', /function ridePush\(/.test(src) && /__talk\.add\(post\)/.test(grab(src, 'ridePush')));
T('고칠 때는 새 글을 또 만들지 않는다', /if\(it\.ridePost\)\{[\s\S]{0,300}__talk\.edit/.test(grab(src, 'ridePush')));
T('모집을 그만두면 글이 마감으로 바뀐다', /info\.open = false/.test(grab(src, 'rideStop')));
T('마감 날짜를 한 곳에서만 센다', (src.match(/function rideDeadline\(/g) || []).length === 1);
T('지난 모집은 목록에서 흐려진다', /\.fleet\.dim\{opacity:\.5\}/.test(src) && /dim\?' dim':''/.test(src));

// ── 여러 개 고르기 칸
T("여러 개 고르기(picks) 칸이 있다", /f\.type === 'picks'/.test(src));
T('고른 값을 formVals 가 돌려준다', /out\[f\.key\] = \(formPicks\[f\.key\] \|\| \[\]\)\.slice\(\)/.test(src));
T('입력 화면을 열 때 초기화한다', /formPick = \{\}; formPicks = \{\};/.test(src));

// ── 배 둘러보기 항해일지 (지난 판 잘못 고친 곳)
const pn = grab(src, 'pubVoyName');
T("제목이 없으면 '(제목 없음)' 을 만들지 않는다", pn.length > 0 && !/제목 없음/.test(pn));
// ★ 4.70 — 목록 제목도 자동 번역을 지난다 (trIn). 제목이 없으면 날짜가 원문 자리에 들어간다.
T('제목이 없으면 날짜만 나온다',
  /trIn\('voyage', v\.id, 'title', nm \|\| v\.date \|\| ''\)/.test(src));
// ★ 목록 한 줄을 그리는 자리만 떼어 본다. 자세히 보기에는 메모가 나오는 게 맞다.
const voyRow = (src.match(/\/\/ 목록 — 이름과 날짜만[\s\S]*?\}\)\.join\(''\);/) || [''])[0];
T('메모는 목록에 안 나온다', voyRow.length > 60 && !/v\.note/.test(voyRow));
T('눌러서 항해 내용을 볼 수 있다', /onclick="pubVoyOpen\(/.test(src));
// ★ 4.23 부터 뒤로가기 판단이 navBackKind / navDoBack 두 문으로 나왔다 (앱 단추와 같이 쓰려고).
// ★ 4.102 — 뒤로 가기는 **지나온 자국**을 따라간다. 안 들른 자리를 만들지 않는다
//   (사장님 지적: 「모든 뒤로 가기는 바로 직전에 있었던 페이지로 가는 게 맞겠지」).
T('뒤로가기가 지나온 자리로 돌아온다',
  /if\(typeof pubTrail !== 'undefined' && pubTrail\.length > 1\) return 'pubvoy';/.test(src)
  && /if\(k === 'pubvoy'\)\{ return pubBack\(\); \}/.test(src));
T('★★ 자국을 남기는 문이 하나다', /function pubMark\(\)/.test(src)
  && /function pubBack\(\)/.test(src));
T('다른 탭·다른 배로 가면 접힌다',
  (src.match(/pubVoyId = '';/g) || []).length >= 3);

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
