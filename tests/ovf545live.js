// 5.45 — 번역을 2천 줄 넘게 고쳤으니 글자가 칸을 넘치지 않는지 본다 (노을·검정·흰 × 한·영·러·일)
//   두 파일(고치기 전·후)을 같은 길로 돌며 「글자가 잘리거나 칸 밖으로 나간 단추·칩·탭·이름표」 를 모아 비교한다.
//   쓰는 법: node ovf545live.js 새.html [옛.html]   — 옛 파일을 주면 새로 생긴 것만 실패로 친다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const NEW = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'));
const OLD = process.argv[3] ? path.resolve(process.argv[3]) : null;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function serve(FILE){
  const ROOT = path.dirname(FILE);
  const s = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
    fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); }); });
  return new Promise(r => s.listen(0, () => r(s)));
}
const SCREENS = [
  ['오늘', "switchTab('home')"],
  ['내 배·적재표', "switchTab('boat'); setBoatSubTab('stow')"],
  ['내 배·정비', "switchTab('boat'); setBoatSubTab('maint')"],
  ['내 배·장비', "switchTab('boat'); setBoatSubTab('gear')"],
  ['내 배·항해', "switchTab('boat'); setBoatSubTab('voyage')"],
  ['내 배·서류', "switchTab('boat'); setBoatSubTab('docs')"],
  ['남의 배', "switchTab('others')"],
  ['커뮤니티·게시판', "switchTab('community'); setComSub('talk')"],
  ['커뮤니티·정박지', "switchTab('community'); setComSub('spots')"],
  ['커뮤니티·장터', "switchTab('community'); setComSub('market')"],
  ['커뮤니티·배 둘러보기', "switchTab('community'); setComSub('explore')"],
  ['배 정보', "openBoat('info')"],
  ['설정', "openSettings && openSettings()"],
  ['메뉴', "openDrawer && openDrawer()"]
];
async function sweep(FILE){
  const srv = await serve(FILE);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = {};
  for(const theme of ['sunset','black','light']) for(const lang of ['ko','en','ru','ja']){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    await ctx.addInitScript(({ theme, lang }) => { try{ if(sessionStorage.getItem('__pre')) return; sessionStorage.setItem('__pre','1');
      localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_theme', theme);
      if(lang !== 'ko') localStorage.setItem('bt_lang', lang); }catch(_){} }, { theme, lang });
    const pg = await ctx.newPage();
    await pg.goto(url, { waitUntil:'domcontentloaded' }); await sleep(1400);
    await pg.evaluate(() => { window.ask = () => Promise.resolve(true); try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
    await sleep(300);
    await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = 'Shunshine'; createBoat(); } });
    await sleep(700);
    for(const [name, js] of SCREENS){
      try{ await pg.evaluate(js); }catch(_){ continue; }
      await sleep(450);
      const bad = await pg.evaluate(() => {
        const sel = 'button, .tab, .chip, .mrlbl, .stat b, .stat span, .tchip, .minib, .mrbtn, .hct b, .fname, .mrhead b';
        const r = [];
        for(const el of document.querySelectorAll(sel)){
          const cs = getComputedStyle(el); if(cs.display === 'none' || cs.visibility === 'hidden') continue;
          const b = el.getBoundingClientRect(); if(b.width < 2 || b.height < 2) continue;
          if(b.right > window.innerWidth + 1 || b.left < -1) { r.push('밖:' + el.textContent.trim().slice(0, 40)); continue; }
          if(el.scrollWidth > el.clientWidth + 2 && cs.overflow !== 'visible' && el.textContent.trim().length > 1) r.push('잘림:' + el.textContent.trim().slice(0, 40));
        }
        return r;
      });
      out[theme + '|' + lang + '|' + name] = bad;
    }
    await ctx.close();
  }
  await br.close(); srv.close();
  return out;
}
(async () => {
  const N = await sweep(NEW);
  const O = OLD ? await sweep(OLD) : null;
  let ok = 0, badN = 0;
  for(const k of Object.keys(N)){
    const lang = k.split('|')[1];
    const was = O ? new Map() : null;
    // 옛 것과 같은 자리(같은 화면)에 있던 수만큼은 새로 생긴 것이 아니다
    const extra = O ? Math.max(0, N[k].length - (O[k] || []).length) : N[k].length;
    if(extra > 0){ badN++; console.log('★ 실패: ' + k + ' — 넘친 글자 ' + N[k].length + '곳 (전 ' + (O ? (O[k] || []).length : '?') + ') ' + JSON.stringify(N[k].slice(0, 6))); }
    else { ok++; console.log('통과: ' + k + (N[k].length ? ' (전과 같은 ' + N[k].length + '곳)' : '')); }
  }
  console.log('\n합계: ' + ok + '개 통과 / ' + badN + '개 실패');
  process.exit(badN ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사 자체 오류 — ' + e.message); process.exit(1); });
