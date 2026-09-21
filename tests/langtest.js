// 3.38 — 여러 나라 말: 지금은 틀만
//
// 왜 틀만인가
//  · 앱 안에 서로 다른 한국어 문구가 3,841개(48,716자) 있다. 원고지 250매다.
//  · 지금 전부 옮기면 4,000곳을 건드려야 하고, 그 뒤로는 기능 하나에 일이 세 배가 된다.
//  · 옮겨 봐야 글판·정박지·장터·뉴스 내용은 한국어 그대로다.
//
// ★ 그래서 제일 중요한 규칙 하나 —
//   사전이 덜 찼는데 언어 고르기를 화면에 내놓으면 안 된다.
//   골랐는데 화면이 안 바뀌면 사람은 앱이 고장난 줄 안다. 안 넣느니만 못하다.
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

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// 사전과 도구를 실제로 꺼낸다
let F = null, err = '';
try{
  // 한 줄짜리는 줄 끝까지만 잡는다 — [\s\S]*? 로 잡으면 뒤 사전까지 삼킨다
  const parts = (js.match(/const LANGS = \[[\s\S]*?\];/) || [''])[0] + '\n'
    + ['LANG_TOTAL','LANG_SHOW_AT']
      .map(k => (js.match(new RegExp('const ' + k + ' = [^\\n]*\\n')) || [''])[0]).join('\n');
  const dict = (js.match(/const I18N = \{[\s\S]*?\n\};/) || [''])[0];
  // ★ 4.94 — langNow 가 langFromDevice 를 부른다. 담아 두는 칸까지 같이 떼어 온다.
  const auto = (js.match(/let langAuto = [^\n]*\n/) || [''])[0];
  const fns = auto + ['langFromDevice','langNow','t','langCoverage','langReady']
    .map(n => grab(js, n)).filter(Boolean).join('\n');
  // ★ 4.94 부터 안 골랐으면 폰 말을 따른다. Node 에도 navigator 가 있어(영어)
  //   안 끼우면 여기서 영어판을 보게 된다. 이 검사는 한국어판을 재는 곳이다.
  F = new Function('localStorage', 'navigator', parts + '\n' + dict + '\n' + fns
    + '\n return { LANGS, I18N, LANG_TOTAL, LANG_SHOW_AT, langNow, t, langCoverage, langReady };')(
    { getItem: () => null, setItem: () => {} },
    { language: 'ko-KR', languages: ['ko-KR'] });
}catch(e){ err = e.message; }

// ── 1. 틀이 있다
{
  T('말 목록이 있다', !!F && Array.isArray(F.LANGS));
  T('사전을 실제로 꺼냈다' + (err ? ' — ' + err : ''), !!F);
  if(F){
    T('한국어·영어·러시아어 셋이다 — ' + F.LANGS.map(x=>x.v).join(','),
      ['ko','en','ru'].every(v => F.LANGS.some(x=>x.v===v)));
    T('말마다 사람이 읽을 이름이 있다', F.LANGS.every(x=>x.name && x.name.length));
    // 러시아어 이름은 러시아어로 적어야 그 사람이 알아본다
    T('러시아어 이름이 러시아어다 — ' + (F.LANGS.find(x=>x.v==='ru')||{}).name,
      /[Ѐ-ӿ]/.test((F.LANGS.find(x=>x.v==='ru')||{}).name || ''));
  } else fail += 3;
}

