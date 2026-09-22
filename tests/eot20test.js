// ══════════════════════════════════════════════════════════════════════
// 5.8 — 러시아 극동 물때 (위성 조석 모형 EOT20 에서 뽑은 점)
//   ① 점들이 꾸러미에 제대로 들어 있고 ② 관측소인 척하지 않으며
//   ③ 다리·수심 셈에 안 쓰이고 ④ 출처가 화면에 적히는지 본다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SRC = process.argv[2] || '../../work.html';
const src = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const T = (n, ok) => { if(ok){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };
const cut = (a) => { const i = src.indexOf(a); let d=0; for(let k=src.indexOf('{',i);k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(!d) return src.slice(i,k+1);} } return ''; };

const MARK = '// ★★★ 5.2 — 물때를 **조화상수로 직접 셈한다**';
const i = src.indexOf(MARK), j = src.indexOf('function hcTidePts(lat, lon){', i);
const block = src.slice(i, j) + cut('function hcTidePts(lat, lon){');
let api = null, err = '';
try{
  api = new Function('atob', cut('function hav(') + '\n' + block + '\n return { hcAll, hcTidePts, NEAPS: globalThis.NEAPS };')
        (s => Buffer.from(s, 'base64').toString('binary'));
}catch(e){ err = e.message; }
T('조화상수 대목이 돌아간다' + (err ? ' — ' + err : ''), !!api);
if(!api){ console.log('\n합계: ' + pass + '개 통과 / ' + ++fail + '개 실패'); process.exit(1); }

const rows = api.hcAll();
const M = rows.filter(r => r.model);
T('EOT20 점이 12곳 들어 있다 — ' + M.length, M.length === 12);
T('★ EOT20 점은 dok 가 거짓이다 (다리·수심에 못 쓴다)', M.every(r => r.dok === false));
T('관측소 점에는 model 표가 없다', rows.filter(r => !r.model).length === rows.length - 12);
T('EOT20 점은 다 러시아 극동 바다에 있다',
  M.every(r => r.lat > 42 && r.lat < 50 && r.lon > 130 && r.lon < 144));
T('EOT20 점마다 기준면·최고조위를 안다', M.every(r => r.off > 0 && r.hat > r.off));
T('★ SA·SSA 는 뺐다 (계절 수위와 안 맞는다)', M.every(r => !r.cons.some(c => c.name === 'SA' || c.name === 'SSA')));
T('주요 분조(M2·K1·O1·S2)가 다 있다',
  M.every(r => ['M2','K1','O1','S2'].every(n => r.cons.some(c => c.name === n))));

// ── 실제로 셈해 본다
const P = {
  '블라디보스토크 MPP': [43.11139, 131.88278],
  '나홋카 MPP':        [42.80306, 132.90389],
  '코르사코프 MPP':    [46.62917, 142.75972],
  '소베츠카야가반 MPP':[48.96, 140.26472],
};
for(const [n, [la, lo]] of Object.entries(P)){
  const H = api.hcTidePts(la, lo);
  T(`${n} — 물때가 나온다`, !!H && H.pts.length >= 10);
  if(!H) continue;
  T(`${n} — ★ 모형 점이라고 표가 붙는다`, H.model === true);
  T(`${n} — ★★★ safe 가 거짓이다 (다리·수심에 안 쓴다)`, H.safe === false);
  T(`${n} — 가장 가까운 점이 15km 안이다 (${H.spot.dist.toFixed(1)}km)`, H.spot.dist < 15);
  const lo2 = Math.min(...H.pts.map(p => p.v)), hi2 = Math.max(...H.pts.map(p => p.v));
  T(`${n} — 높이가 최저천문조위(0) 위, 최고조위 아래다 (${lo2.toFixed(2)}~${hi2.toFixed(2)}m)`,
    lo2 >= -0.005 && hi2 <= H.hat + 0.005);
  T(`${n} — 만조·간조가 번갈아 온다`, H.pts.every((p, k) => !k || p.hi !== H.pts[k-1].hi));
}
{
  const H = api.hcTidePts(41.78, 140.73);   // 하코다테 — 관측소가 이긴다
  T('★ 하코다테는 여전히 관측소 물때다', !!H && !H.model && H.safe === true);
}

// ── ★★★ 6.0 — 먼 관(官) 관측소가 이기지 않는다 (시뮬레이터 검사에서 드러남)
T('★★★ 관 물때표에도 거리 한도가 있다', /function tideOfficialNear\(sp\)\{ return !!\(sp && sp\.dist != null && sp\.dist <= HC_NEAR_KM\); \}/.test(src));
T('★★★ 날씨 화면 물때가 그 한도를 본다', /function allTidePts\(\)\{\s*const sp = nearestTideSpot\(\); if\(!sp \|\| !tideOfficialNear\(sp\)\) return null;/.test(src));
T('★★★ 수심 환산도 그 한도를 본다', /const sp = nearestTideSpotAt\(lat, lon\);\s*if\(sp && tideOfficialNear\(sp\)\)\{/.test(src));
T('★ 먼 관측소 출처 줄을 안 적는다', /if\(!tideOfficialNear\(sp\)\) return '';/.test(src));

// ── 화면
T('★★★ 다리 칸 — 모형 점이면 「관측소가 멀다」가 아니라 모형이라서라고 적는다',
  /TA\.model \? esc\(t\('조석 모형으로 셈한 물때라 다리 통과를 계산하지 않습니다\.'\)\)/.test(src));
T('★ 다리 칸 아래 — 모형 점이면 EOT20 에서 셈했다고 적는다',
  /TA\.model\s*\? tsub\('위성 조석 모형\(EOT20\)의 \{spot\} 부근/.test(src));
T('★ 아래 띠 — 최저천문조위(LAT) 위 높이라고 적는다', /TA\.hc && TA\.model\s*\? tsub\('이 물때는 위성 조석 모형 <b>EOT20<\/b>/.test(src));
T('★★★ EOT20 출처를 화면에 적는다 (CC BY 4.0 조건)',
  /doi\.org\/10\.17882\/79489/.test(src) && /Hart-Davis et al\. 2021/.test(src));
T('★ 모형 점에는 Neaps(관측소) 출처를 달지 않는다', /TA && TA\.hc && !TA\.model \? `<div class="wxfoot"/.test(src));

['조석 모형으로 셈한 물때라 다리 통과를 계산하지 않습니다.',
 '만조·간조를 직접 입력하시면 계산해 드립니다.',
 '위성 조석 모형(EOT20)의 {spot} 부근({km}km) 조화상수로 셈한 물때입니다.',
 '이 물때는 위성 조석 모형 <b>EOT20</b>에서 뽑은',
 '조석 모형'].forEach(w => {
  const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const n = (src.match(new RegExp("'" + esc + (w.endsWith('뽑은') ? "[^']*':" : "':"), 'g')) || []).length;
  T(`'${w.slice(0,24)}…' 세 나라말에 다 있다 — ${n}`, n === 3);
});

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
