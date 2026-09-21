// 애플 심사규정 1.2 — 커뮤니티가 있는 앱이 갖춰야 하는 네 가지
//
// ★ 왜 검사로 못 박나
//   이 넷은 「있다가 없어져도 앱이 안 터진다」. 그래서 조용히 사라진다.
//   사라진 채로 심사에 넣으면 반려된다. 여기서 지킨다.
//     ① 올라오기 전에 거르는 방법   ② 신고 창구
//     ③ 못된 이용자를 막는 기능     ④ 공개된 연락처
const fs = require('fs'), cp = require('child_process');
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
const q = src.indexOf('!function(t,e){"object"==typeof exports');
const app = q > 0 ? src.slice(0, q) : src;
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?pass++:(fail++,console.log('★ 실패:',n, x===undefined?'':JSON.stringify(x).slice(0,160))); };

// ── ① 올리기 전에 거른다
T('거르는 문이 있다', /function badWord\(/.test(app) && /function badOk\(/.test(app));
T('막을 낱말 목록이 있다', /const BAD_WORDS = \[/.test(app));
// ★ 밖으로 나가는 글은 전부 이 문을 지나야 한다 — 여덟 자리
{
  // ★ 장터와 정박지는 openForm 을 안 쓴다 — 제 화면을 직접 그리고 itemSave/spotSave 로 저장한다.
  //   그래서 formOk 의 거르기가 안 지난다. 그 둘은 badOk 를 직접 부르는지 본다.
  //   함수 이름만 훑고 넘어갔다가 장터·정박지가 통째로 안 걸러질 뻔했다.
  // ★★ 4.106 — 여기가 여섯 자리뿐이었다. 실제로 밖으로 나가는 글은 더 있었다:
  //     배 소개글(editIntro·addIntro) 은 「배 둘러보기」 에 그대로 실리고,
  //     같이 탈 사람 구하기(rideEdit) 는 글판에 올라간다. 셋 다 안 걸러지고 있었다.
  const 자리 = ['writeTalk','writeTalkComment','writeSpotComment',
                'writeSeries','writePost','writeComment',
                'editIntro','addIntro','rideEdit'];
  const 빠진 = 자리.filter(f => !/filter:\s*true/.test(grab(src, f) || ''));
  for(const f of ['itemSave','spotSave'])
    if(!/badOk\(/.test(grab(src, f) || '')) 빠진.push(f);
  T('★ 글을 올리는 열한 자리가 모두 거르기를 지난다 — ' + (빠진.join(', ') || '없음'),
    빠진.length === 0, 빠진);
  // ★★ 항해일지·정비수첩·리뷰는 기록 창의 칸에 직접 쓴다 — openForm 을 안 지난다.
  //   「공개로 돌리는 그 순간」 이 거를 수 있는 마지막 자리다.
  {
    const g = grab(src, 'pubLvSet') || '';
    T('★ 공개로 돌릴 때 그 기록의 글을 거른다', /badOk\.apply\(null, pubTexts\(/.test(g), g.slice(0, 200));
    T('★ 비공개로 되돌리는 것은 안 막는다', /k !== 'none' &&/.test(g), g.slice(0, 200));
    T('기록에서 사람이 읽는 글만 모으는 자리가 있다', !!grab(src, 'pubTexts'));
  }
  T('★ 거르기가 입력창 한 곳에서 일어난다 (문 하나)',
    /o\.filter && !badOk\.apply/.test(grab(src, 'formOk') || ''));
}
// ★ 사진과 주소는 안 본다 — base64 안에 우연히 욕이 들어 있었다 (실제로 있었다)
T('★ 사진·주소는 거르기에서 뺀다', /function badReadable\(/.test(app)
  && /data:\|https\?:\|blob:/.test(app.replace(/\\/g,'')));

// ── ★ 진짜로 돌려 본다. 글자 모양만 보면 「목록은 있는데 안 걸리는」 상태를 못 잡는다.
{
  const 몸 = [ /const BAD_OK = \[[\s\S]*?\];/, /const BAD_WORDS = \[[\s\S]*?\];/ ]
      .map(re => (app.match(re) || [''])[0]).join('\n')
    + '\n' + (grab(app, 'badReadable') || '') + '\n' + (grab(app, 'badWord') || '')
    + '\nreturn badWord;';
  let f = null;
  try{ f = new Function(몸)(); }catch(e){ console.log('★ 실패: 거르기를 돌려볼 수 없다 —', e.message); fail++; }
  if(f){
    const 걸려야 = ['씨발 뭐야', 'this is fucking bad', 'ты сука', '개새끼야', '병 신'.replace(' ','')];
    const 걸리면안됨 = [
      '시발점에서 출발합니다', '조타실(cockpit) 점검', 'sextant 육분의 확인',
      '가시 발판 교체', '엔진오일 교체', '여수 원형마리나', '방현재 4개',
      'https://baetnil.com/photo.jpg',
      'data:image/jpeg;base64,' + 'fuck'.repeat(3) + 'AAAA'.repeat(80)
    ];
    const 못잡음 = 걸려야.filter(x => !f(x));
    const 헛잡음 = 걸리면안됨.filter(x => f(x));
    T('★ 심한 말을 잡는다 — 못 잡은 것: ' + (못잡음.join(' / ') || '없음'), 못잡음.length === 0);
    T('★ 멀쩡한 말을 안 잡는다 — 헛잡은 것: ' + (헛잡음.map(x=>x.slice(0,24)).join(' / ') || '없음'),
      헛잡음.length === 0);
  }
}
// 이 앱의 사전 전체가 거르기에 안 걸려야 한다 (걸리면 앱이 제 말을 못 쓴다)
{
  const 몸 = [ /const BAD_OK = \[[\s\S]*?\];/, /const BAD_WORDS = \[[\s\S]*?\];/ ]
      .map(re => (app.match(re) || [''])[0]).join('\n')
    + '\n' + (grab(app, 'badReadable') || '') + '\n' + (grab(app, 'badWord') || '')
    + '\nreturn badWord;';
  let f = null; try{ f = new Function(몸)(); }catch(e){}
  if(f){
    const 말 = [...app.matchAll(/^\s+'((?:[^'\\]|\\.)+)':'((?:[^'\\]|\\.)*)',?$/gm)];
    const 걸린 = [];
    for(const m of 말) for(const x of [m[1], m[2]]) if(f(x)) 걸린.push(x.slice(0, 40));
    T('★ 앱이 제 말을 스스로 막지 않는다 (사전 ' + 말.length + '개) — ' +
      (걸린.slice(0,3).join(' / ') || '없음'), 걸린.length === 0);
  }
}

// ── ② 신고 창구
T('신고 사유가 갖춰져 있다', /const REPORT_REASONS = \[/.test(app));
T('신고가 쌓이면 저절로 내려간다',
  /const MARKET_HIDE_AT = \d/.test(app) && /const SPOT_HIDE_AT = \d/.test(app));

// ── ③ 못된 이용자를 막는다
T('사람 단위로 차단하는 문이 있다',
  /function mutePerson\(/.test(app) && /function isMuted\(/.test(app) && /function filterMuted\(/.test(app));
T('★ 글 목록에서 걸러 낸다', /filterMuted\(talkList\)/.test(app));
T('★ 댓글에서도 걸러 낸다', /filterMuted\(talkCmts\[/.test(app));
// ★★ 4.106 — 차단이 글판에만 걸려 있었다. 차단해 놓아도 그 사람이 장터에 올린 물건,
//   남의 배에 올린 항해일지·정비수첩·리뷰, 정박지에 남긴 다녀온 이야기는 그대로 보였다.
//   「그 사람을 막는다」 는 한 화면만 막는 것이 아니다.
{
  T('걸러야 할 목록을 한 곳에서 정한다', /const MUTE_LISTS = \[/.test(app) && !!grab(src, 'listRowsSeen'));
  const 목록 = (app.match(/const MUTE_LISTS = \[[^\]]*\]/) || [''])[0];
  ['talk', 'market', 'explore'].forEach(k =>
    T('  · ' + k + ' 이 걸러진다', 목록.indexOf("'" + k + "'") >= 0, 목록));
  T('★ 장터 목록이 거르는 문을 지난다',   /marketList = listRowsSeen\('market'\)/.test(app));
  T('★ 남의 배 목록이 거르는 문을 지난다', /exploreAll = listRowsSeen\(ck\)/.test(app));
  T('★ 글판 목록도 같은 문을 지난다',     /talkList = listRowsSeen\('talk'\)/.test(app));
  T('★ 정박지 다녀온 이야기에서도 걸러 낸다', /filterMuted\(spotCmts\[/.test(app));
  T('★ 남의 배 글의 댓글에서도 걸러 낸다',   /filterMuted\(bpCmts\[/.test(app));
  // ★ 정박지 자리 자체는 안 뺀다 — 여럿이 함께 채우는 자리라 한 사람 때문에 지우면
  //   남들이 쓸 수심·요금·연락처가 통째로 사라진다.
  T('★ 정박지 자리 자체는 안 뺀다 (여럿이 함께 채우는 자리다)',
    목록.indexOf("'spots'") < 0, 목록);
  // ★ listRows 자체를 걸러 놓으면 그 값이 다시 저장되는 자리가 있어,
  //   차단을 풀어도 되살아나지 않는다. 읽는 자리에서만 거른다.
  T('★ 저장하는 자리에서는 안 거른다 (차단을 풀면 되살아나야 한다)',
    /listSet\(k, listRows\(k\)\.concat/.test(app));
}
T('글 화면에 「이 사람 차단」 단추가 있다', /mutePersonUI\(/.test(app) && /이 사람 차단/.test(app));
T('★ 되돌릴 길이 있다 (차단한 사람 목록)',
  /function openMuted\(/.test(app) && /openMuted\(\)/.test(grab(src, 'openSettings') || ''));
T('내 글은 못 숨긴다', /내 글은 숨길 수 없습니다/.test(grab(src, 'mutePersonUI') || ''));
// ★ 5.0 — 이 기기에 담되 **계정마다** 따로 담는다 (pGet/pSet).
//   남에게 강요하지 않는 것은 그대로고, 앞사람이 숨긴 사람이 내게 숨겨지지도 않는다.
T('이 기기에만 저장한다 (계정마다 · 남에게 강요하지 않는다)',
  /pGet\('bt_hideby'\)/.test(app) && /pSet\('bt_hideby'/.test(app));

// ── ④ 공개된 연락처
T('앱 안에 고객센터가 있다', /function openSupport\(/.test(app));
T('메일 주소가 앱에 있다', /help@baetnil\.com|jaha814@gmail\.com/.test(app));

// ── 낱말은 세 나라 말로 다 있어야 한다
// ★ 「안 보는 사람」·「안 보기」 는 내가 지어낸 말이었다. 다른 앱이 실제로 쓰는 말은 「차단」 이다
//   (당근·네이버 카페·인스타그램). 사장님이 「안 보는 사람은 도대체 뭐냐」 하셨다.
for(const k of ['이 사람 차단','차단한 사람','그 부분을 고쳐 주세요.'])
  T("'" + k + "' 이 영어·러시아어에 다 있다", (src.split("'" + k + "':").length - 1) >= 2);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
