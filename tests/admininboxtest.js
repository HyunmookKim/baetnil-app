// 4.98 — 운영자 접수함: 갈래 나누기 · 본문 접기 · 보던 자리 지키기
//
// ★ 사장님 지적 (2026-09-01)
//   ① 「확인함」 을 누를 때마다 화면이 맨 위로 튀어 오른다
//   ② 새 글과 확인한 것이 한 줄로 쭉 이어져 보기 힘들다
//
// ★ ①이 왜 사고인가 — 목록 열째 것을 처리하면 열 번 다 위로 올라간다.
//   스무 통이 쌓인 날에는 한 통 처리할 때마다 다시 찾아 내려가야 한다.
//   메일은 관공서에서도 온다. 처리하다 지쳐서 넘기면 그것이 진짜 사고다.
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
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0,220) : '')); } };

// ── 1. 보던 자리를 지키는 문이 하나다
{
  T('자리를 찍는 곳이 있다', !!grab(js, 'panelMark'));
  T('자리로 되돌리는 곳이 있다', !!grab(js, 'panelRestore'));
  T('문이 하나다 (panelMark 를 여러 벌 안 만든다)',
    (js.match(/function panelMark\(/g) || []).length === 1);
  const mk = grab(js, 'panelMark') || '', rs = grab(js, 'panelRestore') || '';
  T('화면이 스스로 구르는 자리를 본다 (창이 아니라)',
    /scrollTop/.test(mk) && /scrollTop/.test(rs) && !/window\.scroll/.test(rs), mk + rs);
  T('★ 글자가 놓인 뒤에 되돌린다', /requestAnimationFrame/.test(rs), rs);
  T('★ 한 번 쓰면 비운다 (다음 그림에서 엉뚱하게 안 튄다)',
    /panelKeepAt = null/.test(rs), rs);
  // ★★★ 그리는 곳이 되돌린다
  const oa = grab(js, 'openAdmin') || '';
  T('★★★ 운영자 화면을 그린 뒤에 되돌린다', /panelRestore\(\)/.test(oa), oa.slice(-260));
}
// ── 2. ★ 화면을 다시 그리는 손질마다 자리를 찍는다 (한 곳만 빠져도 그것만 튄다)
{
  const 손질 = ['supportDone','adminUnhide','adminDel','adminHideBoat','adminDelBoat'];
  손질.forEach(n=>{
    const f = grab(js, n);
    if(f === null) return;                       // 없는 이름은 건너뛴다
    T('★★ ' + n + ' 이 보던 자리를 찍는다', /panelMark\(\)/.test(f), f.slice(0,200));
  });
  // 이름을 몰라도 되게 — 「openAdmin 을 다시 부르는 곳」 을 전부 센다
  const 부름 = [...js.matchAll(/([\s\S]{280}?)\.then\(\(\)=>openAdmin\(\)\)/g)]
    .map(m => m[1]).filter(x => !/function openAdmin/.test(x));
  const 안찍음 = 부름.filter(x => !/panelMark\(\)/.test(x)).length;
  T('★★★ 다시 그리는 곳 ' + 부름.length + '군데가 모두 자리를 찍는다 — 안 찍는 곳 ' + 안찍음,
    부름.length > 0 && 안찍음 === 0);
}
// ── 3. 갈래를 바꿀 때는 맨 위에서 시작한다 (찍지 않는다)
{
  const f = grab(js, 'setAdminTab') || '';
  T('★ 갈래를 바꿀 때는 자리를 안 찍는다 (새 목록은 맨 위부터다)',
    !/panelMark\(\)/.test(f), f);
  const g = grab(js, 'setSupTab') || '';
  T('★ 접수함 갈래를 바꿀 때도 안 찍는다', !!g && !/panelMark\(\)/.test(g), g);
}
// ── 4. 접수함이 갈래로 나뉜다
{
  const f = grab(js, 'adminSupport') || '';
  T('갈래가 있다 (새 글 · 확인함 · 전체)',
    /chip\('new'/.test(f) && /chip\('done'/.test(f) && /chip\('all'/.test(f)
    && /setSupTab\(/.test(f), f.slice(0,400));
  T('★★★ 새 글 갈래에는 확인한 것이 안 섞인다',
    /supTab === 'new' \? !x\.done : !!x\.done/.test(f), (f.match(/\.filter\([^\n]*/) || [''])[0]);
  T('갈래마다 몇 건인지 보여 준다', /esc\(nm\)\}\$\{n != null/.test(f) || /' ' \+ n/.test(f), f.slice(0,400));
  T('★ 비었을 때 무엇이 비었는지 말해 준다',
    /새로 들어온 것이 없습니다/.test(f) && /확인한 것이 없습니다/.test(f), f.slice(0,600));
  T('★★ 본문을 접어 둔다 (메일은 2만 자까지 들어온다)',
    /supOpen\[s\.id\]/.test(f) && /slice\(0, 160\)/.test(f), f.slice(0,900));
  T('짧은 글은 접지 않는다 (접을 것도 없는데 단추만 생기면 성가시다)',
    /짧다/.test(f) && /length <= 160/.test(f));
  T('★ 메일에 답장할 길이 있다', /mailto:\$\{esc\(s\.email\)\}/.test(f), f.slice(-400));
  T('펼치기가 보던 자리를 지킨다', /supToggle[\s\S]{0,120}panelMark\(\)/.test(js));
}
// ── 5. 옛 자료·없는 값에도 안 터진다
{
  const f = grab(js, 'adminSupport') || '';
  T('본문이 없어도 안 터진다', /String\(s\.text \|\| ''\)/.test(f));
  T('메일 주소가 없으면 답장 단추를 안 만든다', /s\.email \? `<a class="tchip"/.test(f), f.slice(-300));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
