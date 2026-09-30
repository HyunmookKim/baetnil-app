// ★★★ 업데이트해도 사람 기록이 안 바뀌는가 — 내보내기 전마다 돌린다 (2026-09-30 사장님 지시)
// 사장님 말씀: 「업데이트 할 때 함부로 과거에 있던 자료 뒤섞이게 만들지 마라. 이제는 실제로 유저들이 사용하는 거기 때문에
//              자료가 뒤섞여 가지고 과거에 자기가 썼던 거 병신같이 만들어지면은 사업 망한다.」
//
// 하는 일 — 백업 파일의 기록을 기기에 넣고(클라우드와 같다고 표시), 앱을 새 버전으로 다시 켠다.
//   켜기 → 클라우드에서 같은 기록을 받아 합치기 → 고침(runFormatFixers) → 저장 을 다 거친 뒤,
//   기록을 한 줄씩 처음 것과 비교한다. 생긴 줄 · 없어진 줄 · 바뀐 칸을 전부 적는다.
//   사람이 허락한 고침(ALLOWED)만 통과시키고, 나머지가 하나라도 있으면 실패다.
// 쓰는 법: node updatediff.js ../www/index.html 백업.json
// ★ 백업 파일은 검사 폴더에 두지 않는다 — 사장님 기록이다. 돌린 뒤 결과만 본다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const BK = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const ROOT = path.dirname(FILE);
// 사장님이 허락하신 고침 — 칸 이름: 까닭
const ALLOWED = {
  voyage: { hours: '5.24 빈 항해 엔진 시간 채우기 (사장님: 「만들어라」)', engineH: '5.24 같음' },
  boat:   { 'fuelSet.at': '5.24 옛 「지금 잔량」 시각 되살리기' },
};
const COLLS = ['items','trash','maint','repair','voyage','fuel','runs','contacts','vdocs','checkt','mrtrash','lockers','shapes'];
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
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  await pg.goto(url, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1800);
  // ① 옛 기기 상태를 만든다 — 기록 + 「클라우드와 같다」 자국
  await pg.evaluate(async (bk) => {
    try{ skipWelcome(); }catch(_){}
    const b = JSON.parse(JSON.stringify(bk.boat));
    boats = [b]; currentBoatId = String(b.id); window.currentBoatId = currentBoatId;
    const set = (k, v) => { try{ eval(k + ' = v'); }catch(_){} };
    ['items','trash','maint','repair','voyage','fuel','runs','contacts','vdocs','checkt','lockers','shapes'].forEach(k => set(k, JSON.parse(JSON.stringify(bk[k] || []))));
    mrTrash = JSON.parse(JSON.stringify(bk.mrtrash || []));
    await idbSet('boats', boats); await idbSet('curboat', currentBoatId);
    SYNC_COLLS.forEach(k => { cloudMark[k] = markFromSnap(snapOf(localColl(k) || [])); });
    markSave(); saveLocal(); try{ sysSave(); }catch(_){}
    await new Promise(r => setTimeout(r, 800));
  }, BK);
  // ② 새 버전으로 다시 켠다
  await pg.goto(url, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2500);
  const out = await pg.evaluate(async (bk) => {
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    unlocked = true;                       // 고침이 가장 많이 도는 쪽으로 본다
    // ③ 클라우드에서 같은 기록을 받아 합친다 (cloudPull 과 같은 차례)
    const C = k => JSON.parse(JSON.stringify(bk[k] || []));
    mrTrash = keepMine('mrtrash', C('mrtrash'));
    trash = keepMine('trash', migrate(C('trash')));
    ['maint','repair','voyage','fuel','runs','contacts','vdocs','checkt','lockers','shapes'].forEach(k => {
      const v = pullInto(k, C(k)); try{ eval(k + ' = v'); }catch(_){}
    });
    items = keepMine('items', migrate(C('items')));
    SYNC_COLLS.forEach(k => { const a = bk[k === 'mrtrash' ? 'mrtrash' : k]; if(Array.isArray(a)) cloudMark[k] = markFromSnap(snapOf(a)); });
    try{ runFormatFixers(); }catch(_){}
    saveLocal();
    await new Promise(r => setTimeout(r, 500));
    const o = { boat: JSON.parse(JSON.stringify(curBoat() || {})) };
    ['items','trash','maint','repair','voyage','fuel','runs','contacts','vdocs','checkt','lockers','shapes'].forEach(k => { try{ o[k] = JSON.parse(JSON.stringify(eval(k))); }catch(_){ o[k] = null; } });
    o.mrtrash = JSON.parse(JSON.stringify(mrTrash));
    o.ver = APP_VER;
    return o;
  }, BK);
  // ④ 한 줄씩 비교
  const flat = (o, p = '', m = {}) => { if(o && typeof o === 'object' && !Array.isArray(o)){
      for(const k in o) flat(o[k], p ? p + '.' + k : k, m); } else m[p] = JSON.stringify(o); return m; };
  const IGN = { _m:1, _u:1 };
  let bad = 0, ok = 0; const lines = [];
  const cmpRow = (coll, id, a, b) => {
    const fa = flat(a), fb = flat(b);
    const keys = new Set([...Object.keys(fa), ...Object.keys(fb)]);
    keys.forEach(k => {
      if(IGN[k.split('.')[0]]) return;
      if(fa[k] === fb[k]) return;
      // 빈 값 ↔ 없음은 같은 것으로 본다
      const e = v => v === undefined || v === '""' || v === 'null' || v === '[]' || v === '{}' || v === 'false';
      if(e(fa[k]) && e(fb[k])) return;
      const allow = (ALLOWED[coll] || {})[k];
      const l = `${coll} ${id} ${k}: ${String(fa[k]).slice(0, 60)} → ${String(fb[k]).slice(0, 60)}`;
      if(allow && e(fa[k])){ ok++; lines.push('  허락됨  ' + l + '  (' + allow + ')'); }
      else { bad++; lines.push('★ 바뀜  ' + l); }
    });
  };
  COLLS.forEach(c => {
    const A = new Map((BK[c] || []).map(x => [String(x.id), x]));
    const B = new Map((out[c] || []).map(x => [String(x.id), x]));
    A.forEach((x, id) => { if(!B.has(id)){ bad++; lines.push(`★ 없어짐  ${c} ${id} ${String(x.name || x.title || x.label || '').slice(0, 30)}`); } else cmpRow(c, id, x, B.get(id)); });
    B.forEach((x, id) => { if(!A.has(id)){ bad++; lines.push(`★ 생김  ${c} ${id} ${String(x.name || x.title || x.label || '').slice(0, 30)}`); } });
  });
  cmpRow('boat', 'boat', BK.boat, out.boat);
  console.log('버전 ' + out.ver);
  console.log(lines.slice(0, 200).join('\n') || '(바뀐 것 없음)');
  if(lines.length > 200) console.log(`… ${lines.length - 200}줄 더`);
  if(errs.length) console.log('페이지 오류:\n' + errs.join('\n'));
  console.log(`\n허락된 고침 ${ok} · ★ 허락 안 된 변화 ${bad}`);
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 멈춤 ' + e); process.exit(1); });
