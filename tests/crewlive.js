// ══════════════════════════════════════════════════════════════════════
// F1 — 한 번도 손으로 눌러 본 적 없던 화면들을 실제로 열어 본다
//   회원명부 · 등급설정 · 참여신청 · 할일 · 게시판 · 공개설정
//
// ★ 여기서 실제로 찾아낸 고장 셋 (2026-09-15, 5.0)
//   ① 배 게시판에 **글 쓰는 길이 하나도 없었다**.
//      4.134 에 「+ 글쓰기」를 떠다니는 단추로 옮겼는데, 그 단추는 판이 열려 있으면
//      숨는다(fabBlocked). 게시판은 판으로 열리므로 단추가 영영 안 나타났다.
//   ② 커뮤니티 글판의 「+ 글쓰기」가 writePost() — **배 게시판 글쓰기**를 부르고 있었다.
//      올린 사람은 커뮤니티에 올린 줄 알고 나가는데 글은 제 배 게시판에 들어갔다.
//   ③ 참여신청 화면만 빈 화면을 안 그리고 여닫이 없이 여담만 띄웠다 —
//      누른 사람 눈에는 그 칸이 고장 난 것처럼 보였다.
//
// ★ 머리줄에 단추를 두면 안 된다 — boatKeepTabs() 가 .mrhead 를 통째로 갈아 끼운다.
//   그래서 이 검사는 **몸통에** 단추가 있는지 본다.
// ══════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const FILE = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const SRC = path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE);
const ROOT = path.dirname(SRC);
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
const srv = http.createServer((rq, rs) => { const u = rq.url.split('?')[0];
  const f = (u === '/') ? SRC : path.join(ROOT, u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); rs.end(d); }); });
