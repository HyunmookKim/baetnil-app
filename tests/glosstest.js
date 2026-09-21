// 한 가지 뜻에 한 가지 말을 쓰는가 (4.111)
//
// ★ 왜 이 검사가 있나 — 사장님이 물으셨다.
//   「일본어만 문제가 아니라 러시아어와 영어도 다 이상하게 됐다는 뜻인 것 같은데.
//    너 인공지능이라 번역은 잘하는 걸로 아는데 왜 번역이 우리의 문제가 되지?」
//
//   맞는 말씀이었다. 열어 보니 세 말이 다 같은 병을 앓고 있었다.
//   **낱말 하나하나는 잘 옮겼는데, 같은 것을 화면마다 다른 이름으로 부르고 있었다.**
//
//     · 영어  — 「정비수첩」 이 Maintenance log · service log · service note 셋,
//               「정기점검」 이 Service · Scheduled check · Check · Scheduled maintenance 넷,
//               「도면」 이 Plan 과 Drawing 둘, 「휴지통」 이 Trash 와 bin 둘.
//     · 러시아어 — 「등급」 이 이름표만 Уровень 이고 나머지 스물세 곳이 роль,
//               「도면」 이 План 과 чертёж 둘, 「정비수첩」 이 Журнал ТО·Журнал обслуживания 둘.
//     · 일본어 — 「운영자」 가 管理者 와 運営者 둘, 「휴지통」 이 ごみ箱 와 ゴミ箱 둘.
//
//   ★ 왜 이렇게 됐나 — 삼천 개를 여러 뭉치로 나눠 옮겼기 때문이다.
//     뭉치마다 그 자리에서 제일 자연스러운 말을 골랐고, 뭉치끼리 맞춰 보지 않았다.
//     한 줄만 보면 다 맞는 말이다. 그런데 앱을 쓰는 사람은 화면을 옮겨 다니며 본다.
//     이름이 바뀌면 **같은 기능인 줄 모른다.** 그것이 「번역이 이상하다」 로 나타난다.
//
// ★ 그래서 이 검사는 **뼈대 낱말의 이름을 못 박는다.**
//   여기 적힌 말이 그 기능의 이름이고, 그 이름이 들어가는 자리는 다 같은 말을 써야 한다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 300) : '')); } };

function dicts(){
  const i = src.indexOf('const I18N = {');
  let d = 0, j = src.indexOf('{', i), k;
  for(k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0){ k++; break; } }
  }
  const g = {};
  (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g);
  return g.I18N;
}
const I = dicts();
T('①-1 사전 셋을 다 읽었다',
  Object.keys(I.en).length > 2000 && Object.keys(I.ru).length > 2000 && Object.keys(I.ja).length > 2000,
  [Object.keys(I.en).length, Object.keys(I.ru).length, Object.keys(I.ja).length].join('/'));

// ── 뼈대 낱말 — 그 기능의 이름. 이 말이 들어간 자리는 다 같은 말을 써야 한다.
//    ★ 러시아어는 낱말이 굽는다(роль/роли/ролью). 그래서 **굽지 않는 앞머리**로 잰다.
const GLOSS = {
  // ★ 러시아말은 낱말이 굽는다(журнал → журналов). 여러 도막을 주면 다 들어 있어야 한다.
  '정비수첩':   { en:'maintenance log', ru:['журнал','работ'], ja:'整備手帳' },
  '정기점검':   { en:'scheduled check', ru:'регламент',    ja:'定期点検' },
  '도면':       { en:'plan',            ru:'план',         ja:'図面' },
  '수납칸':     { en:'locker',          ru:'рундук',       ja:'収納スペース' },
  '휴지통':     { en:'trash',           ru:'корзин',       ja:'ゴミ箱' },
  '등급':       { en:'rank',            ru:'рол',          ja:'役割' },
  '운영자':     { en:'admin',           ru:'администратор',ja:'管理者' },
  '항해일지':   { en:'logbook',         ru:'журнал',       ja:'航海日誌' },
  '정박지':     { en:'berth',           ru:'стоян',       ja:'係留地' },
  '적재표':     { en:'stowage',         ru:'хранени',      ja:'搭載品' },
  '체크리스트': { en:'checklist',        ru:'чек-лист',     ja:'チェックリスト' },
  '제품 리뷰':  { en:'product review',   ru:'отзыв',        ja:'パーツレビュー' },
  '물때':       { en:'tide',            ru:'прилив',       ja:'潮' }
};
// 그 낱말이 들어간 **짧은 열쇠**(메뉴·단추·이름표)만 본다. 긴 안내문은 말이 풀어져도 된다.
for(const L of ['en','ru','ja']){
  const D = I[L];
  const 어긋남 = [];
  for(const w of Object.keys(GLOSS)){
    const want = [].concat(GLOSS[w][L]).map(x => x.toLowerCase());
    for(const k of Object.keys(D)){
      if(!k.includes(w)) continue;
      if(k.length > 18) continue;               // 긴 문장은 뺀다
      const v = String(D[k] || '').toLowerCase();
      if(!v) continue;
      if(want.every(x => v.includes(x))) continue;
      어긋남.push(k + ' → ' + D[k] + '  (있어야 할 말: ' + want.join(' + ') + ')');
    }
  }
  T('②-' + L + ' ★★ 뼈대 낱말을 화면마다 같은 말로 부른다 (' + 어긋남.length + '곳)',
    어긋남.length === 0, 어긋남.slice(0, 6).join(' | '));
}

