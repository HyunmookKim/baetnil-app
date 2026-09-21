// ══════════════════════════════════════════════════════════════════════
// 5.0 — 기록 중인 항해가 없어지면 항적도 멈춘다
//
//   사장님 지적(2026-09-15): 항적을 켠 채로 그 항해를 지웠더니 기록이 안 멈췄다.
//   배터리가 계속 새고, 오른쪽 아래 「사람 빠짐」 단추가 켜진 채로 굳었다.
//   앱을 껐다 켜야 없어졌다.
//
//   ★ 한 곳만 막으면 안 된다 — 그 항해가 없어지는 문은 여럿이다.
//     휴지통, 배 바꾸기, 배 지우기, 로그아웃, 다른 사람 로그인.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (name, cond) => { if (cond) { ok++; console.log('통과: ' + name); }
                            else { bad++; console.log('★ 실패: ' + name); } };
const grab = (s, fn) => {
  const i = s.indexOf('function ' + fn + '(');
  if (i < 0) return '';
  return s.slice(i, i + 3000);
};

T('멈추는 문이 있다 — trkStopFor', /async function trkStopFor\(vid\)\{/.test(src));
T('그물이 있다 — trkDropIfGone',   /async function trkDropIfGone\(\)\{/.test(src));

T('trkStopFor 는 그 항해일 때만 멈춘다',
  /String\(trkNow\.vid\) !== String\(vid\)\) return false;/.test(grab(src, 'trkStopFor')));
T('trkStopFor 는 trkStop 을 부른다', /await trkStop\(\)/.test(grab(src, 'trkStopFor')));

T('항적에 배를 같이 적어 둔다',
  /trkNow = \{ vid: String\(vid\), boat: String\(currentBoatId \|\| ''\)/.test(src));
T('그물은 배가 바뀐 것도 잡는다',
  /String\(trkNow\.boat\) !== String\(currentBoatId \|\| ''\)/.test(src));
T('그물은 항해가 없어진 것도 잡는다',
  /String\(v\.id\) === String\(trkNow\.vid\)/.test(grab(src, 'trkDropIfGone')));

// ── 문마다
T('① 휴지통으로 옮기기 전에 멈춘다',
  /if\(row === 'voyage'\)\{ try\{ await trkStopFor\(it\.id\); \}catch\(_\)\{\} \}/.test(grab(src, 'mrDelete')));
T('② 배를 바꾸기 전에 멈춘다',
  /await trkStop\(\); snack\('배를 바꿔서 항적 기록을 멈췄습니다'/.test(grab(src, 'switchBoat')));
T('③ 배를 지우기 전에 멈춘다',
  /if\(trkNow && String\(id\) === String\(currentBoatId\)\)\{ try\{ await trkStop\(\); \}catch\(_\)\{\} \}/
    .test(grab(src, 'doDelBoat')));
T('④ 자료를 다시 읽을 때 그물을 친다 (로그아웃·남의 로그인까지)',
  /try\{ await trkDropIfGone\(\); \}catch\(_\)\{\}\n\}/.test(src));

// ── 앱을 껐다 켜면 이어 붙인다 (만들어만 놓고 안 부르고 있었다)
T('trkResume 을 실제로 부른다', /try\{ trkResume\(\); \}catch\(_\)\{\}/.test(src));
T('trkResume 도 없어진 항해는 안 되살린다',
  /if\(await trkDropIfGone\(\)\) return;/.test(grab(src, 'trkResume')));

// ── 말은 네 나라 것이 다 있어야 한다
['항적 기록을 멈췄습니다',
 '기록 중이던 항해가 없어져서 항적 기록을 멈췄습니다',
 '배를 바꿔서 항적 기록을 멈췄습니다'].forEach(w => {
  const n = (src.match(new RegExp("'" + w + "':'", 'g')) || []).length;
  T("'" + w + "' 이 영어·러시아어·일본어에 다 있다 — " + n, n === 3);
});

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
