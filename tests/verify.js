// deepCopy 수정 검증
// 같은 테스트를 수정 전 파일과 수정 후 파일에 각각 돌린다.
// 수정 전에서 반드시 실패해야 이 테스트가 진짜 버그를 잡는다는 뜻이다.
const fs = require('fs');

function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) throw new Error('함수 없음: ' + name);
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}

function run(file){
  const src = fs.readFileSync(file, 'utf8');
  const out = {};

  // deepCopy 가 선언되어 있으면 불러온다 (수정 전 파일에는 없다)
  try{ eval(grab(src, 'deepCopy')); globalThis.deepCopy = deepCopy; }
  catch(e){ delete globalThis.deepCopy; }

  // --- 테스트 1: 체크리스트 항목 삭제가 실제로 동작하는가 ---
  globalThis.unlocked = true;
  globalThis.checkt  = [{ id:'c01', label:'기상·풍속·파고 확인' }];
  globalThis.mrTrash = [];
  globalThis.confirm = () => true;
  globalThis.saveMR = () => {};
  globalThis.renderCheck = () => {};
  globalThis.updateTrashTab = () => {};
  eval(grab(src, 'delCheckItem'));
  try{
    delCheckItem('c01');
    out.t1 = (checkt.length === 0 && mrTrash.length === 1) ? '통과' : '실패(삭제 안 됨)';
  }catch(e){ out.t1 = '실패(' + e.message + ')'; }

  // --- 테스트 2: 정비 기본 항목 생성이 동작하는가 ---
  globalThis.MAINT_COMMON  = [{ id:'m1', name:'엔진오일', months:6 }];
  globalThis.MAINT_BY_TYPE = { sail: [{ id:'m2', name:'아연 아노드', months:12 }] };
  globalThis.curBoat = () => ({ type:'sail' });
  eval(grab(src, 'boatType'));
  globalThis.boatType = boatType;
  eval(grab(src, 'maintDefaults'));
  try{
    const a = maintDefaults();
    a[0].name = '변조됨';                 // 사본을 고쳐도
    const b = maintDefaults();            // 원본은 그대로여야 한다
    out.t2 = (a.length === 2 && b[0].name === '엔진오일') ? '통과' : '실패(원본 오염)';
  }catch(e){ out.t2 = '실패(' + e.message + ')'; }

  return out;
}

for(const f of ['base.html', 'fixed.html']){
  const label = f === 'base.html' ? '수정 전' : '수정 후';
  const r = run(f);
  console.log(`[${label}] 항목 삭제: ${r.t1} / 정비 기본값: ${r.t2}`);
}
