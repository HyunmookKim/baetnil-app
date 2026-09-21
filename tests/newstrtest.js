// 뉴스 옮기기 — 어떤 글자를 보여 주고, 무엇을 서버로 보내는가.
//
// ★ 왜 이 검사가 있나
//   해외 소식은 모아 올 때 한국어 제목(t_ko)이 함께 붙는다. 한국어로 볼 때 그것을 쓰는 것은
//   맞지만, 영어로 볼 때까지 한국어 제목을 보여 주면 원문이 영어인데도 못 읽게 된다.
//   실제로 그렇게 돼 있었다. 그리고 옮길 것이 없는데 서버를 부르면 값만 든다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}

let LANG = 'ko';
globalThis.langNow = () => LANG;
globalThis.esc = x => String(x == null ? '' : x);
globalThis.t = x => x;
globalThis.meUid = () => 'u1';
// ★ Node 22 에는 navigator 가 이미 있고 고쳐 쓸 수 없다. 자리를 새로 만들어 준다.
const setOnline = v => Object.defineProperty(globalThis, 'navigator',
  { value: { onLine: v }, configurable: true, writable: true });
setOnline(true);
globalThis.TR_BUSY = {};
globalThis.newsSub = 'ww';
globalThis.krCache = null;
globalThis.newsCache = null;
globalThis.renderNews = () => {};
globalThis.newsIsNew = () => false;
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);

// ★ 4.81 — 「번역해서 보기」 단추를 없앴다. 그리면 알아서 옮긴다(newsTrAuto).
const need = ['trSameLang','newsTitle','newsSum','newsShow','newsNeedTr','newsTrBar','newsTrAuto','newsTrOff'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
// 상태 그릇을 먼저 만든다 (원본은 const 라 떼어 오면 두 번 선언된다)
globalThis.TR_NEWS = {};
globalThis.trNewsOn = false;
// ★ 본체에서 값을 그대로 가져온다. 여기서 손으로 적으면 본체를 망가뜨려도 안 잡힌다.
[['NEWS_TR_MAX', 40], ['TR_SEND_N', 60], ['TR_SEND_CHARS', 6000]].forEach(([k, d])=>{
  const m = src.match(new RegExp('const ' + k + '\\s*=\\s*(\\d+)'));
  globalThis[k] = m ? Number(m[1]) : d;
});
globalThis.trChunks = eval('(' + grab(src, 'trChunks') + ')');
globalThis.trSend   = eval('(' + grab(src, 'trSend') + ')');
for(const f of need){ eval(grab(src, f)); globalThis[f] = eval(f); }

let pass = 0, fail = 0;
const T = (n, c, extra) => {
  if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (extra !== undefined ? ' — ' + JSON.stringify(extra) : '')); }
};

const WW = { title: 'Storm warning issued for the Yellow Sea',
             t_ko: '서해 폭풍 특보 발효',
             summary: 'Gale force winds expected from Friday.',
             s_ko: '금요일부터 강풍이 예상된다.' };
const KR = { title: '어선 안전조업 규정 개정 안내', source: '해양수산부' };

// ── 1. 고른 말에 맞는 원문을 고른다
LANG = 'ko';
T('한국어로 보면 해외 소식은 붙어 온 한국어 제목을 쓴다', newsTitle(WW) === WW.t_ko, newsTitle(WW));
T('한국어로 보면 요약도 한국어를 쓴다', newsSum(WW) === WW.s_ko, newsSum(WW));
LANG = 'en';
T('영어로 보면 해외 소식은 원문 제목을 쓴다 (한국어 제목이 아니다)',
  newsTitle(WW) === WW.title, newsTitle(WW));
T('영어로 보면 요약도 원문을 쓴다', newsSum(WW) === WW.summary, newsSum(WW));
LANG = 'ru';
T('러시아어로 보면 원문을 쓴다 (옮길 거리를 원문에서 잡는다)',
  newsTitle(WW) === WW.title, newsTitle(WW));

// ── 2. 옮길 것이 있나 없나
LANG = 'en';
T('영어로 볼 때 영어 뉴스는 옮길 것이 없다', newsNeedTr([WW]) === false);
T('영어로 볼 때 한국어 뉴스는 옮길 것이 있다', newsNeedTr([KR]) === true);
LANG = 'ko';
T('한국어로 볼 때 한국어 제목이 붙은 해외 소식은 옮길 것이 없다', newsNeedTr([WW]) === false);
T('한국어로 볼 때 한국어 뉴스도 옮길 것이 없다', newsNeedTr([KR]) === false);
// ★ 한국어 제목이 안 붙어 온 해외 소식은 한국어로 보는 사람도 못 읽는다
const WW_RAW = { title: 'Coast guard rescues three near Ulleungdo' };
T('한국어로 볼 때 한국어 제목이 없는 해외 소식은 옮길 것이 있다', newsNeedTr([WW_RAW]) === true);

