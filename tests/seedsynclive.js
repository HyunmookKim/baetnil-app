// 5.27 — 앱이 깐 기본 정기점검이 사람 기록을 덮던 것 (2026-09-30 사장님 지적)
// 사장님 말씀: 「어느순간에 업데이트 하면서 내가 정기점검 최신화 해논게 날라간거 같은데 이거 뭐지?」
// 9/13 에 실제로 일어난 차례를 진짜 앱 함수로 그대로 밟는다 (견본 자료 — 사장님 기록 아님).
// 쓰는 법: node seedsynclive.js ../www/index.html
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const ROOT = path.dirname(FILE);
let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };
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
    // 옛 버전에도 돌릴 수 있게 (그 버전에는 이 표가 없다)
    const SFS = (typeof seedFreshSet === 'function') ? seedFreshSet : () => {};
    const SFG = (typeof seedFreshGet === 'function') ? seedFreshGet : () => ({ maint: ['없음'] });
    try{ skipWelcome(); }catch(_){}
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    unlocked = true;
    const OLD = Date.parse('2026-08-31T12:22:50Z');
    const A = { id:'boatA', name:'견본 배', type:'sail', members:{}, ranks:{} };
    // ── 사람이 쓰던 배 — 엔진오일·냉각수를 고쳐 쓰고, 연료필터(m03)는 지웠다
    const 내엔진오일 = { id:'m01', grp:'엔진', name:'엔진오일 교체(고쳐 씀)', months:1, lastDate:'2026-08-18',
                        note:'30시간 뒤 다시 확인', gearId:'g1', _m: OLD };
    const 내냉각수 = { id:'m07', grp:'엔진', name:'냉각수(부동액) 교체', months:24, lastDate:'2026-08-12',
                      history:[{date:'2026-07-02'}], gearId:'g1', _m: OLD };
    const 엔진 = { id:'g1', typ:'gear', name:'엔진', sys:'추진', _m: OLD };
    const 내항목 = { id:'u1', grp:'기타', name:'물탱크 물채움', months:1, _m: OLD };
    const 클라우드정비 = [내엔진오일, 내냉각수, 엔진, 내항목].map(x => JSON.parse(JSON.stringify(x)));
    const 클라우드휴지통 = [{ id:'t1', kind:'maint', data:{ id:'m03', name:'연료필터 교체' }, delAt:'2026-08-20' }];
    boats = [A]; currentBoatId = A.id; window.currentBoatId = A.id;
    maint = JSON.parse(JSON.stringify(클라우드정비)); mrTrash = JSON.parse(JSON.stringify(클라우드휴지통));
    saveLocal();
    await new Promise(r => setTimeout(r, 200));

    // ── 9/13 — 기기 안 기록이 잠깐 「배 없음」 이 되었다 (앱이 기본 항목을 새로 깜)
    boats = []; currentBoatId = null; window.currentBoatId = null;
    await loadBoatData(); saveLocal();
    const 깐것 = maint.map(x => String(x.id));
    const 찍힌기본 = maint.filter(x => x._m).map(x => x.id);
    // ── 배가 돌아오고 클라우드에서 받아온다 (cloudPull 과 같은 차례: 휴지통 먼저)
    boats = [A]; currentBoatId = A.id; window.currentBoatId = A.id;
    saveLocal();
    mrTrash = keepMine('mrtrash', JSON.parse(JSON.stringify(클라우드휴지통)));
    maint = pullInto('maint', JSON.parse(JSON.stringify(클라우드정비)));
    cloudMark.maint = markFromSnap(snapOf(클라우드정비));
    saveLocal();
    const 합친것 = JSON.parse(JSON.stringify(maint));

    // ── 새 배 — 클라우드가 비어 있으면 기본 항목은 그대로 두고 올린다
    const B = { id:'boatB', name:'새 배', type:'sail', members:{}, ranks:{} };
    boats = [A, B]; await switchBoat(B.id).catch(()=>{});
    saveLocal();
    const 새배 = { n: maint.length, 찍힘: maint.filter(x => x._m).length, 안올린것: unsentCount() };
    const 새배합침 = pullInto('maint', []);
    // 새 배에서 사람이 기본 항목 하나를 고치면 — 그것은 고친 것으로 찍히고 이긴다
    const m04 = maint.find(x => x.id === 'm04'); m04.lastDate = '2026-09-01'; saveLocal();
    const 고친m04 = JSON.parse(JSON.stringify(m04));
    const 옛m04 = Object.assign({}, maintDefaults().find(x => x.id === 'm04'), { _m: OLD });
    const 이긴m04 = keepMine('maint', [옛m04]).find(x => x.id === 'm04');
    // ── 기본 정기점검을 전부 지운 배 — 클라우드 정비 칸이 비어 있어도 새 기기가 도로 깔지 않는다
    const C = { id:'boatC', name:'다 지운 배', type:'sail', members:{}, ranks:{} };
    // ★ 기록이 빈 배를 열면 「배 없음」 때 깐 기본 항목이 옛 공용 칸에서 넘어온다 — 이것도 앱이 깐 것으로 알아봐야 한다
    boats = [A, B, C]; await switchBoat(C.id).catch(()=>{});
    const 깐C = maint.length;
    mrTrash = keepMine('mrtrash', maintDefaults().map((x, i) => ({ id:'tc' + i, kind:'maint', data:{ id:x.id, name:x.name }, delAt:'2026-08-01' })));
    maint = pullInto('maint', []);
    const 다지운배 = { 깐C, 남은것: maint.length };
    // ── 두 번째 배를 만들 때처럼 기본 항목을 곧바로 새로 까는 자리 (loadBoatData 를 안 거침)
    maint = maintDefaults(); saveLocal();
    const 곧바로깐것찍힘 = maint.filter(x => x._m).length;
    // ── 5.26 까지 이미 「고침」 으로 찍혀 버린 기본 항목이 기기에 남아 있어도 클라우드의 사람 기록이 이긴다
    mrTrash = [];
    maint = [Object.assign({}, maintDefaults().find(x => x.id === 'm01'), { _m: Date.now() })];
    const 찍힌기본대사람 = keepMine('maint', [JSON.parse(JSON.stringify(내엔진오일))]).find(x => x.id === 'm01');
    // ── 배를 바꿀 때 — 그 배에 저장돼 있던 기록이 「방금 고친 것」 으로 다시 찍히지 않는다
    const D = { id:'boatD', name:'둘째 배', type:'sail', members:{}, ranks:{} };
    boats = [A, B, C, D];

    const 키 = (function(){ const k = window.currentBoatId; window.currentBoatId = D.id; currentBoatId = D.id; const r = bkey('maint'); window.currentBoatId = k; currentBoatId = k; return r; })();
    await idbSet(키, [{ id:'d1', grp:'기타', name:'둘째 배 항목', months:3, _m: OLD }]);
    await switchBoat(D.id).catch(()=>{});
    saveLocal();
    const d1 = maint.find(x => x.id === 'd1');
    // ── 이미 기기에 있던 줄은 기본 항목과 똑같고 휴지통에 있어도 안 건드린다 (업데이트가 보이던 기록을 바꾸면 안 된다)
    //    9/13 에 되살아나 지금 사장님 화면에 떠 있는 줄이 이런 모양이다.
    SFS('checkt', null);
    checkt = checkDefaults(); const 있던줄 = String(checkt[1].id);
    mrTrash = [{ id:'tk', kind:'check', data:{ id: 있던줄 }, delAt:'2026-08-02' }];
    const 합친점검 = keepMine('checkt', JSON.parse(JSON.stringify(checkt)));
    const 빈점검 = pullInto('checkt', []);
    const 있던줄남음 = 합친점검.some(x => String(x.id) === 있던줄) && 빈점검.some(x => String(x.id) === 있던줄);
    // ── 진짜 cloudPull 을 한 번 돌리면 「방금 깐 기본 항목」 표가 지워진다 (그 뒤로는 보통 기록과 같다)
    SFS('maint', maintDefaults());
    const 가짜 = { pull: async () => ({ seeded: false, colls: { maint: { mode:'full', rows: JSON.parse(JSON.stringify(클라우드정비)), n: 4, u:'' } } }),
                  pullColl: async () => ({ mode:'full', rows: [], n: 0, u: '' }), push: async () => ({ ok: new Set(), failed: [] }) };
    let 표지움 = null;
    try{ eval('cloud = 가짜'); await cloudPull(); 표지움 = !SFG().maint; }catch(e){ 표지움 = 'err ' + e; }
    try{ eval('cloud = null'); }catch(_){}
    return { 깐것, 찍힌기본, 합친것, 새배, 새배합침: 새배합침.length, 고친m04, 이긴m04, OLD, 다지운배, 있던줄남음, 표지움,
             곧바로깐것찍힘, 찍힌기본대사람, d1 };
  });

  const m = id => R.합친것.find(x => String(x.id) === id);
  console.log('배 없음 때 깐 기본 항목:', R.깐것.join(' '));
  T('배 없음 때 깐 기본 항목이 「방금 고친 것」 으로 찍히지 않는다', R.찍힌기본.length === 0);
  T('고쳐 쓴 엔진오일(m01)이 살아남는다 — 마지막 날짜 8/18', m('m01') && m('m01').lastDate === '2026-08-18');
  T('엔진오일 메모·이름도 사람 것이다', m('m01') && m('m01').note === '30시간 뒤 다시 확인' && /고쳐 씀/.test(m('m01').name));
  T('냉각수(m07)가 살아남고 엔진 연결도 남는다', m('m07') && m('m07').lastDate === '2026-08-12' && m('m07').gearId === 'g1');
  T('냉각수 지난 이력도 남는다', m('m07') && (m('m07').history || []).length === 1);
  T('지웠던 기본 항목(연료필터 m03)이 되살아나지 않는다', !m('m03'));
  T('클라우드에 없는 기본 항목(m16 등)을 쓰던 배에 몰래 더하지 않는다', !m('m16') && !m('m05'));
  T('사람이 만든 항목과 장비는 그대로', !!m('u1') && !!m('g1'));
  T('받아온 줄은 「고침」 으로 다시 안 찍힌다 (_m 그대로)', R.합친것.filter(x => /^(m01|m07|u1|g1)$/.test(String(x.id))).every(x => x._m === R.OLD));
  T('새 배는 기본 항목이 그대로 깔린다', R.새배.n >= 10);
  T('새 배의 기본 항목도 「고침」 으로 안 찍힌다', R.새배.찍힘 === 0);
  T('새 배의 기본 항목은 아직 안 올린 것으로 센다 (올라간다)', R.새배.안올린것 >= R.새배.n);
  T('클라우드가 비었으면 새 배 기본 항목을 안 뺀다', R.새배합침 === R.새배.n);
  T('사람이 고친 기본 항목은 고친 것으로 찍힌다', !!R.고친m04._m && R.고친m04._m > R.OLD);
  T('사람이 고친 기본 항목은 클라우드의 옛 기본값을 이긴다', R.이긴m04 && R.이긴m04.lastDate === '2026-09-01');
  T('기본 항목을 다 지운 배 — 클라우드 칸이 비어도 새 기기가 도로 깔지 않는다', R.다지운배.깐C > 0 && R.다지운배.남은것 === 0);
  T('기본 항목을 곧바로 새로 깔아도 「고침」 으로 안 찍힌다', R.곧바로깐것찍힘 === 0);
  T('이미 「고침」 으로 찍힌 기본 항목(5.26 까지)도 클라우드의 사람 기록을 못 이긴다', R.찍힌기본대사람 && R.찍힌기본대사람.lastDate === '2026-08-18');
  T('배를 바꾸면 그 배의 저장된 기록이 「고침」 으로 다시 안 찍힌다', R.d1 && R.d1._m === R.OLD);
  T('이미 기기에 있던 줄은 기본 항목과 같고 휴지통에 있어도 그대로 둔다', R.있던줄남음 === true);
  T('클라우드와 한 번 합치면 「방금 깐 기본 항목」 표가 지워진다', R.표지움 === true);
  if(R.표지움 !== true) console.log('   ', R.표지움);
  T('페이지 오류 없음', errs.length === 0);
  if(errs.length) console.log(errs.join('\n'));
  console.log(`\n${pass} 통과 · ${fail} 실패`);
  await br.close(); server.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('★ 멈춤 ' + e); process.exit(1); });
