// ★★★ 5.10 — 러시아 극동·먼 바다 해상경보 (WMO METAREA XI · 일본 기상청 WWJP90)
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
// 수집기의 파서로 만든 것과 같은 모양
const COL = ['/home/claude/gh/scripts/collect_metarea.js', path.join(__dirname, '../../gh/scripts/collect_metarea.js')].find(f => fs.existsSync(f));
const SAMPLE = `WWJP90 RJTD 221200
WARNING AND SUMMARY 221200.
WARNING VALID 231200.
GALE WARNING.
DEVELOPING LOW 1008 HPA
AT 44N 134E SEA OF JAPAN MOVING EAST 20 KNOTS.
EXPECTED WINDS 30 TO 35 KNOTS WITHIN 200 MILES OF LOW WITHIN NEXT 12
HOURS.
WARNING.
DENSE FOG OBSERVED LOCALLY OVER SEA OF OKHOTSK.
SUMMARY.
JAPAN METEOROLOGICAL AGENCY.=`;
let MW = null;
if(COL){ const m = require(COL); MW = { ok:true, read: new Date().toISOString(), areas: m.AREAS, ...m.parse(SAMPLE) }; }
T('★ 수집기 파서가 경보 둘을 읽는다 (강풍 원 1 · 안개 해역 1)', MW && MW.warnings.length === 2 && MW.warnings[0].circles && MW.warnings[1].areas, MW && MW.warnings);
T('★ 앱이 먼 바다 경보를 받는다', /DATA_BASE \+ 'warn-metarea11\.json/.test(src) && /if\(wxSpotFarSea\(\)\) await loadMW\(\);/.test(src));
T('★ 일본 해상경보도 보고 있는 날씨 지점 해역을 따른다', /function seaHere\(\)/.test(src) && /wxSpotInJP\(\)/.test(src));
T('★ 출처를 적는다', /출처 — WMO METAREA XI 먼바다 경보/.test(src));

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', timezoneId:'Asia/Seoul', viewport:{width:390,height:800} });
  const pg = await ctx.newPage();
  await pg.route('**/*.json*', r => /warn-metarea11/.test(r.request().url())
    ? r.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(MW || {}) })
    : r.fulfill({ status:200, body:'{}' }));
  await pg.goto(url, { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1200);
  const r = await pg.evaluate(async () => {
    await loadMW();
    const out = {};
    wxCur = { id:'v', lat: 43.11, lon: 131.88 };                 // 블라디보스토크 — 44N 134E 에서 약 110해리
    out.far = wxSpotFarSea(); out.vlad = mwFor(43.11, 131.88).map(w => w.kind); out.box = mwAlertBox();
    wxCur = { id:'k', lat: 46.64, lon: 142.76 };                 // 코르사코프 — 원 밖, 오호츠크 상자 안
    out.kors = mwFor(46.64, 142.76).map(w => w.kind);
    wxCur = { id:'p', lat: 53.0, lon: 158.6 };                   // 페트로파블롭스크 — 안개 해역 상자 밖? (오호츠크 상자 동쪽 끝 163)
    out.pk = mwFor(53.0, 158.6).length;
    wxCur = { id:'y', lat: 34.74, lon: 127.68 };                 // 여수 — 한국 해역은 이것을 안 쓴다
    out.kr = wxSpotFarSea(); out.krBox = mwAlertBox();
    return out;
  });
  T('★★ 블라디보스토크는 먼 바다 경보를 쓰는 자리다', r.far === true, r);
  T('★★★ 블라디보스토크에 강풍 경보가 걸린다 (중심에서 200해리 안)', r.vlad.length === 1 && /GALE/.test(r.vlad[0]), r.vlad);
  T('★★ 화면 상자가 「발효 중」 과 「강풍 경보」 를 적는다', /먼바다 해상경보 발효 중/.test(r.box) && /강풍 경보/.test(r.box), String(r.box).slice(0, 200));
  T('★★ 코르사코프는 오호츠크해 안개 경보에 걸린다', r.kors.length === 1 && r.kors[0] === 'WARNING', r.kors);
  T('★★ 한국 해역(여수)은 이것을 안 쓴다 (한국 기상청 특보를 쓴다)', r.kr === false && r.krBox === '', r);
  await br.close(); server.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌다 — ' + e.message); process.exit(1); });
