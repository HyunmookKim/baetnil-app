// 「지금 새로 받기」 띠가 헛되이 뜨지 않는가 (4.107)
//
// ★ 사장님이 **두 번** 겪으셨다.
//   4.93: 「새로 받기 눌렀는데도 계속 반복해서 뜬다」
//   4.107: 「지금 또 이미 106버전인데도 또 계속 새로받기 버튼 뜨는 웹 오류 생겼다.
//          이거 이전에도 이랬는데 왜 또 동일한 오류를 만드냐?」
//
// ★ 4.93 에서 고친 것 — 담긴 것이 여럿일 때 맨 앞 것을 집던 흠.
//   ★ 그런데 **반대 방향**을 그대로 두었다. 담긴 것이 지금 도는 것보다 **옛것**인 경우다.
//     그때 화면에 도는 코드는 이미 새것이고, 서비스워커가 아직 새 파일을 못 받았을 뿐이다.
//     그것을 「옛 앱이 돈다」 고 말하면 거짓말이고, 눌러도 안 바뀌니 띠가 영영 안 사라진다.
//     ★ 「새로 받기」 를 누른 **직후**가 정확히 그 상태다 — 저장분을 다 지우고 다시 켜면
//       서비스워커가 새로 담기까지 몇 초 걸린다. 그 사이에 또 띄우니 무한이었다.
//
// ★ 그래서 이 검사는 **말을 거는 조건 자체**를 못 박는다.
//   담긴 것이 지금 도는 것보다 **새것일 때만** 말한다. 그 밖에는 아무 말도 안 한다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(JSON.stringify(w)).slice(0, 260) : '')); } };

// ── 판 번호 견주기가 있는가
const cmpSrc = grab(src, 'verCmp');
T('①-1 판 번호를 견주는 자리가 있다', !!cmpSrc);
if(!cmpSrc){ console.log('\n합계: ' + ok + '개 통과 / ' + (bad) + '개 실패'); process.exit(1); }
eval('globalThis.verCmp = ' + cmpSrc.replace(/^function /, 'function '));

T('①-2 같으면 0', verCmp('4.107', '4.107') === 0);
T('①-3 앞이 작으면 -1', verCmp('4.106', '4.107') === -1);
T('①-4 앞이 크면 1', verCmp('4.107', '4.106') === 1);
// ★ 글자로 견주면 '4.99' 가 '4.100' 보다 크다고 나온다. 실제로 곧 닥칠 자리다.
T('①-5 ★ 4.99 < 4.100 (글자로 견주면 틀린다)', verCmp('4.99', '4.100') === -1,
  { 글자비교: '4.99' > '4.100' });
T('①-6 ★ 4.9 < 4.10', verCmp('4.9', '4.10') === -1);
T('①-7 자릿수가 달라도 된다', verCmp('5', '4.107') === 1 && verCmp('4', '4.0') === 0);

// ── 띠를 거는 조건
const banSrc = grab(src, 'verBanner') || '';
T('②-1 띠를 그리는 자리가 있다', !!banSrc);
T('②-2 ★ 담긴 것이 지금 것보다 새것일 때만 띄운다 (같거나 옛것이면 걷는다)',
  /verCmp\(got, APP_VER\) <= 0/.test(banSrc), banSrc.slice(0, 300));
// ★ 4.106 까지 {old} 와 {now} 가 뒤집혀 있었다 —
//   화면에 「지금 4.105 가 돌고 있습니다 (새 파일 4.106)」 처럼 사실과 반대로 나왔다.
//   돌고 있는 것은 APP_VER 이고, 담겨 있는 새 파일이 got 이다.
T('②-3 ★ 「돌고 있는 것」 자리에 APP_VER 이 들어간다',
  /\{ old: APP_VER, now: got \}/.test(banSrc),
  (banSrc.match(/\{ *old:[^}]*\}/) || [''])[0]);

