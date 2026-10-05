// 5.40 — 사장님 (2026-10-05): 「3은 당연히 고쳐야지 / 1은 사용자가 정할수 있게 / 2는 씨발 왜 4000개면 줄이냐?
//   다른데 확인 후 우리어플에 가장 최적화된 방법으로 고쳐라」
//   ① 계정 삭제가 실패해도 「계정을 지웠습니다」 라고 하던 것
//   ② 기록 간격을 사람이 정한다 (OsmAnd 「기록 간격」 값 그대로)
//   ③ 4,000점에서 줄이던 것을 없애고, 클라우드 문서 1MiB 는 올릴 때만 맞춘다
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'www', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const R = p => { try{ return fs.readFileSync(path.join(__dirname, '..', p), 'utf8'); }catch(_){ return ''; } };
const svc = R('android/app/src/main/java/kr/baetnil/app/BaetnilTrackService.java');
const plug = R('android/app/src/main/java/kr/baetnil/app/BaetnilTrack.java');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 300) : '')); } };
function grab(name){
  const a = src.indexOf('function ' + name + '(');
  if(a < 0) return '';
  let d = 0, j = src.indexOf('{', a);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(a, j);
}

// ── ① 계정 삭제
const dw = grab('doWipe');
T('①-1 인터넷이 없으면 시작하지 않는다', /navigator\.onLine === false[\s\S]{0,200}return;/.test(dw));
T('①-2 계정을 못 지웠으면(ok 가 아니면) 기기 기록을 지우지 않고 멈춘다',
  /if\(r !== 'ok'\)\{[\s\S]{0,400}return;\s*\}\s*\/\/ 5\)/.test(dw) && dw.indexOf("if(r !== 'ok')") < dw.indexOf('await wipeLocal()'));
T('①-3 못 지웠다고 알리고 다시 시도 단추', /삭제하지 못했습니다\.[\s\S]{0,200}인터넷 연결을 확인한 뒤 다시 시도해 주세요\.[\s\S]{0,300}onclick="doWipe\(\)"[\s\S]{0,40}다시 시도/.test(dw));
// 실제로 돌려 본다 — removeAuth 가 'fail' 이면 wipeLocal 이 안 불리고 「계정을 지웠습니다」 도 안 뜬다
{
  const run = async (res) => {
    let wiped = 0, said = '';
    const ctx = { tell(){}, t: x => x, esc: x => x, retryBoatDels: async()=>{}, myOwnBoats: () => [],
      delBoatData: async()=>{}, cloudDelBoat: async()=>{}, wipeLocal: async()=>{ wiped++; },
      wipeSay: m => { said += m; }, navigator: { onLine: true }, location: { reload(){} }, setTimeout(){},
      window: { __account: { minePosts: async()=>{}, wipeUserDoc: async()=>{}, removeAuth: async()=>res } } };
    const f = new Function(...Object.keys(ctx), 'async ' + dw + '; return doWipe();');
    await f(...Object.values(ctx));
    return { wiped, said };
  };
  (async () => {
    const a = await run('fail'), b = await run('none'), c = await run('ok'), d = await run('relogin');
    T('①-4 fail → 기기 기록 안 지움 · 「계정을 지웠습니다」 안 뜸', a.wiped === 0 && !/계정을 지웠습니다/.test(a.said), JSON.stringify(a));
    T('①-5 none(로그인 정보 없음) → 기기 기록 안 지움', b.wiped === 0 && !/계정을 지웠습니다/.test(b.said), JSON.stringify(b));
    T('①-6 ok → 기기 기록 지우고 「계정을 지웠습니다」', c.wiped === 1 && /계정을 지웠습니다/.test(c.said));
    T('①-7 relogin → 예전처럼 다시 로그인 안내 (기기 기록 안 지움)', d.wiped === 0 && /다시 로그인/.test(d.said));
    part2();
  })();
}

