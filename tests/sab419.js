// 4.19 안전장치 부수기 — 검사가 진짜 잡는지 확인한다.
const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html', 'utf8');
let ok = 0, bad = 0;

const CASES = [
  ['앱을 알아보는 눈을 뺀다 (다시 제 안에서 자료를 찾는다)',
   `    if(window.Capacitor && window.Capacitor.isNativePlatform
       && window.Capacitor.isNativePlatform()) return DATA_SITE;\n`, '',
   'applive.js'],
  ['localhost 예외를 뺀다',
   "    if(location.hostname === 'localhost') return DATA_SITE;\n", '',
   'apptest.js'],
  ['viewport-fit=cover 를 뺀다 (여백 값이 늘 0 이 된다)',
   ', viewport-fit=cover">', '">',
   'applive.js'],
  ['머리줄 여백을 뺀다',
   'header{padding-top:var(--sat)}\n', '',
   'applive.js'],
  ['오른쪽 화면 여백을 뺀다',
   '#panel{padding-top:calc(14px + var(--sat))}', '',
   'applive.js'],
  ['날씨가 다시 한 가지로만 말한다',
   `      <div>\${wxNoIn
        ? esc(t('현재 위치는 로그인하신 분에게만 받습니다.')) + '<br>'
          + esc(t('로그인하시거나, 지점을 직접 추가해 주세요.'))
        : esc(t('현재 위치를 가져오지 못했습니다.')) + '<br>'
          + esc(t('설정에서 위치 권한을 허용하시거나, 지점을 직접 추가해 주세요.'))}</div>`,
   `      <div>\${esc(t('현재 위치를 가져오지 못했습니다.'))}<br>\${esc(t('설정에서 위치 권한을 허용하시거나, 지점을 직접 추가해 주세요.'))}</div>`,
   'applive.js'],
  ['로그인 단추를 뗀다',
   `        \${wxNoIn
          ? \`<button class="mrbtn ok" onclick="openAccount()">\${esc(t('로그인'))}</button>\`
          : \`<button class="mrbtn" onclick="wxRetryGPS()">\${esc(t('현재 위치 다시 시도'))}</button>\`}`,
   `        <button class="mrbtn" onclick="wxRetryGPS()">\${esc(t('현재 위치 다시 시도'))}</button>`,
   'applive.js'],
];

for(const [name, from, to, test] of CASES){
  const n = SRC.split(from).length - 1;
  if(n !== 1){ console.log('※ 못 부숨(' + n + '군데): ' + name); bad++; continue; }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', [test, 'work.sab.html'],
                         { encoding:'utf8', env:Object.assign({}, process.env, {TZ:'Asia/Seoul'}) });
  if(r.status !== 0){ ok++; console.log('잡음  ← ' + name + '   (' + test + ')'); }
  else { bad++; console.log('★ 못 잡음 ← ' + name + '   (' + test + ')'); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad ? 1 : 0);
