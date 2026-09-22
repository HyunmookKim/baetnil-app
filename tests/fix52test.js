// ★★★ 5.10 — 사장님이 코멘트 단 「제가 임의로 정한 52개」 중 조위·날씨 항목 (2026-09-22)
//   1 관측소 없을 때만 추정값 · 2 시각 어긋남 보정 · 3 높이 기준 · 4 조차 30cm 문 · 5 다리·수심 · 6 파도 111km · 7 자료 없음 까닭
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const __ARG  = process.argv[2];
const __BASE = __ARG ? path.dirname(path.resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? path.basename(__ARG) : 'work.html';
const src = fs.readFileSync(path.join(__BASE, __MAIN), 'utf8');
const server = http.createServer((rq,rs)=>{
  const f = path.join(__BASE, rq.url === '/' ? __MAIN : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };

// ── 소스에서 보는 것
T('1 ★★ 전 세계 해안 모형 점(hc-eot20.txt)을 받아 조화상수 점에 더한다', /DATA_BASE \+ 'hc-eot20\.txt/.test(src) && /hcRows\.concat\(hcModelRows\)/.test(src));
T('1 ★ 날씨 화면이 모형 점을 먼저 받는다', /await loadHcModel\(\);/.test(src));
T('1 ★ 추정값(omTidePts)은 조화상수 점이 없을 때만 (tideSource 맨 끝)', /const H = hcTidePts\(wxCur\.lat, wxCur\.lon\);\s*if\(H && H\.pts\.length >= 4\) return H;\s*\}[\s\S]{0,200}const E = omTidePts\(\);/.test(src));
T('4 ★★ 조차 문을 30cm → 5cm 로', /const OM_TIDE_MIN_RANGE = 0\.05;/.test(src));
T('5 ★★ 모형 점도 15km 안이면 다리·수심에 쓰되 0.3m 여유', /const HC_MODEL_SAFE_KM = 15;/.test(src) && /const HC_MODEL_PAD = 0\.3;/.test(src)
  && /const clr = quickClr \+ \(cur\.hat - tv\) - pad;/.test(src) && /v: v \+ \(H\.pad \|\| 0\)/.test(src));
T('6 ★★ 둘레 바다는 22km 까지만 (111km 아님)', /const WX_RING_R = \[0\.04, 0\.08, 0\.13, 0\.20\];/.test(src));
T('6 ★ 가장 가까운 값을 고른다', /if\(d < bd\)\{ bd = d; best = o;/.test(src));
T('7 ★★ 못 쟀을 때 까닭을 적는다 (wxMissWhy)', /function wxMissWhy\(key\)/.test(src) && /esc\(m\.why \|\| t\('자료 없음'\)\)/.test(src));
for(const k of ['10km 안에 조류예보 지점이 없어 조류를 알 수 없습니다','바다에서 떨어진 위치(육지·강 안쪽)라 파도 예보가 없습니다','조석 모형 값이라 {m}m 더 낮게 잡았습니다'])
  T('★ 세 나라 말이 있다 — ' + k, (src.split("'" + k + "':").length - 1) === 3);

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul', viewport:{width:390,height:800} });
  const pg = await ctx.newPage();
  await pg.route('**/*.json*', r => r.fulfill({ status:200, body:'{}' }));
  const FIX = fs.existsSync(path.join(__dirname, 'hc-eot20-fixture.txt')) ? fs.readFileSync(path.join(__dirname, 'hc-eot20-fixture.txt'), 'utf8') : '';
  await pg.route('**/hc-eot20.txt*', r => FIX ? r.fulfill({ status:200, contentType:'text/plain', body: FIX }) : r.fulfill({ status:404, body:'' }));
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);

  // 2·3·4 — 보정: 참(조화상수)과 Open-Meteo(40분 빠르고 0.8배, 평균해면 기준)를 만들어 되찾는가
  const cal = await pg.evaluate(async () => {
    const cons = [{ name:'M2', amplitude:0.12, phase:40 }, { name:'K1', amplitude:0.05, phase:120 }];
    const row = { lat: 42.9, lon: 131.9, off: 0.30, hat: 0.55, cons, model: true, name: '' };
    const pr = NEAPS.createTidePredictor(cons);
    const t0 = Date.UTC(2026, 8, 22);
    const times = [], om = [];
    // Open-Meteo: 40분 빠름 — ms 시각 값이 실제로는 ms+40분의 물
    const tl = pr.getTimelinePrediction({ start: new Date(t0), end: new Date(t0 + 122*3600e3), timeFidelity: 600 });
    for(let i = 0; i < 120; i++){ const ms = t0 + i * 3600e3;
      times.push(new Date(ms).toISOString().slice(0, 16));
      om.push(0.8 * tl[i * 6 + 4].level); }        // 6칸 = 1시간, +4칸 = 40분 뒤의 물
    const 원래 = { hcNearest: window.hcNearest, fetchTimeout: window.fetchTimeout };
    window.hcNearest = () => ({ row, dist: 200 });
    window.fetchTimeout = async () => ({ ok: true, json: async () => ({ hourly: { time: times, sea_level_height_msl: om } }) });
    wxData = { key:'x', w: { utc_offset_seconds: 0, hourly: { time: times } }, m: { hourly: { time: times, sea_level_height_msl: om } } };
    const C = await omCalib(43.0, 132.0);
    const E = omTidePts();
    // 보정된 만조 시각이 참 만조 시각과 몇 분 다른가
    const ex = pr.getExtremesPrediction({ start: new Date(t0 + 6*3600e3), end: new Date(t0 + 100*3600e3) });
    let worst = 0, dz = 0, n = 0;
    (E || []).forEach(p => { if(p.t < t0 + 6*3600e3 || p.t > t0 + 100*3600e3) return;
      let b = null, bd = 1e18; ex.forEach(e => { const d = Math.abs(+e.time - p.t); if(d < bd && e.high === p.hi){ bd = d; b = e; } });
      if(b){ worst = Math.max(worst, bd / 60e3); dz = Math.max(dz, Math.abs(p.v - (b.level + row.off))); n++; } });
    window.hcNearest = 원래.hcNearest; window.fetchTimeout = 원래.fetchTimeout;
    return { C, n, worst, dz };
  });
  T('2 ★★★ 보정이 잡힌다 (상관 0.8 이상)', cal.C && cal.C.ok === true && cal.C.cor > 0.95, cal.C);
  T('2 ★★★ 시간차를 되찾는다 (Open-Meteo 40분 빠름 → +40분 옮김)', cal.C && Math.abs(cal.C.lagMin - 40) <= 5, cal.C && cal.C.lagMin);
  T('4 ★★ 조차 비율을 되찾는다 (0.8배 → 1.25배로 늘림)', cal.C && Math.abs(cal.C.k - 1.25) < 0.05, cal.C && cal.C.k);
  T('2 ★★★ 보정한 만조·간조 시각이 참과 10분 안이다', cal.n >= 6 && cal.worst <= 10, cal);
  T('3 ★★★ 높이가 그 점의 기본수준면 위 높이로 맞는다 (3cm 안)', cal.n >= 6 && cal.dz <= 0.03, cal);

  // 1·5 — 조석 모형 점을 받아 관측소 없는 바다에서 쓴다 (먼 태평양 38.5N 165E 의 모형 점 하나로 본다)
  const mdl = await pg.evaluate(async () => {
    const rows = await loadHcModel();
    const a = hcTidePts(38.55, 165.0), b = hcTidePts(38.0, 165.0);
    return { n: rows ? rows.length : 0, a: a && { model: a.model, safe: a.safe, pad: a.pad, km: a.spot.dist, pts: a.pts.length, name: a.spot.name },
             b: b && { model: b.model, safe: b.safe, km: b.spot.dist } };
  });
  T('1 ★★ 조석 모형 점 꾸러미를 받는다', mdl.n >= 40, mdl.n);
  T('1 ★★★ 관측소가 1,700km 떨어진 바다에서도 모형 점으로 물때를 셈한다', mdl.a && mdl.a.model === true && mdl.a.pts >= 10, mdl.a);
  T('1 ★ 이름 없는 모형 점은 좌표로 부른다', mdl.a && /°N .*°E/.test(mdl.a.name), mdl.a && mdl.a.name);
  T('5 ★★★ 15km 안 모형 점은 다리·수심에 쓰되 여유 0.3m', mdl.a && mdl.a.safe === true && mdl.a.pad === 0.3 && mdl.a.km < 15, mdl.a);
  T('5 ★★ 15km 넘는 모형 점은 다리·수심에 안 쓴다', mdl.b && mdl.b.model === true && mdl.b.safe === false, mdl.b);

  // 7 — 까닭
  const why = await pg.evaluate(() => {
    wxCur = { id:'t', lat: 37.5, lon: 127.0 };
    wxData = { m: { hourly: {}, _noSea: true } };
    return { cur: wxMissWhy('maxCurrent'), wave: wxMissWhy('maxWave') };
  });
  T('7 ★★ 조류가 없으면 「10km 안 조류예보 지점 없음」 이라고 까닭을 적는다', /10km 안에 조류예보 지점이 없어/.test(why.cur), why);
  T('7 ★★ 뭍·강 안쪽이면 그렇다고 적는다', /바다에서 떨어진 위치/.test(why.wave), why);

  // 6 — 둘레 바다: 가장 가까운 값
  const ring = await pg.evaluate(async () => {
    const pts = wxRingPts(34.0, 127.0);
    const 원래 = window.fetchTimeout;
    window.fetchTimeout = async () => ({ ok: true, json: async () => pts.map((p, i) => ({
      latitude: p[0], longitude: p[1], hourly: { wave_height: (i === 30 || i === 5) ? [0.5] : [null], wave_period: [null] } })) });
    const o = await wxMarineNear(34.0, 127.0);
    window.fetchTimeout = 원래;
    const far = Math.max(...pts.map(p => hav(34.0, 127.0, p[0], p[1])));
    return { n: pts.length, km: o && o._near && o._near.km, far };
  });
  T('6 ★ 둘레 자리가 48곳이다 (부르는 무게는 그대로)', ring.n === 48, ring);
  T('6 ★★ 가장 먼 둘레 자리가 23km 안이다', ring.far < 23, ring);
  T('6 ★★ 값이 있는 자리 중 가장 가까운 것을 고른다 (4km 고리가 14km 고리보다 먼저)', ring.km === 4, ring);

  await br.close(); server.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌다 — ' + e.message); process.exit(1); });
