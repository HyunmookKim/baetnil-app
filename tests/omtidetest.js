// ══════════════════════════════════════════════════════════════════════
// 5.0 — 한국·일본 밖의 물때 (Open-Meteo 어림)
//   관측소 자료가 있으면 그것이 언제나 이기고,
//   어림은 **다리 통과·수심에 절대 안 쓰이며**, 화면에 어림이라고 적어야 한다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c) => { if (c) { ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n); } };
const grab = (s, fn) => { const i = s.indexOf('function ' + fn + '('); return i < 0 ? '' : s.slice(i, i + 6000); };

// ── 부르는 횟수를 안 늘린다
T('★ 조위를 해상 자료에 **얹어서** 받는다 (부르는 횟수 그대로)',
  /hourly=wave_height,wave_period,wave_direction,sea_level_height_msl/.test(src));
// ★ 5.1 — 해상 자료를 부르는 자리가 둘이 되었다.
//   ① 배 자리 한 점 (늘 부른다)
//   ② 배 자리가 **비어 있을 때만** 둘레 바다 여러 점을 한 번에 (좌표를 여러 개 넣어 한 번만 부른다)
//   뭍 가까운 항 안쪽은 파고·파주기가 통째로 null 로 온다. 그때 아무 말도 안 하면
//   카드에 「정해 둔 기준 안에 있습니다」 가 떠서, 재 보지도 않고 괜찮다고 말하게 된다.
//   그래서 한 번 더 부르는 것은 맞다. 다만 **늘 부르면 안 된다** — 하루 한도(C7)가 있다.
// ★ 5.10 — 셋째 자리: 추정값을 쓸 때만 가까운 조화상수 점 자리에서 한 번 더 부른다 (omCalib)
T('해상 자료를 부르는 자리는 셋뿐이다 (배 자리 · 둘레 바다 · 추정값 보정)',
  (src.match(/marine-api\.open-meteo\.com/g) || []).length === 3);
T('★ 보정은 추정값을 쓸 때만, 한 번만 부른다',
  /T0 && T0\.est && wxData\.m && wxData\.m\._cal === undefined\) await omCalib/.test(src));
T('★ 둘레 바다는 파도 값이 비었을 때만 부른다 (늘 부르지 않는다)',
  /if\(!wxHasWave\(b\)\)\{[\s\S]{0,200}wxMarineNear/.test(src));
T('★ 둘레 바다는 좌표를 여러 개 넣어 한 번에 부른다 (횟수를 늘리지 않는다)',
  /latitude=' \+ pts\.map\(p=>p\[0\]\)\.join\(','\)/.test(src));
T('★ 어디서 가져왔는지 남긴다 (배 자리 값인 척하지 않는다)',
  /_near\s*=\s*\{[^}]*km:/.test(src));

// ── 어림을 만드는 문
const om = grab(src, 'omTidePts');
T('어림 물때를 만드는 문이 있다', om.length > 0);
T('꼭짓점을 포물선으로 잡는다 (한 시간 간격의 한계를 줄인다)', /0\.5 \* \(a - c\) \/ den/.test(om));
T('만조·간조를 갈라 담는다', /hi: 만조/.test(om));
T('★ 거의 안 움직이는 바다(동해)에서는 아는 척하지 않는다',
  /OM_TIDE_MIN_RANGE/.test(src) && /높 - 낮 < OM_TIDE_MIN_RANGE\) return null/.test(om));
T('★ 이 며칠 중 가장 낮은 물을 0 으로 잡는다 (마이너스 cm 를 안 보여 준다)',
  /x\.v = x\.v - 낮/.test(om));
T('점이 너무 적으면 안 쓴다', /ex\.length < 3\) return null/.test(om));

// ── 차례: 관측소 → 손입력 → 어림
const ts = grab(src, 'tideSource');
T('① 관측소 자료가 먼저다', /const A = allTidePts\(\);\s*\n\s*if\(A\) return A;/.test(ts));
T('② 손으로 넣은 것이 그다음이다', /manual:true/.test(ts));
T('③ 어림은 맨 마지막이다', ts.indexOf('omTidePts()') > ts.indexOf('manual:true'));
T('★ 어림에는 est 표를 단다', /est:true/.test(ts));

