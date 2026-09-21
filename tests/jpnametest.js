// 4.102 — 일본 정박지 이름을 우리말로 **읽어** 준다 (사장님 지적)
//
// ★ 사장님: 「지금 일본 항구들 번역 안 된 건 이유가 머지?」
//
// ★ 무엇을 하고 무엇을 안 하나
//   · 한다 — 소리 옮기기(음역). 국립국어원 「일본어의 가나와 한글 대조표」 그대로.
//   · 안 한다 — 뜻 옮기기. 4.100 에서 「ビジターバース」 가 「방문자 버스」 로 떴던 잘못.
//   · 그리고 **원문을 절대 안 지운다.** 현지 표지판·해도·무전과 달라지면 못 찾는다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '/home/claude/work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? '  → ' + w : '')); } };

function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
function grabConst(name){
  const i = src.indexOf('const ' + name + ' = {');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j) + ';';
}
const 모음코드 = (src.match(/const KANA_모음 = \{\};[\s\S]*?const 모음글자 = \{[^}]*\};/) || [''])[0];
const code = [grabConst('KANA_어두'), grabConst('KANA_어중'), 모음코드,
  'const HAN_종성 = ' + (src.match(/const HAN_종성 = \[[^\]]*\];/) || [''])[0].replace('const HAN_종성 = ','') ,
  grab('kataHira'), grab('받침붙이기'), grab('kanaHan'), grab('jpRead')].join('\n');
let F;
try{ F = new Function(code + '\nreturn { kanaHan, jpRead, kataHira };')(); }
catch(e){ console.log('★ 실패: 읽기 함수를 못 꺼냈습니다 — ' + e.message); process.exit(1); }

// ── 국립국어원 대조표 그대로인가
const 표 = [
  ['さっぽろ',   '삿포로',   '촉음 ッ 은 받침 ㅅ'],
  ['とうきょう', '도쿄',     '장모음은 따로 안 적는다'],
  ['たなか',     '다나카',   'タ행·カ행은 어두에서 ㄷ·ㄱ, 어중에서 ㅌ·ㅋ'],
  ['かんもん',   '간몬',     '발음 ン 은 받침 ㄴ'],
  ['たかまつ',   '다카마쓰', 'ツ 는 「쓰」'],
  ['ひろしま',   '히로시마', ''],
  ['べっぷ',     '벳푸',     ''],
  ['みやじま',   '미야지마', ''],
  ['ヨットハーバー', '욧토하바', '가타카나도 같은 표로 읽는다'],
  ['サントピアマリーナ', '산토피아마리나', '']
];
표.forEach(([a, b, why]) => {
  const got = F.kanaHan(a);
  T('★★★ ' + a + ' → ' + b + (why ? ' (' + why + ')' : ''), got === b, got);
});

// ── 모르는 것은 지어내지 않는다
T('★★★ 한자만 있으면 안 읽는다 (읽는 법을 모른다)', F.kanaHan('高松港') === '', F.kanaHan('高松港'));
T('★★★ 한자와 가나가 섞이면 안 읽는다', F.kanaHan('ヤマハマリーナ浜名湖') === '', F.kanaHan('ヤマハマリーナ浜名湖'));
T('빈 값은 빈 값', F.kanaHan('') === '' && F.kanaHan(null) === '');

// ── 어디서 읽기를 가져오나 — 차례가 있다
T('★★★ ① 자료에 name:ko 가 있으면 그것을 쓴다',
  F.jpRead('高松港', { 'ko':'다카마쓰항' }) === '다카마쓰항');
T('★★★ ② 없으면 가나 읽기(name:ja-Hira)를 옮긴다',
  F.jpRead('高松港', { 'ja-Hira':'たかまつこう' }) === '다카마쓰코');
T('② name:ja_kana 도 본다',
  F.jpRead('高松港', { 'ja_kana':'タカマツコウ' }) === '다카마쓰코');
T('★★★ ③ 이름 자체가 가나뿐이면 그것을 읽는다',
  F.jpRead('サントピアマリーナ', null) === '산토피아마리나');
T('★★★ ④ 셋 다 없으면 빈 값 — 원문 그대로 낸다',
  F.jpRead('高松港', null) === '');

// ── 화면에 내는 규칙 (spotShowName)
const show = grab('spotShowName');
T('★★★ 원문을 절대 안 지운다 (괄호로 함께 낸다)', /읽기 \+ ' \(' \+ 원문 \+ '\)'/.test(show), show.slice(0,200));
T('★★★ 일본어 화면에서는 원문 그대로', /lang === 'ja'\) return 원문/.test(show));
T('★★★ 못 읽으면 원문만 낸다 (지어내지 않는다)', /if\(!읽기 \|\| 읽기 === 원문\) return 원문/.test(show));
T('뜻을 옮기지 않는다 (nameFor 에 안 태운다)', show.indexOf('nameFor(s.name)') < 0);

// ── 꾸러미가 준 이름들이 앱까지 온다
T('★★★ 꾸러미의 nm(여러 나라말 이름)이 앱 자료에 실린다', /nm:x\.nm \|\| null/.test(src));

console.log('합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
