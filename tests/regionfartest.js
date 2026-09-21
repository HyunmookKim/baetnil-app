// 4.97 — 한국 해역 밖에 있는 배에 한국 특보를 보여 주지 않는다
//
// ★ 왜 이 검사가 있나
//   boatRegion() 이 「얼마나 멀든 제일 가까운 한국 지역」 을 집고 있었다.
//   다카마쓰(高松)에 댄 배가 「경남」 이 되고, 화면은 남해동부 특보를 그 배의 해역인 양 보여 줬다.
//   ★ 특보는 사람이 그것을 보고 바다에 나가는 자리다.
//     엉뚱한 해역 특보를 제 해역인 양 보여 주면 「특보 없음」 이라고 안심시키거나
//     없는 위험을 있다고 말한다. 둘 다 사람이 다치는 쪽이다.
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);

let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };

const mk = boat => new Function('curBoat', 'krCache', 't', 'tsub',
  (js.match(/const REGION_POINTS = \[[\s\S]*?\n\];/) || [''])[0] + '\n'
  + (js.match(/const REGION_FAR = [^\n]*\n/) || [''])[0] + '\n'
  + (js.match(/const SEA_ZONE = \{[\s\S]*?\n\};/) || [''])[0] + '\n'
  + grab(js,'boatRegion') + '\n' + grab(js,'boatOutsideKR') + '\n'
  + grab(js,'warnLines') + '\n' + grab(js,'myWarnings')
  + '\n return { boatRegion, boatOutsideKR, myWarnings };');

const KR = { wx: { zones: [ { kind:'풍랑주의보', reg:'남해동부' }, { kind:'풍랑주의보', reg:'남해서부' } ] } };
const api = (boat, cache) => mk()(() => boat, cache === undefined ? KR : cache,
  x => String(x), (k,v)=>String(k).replace(/\{(\w+)\}/g,(a,n)=>v&&v[n]!=null?v[n]:a));

// ── 1. 한국 안은 그대로 돈다
const 여수 = { lat:34.76, lon:127.66 }, 부산 = { lat:35.10, lon:129.04 }, 제주 = { lat:33.51, lon:126.52 };
T('여수 → 전남', api(여수).boatRegion() === '전남');
T('부산 → 부산', api(부산).boatRegion() === '부산');
T('제주 → 제주', api(제주).boatRegion() === '제주');
T('한국 안이면 밖이라고 하지 않는다',
  [여수,부산,제주].every(b => api(b).boatOutsideKR() === false));

// ── 2. ★ 여기가 그 자리다 — 일본에 댄 배
const 다카마쓰 = { lat:34.35, lon:134.05 };   // 高松港
const 후쿠오카 = { lat:33.60, lon:130.40 };   // 博多
const 오사카   = { lat:34.65, lon:135.43 };
const 오키나와 = { lat:26.21, lon:127.68 };
[['다카마쓰',다카마쓰],['후쿠오카',후쿠오카],['오사카',오사카],['오키나와',오키나와]].forEach(([nm,b])=>{
  const A = api(b);
  T('★★★ ' + nm + ' 은 한국 지역이 아니다 — ' + (A.boatRegion() || '(없음)'), A.boatRegion() === '');
  T('★★ ' + nm + ' 은 한국 해역 밖이라고 안다', A.boatOutsideKR() === true);
  const w = A.myWarnings();
  T('★★★ ' + nm + ' 에 한국 특보를 안 보여 준다 — ' + JSON.stringify((w||{}).active),
    w && Array.isArray(w.active) && w.active.length === 0, w);
  T('★★ ' + nm + ' 에 왜 못 보여 주는지 말해 준다',
    !!(w && /대한민국 해역 밖/.test(w.summary || '')), (w||{}).summary);
});

// ── 3. 자리를 아예 모르는 배는 다른 이야기다 (전국을 보여 준다 — 조용히 없다고 하지 않는다)
{
  const A = api({ lat:null, lon:null });
  T('자리를 모르면 밖이라고 하지 않는다', A.boatOutsideKR() === false);
  const w = A.myWarnings();
  T('★ 자리를 모르면 전국을 보여 준다 — ' + JSON.stringify((w||{}).active),
    w && w.active.length > 0, w);
  T('★ 자리를 모른다고 말해 준다', /배 위치를 몰라/.test((w||{}).note || ''), (w||{}).note);
}

