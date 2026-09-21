// 설정 · 알림 · 정비 알림 검사
const fs = require('fs');
const SRC = process.argv[2] || 'work.html';
const h = fs.readFileSync(SRC, 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : (fail++, console.log('★ 실패:', n)); };
// 함수 하나만 떼어 낸다 — [\s\S]*? 로 훑으면 함수 밖까지 잡아 헛통과가 난다
function fn(name){
  let i = h.indexOf('async function ' + name + '(');
  if(i < 0) i = h.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, started = false;
  for(let j = i; j < h.length; j++){
    const c = h[j];
    if(c === '{'){ d++; started = true; }
    else if(c === '}'){ d--; if(started && d === 0) return h.slice(i, j + 1); }
  }
  return h.slice(i);
}

// ── 1. 설정 — 서랍이 길어지는 것을 막는다
t('설정 화면이 있다', !!fn('openSettings'));
t('서랍에 설정이 있다', /onclick="closeDrawer\(\);openSettings\(\)"/.test(h));
t('서랍에서 언어를 뺐다', !/id="langBtn"/.test(h));
t('설정 안에 알림과 언어가 있다', (()=>{ const f = fn('openSettings');
  return /openNoti\(\)/.test(f) && /openLang\(\)/.test(f); })());
t('말이 하나뿐이면 언어 줄을 안 그린다', /langReady\(\)\.length > 1/.test(fn('openSettings')));