// ── 값이 한국어 그대로 남은 자리가 없어야 한다 (「뱃일」 은 앱 이름이라 뺀다)
{
  const KOR = /[가-힣]/;
  for(const L of ['en','ru','ja']){
    const 남음 = Object.keys(I[L]).filter(k => KOR.test(String(I[L][k]).split('뱃일').join('')));
    T('③-' + L + ' ★ 옮기다 만 자리가 없다', 남음.length === 0,
      남음.slice(0, 5).map(k => k + '→' + I[L][k]).join(' | '));
  }
}

// ── 세 말이 같은 열쇠를 가져야 한다. 하나만 빠지면 그 말 쓰는 사람만 한국어를 본다.
{
  const all = new Set([...Object.keys(I.en), ...Object.keys(I.ru), ...Object.keys(I.ja)]);
  for(const L of ['en','ru','ja']){
    // ★ 값이 일부러 빈 것도 있다 ('년' 은 영어에 붙는 말이 없다). 열쇠가 있으면 된 것이다.
    const miss = [...all].filter(k => !(k in I[L]));
    T('④-' + L + ' ★ 빠진 낱말이 없다', miss.length === 0, miss.slice(0, 6).join(' | '));
  }
}

// ── ⑤ 긴 안내문에도 **딴 이름**이 섞이면 안 된다
//
//   ★ 짧은 이름표만 맞춰 놓으니 긴 글에서 다시 갈라졌다.
//     영어에서 도면이 이름표는 Plan 인데 안내문 스물몇 줄은 전부 drawing 이었다.
//     사람은 이름표만 보고 사는 게 아니라 안내문을 읽는다.
//   ★ 그래서 여기서는 「이 낱말이 들어간 열쇠의 번역문에 **이 말이 나오면 안 된다**」 를 잰다.
//     긴 글은 낱말을 아예 안 쓰고 넘어가도 된다. 다만 **딴 이름을 쓰면 안 된다.**
{
  const 금지 = {
    en: { '도면':['drawing','diagram'], '휴지통':['the bin',' bin '], '운영자':['operator'],
          '정비수첩':['service note','service log'], '항해일지':['passage log'],
          '정기점검':['scheduled maintenance'], '정박지':['mooring','anchorage'] },
    ru: { '도면':['чертёж','чертеж','схем'], '운영자':['оператор'], '정비수첩':['журнал ТО'] },
    ja: { '운영자':['運営者'], '휴지통':['ごみ箱'], '정비수첩':['整備ノート'] }
  };
  // ★ 한국말 자체가 두 낱말을 나란히 쓰는 자리는 딴 이름이 아니다.
  //   「정박지나 계류장」 은 두 가지를 가리키는 말이라, 영어도 두 낱말이라야 한다 —
  //   둘 다 berth 로 쓰면 「Mark your berth or berth.」 라는 말이 안 되는 문장이 된다.
  const 두낱말 = { '정박지': ['계류장'] };
  for(const L of ['en','ru','ja']){
    const D = I[L], 걸린것 = [];
    for(const w of Object.keys(금지[L])){
      for(const k of Object.keys(D)){
        if(!k.includes(w)) continue;
        if((두낱말[w] || []).some(z => k.includes(z))) continue;
        const v = String(D[k] || '').toLowerCase();
        for(const 나쁜말 of 금지[L][w]){
          if(v.includes(나쁜말.toLowerCase())) 걸린것.push(w + ': ' + k.slice(0, 26) + ' → ' + D[k].slice(0, 60));
        }
      }
    }
    T('⑤-' + L + ' ★★ 긴 안내문에도 딴 이름이 안 섞였다 (' + 걸린것.length + '곳)',
      걸린것.length === 0, 걸린것.slice(0, 4).join(' | '));
  }
}