// ── 2. ★ 옮긴 말이 없으면 원문을 낸다 (빈 칸이 나오면 안 된다)
if(F){
  T('바꾸는 곳이 있다', typeof F.t === 'function');
  T('한국어에서는 원문 그대로 — ' + F.t('오늘'), F.t('오늘') === '오늘');
  T('사전에 없는 말도 원문으로 나온다', F.t('없는말입니다') === '없는말입니다');
  T('빈 것도 무너지지 않는다', F.t(null) === '' && F.t(undefined) === '');
  // 영어/러시아어를 강제로 켜서 본다
  const forced = v => {
    const parts = (js.match(/const LANGS = \[[\s\S]*?\];/) || [''])[0] + '\n'
      + ['LANG_TOTAL','LANG_SHOW_AT']
        .map(k => (js.match(new RegExp('const ' + k + ' = [^\\n]*\\n')) || [''])[0]).join('\n');
    const dict = (js.match(/const I18N = \{[\s\S]*?\n\};/) || [''])[0];
    const auto = (js.match(/let langAuto = [^\n]*\n/) || [''])[0];
    return new Function('localStorage', 'navigator',
      parts + '\n' + dict + '\n' + auto + grab(js,'langFromDevice') + '\n'
      + grab(js,'langNow') + '\n' + grab(js,'t') + '\n return t;')(
      { getItem: () => v, setItem: () => {} },
      { language: 'ko-KR', languages: ['ko-KR'] });
  };
  const en = forced('en'), ru = forced('ru');
  T('영어로 바뀐다 — ' + en('오늘') + ' / ' + en('커뮤니티'), en('오늘') === 'Today');
  T('러시아어로 바뀐다 — ' + ru('오늘') + ' / ' + ru('커뮤니티'), /[Ѐ-ӿ]/.test(ru('오늘')));
  T('영어에 없는 말은 원문으로 떨어진다', en('없는말입니다') === '없는말입니다');
  // ★ 두 사전의 열쇠가 어긋나면 한쪽만 반쪽으로 바뀐다
  const ke = Object.keys(F.I18N.en || {}), kr = Object.keys(F.I18N.ru || {});
  const only = ke.filter(k => !kr.includes(k)).concat(kr.filter(k => !ke.includes(k)));
  T('영어와 러시아어가 같은 말을 담는다 — 어긋난 것 ' + only.length + '개', only.length === 0);
  T('사전이 비어 있지 않다 — ' + ke.length + '개', ke.length >= 40);
  // 옮긴 말이 원문 그대로면 안 옮긴 것이다.
  // ★ 다만 한글이 한 자도 없는 것은 뺀다 — 「4JH4E, ST60, 40ST …」 같은 모델 번호와
  //   「…」 은 어느 나라 말로도 그대로다. 억지로 바꾸면 오히려 틀린 말이 된다.
  const hasKo = x => /[가-힣]/.test(x);
  // ★ 4.100 — 글 안에 그대로 박히는 **표시**는 옮기지 않는다.
  //   「[사진1]」 은 글에 남아 정규식으로 다시 읽혀 사진이 끼워진다.
  //   옮기면 안내와 실제 글자가 어긋나 사진이 안 들어간다.
  const 표시 = ['[사진1]'];
  const same = ke.filter(k => hasKo(k) && 표시.indexOf(k) < 0 && F.I18N.en[k] === k);
  T('영어가 한국어를 그대로 베끼지 않았다 — ' + (same.slice(0,3).join(',') || '없음'), same.length === 0);
} else fail += 10;

// ── 3. ★ 덜 찼으면 고르기를 내놓지 않는다
if(F){
  T('얼마나 찼는지 재는 곳이 있다', typeof F.langCoverage === 'function');
  T('잣대가 한 곳에 정해져 있다 — ' + F.LANG_TOTAL, F.LANG_TOTAL > 1000);
  T('한국어는 늘 100%', F.langCoverage('ko') === 1);
  // ★ 여기가 핵심이다 — 잣대는 '찬 만큼만 내놓는다' 이지 '아직 덜 찼다' 가 아니다.
  //   3.90 에서 영어·러시아어를 다 채웠으므로, 이제는 셋 다 나와야 맞다.
  const cov = F.langCoverage('en'), covRu = F.langCoverage('ru');
  T('영어가 다 찼다 — ' + (cov*100).toFixed(1) + '%',    cov   >= F.LANG_SHOW_AT);
  T('러시아어가 다 찼다 — ' + (covRu*100).toFixed(1) + '%', covRu >= F.LANG_SHOW_AT);
  T('찬 말만 고르기에 나온다 — ' + F.langReady().map(x=>x.v).join(','),
    F.langReady().every(x => x.v === 'ko' || F.langCoverage(x.v) >= F.LANG_SHOW_AT)
    && F.langReady().some(x => x.v === 'ko'));
  T('기준선이 한 곳에 정해져 있다 — ' + (F.LANG_SHOW_AT*100) + '%',
    F.LANG_SHOW_AT >= 0.5 && F.LANG_SHOW_AT <= 1);
} else fail += 7;

