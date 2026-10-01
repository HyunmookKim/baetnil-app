// 디자인 전수 보기 — 화면마다 새로 켜서(앞 화면이 겹치지 않게) 사장님 백업 자료로 그려 전체를 찍는다.
// 사장님 말씀(2026-09-30): 「몇몇 페이지만 고쳐놓고 디자인의 미학을 전혀 고려안하고 … 한 부분도 많네」
// ★ 짐작으로 고치지 않는다 — 그려 놓고 본다.
// 쓰는 법: node designshot.js ../www/index.html 백업.json 사진폴더 [폭=390] [크기들=normal,bigger]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const BK = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const OUT = process.argv[4]; fs.mkdirSync(OUT, { recursive: true });
const W = +(process.argv[5] || 390);
const SIZES = (process.argv[6] || 'normal,bigger').split(',');
const ONLY = process.argv[7] ? process.argv[7].split(',') : null;
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); }); });
const SCREENS = [
  ['01-today', `switchTab('home'); setHomeSub('today')`],
  ['02-weather', `switchTab('home'); setHomeSub('weather')`],
  ['03-check', `switchTab('home'); setHomeSub('check')`],
  ['04-cal', `switchTab('home'); setHomeSub('cal')`],
  ['05-news', `switchTab('home'); setHomeSub('news')`],
  ['06-stow', `switchTab('boat'); setBoatSubTab('stow')`],
  ['07-gear', `switchTab('boat'); setBoatSubTab('gear')`],
  ['08-maint', `switchTab('boat'); goCheck()`],
  ['09-mlog', `switchTab('boat'); goMaint('mlog')`],
  ['10-repair', `switchTab('boat'); goMaint('repair')`],
  ['11-fuel', `switchTab('boat'); goMaint('fuel')`],
  ['12-voyage', `switchTab('boat'); setBoatSubTab('voyage')`],
  ['13-docs', `switchTab('boat'); setBoatSubTab('docs')`],
  ['14-others', `switchTab('others')`],
  ['15-community', `switchTab('community')`],
  ['16-mr-voyage', `switchTab('boat'); setBoatSubTab('voyage'); setTimeout(() => openMR('voyage', ID.v), 350)`],
  ['17-mr-fuel', `switchTab('boat'); goMaint('fuel'); setTimeout(() => openMR('fuel', ID.f), 350)`],
  ['18-mr-run', `switchTab('boat'); goMaint('fuel'); setTimeout(() => openMR('run', ID.r), 350)`],
  ['19-mr-maint', `switchTab('boat'); goCheck(); setTimeout(() => openMR('maint', ID.m), 350)`],
  ['20-mr-gear', `switchTab('boat'); setBoatSubTab('gear'); setTimeout(() => openMR('gear', ID.g), 350)`],
  ['21-mr-repair', `switchTab('boat'); goMaint('repair'); setTimeout(() => openMR('repair', ID.rp), 350)`],
  ['22-locker', `switchTab('boat'); setBoatSubTab('stow'); setTimeout(() => openLocker(ID.lk), 350)`],
  ['23-settings', `openSettings()`],
  ['24-look', `openLook()`],
  ['25-account', `openAccount()`],
  ['26-noti', `openNoti()`],
  ['27-boatinfo', `openBoat('spec')`],
  ['28-trash', `openTrash()`]
];
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const errs = [];
  for(const [name, js] of SCREENS){
    if(ONLY && !ONLY.includes(name)) continue;
    for(const sz of SIZES){
      const ctx = await br.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: W, height: 800 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
      await ctx.addInitScript(() => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); }catch(_){} });
      const pg = await ctx.newPage();
      pg.on('pageerror', e => errs.push(name + ' ' + String(e).slice(0, 160)));
      await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
      await pg.waitForTimeout(1500);
      await pg.evaluate(([bk, sz]) => {
        try{ skipWelcome(); }catch(_){}
        window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
        unlocked = true;
        const b = JSON.parse(JSON.stringify(bk.boat));
        boats = [b]; currentBoatId = b.id; window.currentBoatId = b.id;
        ['items','trash','maint','repair','voyage','fuel','runs','contacts','checkt','lockers','shapes'].forEach(k => {
          if(Array.isArray(bk[k])) { try{ eval(k + ' = bk[k]'); }catch(_){} }
        });
        try{ save(); saveMR(); }catch(_){}
        try{ applyBoatName(); }catch(_){}
        try{ window.btLook.set('size', sz); }catch(_){}
        window.ID = {
          v: (voyage.find(v => !v.plan && (v.logs || []).length) || voyage[0] || {}).id,
          f: (fuel[0] || {}).id, r: (runs[0] || {}).id,
          m: (maint.find(x => x.typ === 'chk' || x.months || x.hrs) || {}).id,
          g: (maint.find(x => x.typ === 'gear') || {}).id,
          rp: (repair[0] || {}).id, lk: (lockers[0] || {}).id };
      }, [BK, sz]);
      await pg.waitForTimeout(500);
      await pg.evaluate(`try{ ${js}; }catch(e){ window.__err = String(e); }`);
      await pg.waitForTimeout(1300);
      // 열린 창이 있으면 그 창 안을 펼쳐 찍는다 (창은 화면 높이에 갇혀 있으므로 길이를 재서 화면을 늘린다)
      const h = await pg.evaluate(() => {
        let mx = document.documentElement.scrollHeight;
        document.querySelectorAll('.panel, [id$="Panel"], .sheet, .modal').forEach(p => {
          const cs = getComputedStyle(p); if(cs.display === 'none' || cs.visibility === 'hidden') return;
          const r = p.getBoundingClientRect(); if(r.width < 10) return;
          mx = Math.max(mx, p.scrollHeight + 120);
        });
        return Math.min(mx, 6000);
      });
      await pg.setViewportSize({ width: W, height: Math.max(800, h) });
      await pg.waitForTimeout(500);
      await pg.screenshot({ path: path.join(OUT, `${name}-${sz}-${W}.png`) });
      await ctx.close();
    }
  }
  console.log(JSON.stringify({ errs }, null, 1));
  await br.close(); server.close();
})().catch(e => { console.log('★ 멈춤 ' + e); process.exit(1); });
