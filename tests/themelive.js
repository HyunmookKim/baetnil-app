// 화면 테마(노을·흰색·검정) · 글자 크기 (5.20)
// 사장님: 사용자 피드백 「글씨가 너무 작은 것들이 있다」 「흰색도 있었으면」 → 노을·흰색·검정 세 가지, 글자 크기는 사용자가 정하게.
// 초안(아티팩트 「뱃일 화면 색·글씨 초안」)을 보시고 「좋다」 — 그 초안을 만든 규칙 그대로 앱에 넣었다(<head> 의 btLook).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const SRC = fs.readFileSync(FILE, 'utf8');

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const url = 'http://127.0.0.1:'+server.address().port+'/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function open(theme, size){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo/, r=>r.abort());
    await ctx.addInitScript(({theme,size})=>{
      try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done');
        if(theme) localStorage.setItem('bt_theme', theme); if(size) localStorage.setItem('bt_fs', size); }catch(_){}
      window.__sb = [];
      window.Capacitor = { isNativePlatform:()=>true, getPlatform:()=>'android',
        Plugins:{ StatusBar:{ setStyle:(o)=>{ window.__sb.push(o.style); return Promise.resolve(); } },
                  App:{ addListener:()=>Promise.resolve({remove(){}}) } } };
    }, {theme, size});
    const pg = await ctx.newPage();
    const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
    await pg.goto(url, { waitUntil:'domcontentloaded' });
    await sleep(1800);
    await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} });
    return { ctx, pg, errs };
  }
  const look = pg => pg.evaluate(()=>{
    const bg = getComputedStyle(document.body).backgroundColor;
    const lbl = document.createElement('span'); lbl.className = 'mrlbl'; document.body.appendChild(lbl);
    const fsz = getComputedStyle(lbl).fontSize; lbl.remove();
    const d = document.createElement('div'); d.setAttribute('style', 'color:#8AA0B4;font-size:11px'); document.body.appendChild(d);
    return new Promise(r => setTimeout(()=>{ const s = d.getAttribute('style'); d.remove();
      r({ bg, mrlbl: fsz, inline: s, theme: window.btLook.theme(), size: window.btLook.size(), sb: window.__sb.slice(-1)[0] }); }, 50));
  });

  // ── 처음(아무것도 안 고름): 노을 + 크게(초안)
  let A = await open(null, null);
  let r = await look(A.pg);
  T('★ 처음은 노을 · 크게 (사장님이 좋다고 하신 초안 크기)', r.theme === 'sunset' && r.size === 'big', r);
  T('★ 크게 — 칸 이름(11.5px 이하)이 커진다', parseFloat(r.mrlbl) >= 13, r.mrlbl);
  T('★ 크게 — 화면을 그릴 때 붙는 글자 크기도 커진다 (11px → 13px)', /font-size:13px/.test(r.inline), r.inline);
  T('노을은 색을 안 바꾼다 (#8AA0B4 그대로)', /#8AA0B4/i.test(r.inline), r.inline);
  T('노을 — 폰 시계 줄은 밝은 글자(DARK)', r.sb === 'DARK', r.sb);

  // ── 흰색으로 바꾼다 (다시 켜지 않아도 바로)
  await A.pg.evaluate(()=>window.btLook.set('theme','light'));
  await sleep(200);
  r = await look(A.pg);
  T('★ 흰색 — 바탕이 흰색', r.bg === 'rgb(255, 255, 255)', r.bg);
  T('★ 흰색 — 그릴 때 붙는 색도 바뀐다 (옅은 회청 → 짙은 글씨)', /color:rgb\((\d+),(\d+),(\d+)\)/.test(r.inline) && Math.max(...r.inline.match(/rgb\((\d+),(\d+),(\d+)\)/).slice(1).map(Number)) < 140, r.inline);
  T('★ 흰색 — 폰 시계 줄은 짙은 글자(LIGHT)', r.sb === 'LIGHT', r.sb);
  const card = await A.pg.evaluate(()=>{ homeSub='today'; switchTab('home'); const c = [...document.querySelectorAll('.hcard')].find(e=>/지금 나갈 수 있나/.test(e.textContent)); return c ? getComputedStyle(c).backgroundColor : ''; });
  T('흰색 — 카드가 흰 바탕 위 옅은 회색', /rgba?\((2[2-5]\d), (2[2-5]\d), (2[2-5]\d)/.test(card), card);
  // 여러 번 바꿔도 두 번 바뀌지 않는다(처음 값에서 다시 만든다)
  const css1 = await A.pg.evaluate(()=>document.querySelector('style').textContent.length);
  await A.pg.evaluate(()=>{ window.btLook.set('theme','black'); window.btLook.set('theme','light'); });
  const css2 = await A.pg.evaluate(()=>document.querySelector('style').textContent.length);
  const inl = await A.pg.evaluate(()=>{ const d = document.createElement('div'); d.setAttribute('style','color:#8AA0B4'); document.body.appendChild(d);
    return new Promise(r=>setTimeout(()=>{ const a = d.getAttribute('style'); window.btLook.set('theme','black'); window.btLook.set('theme','light');
      setTimeout(()=>{ r([a, d.getAttribute('style')]); d.remove(); }, 50); }, 50)); });
  T('★ 테마를 여러 번 바꿔도 색이 두 번 바뀌지 않는다', css1 === css2 && inl[0] === inl[1], { css1, css2, inl });

  // ── 검정
  await A.pg.evaluate(()=>window.btLook.set('theme','black'));
  await sleep(150);
  r = await look(A.pg);
  T('★ 검정 — 바탕이 완전 검정', r.bg === 'rgb(0, 0, 0)', r.bg);
  const card2 = await A.pg.evaluate(()=>{ renderHome(); const c = [...document.querySelectorAll('.hcard')].find(e=>/지금 나갈 수 있나/.test(e.textContent)); return c ? getComputedStyle(c).backgroundColor : ''; });
  T('★ 검정 — 카드는 한 칸 떠 보이는 짙은 회색 (검정 위에 묻히지 않는다)', (()=>{ const m = card2.match(/(\d+), (\d+), (\d+)/); return m && +m[1] > 15 && +m[1] < 60; })(), card2);
  T('검정 — 폰 시계 줄은 밝은 글자(DARK)', r.sb === 'DARK', r.sb);

  // ── 노을 + 보통 = 5.19 와 똑같다 (아무것도 안 바꾼다)
  await A.pg.evaluate(()=>{ window.btLook.set('theme','sunset'); window.btLook.set('size','normal'); });
  const same = await A.pg.evaluate((src)=>{
    const a = src.indexOf('<style>') + 7, b = src.indexOf('</style>');
    return document.querySelector('style').textContent === src.slice(a, b);
  }, SRC);
  T('★ 노을 + 보통이면 CSS 가 원래 그대로다 (5.19 와 똑같다)', same);

  // ── 고른 것은 다시 켜도 남는다
  await A.pg.evaluate(()=>{ window.btLook.set('theme','light'); window.btLook.set('size','bigger'); });
  await A.pg.reload({ waitUntil:'domcontentloaded' }); await sleep(1500);
  r = await look(A.pg);
  T('★ 다시 켜도 고른 테마·글자 크기가 남는다', r.theme === 'light' && r.size === 'bigger' && r.bg === 'rgb(255, 255, 255)', r);
  T('아주 크게 — 칸 이름이 크게보다 더 크다', parseFloat(r.mrlbl) >= 14.5, r.mrlbl);

  // ── 설정 › 화면
  await A.pg.evaluate(()=>openSettings()); await sleep(300);
  const setTxt = await A.pg.evaluate(()=>document.getElementById('mrPanel').innerText);
  T('★ 설정에 「화면」 줄이 있고 지금 테마를 보여 준다', /화면/.test(setTxt) && /흰색/.test(setTxt), setTxt.slice(0,160));
  await A.pg.evaluate(()=>openLook()); await sleep(300);
  const lk = await A.pg.evaluate(()=>({ txt: document.getElementById('mrPanel').innerText,
    gas: [...document.querySelectorAll('[data-lookpx]')].map(e=>getComputedStyle(e).fontSize),
    on: (document.querySelector('.lookfs .tab.on')||{}).dataset }));
  T('화면 — 테마 세 가지(노을·흰색·검정)와 글자 크기', /노을/.test(lk.txt) && /흰색/.test(lk.txt) && /검정/.test(lk.txt) && /글자 크기/.test(lk.txt), lk.txt.slice(0,200));
  T('★ 글자 크기 「가」 는 단계와 상관없이 제 크기로 커진다 (15·19·23)', lk.gas.join(',') === '15px,19px,23px', lk.gas);
  T('지금 고른 글자 크기가 눌려 있다', lk.on && lk.on.fs === 'bigger', lk.on);
  await A.pg.evaluate(()=>lookPick('theme','black')); await sleep(200);
  r = await look(A.pg);
  T('★ 화면에서 누르면 곧바로 바뀐다', r.theme === 'black' && r.bg === 'rgb(0, 0, 0)', r);

  T('오류가 없다', A.errs.length === 0, A.errs.slice(0,3));
  await br.close(); server.close();
  console.log(`\n통과 ${ok} · 실패 ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
