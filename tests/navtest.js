// 화면 뼈대 검증 — 하는 일로 묶은 2단 트리
//
// 지적: 탭을 순서대로 나열하기만 한 것은 정리가 아니다.
//       앱 성격이 '내 배 짐 찾기' 에서 '배를 운영하는 앱' 으로 바뀌었으니
//       적재표가 첫 탭일 이유가 없다.
//
// 3.1 뼈대
//   오늘      : 오늘 한눈에 | 날씨·물때 | 출항 전 점검
//   배        : 적재표 | 정기점검 | 수리목록 | 연료 | 문서·연락처
//   항해      : 항해일지            (3.2 에 조행기)
//   커뮤니티   : 배 둘러보기 | 영업 | 뉴스   (3.2 에 글판)
//   내 배(머리줄) : 기본정보 | 제원 | 배 소개 | 명부 | 등급 | 게시판 | 할 일 | 가입신청 | 공개설정
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const nav = src.slice(src.indexOf('<nav id="tabbar">'), src.indexOf('</nav>') + 6);
const drawer = src.slice(src.indexOf('<aside id="drawer"'), src.indexOf('</aside>') + 8);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 위 단계 넷
{
  const btns = [...nav.matchAll(/switchTab\('(\w+)'\)/g)].map(m => m[1]);
  T('아래 탭이 넷이다 (지금 ' + btns.length + ') — ' + btns.join(', '), btns.length === 4);
  // ★ 4.62 — 항해일지는 「내 배」 탭 안으로 들어가고, 그 자리에 「남의 배」 가 왔다.
  ['home','boat','others','community'].forEach(k=>
    T('아래 탭에 ' + k + ' 가 있다', btns.includes(k)));
  T('★★ 항해일지가 「내 배」 탭 안에 있다',
    /voyage\s*:\s*t\('항해일지'\)/.test((js.match(/const BOATSUB_TITLES = \{[\s\S]*?\};/)||[''])[0]));
  // ★ 4.63 — 정기점검·수리·연료가 「정비」 통으로 들어갔다. 항해일지는 통 밖이다.
  T('★★ 항해일지는 통에 안 들어간다 (급하게 쓰는 것이라 한 번에 닿아야 한다)',
    /voyage\s*:\s*t\('항해일지'\)/.test((js.match(/const BOATSUB_TITLES = \{[\s\S]*?\};/)||[''])[0])
    && !/k:'voyage'/.test((js.match(/const MNT_SUBS = \[[\s\S]*?\];/)||[''])[0]));
  T('★★ 정비가 적재표 다음이다',
    (()=>{const m=(js.match(/const BOATSUB_TITLES = \{[\s\S]*?\};/)||[''])[0];
      return m.indexOf("stow:") < m.indexOf("maint:") && m.indexOf("maint:") < m.indexOf("gear:");})());
  T('적재표는 더 이상 첫 탭이 아니다', btns[0] === 'home');
  T('첫 탭이 오늘 화면을 연다', /id="tabHome"[^>]*switchTab\('home'\)/.test(nav));
}
T('탭 이름표가 새 뼈대를 따른다',
  /home\s*:\s*(t\()?'오늘'/.test(js) && /boat\s*:\s*(t\()?'내 배'/.test(js)
  && /others\s*:\s*(t\()?'남의 배'/.test(js) && /community\s*:\s*(t\()?'커뮤니티'/.test(js));
T('★ 아래 탭 「내 배」 와 서랍 「계류장」 이 안 겹친다',
  /data-t="계류장"/.test(src) && /data-t="내 배">내 배/.test(src));
T('★★ 「정비」 안에 정비수첩·정기점검·수리·연료가 있다',
  ['mlog','maint','repair','fuel'].every(k=>new RegExp("k:'"+k+"'").test(js)));

// ── 2. 아래 단계 — 제목 자리에 하위 탭이 그려진다
{
  T('오늘 하위가 있다', /homeSub/.test(js));
  T('배 하위가 있다', /boatSubTab/.test(js));
  T('커뮤니티 하위가 있다', /comSub/.test(js));
  // 제목과 하위 탭에 같은 이름을 두 번 쓰지 않는다
  T('제목 자리에 하위 탭을 그린다', !!grab(js, 'paintHNav'));
  T('제목 자리가 머리줄 안에 있다', /<div id="hNav">/.test(src));
  T('따로 있던 하위 줄은 없앴다',
    !/id="homeSubBar"/.test(src) && !/id="boatSubBar"/.test(src) && !/id="comSubBar"/.test(src));
  T('탭을 옮기면 제목 자리를 다시 그린다', /paintHNav\(\)/.test(grab(js, 'switchTab') || ''));
  const ph = grab(js, 'paintHNav') || '';
  T('고른 것에 표시가 붙는다', /k === cur/.test(ph) && /' on'/.test(ph));
  T('하위가 없는 탭은 이름만 적는다', /TAB_TITLES\[curTab\]/.test(ph));
  T('화면을 열면 그 이름만 적는다', /hNav/.test(grab(js, 'setHeadTitle') || ''));
  T('제목은 한 곳에서만 만든다 (id 가 겹치지 않는다)',
    (src.match(/id="hTitle"/g) || []).length === 0);
  // 버튼은 이름표 목록에서 만들어진다 — 목록에 있으면 버튼도 나온다
  const mapOf = name => (js.match(new RegExp('const ' + name + ' = \\{[^}]*\\}')) || [''])[0];
  const hs = mapOf('HOMESUB_TITLES'), bs = mapOf('BOATSUB_TITLES'), cs = mapOf('COMSUB_TITLES');
  ['today','weather','news','check'].forEach(k=>
    T('오늘 하위에 ' + k + ' 가 있다', new RegExp("\\b" + k + "\\s*:").test(hs)));
  ['stow','maint','gear','voyage','docs'].forEach(k=>
    T('배 하위에 ' + k + ' 가 있다', new RegExp("\\b" + k + "\\s*:").test(bs)));
  // ★ 3.23 에서 '영업(biz)' 은 탭에서 빠지고 '배 둘러보기' 안의 필터가 됐다.
  //   좁은 폰에서 하위 탭 여섯 개는 제목 자리를 넘겨 밀어야만 보였다.
  ['talk','spots','market','explore'].forEach(k=>
    T('커뮤니티 하위에 ' + k + ' 가 있다', new RegExp("\\b" + k + "\\s*:").test(cs)));
  T('★★ 뉴스만 「오늘」 탭으로 갔다', !/\bnews\s*:/.test(cs));
  T('★ 하위 탭이 다섯을 안 넘는다', (cs.match(/[a-z]+\s*:\s*t\(/g)||[]).length <= 5);
  T('영업은 탭이 아니라 둘러보기 안에 있다',
    !/\bbiz\s*:/.test(cs) && /setExploreBiz\(/.test(js));
}

// ── 3. 오늘 화면 — 켜자마자 나가도 되는지가 보인다
{
  T('오늘 화면을 그리는 함수가 있다', !!grab(js, 'renderHome'));
  const rh = grab(js, 'renderHome') || '';
  T('오늘 화면에 날씨가 있다', /wx|날씨/.test(rh));
  // '출항' 글자만 보면 다른 칸(출항 전 점검)에 걸려 헛통과한다. 실제 판단을 본다.
  T('오늘 화면에 출항 판단이 있다',
    /wxWarnings\(\s*now\s*\)/.test(rh) && /나가지 마세요/.test(rh) && /나갈 만합니다/.test(rh));
  T('오늘 화면에 물때가 있다', /tide|물때|만조/.test(rh));
  T('오늘 화면에 임박한 정비가 있다', /mStatus|정비/.test(rh));
  T('오늘 화면에 할 일이 있다', /myTasks|할 일/.test(rh));
  T('오늘 화면에서 눌러 들어갈 수 있다', /setHomeSub|switchTab/.test(rh));
}

// ── 4. 옛 이름으로 불러도 제자리를 찾아간다
{
  const sw = grab(js, 'switchTab') || '';
  [['stow','배'],['maint','배'],['fuel','배'],['contacts','배'],
   ['weather','오늘'],['check','오늘'],['news','커뮤니티']].forEach(([k,g])=>
    T('옛 이름 ' + k + ' 은 ' + g + ' 로 간다',
      new RegExp("(^|[^\\w])" + k + "\\s*:\\s*\\[").test(sw)));
  // 목록만 있고 쓰지 않으면 아무 소용이 없다
  T('옛 이름 되돌리기를 실제로 쓴다',
    /if\(OLD\[t\]\)/.test(sw) && /t\s*=\s*g\s*;/.test(sw));
}

// ── 5. 사람 것들은 내 배 안에
{
  // 3.2 부터 버튼 줄은 boatHead 가 만든다 (어느 화면에서든 다시 그릴 수 있게)
  const ob = (grab(js, 'openBoat') || '') + (grab(js, 'boatHead') || '')
           + (js.match(/const BOAT_TABS2 = \[[\s\S]*?\];/) || [''])[0];
  ['info','spec','intro'].forEach(k=>
    T('내 배에 ' + k + ' 탭이 있다', new RegExp("openBoat\\('" + k + "'\\)").test(ob)));
  T('내 배에서 명부로 간다', /openRoster/.test(ob));
  T('내 배에서 등급으로 간다', /openRanks/.test(ob));
  T('내 배에서 게시판으로 간다', /openBoard/.test(ob));
  T('내 배에서 할 일로 간다', /openMyTasks/.test(ob));
  T('내 배에서 가입 신청으로 간다', /openJoinReqs/.test(ob));
  T('내 배에서 공개 설정으로 간다', /openPublish/.test(ob));
}

// ── 6. 서랍은 계정과 자료만
{
  // 처음부터 감춰 둔 것(운영자·언어)은 평소에 안 보이므로 세지 않는다
  const items = [...drawer.matchAll(/class="ditem"[^>]*?onclick="([^"]+)"/g)]
    .filter(m => !/display:none/.test(m[0])).map(m => m[1]);
  // 고객센터와 약관·개인정보가 한 칸씩 더 썼다. 둘 다 여기 말고 갈 자리가 없다 —
  // 하나는 앱이 이상할 때 여는 곳이고, 하나는 법이 '언제든 볼 수 있게' 하라는 것이다.
  // 열을 넘으면 서랍을 접거나 묶어야 한다.
  T('서랍이 열을 넘지 않는다 (지금 ' + items.length + ')', items.length <= 10);
  T('서랍에서 게시판을 뺐다 (내 배로)', !/openBoard\(\)/.test(drawer));
  T('서랍에서 할 일을 뺐다 (내 배로)', !/openMyTasks\(\)/.test(drawer));
  T('서랍에서 연락처를 뺐다 (배로)', !/drawerGo\('contacts'\)/.test(drawer));
  T('계정은 남는다', /openAccount\(\)/.test(drawer));
  T('서랍에서 설정으로 간다', /openSettings\(\)/.test(drawer));

  // ★ 4.42 — 서랍 첫 줄에 메일 주소가 나오면 안 된다.
  //   구글 계정에 이름을 안 넣어 둔 분은 이름이 비어 있어 me.email 로 넘어갔고,
  //   서랍을 열 때마다 자기 메일 주소가 통째로 떠 있었다.
  //   글자 모양이 아니라 「무엇이 찍히나」를 본다 — 함수를 진짜 돌린다.
  {
    const aa = grab(js, 'applyAccount') || '';
    const label = who => {
      const el = { textContent:'' };
      try {
        new Function('me','t','document', aa + '\nreturn applyAccount;')(
          who, x => x, { getElementById: id => (id === 'acctBtn' ? el : null) })();
      } catch(e){ return '터짐:' + e.message; }
      return el.textContent;
    };
    T('이름이 있으면 이름을 보여 준다', label({ name:'김명준', email:'a@b.com' }) === '김명준');
    T('★ 이름이 없어도 메일 주소를 안 보여 준다',
      label({ name:'', email:'jaha814@gmail.com' }) === '계정',
      label({ name:'', email:'jaha814@gmail.com' }));
    T('로그인 전에는 로그인이라고 한다', label(null) === '로그인');
  }
  T('앱 새로 받기는 서랍에 남는다', /forceReload\(\)/.test(drawer));

  // ★ 4.41 — 클라우드·파일 네 줄이 서랍에서 설정으로 옮겨 갔다.
  //   여기서 묻는 것은 「어디 적혀 있나」가 아니라 「가 닿을 길이 있나」다.
  //   그리고 길은 하나여야 한다 — 두 곳에 두면 둘이 따로 놀기 시작한다(문 하나).
  const setBody = grab(js, 'openSettings') || '';
  for(const [fn, name] of [['syncUp','클라우드에 올리기'], ['syncDown','클라우드에서 받아오기'],
                           ['backupData','파일로 저장'], ['drawerRestore','파일에서 불러오기']]){
    const inSet = new RegExp(fn + '\\(\\)').test(setBody);
    const inDrw = new RegExp(fn + '\\(\\)').test(drawer);
    T('설정에서 ' + name + '에 닿는다', inSet);
    T(name + ' — 가는 길이 하나다', inSet && !inDrw);
  }
  // 클라우드와 파일은 하는 일이 다르다 — 이름표로 갈라 놓는다
  T('★ 설정에서 클라우드와 파일을 갈라 놓았다',
    setBody.indexOf("t('클라우드')") >= 0 && setBody.indexOf("t('파일')") >= 0);
  // ★ 「백업」은 삼성에서 클라우드를 뜻한다. 우리가 파일 뜻으로 쓰면 계속 헷갈린다.
  //   사람에게 보이는 글자만 본다 — 주석에 적어 둔 까닭은 아무도 못 본다.
  const seen = setBody.replace(/\/\/[^\n]*/g, '');
  T('★ 사람에게 보이는 곳에 「백업」이라는 말이 없다', !/백업/.test(seen));
  // 그 자리에서 일이 벌어지는 줄에 화살표(›)를 붙이면 「다음 화면」이라는 거짓말이 된다
  T('일어나는 줄에는 화살표를 안 붙인다',
    /const act = \(/.test(setBody) && !/rsaquo/.test(setBody.slice(setBody.indexOf('const act = ('),
      setBody.indexOf('const lbl'))));
}

// ── 7. 내 배 — 눌러 들어가도 버튼 줄이 안 사라진다
//    지적: 기본정보·제원·배 소개는 줄이 남는데, 회원 명부부터는 줄이 통째로 사라진다.
{
  T('내 배 버튼 줄이 한 곳에서 만들어진다', !!grab(js, 'boatHead'));
  T('버튼 줄을 되살리는 함수가 있다', !!grab(js, 'boatKeepTabs'));
  const bk = grab(js, 'boatKeepTabs') || '';
  T('그 화면의 머리줄을 버튼 줄로 바꿔 낀다', /mrhead/.test(bk) && /boatHead/.test(bk));
  T('지금 보고 있는 곳이 켜져 보인다', /cur\s*===\s*k|cur===k/.test(grab(js, 'boatHead') || ''));
  // 여섯 화면 전부에서 되살려야 한다 — 하나라도 빠지면 거기서 줄이 사라진다
  ['openRoster','openRanks','openBoard','openMyTasks','openJoinReqs','openPublish'].forEach(fn=>{
    const f = grab(js, fn) || '';
    T(fn + ' 에서 버튼 줄이 남는다', /boatKeepTabs\(/.test(f));
  });
}

// 같은 버튼이 화면 안에 두 번 나오면 안 된다
{
  const mb = grab(js, 'memberBlock') || '';
  ['openPublish','openRoster','openRanks','openJoinReqs'].forEach(fn=>
    T('회원 칸에 ' + fn + ' 버튼이 겹쳐 있지 않다', !new RegExp(fn + '\\(\\)').test(mb)));
}

// ── 8. 켤 때 화면과 아래 탭이 어긋나면 안 된다
//    새로고침하면 '오늘' 에 불이 켜져 있는데 내용은 적재표가 나왔다.
{
  T('켤 때 그 화면을 실제로 그린다', /switchTab\(curTab\)/.test(js));
  T('시작 탭이 오늘이다', /let curTab = 'home';/.test(js));
  T('아래 탭에 불을 미리 박아 두지 않는다',
    !/<button id="tabHome" class="on"/.test(src));
  T('도면을 미리 켜 두지 않는다', /<div id="mapWrap" style="display:none"/.test(src));
  T('적재표 도구줄을 미리 켜 두지 않는다', /<div id="stowTools" style="display:none"/.test(src));
  T('켤 때는 언제나 오늘이다', /let curTab = 'home';/.test(js));
  // ★ 3.16 에서 갈렸다.
  //   배 탭은 보던 화면을 기억하는 편이 낫다 (적재표를 계속 보는 사람이 많다).
  //   그러나 오늘 탭은 아니다 — 날씨를 보고 끄면 다음에 켜도 날씨가 먼저 나와서
  //   '오늘 나갈 수 있나' 가 안 보였다. 앱을 켜는 첫 이유가 그것이므로 오늘부터다.
  T('배 탭은 보던 화면을 기억한다', /getItem\('bt_boatsub'\)/.test(js));
  T('오늘 탭은 언제나 오늘부터다', /let homeSub = 'today';/.test(js));
}

// ── 9. 옛 탭 이름으로 비교하는 곳이 남아 있으면 안 된다
//    3.1 에서 curTab 값을 stow/maint/… 에서 home/boat/… 로 바꿨는데
//    옛 이름으로 비교하던 곳을 다 못 고쳐, 정기점검·수리목록이
//    'boat' 를 만나 그냥 return 하고 화면에 아무것도 안 그렸다.
//    (기록은 멀쩡했는데 날아간 것처럼 보였다)
{
  T('지금 화면 이름을 알려주는 함수가 있다', !!grab(js, 'curScreen'));
  const cs = grab(js, 'curScreen') || '';
  T('배 하위를 옛 이름으로 돌려준다', /boatSubTab/.test(cs) && /contacts/.test(cs));
  T('오늘 하위를 옛 이름으로 돌려준다', /homeSub/.test(cs) && /'today'/.test(cs));
  const stale = [...js.matchAll(/curTab\s*[!=]==?\s*'(stow|maint|repair|weather|fuel|news|contacts|check)'/g)]
    .map(m => m[1]);
  T('옛 이름으로 curTab 을 비교하는 곳이 없다 — 남은 것: ' + (stale.join(', ') || '없음'),
    stale.length === 0);
  // 그리는 쪽이 실제로 새 함수를 쓰는가
  T('renderMR 이 지금 화면 이름을 본다', /curScreen\(\)/.test(grab(js, 'renderMR') || ''));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
