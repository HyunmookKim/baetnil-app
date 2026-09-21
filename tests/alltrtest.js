// 보이는 모든 글자가 보는 사람 말로 나오는가 (4.81)
//
// ★★★ 사장님이 정하신 것
//   「모든 내용이 다 자기언어로 보이게 하라니까 어떤건 아니고 어떤건 되고
//     니멋대로 기준을 만들었냐」
//   그리고 —
//   「내가 일본어만 지적했다고 또 딱 일본어만 작업하면 안 된다」
//
// ★ 내가 되풀이한 잘못: **내 사정으로 예외를 만든 것.**
//   · 「앱에 든 자료는 서버에 문서가 없으니」 → 일본 정박지가 일본어로 남음
//   · 「뉴스는 값이 드니 누르게 하자」        → 뉴스가 남의 말로 남음
//   · 「연재·배 목록은 이름뿐이니」            → 그것도 남의 말로 남음
//   전부 앱 속 사정이지 사람 사정이 아니다. 이 검사는 그 예외를 못 만들게 막는다.
const fs = require('fs');
function grabConst(src, n){
  let k = src.indexOf('const ' + n + ' ');
  if(k < 0) k = src.indexOf('const ' + n + '=');
  if(k < 0) return '';
  let j = k, depth = 0, started = false;
  for(; j < src.length; j++){
    const c = src[j];
    if(c === '[' || c === '{'){ depth++; started = true; }
    else if(c === ']' || c === '}'){ depth--; }
    else if(c === ';' && depth === 0 && started){ j++; break; }
  }
  return src.slice(k, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };
const grab=(js,name)=>{ for(const pre of ['function ','async function ']){
    const i=js.indexOf(pre+name+'('); if(i<0) continue;
    let d=0, st=js.indexOf('{',i);
    for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} } }
  return ''; };

