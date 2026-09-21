// 4.94 — 처음 켤 때 폰이 정한 말을 따른다
//
// ★ 왜 이 검사가 있나
//   4.93 까지 langNow() 는 저장된 것이 없으면 무조건 'ko' 를 돌려줬다.
//   폰 말(navigator.language)을 한 번도 안 봤다.
//   일본어 사전이 2,450개로 다 차 있는데, 일본 사람이 앱을 켜면 한국어가 나왔다.
//   ★ 게다가 LANGS 목록 위 주석에는 「처음 켤 때 무슨 말로 열지는 폰이 정한 말을 따른다」
//     라고 적혀 있었다. 그런 코드가 없었다 — 주석이 거짓말을 하고 있었다.
//
// ★ 규칙 셋
//   ① 사람이 고른 것이 있으면 그것이 언제나 이긴다.
//   ② 자동은 「아직 안 골랐을 때」 만이다.
//   ③ 자동으로 고른 것은 저장하지 않는다 — 저장하면 사람이 고른 것과 구분이 안 된다.
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

// 앱에서 말 고르는 부분만 떼어 돌린다. 폰과 저장소는 가짜를 끼운다.
function build(saved, langs, total){
  const put = [];
  const parts = (js.match(/const LANGS = \[[\s\S]*?\];/) || [''])[0] + '\n'
    + ['LANG_TOTAL','LANG_SHOW_AT']
      .map(k => (js.match(new RegExp('const ' + k + ' = [^\\n]*\\n')) || [''])[0]).join('\n')
      .replace('const LANG_TOTAL', 'let LANG_TOTAL')
    // 자동으로 고른 말을 담아 두는 칸 — 있으면 같이 떼어 온다
    + '\n' + ((js.match(/let langAuto = [^\n]*\n/) || [''])[0]);
  const parts2 = total ? (parts + '\nLANG_TOTAL = ' + total + ';\n') : parts;
  const dict = (js.match(/const I18N = \{[\s\S]*?\n\};/) || [''])[0];
  // 자동 감지는 이름이 무엇이든 langNow 안에서 일어나야 한다.
  // 도우미가 따로 있으면 같이 떼어 온다.
  const helper = grab(js, 'langFromDevice') || '';
  const fns = ['langNow','t','langCoverage','langReady'].map(n => grab(js, n)).join('\n');
  const f = new Function('localStorage', 'navigator',
    parts2 + '\n' + dict + '\n' + helper + '\n' + fns
    + '\n return { langNow, t, langReady, LANGS };');
  return { api: f(
      { getItem: k => (k === 'bt_lang' ? saved : null),
        setItem: (k, v) => put.push([k, v]) },
      { language: (langs && langs[0]) || '', languages: langs || [] }
    ), put };
}

// ── 1. ★ 여기가 그 자리다 — 안 골랐고 폰이 일본어면 일본어로 연다
{
  let got = '', err = '';
  try{ got = build(null, ['ja-JP','en-US']).api.langNow(); }catch(e){ err = e.message; }
  T('폰이 일본어면 일본어로 연다 — ' + (got || err), got === 'ja');
}
{
  let got = '';
  try{ got = build(null, ['en-GB']).api.langNow(); }catch(_){}
  T('폰이 영어면 영어로 연다 — ' + got, got === 'en');
}
{
  let got = '';
  try{ got = build(null, ['ru-RU']).api.langNow(); }catch(_){}
  T('폰이 러시아어면 러시아어로 연다 — ' + got, got === 'ru');
}
{
  let got = '';
  try{ got = build(null, ['ko-KR']).api.langNow(); }catch(_){}
  T('폰이 한국어면 한국어로 연다 — ' + got, got === 'ko');
}

// ── 2. ★ 사람이 고른 것이 언제나 이긴다
{
  let got = '';
  try{ got = build('ko', ['ja-JP']).api.langNow(); }catch(_){}
  T('한국어를 골라 뒀으면 폰이 일본어여도 한국어 — ' + got, got === 'ko');
}
{
  let got = '';
  try{ got = build('ru', ['ja-JP','ko-KR']).api.langNow(); }catch(_){}
  T('러시아어를 골라 뒀으면 그대로 러시아어 — ' + got, got === 'ru');
}

