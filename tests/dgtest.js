// 배별 도면 이미지(2단계) 검증
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
function grabConst(src, name){
  const i = src.indexOf('const ' + name + ' = [');
  return src.slice(i, src.indexOf('\n];', i) + 3);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

eval(grabConst(src, 'LOCKER_SEED').replace('const LOCKER_SEED =', 'globalThis.LOCKER_SEED ='));
globalThis.FLOORPLAN = 'seed-plan'; globalThis.SIDEVIEW = 'seed-side';
globalThis.lockers = [];
globalThis.dgImgs = { plan:null, side:null };
// 4.85 — 도면이 여러 장이 되었다. 목록을 만드는 문(dgKeys)이 새로 생겼다.
globalThis.dgNames = {};
globalThis.DG_FIXED = ['plan','side'];
for(const f of ['dgFixed','dgKeys','dgName','dgBlank','dgNamesFromArr','dgNewKey']){
  const c = grab(src, f); if(c){ eval(c); globalThis[f] = eval(f); }
}

globalThis.dgRef  = { plan:null, side:null };
globalThis.dgPub  = { plan:false, side:false };
// 소스에서 DG_SEEDS 상수를 그대로 가져온다 (실물 검증)
globalThis.DG_BUILTIN = {
  first45:{ name:'베네토 퍼스트 45f5', type:'sail', plan:FLOORPLAN, side:SIDEVIEW },
  sail:   { name:'세일링 요트 (일반)', type:'sail', plan:'SAILP', side:'SAILS' }
};
for(const f of ['dgSeedUrl','dgSeedKeyOf']){ eval(grab(src,f)); globalThis[f]=eval(f); }
globalThis.dgSmall = { plan:null, side:null };   // 3.43 — 도면의 작은 사본
for(const f of ['dgArr','dgFromArr','seedDgIfNeeded']){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T = (name, cond)=>{ if(cond){pass++; console.log('통과: '+name);} else {fail++; console.log('★ 실패: '+name);} };

// 1. 칸이 전부 기본 칸이면 기본 도면 시드
lockers = JSON.parse(JSON.stringify(LOCKER_SEED));
dgImgs = { plan:null, side:null };
seedDgIfNeeded();
T('기본 71칸이면 기본 도면을 쓴다', dgImgs.plan==='seed-plan' && dgImgs.side==='seed-side');

// 2. 모르는 칸이 하나라도 있으면 시드하지 않는다 (남의 배)
lockers = [{id:'myboat_1', zone:'선수', label:'창고', x:1,y:1,w:5,h:5}];
dgImgs = { plan:null, side:null };
seedDgIfNeeded();
T('모르는 칸이면 남의 도면을 넣지 않는다', dgImgs.plan===null && dgImgs.side===null);

// 3. 칸이 없으면 시드하지 않는다 (새 배)
lockers = []; dgImgs = { plan:null, side:null };
seedDgIfNeeded();
T('빈 배에는 도면을 넣지 않는다', dgImgs.plan===null && dgImgs.side===null);

// 4. 이미 도면이 있으면 덮어쓰지 않는다
lockers = JSON.parse(JSON.stringify(LOCKER_SEED));
dgImgs = { plan:'내도면', side:null };
seedDgIfNeeded();
T('이미 있는 도면은 지키다', dgImgs.plan==='내도면' && dgImgs.side===null);

// 5. dgArr/dgFromArr 왕복
dgImgs = { plan:'A', side:'B' };
const back = dgFromArr(dgArr());
T('저장 배열 왕복이 같다', back.plan==='A' && back.side==='B');

// 6. 빈 값·이상한 값 방어
const junk = dgFromArr([{id:'plan'},{id:'weird',img:'x'},{id:'side',img:''},null,{img:'y'}]);
T('이상한 저장값은 버린다', junk.plan===null && junk.side===null);

// 7. plan 만 있는 배
dgImgs = { plan:'P', side:null };
const arr = dgArr();
T('없는 도면은 저장 문서를 만들지 않는다', arr.length===1 && arr[0].id==='plan');

// 8. 잠금 검사: uploadDg 코드에 unlocked 확인이 들어있다
const up = grab(src, 'uploadDg');
T('잠금 상태에서는 도면을 못 바꾼다', up.includes('unlocked'));

// 9. 리사이즈: Firestore 한도 고려가 들어있다
const rz = grab(src, 'resizeDg');
T('리사이즈에 용량 상한이 있다', rz.includes('700*1024') && rz.includes('toDataURL'));

// 10. 백업에 dgimgs 포함
T('백업 내보내기에 도면이 들어간다', grab(src,'backupData').includes('dgimgs'));

// 11. 복원에서 dgimgs 반영
const rd = grab(src,'restoreData');
T('복원이 백업의 도면을 되살린다', rd.includes('data.dgimgs') && rd.includes('seedDgIfNeeded'));

// 12. buildBoxes 가 도면을 지우지 않는다
const bb = grab(src,'buildBoxes');
T('buildBoxes 는 상자만 지운다', bb.includes("querySelectorAll('.box')") && !bb.includes("map.innerHTML = ''"));

// ===== 기본 도면 참조 저장 (백업 경량화) =====
// 기본 도면이면 base64 대신 ref:'seed' 만 저장한다
dgImgs = { plan: FLOORPLAN, side: SIDEVIEW };
const refArr = dgArr();
T('기본 도면은 참조로 저장한다',
  refArr.length===2 && refArr.every(d=>d.ref==='seed' && !d.img));

// 참조 복원: ref 만 있어도 기본 도면으로 되살아난다
const refBack = dgFromArr(refArr);
T('참조가 기본 도면으로 되살아난다', refBack.plan===FLOORPLAN && refBack.side===SIDEVIEW);

// 사용자 도면은 그대로 인라인
dgImgs = { plan: 'data:image/jpeg;base64,USER', side: null };
const uArr = dgArr();
T('사용자 도면은 그대로 넣는다',
  uArr.length===1 && uArr[0].img==='data:image/jpeg;base64,USER' && !uArr[0].ref);

// 옛 백업(기본 도면이 인라인으로 든 것)도 그대로 복원된다
const oldStyle = dgFromArr([{id:'plan', img:FLOORPLAN}]);
T('옛 인라인 백업도 복원된다', oldStyle.plan===FLOORPLAN);

// 모르는 참조는 버린다 (죽지 않는다)
const bad = dgFromArr([{id:'plan', ref:'unknown999'}]);
T('모르는 참조는 조용히 버린다', bad.plan===null && bad.side===null);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