// ── ⑥ 앱 이름은 옮기지 않는다
//
//   ★ 일본어에서 「뱃일」 이 「船仕事」 로 옮겨져 있었다. 이름은 낱말이 아니다.
//     러시아어는 한술 더 떠서 Baetnil · «Пэннiль» · Пэннiль 세 가지였고,
//     그 Пэннiль 의 i 는 러시아 글자가 아니라 우크라이나 글자였다.
{
  // ★ 4.113 — 일본어도 Baetnil 이다 (사장님이 정하셨다, 2026-09-08).
  //   여태 일본어에서만 「뱃일」 한글 그대로 나갔다. 일본 사람은 그 글자를 읽지 못한다.
  //   특히 「スマホの設定 → アプリ → 뱃일 → 通知」 는 폰에서 찾아야 하는 이름이라
  //   읽을 수 없으면 안내가 안내 노릇을 못 한다. 이름은 하나로 두고, 첫 화면에서만
  //   「Baetnil（ベンニル）」 로 발음을 한 번 알려 준다.
  const 이름 = { en:'Baetnil', ru:'Baetnil', ja:'Baetnil' };
  // ★ ベンニル 은 첫 화면의 발음 안내 한 곳에만 쓴다 — 이름 자리에 쓰면 안 된다.
  const 나쁜이름 = /船仕事|Пэнн|Бэтн|Пённ/;
  for(const L of ['en','ru','ja']){
    const 걸린것 = Object.keys(I[L]).filter(k => 나쁜이름.test(String(I[L][k])));
    T('⑥-' + L + ' ★★ 앱 이름을 옮기거나 다르게 적은 자리가 없다',
      걸린것.length === 0, 걸린것.slice(0, 4).map(k => k + '→' + I[L][k]).join(' | '));
  }
  T('⑥-이름 ★ 앱 이름 자체는 그대로다',
    I.en['뱃일'] === 이름.en && I.ru['뱃일'] === 이름.ru && I.ja['뱃일'] === 이름.ja,
    [I.en['뱃일'], I.ru['뱃일'], I.ja['뱃일']].join(' / '));
}

// ── ⑦ 자리표시({n}·{name})와 태그(<b>)가 그대로 살아 있는가
//
//   ★ 옮기다 {n} 을 빠뜨리면 화면에 숫자가 안 나온다. 「{n}일 남음」 이 「일 남음」 이 된다.
//     태그를 빠뜨리면 굵은 글씨가 통째로 사라지거나, 짝이 안 맞아 화면이 깨진다.
//   ★ {josa} 는 한국어 조사(은/는)다. 다른 말에는 조사가 없으니 없는 것이 맞다.
{
  const 자리 = s => [...String(s).matchAll(/\{[a-zA-Z0-9_]+\}/g)]
      .map(m => m[0]).filter(x => x !== '{josa}').sort().join(',');
  const 태그 = s => [...String(s).matchAll(/<\/?[a-zA-Z][^>]*>/g)]
      .map(m => m[0].replace(/\s+/g, ' ')).sort().join(',');
  for(const L of ['en','ru','ja']){
    const 빠짐 = [], 태그깨짐 = [];
    for(const k of Object.keys(I[L])){
      const v = I[L][k];
      if(자리(k) !== 자리(v)) 빠짐.push(k.slice(0, 30) + ' → ' + String(v).slice(0, 40));
      if(태그(k) !== 태그(v)) 태그깨짐.push(k.slice(0, 30) + ' → ' + String(v).slice(0, 40));
    }
    T('⑦-' + L + ' ★★★ 자리표시({n}·{name})를 빠뜨린 데가 없다', 빠짐.length === 0, 빠짐.slice(0, 4).join(' | '));
    T('⑦-' + L + '-태그 ★★ 태그(<b> 같은 것)가 그대로다', 태그깨짐.length === 0, 태그깨짐.slice(0, 4).join(' | '));
  }
}

// ── ⑧ 줄바꿈이 글자로 새어 나가지 않는가
//
//   ★★ 일본어 사전 **아흔 곳**에 줄바꿈이 `\\n` (역슬래시+n) 으로 들어가 있었다.
//      그래서 일본 사람이 보는 알림창마다 「削除しますか？\\n\\n元に戻せません。」 처럼
//      **글자 그대로 \\n 이 찍혀** 있었다. 옮긴 말이 아무리 좋아도 이러면 앱이 고장 나 보인다.
//   ★ 열쇠에 `\\n` 이 든 줄도 셋 있었다. 부르는 자리는 진짜 줄바꿈이라 **영영 안 맞는 죽은 줄**이었다.
{
  for(const L of ['en','ru','ja']){
    const 새는것 = Object.keys(I[L]).filter(k => /\\n/.test(String(I[L][k])));
    T('⑧-' + L + ' ★★★ 줄바꿈이 글자(\\n)로 새어 나간 데가 없다',
      새는것.length === 0, 새는것.slice(0, 4).map(k => k.slice(0, 24) + '→' + String(I[L][k]).slice(0, 40)).join(' | '));
    const 죽은열쇠 = Object.keys(I[L]).filter(k => /\\n/.test(k));
    T('⑧-' + L + '-열쇠 ★★ 열쇠에 글자 \\n 이 든 죽은 줄이 없다',
      죽은열쇠.length === 0, 죽은열쇠.slice(0, 3).join(' | '));
  }
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