// ── 다리·수심에는 안 쓴다
T('★★★ 다리 통과는 어림이면 계산하지 않는다',
  /else if\(quickClr>0 && TA && \(TA\.est \|\| \(TA\.hc && !TA\.safe\)\)\)\{/.test(src));
// ★ 5.2 — 조화상수 물때라도 관측소가 멀면 다리 셈을 안 한다
T('★★★ 조화상수라도 관측소가 멀면 다리 셈을 안 한다',
  /TA\.hc && !TA\.safe/.test(src));
T('★★★ 왜 안 하는지 말해 준다', /참고용 물때에는 기본수준면이 없습니다/.test(src));
// ★ 함수 몸통만 정확히 떼어 낸다 — 이웃 함수가 끼어들면 헛되이 통과한다
const body = (s, fn) => {
  const i = s.indexOf('function ' + fn + '(');
  if (i < 0) return '';
  let d = 0, j = s.indexOf('{', i);
  for (let k = j; k < s.length; k++) {
    if (s[k] === '{') d++;
    else if (s[k] === '}') { d--; if (!d) return s.slice(i, k + 1); }
  }
  return s.slice(i);
};
T('★★★ 수심 환산(tideAtPlace)은 관측소만 본다 — 어림이 못 끼어든다',
  !/omTidePts|\.est/.test(body(src, 'tideAtPlace')));
T('★★★ 수심 환산은 가까운 관측소를 직접 잡는다',
  /nearestTideSpotAt\(lat, lon\)/.test(body(src, 'tideAtPlace')));

// ── 화면이 사실대로 말한다
T('★ 참고용일 때 경고줄이 달라진다', /TA && TA\.est\s*\n?\s*\? t\('이 위치는 가까이에 조위관측소가 없어/.test(src));
// ★★★ 5.2 — 「30분쯤 어긋납니다」는 지웠다 (사장님 지적, 2026-09-16).
//   어긋난다고 앱이 먼저 적어 두는 것은 못 쓰는 앱이라고 스스로 알리는 것이다.
//   대신 **가까이에 관측소가 없다**는 사실을 적고, 관측소가 있으면 조화상수로 셈한다.
T('★★★ 「30분쯤 어긋난다」는 문구가 앱에 없다',
  !/30분쯤<\/b> 어긋날 수 있습니다/.test(src) && !/about 30 minutes/.test(src));
// ★ 「장담할 수 없습니다」도 지웠다 (사장님 지시, 2026-09-17).
//   「못 미덥다」고 말하지 말고 **어디서 확인하면 되는지**를 적는다.
T('★★★ 「장담할 수 없습니다」라는 말이 앱에 없다', !/장담할 수 없/.test(src));
T('★ 대신 어디서 확인하라고 적는다',
  /만조·간조 시각과 높이는 <b>해도나 그 국가 조석표에서 확인해 주세요/.test(src));
T('★ 다리·수심에 쓰지 말라고 적는다', /다리 통과와 수심 판단에는 사용하지 마십시오/.test(src));
T('참고용이라고 다리 칸에도 적는다', /참고용 물때를 사용하는 중/.test(src));

// ── 세 나라말
['관측소 없음',
 '이 위치는 참고용 물때라 다리 통과를 계산하지 않습니다.',
 '참고용 물때에는 기본수준면이 없습니다. 만조·간조를 직접 입력하시면 계산해 드립니다.',
 '참고용 물때를 사용하는 중입니다 — 정확한 값을 아시면 직접 입력하시면 그 값을 사용합니다.'].forEach(w => {
  const n = (src.match(new RegExp("'" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':'", 'g')) || []).length;
  T("'" + w.slice(0, 22) + "…' 세 나라말에 다 있다 — " + n, n === 3);
});

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