function part2(){
// ── ② 기록 간격
T('②-1 고르는 값 = OsmAnd SECONDS(0 뺌) + MINUTES', /const TRK_INT_OPTS = \[1, 2, 3, 5, 10, 15, 20, 30, 60, 90, 120, 180, 300\];/.test(src));
T('②-2 기본 5초', /const TRK_OSM_MS\s*= 5000;/.test(src) && /return TRK_OSM_MS \/ 1000;/.test(grab('trkIntSec')));
T('②-3 설정 › 항적 › 기록 간격', /lbl\(t\('항적'\)\)\s*\+ row\(t\('기록 간격'\), trkIntLabel\(trkIntSec\(\)\), 'openTrkInt\(\)'\)/.test(grab('openSettings')));
T('②-4 고르는 화면은 이름과 값뿐 (설명 문장 없음)', !/mrnone/.test(grab('openTrkInt')) && /선택됨/.test(grab('openTrkInt')));
T('②-5 화면 말 「기록 간격」 은 OsmAnd 한국어에서 (wordsrc)', /"기록 간격": "OsmAnd/.test(R('tests/wordsrc.json')));
T('②-6 네 나라 말', (src.match(/'기록 간격':'(Logging interval|Интервал записи трека|記録間隔)'/g) || []).length === 3);
T('②-7 기록 장치에 간격을 넘긴다', /ms: trkIntMs\(\)/.test(grab('trkBufStart')));
T('②-8 안드로이드 부품 → 서비스로', /putExtra\("ms", \(long\) call\.getInt\("ms", 5000\)\)/.test(plug));
T('②-9 안드로이드 서비스가 그 간격으로 위성 위치를 받는다', /requestLocationUpdates\(LocationManager\.GPS_PROVIDER, askMs, 0f, this\)/.test(svc) && /askMs = Math\.max\(ASK_MS_MIN, Math\.min\(ASK_MS_MAX, ms\)\)/.test(svc));
T('②-10 쉬는 중에 간격을 바꿔도 위성을 켜지 않는다', /if \(!paused\) \{ keepAwake\(\); askLocations\(\); \}/.test(svc));
T('②-11 남기는 간격 = 정한 간격, 같은 간격이면 남긴다(>=)', /dt >= trkIntMs\(\)/.test(grab('trkOsmWhy')) && /tt - \(Date\.parse\(L\.t\) \|\| 0\) >= 간격/.test(grab('trkBufDrain')));
T('②-12 간격을 늘려도 이미 남긴 점은 안 지운다', /if\(!남긴\.has\(String\(p\.t\)\)\)/.test(grab('trkBufDrain')));
T('②-13 기록 중에 바꾸면 안드로이드 기록 장치에 바로 적용', /trkNow\.nat && !trkIsIOS\(\)\)\{ await trkBufStart\(\); \}/.test(grab('trkIntPick')));

// ── ③ 줄이지 않기 · 1MiB
{ const code = src.replace(/\/\/[^\n]*/g, ''); T('③-1 4,000점 상한(TRK_MAX)이 없다', !/TRK_MAX/.test(code)); }
T('③-2 기록 중 점을 줄이지 않는다', !/trkSimplify/.test(grab('trkPush')) && !/trkSimplify/.test(grab('trkBufDrain')));
// 함수들을 실제로 돌린다
const env = new Function(['trkVarEnc','trkVarDec','trkEncOrder','trkEnc','trkDec','trkChunkRead','fsStrSize','fsSize','fsDocSize','trkSimplify','voyCloudBody','voyKeepLocalTrk','pubFit']
  .map(grab).join('\n') + '\nconst FS_DOC_MAX = 1048576; const TRK_ENC_KEYS = { la:1, lo:1, t:1, ac:1, sp:1 }; var voyage = [];'
  + '\nreturn { trkEnc, trkDec, trkChunkRead, fsDocSize, voyCloudBody, voyKeepLocalTrk, pubFit, setV: v => { voyage = v; } };')();
// 사장님 9/30 백업의 항적 + 만든 긴 항적
let real = [];
try{ const bk = JSON.parse(fs.readFileSync(process.env.BK || '/root/.claude/uploads/b2d0b648-0154-505a-aa4d-c7a93c03288c/5cf212d5-baetnil-backup-20260930.json', 'utf8'));
  (bk.voyage || []).forEach(v => { if(Array.isArray(v.trk) && v.trk.length > 1) real.push(v.trk); }); }catch(_){}
T('③-3 실제 항적이 그대로 되돌아온다 (짧은 글자 ↔ 점)', real.length > 0 && real.every(a => JSON.stringify(env.trkDec(env.trkEnc(a))) === JSON.stringify(a.map(p => { const o = { la:p.la, lo:p.lo, t:p.t }; if(p.ac != null) o.ac = p.ac; if(p.sp != null) o.sp = p.sp; return o; }))), real.length);
const mk = (n, stepMs) => { const out = []; let la = 34.74, lo = 127.74; const t0 = Date.parse('2026-10-05T00:00:00.000Z');
  for(let i = 0; i < n; i++){ la += (Math.sin(i / 50) * 0.0002); lo += 0.00011;
    const p = { la:+la.toFixed(5), lo:+lo.toFixed(5), t:new Date(t0 + i * stepMs).toISOString(), ac: 3 + (i % 7) };
    if(i % 3) p.sp = Math.round((2 + Math.cos(i / 9)) * 10) / 10; out.push(p); } return out; };
const big = mk(60000, 5000);   // 5초 간격 약 83시간 (3.5일)
const z = env.trkEnc(big);
T('③-4 긴 항적(6만 점)도 그대로 되돌아온다', z && JSON.stringify(env.trkDec(z)) === JSON.stringify(big));
const jsonLen = JSON.stringify(big).length;
T('③-5 짧은 글자가 JSON 의 1/5 보다 작다', z && z.length * 5 < jsonLen, (z && z.length) + ' / ' + jsonLen);
T('③-6 모르는 칸이 든 점은 짧은 글자로 안 바꾼다(자료 보존)', env.trkEnc([{ la:34.7, lo:127.7, t:'2026-10-05T00:00:00.000Z', x:1 }]) === null);
T('③-7 소수 여섯째 자리 좌표는 안 바꾼다(자료 보존)', env.trkEnc([{ la:34.123456, lo:127.7, t:'2026-10-05T00:00:00.000Z' }]) === null);
T('③-8 기록 중 묶음: 짧은 글자와 옛 JSON 둘 다 읽는다', JSON.stringify(env.trkChunkRead(env.trkEnc(big.slice(0, 200)))) === JSON.stringify(big.slice(0, 200))
  && JSON.stringify(env.trkChunkRead(JSON.stringify(big.slice(0, 3)))) === JSON.stringify(big.slice(0, 3)));
const P = ['boats', 'b1', 'voyage', 'v1'];
const small = { id:'v1', date:'2026-10-05', trk: big.slice(0, 500) };
T('③-9 작은 항해는 예전 모양 그대로 올라간다(예전 앱도 읽게)', JSON.stringify(env.voyCloudBody(small, P)) === JSON.stringify(small));
const mid = { id:'v1', date:'2026-10-05', trk: big.slice(0, 20000) };
const bm = env.voyCloudBody(mid, P);
T('③-10 1MiB 넘는 항해 → 짧은 글자(trkz), 점은 하나도 안 줄임', bm.trkz && !bm.trk && !bm.trkCut && JSON.stringify(env.trkDec(bm.trkz)) === JSON.stringify(mid.trk)
  && env.fsDocSize(P, Object.assign({ _u:'2026-10-05T00:00:00.000Z' }, mid)) > 1048576 && env.fsDocSize(P, bm) <= 1048576);
const huge = { id:'v1', date:'2026-10-05', trk: mk(400000, 1000) };   // 1초 간격 약 4.6일
const bh = env.voyCloudBody(huge, P);
T('③-11 짧은 글자로도 넘으면 클라우드 사본만 들어갈 만큼 줄이고 표시(trkCut)', bh.trkCut === 400000 && env.fsDocSize(P, Object.assign({ _u:'x'.repeat(24) }, bh)) <= 1048576, bh.trkCut);
T('③-12 원래 기록(기기)은 안 건드린다', huge.trk.length === 400000);
// 받을 때 — 줄인 사본이면 기기의 원래 기록을 지킨다
env.setV([{ id:'v1', trk: huge.trk }]);
const cutRow = Object.assign({}, bh, { trk: env.trkDec(bh.trkz) }); delete cutRow.trkz;
const kept = env.voyKeepLocalTrk([cutRow])[0];
T('③-13 받을 때 줄인 사본이면 기기의 원래 기록을 지킨다', kept.trk === huge.trk && !('trkCut' in kept));
T('③-14 받을 때 짧은 글자를 점으로 되돌린다(모듈)', /typeof o\.trkz === 'string' && typeof window\.trkDec === 'function'/.test(src));
T('③-15 올릴 때 항해마다 맞춘다(모듈)', /window\.voyCloudBody\(i, \['boats', String\(window\.currentBoatId/.test(src));
T('③-16 받아 합치기 전에 기기 기록을 지킨다', /r\.voyage = voyKeepLocalTrk\(r\.voyage\)[\s\S]{0,120}voyage\s+= pullInto\('voyage',\s+r\.voyage\)/.test(src));
// 공개 사본
const pd = { name:'x', voyage: [ { id:'v1', trk: big.map(p => ({ lat:+p.la.toFixed(4), lon:+p.lo.toFixed(4) })) } ] };
const pf = env.pubFit(JSON.parse(JSON.stringify(pd)), { id:'b1' });
T('③-17 공개 사본이 1MiB 를 넘으면 들어갈 만큼만 줄인다', env.fsDocSize(['boatPublic','b1'], pd) > 1048576 && env.fsDocSize(['boatPublic','b1'], pf) <= 1048576 && pf.voyage[0].trk.length > 100);
const ps = { name:'x', voyage: [ { id:'v1', trk: pd.voyage[0].trk.slice(0, 300) } ] };
T('③-18 들어가면 공개 사본도 그대로', JSON.stringify(env.pubFit(JSON.parse(JSON.stringify(ps)), { id:'b1' })) === JSON.stringify(ps));
T('③-19 pushPublic 이 pubFit 을 지난다', /const data = pubFit\(buildPublic\(b\), b\);/.test(src));

T('판 5.40', /const APP_VER = '5\.40';/.test(src));
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
}
