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
T('★ 5.52 사장님 지시 — 코드 줄이기(R8)를 켜지 않는다 (「앞으론 절대 줄이지마」)', !r8);
T('R8 을 쓰면 캐퍼시터 주석 틀을 지킨다 (-keep @interface com.getcapacitor.** { *; })',
  !r8 || /-keep\s+@interface\s+com\.getcapacitor\.\*\*\s*\{\s*\*;\s*\}/.test(pro));
T('com.getcapacitor 전체를 지키는 넓은 규칙은 없다 (줄이기가 안 됨)', !/-keep\s+class\s+com\.getcapacitor\.\*\*/.test(pro));
console.log('합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
