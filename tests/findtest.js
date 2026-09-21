// 찾기 — 조각 내기와 걸러 내기가 제대로 도나
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) i = s.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const js  = src.slice(src.indexOf('<script>') + 8, src.indexOf('</script>'));
const mod = src.slice(src.indexOf('<script type="module">'));
let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

const F = new Function('const KW_MAX=120;' + grab(js,'kwNorm') + grab(js,'kwOf') +
  grab(js,'kwQuery') + grab(js,'kwHit') + grab(js,'voyHit') + grab(js,'postHit') +
  ' return {kwOf,kwQuery,kwHit,voyHit,postHit};')();

// ── 1. 조각 내기
{
  const k = F.kwOf('엔진오일 교환 방법', '김선장');
  T('낱말 통째로 담는다', k.includes('엔진오일') && k.includes('김선장'));
  // ★ 한국어는 조사와 띄어쓰기가 사람마다 달라 낱말만으로는 못 찾는다
  T('두 글자 조각도 담는다 (가운데 글자로 찾기)', k.includes('진오') && k.includes('오일'));
  T('올린 사람 이름도 담는다', k.includes('선장'));
  const e = F.kwOf('Engine oil change', 'Kim');
  T('영어도 조각 낸다', e.includes('engine') && e.includes('gi'));
  const r = F.kwOf('Замена масла', 'Ким');
  T('러시아어도 조각 낸다', r.includes('замена') && r.includes('ма'));
  T('대소문자를 가리지 않는다', F.kwOf('ENGINE').includes('engine'));
  // ★ 본문은 안 담기로 했다 — 담으면 조각이 수백 개가 되어 문서가 커진다
  T('조각 수에 상한이 있다', F.kwOf('가'.repeat(400)).length <= 120);
  T('빈 것도 안 무너진다', F.kwOf('', null, undefined).length === 0);
}
// ── 2. 찾는 말 조각
{
  T('찾는 말도 같은 조각으로', F.kwQuery('오일').includes('오일'));
  T('서버에 물어보는 조각은 열 개까지', F.kwQuery('가나다라마바사아자차카타파하').length <= 10);
  T('한 글자도 찾을 수 있다', F.kwQuery('배').length > 0);
}
// ── 3. ★ 조각은 헐겁게 걸린다 — 앱에서 한 번 더 걸러야 한다
{
  const o = { title:'엔진오일 교환 방법', byName:'김선장' };
  T('제목으로 찾힌다', F.kwHit(o, '오일'));
  T('올린 사람으로 찾힌다', F.kwHit(o, '선장'));
  T('없는 말은 안 찾힌다', !F.kwHit(o, '돛'));
  T('두 낱말은 둘 다 있어야 한다', F.kwHit(o, '엔진 교환') && !F.kwHit(o, '엔진 돛'));
  // 본문은 안 찾는다 (넣지 않기로 했다)
  T('본문은 안 찾는다', !F.kwHit({ title:'제목', byName:'나', body:'엔진오일' }, '엔진오일'));
}
// ── 4. 항해일지 — 폰 안에서 찾는다 (날짜도)
{
  const v = { title:'거문도 1박 2일', date:'2026-08-11', from:'여수', to:'거문도', note:'' };
  T('제목으로 찾힌다', F.voyHit(v, '거문도'));
  T('항로로 찾힌다', F.voyHit(v, '여수'));
  T('날짜로 찾힌다 (연-월)', F.voyHit(v, '2026-08'));
  T('날짜로 찾힌다 (월-일)', F.voyHit(v, '08-11'));
  T('없는 말은 안 찾힌다', !F.voyHit(v, '나로도'));
  T('빈 말이면 다 보인다', F.voyHit(v, ''));
}
// ── 5. 배 게시판
{
  const p = { title:'계류줄 교체합니다', byName:'박기관' };
  T('제목으로 찾힌다', F.postHit(p, '계류'));
  T('올린 사람으로 찾힌다', F.postHit(p, '기관'));
  T('없는 말은 안 찾힌다', !F.postHit(p, '엔진'));
}
// ── 6. 서버에 물어보는 길
{
  const seg = mod.slice(mod.indexOf('window.__talk'), mod.indexOf('window.__talk') + 1800);
  T('글판에 찾기 창구가 있다', /async find\(/.test(seg));
  T('담아 둔 조각으로 물어본다', /array-contains-any/.test(seg));
  T('한 번에 받아오는 양을 끊는다', /limit\(n \|\| 60\)/.test(seg));
  // ★ 조각이 없으면 통째로 받아오면 안 된다 — 돈이 샌다
  T('찾는 말이 없으면 아예 안 물어본다', /if\(!grams \|\| !grams\.length\) return \[\]/.test(seg));
}
// ── 7. 글을 올릴 때 조각을 담는가
{
  const tb = grab(js, 'talkBody') || '';
  T('새 글에 조각을 담는다', /kw: kwOf\(/.test(tb));
  T('글을 고칠 때도 조각을 다시 만든다', /kw: kwOf\(String\(v\.title/.test(js));
  T('정박지에도 담는다', /body\.kw = kwOf\(body\.name/.test(js));
  T('장터에도 담는다', /body\.kw = kwOf\(body\.title/.test(js));
}
// ── 8. 중간 기록에 위치가 저절로 들어가는가
{
  const la = grab(js, 'logAdd') || '';
  T('중간 기록을 만들면 날씨를 잡는다', /wxCapture\('log:'/.test(la));
  // ★ 항해 중에는 손이 바빠서 위치 단추를 놓친다
  T('중간 기록을 만들면 위치도 잡는다', /posHere\('log:'/.test(la));
  // quiet=true 면 권한을 안 준 사람에게 창을 안 띄운다. 뒤에 뒤처리(done)가 붙어도 상관없다.
  T('위치를 못 잡아도 조용히 넘어간다', /posHere\('log:' \+ lid, it\.id, true[,)]/.test(la));
  const av = grab(js, 'addVoyage') || '';
  T('출항할 때도 위치를 잡는다', /posHere\('wxOut'/.test(av));
}
console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail?1:0);
