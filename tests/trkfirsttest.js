// ══════════════════════════════════════════════════════════════════════
// 5.12 — 첫 점은 위성이 잡힌 뒤에 찍는다 (OpenCPN 이 하는 방식)
//
//   ★ 왜
//     켜자마자 들어오는 첫 위치는 위성이 덜 잡혀 수십~수백 미터 어긋나 있다.
//     그 점이 항적의 시작이 되면 출발선이 엉뚱한 곳에 그어지고, 그다음 점까지
//     「말도 안 되게 빨리 움직였다」 로 보여 줄줄이 버려진다.
//
//   ★ 다만 영영 기다리면 안 된다 — 흐린 날 못 기다리다 한 항해를 통째로 잃는다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SRC = process.argv[2] || '../../work.html';
const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const T = (n, ok) => { if(ok){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };
const cut = (a) => { const i = src.indexOf(a); if(i < 0) return ''; let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } } return ''; };

const 상수 = (n) => { const m = new RegExp('const ' + n + '\\s*=\\s*(\\d+)').exec(src); return m ? +m[1] : null; };
T('첫 점 정확도 문이 있다 (TRK_FIRST_ACC)', 상수('TRK_FIRST_ACC') === 20);
T('기다리는 한도가 있다 (TRK_FIRST_WAIT)', 상수('TRK_FIRST_WAIT') === 90000);

const fnSrc = cut('function trkFirstWait(');
T('trkFirstWait 가 있다', !!fnSrc);
if(!fnSrc){ console.log('\n합계: ' + pass + '개 통과 / ' + ++fail + '개 실패'); process.exit(1); }
const api = new Function('TRK_FIRST_ACC', 'TRK_FIRST_WAIT', fnSrc + '\n return trkFirstWait;')(20, 90000);

const 켠때 = Date.UTC(2026, 8, 23, 0, 0, 0);
T('★ 켜자마자 들어온 흐린 점(80m)은 첫 점으로 안 쓴다', api(80, 켠때, 켠때 + 2000) === true);
T('★ 정확도를 모르는 점도 첫 점으로 안 쓴다', api(NaN, 켠때, 켠때 + 2000) === true);
T('★ 또렷한 점(8m)은 바로 첫 점이 된다', api(8, 켠때, 켠때 + 2000) === false);
T('★ 20m 는 통과한다 (문 그 자체)', api(20, 켠때, 켠때 + 2000) === false);
T('★★★ 90초를 넘기면 흐려도 받는다 — 한 항해를 통째로 잃는 것이 더 나쁘다',
  api(80, 켠때, 켠때 + 91000) === false);
T('89초까지는 기다린다', api(80, 켠때, 켠때 + 89000) === true);
T('★ 몰아서 들어온 점은 **그 점이 찍힌 때**로 잰다 (화면 끈 동안 쌓인 것)',
  api(80, 켠때, 켠때 + 5000) === true && api(80, 켠때, 켠때 + 120000) === false);

// ── 앱 안에서 실제로 걸리는 자리인가
T('★★★ 실시간 경로에 문이 걸려 있다',
  /if\(!trkNow\.pts\.length && trkFirstWait\(ac, Date\.parse\(trkNow\.from\)\)\)\{/.test(src));
T('★★★ 몰아 받는 경로(자바 버퍼)에도 같은 문이 걸려 있다',
  /trkFirstWait\(ac, Date\.parse\(trkNow\.from\), Number\(q\.t\)\)/.test(src));
T('★ 기다리는 동안 화면에 까닭을 밝힌다',
  /GPS 신호를 찾고 있습니다 — 위치가 정확해지면 첫 점을 기록합니다/.test(src));
{
  const w = 'GPS 신호를 찾고 있습니다 — 위치가 정확해지면 첫 점을 기록합니다';
  const n = (src.match(new RegExp("'" + w + "':", 'g')) || []).length;
  T('그 말이 세 나라말에 다 있다 — ' + n, n === 3);
}
T('★ 흐린 점을 버릴 때 세어 둔다 (나중에 「왜 안 찍혔나」 를 물을 수 있게)',
  /trkNow\.wait = \(Number\(trkNow\.wait\) \|\| 0\) \+ 1/.test(src));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
