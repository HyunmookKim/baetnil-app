// 5.51 — 스토어 빌드(R8)에서 캐퍼시터 주석 틀이 지워져 항적을 켜면 앱이 꺼졌다 (2026-10-14, 사장님 폰 · 에뮬레이터 #128)
//   ionic-team/capacitor #8589 · Capawesome: R8 full mode 에서는 `-keep @interface com.getcapacitor.** { *; }` 가 있어야 한다.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };
const pro = fs.readFileSync(path.join(root, 'android/app/proguard-rules.pro'), 'utf8')
  .split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
const gradle = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
const r8 = /minifyEnabled\s+true/.test(gradle);
// 5.59 (2026-11-23) — 구글 2027-02 DEX 25% 요구로 R8 다시 켬. 사장님: 「켜는데 모든 문제가 없을때만 올려라」.
T('★ 5.59 — 스토어 빌드는 R8 을 켠다 (구글 DEX 최적화 25%)', r8);
T('R8 은 release 에만 (debug 에 켜지 않는다)', !/debug\s*\{[^}]*minifyEnabled\s+true/.test(gradle));
T('넓게 지켜 줄이기를 막는 규칙이 없다 (-keep class ** · -dontobfuscate · -dontoptimize · -dontshrink)',
  !/-keep\s+class\s+\*\*\s*\{/.test(pro) && !/-dontobfuscate|-dontoptimize|-dontshrink/.test(pro));
T('R8 을 쓰면 캐퍼시터 주석 틀을 지킨다 (-keep @interface com.getcapacitor.** { *; })',
  !r8 || /-keep\s+@interface\s+com\.getcapacitor\.\*\*\s*\{\s*\*;\s*\}/.test(pro));
T('com.getcapacitor 전체를 지키는 넓은 규칙은 없다 (줄이기가 안 됨)', !/-keep\s+class\s+com\.getcapacitor\.\*\*/.test(pro));
console.log('합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
