// 글자 크기 전수 조사 — 「보통」 과 「크게」 에서 화면마다 글자의 실제 크기를 재서,
// 크기가 안 바뀌는 글자(= 글자 크기 설정을 안 따르는 곳)를 모두 찾는다.
// 사장님 말씀(2026-09-30): 「글자크기가 조정되는것도 있고 조정 안되는것도 있네 … 들죽날죽이다」
// 쓰는 법: node fsaudit.js ../www/index.html [백업.json] [사진폴더]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const BK = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], 'utf8')) : null;
const SHOT = process.argv[4] || '';
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); }); });
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
  await ctx.addInitScript(() => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); }catch(_){} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'domcontentloaded' });
  await pg.waitForTimeout(1800);
  await pg.evaluate((bk) => {
    try{ skipWelcome(); }catch(_){}
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(true);
    unlocked = true;
    if(bk){
      const b = JSON.parse(JSON.stringify(bk.boat)); b.members = {}; b.ranks = {};
      boats = [b]; currentBoatId = b.id; window.currentBoatId = b.id;
      ['items','trash','maint','repair','voyage','fuel','runs','contacts','checkt','lockers','shapes'].forEach(k => {
        if(Array.isArray(bk[k])) { try{ eval(k + ' = bk[k]'); }catch(_){} }
      });
      try{ save(); saveMR(); }catch(_){}
    }
  }, BK);
  await pg.waitForTimeout(600);
  const firstId = await pg.evaluate(() => ({
    v: (voyage.find(v => !v.plan && (v.logs || []).length) || voyage[0] || {}).id,
    f: (fuel[0] || {}).id, r: (runs[0] || {}).id,
    m: (maint.find(x => x.typ === 'chk' || x.months || x.hrs) || {}).id,
    g: (maint.find(x => x.typ === 'gear') || {}).id,
    rp: (repair[0] || {}).id, lk: (lockers[0] || {}).id
  }));
  const SCREENS = [
    ['오늘', `setHomeSub('today')`], ['날씨', `setHomeSub('weather')`], ['체크리스트', `setHomeSub('check')`],
    ['달력', `setHomeSub('cal')`], ['소식', `setHomeSub('news')`],
    ['적재표', `setBoatSubTab('stow')`], ['장비', `setBoatSubTab('gear')`], ['정기점검', `goCheck()`],
    ['정비수첩', `goMaint('mlog')`], ['수리', `goMaint('repair')`], ['연료', `goMaint('fuel')`],
    ['항해일지', `setBoatSubTab('voyage')`], ['문서', `setBoatSubTab('docs')`],
    ['남의 배', `switchTab('others')`], ['커뮤니티', `switchTab('community')`],
    ['항해 기록 창', `setBoatSubTab('voyage'); setTimeout(() => openMR('voyage', ${JSON.stringify(firstId.v)}), 350)`],
    ['연료 기록 창', `goMaint('fuel'); setTimeout(() => openMR('fuel', ${JSON.stringify(firstId.f)}), 350)`],
    ['엔진 가동 창', `goMaint('fuel'); setTimeout(() => openMR('run', ${JSON.stringify(firstId.r)}), 350)`],
    ['정기점검 창', `goCheck(); setTimeout(() => openMR('maint', ${JSON.stringify(firstId.m)}), 350)`],
    ['장비 창', `setBoatSubTab('gear'); setTimeout(() => openMR('gear', ${JSON.stringify(firstId.g)}), 350)`],
    ['수리 창', `goMaint('repair'); setTimeout(() => openMR('repair', ${JSON.stringify(firstId.rp)}), 350)`],
    ['칸 열기', `setBoatSubTab('stow'); setTimeout(() => openLocker(${JSON.stringify(firstId.lk)}), 350)`],
    ['설정', `openSettings()`], ['화면(테마·글자)', `openLook()`], ['계정', `openAccount()`], ['알림', `openNoti()`],
    ['배 정보', `openBoat('spec')`], ['휴지통', `openTrash()`]
  ];
  const measure = () => {
    const out = [];
    const vis = e => { const r = e.getBoundingClientRect(); if(r.width < 1 || r.height < 1) return false;
      const cs = getComputedStyle(e); if(cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) return false;
      for(let p = e; p; p = p.parentElement){ const c = getComputedStyle(p); if(c.display === 'none') return false; }
      return r.bottom > -2000 && r.top < innerHeight + 4000; };
    const path = e => { const a = []; for(let p = e; p && p !== document.body && a.length < 5; p = p.parentElement)
      a.unshift(p.tagName.toLowerCase() + (p.id ? '#' + p.id : '') + (p.classList.length ? '.' + [...p.classList].slice(0, 2).join('.') : ''));
      return a.join('>'); };
    let n = 0;
    document.querySelectorAll('body *').forEach(e => {
      if(['SCRIPT','STYLE','svg','path','g'].includes(e.tagName)) return;
      const own = [...e.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent.trim()).join(' ').trim();
      const isCtl = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName);
      if(!own && !(isCtl && (e.value || e.placeholder || e.textContent.trim())) && e.tagName !== 'text') return;
      if(!vis(e)) return;
      const cs = getComputedStyle(e);
      out.push({ k: path(e) + '|' + (n++), p: path(e), t: (own || e.value || e.placeholder || e.textContent || '').trim().slice(0, 30),
                 fs: parseFloat(cs.fontSize), tag: e.tagName, inl: (e.getAttribute('style') || '').match(/font[^;]*/) ? (e.getAttribute('style').match(/font[^;]*/)[0]) : '' });
    });
    return out;
  };
  const report = [];
  for(const [name, js] of SCREENS){
    const res = {};
    for(const sz of ['normal', 'big', 'bigger']){
      await pg.evaluate(s => { window.btLook.set('size', s); }, sz);
      try{ await pg.evaluate(`try{ closeMR && closeMR(); }catch(_){} try{ closeForm && closeForm(); }catch(_){} try{ ${js}; }catch(e){ window.__auderr = String(e); }`); }catch(e){}
      await pg.waitForTimeout(1000);
      res[sz] = await pg.evaluate(measure);
      if(SHOT && sz !== 'normal') await pg.screenshot({ path: path.join(SHOT, name.replace(/[\\/:*?"<>| ]/g, '_') + '-' + sz + '.png') });
      if(SHOT && sz === 'normal') await pg.screenshot({ path: path.join(SHOT, name.replace(/[\\/:*?"<>| ]/g, '_') + '-normal.png') });
      const ov = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
      if(sz !== 'normal' && ov.sw > ov.w + 1) (res.over = res.over || []).push(sz + ' 가로 넘침 ' + ov.sw + '>' + ov.w);
    }
    // 같은 순서·같은 글이면 같은 글자로 본다
    const same = [], ok = [];
    const N = res.normal, B = res.big;
    const byKey = new Map(B.map(x => [x.p + '|' + x.t, x]));
    N.forEach(x => { const y = byKey.get(x.p + '|' + x.t); if(!y) return;
      if(x.fs < 22 && Math.abs(y.fs - x.fs) < 0.01) same.push(x); else ok.push(x); });
    report.push({ name, total: N.length, unscaled: same.length, over: res.over || [],
                  list: same.map(x => `${x.fs}px ${x.tag} ${x.p} 「${x.t}」 ${x.inl}`) });
  }
  console.log(JSON.stringify({ report, errs }, null, 1));
  await br.close(); server.close();
})().catch(e => { console.log('★ 멈춤 ' + e); process.exit(1); });
