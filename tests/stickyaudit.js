// 5.36 — 모든 화면을 열고 내려 본다: 위에 있던 단추 줄이 스크롤하면 사라지는 곳을 전부 찾는다
// ★ 사장님: 「내가 말한 거 하나만 고치지 말라고 했는데 … 또 하나만 고쳐놔가지고」 (2026-10-04)
//   화면 이름을 손으로 적은 목록만 보지 않는다. 화면마다 「단추가 둘 이상 든 줄」 을 저절로 찾아 본다.
// 쓰는 법: node stickyaudit.js ../www/index.html [백업.json]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const BKF = process.argv[3] || '';
const SHOTS = process.env.SHOTS || '';
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(u === '/' || u.endsWith('.html')) rs.setHeader('Content-Type', 'text/html; charset=utf-8');
    if(/\.m?js$/.test(u)) rs.setHeader('Content-Type', 'text/javascript');
    rs.writeHead(200); rs.end(d); }); });

// [이름, 여는 코드]
const SCREENS = [
  ['오늘', "setHomeSub('today')"], ['달력', "setHomeSub('cal')"], ['날씨', "setHomeSub('weather')"],
  ['뉴스', "setHomeSub('news')"], ['체크리스트', "setHomeSub('check')"],
  ['적재표', "setBoatSubTab('stow')"],
  ['정비수첩', "setBoatSubTab('maint'); setMntSub('mlog')"], ['수리', "setBoatSubTab('maint'); setMntSub('repair')"], ['연료', "setBoatSubTab('maint'); setMntSub('fuel')"],
  ['장비', "setBoatSubTab('gear'); setGearSub('gear')"], ['정기점검', "setBoatSubTab('gear'); setGearSub('maint')"],
  ['리뷰', "setBoatSubTab('gear'); setGearSub('review')"],
  ['항해일지', "setBoatSubTab('voyage')"],
  ['문서', "setBoatSubTab('docs'); setDocSub('docs')"], ['이력', "setBoatSubTab('docs'); setDocSub('papers')"],
  ['연락처(문서)', "setBoatSubTab('docs'); setDocSub('contact')"],
  ['게시판(커뮤니티)', "setComSub('talk')"], ['정박지', "setComSub('spots')"], ['중고 장터', "setComSub('market')"],
  ['배 둘러보기', "setComSub('explore')"],
  ['계류장 기본정보', "openBoat('info')"], ['계류장 제원', "openBoat('spec')"], ['계류장 배소개', "openBoat('intro')"],
  ['회원명부', "openRoster()"], ['등급 설정', "openRanks()"], ['배 게시판', "openBoard()"], ['할일', "openMyTasks()"],
  ['참여신청', "openJoinReqs()"], ['공개설정', "openPublish()"],
  ['연락처 수정', "openBoat('info'); openCiEdit()"],
  ['장비 기록', "openMR('gear', gearRows()[0].id)"], ['수리 기록', "openMR('repair', repair[0].id)"],
  ['정기점검 기록', "openMR('maint', maintRows()[0].id)"], ['정비수첩 기록', "openMR('mlog', mlogRows()[0].id)"],
  ['항해 기록', "openMR('voyage', voyage[0].id)"], ['연료 기록', "openMR('fuel', fuel[0].id)"],
  ['설정', "openSettings()"], ['계정', "openAccount()"], ['내 프로필', "openProfile && openProfile()"],
  ['휴지통', "openTrash && openTrash()"], ['배 목록', "openFleet()"]
];

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
  await ctx.addInitScript(() => { try{ localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); }catch(_){} });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  await pg.goto(url, { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(1800);
  await pg.evaluate(async (bk) => {
    window.tell = () => Promise.resolve(); window.ask = () => Promise.resolve(false);
    try{ skipWelcome(); }catch(_){}
    if(bk){
      const b = JSON.parse(JSON.stringify(bk.boat));
      boats = [b]; currentBoatId = String(b.id); window.currentBoatId = currentBoatId;
      ['items','trash','maint','repair','voyage','fuel','runs','contacts','vdocs','checkt','lockers','shapes'].forEach(k => { try{ eval(k + ' = JSON.parse(JSON.stringify(bk[k] || []))'); }catch(_){} });
      saveLocal();
    } else {
      unlocked = true; openBoatSetup(); document.getElementById('nbName').value = '시험호'; createBoat();
    }
    unlocked = true;
  }, BKF ? JSON.parse(fs.readFileSync(BKF, 'utf8')) : null);
  await pg.waitForTimeout(1200);

  const report = [];
  if(SHOTS){
    fs.mkdirSync(SHOTS, { recursive: true });
    let n = 0;
    for(const [name, code] of SCREENS){
      n++;
      await pg.evaluate(async (code) => { try{ closeMR(); }catch(_){} try{ closeForm(); }catch(_){} window.scrollTo(0,0);
        try{ eval(code); }catch(_){} await new Promise(r => setTimeout(r, 700)); }, code);
      const f0 = path.join(SHOTS, String(n).padStart(2,'0') + '-a.png'); await pg.screenshot({ path: f0 });
      await pg.evaluate(async () => { const P = document.getElementById('mrPanel');
        const sc = (P && P.classList.contains('open') && P.scrollHeight > P.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(P).overflowY)) ? P : document.scrollingElement;
        sc.scrollTop = 700; await new Promise(r => setTimeout(r, 300)); });
      const f1 = path.join(SHOTS, String(n).padStart(2,'0') + '-b.png'); await pg.screenshot({ path: f1 });
      fs.appendFileSync(path.join(SHOTS, 'names.txt'), n + '\t' + name + '\n');
    }
    await br.close(); server.close(); return;
  }
  for(const [name, code] of SCREENS){
    const r = await pg.evaluate(async ([name, code]) => {
      try{ closeMR(); }catch(_){}
      try{ closeForm(); }catch(_){}
      window.scrollTo(0, 0);
      try{ eval(code); }catch(e){ return { name, err: 'open: ' + e.message }; }
      await new Promise(r => setTimeout(r, 700));
      const P = document.getElementById('mrPanel');
      const panelOpen = P && P.classList.contains('open') && getComputedStyle(P).display !== 'none';
      const hdr = document.getElementById('hdr') || document.querySelector('header');
      const hb = hdr ? hdr.getBoundingClientRect().bottom : 56;
      const skip = el => el.closest('#hdr, header, #tabbar, .fab, #formOv, #actOv, .snack, #errbar');
      const isBtn = el => el.tagName === 'BUTTON' || el.classList.contains('tab') || el.classList.contains('tchip');
      const scrollerOf = el => { for(let x = el.parentElement; x; x = x.parentElement){ const cs = getComputedStyle(x);
          if(/(auto|scroll)/.test(cs.overflowY) && x.scrollHeight > x.clientHeight + 2) return x; } return document.scrollingElement; };
      document.scrollingElement.scrollTop = 0; if(panelOpen) P.scrollTop = 0;
      await new Promise(r => setTimeout(r, 100));
      const cands = [...document.querySelectorAll('div, nav')].filter(el => {
        if(skip(el)) return false;
        const kids = [...el.querySelectorAll(':scope > button, :scope > .tab, :scope > .tchip, :scope > * > button, :scope > * > .tab, :scope > * > .tchip, :scope > select, :scope > * > select')];
        if(kids.length < 2) return false;
        const rc = el.getBoundingClientRect();
        if(rc.width < 120 || rc.height < 10 || rc.height > 130) return false;
        if(rc.top < hb - 2 || rc.top > 420) return false;
        const cs = getComputedStyle(el); if(cs.visibility === 'hidden' || cs.display === 'none') return false;
        return true;
      });
      const top = cands.filter(el => !cands.some(o => o !== el && o.contains(el)));
      const out = [];
      for(const el of top){
        const txt = el.innerText.replace(/\s+/g, ' ').slice(0, 50), cls = String(el.className).slice(0, 40);
        const y0 = Math.round(el.getBoundingClientRect().top);
        // 실제 목록이 길다고 치고, 그 줄이 든 칸(부모)을 길게 만든 뒤 내려 본다.
        // ★ 부모가 그 줄 하나뿐이면 아무리 붙여 놔도 부모 끝에서 같이 올라간다 — 그대로 둔다(그게 진짜 모습).
        const par = el.parentElement;
        const onlyMe = par && [...par.children].filter(c => c !== el && c.getBoundingClientRect().height > 0).length === 0;
        const sp = document.createElement('div'); sp.style.height = '3000px';
        const host = onlyMe ? (par.parentElement || par) : par;
        host.appendChild(sp);
        const sc = scrollerOf(el);
        sc.scrollTop = 0; await new Promise(r => setTimeout(r, 60));
        sc.scrollTop = 1500; await new Promise(r => setTimeout(r, 150));
        const rc = el.getBoundingClientRect();
        out.push({ txt, cls, y0, y1: Math.round(rc.top), stays: rc.bottom > hb - 1 && rc.top < hb + 170, onlyMe,
                   sc: sc === document.scrollingElement ? 'page' : (sc.id || sc.className.slice(0, 20)) });
        sp.remove(); sc.scrollTop = 0;
      }
      return { name, scroller: out.map(o=>o.sc).join(','), bars: out };
    }, [name, code]);
    report.push(r);
  }
  let lost = 0;
  for(const r of report){
    if(r.err){ console.log('· ' + r.name + ' — 못 엶 (' + r.err + ')'); continue; }
    const gone = r.bars.filter(b => !b.stays);
    const kept = r.bars.filter(b => b.stays);
    if(gone.length) lost += gone.length;
    console.log((gone.length ? '★ ' : '  ') + r.name + ' [' + r.scroller + '] 남음 ' + kept.length + ' · 사라짐 ' + gone.length
      + gone.map(b => '\n      사라짐: 「' + b.txt + '」 (' + b.cls + ', y ' + b.y0 + ')').join('')
      + kept.map(b => '\n      남음: 「' + b.txt + '」').join(''));
  }
  console.log('\n사라지는 줄 ' + lost + '개' + (errs.length ? ' · 오류 ' + errs.slice(0, 3).join(' | ') : ''));
  await br.close(); server.close();
})();
