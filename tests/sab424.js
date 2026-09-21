const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html','utf8');
let ok=0, bad=0;
const CASES = [
  ['켜기 전 안내를 뺀다', '  if(!await trkGuide()) return false;        // 무엇을 누를지 먼저 알려 준다\n', ''],
  ['알림 허락 청하기를 뺀다', '  await trkAskNoti();                        // 알림이 막혀 있으면 기록이 시작도 안 된다\n', ''],
  ['안드로이드 팝업 설명을 뺀다',
   "       + t('(그 창에 「항상 허용」 은 안 나옵니다. 안드로이드가 안 보여 줍니다. 그래도 됩니다.)') + '\\n\\n'\n", ''],
  ['알림이 신호등이라는 말을 뺀다',
   "       + t('2. 「뱃일 — 항해 기록 중」 알림이 뜹니다. 그 알림이 떠 있는 동안 기록됩니다.') + '\\n'\n", ''],
  ['폰 갈래를 안 가른다', '  if(trkIsIOS()){', '  if(false){'],
  ['기록 중 표시를 뗀다', '      + trkBox(it)\n', ''],
  ['다시 「항상 허용이어야 한다」 고 잘못 말한다',
   "    if(confirm(t('위치를 받지 못해 항적을 기록할 수 없습니다.\\n\\n폰의 위치 기능이 켜져 있는지, 뱃일에 위치를 허용하셨는지 확인해 주세요.\\n\\n설정을 여시겠습니까?'))){",
   "    if(confirm(t('위치 권한을 「항상 허용」 으로 두셔야 합니다.'))){"],
];
for(const [name, from, to] of CASES){
  const n = SRC.split(from).length - 1;
  if(n !== 1){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', ['trkguidetest.js','work.sab.html'], { encoding:'utf8' });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name); }
  else { bad++; console.log('★ 못 잡음 ← ' + name); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad?1:0);