// ── 저장분을 보고 판단하는 자리
const pv = grab(src, 'paintVer') || '';
T('③-1 저장분을 보는 자리가 있다', !!pv);
T('③-2 ★ 지금 판이 담겨 있으면 아무 말도 안 한다 (4.93 에서 고친 것)',
  /const 있나 = 앱것\.indexOf\(지금것\) >= 0/.test(pv) && /if\(있나 \|\| /.test(pv), pv.slice(0, 400));
T('③-3 ★ 담긴 것이 다 옛것이면 아무 말도 안 한다 (이번에 고친 것)',
  /verCmp\(판\(k\), APP_VER\) > 0/.test(pv), pv.slice(0, 600));
T('③-4 ★ 지금 판이 안 담겼는데 옛 저장분을 지우지 않는다 (바다에서 앱이 안 열린다)',
  /if\(있나\)\{[\s\S]*?caches\.delete/.test(pv), pv.slice(0, 900));
T('③-5 ★ 대신 서비스워커를 조용히 떠민다',
  /serviceWorker[\s\S]{0,160}\.update\(\)/.test(pv), pv.slice(0, 900));
T('③-6 지도 타일·사진은 앱 저장분으로 안 센다',
  /\/\^baetnil-\\d\/\.test\(k\)/.test(pv), pv.slice(0, 300));

// ── 실제로 돌려 본다. 저장분 이름 목록을 넣고 「띠가 뜨는가」 를 본다.
{
  // paintVer 를 그대로 돌리기는 화면이 필요해 무겁다.
  // 판단하는 셈만 그대로 옮겨 와서 돌린다 — 조건식은 위에서 글자로 못 박았다.
  const 판단 = (ks, ver) => {
    const 앱것 = ks.filter(k => /^baetnil-\d/.test(k));
    if(!앱것.length) return '말없음';
    const 지금것 = 'baetnil-' + ver;
    const 있나 = 앱것.indexOf(지금것) >= 0;
    const 판 = k => k.slice('baetnil-'.length);
    const 새것 = 앱것.filter(k => verCmp(판(k), ver) > 0).sort((a, b) => verCmp(판(a), 판(b)));
    if(있나 || !새것.length) return '말없음';
    return 판(새것[새것.length - 1]);
  };
  T('④-1 ★ 지금 판이 담겨 있다 → 말 안 한다',
    판단(['baetnil-4.107', 'baetnil-tiles'], '4.107') === '말없음');
  T('④-2 ★★ 담긴 것이 옛것뿐이다 → 말 안 한다 (사장님이 겪으신 그 자리)',
    판단(['baetnil-4.105', 'baetnil-4.106'], '4.107') === '말없음',
    판단(['baetnil-4.105', 'baetnil-4.106'], '4.107'));
  T('④-3 ★★ 「새로 받기」 직후 저장분이 하나도 없다 → 말 안 한다 (무한 되풀이의 시작점)',
    판단(['baetnil-tiles', 'baetnil-photos'], '4.107') === '말없음',
    판단(['baetnil-tiles', 'baetnil-photos'], '4.107'));
  T('④-4 ★ 담긴 것이 새것이다 → 그때는 말한다 (띠의 본래 몫)',
    판단(['baetnil-4.107', 'baetnil-4.108'], '4.107') === '말없음'
    && 판단(['baetnil-4.108'], '4.107') === '4.108',
    판단(['baetnil-4.108'], '4.107'));
  T('④-5 ★ 새것이 여럿이면 제일 새것을 말한다',
    판단(['baetnil-4.108', 'baetnil-4.110', 'baetnil-4.109'], '4.107') === '4.110',
    판단(['baetnil-4.108', 'baetnil-4.110', 'baetnil-4.109'], '4.107'));
  T('④-6 ★ 4.99 가 돌 때 4.100 이 담겼으면 말한다 (글자로 견주면 놓친다)',
    판단(['baetnil-4.100'], '4.99') === '4.100',
    판단(['baetnil-4.100'], '4.99'));
  T('④-7 지도·사진만 있으면 앱 저장분으로 안 센다',
    판단(['baetnil-tiles', 'baetnil-photos', 'baetnil-seen'], '4.107') === '말없음');
}

// ── 앱 판과 서비스워커 판이 어긋나면 이 모든 것이 헛돈다 (duptest 가 따로 지키지만 여기서도 본다)
{
  const swPath = path.join(path.dirname(SRC), 'sw.js');
  let sw = '';
  try{ sw = fs.readFileSync(swPath, 'utf8'); }catch(_){}
  const app = (src.match(/APP_VER = '([^']+)'/) || [])[1];
  const cac = (sw.match(/CACHE = 'baetnil-([^']+)'/) || [])[1];
  T('⑤ 앱 판과 서비스워커 판이 같다 — ' + app + ' / ' + cac, !!app && app === cac, { app, cac });
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
