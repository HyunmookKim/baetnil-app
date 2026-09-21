// 4.22 안전장치 부수기
const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html','utf8');
let ok=0, bad=0;
const CASES = [
  ['배가 와도 안 벗긴다', '  if(curBoat()) boatGuardOff();\n', ''],
  ['다시 옛날처럼 속살을 통째로 지운다',
   "  if(!(hit[0] in needBoatSaved)) needBoatSaved[hit[0]] = el.innerHTML;\n  el.innerHTML = needBoatCard(hit[1]);",
   "  el.innerHTML = needBoatCard(hit[1]);"],
  ['벗길 때 속살을 안 넣는다',
   '    if(el) el.innerHTML = needBoatSaved[id];',
   '    if(el) ;'],
  ['적재표 지도를 도로 안 보이게 한다',
   '    if(x) x.style.display = needBoatHid[id];',
   '    if(x) ;'],
  ['한 번 쓰고 기억을 안 버린다 (두 번째부터 옛 화면이 덮인다)',
   '    delete needBoatSaved[id];', '    ;'],
];
for(const [name, from, to] of CASES){
  const n = SRC.split(from).length - 1;
  if(n !== 1){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', ['latelive.js','work.sab.html'], { encoding:'utf8' });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name); }
  else { bad++; console.log('★ 못 잡음 ← ' + name); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad?1:0);
