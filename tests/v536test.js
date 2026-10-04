// 5.36 — 사장님 지적 (2026-10-04): 같은 꼴이 다시 들어오지 않게 원본을 훑는다
//   ① 「장비에서 고장 났다고 표시를 하면 바로 말도 없이 이게 수리 목록으로 들어가 버리잖아 … 제목이 없이 들어가네」
//   ② 「저장 후 닫기 그냥 닫기 뒤로 가기 … 다른 어플들이랑 완전히 다르거든」
//   ③ 「내가 말한 거 하나만 고치지 말라고 했는데 … 또 하나만 고쳐놔가지고」 (내리면 사라지는 줄)
//   ④ 「기타 해 가지고 직접 적기 하면은 … 그 이름이 위에가 있어야지」
//   ⑤ 「날씨에 보면은 언제 해가 뜨고 지는지 이런 것도 지금 안 나와 있네」
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const src = fs.readFileSync(FILE, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const grab = name => { const i = src.indexOf('function ' + name + '('); if(i < 0) return '';
  let d = 0, st = src.indexOf('{', i);
  for(let j = st; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(i, j + 1); } }
  return ''; };

// ① 말 없이 다른 기록을 만들지 않는다
{
  const g = grab('gearStatePick');
  T('장비 「고장」 을 골라도 수리 기록을 바로 만들지 않는다', !/repair\.push/.test(g) && !/addRepairForGear\(/.test(g) && /gearRepairAsk\(/.test(g));
  T('「고장」 옆에 「수리목록에 추가됩니다」', /name:'고장', sub:'수리목록에 추가됩니다'/.test(g));
  const a = grab('gearRepairAsk');
  T('내용이 없으면 만들지 않는다', /if\(!내용\) return formErr\('title', '내용을 입력해 주세요'\)/.test(a));
  T('만든 뒤 「수리목록에 추가했습니다」 + 보기', /snack\(t\('수리목록에 추가했습니다'\)[\s\S]{0,80}name:'보기'/.test(a));
  T('장비 화면 「+ 고장」 도 같은 창', /function addRepairForGear\(id\)\{ gearRepairAsk\(id\); \}/.test(src));
  T('항해 연료 게이지가 연료 기록을 처음 만들면 알린다', /snack\(t\('연료 기록에 추가했습니다'\)/.test(grab('voyGauge')));
  T('수리는 내용, 정기점검은 이름이 없으면 저장 안 함', /kind === 'repair' && !String\(it\.title/.test(grab('mrNeedTitle')) && /kind === 'maint' && !String\(it\.name/.test(grab('mrNeedTitle')));
  T('「+ 추가」 로 막 만든 기록은 취소하면 남지 않는다', /if\(새것\)\{ mrDropNew\(kind, id\); return true; \}/.test(grab('mrLeaveOk')));
  for(const fn of ['mrAdd', 'addGear', 'addMlog', 'addFuel', 'addRun', 'addReview', 'addContact', 'addVdoc', 'addMaintForGear'])
    T('새 기록은 「새것」 으로 연다 — ' + fn, /mrOpenNew\(/.test(grab(fn)), grab(fn).slice(0, 120));
}

// ② 머리 단추
{
  T('「저장 후 닫기」·「저장하지 않고 닫기」 단추가 없다', !/t\('저장 후 닫기'\)\)\}<\/button>/.test(src) && !/t\('저장하지 않고 닫기'\)\)\}<\/button>/.test(src));
  T('오른쪽 「목록」 단추가 없다 (머리줄 ← 하나로)', !/<button class="tab" onclick="[^"]+">\$\{esc\(t\('목록'\)\)\}<\/button><\/div>/.test(src)
    && !/\$\{할일\}<button class="tab" onclick="[^"]+">\$\{esc\(t\('목록'\)\)\}/.test(src));
  T('오른쪽 「← 계류장」 같은 단추가 없다', !/<button class="tab" onclick="[^"]+">\$\{esc\(t\('← (계류장|오늘|운영자|공개 설정|등급 설정|회원 명부|뒤로)'\)\)\}<\/button>/.test(src));
  T('「취소」 를 오른쪽에 두는 머리줄이 없다 (모두 왼쪽 nvL)', !/<span style="flex:1"><\/span>\s*<button class="tab" onclick="[^"]+">\$\{esc\(t\('취소'\)\)\}<\/button>/.test(src));
  T('머리줄 「←」 — 들어온 화면에만', /SCREEN_STACK\.length\)\s*\?\s*`<button class="hback" onclick="navBackBtn\(\)"/.test(grab('setHeadTitle')));
  T('고치는 화면이면 머리줄 ← 를 숨긴다', /classList\.toggle\('nvedit'/.test(grab('showPanel')) && /body\.nvedit #hNav \.hback\{display:none\}/.test(src));
  T('뒤로 가기가 위 화면(data-up)을 따른다', /mrhead\[data-up\]/.test(grab('closeTopScreen')));
  T('고치던 기록에서 뒤로 가면 취소처럼 묻는다', /mrRecShown\(\) && \(mrDirty\(\) \|\| mrNewKeys\.has/.test(grab('closeTopScreen')));
  const n = (src.match(/data-up="/g) || []).length;
  T('위 화면이 정해진 머리줄이 여럿(10곳 넘게)', n >= 10, n);
}

// ③ 내리면 사라지던 줄
for(const [n, re] of [
  ['계류장 탭 줄이 머리줄 안', /return `<div class="mrhead mrhead2"><b>\$\{esc\(t\('계류장'\)\)\}<\/b><span style="flex:1"><\/span>\s*<div class="bsubs">/],
  ['달력 머리', /<div class="calhead pinbar">/],
  ['체크리스트 목록 줄 + 진행·관리 줄 한 덩어리', /<div class="pinbar ckpin"><div class="ckchips">/],
  ['정기점검 거르개(전체·기한 초과·임박)', /<div id="gearFlt" class="gflt"><\/div>/],
  ['정박지 목록·지도', /\+ `<span style="flex:1"><\/span>` \+ spotViewBtns\(\)/],
  ['날씨 지점 줄', /<div class="wxbar pinbar">/]
]) T('붙여 두는 줄 — ' + n, re.test(src));

// ④ 연락처 직접 입력
{
  const p = grab('paintCiEdit');
  T('「직접 입력」 이면 용도 칸 그 자리에 글 칸', /c\.lab === 'custom'\s*\/\/[\s\S]{0,600}\? `<span class="cicus"><input class="cisel cicl"/.test(p));
  T('연락처 아래 따로 「직접 입력」 칸이 없다', !/<input class="ciinput" value="\$\{esc\(c\.cl\)\}"/.test(p));
  T('보기: 종류 · 용도가 번호 위', /<div class="cihead"><span class="cikind">\$\{esc\(t\(ciKind\(c\.t\)\.name\)\)\}\$\{lab \? ' · ' \+ esc\(lab\) : ''\}/.test(grab('ciRowsHtml')));
}

// ⑤ 일출·일몰
{
  T('날마다 일출·일몰을 받는다(원래부터)', /&daily=sunrise,sunset/.test(src));
  T('날짜 머리에 일출·일몰', /<span class="wsun">\$\{wxSunLine\(해\)\}<\/span>/.test(src));
  T('밤 칸을 실제 일출·일몰로', /const night = 해 \? \(ts \+ 1800e3 < 해\.rise \|\| ts \+ 1800e3 >= 해\.set\)/.test(src));
  T('고른 시각 줄에도', /wsunsel/.test(grab('renderWxSel')));
}

console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
process.exit(bad ? 1 : 0);
