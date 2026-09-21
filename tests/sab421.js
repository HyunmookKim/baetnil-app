// 4.21 안전장치 부수기
const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html', 'utf8');
let ok=0, bad=0;
const CASES = [
  ['앱에서도 바깥 브라우저로 나가게 한다', '        if(isNative()){', '        if(false){'],
  ['부품이 없을 때 조용히 옛길로 떨어뜨린다',
   "          if(!fa) throw new Error(t('이 판에서는 구글 로그인이 안 됩니다.\\n이메일로 로그인해 주세요.'));",
   "          if(!fa){ const p=new GoogleAuthProvider(); await signInWithPopup(fauth,p); return; }"],
  ['자격을 못 받아도 그냥 넘어가게 한다',
   "          if(!idt) throw new Error(t('구글 로그인을 끝내지 못했습니다.\\n이메일로 로그인해 주세요.'));",
   "          if(!idt) return;"],
  ['자격을 파이어베이스에 안 넘긴다',
   '          await signInWithCredential(fauth, GoogleAuthProvider.credential(idt));',
   '          ;'],
];
for(const [name, from, to] of CASES){
  const n = SRC.split(from).length - 1;
  if(n !== 1){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', ['authtest.js', 'work.sab.html'], { encoding:'utf8' });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name); }
  else { bad++; console.log('★ 못 잡음 ← ' + name); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad?1:0);
