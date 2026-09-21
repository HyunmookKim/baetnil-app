const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html','utf8');
let ok=0, bad=0;
const CASES = [
  ['[+ 기록] 에서 켜기를 뺀다', '  try{ trkStartSay(v.id); }catch(e){}\n', ''],
  ['예정 항해에서 켜기를 뺀다', '  try{ trkStartSay(it.id); }catch(e){}', '  ;'],
  ['다시 조용히 false 로 끝낸다',
   "  if(!bgGeo())      return '이 판에는 항적 부품이 안 들어 있습니다. 앱을 새로 받아 주세요.';",
   "  if(!bgGeo())      return false;"],
  ['까닭을 사람에게 안 알린다', '  if(why && !quiet) alert(t(why));', '  ;'],
  ['켜는 단추를 뗀다',
   `      <button class="mrbtn ok" onclick="trkStartSay('\${esc(String(it.id))}')">\${esc(t('항적 기록 시작'))}</button></div>\`;`,
   '      </div>`;'],
  ['멈추는 단추를 뗀다',
   `        <button class="minib warn" onclick="trkStopSay()">\${esc(t('멈추기'))}</button></div>`,
   '        </div>'],
  ['확인자료에서 수집요청인을 뺀다',
   "  row.who = (extra && extra.who) ? String(extra.who) : lgWho();\n", ''],
  ['확인자료에서 수집방법을 뺀다',
   "  if(extra && extra.how) row.how = String(extra.how);\n  else if(String(k || '') === '수집') row.how = '단말기 GPS';\n", ''],
  ['항적 묶음에서 수집주기를 뺀다',
   "    every: (typeof TRK_DIST === 'number' ? TRK_DIST : 50) + 'm 이동마다'\n", ''],
];
for(const [name, from, to] of CASES){
  const n = SRC.split(from).length - 1;
  if(n !== 1){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', ['trkontest.js','work.sab.html'], { encoding:'utf8' });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name); }
  else { bad++; console.log('★ 못 잡음 ← ' + name); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad?1:0);
