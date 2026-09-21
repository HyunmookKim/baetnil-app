const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html','utf8');
let ok=0, bad=0;
const CASES = [
  ['앱 뒤로가기에 손을 안 붙인다',
   "    a.addListener('backButton', ()=>{ try{ navNativeBack(); }catch(_){} });", "    ;"],
  ['시작할 때 붙이는 것을 뺀다',
   "  const go = ()=>{ if(navAttachNative() || ++n > 20) return; setTimeout(go, 250); };\n  go();", "  ;"],
  ['한 번만 눌러도 바로 닫는다',
   "  if(now - navExitAt < 2000){ navExitApp(); return; }\n  navExitAt = now;\n  navSayExit();",
   "  navExitApp();"],
  ['물릴 것이 있어도 그냥 닫는다', '  if(navDoBack()) return;', '  ;'],
  ['탭에서 오늘로 못 돌아가게 한다',
   "  if(k === 'tab'){ switchTab('home'); navPush('home'); return true; }", "  ;"],
  ['떠 있는 화면을 안 닫는다',
   "  if(k === 'screen'){ closeTopScreen(); return true; }", "  ;"],
];
for(const [name, from, to] of CASES){
  const n = SRC.split(from).length - 1;
  if(n !== 1){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', ['backapp.js','work.sab.html'], { encoding:'utf8' });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name); }
  else { bad++; console.log('★ 못 잡음 ← ' + name); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad?1:0);