// ── 3. 모르는 말이면 한국어로 떨어진다 (빈 화면이 나오면 안 된다)
{
  let got = '';
  try{ got = build(null, ['zh-CN']).api.langNow(); }catch(_){}
  T('모르는 말이면 한국어 — ' + got, got === 'ko');
}
{
  let got = '';
  try{ got = build(null, []).api.langNow(); }catch(_){}
  T('폰이 아무 말도 안 해도 한국어 — ' + got, got === 'ko');
}
{
  let got = '';
  try{ got = build(null, ['zh-CN','ja-JP']).api.langNow(); }catch(_){}
  T('첫째를 모르면 둘째를 본다 — ' + got, got === 'ja');
}
{
  let got = '';
  try{ got = build(null, ['JA-JP']).api.langNow(); }catch(_){}
  T('큰 글자로 와도 알아본다 — ' + got, got === 'ja');
}

// ── 4. ★ 자동으로 고른 것은 저장하지 않는다
{
  let put = [];
  try{ const b = build(null, ['ja-JP']); b.api.langNow(); put = b.put; }catch(_){}
  T('자동으로 고른 것을 저장하지 않는다 — 쓴 것 ' + put.length + '개', put.length === 0);
}

// ── 5. 그 말로 화면 글자가 실제로 바뀐다
{
  let s = '';
  try{ s = build(null, ['ja-JP']).api.t('오늘'); }catch(_){}
  T('일본어로 열면 글자가 일본어다 — ' + s, s !== '오늘' && /[ぁ-んァ-ン一-龥]/.test(s));
}
{
  let s = '';
  try{ s = build(null, ['ru-RU']).api.t('오늘'); }catch(_){}
  T('러시아어로 열면 글자가 러시아어다 — ' + s, /[Ѐ-ӿ]/.test(s));
}

// ── 6. 덜 찬 말은 자동으로 안 고른다 (골랐는데 화면이 안 바뀌면 고장난 줄 안다)
{
  let ok = false;
  try{
    const b = build(null, ['ja-JP']);
    const ready = b.api.langReady().map(x => x.v);
    // 자동으로 고른 말은 반드시 '골라도 되는 말' 안에 있어야 한다
    ok = ready.indexOf(b.api.langNow()) >= 0;
  }catch(_){}
  T('자동으로 고른 말은 골라도 되는 말 안에 있다', ok);
}

// ── 6-2. ★ 덜 찬 말은 자동으로도 안 고른다 — 잣대를 크게 잡아 일부러 덜 차게 만든다
//   지금은 넷이 다 차 있어서 「langReady 를 쓰는가」가 겉으로 안 드러난다.
//   잣대(LANG_TOTAL)를 크게 잡으면 어느 말도 60%를 못 넘는다. 그때 한국어로 떨어져야 맞다.
{
  let got = '', err = '';
  try{ got = build(null, ['ja-JP'], 999999).api.langNow(); }catch(e){ err = e.message; }
  T('사전이 덜 차면 자동으로도 안 고른다 — ' + (got || err), got === 'ko');
}

// ── 7. 주석이 거짓말을 안 한다 (여기가 이 검사의 출발점이었다)
{
  const f = grab(js, 'langNow') + '\n' + (grab(js, 'langFromDevice') || '');
  // ★ 'navigator.languages' 라고 그대로 적혀 있어야 한다는 뜻이 아니다.
  //   변수에 받아 써도 된다. 폰 말을 읽는다는 것만 본다.
  T('폰 말을 실제로 본다', /\bnavigator\b/.test(f) && /\blanguages?\b/.test(f));
}

// ── 8. 일본어가 목록에 있다
{
  let has = false;
  try{ has = build(null, ['ko']).api.LANGS.some(x => x.v === 'ja'); }catch(_){}
  T('일본어가 말 목록에 있다', has);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
