// 일본어로 켜서 **진짜 화면**에 한글이 남아 있지 않은가 (4.110)
//
// ★ 왜 살아 있는 검사가 따로 필요한가
//   jamenutest 는 사전을 본다. 그런데 사장님이 겪으신 흠은 사전에 **있는데도**
//   화면이 사전을 안 거치던 것이었다 — 정비 화면의 계통 이름표가 그랬다.
//   글자만 읽어서는 못 잡는다. 배를 만들고 화면을 열어서 눈에 보이는 글자를 세어야 한다.
//
// ★ 배를 만들어야만 보이는 자리가 많다 (정기점검 열여섯 줄이 그때 깔린다).
//   그래서 이 검사는 반드시 배를 하나 만들고 시작한다.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || '../../work.html';
const srv = http.createServer((q, r) => {
  let f = q.url.split('?')[0];
  const p = (f === '/' && path.isAbsolute(SRC)) ? SRC
          : path.join(__dirname, (f === '/' ? SRC : f).replace(/^\//, ''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  r.writeHead(200, { 'content-type': path.extname(p) === '.js' ? 'text/javascript' : 'text/html; charset=utf-8' });
  r.end(fs.readFileSync(p));
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(JSON.stringify(w)).slice(0, 300) : '')); } };
const 끝 = async (br) => { console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  try{ await br.close(); }catch(_){} srv.close(); process.exit(bad ? 1 : 0); };

