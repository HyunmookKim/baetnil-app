// 선종별 기본 도면 검증
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

// 실물 대신 짧은 표시값으로 갈아끼워 검사한다
globalThis.DG_BUILTIN = {
  first45:{ name:'베네토 퍼스트 45f5', type:'sail', plan:'FP', side:'SV' },
  sail:   { name:'세일링 요트 (일반)', type:'sail', plan:'SAILP', side:'SAILS' },
  power:  { name:'모터보트 (일반)',   type:'power', plan:'POWP', side:'POWS' },
  fishing:{ name:'낚시·유어선 (일반)', type:'fishing', plan:'FISHP', side:'FISHS' }
};
globalThis.dgImgs = { plan:null, side:null };
// 4.85 — 도면이 여러 장이 되었다. 목록을 만드는 문(dgKeys)이 새로 생겼다.
globalThis.dgNames = {};
globalThis.DG_FIXED = ['plan','side'];
for(const f of ['dgFixed','dgKeys','dgName','dgBlank','dgNamesFromArr','dgNewKey']){
  const c = grab(src, f); if(c){ eval(c); globalThis[f] = eval(f); }
}

globalThis.dgRef  = { plan:null, side:null };
globalThis.dgPub  = { plan:false, side:false };

const need = ['dgSeedUrl','dgSeedKeyOf','dgArr','dgFromArr'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
globalThis.dgSmall = { plan:null, side:null };   // 3.43 — 도면의 작은 사본
for(const f of need){ eval(grab(src,f)); globalThis[f]=eval(f); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// 1. 기본 도면을 이름으로 찾는다
T('세일링 기본 평면도를 찾는다', dgSeedUrl('plan','sail')==='SAILP');
T('모터보트 기본 측면도를 찾는다', dgSeedUrl('side','power')==='POWS');
T('없는 이름은 null', dgSeedUrl('plan','없는배')===null);

// 2. 그림에서 이름을 되찾는다
T('그림으로 이름을 되찾는다', dgSeedKeyOf('plan','FISHP')==='fishing');
T('내장이 아닌 그림은 이름이 없다', dgSeedKeyOf('plan','data:image/jpeg;base64,USER')===null);

// 3. 저장할 때 번호만 들어간다 (용량 절감)
dgImgs = { plan:'SAILP', side:null };
const a = dgArr();
T('세일링 기본 도면은 이름만 저장한다', a.length===1 && a[0].ref==='seed:sail' && !a[0].img);
T('아주 가볍다', JSON.stringify(a).length < 120);

// 4. 퍼스트45 는 옛 표기를 그대로 쓴다 (옛 백업 호환)
dgImgs = { plan:'FP', side:'SV' };
const b = dgArr();
T('퍼스트45 는 옛 표기 seed 를 쓴다', b.every(d=>d.ref==='seed'));

// 5. 되살아난다
T('옛 표기 seed 가 퍼스트45 로 되살아난다',
  dgFromArr([{id:'plan',ref:'seed'}]).plan==='FP');
T('선종별 기본 도면이 되살아난다',
  dgFromArr([{id:'plan',ref:'seed:power'},{id:'side',ref:'seed:power'}]).plan==='POWP'
  && dgFromArr([{id:'side',ref:'seed:power'}]).side==='POWS');
T('모르는 기본 도면 이름은 버린다',
  dgFromArr([{id:'plan',ref:'seed:없는배'}]).plan===null);

// 6. 사용자 도면은 영향 없다
dgImgs = { plan:'data:image/jpeg;base64,USER', side:null };
dgRef  = { plan:null, side:null };
T('사용자 도면은 그림째 저장된다', dgArr()[0].img==='data:image/jpeg;base64,USER');

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
