// 배 삭제·추가 검증 — 지운 배의 기록이 남거나, 남은 배가 엉키면 안 된다
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

globalThis.boats = [];
globalThis.currentBoatId = null;
globalThis.unlocked = true;
globalThis.window = {};
globalThis.purged = [];
globalThis.localStorage = { removeItem(k){ purged.push('ls:'+k); }, getItem(){ return null; }, setItem(){} };
globalThis.idbDel = async k => { purged.push('idb:'+k); };
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.lastConfirm = [];
globalThis.answers = [];
globalThis.confirm = m => { globalThis.lastConfirm.push(m); return globalThis.answers.shift(); };
globalThis.prompt = () => globalThis.promptAnswer;
globalThis.promptAnswer = '';

// 4.132 에서 canDelBoat 가 boatOwnedBy 로 갈라졌다 — 도우미도 같이 떼어 와야 부른다
const need = ['boatKeys','delBoatData','canDelBoat','boatOwnedBy'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
{ const m = src.match(/const BOAT_DATA = \[[^\]]*\];/); if(m) eval(m[0].replace('const BOAT_DATA','globalThis.BOAT_DATA')); }
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f).replace(/^(async )?function /, (a,b)=> (b||'')+'function ')); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// 1. 지워야 할 저장 칸 목록에 빠진 것이 없어야 한다
const keys = boatKeys('b7');
const must = ['all','trash','maint','repair','voyage','fuel','runs','contacts',
              'vdocs','checkt','mrtrash','lockers','shapes','posts','dgimgs'];
const missKeys = must.filter(m => !keys.some(k => k === m + '@b7'));
T('모든 기록 저장 칸을 지운다 (빠진 것 없음)', missKeys.length===0);
T('다른 배 것은 안 건드린다', keys.every(k => k.endsWith('@b7')));

// 2. 실제로 지우는지
(async () => {
  purged = [];
  await delBoatData('b7');
  const idbCount = purged.filter(x=>x.startsWith('idb:')).length;
  T('기기 저장소에서 지운다', idbCount >= must.length);
  T('체크리스트 진행 상태도 지운다', purged.some(x=>/check2_b7/.test(x)));

  // 3. 마지막 한 척은 함부로 못 지운다? — 지울 수 있어야 하되 경고한다
  boats = [{id:'b1', name:'현묵호', members:{u1:'owner'}}];
  window.__user = { uid:'u1' };
  T('선주는 지울 수 있다', canDelBoat(boats[0])===true);

  // 4. 남의 배(구성원으로 초대된 것)는 못 지운다
  boats = [{id:'b2', name:'남의배', members:{u9:'owner', u1:'admin'}}];
  T('선주가 아니면 못 지운다', canDelBoat(boats[0])===false);

  // 5. 로그인 안 한 로컬 전용 배는 지울 수 있다
  window.__user = null;
  boats = [{id:'b3', name:'로컬배', members:{}}];
  T('로컬 전용 배는 지울 수 있다', canDelBoat(boats[0])===true);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  if(fail) process.exit(1);
})();
