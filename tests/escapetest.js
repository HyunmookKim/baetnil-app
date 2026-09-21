// 4.100 — 시작한 것에서 빠져나올 길이 반드시 있어야 한다
//
// ★ 사장님 말씀
//   「합칩 누르니까 아래 저거 뜨더니 사라지지도 않네」
//   「이동 시키려다가 하기 싫으면 취소할 수 있도록 해놔야 할 거 아니야」
//   「편집중에서 보기 전용으로 바꾸면 하던 수정이 자동으로 취소되야되는거 아니냐?」
//   「어플 처음부터 다시 확인해」
//
// ★ 셋 다 **같은 흠**이다 — 「켜는 길은 있는데 끄는 길이 없다」.
//   그래서 한 자리만 고치지 않고 앱 안의 **모든 모드**를 세워 놓고 셋을 다 본다:
//     ① 끄는 함수가 있는가
//     ② 그 모드일 때 화면에 **눌러서 끄는 단추**가 있는가
//     ③ 「보기 전용」 으로 바꿀 때 그 모드가 꺼지는가
//   (사장님이 정하신 것 1번 — 「올리기를 만들면 내리기를 같이 만든다」)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '/home/claude/work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; } else { bad++;
  console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 300) : '')); } };

function grab(name){
  const key = 'function ' + name + '(';
  let i = src.indexOf(key);
  if(i < 0){ i = src.indexOf('async function ' + name + '('); if(i < 0) return ''; }
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}

// ── 앱이 들어가는 모드들. 하나하나 실제로 있는 것이다.
//   켬:   그 모드를 켜는 함수
//   끔:   빠져나오는 함수
//   단추: 그 모드일 때 화면에 뜨는, 눌러서 끄는 자리 (문자열로 찾는다)
const MODES = [
  { 이름: '물품 이동 (도면에서 고르기)', 켬: 'mvFromMap',   끔: 'mvCancel',
    단추: ["onclick=\"mvCancel()\"", 'onclick="mvCancel()"'] },
  { 이름: '같은 이름 합치기',            켬: 'toggleMerge', 끔: 'toggleMerge',
    단추: ['onclick="toggleMerge(${it.id})"'] },
  { 이름: '여러 개 고르기',              켬: 'pickStart',   끔: 'pickEnd',
    단추: ['onclick="pickEnd()"'] },
  { 이름: '물품 수정',                   켬: 'startEdit',   끔: 'cancelEdit',
    단추: ['onclick="cancelEdit()"'] },
  { 이름: '칸 그리기',                   켬: 'toggleLkEdit', 끔: 'toggleLkEdit',
    단추: ['onclick="toggleLkEdit()"'] },
  { 이름: '도면에 핀 찍기',              켬: 'pinStart',    끔: 'pinCancel',
    단추: ['onclick="pinCancel()"'] },
  { 이름: '도면 그리기 (정비·수리)',     켬: 'toggleMrDraw', 끔: 'mrDrawOff',
    단추: ['onclick="toggleMrDraw()"'] }
];

MODES.forEach(m => {
  const off = grab(m.끔);
  T(m.이름 + ' — 빠져나오는 함수(' + m.끔 + ')가 있다', off.length > 0);
  T('★★★ ' + m.이름 + ' — 화면에 눌러서 빠져나올 단추가 있다',
    m.단추.some(s => src.indexOf(s) >= 0), m.단추[0]);
});

// ── 「보기 전용」 으로 바꾸면 하던 것이 다 취소되는가
const lock = grab('toggleLock');
T('보기 전용 스위치가 있다', lock.length > 0);
['mvCancel', 'mergeId', 'moveId', 'pickEnd', 'cancelEdit', 'toggleLkEdit', 'mrDrawOff', 'pinCancel']
  .forEach(f => T('★★★ 보기 전용으로 바꾸면 ' + f + ' 로 정리한다',
    new RegExp(f.replace(/[$]/g, '\\$')).test(lock), lock));
T('★★ 보기 전용일 때만 정리한다 (편집으로 켤 때는 안 건드린다)',
  /if\(!unlocked\)\s*\{/.test(lock), lock);

// ── 켰다 껐다 하는 것이 화면을 다시 그리는가 — 안 그리면 띠가 남는다
//   실제로 「합침」 띠가 이래서 안 사라졌다.
['mvCancel', 'pickEnd', 'toggleMerge'].forEach(f =>
  T('★★ ' + f + ' 가 화면을 다시 그린다',
    /render(PanelItems|List)\(\)|repaintNow\(\)/.test(grab(f)), grab(f)));

// ── 합칠 것이 없으면 아예 안 연다 (열어 놓고 닫는 길을 안 주면 갇힌다)
const mg = grab('toggleMerge');
T('★★★ 합칠 것이 없으면 칸을 안 연다', /if\(!same\.length\)/.test(mg), mg);
T('★★ 합칠 것이 없다고 말해 준다', /tell\(/.test(mg), mg);

// ── 같은 일을 하는 길이 둘이면 안 된다 (한 곳만 고쳐진다 — 사장님이 정하신 것 3)
T('★★★ 물품 이동 길이 하나다 (옛 toggleMove 가 없다)',
  !/function toggleMove\(/.test(src));
T('★★★ 「수정」이 두 곳에 있지 않다 (더 보기에서 뺐다)',
  (src.match(/name: *t\('수정'\), *v: *'edit'/g) || []).length === 0);

console.log('escapetest: ' + ok + ' 통과, ' + bad + ' 실패');
if(bad) process.exitCode = 1;
