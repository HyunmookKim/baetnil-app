// ══════════════════════════════════════════════════════════════════════
// 5.2 — 조화상수 물때가 **제자리에 제대로 붙어 있는지** 본다 (글자 검사)
//   hclive.js 는 값이 맞는지 보고, 여기서는 앱이 그 값을 어디에 쓰는지 본다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SRC = process.argv[2] || '../../work.html';
const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const T = (n, ok) => { if(ok){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };
const body = (fn) => {
  const i = src.indexOf('function ' + fn + '(');
  if(i < 0) return '';
  let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); }
  }
  return '';
};

// ── 있어야 할 것
T('조화상수 꾸러미가 들어 있다', /const HC_PACK = \[/.test(src));
T('꾸러미를 푸는 곳이 하나다 (hcUnpack)', (src.match(/function hcUnpack\(/g) || []).length === 1);
T('가까운 관측소를 잡는 곳이 있다 (hcNearest)', !!body('hcNearest'));
T('물때를 셈하는 곳이 있다 (hcTidePts)', !!body('hcTidePts'));
T('조석 계산기(NEAPS)가 들어 있다', /globalThis\.NEAPS|NEAPS=/.test(src));
T('거리 한도를 한곳에서만 정한다',
  (src.match(/const HC_NEAR_KM/g) || []).length === 1 && (src.match(/const HC_SAFE_KM/g) || []).length === 1);

// ── 순서: 관 물때표 → 손입력 → 조화상수 → 어림
{
  const ts = body('tideSource');
  T('① 관 물때표가 먼저다', ts.indexOf('allTidePts()') < ts.indexOf('hcTidePts'));
  T('② 손으로 넣은 것이 그다음이다', ts.indexOf('manual:true') < ts.indexOf('hcTidePts'));
  T('③ 조화상수가 그다음이다', ts.indexOf('hcTidePts') < ts.indexOf('omTidePts()'));
  T('④ 어림이 맨 마지막이다', ts.indexOf('omTidePts()') > ts.indexOf('hcTidePts'));
  T('★ 조화상수에는 hc 표를 단다', /hc: true/.test(src));
}

// ── 얹히면 큰일 나는 셈은 safe 일 때만
{
  const ta = body('tideAtPlace');
  T('★★★ 수심 환산은 관 물때표를 먼저 본다', ta.indexOf('nearestTideSpotAt') < ta.indexOf('hcTidePts'));
  T('★★★ 수심 환산은 safe 일 때만 조화상수를 쓴다', /H && H\.safe/.test(ta));
  T('★★★ 수심 환산에 어림(omTidePts)은 못 끼어든다', !/omTidePts|\.est/.test(ta));
  T('★★★ 다리 셈도 safe 가 아니면 안 한다', /TA\.hc && !TA\.safe/.test(src));
  T('★★★ safe 는 거리와 기준면 두 가지를 다 본다',
    /safe: near\.dist <= HC_SAFE_KM && near\.row\.dok === true/.test(src));
  T('★ 다리 기준값(HAT)은 그 관측소 것을 쓴다', /TA\.hc && TA\.safe && TA\.hat != null/.test(src));
}

// ── 사실대로 말한다
T('★ 어느 관측소에서 몇 km 인지 화면에 적는다', /조위 관측소\(\{km\}km\)의 조화상수로 셈한 물때입니다/.test(src));
T('★ 아래 경고줄에도 적는다', /조위 관측소\(\{km\}km\)의 <b>조화상수<\/b>로 셈한 것입니다/.test(src));
T('★★★ 자료 출처를 화면에 적는다 (CC BY 4.0 조건)',
  /Neaps tide database/.test(src) && /CC BY 4\.0/.test(src) && /openwatersio\/tide-database/.test(src));
T('★★★ 「30분쯤 어긋난다」는 말이 없다', !/30분쯤/.test(src));

// ── 세 나라말
['{spot} 조위 관측소({km}km)의 조화상수로 셈한 물때입니다.',
 '가장 가까운 조위 관측소가 {km}km 떨어져 있어 다리 통과를 계산하지 않습니다.',
 '조위 조화상수'].forEach(w => {
  const n = (src.match(new RegExp("'" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':", 'g')) || []).length;
  T(`'${w.slice(0,22)}…' 세 나라말에 다 있다 — ${n}`, n === 3);
});

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