// ── 2. 알림 — 저장과 되읽기
t('알림 설정을 저장한다', /const NOTI_KEY = 'bt_noti'/.test(h) && /localStorage\.setItem\(NOTI_KEY/.test(fn('notiSet')));
t('처음에는 꺼져 있다', /on: false/.test(h));
t('없는 칸은 기본값으로 메운다', /\{ \.\.\.NOTI_DEF, \.\.\./.test(fn('notiGet')));
t('망가진 값이 들어와도 안 터진다', /catch\(_\)\{ return \{ \.\.\.NOTI_DEF \}; \}/.test(fn('notiGet')));
t('목록 칸이 배열이 아니면 배열로 고친다', /Array\.isArray\(out\[k\]\)/.test(fn('notiGet')));

// ── 3. ★ 밤 시간 — 자정을 넘는 구간(22:00~06:00)이 보통이다
t('밤 시간을 재는 문이 있다', !!fn('notiQuietNow'));
t('자정을 넘는 구간을 따로 본다', /f < tt \? \(m >= f && m < tt\) : \(m >= f \|\| m < tt\)/.test(fn('notiQuietNow')));
t('시작과 끝이 같으면 안 참는다', /if\(f === tt\) return false/.test(fn('notiQuietNow')));
t('밤에 안 울리기를 끄면 늘 보낸다', /if\(!d\.quiet\) return false/.test(fn('notiQuietNow')));

// ── 4. 허락은 켤 때만 청한다
t('허락을 청하는 문이 있다', !!fn('notiAsk'));
t('켤 때만 청한다', (()=>{ const f = fn('notiToggleAll');
  return /if\(d\.on\)\{ notiSet\(\{ on:false \}\); openNoti\(\); return; \}/.test(f) && /await notiAsk\(\)/.test(f); })());
t('폰이 막고 있으면 무엇을 눌러야 하는지 말해 준다', /denied/.test(fn('notiToggleAll')) && /폰 설정/.test(h));
t('앱을 켜자마자 청하지 않는다', !/\nnotiAsk\(\);/.test(h));

// ── 5. 2차 — 고르는 자리가 실제로 있다 (켤 데가 없으면 켜 놔도 아무 일이 안 난다)
t('구독한 연재 줄이 고르는 화면으로 간다', /openNotiSubs\(\)/.test(fn('openNoti')));
t('관심 분야 줄이 고르는 화면으로 간다', /openNotiCats\(\)/.test(fn('openNoti')));
t('몇 개 골랐는지 줄에 보인다', (()=>{ const f = fn('openNoti');
  return /d\.series\.length/.test(f) && /d\.krCats\.length \+ d\.wwCats\.length/.test(f); })());
t('구독·관심 고르는 화면이 있다', !!fn('openNotiSubs') && !!fn('openNotiCats'));
t('연재 목록 머리줄에 구독 단추가 붙는다', /\$\{notiSubBtn\(g\.name, 'news'\)\}/.test(h));
t('연재 글 안에도 같은 단추가 붙는다', /\$\{notiSubBar\(seriesName\(x\), 'series:' \+ x\.id\)\}/.test(h));
t('뉴스 화면에 관심 분야 고르는 단추가 있다', /openNotiCats\(\)/.test(fn('renderNews')));
t('구독 단추는 한 곳에서만 만든다', (()=>{
  // ★ 클래스 수를 세면 안 된다 — 같은 모양을 다른 단추가 써도 된다.
  //   「구독 / 구독 중」이라는 글자를 만드는 곳이 하나인가를 본다.
  const all = (h.match(/t\('구독 중'\)/g)||[]).length;
  return all === 1 && /t\('구독 중'\)/.test(fn('notiSubBtn')); })());
t('켜고 끄는 문이 하나다', !!fn('notiSubToggle') && !!fn('notiCatToggle')
  && (h.match(/notiSet\(\{ series: list \}\)/g)||[]).length === 1);
t('묻는 문도 하나다', !!fn('notiSubOn') && !!fn('notiCatOn'));
t('따옴표가 든 연재 이름도 안 깨진다', (()=>{ const f = fn('notiSubBtn');
  return /encodeURIComponent\(n\)/.test(f) && /decodeURIComponent/.test(fn('notiSubToggle')); })());
t('목록에서 누를 때 글이 안 열린다', /event\.stopPropagation\(\)/.test(fn('notiSubBtn')));
t('묶지 않은 옛 글에는 구독 단추를 안 그린다', /if\(!n\) return '';/.test(fn('notiSubBtn')));
t('전체가 꺼져 있으면 같이 켜 준다', !!fn('notiWakeAll')
  && /notiSubToggle[\s\S]{0,400}notiWakeAll\(\)/.test(h));
t('말없이 켜지 않는다', /tell\(t\('알림을 함께 켰습니다/.test(fn('notiWakeAll')));
t('폰이 막고 있으면 켜지 않는다', /denied/.test(fn('notiWakeAll')));
t('목록에 없는 분야는 안 보여 준다', /rows\.forEach/.test(fn('newsCats')));
t('골라 둔 분야는 오늘 목록에 없어도 남긴다',
  /notiGet\(\)\[notiCatKey\(kind\)\]\.forEach/.test(fn('newsCats')));
t('없어진 연재도 끌 수 있게 남긴다', /names\.indexOf\(n\) < 0\) names\.push\(n\)/.test(fn('openNotiSubs')));
// ★ 아직 보내는 장치가 없다. 켜 놓고 안 오면 고장으로 읽힌다 — 조용한 실패가 가장 나쁘다
t('아직 안 온다는 것을 말해 준다', !!fn('notiSoonHtml') && /만드는 중/.test(fn('notiSoonHtml')));
// ★ 정비는 이제 진짜 울린다. 셋을 한 말로 뭉뚱그리면 그 자체가 거짓말이 된다.
t('고르는 두 화면은 아직이라고 말한다',
  ['openNotiCats','openNotiSubs'].every(n=>/notiSoonHtml\(\)/.test(fn(n))));
t('알림 화면은 무엇이 되고 무엇이 안 되는지 갈라서 말한다', (()=>{
  // ★ 정비(폰이 스스로)와 나머지(서버가 보냄)는 되는 조건이 다르다.
  //   한 말로 뭉뚱그리면 그 자체가 거짓말이 된다.
  const f = fn('notiSoonHtml2');
  return /notiSoonHtml2\(\)/.test(fn('openNoti')) && /정비/.test(f) && /댓글/.test(f); })());
t('정비가 아직 안 된다고 말하지 않는다', !/notiSoonHtml\(\)/.test(fn('openNoti')));
t('전체를 끄면 아래가 흐려지고 안 눌린다', /\.notioff\{opacity:\.42;pointer-events:none\}/.test(h));
t('전체를 끄면 아래가 흐려지고 안 눌린다', /\.notioff\{opacity:\.42;pointer-events:none\}/.test(h));

// ── 5a. 말 — 앱 밖에서 통하는 말만 쓴다 (지어낸 말 금지)
//   2026-08-26, 사장님께 「갈래·새 편·따라보기」가 무슨 말인지 모르겠다고 크게 혼났다.
//   다른 앱들이 실제로 쓰는 말은 「구독」과 「관심」뿐이다.
const NOTI_BANNED = ['갈래','새 편','따라보는','챙겨보는','따라보기','챙겨보기'];
NOTI_BANNED.forEach(w=>{
  t('지어낸 말을 안 쓴다 — ' + w, !new RegExp("t\\('[^']*" + w + "[^']*'\\)").test(fn('openNoti')));
});
t('2차 줄은 구독·관심이라고 부른다', (()=>{ const f = fn('openNoti');
  return /t\('구독한 연재'\)/.test(f) && /t\('관심 분야 소식'\)/.test(f); })());
t('어디를 눌러야 켜지는지 설명에 적혀 있다', (()=>{ const f = fn('openNoti');
  // 5.0 에서 「고르기」 → 「선택」 으로 말을 통일했다
  return /\[구독\]/.test(f) && /\[관심 분야 선택\]/.test(f); })());
// ★ 설명에 적힌 단추 이름이 실제 단추 이름과 달라지면 사람이 못 찾는다
t('설명에 적힌 이름이 진짜 단추 이름과 같다',
  /t\('구독'\)/.test(fn('notiSubBtn')) && /t\('관심 분야 선택'\)/.test(fn('renderNews')));

// ── 5b. 정비 알람 — 폰이 스스로 건다 (서버 없음)
t('알람을 거는 문이 하나다', !!fn('maintAlarmSync') && !!fn('maintAlarmPlan'));
t('무엇을 언제 울릴지는 따로 떼어 두었다 (폰 없이 검사되게)',
  /function maintAlarmPlan\(now, list\)/.test(h));
t('안드로이드 채널을 먼저 만든다', !!fn('maintChannel') && /createChannel/.test(fn('maintChannel'))
  && /maintChannel\(\)/.test(fn('maintAlarmSync')));
t('걸기 전에 옛것을 지운다', /maintAlarmClear\(\)/.test(fn('maintAlarmSync')));
t('우리가 건 것만 지운다', /extra && n\.extra\.bt === 'maint'/.test(fn('maintAlarmClear')));
t('알림 번호가 늘 같다', /h \* 31 \+ v\.charCodeAt/.test(fn('maintAlarmId')));
t('번호가 안드로이드가 받는 크기 안이다', /% 200000/.test(fn('maintAlarmId')));
t('한 번에 너무 많이 걸지 않는다', /MAINT_ALARM_MAX/.test(fn('maintAlarmPlan')) && /const MAINT_ALARM_MAX = 60/.test(h));
t('전체가 꺼져 있으면 안 건다', /if\(!d\.on \|\| !d\.maint\) return out;/.test(fn('maintAlarmPlan')));
t('끈 항목·미룬 항목은 안 건다', (()=>{ const f = fn('maintAlarmPlan');
  return /!maintNotiOn\(it\)/.test(f) && /maintSnoozed\(it, base\)/.test(f); })());
t('한 번도 안 한 항목은 기한이 없으니 안 건다', /if\(!st \|\| !st\.next\) return;/.test(fn('maintAlarmPlan')));
t('지난 시각에는 안 건다', /if\(at <= base\) return;/.test(fn('maintAlarmPlan')));
t('밤 시간에 걸리면 아침으로 민다', /notiQuietNow\(x\)/.test(fn('maintAlarmAt')));
t('밀린 시각이 어제로 가지 않는다', /if\(y <= x\) y\.setDate\(y\.getDate\(\) \+ 1\);/.test(fn('maintAlarmAt')));
// ★ 언제 울릴지를 내가 정하지 않는다 (사장님이 정하신 것)
t('며칠 전에 알릴지 사람이 고른다', /maintBefore/.test(fn('maintWhenRows')) && /BEFORE_OPT/.test(h));
t('지나면 며칠마다 다시 부를지 사람이 고른다', /maintAgain/.test(fn('maintWhenRows')) && /AGAIN_OPT/.test(h));
t('울리는 시각도 사람이 고른다', /maintAt/.test(fn('maintWhenRows')));
t('숫자를 손으로 찍게 하지 않는다', !/prompt\(/.test(fn('maintWhenRows')) && !/prompt\(/.test(fn('notiPick')));
t('고른 것이 정비 줄에 요약돼 보인다', /maintWhenText\(d\)/.test(fn('openNoti')));
t('고르는 줄은 정비를 켰을 때만 보인다', /d\.maint \? maintWhenRows\(d\)/.test(fn('openNoti')));
t('기본값이 저장 구조에 있다', (()=>{
  const m = h.match(/const NOTI_DEF = \{[\s\S]*?\n\};/);
  return m && /maintBefore:/.test(m[0]) && /maintAgain:/.test(m[0]) && /maintAt:/.test(m[0]); })());
// ★ 못 걸었으면 왜 못 걸었는지 말한다 — 조용한 실패가 가장 나쁘다
t('몇 개 걸어 뒀는지 보여 준다', /걸어 둔 알람 \{n\}개/.test(fn('maintAlarmHtml')));
t('못 걸었으면 까닭을 보여 준다', /알람을 걸지 못했습니다/.test(fn('maintAlarmHtml'))
  && /maintAlarmLast\.why/.test(fn('maintAlarmHtml')));
t('웹에서는 웹이라 안 된다고 말한다', /웹에서는 알람을 걸 수 없습니다/.test(fn('maintAlarmHtml')));
t('걸 기한이 없으면 그렇다고 말한다', /걸어 둘 기한이 없습니다/.test(fn('maintAlarmHtml')));
t('손으로 다시 걸 수 있다', !!fn('maintAlarmNow') && /maintAlarmNow\(\)/.test(fn('maintAlarmHtml')));
t('실패한 까닭을 들고 있는다', /let maintAlarmLast = \{ n: 0, why: '', at: '' \};/.test(h));
// ★ 기한이 바뀌면 알람도 따라와야 한다
t('저장할 때 다시 건다', /maintAlarmSoon\(\)/.test(fn('saveLocal')));
t('배를 바꾸면 다시 건다', /maintAlarmSoon\(\)/.test(fn('loadBoatData')));
t('설정을 만지면 다시 건다', /maintAlarmSoon\(\)/.test(fn('notiSet')));
t('한 번에 몰아서 건다', !!fn('maintAlarmSoon') && /clearTimeout\(maintAlarmTimer\)/.test(fn('maintAlarmSoon')));

// ── 5c. 서버에서 오는 알림 (댓글 · 구독한 연재 · 관심 분야)
t('이 폰 주소를 서버에 적는 문이 있다', /window\.__fcm = \{/.test(h) && !!fn('fcmRegister'));
t('토큰은 나중에 날아오므로 귀를 먼저 연다',
  /addListener\('registration'/.test(fn('fcmRegister')) && !!fn('fcmGot'));
t('등록 실패도 잡아 둔다', /registrationError/.test(fn('fcmRegister')));
t('기기가 여럿이어도 서로 안 지운다', /arrayUnion/.test(h) && /b\.tokens = arrayUnion/.test(h));
t('그만 받을 때 남의 기기는 안 건드린다', /arrayRemove/.test(h));
t('서버로 가는 것이 무엇인지 한 곳에 적혀 있다', (()=>{ const f = fn('fcmBody');
  // ★ 글 내용·배·위치가 새어 나가면 안 된다. 보내는 칸을 여기 한 곳에 못 박는다.
  // ★ boatPlan 은 「받을까 말까」 스위치다. 배 정보가 아니다.
  //   배 이름·배 번호·좌표가 들어가면 안 된다 — 그것만 막는다.
  return /on:/.test(f) && /myComment:/.test(f) && /series:/.test(f)
      && /krCats:/.test(f) && /wwCats:/.test(f) && /tz:/.test(f)
      && /boatPlan:/.test(f)
      && !/body/.test(f) && !/boatId|boatName|curBoat|\bb\.name/.test(f)
      && !/lat/.test(f); })());
t('시간대를 같이 보낸다 (서버는 UTC 라 밤을 못 안다)', /resolvedOptions\(\)\.timeZone/.test(fn('fcmBody')));
t('설정이 바뀌면 서버 것도 바꾼다', /fcmSoon\(\)/.test(fn('notiSet')));
t('로그인하면 이 폰을 등록한다', /if\(u\) fcmSoon\(\)/.test(h));
t('알림을 끄면 서버에도 껐다고 알린다', /save\(\{ on:false \}\)/.test(fn('fcmSync')));
t('한 번에 몰아서 올린다', !!fn('fcmSoon') && /clearTimeout\(fcmTimer\)/.test(fn('fcmSoon')));
// ★ 왜 안 되는지 다섯 가지를 갈라서 말한다 — 「안 오는데요」로는 아무도 못 고친다
t('막힌 까닭을 갈라서 잡는다', (()=>{ const f = fn('fcmWhyNow');
  return /'web'/.test(f) && /'noplug'/.test(f) && /'login'/.test(f) && /'off'/.test(f); })());
t('까닭을 사람 말로 바꾼다', (()=>{ const f = fn('fcmWhyText');
  return /web/.test(f) && /noplug/.test(f) && /login/.test(f) && /off/.test(f)
      && /denied/.test(f) && /notoken/.test(f) && /save:/.test(f) && /reg:/.test(f); })());
t('알림 화면에 이 폰 상태가 나온다', /fcmLineHtml\(\)/.test(fn('openNoti')));
t('손으로 다시 등록할 수 있다', !!fn('fcmNow') && /fcmNow\(\)/.test(fn('fcmLineHtml')));
t('토큰이 늦게 와도 화면이 따라 그려진다', /fcmRepaint\(\)/.test(fn('fcmGot')));
// ★ 이름 겹침 — 클라우드 올리기(pushNow·pushTimer)를 죽이면 안 된다
t('클라우드 올리기를 안 덮어썼다',
  (h.match(/function pushNow\(/g)||[]).length === 1 && (h.match(/let pushTimer/g)||[]).length === 0);
t('서버가 쓰는 채널 이름과 앱이 만드는 이름이 같다',
  /const NEWS_CH  = 'baetnil-news'/.test(h) && /createChannel\(\{ id: NEWS_CH/.test(h));
t('앱을 켜 둔 채로 와도 보인다', /pushNotificationReceived/.test(fn('fcmRegister')));
// ★ 있을 수 없는 스위치를 두지 않는다 — 연재에는 댓글 자리가 아예 없다
t('없는 기능의 스위치를 두지 않는다', !/seriesComment/.test(h));
// 5.0 에서 「글판」 → 「게시판」 으로 바꿨다
t('댓글이 붙는 곳만 적는다', /t\('게시판 · 정박지'\)/.test(fn('openNoti')) && !/게시판 · 장터 · 정박지/.test(h));

// ── 6. 정비 — 항목마다 끄고 미룬다
t('항목마다 알림을 끌 수 있다', !!fn('maintNotiToggle') && /it\.noti = !maintNotiOn\(it\)/.test(fn('maintNotiToggle')));
t('안 꺼 둔 항목은 기본이 켜짐', /return !\(it && it\.noti === false\)/.test(fn('maintNotiOn')));
t('미루기가 있다', !!fn('maintSnooze') && /SNOOZE/.test(h));
t('미룬 날짜가 지났는지 본다', /\(now \|\| new Date\(\)\) <= d/.test(fn('maintSnoozed')));
t('미룬 날짜가 망가져 있어도 안 터진다', /isNaN\(d\)\) return false/.test(fn('maintSnoozed')));
t('다시 켜면 미뤄 둔 것도 푼다', /if\(it\.noti\) it\.snooze = ''/.test(fn('maintNotiToggle')));
t('미루면 받겠다는 뜻이 된다', /it\.noti = true;/.test(fn('maintSnooze')));
t('상세 화면에 그 줄이 붙는다', /\$\{maintNotiRow\(it\)\}/.test(h));
t('목록에서도 끈 것·미룬 것이 보인다', /chip mute/.test(h) && /nOff\?/.test(h));
t('보기 전용일 때는 미루기 단추를 안 그린다', /if\(!unlocked \|\| !on\) return head/.test(fn('maintNotiRow')));

// ── 7. 배 위에서 누를 크기 (38×34 아래로 안 내려간다)
t('스위치가 52×31', /\.notisw\{width:52px;height:31px/.test(h));
t('알림 줄이 56px 이상', /\.notirow\{min-height:56px\}/.test(h));
t('구독 단추가 38px 이상', /\.subbtn\{min-height:38px/.test(h));
t('분야 단추가 38px 이상', /\.catbtn\{min-height:38px/.test(h));
t('고르는 단추가 38px 이상', /\.optb\{min-height:38px/.test(h));

// ── 8. 말 — 세 나라 말 다
['설정','알림 받기','이 항목 알림','미루기','준비 중','밤에는 안 울리기','알림 꺼짐','미룸','구독 · 관심','구독한 연재','관심 분야 소식','구독','구독 중','관심 분야','관심 분야 선택','정비 · 점검','며칠 전에','지나면 다시','울리는 시각','당일에만',// 5.0 — 「다시 걸기」 는 「다시 등록」 으로 합쳐졌고, 「글판」 은 「게시판」 이 되었다
 '안 함','다시 등록','소식','게시판 · 정박지'].forEach(k=>{
  const re = new RegExp("'" + k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + "':'[^']+'", 'g');
  t('세 나라 말 — ' + k, (h.match(re)||[]).length >= 2);
});
t('LANG_TOTAL 이 2073 이상', (()=>{const m=h.match(/LANG_TOTAL = (\d+)/); return m && +m[1] >= 2073;})());

// ── 9. 이름 겹침
['openSettings','openNoti','notiGet','notiSet','notiQuietNow','notiAsk','notiToggleAll',
 'notiToggle','notiTime','maintNotiOn','maintSnoozed','maintNotiToggle','maintSnooze','maintNotiRow',
 'notiCatKey','notiSubOn','notiCatOn','notiWakeAll','notiSubToggle','notiCatToggle','notiBack',
 'notiSubBtn','notiSubBar','newsCats','newsLoadIf','openNotiCats','openNotiSubs','notiSoonHtml',
 'notiSoonHtml2','notiPick','notiLocal','maintChannel','maintAlarmId','maintAlarmAt','maintAlarmPlan',
 'maintAlarmClear','maintAlarmSync','maintAlarmSoon','maintAlarmHtml','maintAlarmNow',
 'maintBeforeName','maintAgainName','maintWhenText','maintWhenRows',
 'fcmPlugin','fcmTokLocal','fcmTokKeep','fcmBody','fcmWhyNow','fcmRegister','fcmGot',
 'fcmSync','fcmSoon','fcmRepaint','fcmWhyText','fcmLineHtml','fcmNow'].forEach(n=>{
  const c = (h.match(new RegExp('function ' + n + '\\(', 'g'))||[]).length;
  t('이름이 하나뿐 — ' + n, c === 1);
});

t('APP_VER 와 CACHE 가 같다',
  h.match(/APP_VER *= *'([^']*)'/)[1] === sw.match(/CACHE *= *'baetnil-([^']*)'/)[1]);

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail ? 1 : 0);
