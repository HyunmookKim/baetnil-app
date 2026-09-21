// 4.100 — 이름을 **그 나라 글자로** 적는다 (사장님 지적)
//
// ★ 무슨 일이 있었나
//   ① 이름을 기계 번역에 태웠더니 「宮島ビジターバース」 가 「미야지마 방문자 버스」 가 됐다.
//   ② 그래서 번역을 껐더니 이번엔 **일본어 화면에 「아야진항」 이 한글 그대로** 남았다.
//      사장님: 「아무리 배이름이라도 자기나라말로 읽을 수 있게 해야지」
//
// ★ 이름은 뜻이 아니라 **소리**다. 소리를 그 나라 글자로 적는다.
//   영어  — 문화체육관광부 고시 「국어의 로마자 표기법」(전사법)
//   일본어 — 가타카나 (일본 언론·지도가 한국 이름을 적는 방식)
//   러시아어 — 콘체비치 표기법
//   ★ 셋 다 규칙이라 내가 지어낼 자리가 없다. 아래 값은 하나하나 재 볼 수 있다.
const fs = require('fs');
const path = process.argv[2] || '/home/claude/work.html';
const s = fs.readFileSync(path, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; } else { bad++;
  console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 200) : '')); } };

function grab(name){ let i = s.indexOf('function ' + name + '('); if(i < 0) return '';
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j); }
function grabConst(n){ let k = s.indexOf('const ' + n + ' '); if(k < 0) k = s.indexOf('const ' + n + '=');
  if(k < 0) return ''; let j = k, depth = 0, started = false;
  for(; j < s.length; j++){ const c = s[j];
    if(c === '[' || c === '{'){ depth++; started = true; }
    else if(c === ']' || c === '}'){ depth--; }
    else if(c === ';' && depth === 0 && started){ j++; break; } }
  return s.slice(k, j); }

// ── 있는가
['koSyl','romanKo','kanaKo','cyrKo','nameSound','nameFor'].forEach(f =>
  T('함수 ' + f + ' 가 있다', !!grab(f)));

// ★ 소리 바뀜은 한 곳에서만 — 세 갈래가 저마다 하면 반드시 어긋난다 (문 하나)
['romanKo','kanaKo','cyrKo'].forEach(f =>
  T('★★★ ' + f + ' 는 koSyl 하나만 쓴다 (제 나름대로 소리를 안 바꾼다)',
    /koSyl\(str\)/.test(grab(f)) && !/RM_K\.indexOf/.test(grab(f)), grab(f)));

// ── 실제로 돌려 본다
const parts = ['RM_ON','RM_VW','RM_END','RM_LNK','RM_K','KN_VP','KN_C','KN_BASE','KN_Y','KN_W',
               'KN_PLAIN','KN_STAY','KN_END','CY_ON_A','CY_ON_M','CY_V','CY_STAY','CY_END'].map(grabConst);
parts.forEach((p, i) => T('표 ' + i + ' 를 찾았다', !!p));
const code = parts.join('\n') + '\n' + grab('koSyl') + '\n' + grab('romanKo') + '\n'
           + grab('kanaKo') + '\n' + grab('cyrKo')
           + '\nreturn { romanKo, kanaKo, cyrKo };';
let M = null;
try{ M = new Function(code)(); }catch(e){ T('표기 함수가 돈다', false, e.message); }

// ★ 값은 대조할 수 있는 자리에서만 골랐다 —
//   일본어: 일본 언론·지도 표기 (プサン·ヨス·チェジュ·インチョン·ソウル)
//   러시아어: 콘체비치 표기 (Пусан·Ёсу·Чеджу·Инчхон)
const CASE = [
  // 한글      영어          일본어         러시아어
  ['여수',    'Yeosu',      'ヨス',        'Ёсу'],
  ['부산',    'Busan',      'プサン',       'Пусан'],
  ['제주',    'Jeju',       'チェジュ',     'Чеджу'],
  ['인천',    'Incheon',    'インチョン',    'Инчхон'],
  ['목포',    'Mokpo',      'モクポ',       'Мокпхо'],
  ['통영',    'Tongyeong',  'トンヨン',     'Тхонъён'],
  ['해운대',  'Haeundae',   'ヘウンデ',     'Хэундэ'],
  ['강릉',    'Gangneung',  'カンヌン',     'Каннын'],
  ['울산',    'Ulsan',      'ウルサン',     'Ульсан'],
  ['속초',    'Sokcho',     'ソクチョ',     'Сокчхо'],
  ['거제',    'Geoje',      'コジェ',       'Кодже'],
  ['완도',    'Wando',      'ワンド',       'Вандо'],
  ['포항',    'Pohang',     'ポハン',       'Пхохан'],
  ['설악',    'Seorak',     'ソラク',       'Сорак'],   // 받침이 뒤로 넘어간다
  ['신라',    'Silla',      'シルラ',       'Силла'],   // ㄴ+ㄹ → ㄹㄹ
  ['광안리',  'Gwangalli',  'クァンアルリ',  'Кванъалли'],
  ['이순신',  'Isunsin',    'イスンシン',    'Исунсин'],
  ['원형',    'Wonhyeong',  'ウォンヒョン',  'Вонхён'],
  ['욕지항',  'Yokjihang',  'ヨクジハン',    'Ёкджихан']
];
if(M) CASE.forEach(([k, en, ja, ru]) => {
  T('영어 ' + k + ' → ' + en, M.romanKo(k) === en, M.romanKo(k));
  T('일본어 ' + k + ' → ' + ja, M.kanaKo(k) === ja, M.kanaKo(k));
  T('러시아어 ' + k + ' → ' + ru, M.cyrKo(k) === ru, M.cyrKo(k));
});
// 한글이 아닌 글자는 손대지 않는다
if(M){
  T('★★ 영문 이름은 그대로 둔다', M.romanKo('Sunshine') === 'Sunshine', M.romanKo('Sunshine'));
  T('★★ 일본어 쪽도 한글 아닌 것은 그대로', M.kanaKo('宮島港') === '宮島港', M.kanaKo('宮島港'));
  T('★★ 빈 값은 빈 값', M.romanKo('') === '' && M.kanaKo('') === '' && M.cyrKo('') === '');
}

// ── nameFor 가 말에 따라 갈린다
const nf = grab('nameFor');
T('★★★ nameFor 가 ko 면 한글 그대로', /lang === 'ko'\) return k/.test(nf), nf);
T('★★★ nameFor 가 nameSound 로 넘긴다', /nameSound\(w, lang\)/.test(nf), nf);
const ns = grab('nameSound');
T('★★★ ja 는 가타카나로 간다', /'ja'\) return kanaKo/.test(ns), ns);
T('★★★ ru 는 키릴로 간다', /'ru'\) return cyrKo/.test(ns), ns);
T('★★ 그 밖은 로마자', /return romanKo\(w\)/.test(ns), ns);
T('★★ 보통명사(마리나·요트계류시설…)만 사전을 지난다',
  /NAME_WORD\.indexOf\(w\) >= 0\) return t\(w\)/.test(nf), nf);

// ── 화면에 이름을 내는 곳이 다 nameFor 를 지나는가
['spotShowName','boatShowName','boatShowPort'].forEach(f =>
  T('★★★ ' + f + ' 가 nameFor 를 지난다', /nameFor\(/.test(grab(f)), grab(f)));

console.log(`namesoundtest: ${ok} 통과, ${bad} 실패`);
if(bad) process.exitCode = 1;