// ── 4. 한계 — 너무 넉넉하지도 너무 빡빡하지도 않아야 한다
{
  T('★ 이어도(한국 남쪽 먼바다)는 아직 한국이다 — ' + api({lat:32.12,lon:125.18}).boatRegion(),
    api({ lat:32.12, lon:125.18 }).boatRegion() !== '');
  T('★ 울릉도는 한국이다 — ' + api({lat:37.48,lon:130.90}).boatRegion(),
    api({ lat:37.48, lon:130.90 }).boatRegion() !== '');
  T('★★ 쓰시마 서쪽(한일 사이)에서도 한국 특보가 끊기지 않는다 — ' + api({lat:34.40,lon:129.30}).boatRegion(),
    api({ lat:34.40, lon:129.30 }).boatRegion() !== '');
  T('★★ 세토내해 초입(시모노세키 동쪽)은 한국이 아니다 — ' + (api({lat:33.95,lon:131.60}).boatRegion()||'(없음)'),
    api({ lat:33.95, lon:131.60 }).boatRegion() === '');
}

// ── 5. 한국 안에서는 제 해역 것만 (예전 그대로)
{
  const w = api(부산).myWarnings();
  T('부산은 남해동부 특보를 본다', (w.active||[]).join(' ').indexOf('남해동부') >= 0, w.active);
  T('부산이 남해서부까지 보지는 않는다', (w.active||[]).join(' ').indexOf('남해서부') < 0, w.active);
}

// ── 6. ★★★ 못 읽은 것을 「없음」 이라고 하지 않는다 (2026-09-04, 사장님 지적)
//
//   사장님: 「야 특보 있는데 왜 없다고 하냐」
//   그날 기상청에는 풍랑경보(남해서부동쪽먼바다)와 강풍주의보(전남 여수)가 떠 있었다.
//   그런데 자료에 실린 구역 이름이 **글자가 깨진 채**(EUC-KR 을 UTF-8 로 읽었다) 들어와
//   어느 해역과도 안 맞았고, 앱은 「전남 해역은 특보 없음」 이라고 했다.
//   ★ 경보가 떠 있는데 없다고 하는 것 — 이건 조용한 거짓말이고 사람이 다치는 쪽이다.
{
  const 깨진자료 = { wx: { zones: [
    { kind:'\uFFFD\uFFFD\uFFFD\uFFFD', reg:'\uFFFD\uFFFD\uFFFD\uD3C9\uFFFD' },
    { kind:'\uFFFD\uFFFD\uFFFD\uFFFD', reg:'\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD' } ] } };
  const w = api(여수, 깨진자료).myWarnings();
  T('★★★ 이름이 깨졌으면 「특보 없음」 이라고 안 한다',
    !/특보 없음/.test((w || {}).summary || ''), (w||{}).summary);
  T('★★★ 못 읽었다고 말해 준다', /못 읽었/.test((w || {}).summary || ''), (w||{}).summary);
  T('★★★ 기상청에서 확인하라고 길을 준다', /기상청/.test((w || {}).note || ''), (w||{}).note);

  // 성한 자료에서는 여태처럼 돈다 — 이 막음이 멀쩡한 것까지 막으면 안 된다
  const 성한 = { wx: { zones: [ { kind:'풍랑경보', reg:'남해서부동쪽먼바다' } ] } };
  const w2 = api(여수, 성한).myWarnings();
  T('★★★ 여수 배가 남해서부 풍랑경보를 본다 (사장님이 겪으신 그 특보다)',
    (w2.active||[]).join(' ').indexOf('남해서부') >= 0, w2);
  const 딴데 = { wx: { zones: [ { kind:'풍랑경보', reg:'동해북부앞바다' } ] } };
  const w3 = api(여수, 딴데).myWarnings();
  T('★★ 진짜로 내 해역에 없을 때는 없다고 말한다', /특보 없음/.test(w3.summary || ''), w3.summary);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
