// 영어·러시아어로 켜고 화면을 돌며 남은 한글을 모두 모아 보여 준다.
// ★ 씨앗 자료(사람이 고칠 수 있는 이름)는 사전으로 옮길 수 없다 — 따로 센다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url === '/' ? SRC : rq.url.split('?')[0]);
  fs.readFile(f, (e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, {'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html'}); rs.end(d); });
});

(async () => {
  await new Promise(r=>server.listen(0, r));
  const FILE = 'http://127.0.0.1:' + server.address().port + '/';
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const out = {};
  for(const lang of ['en','ru']){
    const p = await b.newPage({ locale:'ko-KR' });
    p.on('dialog', d => d.accept());
    await p.addInitScript(v => { try{ localStorage.setItem('bt_lang', v); localStorage.setItem('bt_agree','1'); }catch(e){} }, lang);
    await p.goto(FILE);
    await p.waitForTimeout(1200);
    // 약관 창이 떠 있으면 넘긴다
    try{ await p.evaluate(()=>{ if(typeof doAgree==='function' && document.getElementById('mrPanel')) { try{ agreeAll(); doAgree(); }catch(e){} } }); }catch(e){}
    await p.waitForTimeout(400);
    const steps = [
      ['오늘', `switchTab('home')`],
      ['날씨', `switchTab('home');setHomeSub&&setHomeSub('weather')`],
      ['출항전점검', `switchTab('home');setHomeSub&&setHomeSub('check')`],
      ['내 배', `switchTab('boat')`],
      ['적재표', `switchTab('boat');setBoatSubTab&&setBoatSubTab('stow')`],
      ['정기점검', `switchTab('boat');setBoatSubTab&&setBoatSubTab('maint')`],
      ['수리', `switchTab('boat');setBoatSubTab&&setBoatSubTab('repair')`],
      ['연료', `switchTab('boat');setBoatSubTab&&setBoatSubTab('fuel')`],
      ['문서', `switchTab('boat');setBoatSubTab&&setBoatSubTab('docs')`],
      ['항해일지', `switchTab('voyage')`],
      ['글판', `switchTab('community')`],
      ['정박지', `switchTab('community');setComSub&&setComSub('spots')`],
      ['장터', `switchTab('community');setComSub&&setComSub('market')`],
      ['둘러보기', `switchTab('community');setComSub&&setComSub('explore')`],
      ['뉴스', `switchTab('community');setComSub&&setComSub('news')`],
      ['서랍', `openDrawer()`],
      ['계정', `closeDrawer&&closeDrawer();openAccount()`],
      ['약관', `openLegal('terms')`],
      ['고객센터', `openSupport()`],
    ];
    const found = {};
    for(const [name, code] of steps){
      try{ await p.evaluate(c => eval(c), code); }catch(e){}
      await p.waitForTimeout(900);
      const txt = await p.evaluate(() => {
        // ★ script·style 안의 글은 화면 글이 아니다 — 세면 안 된다
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: n => {
            for(let e = n.parentElement; e; e = e.parentElement){
              if(e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
              if(getComputedStyle(e).display === 'none') return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          }});
        let out = ''; while(w.nextNode()) out += w.currentNode.nodeValue + '\n';
        return out;
      });
      const words = [...new Set((txt.match(/[가-힣][가-힣\s·]*/g)||[]).map(x=>x.trim()).filter(Boolean))];
      if(words.length) found[name] = words;
    }
    out[lang] = found;
    await p.close();
  }
  await b.close(); server.close();
  for(const lang of Object.keys(out)){
    const f = out[lang];
    const n = Object.values(f).reduce((a,v)=>a+v.length,0);
    console.log('==== ' + lang + ' — 남은 한글 낱말 ' + n + '개');
    for(const k of Object.keys(f)) console.log('  ' + k + ': ' + f[k].join(' | '));
  }
})();
