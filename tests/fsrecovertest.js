// 5.14 — 파이어베이스 자료방이 「INTERNAL ASSERTION FAILED」 로 멈추면 스스로 다시 붙는다
//   (구글 이슈 #8250 — Capacitor 앱. 12.13.0 에서 원인 하나를 고침 → 12.19.0 으로 올림. 그래도 나면 다시 불러온다)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x !== undefined ? ' — ' + x : '')); } };
const cut = name => { const i = src.indexOf(name); if(i < 0) return ''; let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } } return ''; };

T('★ 파이어베이스가 12.13 이상이다 (ca9 경쟁을 고친 판)', /12\.19\.0/.test(src));
T('★★ 오류줄(showErr)이 멈춤을 알아본다', /function showErr\(msg\)\{\n  try\{ if\(fsDead\(msg\)\) fsRecover\(\); \}catch\(_\)\{\}/.test(src));
T('★★ 파이어베이스 자신의 기록(onLog)에서도 듣는다', /onLog\(x => \{ try\{ if\(fsDead\(/.test(src));

function 새(opts){
  const store = {}; let 다시 = 0, 싱크 = '';
  const timers = [];
  const env = `
    const FS_RELOAD_KEY = 'bt_fsreload'; let fsRecovering = false;
    ${cut('function fsDead(')}
    ${cut('function fsRecover(')}
    return { fsDead, fsRecover };`;
  const doc = { activeElement: opts.입력중 ? { tagName: 'INPUT' } : { tagName: 'BODY' }, visibilityState: 'visible',
                getElementById: () => ({}) };
  const api = new Function('localStorage', 'document', 'getComputedStyle', 'setSync', 'setTimeout', 'location', 'trkKeep', env)(
    { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = String(v); } },
    doc, () => ({ display: opts.창열림 ? 'flex' : 'none' }), m => { 싱크 = m; },
    (f, ms) => { timers.push(f); }, { reload: () => { 다시++; } }, () => {});
  if(opts.막다시) store.bt_fsreload = String(Date.now() - 30000);
  return { api, 돌리기: (n = 5) => { for(let i = 0; i < n && timers.length; i++) timers.shift()(); }, 다시: () => 다시, 싱크: () => 싱크, doc };
}
{
  const a = 새({}); 
  T('멈춤 글을 알아본다 (10.x · 12.x 둘 다)', a.api.fsDead('FIRESTORE (10.12.2) INTERNAL ASSERTION FAILED: Unexpected state') && a.api.fsDead('FIRESTORE (12.19.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: ca9)'));
  T('보통 오류는 멈춤으로 안 본다', !a.api.fsDead('permission-denied') && !a.api.fsDead(''));
  a.api.fsRecover(); a.돌리기();
  T('★★★ 한가하면 다시 불러와 새로 붙는다', a.다시() === 1);
  T('그동안 「서버에 다시 연결하는 중…」 이라고 밝힌다', /다시 연결하는 중/.test(a.싱크()));
  a.api.fsRecover(); a.돌리기();
  T('★ 여러 번 불러도 한 번만 다시 불러온다', a.다시() === 1);
}
{
  const b = 새({ 입력중: true }); b.api.fsRecover(); b.돌리기(4);
  T('★★★ 사람이 입력 중이면 기다린다 (쓰던 것이 날아가지 않게)', b.다시() === 0);
  b.doc.activeElement = { tagName: 'BODY' }; b.돌리기(2);
  T('입력을 끝내면 그때 다시 불러온다', b.다시() === 1);
}
{
  const c = 새({ 창열림: true }); c.api.fsRecover(); c.돌리기(4);
  T('★★ 입력 창(formOv)이 열려 있으면 기다린다', c.다시() === 0);
}
{
  const d = 새({ 막다시: true }); d.api.fsRecover(); d.돌리기();
  T('★★★ 2분 안에 또 나면 되풀이하지 않는다 (끝없이 다시 불러오지 않게)', d.다시() === 0);
  T('그때는 껐다 켜 달라고 말한다', /껐다 켜/.test(d.싱크()));
}
for(const w of ['서버에 다시 연결하는 중…', '서버 연결이 끊겼습니다 · 앱을 껐다 켜 주세요']){
  const n = (src.match(new RegExp("'" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':", 'g')) || []).length;
  T(`「${w.slice(0, 14)}…」 세 나라말에 있다 — ${n}`, n === 3);
}
console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