let ok = 0, bad = 0;
const T = (n, c, x) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (x === undefined ? '' : ' — ' + JSON.stringify(x).slice(0,300))); } };

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 412, height: 820 }, hasTouch: true, isMobile: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 140)));
  try{
    await pg.addInitScript(() => {
      try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done');
           localStorage.setItem('bt_lang','ko'); localStorage.setItem('bt_cc','KR'); }catch(_){}
      window.__user = { uid:'U1', name:'김명준', email:'a@b.c' };
    });
    await pg.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
    await pg.waitForTimeout(3500);
    await pg.evaluate(() => { try{ me = { uid:'U1', name:'김명준', email:'a@b.c' }; }catch(_){}
      try{ applyAccount && applyAccount(); }catch(_){} openBoatSetup(); });
    await pg.waitForTimeout(800);
    await pg.fill('#nbName', '선샤인');
    await pg.evaluate(() => createBoat());
    await pg.waitForTimeout(1000);
    T('배가 등록된다', await pg.evaluate(() => !!(curBoat() && curBoat().name === '선샤인')));
    T('선주 등급이 깔린다', await pg.evaluate(() => {
      const bb = curBoat(); return !!(bb && rankList(bb).length >= 5 && Object.keys(bb.members||{}).length === 1); }));

    // ── 여섯 화면이 모두 **무언가를 그린다** (빈 화면이 없다)
    const look = async (name) => {
      await pg.evaluate(() => { try{ document.querySelectorAll('#formOv.open').forEach(x=>x.classList.remove('open')); }catch(_){} });
      await pg.evaluate(async (n) => { const v = window[n] && window[n](); if(v && v.then) await v; }, name);
      await pg.waitForTimeout(700);
      return pg.evaluate(() => {
        const P = document.getElementById('mrPanel');
        return { open: !!(P && P.classList.contains('open')),
                 text: P ? (P.innerText||'').replace(/\s+/g,' ').trim() : '',
                 len: P ? P.innerHTML.length : 0 };
      });
    };
    for(const [fnName, 이름] of [['openRoster','회원명부'], ['openRanks','등급설정'],
        ['openJoinReqs','참여신청'], ['openMyTasks','할일'], ['openBoard','게시판'], ['openPublish','공개설정']]){
      const r = await look(fnName);
      T('★ ' + 이름 + ' 이 빈 화면이 아니다', r.open && r.len > 300, r);
      T(이름 + ' 이 제 이름을 띄운다', r.text.indexOf(이름) >= 0, r.text.slice(0,120));
    }

    // ── ③ 참여신청 — 인터넷이 없어도 **화면을 그리고 까닭을 적는다**
    {
      const r = await look('openJoinReqs');
      T('★★★ 참여신청이 왜 비었는지 적는다',
        /인터넷|신청이 없습니다|불러오지 못했습니다/.test(r.text), r.text.slice(0,160));
    }

    // ── ① 배 게시판 — 글 쓰는 길이 화면 안에 있다
    {
      await look('openBoard');
      const w = await pg.evaluate(() => {
        const P = document.getElementById('mrPanel');
        const btns = [...P.querySelectorAll('button')].filter(x => x.offsetParent !== null
          && /writePost/.test(x.getAttribute('onclick') || ''));
        return { n: btns.length, txt: btns.map(x=>(x.innerText||'').trim()),
                 머리에있나: btns.some(x => !!x.closest('.mrhead')) };
      });
      T('★★★ 게시판에 글 쓰는 단추가 있다', w.n > 0, w);
      T('★ 그 단추가 머리줄에 있지 않다 (머리줄은 갈아 끼워진다)', w.n > 0 && !w.머리에있나, w);
      // 눌러서 진짜 글쓰기 창이 열리는가
      await pg.evaluate(() => {
        const P = document.getElementById('mrPanel');
        const b2 = [...P.querySelectorAll('button')].find(x => /writePost/.test(x.getAttribute('onclick')||''));
        if(b2) b2.click();
      });
      await pg.waitForTimeout(800);
      const f = await pg.evaluate(() => {
        const o = document.getElementById('formOv');
        return o && o.offsetParent !== null ? (o.innerText||'').replace(/\s+/g,' ').trim().slice(0,200) : '';
      });
      T('★★★ 누르면 배 게시판 글쓰기 창이 열린다', /말머리/.test(f) && /공지|인수인계/.test(f), f);
      await pg.evaluate(() => { try{ closeForm(); }catch(_){}
        try{ document.querySelectorAll('#formOv.open').forEach(x=>x.classList.remove('open')); }catch(_){} });
      await pg.waitForTimeout(400);
    }

    // ── ② 커뮤니티 글판의 「+ 글쓰기」 는 커뮤니티 글쓰기여야 한다
    {
      const r = await pg.evaluate(() => {
        const o = {};
        try{ switchTab('community'); }catch(_){}
        try{ comSub = 'talk'; }catch(_){}
        try{ o.acts = fabActs(); }catch(e){ o.acts = 'err:' + e.message; }
        return o;
      });
      const run = (Array.isArray(r.acts) && r.acts[0]) ? r.acts[0][1] : '';
      T('★★★ 커뮤니티 글판의 + 글쓰기가 커뮤니티 글을 쓴다', /writeTalk\(\)/.test(run), r.acts);
      T('★★★ 배 게시판 글쓰기를 부르지 않는다', !/writePost\(\)/.test(run), r.acts);
    }

    // ── 등급을 실제로 하나 만들어 본다
    {
      await pg.evaluate(() => { try{ switchTab('boat'); }catch(_){} });
      await look('openRanks');
      const 전 = await pg.evaluate(() => rankList(curBoat()).length);
      await pg.evaluate(() => { const b2 = [...document.querySelectorAll('#mrPanel button')]
        .find(x => /등급 만들기/.test(x.innerText)); if(b2) b2.click(); });
      await pg.waitForTimeout(700);
      T('새 등급 창이 열린다', await pg.evaluate(() => {
        const o = document.getElementById('formOv'); return !!(o && o.offsetParent !== null); }));
      await pg.fill('#ff0', '기관장');
      await pg.evaluate(() => { const g = document.querySelector('#formFoot .fbtn.go'); if(g) g.click(); });
      await pg.waitForTimeout(900);
      const 후 = await pg.evaluate(() => rankList(curBoat()).map(x=>x.name));
      T('★ 등급이 실제로 늘어난다', 후.length === 전 + 1 && 후.indexOf('기관장') >= 0, 후);
    }

    // ── 공개설정을 실제로 켜 본다
    {
      await look('openPublish');
      const 전 = await pg.evaluate(() => JSON.stringify((curBoat()||{}).pub || {}));
      await pg.evaluate(() => { const b2 = [...document.querySelectorAll('#mrPanel button')]
        .filter(x => x.innerText.trim() === '켜기')[0]; if(b2) b2.click(); });
      await pg.waitForTimeout(900);
      const 후 = await pg.evaluate(() => JSON.stringify((curBoat()||{}).pub || {}));
      T('★ 공개설정이 실제로 바뀐다', 전 !== 후 && /true/.test(후), { 전, 후 });
    }

    T('화면을 여는 동안 터진 곳이 없다', errs.length === 0, errs.slice(0, 3));
  }catch(e){
    bad++; console.log('★ 실패: 검사가 도중에 멈췄습니다 — ' + (e && e.message));
  }
  await b.close(); srv.close();
  console.log(`\n${ok}/${ok+bad} 통과`);
  process.exit(bad ? 1 : 0);
})();
