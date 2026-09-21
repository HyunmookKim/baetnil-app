// 신고·차단 검증
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
const fs = require('fs');
function grab(src, name){
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
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

globalThis.window = { __user:{ uid:'u1', name:'현묵' } };
globalThis.alerts = [];
globalThis.alert = m => globalThis.alerts.push(m);
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.confirm = ()=>true;
globalThis.newId = (()=>{ let n=0; return ()=>'g'+(++n); })();
globalThis.store = {};
// ★ 5.0 — 개인 칸은 계정마다 담는다(pGet/pSet). 검사에서도 그 문을 흉내 낸다.
globalThis.me = null;
globalThis.pKey = k => (globalThis.me && globalThis.me.uid) ? (k + '_' + globalThis.me.uid) : k;
globalThis.pGet = k => { const v = globalThis.store[globalThis.pKey(k)]; return v === undefined ? null : v; };
globalThis.pSet = (k,v) => { globalThis.store[globalThis.pKey(k)] = String(v); };
globalThis.pDel = k => { delete globalThis.store[globalThis.pKey(k)]; };
globalThis.localStorage = {
  getItem(k){ return (k in globalThis.store) ? globalThis.store[k] : null; },
  setItem(k,v){ globalThis.store[k] = String(v); }
};
{ const m = src.match(/const REPORT_REASONS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const REPORT_REASONS','globalThis.REPORT_REASONS')); }

const need = ['hiddenBoats','saveHidden','hideBoat','unhideBoat','isHidden','filterHidden','reportBody'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const reset = ()=>{ globalThis.store = {}; globalThis.alerts = []; };

// 신고 사유
T('신고 사유가 여러 가지', Array.isArray(REPORT_REASONS) && REPORT_REASONS.length>=3);
T('사유마다 이름이 있다', REPORT_REASONS.every(r=>r.v && r.name));

// 차단
reset();
T('처음에는 아무것도 안 숨김', hiddenBoats().length===0);
hideBoat('b9');
T('배를 숨긴다', isHidden('b9')===true);
T('목록에 남는다', hiddenBoats().includes('b9'));
T('기기에 기억된다', !!globalThis.store['bt_hidden']);
hideBoat('b9');
T('두 번 숨겨도 하나만', hiddenBoats().length===1);
unhideBoat('b9');
T('다시 보이게 한다', isHidden('b9')===false && hiddenBoats().length===0);
T('없는 것을 풀어도 죽지 않는다', unhideBoat('없음')===undefined || true);

// 목록에서 걸러내기
reset();
hideBoat('b2');
const list = [{id:'b1',name:'가'},{id:'b2',name:'나'},{id:'b3',name:'다'}];
const shown = filterHidden(list);
T('숨긴 배는 목록에서 빠진다', shown.length===2 && !shown.some(x=>x.id==='b2'));
T('나머지는 그대로', shown.map(x=>x.id).join(',')==='b1,b3');
T('빈 목록도 죽지 않는다', filterHidden(null).length===0);

// 신고 내용
reset();
const r = reportBody('boat', 'b9', 'spam', '광고만 올립니다');
T('신고 내용이 만들어진다', !!r && r.kind==='boat' && r.target==='b9');
T('사유가 담긴다', r.reason==='spam');
T('설명이 담긴다', r.note==='광고만 올립니다');
T('신고한 사람이 남는다', r.by==='u1');
T('날짜가 남는다', !!r.ts);
T('모르는 사유는 거절', reportBody('boat','b9','엉뚱','x')===null);
T('대상이 없으면 거절', reportBody('boat','','spam','x')===null);
window.__user = null;
T('로그인 안 하면 신고 못 한다', reportBody('boat','b9','spam','x')===null);
window.__user = { uid:'u1', name:'현묵' };

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
