// 5.28 — 배 연료 설정(L/시간·옛 「지금 잔량」·잔량 확인 방법)이 다른 기기로 가는가
// 사장님 말씀(2026-10-01): 「내가 어제 분명히 어플에서 잔량 고쳤는데 여기엔 왜 또 210리터남았고
//   시간당 리터도 7.2로 고쳤는데 저리 나오냐」 — 배 설정이 클라우드로 안 올라가 고친 기기에만 남았다.
// 쓰는 법: node fuelsetsynclive.js ../www/index.html
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const ROOT = path.dirname(FILE);
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x !== undefined ? ' — ' + JSON.stringify(x).slice(0, 300) : '')); } };
const server = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); }); });
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 } });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
  await ctx.addInitScript(() => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); }catch(_){} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  const R = await pg.evaluate(async () => {
    try{ skipWelcome(); }catch(_){}
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    unlocked = true;
    const out = {};
    out.inFields = (window.__boatFields || []).indexOf('fuelSet') >= 0;
    const ups = [];
    window.__user = { uid: 'u1', email: 'owner@example.com' };
    window.__saveBoat = async b => { ups.push(JSON.parse(JSON.stringify(b.fuelSet || null))); return true; };
    // 진짜 배처럼 등급을 깔고 u1 을 선주로 둔다 (배 정보 쓰기 권한이 있어야 올린다)
    const 틀 = { id: 'B1', name: '견본 배', type: 'sail', members: {}, memberNames: {}, ranks: {} };
    try{ seedRanks(틀); 틀.members = { u1: ownerRank(틀).id }; }catch(_){ 틀.members = { u1: 'owner' }; }
    const mk = fs => Object.assign(JSON.parse(JSON.stringify(틀)), { fuelSet: fs });   // 두 기기가 같은 배를 본다
    const run = async (localFs, cloudFs) => {
      ups.length = 0;
      boats = [mk(localFs ? JSON.parse(JSON.stringify(localFs)) : undefined)]; currentBoatId = 'B1'; window.currentBoatId = 'B1';
      const cb = mk(cloudFs ? JSON.parse(JSON.stringify(cloudFs)) : undefined); if(!cloudFs) delete cb.fuelSet;
      window.__myBoats = async () => [cb];
      await mergeCloudBoats();
      await new Promise(r => setTimeout(r, 100));
      return { local: JSON.parse(JSON.stringify(boats[0].fuelSet || null)), ups: ups.slice() };
    };
    const 옛폰 = { lph: 7.2, mark: { left: 0, hours: 59.7, date: '2026-09-30' } };
    out.A = await run(옛폰, null);                                   // 폰에만 있던 옛 값, 클라우드 없음
    out.B = await run({ lph: 7.2, _at: 1000 }, { lph: 5, _at: 2000 }); // 클라우드가 나중
    out.C = await run({ lph: 7.2, _at: 3000 }, { lph: 5, _at: 2000 }); // 이 기기가 나중
    out.D = await run(옛폰, { how: 'gauge', _at: 2000 });              // 옛 값 + 클라우드에 다른 칸
    out.E = await run(null, { lph: 7.2, mark: { left: 0, hours: 59.7 }, _at: 2000 }); // 컴퓨터(값 없음)가 받음
    out.F = await run(null, null);                                  // 둘 다 없음 — 아무것도 안 올림
    // 고치면 바로 올라간다
    ups.length = 0;
    boats = [mk(undefined)]; currentBoatId = 'B1';
    try{ fuelSetPut({ lph: 6.5 }); }catch(e){ out.putErr = String(e); }
    await new Promise(r => setTimeout(r, 100));
    out.G = { ups: ups.slice(), local: boats[0].fuelSet };
    // 권한 없는 크루원 — 올리지 않는다
    ups.length = 0;
    const crew = mk(undefined); crew.members = { u1: 'nobody-rank' }; boats = [crew]; currentBoatId = 'B1';
    try{ fuelSetPut({ lph: 4 }); }catch(_){}
    await new Promise(r => setTimeout(r, 100));
    out.H = { ups: ups.slice(), local: boats[0].fuelSet };
    return out;
  });
  T('배 설정 올리는 칸 목록에 연료 설정이 있다', R.inFields);
  T('폰에만 있던 옛 값(7.2·잔량 0)을 지키고 클라우드로 올린다', R.A.local && R.A.local.lph === 7.2 && R.A.local.mark && R.A.local.mark.left === 0
    && R.A.ups.length === 1 && R.A.ups[0].lph === 7.2 && R.A.ups[0]._at > 0, R.A);
  T('클라우드 것이 나중이면 클라우드 것을 받는다', R.B.local.lph === 5 && R.B.ups.length === 0, R.B);
  T('이 기기 것이 나중이면 지키고 올린다', R.C.local.lph === 7.2 && R.C.ups.length === 1, R.C);
  T('옛 값과 클라우드 값이 다른 칸이면 둘 다 남긴다', R.D.local.lph === 7.2 && R.D.local.how === 'gauge' && R.D.local.mark && R.D.ups.length === 1, R.D);
  T('값이 없는 기기(컴퓨터)는 클라우드 것을 받는다 — 7.2·잔량 0', R.E.local && R.E.local.lph === 7.2 && R.E.local.mark.left === 0 && R.E.ups.length === 0, R.E);
  T('둘 다 없으면 아무것도 안 올린다', !R.F.local && R.F.ups.length === 0, R.F);
  T('L/시간을 고치면 바로 클라우드로 올라간다', R.G.ups.length === 1 && R.G.ups[0].lph === 6.5 && R.G.ups[0]._at > 0, R.G);
  T('배 정보 쓰기 권한이 없으면 올리지 않는다(규칙이 막으므로 이 기기에만 남는다)', R.H && R.H.ups.length === 0 && R.H.local.lph === 4, R.H);
  T('페이지 오류 없음', errs.length === 0 && !R.putErr, errs.concat(R.putErr || []));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close(); server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('★ 멈춤 ' + e); process.exit(1); });