// ── 3. 한 줄 안내를 언제 내나
//    ★★★ 4.81 — 「번역해서 보기」 단추를 없앴다 (사장님이 정하신 것).
//      누르지 않아도 옮겨진다. 남는 것은 「원어로 보기」 하나뿐이다 —
//      원문이 보고 싶은 사람은 있어도, 남의 말로 보고 싶은 사람은 없다.
LANG = 'en';
globalThis.trNewsOn = false; globalThis.TR_BUSY = {};
T('★★★ 「번역해서 보기」 단추를 안 낸다 (알아서 옮긴다)',
  !/번역해서 보기/.test(newsTrBar([KR])), newsTrBar([KR]));
T('목록이 비면 아무것도 안 낸다', newsTrBar([]) === '');
globalThis.TR_BUSY = { news: true };
T('부르는 중에는 번역 중이라고만 한다', /번역하는 중/.test(newsTrBar([KR])));
globalThis.TR_BUSY = {};
globalThis.trNewsOn = true;
// ★★★ 2026-08-31 — 「켜졌다」 만으로는 안 된다. **실제로 바뀐 글자가 있어야** 낸다.
//   서버가 거절했는데도 「자동 번역된 글입니다」 를 띄우고 있었다. 화면이 거짓말을 했다.
globalThis.TR_NEWS = { en: {} };
T('★★★ 켜졌어도 바뀐 글자가 없으면 아무 말도 안 낸다 (거짓말 금지)',
  newsTrBar([KR]) === '', newsTrBar([KR]));
globalThis.TR_NEWS = { en: { [KR.title]: 'EN:' + KR.title } };
T('★★ 실제로 옮겼으면 원어로 보기를 낸다', /원어로 보기/.test(newsTrBar([KR])));
T('★★ 원래 내 말인 것에는 아무 말도 안 낸다 (고장으로 보인다)', newsTrBar([WW]) === '');
globalThis.trNewsOn = false; globalThis.TR_NEWS = {};

// ── 4. 서버로 무엇을 보내나
LANG = 'en';
globalThis.newsSub = 'kr';
globalThis.newsTrSkip = false;
globalThis.renderNews = () => {};
let sent = null;
globalThis.window = { __tr: { text: async (texts) => { sent = texts; return { out: texts.map(x => 'EN:' + x) }; } } };
const ROWS = [KR, { title: '어선 안전조업 규정 개정 안내' }, WW];   // 첫째와 둘째가 같은 글
(async () => {
  globalThis.TR_NEWS = {}; globalThis.trNewsOn = false;
  await newsTrAuto(ROWS);
  T('같은 글자는 한 번만 보낸다', sent && sent.length === 1, sent);
  T('이미 영어인 것은 안 보낸다', sent && sent.indexOf(WW.title) < 0, sent);
  T('옮긴 것을 담아 둔다', !!(TR_NEWS.en && TR_NEWS.en[KR.title]), TR_NEWS.en);
  T('★★★ 사람이 누르지 않아도 켜진다', globalThis.trNewsOn === true);
  T('켠 뒤에는 옮긴 글자를 보여 준다', newsShow(KR.title) === 'EN:' + KR.title, newsShow(KR.title));
  T('끄면 원어로 돌아간다',
    (globalThis.trNewsOn = false, newsShow(KR.title) === KR.title));

  // 두 번째 부를 때는 서버를 안 부른다 (담아 둔 것을 쓴다)
  sent = null;
  await newsTrAuto(ROWS);
  T('★★★ 한 번 옮긴 말은 서버를 다시 안 부른다 (돈이 샌다)', sent === null);

  // ★★★ 「원어로 보기」 를 누른 사람에게는 다시 안 옮긴다
  sent = null;
  globalThis.newsTrSkip = true;
  globalThis.TR_NEWS = {};
  await newsTrAuto(ROWS);
  T('★★★ 「원어로 보기」 를 누른 사람에게는 다시 안 옮긴다', sent === null);
  globalThis.newsTrSkip = false;

  // 옮길 것이 하나도 없으면 서버를 안 부른다
  LANG = 'ru';
  sent = null;
  globalThis.TR_NEWS = {}; globalThis.trNewsOn = false;
  await newsTrAuto([{ title: '2026-08-16' }]);   // 숫자뿐 — 옮길 것이 없다
  T('옮길 거리가 없으면 서버를 안 부른다 (값이 안 든다)', sent === null);

  // 로그인 전·인터넷 없을 때는 안 부른다
  LANG = 'en';
  globalThis.TR_NEWS = {}; globalThis.trNewsOn = false;
  sent = null; globalThis.meUid = () => '';
  await newsTrAuto(ROWS);
  T('로그인 전에는 안 부른다 (함수가 안 받는다)', sent === null);
  globalThis.meUid = () => 'u1';
  sent = null; setOnline(false);
  await newsTrAuto(ROWS);
  T('인터넷이 없으면 안 부른다', sent === null);
  setOnline(true);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})();
