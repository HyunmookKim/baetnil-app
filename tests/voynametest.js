// 항해 한 건을 뭐라고 부르는가 — 빈 화살표가 안 나오는가 (4.115)
//
// ★ 사장님 지적 (2026-09-08)
//   「마지막 항해는 근데 왜 항해 끝나는 내용은 빈칸이냐?」
//   오늘 화면의 「마지막 항해」 칸이 **「2026-09-04 →」** 로 떴다.
//   화살표만 있고 양쪽이 다 비어 있었다.
//   화살표는 「여기서 저기로」 라는 뜻이다. 가리킬 것이 없으면 아무 말도 안 하느니만 못하다 —
//   사람은 그것을 「빠졌다 · 고장 났다」 로 읽는다.
//
// ★ 왜 그랬나 — 사본이 셋이었다.
//   항해일지 목록에는 빈칸을 가리는 셈이 이미 있었는데 그 그리는 자리 **안에만** 있었다.
//   오늘 화면·휴지통·되돌리기는 저마다 따로 `from + ' → ' + to` 를 이어 붙였다.
//   사본은 반드시 어긋난다 (사장님이 정하신 것 3). 그 셋이 다 같은 흠을 지녔다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 260) : '')); } };
function grab(name){
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

// ── ① 문이 하나인가
const VN = grab('voyName');
T('①-1 ★★★ 항해 이름을 짓는 문이 있다 (voyName)', !!VN);
T('①-2 ★★ 문이 하나뿐이다', (src.match(/function voyName\(/g) || []).length === 1);

// ── ② 이름 짓기를 실제로 돌려 본다 — 여기가 이 검사의 핵심이다
let F = null;
try{
  F = new Function(`
    const t = s => ({'제목 없는 항해':'제목 없는 항해','출항':'출항'})[s] || s;
    const tsub = (s, o) => String(s).replace(/\\{(\\w+)\\}/g, (m, k) => o[k] == null ? m : o[k]);
    ${VN}
    return voyName;`)();
}catch(e){ console.log('★ 셈을 못 세웠다: ' + e.message); }
T('②-0 이름 짓기를 꺼내 돌릴 수 있다', !!F);

if(F){
  // ★★★ 사장님이 겪으신 그 기록 — 제목도 항구도 시각도 없다
  const 빈것 = F({ date:'2026-09-04' });
  T('②-1 ★★★ 아무것도 없는 항해에 빈 화살표가 안 나온다',
    빈것.indexOf('→') < 0, JSON.stringify(빈것));
  T('②-2 ★★★ 그래도 빈 글자를 돌려주지 않는다 (칸이 비면 사람은 고장으로 읽는다)',
    빈것.trim().length > 0, JSON.stringify(빈것));

  T('②-3 ★★ 둘 다 있으면 화살표로 잇는다',
    F({ from:'여수', to:'통영' }) === '여수 → 통영', F({ from:'여수', to:'통영' }));
  // 한쪽만 있을 때 화살표를 그리면 「여수 →」 — 어디로 갔는지 안 알려 준다
  T('②-4 ★★★ 출발만 있으면 화살표를 안 그린다',
    F({ from:'여수' }).indexOf('→') < 0, F({ from:'여수' }));
  T('②-5 ★★ 그때도 어디였는지는 남는다', /여수/.test(F({ from:'여수' })), F({ from:'여수' }));
  T('②-6 ★★★ 도착만 있어도 화살표를 안 그린다',
    F({ to:'통영' }).indexOf('→') < 0, F({ to:'통영' }));
  T('②-7 ★★ 그때도 어디였는지는 남는다', /통영/.test(F({ to:'통영' })), F({ to:'통영' }));

  T('②-8 ★ 제목이 있으면 제목이 먼저다',
    F({ title:'제주 나들이', from:'여수', to:'통영' }) === '제주 나들이');
  T('②-9 ★ 빈칸만 적은 제목은 제목으로 안 친다',
    F({ title:'   ', from:'여수', to:'통영' }) === '여수 → 통영');

  // 저절로 만들어진 항해는 항구가 비고 시각만 있다
  T('②-10 ★★ 시각이 다르면 시각으로 잇는다',
    F({ timeOut:'06:00', timeIn:'11:30' }) === '06:00 → 11:30');
  T('②-11 ★★★ 출·입항 시각이 같으면 화살표를 안 그린다 (「04:53 → 04:53」 은 아무 뜻이 없다)',
    F({ timeOut:'04:53', timeIn:'04:53' }).indexOf('→') < 0, F({ timeOut:'04:53', timeIn:'04:53' }));
  T('②-12 ★ 출항 시각만 있으면 그것을 쓴다',
    /04:53/.test(F({ timeOut:'04:53' })), F({ timeOut:'04:53' }));
  T('②-13 ★ null 을 줘도 안 터진다', F(null) === '' && F(undefined) === '');
}

// ── ③ 이름을 쓰는 곳이 다 그 문을 지나는가 (사본이 다시 생기면 안 된다)
const HOME = grab('renderHome') || grab('renderToday') || src;
T('③-1 ★★★ 오늘 화면의 「마지막 항해」 가 그 문을 쓴다',
  /마지막 항해[\s\S]{0,220}voyName\(v\)/.test(src),
  (src.match(/[^\n]*마지막 항해[^\n]*\n[^\n]*/) || [''])[0]);
T('③-2 ★★★ 오늘 화면이 from → to 를 손으로 잇지 않는다',
  !/\$\{esc\(v\.from\|\|''\)\} → \$\{esc\(v\.to\|\|''\)\}/.test(src));
T('③-3 ★★ 항해일지 목록도 그 문을 쓴다',
  /const vTitle = v => esc\(voyName\(v\)\)/.test(src));
T('③-4 ★★ 휴지통 이름도 그 문을 쓴다', /row==='voyage' \? voyName\(it\)/.test(src));
T('③-5 ★★ 되돌리기 이름도 그 문을 쓴다', /e\.kind==='voyage'\? voyName\(d\)/.test(src));

// ★ 앞으로 또 손으로 잇는 자리가 생기면 여기서 잡는다
const 손으로이은곳 = (src.match(/\(it\.from\|\|''\)\s*\+\s*' → '|\(d\.from\|\|''\)\s*\+\s*' → '|v\.from\|\|''\)\} → /g) || []);
T('③-6 ★★★ 어디에서도 from → to 를 손으로 잇지 않는다',
  손으로이은곳.length === 0, 손으로이은곳.join(' | '));

// ── ④ 새 낱말이 세 말에 다 있는가
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
['{p} 출발', '{p} 도착', '제목 없는 항해'].forEach(w => {
  ['en','ru','ja'].forEach(L => {
    T('④ ' + L + ' 사전에 「' + w + '」 이 있다', !!I[L][w], w);
    if(I[L][w]) T('④ ' + L + ' 「' + w + '」 에 한국어가 안 남았다', !/[가-힣]/.test(I[L][w]), I[L][w]);
  });
});
['{p} 출발', '{p} 도착'].forEach(w => {
  ['en','ru','ja'].forEach(L => {
    T('④ ' + L + ' 「' + w + '」 이 자리표를 지킨다', String(I[L][w] || '').indexOf('{p}') >= 0, I[L][w]);
  });
});

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
