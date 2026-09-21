// 앱 도면 창고 + 공개 여부 검증
const fs = require('fs');
function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

globalThis.window = { __user:null, __dglib:null };
globalThis.dgImgs = { plan:null, side:null };
// 4.85 — 도면이 여러 장이 되었다. 목록을 만드는 문(dgKeys)이 새로 생겼다.
globalThis.dgNames = {};
globalThis.DG_FIXED = ['plan','side'];
for(const f of ['dgFixed','dgKeys','dgName','dgBlank','dgNamesFromArr','dgNewKey']){
  const c = grab(src, f); if(c){ eval(c); globalThis[f] = eval(f); }
}

globalThis.dgRef  = { plan:null, side:null };
globalThis.dgPub  = { plan:false, side:false };
globalThis.alert = m => { globalThis.lastAlert = m; };
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.FLOORPLAN = 'seed-plan';
globalThis.SIDEVIEW  = 'seed-side';
globalThis.DG_BUILTIN = {
  first45:{ name:'베네토 퍼스트 45f5', type:'sail', plan:FLOORPLAN, side:SIDEVIEW },
  sail:   { name:'세일링 요트 (일반)', type:'sail', plan:'SAILP', side:'SAILS' }
};
for(const f of ['dgSeedUrl','dgSeedKeyOf']){ eval(grab(src,f)); globalThis[f]=eval(f); }

const need = ['dgArr','dgFromArr','dgRefFromArr','dgPubFromArr','dgCanPublish','dgLibRec','dgLibId'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
globalThis.dgSmall = { plan:null, side:null };   // 3.43 — 도면의 작은 사본
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T = (name, cond)=>{ if(cond){pass++; console.log('통과: '+name);} else {fail++; console.log('★ 실패: '+name);} };

// 1. 앱 창고에 올라간 도면은 백업에 번호만 들어간다
dgImgs = { plan:'data:image/jpeg;base64,'+'A'.repeat(500000), side:null };
dgRef  = { plan:'dgabc123', side:null };
dgPub  = { plan:false, side:false };
const a1 = dgArr();
T('창고 도면은 번호만 저장한다', a1.length===1 && a1[0].ref==='lib:dgabc123' && !a1[0].img);
T('백업이 가벼워진다', JSON.stringify(a1).length < 200);
T('번호가 왕복해도 남는다', dgRefFromArr(a1).plan==='dgabc123');
T('번호만으로는 그림이 안 나온다 (따로 받아온다)', dgFromArr(a1).plan===null);

// 2. 기본 도면은 그대로 참조 저장
dgImgs = { plan:FLOORPLAN, side:SIDEVIEW };
dgRef  = { plan:null, side:null };
const a2 = dgArr();
T('기본 도면 참조 저장이 살아 있다', a2.length===2 && a2.every(d=>d.ref==='seed'));
T('기본 도면은 바로 되살아난다',
  dgFromArr(a2).plan===FLOORPLAN && dgFromArr(a2).side===SIDEVIEW);

// 3. 아직 창고에 못 올린 도면은 그림째로 남긴다 (자료를 잃지 않는다)
dgImgs = { plan:'data:image/jpeg;base64,OFFLINE', side:null };
dgRef  = { plan:null, side:null };
const a3 = dgArr();
T('창고에 못 올렸으면 그림째 남긴다', a3[0].img==='data:image/jpeg;base64,OFFLINE' && !a3[0].ref);
T('그림째 남은 것은 그대로 복원된다', dgFromArr(a3).plan==='data:image/jpeg;base64,OFFLINE');

// 4. 공개 여부는 참/거짓 하나로 따로 관리한다
dgImgs = { plan:'x', side:null };
dgRef  = { plan:'dg1', side:null };
dgPub  = { plan:true, side:false };
const a4 = dgArr();
T('공개 표시가 저장된다', a4[0].pub===true);
T('공개 표시가 왕복해도 남는다', dgPubFromArr(a4).plan===true);
dgPub = { plan:false, side:false };
T('공개 안 하면 표시가 빠진다', !('pub' in dgArr()[0]));
T('이상한 공개 값은 거짓으로 본다', dgPubFromArr([{id:'plan', pub:'네'}]).plan===false);

// 5. 이상한 번호는 버린다
T('모르는 참조는 버린다', dgFromArr([{id:'plan', ref:'뭔가이상함'}]).plan===null);
T('빈 번호는 버린다', dgRefFromArr([{id:'plan', ref:'lib:'}]).plan===null);
T('없는 값에도 죽지 않는다', dgRefFromArr(null).plan===null && dgFromArr(null).plan===null);

// 6. 공개 정보에 개인 기록이 절대 들어가지 않는다
window.__user = { uid:'u1', name:'홍길동' }; window.__dglib = { publish(){} };
const rec = dgLibRec('plan', { id:'b1', name:'현묵호', maker:'Beneteau', model:'First 45f5' }, '베네토 퍼스트 45f5 평면도');
T('공개 정보에 물품·기록 필드가 없다',
  !Object.keys(rec).some(k => /item|maint|repair|voyage|fuel|contact|doc|run|photo|note/i.test(k)));
T('공개 정보에 그림이 직접 들어가지 않는다', !('img' in rec));
T('공개 정보에 배 이름이 들어가지 않는다', !JSON.stringify(rec).includes('현묵호'));
T('공개 정보에 제목·제조사·모델이 들어간다',
  rec.title==='베네토 퍼스트 45f5 평면도' && rec.maker==='Beneteau' && rec.model==='First 45f5');
T('평면·측면 구분이 남는다', rec.kind==='plan' && dgLibRec('side',null,'x').kind==='side');

// 7. 로그인 상태 판정
window.__user = null;
T('로그인 안 하면 창고에 못 올린다', dgCanPublish()===false);
window.__user = { uid:'u1' }; window.__dglib = null;
T('클라우드가 없으면 못 올린다', dgCanPublish()===false);
window.__dglib = { publish(){} };
T('로그인하면 올릴 수 있다', dgCanPublish()===true);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
