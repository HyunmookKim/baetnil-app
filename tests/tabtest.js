// 화면이 '탭처럼' 보이는가 + 제원 화면 검증
//
// 지적: 내 배·명부·등급 같은 화면을 열면 머리줄에는 아직 '적재표' 가 떠 있고
//       아래 탭도 적재표가 켜져 있어서, 다른 탭 위에 얹힌 것처럼 보인다.
//       적재표·정비·날씨처럼 그 화면 자체가 하나의 탭으로 보여야 한다.
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const css = src.slice(0, src.indexOf('</style>'));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 화면 열기가 한 곳으로 모여 있어야 한다
T('화면 여는 함수(showPanel)가 있다', !!grab(js, 'showPanel'));
// showPanel 자신은 빼고 본다 — 화면을 여는 곳은 거기 한 군데뿐이어야 한다
T('화면을 손으로 여는 곳이 남아 있지 않다', (function(){
  const body = grab(js, 'showPanel') || '';
  return (js.split("classList.add('open', 'full')").length - 1)
       - (body.split("classList.add('open', 'full')").length - 1) === 0;
})());
{
  const n = (js.match(/showPanel\(/g) || []).length;
  T('모든 화면이 showPanel 로 열린다 (지금 ' + n + '곳)', n >= 15);
}

// ── 2. 화면을 열면 머리줄 이름이 그 화면 이름으로 바뀐다
{
  const sp = grab(js, 'showPanel') || '';
  // 3.4 부터 제목은 setHeadTitle 한 곳에서만 만든다
  T('머리줄 이름을 그 화면 이름으로 바꾼다',
    /setHeadTitle\(/.test(sp) && /textContent/.test(sp));
  T('화면 이름은 화면이 스스로 적은 제목에서 가져온다',
    /mrhead|mrtop|querySelector/.test(sp));
  T('아래 탭 불을 끈다 — 딴 탭에 있는 것처럼 보이면 안 된다',
    /classList\.remove\('on'\)|toggle\('on', false\)/.test(sp));
}

// ── 3. 닫으면 원래 탭으로 돌아온다
{
  const cb = grab(js, 'closeBoat') || '';
  const cm = grab(js, 'closeMR') || '';
  T('닫을 때 머리줄과 탭을 되돌린다(내 배 쪽)', /restorePanel|paintTabs|TAB_TITLES/.test(cb));
  T('닫을 때 머리줄과 탭을 되돌린다(기록 쪽)', /restorePanel|paintTabs|TAB_TITLES/.test(cm));
  T('되돌리는 함수가 한 곳에 있다', !!grab(js, 'restorePanel'));
}

// ── 4. 화면 안에 제목이 두 번 나오지 않는다
T('화면 안 제목은 감춘다 (머리줄에 이미 있다)',
  /#mrPanel\.full[^{]*\.mrhead\s*>\s*b[^{]*\{[^}]*display:\s*none/.test(css));

// ── 5. 제원 — 저장 버튼
T('제원 화면에 저장 버튼이 있다', /saveSpecNow\(\)/.test(js));
{
  const ss = grab(js, 'saveSpecNow') || '';
  T('저장이 실제로 저장한다', /saveLocal|saveMR/.test(ss));
  T('저장이 클라우드에도 올린다', /__saveBoat|schedulePush/.test(ss));
  T('저장했다고 알려준다', /tell\(/.test(ss));
  T('화면의 모든 제원 칸을 읽는다', /sp_|querySelectorAll/.test(ss));
}
T('제원 칸에 id 가 붙어 있다', /id="sp_\$\{k\}"|id="sp_'/.test(src) || /sp_\$\{/.test(src));

// ── 6. 다시 계산으로 바뀌는 칸은 눈에 띄게
{
  const m = js.match(/const WX_AUTO_KEYS = \[([\s\S]*?)\];/);
  const keys = m ? [...m[1].matchAll(/'([a-zA-Z0-9]+)'/g)].map(x => x[1]) : [];
  T('자동 계산되는 항목 목록이 있다', keys.length > 0);
  // suggestWxLimits 가 실제로 내놓는 키와 같아야 한다
  const sw = grab(js, 'suggestWxLimits') || '';
  const outKeys = [...sw.matchAll(/(?:^|\s|\{)(max[A-Z]\w*|min[A-Z]\w*|reef\d|jibDown)\s*:/g)]
    .map(x => x[1]);
  const uniq = [...new Set(outKeys)];
  const gone = uniq.filter(k => !keys.includes(k));
  T('목록에 빠진 항목이 없다 — 빠진 것: ' + (gone.join(', ') || '없음'), gone.length === 0);
  T('자동 항목 칸에 표시를 붙인다', /wxauto/.test(js));
  T('표시된 칸은 색이 다르다', /\.wxauto/.test(css));
  T('무슨 뜻인지 적어 준다', /다시 계산/.test(js) && /wxauto/.test(js));
}

// ── 7. 내 배 안에 '소개' 탭
{
  const ob = (grab(js, 'openBoat') || '') + (grab(js, 'boatHead') || '');
  T('내 배에 소개 탭이 있다', /boatTab==='intro'|boatTab === 'intro'/.test(ob));
  T('소개 탭 버튼이 있다', /openBoat\('intro'\)/.test(ob));
  T('소개 탭이 소개 페이지를 그린다', /introRows|introBody|b\.intro/.test(ob));
  T('소개 탭에서 글·사진을 넣을 수 있다', /addIntro/.test(ob));
  const ai = grab(js, 'addIntro') || '';
  T('넣고 나면 소개 탭으로 돌아온다', /openBoat\('intro'\)|saveIntro/.test(ai));
  const si2 = grab(js, 'saveIntro') || '';
  T('저장하면 화면을 다시 그린다', /openIntro|openBoat/.test(si2));
  T('소개는 권한 없이 못 고친다', /can\(b\s*,\s*'publish'/.test(ob) || /can\(b,'publish'/.test(ob));
}

// ── ★★ 4.111 — switchTab 이 켜는 칸은 TAB_CONTENT 에도 다 있어야 한다 (사장님 지적)
//
//   달력(calWrap)이 TAB_CONTENT 에 빠져 있었다. 그래서 달력에서 「+ 예정」 을 누르면
//   화면이 바뀌지 않고 **달력 밑에 기록 창이 이어 붙었다.**
//   사장님: 「추가 이렇게 넣으면 화면이 바뀌는 게 아니라 그냥 달력에 아래로 나오잖아.」
//
//   ★ 까닭 — 화면을 갈아 끼울 때(screenPush) **TAB_CONTENT 에 적힌 것만** 자리에서 뺀다.
//     새 화면을 만들면서 여기 적는 것을 잊으면 그 화면만 안 빠진다. 눈으로만 잡히는 흠이다.
//     그래서 두 목록을 맞대 본다.
{
  const ST = grab(src, 'switchTab') || '';
  const 켜는칸 = [...new Set([...ST.matchAll(/show\('([A-Za-z]+)'/g)].map(m => m[1]))];
  const m = src.match(/const TAB_CONTENT = \[([\s\S]*?)\];/);
  const 적힌것 = m ? [...m[1].matchAll(/'([A-Za-z]+)'/g)].map(x => x[1]) : [];
  T('★ TAB_CONTENT 목록을 읽었다', 적힌것.length > 10, 적힌것.length);
  T('★ switchTab 이 켜는 칸을 읽었다', 켜는칸.length > 10, 켜는칸.length);
  const 빠진것 = 켜는칸.filter(x => 적힌것.indexOf(x) < 0);
  T('★★★ switchTab 이 켜는 칸이 TAB_CONTENT 에 다 있다 (없으면 그 화면만 안 사라진다)',
    빠진것.length === 0, 빠진것.join(', '));
  T('★★ 달력(calWrap)이 들어 있다', 적힌것.indexOf('calWrap') >= 0, 적힌것.join(','));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