// ── 4. 화면에도 그 판단이 걸려 있다
{
  const a = grab(js, 'applyLang') || '';
  T('언어를 화면에 입히는 곳이 있다', a.length > 0);
  // ★ 4.30 에서 「언어」가 서랍에서 설정 안으로 옮겨 갔다.
  //   보아야 할 것은 「어디에 있느냐」가 아니라 「말이 하나뿐이면 안 보이느냐」다.
  //   자리를 글자로 박아 두면 화면을 옮길 때마다 검사가 깨진다.
  T('덜 찼으면 언어 고르는 자리를 감춘다',
    /langReady\(\)\.length > 1/.test(a) || /langReady\(\)\.length > 1/.test(grab(js, 'openSettings') || ''));
  T('바닥 메뉴가 사전을 거친다', /tabHome/.test(a) && /t\(/.test(a));
  // ★ 그림까지 지우면 아이콘이 사라진다
  T('그림은 두고 글자만 바꾼다', /nodeType === 3/.test(a));
  T('브라우저에도 무슨 말인지 알려 준다', /documentElement\.lang/.test(a));
  T('켤 때 한 번 입힌다', /\napplyLang\(\);/.test(js));
  // 언어로 들어가는 길이 어딘가에 있어야 한다 (서랍이든 설정이든)
  T('언어로 들어가는 길이 있다', /openLang\(\)/.test(src) || /openLang\(\)/.test(js));
  T('말이 하나뿐이면 그 길이 안 보인다', (()=>{
    const st = grab(js, 'openSettings') || '';
    if(st) return /langReady\(\)\.length > 1/.test(st) && /many \?/.test(st);
    return /id="langBtn" style="display:none"/.test(src);   // 옛 구조도 인정한다
  })());
  const o = grab(js, 'openLang') || '';
  T('고르는 화면이 있다', o.length > 0);
  T('준비된 말만 보여 준다', /langReady\(/.test(o));
  // ★ 화면 글자만 바뀐다는 것을 미리 말해 준다. 안 그러면 '왜 글이 한국어냐' 고 한다.
  T('내용은 안 바뀐다고 알려 준다', /쓴 사람이 쓴 언어|내용/.test(o));
  const sl = grab(js, 'setLang') || '';
  T('고른 말을 기억한다', /setItem/.test(sl));
  T('모르는 말은 받지 않는다', /LANGS\.some/.test(sl));
}


// ── ★★★ 코드가 실제로 쓰는 말과 대조한다 (4.70)
//
//   왜 (2026-08-29 사장님 지적)
//   사장님이 일본어로 바꿨는데 「걸린 시간 10분」·「든 돈 4,700원」·「정비 항목 · 계통으로 찾기」 가
//   한국어 그대로 나왔다. 까닭은 이랬다 —
//   나는 일본어 사전을 **영어 사전을 베껴서** 만들었다. 그런데 영어 사전 자체가
//   **115개 문구를 빠뜨리고** 있었다. 4.54~4.70 에서 내가 만든 것들(장비·리뷰·정비수첩)의 말이다.
//   새 기능을 만들 때마다 사전에 넣는 것을 빼먹었고, 검사는 「일본어가 영어만큼 있나」만 봤다.
//   ★ 둘 다 없으면 통과였다. 사전끼리 견주면 이 흠은 영영 안 잡힌다.
//
//   그래서 이제 **코드**를 잣대로 삼는다. t('…') · tsub('…') · data-t 를 다 긁어서
//   그 하나하나가 세 사전에 다 있는지 본다.
{
  const body = js.slice(js.indexOf('};', js.indexOf('  ja: {')) + 2);
  const used = new Set();
  for(const m of body.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) used.add(m[1]);
  for(const m of body.matchAll(/\btsub\(\s*'((?:[^'\\]|\\.)*)'/g)) used.add(m[1]);
  for(const m of body.matchAll(/data-t="([^"]*)"/g)) used.add(m[1]);
  const un = x => x.replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  const U = [...used].map(un).filter(x => x.trim() && !/^\s*$/.test(x));
  T('★ 코드가 쓰는 문구를 모았다 (' + U.length + '개)', U.length > 1500, U.length);
  ['en','ja','ru'].forEach(L=>{
    const miss = U.filter(k => !(k in (F.I18N[L] || {})));
    T('★★★ 코드가 쓰는 말이 ' + L + ' 사전에 다 있다 (빠진 것 ' + miss.length + '개)',
      miss.length === 0, miss.slice(0, 8));
    if(miss.length) console.log("   빠진 말: " + JSON.stringify(miss.slice(0,8)));
    if(process.env.MISS_JSON && L === 'en')
      require('fs').writeFileSync(process.env.MISS_JSON, JSON.stringify(miss, null, 0));
  });
  // 사전에만 있고 코드에 없는 것은 괜찮다 (옛 문구). 그건 실패로 치지 않는다.
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
