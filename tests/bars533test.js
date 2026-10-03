// 5.33 — 플레이 콘솔이 알려 준 두 가지 (2026-10-03, 사장님: 「이건 또 머냐?」 — 출시 대시보드 화면)
//   ① 「DEX 코드 최적화가 기준점 미만입니다 · 난독화(3%) · 해결 기한 2027년 2월」 → release 에서 R8 을 켠다
//   ② 「앱에서 더 넓은 화면용으로 지원 중단된 API 또는 파라미터를 사용합니다」(Window.get/setStatusBarColor,
//      시작 위치 @capacitor/status-bar) → 안드로이드에서만 그 부품을 빼고 앱 부품 BaetnilBars 로 시계 줄 글자 색을 바꾼다
// 이 검사는 설정이 그대로 있는지(누가 되돌리거나, 새 부품을 넣고 안드로이드 목록에 빠뜨리지 않았는지)를 본다.
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const rd = p => fs.readFileSync(path.join(R, p), 'utf8');

// ② 시계 줄
const cfg = JSON.parse(rd('capacitor.config.json'));
const deps = Object.keys(JSON.parse(rd('package.json')).dependencies || {});
const inc = (cfg.android && cfg.android.includePlugins) || null;
const want = deps.filter(k => !['@capacitor/android', '@capacitor/cli', '@capacitor/core', '@capacitor/ios', '@capacitor/status-bar'].includes(k)).sort();
T('안드로이드 부품 목록이 있다 (android.includePlugins)', Array.isArray(inc), inc);
T('안드로이드에서는 @capacitor/status-bar 를 뺀다', Array.isArray(inc) && !inc.includes('@capacitor/status-bar'), inc);
T('안드로이드 목록에 나머지 부품이 하나도 빠지지 않았다 (새 부품을 넣으면 여기에도 넣어야 한다)',
  Array.isArray(inc) && JSON.stringify(inc.slice().sort()) === JSON.stringify(want), { inc, want });
T('아이폰은 status-bar 부품을 그대로 쓴다 (전체 includePlugins 없음 · ios 목록 없음)',
  deps.includes('@capacitor/status-bar') && !cfg.includePlugins && !(cfg.ios && cfg.ios.includePlugins));

const code = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // 설명 글은 빼고 코드만
const B = code(rd('android/app/src/main/java/kr/baetnil/app/BaetnilBars.java'));
const M = code(rd('android/app/src/main/java/kr/baetnil/app/MainActivity.java'));
T('BaetnilBars — 캐퍼시터 8 SystemBars 와 같은 길(setAppearanceLightStatusBars)', /setAppearanceLightStatusBars\(light\)/.test(B));
// ★ 5.34 — 14 이하도 화면 끝까지 그린다(EdgeToEdge.enable). 시계 줄 바탕색을 아예 안 칠한다 — 지원 중단 API 를 안 부른다.
T('BaetnilBars — 지원 중단된 setStatusBarColor 를 부르지 않는다 (5.34)', !/\.setStatusBarColor\(/.test(B));
T('BaetnilBars — 아래 내비게이션 줄 아이콘 색도 같이 맞춘다 (5.34)', /setAppearanceLightNavigationBars\(light\)/.test(B));
T('BaetnilBars — getStatusBarColor 를 부르지 않는다', !/getStatusBarColor/.test(B) && !/getStatusBarColor/.test(M));
T('MainActivity — BaetnilBars 를 super.onCreate 앞에서 등록한다',
  M.indexOf('registerPlugin(BaetnilBars.class);') > 0 && M.indexOf('registerPlugin(BaetnilBars.class);') < M.indexOf('super.onCreate(savedInstanceState);'));
const H = rd('www/index.html');
const sb = H.slice(H.indexOf('function statusBar(){'), H.indexOf('function applyAll(){'));
T('앱 화면 — 안드로이드는 BaetnilBars 를 먼저 쓰고 status-bar 로 넘어가지 않는다',
  /Plugins\.BaetnilBars/.test(sb) && sb.indexOf('BaetnilBars') < sb.indexOf('Plugins.StatusBar') && /BB\.setStyle\([^)]*\)\.catch\(\(\)=>\{\}\);\s*return;/.test(sb));
T('앱 화면 — 흰 화면이면 짙은 글자(light:true), 바탕색은 테마와 같다',
  /light: theme === 'light'/.test(sb) && /'#FFFFFF' : theme === 'black' \? '#000000' : '#122A44'/.test(sb));

// ① R8
const G = rd('android/app/build.gradle');
const rel = G.slice(G.indexOf('buildTypes {'), G.indexOf('repositories {'));
T('release 에서 R8 을 켠다 (minifyEnabled true)', /release \{[\s\S]*?minifyEnabled true/.test(rel));
T('최적화 규칙 파일(proguard-android-optimize.txt)을 쓴다', /proguard-android-optimize\.txt/.test(rel) && !/'proguard-android\.txt'/.test(rel));
T('자원 줄이기는 끈다 (알림 아이콘을 이름으로 찾는 부품)', /shrinkResources false/.test(rel));
const P = rd('android/app/proguard-rules.pro').split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
T('넓게 지키는 규칙이 없다 (있으면 난독화 비율이 안 오른다)',
  !/-keep class \*\*|-keep class com\.getcapacitor\.\*\*|-dontobfuscate|-dontoptimize|-dontshrink/.test(P), P);
T('오류 보고에 줄 번호가 남는다', /-keepattributes SourceFile,LineNumberTable/.test(P));

console.log(`\n${ok} 통과 · ${bad} 실패`);
process.exit(bad ? 1 : 0);