(async () => {
  await new Promise(r => srv.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ja-JP', viewport:{ width:430, height:930 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  pg.on('dialog', d => d.accept());
  await pg.route('**tile.openstreetmap.org/**', r => r.abort());
  await pg.addInitScript(() => { try{ localStorage.setItem('bt_agree','1'); localStorage.setItem('bt_lang','ja'); }catch(e){} });
  await pg.goto('http://127.0.0.1:' + srv.address().port + '/');
  await pg.waitForTimeout(2000);
  await pg.evaluate(() => { window.ask = () => Promise.resolve(true); window.tell = () => Promise.resolve(true);
    window.alert = () => {}; window.confirm = () => true;
    try{ skipWelcome(); }catch(_){} unlocked = true;
    const o = document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });
  await pg.waitForTimeout(400);
  T('①-1 일본어로 켜졌다', await pg.evaluate(() => langNow()) === 'ja');
  await pg.evaluate(() => { try{ openBoatSetup(); }catch(_){} });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = 'テスト号'; createBoat(); } });
  await pg.waitForTimeout(1500);
  T('①-2 배가 만들어졌다 (정기점검 씨앗이 깔린다)',
    await pg.evaluate(() => (typeof maint !== 'undefined' ? maint.length : 0)) > 5);

  const 화면들 = [
    ['오늘',      `switchTab('home')`],
    ['날씨',      `switchTab('home');setHomeSub('weather')`],
    ['점검표',    `switchTab('home');setHomeSub('check')`],
    ['적재표',    `setBoatSubTab('stow')`],
    ['정비수첩',  `goMaint('mlog')`],
    ['수리',      `goMaint('repair')`],
    ['연료',      `goMaint('fuel')`],
    ['장비',      `setBoatSubTab('gear')`],
    ['정기점검',  `setBoatSubTab('gear');setGearSub('maint')`],
    ['항해일지',  `setBoatSubTab('voyage')`],
    ['문서',      `setBoatSubTab('docs')`],
    ['새 항해',   `setBoatSubTab('voyage');addVoyage()`],
    ['새 장비',   `setBoatSubTab('gear');addGear()`],
    ['새 엔진가동', `goMaint('fuel');addRun()`],
    ['글판',      `switchTab('community');setComSub('talk')`],
    ['배 설정',   `switchTab('boat');openBoatInfo()`],
    ['서랍',      `openDrawer()`],
    ['설정',      `openSettings()`]
  ];
  const 한글 = {};
  for(const [이름, code] of 화면들){
    try{ await pg.evaluate(c => eval(c), code); }catch(e){ continue; }
    await pg.waitForTimeout(700);
    const words = await pg.evaluate(() => {
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: n => {
          for(let e = n.parentElement; e; e = e.parentElement){
            if(e.tagName === 'SCRIPT' || e.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
            if(getComputedStyle(e).display === 'none') return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }});
      let out = ''; while(w.nextNode()) out += w.currentNode.nodeValue + '\n';
      // ★ 「뱃일」 은 앱 이름이다. 이름은 안 옮긴다.
      out = out.split('뱃일').join('');
      return [...new Set((out.match(/[가-힣][가-힣\s·]*/g) || []).map(x => x.trim()).filter(Boolean))];
    });
    if(words.length) 한글[이름] = words;
  }
  const 남은수 = Object.values(한글).reduce((a, v) => a + v.length, 0);
  T('②-1 ★★★ 일본어 화면에 한글이 하나도 없다 (' + 남은수 + '개)', 남은수 === 0, 한글);

  // ── 정비 화면의 계통 이름표 — 사장님이 겪으신 바로 그 자리
  const 계통 = await pg.evaluate(() => {
    setBoatSubTab('gear'); if(typeof setGearSub === 'function') setGearSub('maint');
    return null;
  });
  await pg.waitForTimeout(800);
  const 머리 = await pg.evaluate(() =>
    [...document.querySelectorAll('.ghead b')].map(x => (x.textContent || '').trim()));
  T('②-2 ★★ 정비 묶음 이름이 일본어다', 머리.length > 0 && !머리.some(x => /[가-힣]/.test(x)), 머리);
  T('②-3 ★ 그 이름이 진짜 옮겨진 말이다 (エンジン)', 머리.indexOf('エンジン') >= 0, 머리);

  // ── 계통 칸을 손대도 묶음이 갈라지지 않는가 (keyBack)
  const 되돌림 = await pg.evaluate(() => {
    const it = maint.find(m => m.grp === '엔진');
    if(!it) return 'no-item';
    mrOpenId = it.id; mrOpenType = 'maint';
    mrGrpSet('エンジン', '기타');          // 사람이 화면에 보이는 대로 그대로 두고 나간 셈
    return maint.find(m => m.id === it.id).grp;
  });
  T('②-4 ★★ 일본어로 보인 계통을 그대로 두고 나가도 저장은 한국어 열쇠다',
    되돌림 === '엔진', 되돌림);

  // ── 물때
  const 물때 = await pg.evaluate(() => ({
    style: tideStyle(),
    이름: ['2026-09-11','2026-09-18','2026-09-21','2026-09-22','2026-09-25']
            .map(d => tideName(d, tideStyle())),
    딱지: tideMark('2026-09-11', tideStyle())
  }));
  T('③-1 ★★ 일본어면 물때가 일본식이다', 물때.style === 'jp', 물때);
  T('③-2 ★★ 이름이 다섯 가지 안에 있다',
    물때.이름.every(x => ['大潮','中潮','小潮','長潮','若潮'].indexOf(x) >= 0), 물때.이름);
  T('③-3 ★ 삭(음력 1일)은 大潮', 물때.이름[0] === '大潮', 물때.이름);
  T('③-4 ★ 長潮 다음이 若潮', 물때.이름[2] === '長潮' && 물때.이름[3] === '若潮', 물때.이름);
  T('③-5 ★ 일본식일 때는 사리·조금 딱지를 또 안 붙인다', 물때.딱지 === '', 물때.딱지);

  // ── 사람 빠짐 단추
  const 번호 = await pg.evaluate(() => {
    const out = {};
    mobAt = { lat:35.30, lon:139.62, at:new Date().toISOString(), from:'GPS' };   // 三浦 앞바다
    mobPaint();
    let a = document.getElementById('mobSos');
    out.일본 = { href:a.getAttribute('href'), text:(a.textContent||'').trim() };
    mobAt = { lat:34.74, lon:127.73, at:new Date().toISOString(), from:'GPS' };   // 여수 앞바다
    mobPaint();
    a = document.getElementById('mobSos');
    out.한국 = { href:a.getAttribute('href'), text:(a.textContent||'').trim() };
    mobAt = { lat:null, lon:null, at:new Date().toISOString(), from:'' };         // 자리를 모를 때
    mobPaint();
    a = document.getElementById('mobSos');
    out.모름 = { href:a.getAttribute('href'), text:(a.textContent||'').trim() };
    mobClose();
    return out;
  });
  T('④-1 ★★★ 일본 바다에서는 118 로 건다', 번호.일본.href === 'tel:118', 번호);
  T('④-2 ★★★ 한국 바다에서는 119 로 건다 (122 아니다)', 번호.한국.href === 'tel:119', 번호);
  T('④-3 ★ 자리를 모르면 쓰는 말을 따른다 (일본어 → 118)', 번호.모름.href === 'tel:118', 번호);
  T('④-4 ★ 단추 글자도 일본어다',
    !/[가-힣]/.test(번호.일본.text) && /118/.test(번호.일본.text), 번호);

  T('⑤ 화면에서 터진 데가 없다', errs.length === 0, errs.slice(0, 4));
  return 끝(br);
})().catch(async e => { console.log('★ 실패: 검사가 터졌습니다 — ' + e);
  console.log('\n합계: ' + ok + '개 통과 / ' + (bad + 1) + '개 실패');
  srv.close(); process.exit(1); });