// ── ① 사람이 눌러야 옮겨지는 곳이 하나도 없어야 한다
//    ★ 딱 하나만 남는다 — 「원어로 보기」 를 눌렀던 사람이 **돌아오는 길**.
//      그건 사람이 스스로 끈 것이라 다시 켜는 단추가 있어야 한다. 그 외에는 없다.
T('★★★ 뉴스에 「번역해서 보기」 단추가 없다 (알아서 옮긴다)',
  !/onclick="newsTrGo\(/.test(src));
{
  const 곳 = (src.match(/onclick="trGo\([^"]*"/g) || []);
  T('★★★ 「번역해서 보기」 단추는 딱 한 곳뿐이다 (돌아오는 길)', 곳.length === 1, 곳);
  const f = grab(src, 'trBar');
  T('★★★ 그 한 곳도 「원어로 보기」 를 누른 사람에게만 나온다',
    /if\(!TR_SKIP\[key\]\)\{ trAuto\(coll, id[\s\S]*?return ''; \}/.test(f), f.slice(-400));
}
T('★★ 「원어로 보기」 는 남아 있다 (원문이 보고 싶은 사람은 있다)',
  /원어로 보기/.test(src));

// ── ② 화면마다 옮기는 문을 실제로 부르는가
[['글판',       /trListAuto\('community'/],
 ['중고 장터',  /trListAuto\('market'/],
 ['정박지(사람)', /trListAuto\('spots'/],
 ['정박지(앱에 든 것)', /trWordsAuto\(rows\.filter\(s => s\.seed\)/],
 ['연재',       /trListAuto\('series'/],
 ['배 둘러보기', /trListAuto\('boatPublic', 보일것/],
 ['남의 배 기록', /trAuto\('boatPublic', bid/],
 ['뉴스(내 말)', /newsTrAuto\(내소식\)/],
 ['뉴스(세계)', /newsTrAuto\(세계\)/]
].forEach(([이름, re]) => T('★★★ ' + 이름 + ' 이 옮기는 문을 부른다', re.test(src)));

// ── ③ 고르는 문이 하나인가 (둘이면 반드시 한 곳이 남의 말로 남는다)
[['정박지 이름', 'spotShowName'], ['정박지 메모', 'spotShowNote'],
 ['배 이름', 'boatShowName'],     ['매어 둔 곳', 'boatShowPort'],
 ['연재 묶음 이름', 'seriesShowName']
].forEach(([이름, fn]) => T('★★★ ' + 이름 + ' 을 고르는 문이 하나다 (' + fn + ')',
  new RegExp('function ' + fn + '\\(').test(src)));

// ── ④ 그 문을 안 거치고 날 글자를 쓰는 곳이 없는가
//    ★ 여기서 한 군데라도 새면 그 줄만 남의 말로 남는다. 사장님이 사진으로 잡아 주신 것이 늘 이것이었다.
[['정박지 목록 줄',   /spotShowName\(s\) \|\| t\('이름 없음'\)/],
 ['정박지 상세 제목', /<b>\$\{esc\(spotShowName\(s\)\)\}<\/b>/],
 ['정박지 지도 핀',   /label:spotShowName\(s\)/],
 ['배 목록 줄',       /boatShowName\(x\) \|\| t\('이름 없음'\)/],
 ['배 페이지 제목',   /<b>\$\{esc\(boatShowName\(x\) \|\| ''\)\}<\/b>/],
 ['남의 배 기록의 배 이름', /\[boatShowName\(b\), boatShowPort\(b\)\]/],
 ['연재 글 제목',     /trRow\('series', x\.id, 'title', x\.title\)/]
].forEach(([이름, re]) => T('★★★ ' + 이름 + ' 이 그 문을 쓴다', re.test(src)));

// ── ⑤ 옮긴 글자로도 찾혀야 한다 (화면에 보이는 글자로 못 찾으면 없는 줄 안다)
T('★★★ 정박지를 옮긴 이름으로도 찾는다',
  /spotShowName\(s\)/.test(src) && /spotShowNote\(s\)/.test(src)
  && /\[s\.name, spotShowName\(s\)/.test(src));
T('★★★ 남의 배 기록을 옮긴 배 이름으로도 찾는다', /boatShowName\(o\.b\), boatShowPort\(o\.b\)/.test(src));

// ── ⑥ 한 말만 고치고 끝내지 않았는가
//    ★ 사장님: 「일본어만 지적했다고 딱 일본어만 작업하면 안 된다」
//    옮기는 문 어디에도 특정 말이 박혀 있으면 안 된다. 늘 langNow() 여야 한다.
['trWord','trWordsAuto','trRow','trListAuto'].forEach(fn=>{
  const f = grab(src, fn);
  const 박힘 = /['"](ja|en|ru|zh|ko)['"]/.test(f);
  T('★★★ ' + fn + ' 에 특정 말이 박혀 있지 않다', !박힘, f.slice(0,200));
});
T('★★★ 옮길 말은 늘 지금 쓰는 말이다', /const lang = langNow\(\)/.test(grab(src,'trWordsAuto')));

// ══════════════════════════════════════════════════════════════
// ⑦ 서버 한도를 지키는가 (2026-08-31 — 이것 때문에 아무것도 안 옮겨졌다)
//
// ★ 서버는 한 번에 60 도막·6000 자까지다. 넘기면 **통째로 거절**한다.
//   나는 뉴스 한 화면(80건 × 제목+요약 = 160 도막)을 그대로 보내고 있었다.
//   매번 거절당했고, 나는 그것을 「옮긴 것」 으로 치고 화면에는
//   「자동 번역된 글입니다」 라고 띄웠다. **화면이 거짓말을 했다.**
T('★★★ 한 번에 보낼 도막 수에 끝이 있다', /const TR_SEND_N\s*=\s*(\d+)/.test(src));
T('★★★ 한 번에 보낼 글자 수에도 끝이 있다', /const TR_SEND_CHARS\s*=\s*(\d+)/.test(src));
T('★★★ 한도에 맞게 나누는 곳이 있다', /function trChunks\(/.test(src));
{
  const env = `
    ${(src.match(/const TR_SEND_N\s*=\s*\d+;/)||[''])[0]}
    ${(src.match(/const TR_SEND_CHARS\s*=\s*\d+;/)||[''])[0]}
    ${grab(src,'trChunks')}
    return { trChunks, TR_SEND_N, TR_SEND_CHARS };`;
  const F = new Function(env)();
  const 많이 = []; for(let i=0;i<160;i++) 많이.push('제목' + i);
  const c = F.trChunks(많이);
  T('★★★ 백육십 도막이 여러 번으로 나뉜다 (' + c.length + '묶음)', c.length > 1, c.length);
  T('★★★ 어느 묶음도 도막 한도를 안 넘는다', c.every(x => x.length <= F.TR_SEND_N),
    c.map(x=>x.length));
  T('★★★ 어느 묶음도 글자 한도를 안 넘는다',
    c.every(x => x.join('').length <= F.TR_SEND_CHARS));
  T('★★★ 도막을 하나도 잃지 않는다', c.reduce((n,x)=>n+x.length,0) === 160);
  const 긴것 = ['가'.repeat(5000), '나'.repeat(5000)];
  const c2 = F.trChunks(긴것);
  T('★★★ 긴 글은 글자 수로 나뉜다', c2.length === 2, c2.map(x=>x.join('').length));
}
// ★★★ 못 옮겼으면 못 박지 않는다 — 한 번 실패하면 그 화면이 영영 원문이 된다
{
  const f = grab(src, 'trSend');
  T('★★★ 실패한 것을 원문으로 못 박지 않는다',
    !/got\[k\] = k/.test(f) && !/if\(got\[k\] === undefined\)/.test(f), f.slice(0,400));
  T('★★ 옮긴 것이 있는지 알려 준다 (화면이 거짓말하지 않게)', /return 옮긴것 > 0/.test(f));
}
// ★★★ 화면이 거짓말하지 않는가
{
  const f = grab(src, 'newsTrBar');
  T('★★★ 실제로 바뀐 글자가 있어야 「자동 번역된 글입니다」 를 낸다',
    /const 바뀐것 = rows\.some/.test(f) && /if\(!바뀐것\) return ''/.test(f), f.slice(0,300));
  const g = grab(src, 'newsTrAuto');
  T('★★★ 못 옮겼으면 옮겼다고 켜지 않는다', /if\(됐나\) trNewsOn = true/.test(g));
  T('★★ 뉴스도 나눠 보낸다', /for\(const part of trChunks\(want\)\)/.test(g));
  T('★★ 화면에 보이는 만큼만 옮긴다', /slice\(0, NEWS_TR_MAX\)/.test(g));
}
// ★ 한국말을 안 쓰는 사람에게 한국 소식을 먼저 펴지 않는다
T('★★ 쓰는 말에 따라 뉴스 첫 탭이 갈린다',
  /langNow\(\) !== 'ko'\) \? 'ww' : 'kr'/.test(src));

// ── 차례가 곧 대접이다 (사장님이 정하신 것)
{
  const m = src.match(/const LANGS = \[[\s\S]*?\n\];/);
  const L = m ? new Function('return ' + m[0].replace('const LANGS = ','').replace(/;\s*$/,''))() : [];
  T('★★★ 언어 고르기에서 일본어가 맨 앞이다 (주무대다)',
    L[0] && L[0].v === 'ja', L.map(x=>x.v));
  T('★★ 네 말이 다 있다', L.length === 4 && ['ja','ko','en','ru'].every(v => L.some(x=>x.v===v)), L.map(x=>x.v));
  // ★ 차례를 바꿨다고 한국 사람 앱이 일본어로 열리면 안 된다.
  //   ★ 4.94 부터 아무것도 안 골랐으면 폰 말을 따른다 (langFromDevice).
  //     그래도 목록 차례는 아무 상관이 없어야 하고, 모르는 말이면 한국어로 떨어져야 한다.
  //     실제로 그렇게 도는지는 langautotest.js 가 폰을 흉내 내어 확인한다.
  const f = grab(src, 'langNow') + '\n' + (grab(src, 'langFromDevice') || '');
  T('★★★ 목록 차례를 안 본다 (LANGS[0] 를 집지 않는다)',
    !/LANGS\s*\[\s*0\s*\]/.test(f), f);
  T('★★★ 모르는 말이면 한국어로 떨어진다',
    /let got = 'ko'|return 'ko'/.test(f), f);
}

// ── ⑧ 돈이 새지 않는가
{
  const f = grab(src, 'trWordsAuto');
  T('★★★ 내 말인 것은 아예 안 보낸다', /trSameLang\(k, lang\)/.test(f));
  T('★★★ 한 번 본 글자는 다시 안 보낸다', /got\[k\] !== undefined/.test(f));
  // ★★★ 2026-08-31 — 여기에 「못 옮긴 것도 원문으로 못 박는다」 를 못 박아 뒀었다.
  //   그것이 이번 고장의 원인이다. 서버가 한 번 거절하면 그 화면은 영영 원문이 됐다.
  //   지켜야 할 것은 반대다 — **실패한 것은 다음에 다시 온다.**
  //   맴돌지 않는 것은 다른 방법으로 막는다: 하나라도 옮겼을 때만 다시 그린다.
  T('★★★ 실패한 것을 원문으로 못 박지 않는다 (다음에 다시 온다)',
    !/got\[k\] = k;/.test(f) || /trSameLang\(k, lang\)\)\{ got\[k\] = k/.test(f), f);
  T('★★★ 하나라도 옮겼을 때만 다시 그린다 (맴돌지 않는다)',
    /if\(됐나\)\{ try\{ if\(typeof again === 'function'\) again\(\); \}catch\(_\)\{\} \}/.test(f));
  T('★★ 한 번에 보낼 양에 끝이 있다', /want\.length >= TR_WORD_MAX/.test(f));
  const g = grab(src, 'newsTrAuto');
  T('★★★ 뉴스도 한 번 본 글자는 다시 안 보낸다', /got\[v\] !== undefined/.test(g));
  T('★★★ 뉴스도 실패한 것을 못 박지 않는다',
    !/want\.forEach\(k => \{ if\(got\[k\] === undefined\) got\[k\] = k; \}\)/.test(g));
  T('★★ 「원어로 보기」 를 누른 사람에게는 다시 안 옮긴다', /if\(newsTrSkip \|\| TR_BUSY\.news\) return/.test(g));
}

// ── ⑧ 이름은 뜻이 아니라 소리로 옮긴다 (4.100)
//   옛 설계: 「아직 못 옮겼으면 원문이 나온다」 — 기계 번역에 맡기던 때의 규칙이다.
//   지금 설계: 이름은 번역기에 안 태우고 **그 나라 글자로 소리**를 적는다.
//   설명(note)은 그대로 자동 번역을 지난다 — 그건 문장이기 때문이다.
{
  const DICT = { ja: { '마리나':'マリーナ' }, en: { '마리나':'Marina' }, ru: { '마리나':'Марина' } };
  const env = `
    let langCur = 'ja';
    const langNow = () => langCur;
    const TR_ON = {}, TR_GOT = {}, TR_WORD = {};
    const DICT = ${JSON.stringify(DICT)};
    const t = k => (DICT[langCur] && DICT[langCur][k]) || k;
    ${grab(src,'trKey')} ${grab(src,'trPick')} ${grab(src,'trView')} ${grab(src,'trRow')}
    ${grab(src,'trWord')}
    ${grabConst(src,'RM_ON')} ${grabConst(src,'RM_VW')} ${grabConst(src,'RM_END')}
    ${grabConst(src,'RM_LNK')} ${grabConst(src,'RM_K')}
    ${grabConst(src,'KN_VP')} ${grabConst(src,'KN_C')} ${grabConst(src,'KN_BASE')}
    ${grabConst(src,'KN_Y')} ${grabConst(src,'KN_W')} ${grabConst(src,'KN_PLAIN')}
    ${grabConst(src,'KN_STAY')} ${grabConst(src,'KN_END')}
    ${grabConst(src,'CY_ON_A')} ${grabConst(src,'CY_ON_M')} ${grabConst(src,'CY_V')}
    ${grabConst(src,'CY_STAY')} ${grabConst(src,'CY_END')} ${grabConst(src,'NAME_WORD')}
    ${grab(src,'koSyl')} ${grab(src,'hasHangul')} ${grab(src,'romanKo')}
    ${grab(src,'kanaKo')} ${grab(src,'cyrKo')} ${grab(src,'nameSound')} ${grab(src,'nameFor')}
    ${grab(src,'spotShowName')} ${grab(src,'boatShowName')}
    return { trWord, spotShowName, boatShowName, nameFor, TR_WORD, TR_GOT, TR_ON, setLang:l=>{langCur=l;} };`;
  const F = new Function(env)();
  F.setLang('ko');
  T('★★★ 한국어로 보면 한글 그대로', F.spotShowName({ id:'s1', name:'소호 마리나', seed:true }) === '소호 마리나',
    F.spotShowName({ id:'s1', name:'소호 마리나', seed:true }));
  F.setLang('ja');
  T('★★★ 일본어로 보면 가타카나로 읽힌다',
    F.spotShowName({ id:'s1', name:'소호 마리나', seed:true }) === 'ソホマリーナ',
    F.spotShowName({ id:'s1', name:'소호 마리나', seed:true }));
  F.setLang('ru');
  T('★★★ 러시아어로 보면 키릴로 읽힌다',
    F.spotShowName({ id:'s1', name:'소호 마리나', seed:true }) === 'Сохо Марина',
    F.spotShowName({ id:'s1', name:'소호 마리나', seed:true }));
  F.setLang('en');
  T('★★★ 배 이름도 같다', F.boatShowName({ id:'b1', name:'여수 SHUNSHINE' }) === 'Yeosu SHUNSHINE',
    F.boatShowName({ id:'b1', name:'여수 SHUNSHINE' }));
  T('★★ 한글이 아닌 이름은 손대지 않는다', F.boatShowName({ id:'b2', name:'SHUNSHINE' }) === 'SHUNSHINE');

  // 설명(문장)은 그대로 자동 번역을 지난다 — 이름만 안 태우는 것이다
  F.setLang('ja');
  F.TR_WORD['ja'] = { '앞이 트여 바람을 탄다':'前が開いていて風を受ける' };
  T('★★★ 설명은 그대로 옮겨진다', F.trWord('앞이 트여 바람을 탄다') === '前が開いていて風を受ける');
  F.setLang('ru');
  T('★★★ 아직 안 옮긴 말이면 원문이 나온다', F.trWord('앞이 트여 바람을 탄다') === '앞이 트여 바람을 탄다');
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
