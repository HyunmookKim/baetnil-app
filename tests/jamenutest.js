// 일본어 화면이 「일본 사람이 쓰는 말」 인가 (4.110)
//
// ★ 왜 이 검사가 있나
//   작은삼촌(일본 사는 분)이 사장님께 이렇게 적어 보내셨다.
//     「일본어 번역이 많이 이상해 ㅋㅋㅋ 대대적으로 손봐야할듯」
//     「메뉴부터 바꿔야할듯」
//     「예들들면 출항으로 번역되면 될걸 문장이 어색해」
//   열어 보니 세 갈래였다.
//     ① 사전에 **한국어가 그대로 값으로 들어 있는** 자리 (이용약관·개인정보처리방침…)
//     ② 사전에는 있는데 **화면이 사전을 안 거치는** 자리
//        — 정비 화면의 계통 이름표가 「엔진·전기·선체·수중·안전장비」 한글 그대로였다.
//          일본 사람이 정비 탭을 열면 제일 먼저 보이는 줄이 거기다.
//     ③ **일본에 없는 말을 지어낸** 자리 — 「7물」 을 「7番潮」 로 옮겨 놓았다.
//        일본은 大潮·中潮·小潮·長潮·若潮 다섯 가지뿐이다. 낚시하는 사람이 제일 먼저 보는 자리다.
//
// ★ 그리고 하나 더 — 사람 빠짐 단추가 어디서든 122 로 걸고 있었다.
//   일본에서 122 는 아무 데도 안 닿는다. 바다의 사건·사고는 118 이다.
//   한국도 122 는 2016년에 119 로 합쳐졌다. 목숨이 걸린 자리라 같이 고쳤다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 220) : '')); } };

// ── 사전을 진짜로 읽어 온다
function dict(lang){
  const i = src.indexOf('const I18N = {');
  let d = 0, j = src.indexOf('{', i), k;
  for(k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0){ k++; break; } }
  }
  const g = {};
  (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g);
  return g.I18N[lang];
}
const JA = dict('ja');
T('①-0 일본어 사전을 읽었다', JA && Object.keys(JA).length > 2000, JA ? Object.keys(JA).length : 0);

// ── ① 값이 한국어 그대로인 자리가 없어야 한다
{
  const KOR = /[가-힣]/;
  // ★ 앱 이름은 그대로 둔다 (「뱃일」 은 이름이지 낱말이 아니다).
  //   한국 법률 문서의 제목처럼 일부러 남긴 것이 있으면 여기 적고 왜인지 밝힌다.
  //   ★ 「뱃일」 은 앱 이름이라 글 안에 그대로 섞여 나온다 — 이름은 빼고 본다.
  const 남은것 = Object.keys(JA).filter(k => KOR.test(String(JA[k]).split('뱃일').join('')));
  T('①-1 ★★ 일본어 사전에 한국어가 그대로 남은 자리가 없다',
    남은것.length === 0, 남은것.slice(0, 8).map(k => k + '→' + JA[k]).join(' / '));
}

