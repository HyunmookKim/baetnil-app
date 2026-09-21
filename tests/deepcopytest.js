// deepCopy 미정의 재현 테스트
// 실제 index.html 에서 delCheckItem 원문을 추출해 모의 환경에서 실행한다.
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

function grab(name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) throw new Error('함수를 찾지 못함: ' + name);
  let d = 0, j = src.indexOf('{', i);
  const start = j;
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}

// 모의 환경
globalThis.unlocked = true;
globalThis.checkt = [{id:'c01', label:'기상·풍속·파고 확인'}];
globalThis.mrTrash = [];
globalThis.confirm = () => true;
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm(x));
globalThis.saveMR = () => {};
globalThis.renderCheck = () => {};
globalThis.updateTrashTab = () => {};

eval(grab('delCheckItem'));

// ★ 4.38 부터 delCheckItem 은 사람에게 물어보고 답을 기다린다. 그래서 여기서도 기다린다.
globalThis.deepCopy = x => JSON.parse(JSON.stringify(x));
let result;
(async ()=>{
try{
  await delCheckItem('c01');
  result = { threw:false, trashLen:mrTrash.length, checktLen:checkt.length };
}catch(e){
  result = { threw:true, name:e.constructor.name, msg:e.message };
}

console.log('결과:', JSON.stringify(result, null, 2));
console.log('삭제 후 checkt 길이:', checkt.length, '(1이면 삭제 실패)');
console.log('휴지통 길이:', mrTrash.length, '(0이면 휴지통에도 안 들어감)');
})();
