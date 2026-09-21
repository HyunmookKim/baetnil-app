// 앱으로 쌌을 때 — 웹에서는 안 나던 문제들.
// ★ 첫 안드로이드 앱을 폰에 깔아 보고 나온 것들이다.
//   ① 뉴스·한국 소식·물때가 통째로 비었다 — 자료 파일을 앱 안에서 찾고 있었다.
//   ② 위 시계·배터리 자리를 앱 화면이 덮었다 — 위쪽 여백이 없었다.
//   ③ 날씨가 '위치 권한을 허용하시거나' 라고 엉뚱한 소리를 했다 — 실은 로그인 문제였다.
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const S = fs.readFileSync(FILE, 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,180):''));} };

// ── ① 자료 파일 자리
const db = (S.match(/const DATA_BASE = [\s\S]{0,900}?\}\)\(\);/) || [''])[0];
T('자료 자리를 정하는 곳이 있다', db.length > 50);
// ★ 주석에도 localhost 라고 적혀 있어서 그냥 찾으면 주석이 걸린다 (부수기 검사가 잡았다).
//   실제로 판단하는 줄을 본다.
T('앱 주소(localhost)면 사이트에서 받는다',
  /location\.hostname === 'localhost'\s*\)?\s*return DATA_SITE/.test(db), db.slice(0,80));
T('캐퍼시터로 싼 것을 알아본다', /Capacitor/.test(db) && /isNativePlatform/.test(db));
T('file: 로 열었을 때도 사이트 주소를 쓴다', /file:/.test(db));
T('그래도 웹에서는 앱이 놓인 자리를 따라간다', /new URL\('\.\/', location\.href\)/.test(db));
['news.json','kr.json','tide.json'].forEach(f=>
  T(f + ' 을 그 자리에서 받는다', new RegExp("DATA_BASE\\s*\\+\\s*'" + f.replace('.','\\.')).test(S)));

// ── ② 위 시계·배터리 자리를 비켜 간다
T('viewport 에 viewport-fit=cover 가 있다',
  /<meta name="viewport"[^>]*viewport-fit=cover/.test(S),
  (S.match(/<meta name="viewport"[^>]*>/)||[''])[0]);
T('위쪽 여백 값을 한 곳에 정해 둔다',
  /--sat:\s*env\(safe-area-inset-top/.test(S));

// 덮이는 것은 머리줄만이 아니다 — 화면 가득 뜨는 것들도 다 비켜야 한다.
// ★ 한 곳에 모아 두었는지로 본다. 흩어 놓으면 새 화면을 만들 때 또 빠뜨린다.
const sat = (()=>{ const i = S.indexOf('--sat:'); return i < 0 ? '' : S.slice(i, i + 800); })();
['header','#drawer','#panel','#formOv','#dgPick'].forEach(sel=>
  T(sel + ' 도 비켜 간다', sat.indexOf(sel) >= 0 && /padding-top/.test(sat), sat.slice(0,120)));

// ── ③ 못 받은 까닭을 정확히 말한다
// ★ 앱 어딘가에 그 말이 있는 것만으로는 모른다 — 날씨 화면이 그 말을 하는지를 본다.
const wxbox = (()=>{ const i = S.indexOf("위치를 못 받은 경우에만 대안을 보여 준다");
                     return i < 0 ? '' : S.slice(i, i + 1600); })();
T('날씨 화면이 로그인했는지를 본다', /wxNoIn/.test(wxbox), wxbox.slice(0,60));
T('로그인 안 했으면 그렇다고 말한다',
  /wxNoIn[\s\S]{0,200}현재 위치는 로그인하신 분에게만 받습니다\./.test(wxbox));
T('그때는 로그인 단추를 준다', /wxNoIn[\s\S]{0,700}openAccount\(\)/.test(wxbox));
T('권한 문제일 때는 옛 말과 다시 시도 단추 그대로 둔다',
  /설정에서 위치 권한을 허용하시거나/.test(wxbox) && /wxRetryGPS\(\)/.test(wxbox));

// ── 새 말은 영어·러시아어도 있어야 한다
['현재 위치는 로그인하신 분에게만 받습니다.','로그인하시거나, 지점을 직접 추가해 주세요.']
  .forEach(k=>{
    const n = S.split("'" + k + "':").length - 1;
    T("'" + k.slice(0,18) + "…' 이 영어·러시아어에 다 있다", n >= 2, n);
  });

console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
process.exit(bad?1:0);