// ── ② 저장값(열쇠)을 화면에 낼 때 사전을 거치는가
T('②-1 ★ keyShow 라는 문 하나가 있다', /function keyShow\(/.test(src));
T('②-2 ★ 되돌리는 문(keyBack)도 있다', /function keyBack\(/.test(src));
T('②-3 ★★ 정기점검 묶음 이름표가 사전을 거친다 (한글 계통이 그대로 보이던 자리)',
  /<b>\$\{esc\(keyShow\(g\)\)\}<\/b>/.test(src),
  (src.match(/<span class="garr">[^\n]*/) || [''])[0]);
T('②-4 ★ 계통 칸을 고치면 다시 한국어 열쇠로 되돌린다 (묶음이 둘로 갈라지지 않게)',
  /function mrGrpSet\(/.test(src) && /onchange="mrGrpSet\(this\.value,'기타'\)"/.test(src));
T('②-5 ★ 수리 계통도 같은 문을 쓴다',
  /onchange="mrGrpSet\(this\.value,''\)"/.test(src));
T('②-6 ★ 엔진 가동 목적도 사전을 거친다',
  /esc\(keyShow\(it\.purpose\) \|\| '—'\)/.test(src) && /esc\(keyShow\(x\.o\.purpose\) \|\| t\('기타'\)\)/.test(src));
T('②-7 ★ 배 종류 고르는 칸도 사전을 거친다',
  /BOAT_TYPES\)\.map\(\(\[k,v\]\)=>`<option value="\$\{k\}">\$\{esc\(t\(v\)\)\}<\/option>`/.test(src));
T('②-8 ★ 지역 이름(전남·경북…)도 사전을 거친다',
  /return JP_PREF\[k\] \? t\(JP_PREF\[k\]\) : t\(k\);/.test(src));
// 계통 이름이 사전에 다 있어야 keyShow 가 뜻이 있다
{
  const 계통 = ['엔진','전기','선체·수중','리깅·세일','안전장비','어로장비','기타'];
  const 빠진 = 계통.filter(g => !JA[g]);
  T('②-9 ★ 계통 이름이 일본어 사전에 다 있다', 빠진.length === 0, 빠진.join(','));
}

// ── ③ 물때 — 일본에 없는 말을 지어내지 않는다
{
  const 값 = Object.keys(JA).filter(k => /番潮/.test(JA[k]));
  T('③-1 ★★ 「N番潮」 라는 지어낸 말이 없다', 값.length === 0,
    값.slice(0, 5).map(k => k + '→' + JA[k]).join(' / '));
}
T('③-2 ★ 일본식 潮名 표가 있다', /const TIDE_JP = \[/.test(src));
{
  const m = src.match(/const TIDE_JP = \[([\s\S]*?)\];/);
  const arr = m ? m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean) : [];
  T('③-3 열다섯 칸이다 (음력 15일 주기)', arr.length === 15, arr.length);
  // 朔(음력 1일)·望(음력 15·16일) 둘레가 大潮 여야 한다 — 물리하고 어긋나면 안 된다
  T('③-4 ★★ 음력 1·2·3 일이 大潮', arr[0]==='大潮' && arr[1]==='大潮' && arr[2]==='大潮', arr.slice(0,3).join(','));
  T('③-5 ★★ 음력 15·30 일(열다섯째 칸)이 大潮', arr[14] === '大潮', arr[14]);
  T('③-6 ★ 長潮 는 딱 하루, 若潮 도 딱 하루',
    arr.filter(x=>x==='長潮').length === 1 && arr.filter(x=>x==='若潮').length === 1, arr.join(','));
  T('③-7 ★ 長潮 다음 날이 若潮 다 (일본에서 정해진 차례)',
    arr[arr.indexOf('長潮') + 1] === '若潮', arr.join(','));
  T('③-8 ★ 다섯 가지 말만 쓴다',
    arr.every(x => ['大潮','中潮','小潮','長潮','若潮'].indexOf(x) >= 0), arr.join(','));
  T('③-9 ★ 우리 「조금」 자리(여덟째 칸)가 일본은 小潮 다', arr[7] === '小潮', arr[7]);
}
T('③-10 ★ 일본식은 사전을 안 거친다 (이미 일본말이다)',
  /if\(style === 'jp'\) return TIDE_JP\[i\];/.test(src));
T('③-11 ★ 일본어로 켜면 물때가 일본식으로 나온다 (고른 적이 없을 때)',
  /langNow\(\) === 'ja'\) \? 'jp' : 'west'/.test(src));
T('③-12 ★ 일본식일 때는 사리·조금 딱지를 또 안 붙인다 (「大潮 大潮」 가 된다)',
  /function tideMark\(dateStr, style\)\{[\s\S]{0,260}?st === 'jp'\) return '';/.test(src));
T('③-13 ★ 한국 물때 이름은 일본어로 소리대로 적는다 (없는 말로 옮기지 않는다)',
  /'7물':'7ムル'/.test(src) && /'무시':'ムシ'/.test(src));

// ── ④ 사람 빠짐 — 나라마다 번호가 다르다
T('④-1 ★★ tel:122 로 못박은 자리가 없다', src.indexOf('href="tel:122"') < 0,
  (src.match(/[^\n]{0,60}tel:122[^\n]{0,30}/) || [''])[0]);
T('④-2 ★★ 일본은 118 (海上保安庁)', /jp: \{ n:'118'/.test(src));
T('④-3 ★★ 한국은 119 (122 는 2016년 119 로 합쳐졌다)', /kr: \{ n:'119'/.test(src));
T('④-4 ★★ 사람이 빠진 자리를 먼저 본다 (그다음 배 자리, 마지막이 쓰는 말)',
  /function sosCc\(\)\{[\s\S]{0,700}?자리\.push\(mobAt\)[\s\S]{0,200}?mobLastKnown\(\)[\s\S]{0,400}?countryOf\([\s\S]{0,300}?ccFromLang/.test(src));
T('④-5 ★ 아무것도 모르면 112 (GSM 표준)', /return SOS_BY_CC\[sosCc\(\)\] \|\| \{ n:'112'/.test(src));
T('④-6 ★ 창을 그릴 때마다 번호를 다시 박는다', /mobSosPaint\(\);/.test(src) && /function mobSosPaint\(/.test(src));
T('④-7 ★ 한국 기본 연락처도 119 다', /name:t\('해양경찰 긴급신고'\), phone:'119'/.test(src));

// ── ⑤ 작은삼촌이 짚은 낱말들
const 봐야할것 = [
  ['출항 전 점검', '発航前検査'],       // 국토교통성 법령어
  ['출항', '出港'],
  ['입항 후', '入港後'],
  ['이용약관', '利用規約'],
  ['개인정보처리방침', 'プライバシーポリシー'],
  ['등록필증', '小型船舶登録事項通知書'],  // 일본 소형선박 등록 서류의 진짜 이름.
                                        //   「小型船舶登録票」 는 일본에 없는 말이었다 (국토교통성 성령 서식으로 확인).
  ['잔량 추정 L', '推定残量 L'],        // 「残量推定」 은 말 차례가 거꾸로다
  ['L/시간', 'L/時'],
  ['같이 타기 신청한 분', '乗船を申し込んだ方'],   // 「一緒に乗るに申し込んだ方」 는 말이 안 된다
  ['지금 나갈 수 있나', '今、出港できるか']
];
봐야할것.forEach(([k, v], i) =>
  T('⑤-' + (i+1) + ' 「' + k + '」 → ' + v, JA[k] === v, JA[k]));

// ── ⑥ 한 가지 뜻에 한 가지 말 (등급이 役割·等級·ランク·権限 넷으로 갈려 있었다)
{
  const 등급들 = Object.keys(JA).filter(k => /등급/.test(k));
  const 나쁜말 = 등급들.filter(k => /等級|ランク|権限設定/.test(JA[k]));
  T('⑥-1 ★ 「등급」 을 옮긴 말이 하나로 모였다 (役割)',
    나쁜말.length === 0, 나쁜말.slice(0, 6).map(k => k + '→' + JA[k]).join(' / '));
}
{
  // 「係留場」 과 「係留地」 가 섞여 있었다
  const 섞임 = Object.keys(JA).filter(k => /係留場(?!所)/.test(JA[k]) && !/요트계류장/.test(k));
  T('⑥-2 ★ 계류장은 係留場所, 정박지는 係留地 로 갈라 놓았다',
    섞임.length === 0, 섞임.slice(0, 5).map(k => k + '→' + JA[k]).join(' / '));
}

// ── ⑦ 돈 단위 (4.102 에서 자료에 담기로 해 놓고 네 자리가 「원」 으로 굳어 있었다)
//   일본 사람이 정비수첩에 8,000 을 적으면 화면에 「8,000 ウォン」 이라고 떴다.
{
  const 굳은자리 = (src.match(/[^\n]*esc\(t\('원'\)\)[^\n]*/g) || [])
      .filter(l => !/CUR_BY_CC/.test(l));
  T('⑦-1 ★★ 화면에 「원」 을 못박은 자리가 없다 (curNow·curOf 를 쓴다)',
    굳은자리.length === 0, 굳은자리.slice(0, 3).join(' | '));
  T('⑦-2 ★ 나라마다 단위가 있다 (원·円·₽)', /CUR_BY_CC = \{ kr:'원', jp:'円', ru:'₽' \}/.test(src));
  T('⑦-3 ★ 적을 때 그 단위를 자료에 담는다 (나중에 「원」 으로 안 보이게)',
    /it0\.cur = curNow\(\)/.test(src));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
