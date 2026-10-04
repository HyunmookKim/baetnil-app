// 5.35 — 실제 화면에서: 배 연락처 여러 개 · 체크리스트 항목 한 화면 · 갈래 줄이 스크롤해도 남는가 · 배 둘러보기 스위치
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const SHOT = process.env.SHOT_DIR || '';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 260) : '')); } };

async function run(br, lang){
  const ctx = await br.newContext({ locale: lang === 'ko' ? 'ko-KR' : 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(l => { try{ localStorage.setItem('bt_lang', l); }catch(e){} }, lang);
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  const shot = async n => { if(SHOT) await pg.screenshot({ path: path.join(SHOT, lang + '-' + n + '.png') }); };
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil: 'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { window.__al = [];
    window.tell = m => { window.__al.push(String(m)); return Promise.resolve(); };
    window.ask = m => { window.__al.push(String(m)); return Promise.resolve(true); };
    try{ skipWelcome(); }catch(_){} unlocked = true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('nbName').value = '시험호'; createBoat(); });
  await pg.waitForTimeout(1500);
  const L = '[' + lang + '] ';

  // ── 연락처
  await pg.evaluate(() => { const b = curBoat(); b.phone = '010-1111-2222'; saveMR(); openBoat('info'); });
  await pg.waitForTimeout(500);
  const info0 = await pg.evaluate(() => document.getElementById('mrPanel').innerText);
  T(L + '옛 전화 한 칸이 연락처 목록 첫 줄로 보인다', /010-1111-2222/.test(info0), info0.slice(0, 200));
  await pg.evaluate(() => openCiEdit());
  await pg.waitForTimeout(300);
  await pg.evaluate(() => { ciAdd(); ciAdd(); ciAdd(); });
  // 사람이 하듯 칸에 글을 넣고 고른다
  const rows = await pg.$$('#mrPanel .ciedit');
  T(L + '+ 연락처 추가로 줄이 늘어난다 (4줄)', rows.length === 4, rows.length);
  const fill = async (i, kind, lab, val) => {
    const r = (await pg.$$('#mrPanel .ciedit'))[i];
    const sels = await r.$$('select.cisel');
    await sels[0].selectOption(kind); await pg.waitForTimeout(80);
    const r2 = (await pg.$$('#mrPanel .ciedit'))[i];
    const s2 = await r2.$$('select.cisel');
    await s2[1].selectOption(lab); await pg.waitForTimeout(80);
    const r3 = (await pg.$$('#mrPanel .ciedit'))[i];
    const ins = await r3.$$('input.ciinput');
    await ins[0].fill(val);
    return ins;
  };
  await fill(0, 'tel', 'biz', '010-1111-2222');
  await fill(1, 'email', 'office', 'office@baetnil.com');
  await fill(2, 'insta', 'etc', '@baetnil_yacht');
  const ins = await fill(3, 'kakao', 'custom', 'open.kakao.com/o/abc123');
  const r3 = (await pg.$$('#mrPanel .ciedit'))[3];
  // ★ 5.36 — 「직접 입력」 은 용도 칸 **그 자리**가 글 칸으로 바뀐다(사장님: 「그 이름이 위에가 있어야지」)
  const cl = await r3.$$('.ciline input.cicl');
  const ci = await r3.$$('input.ciinput');
  T(L + '「직접 입력」 을 고르면 용도 칸 그 자리가 글 칸이 된다 (아래에 따로 안 생김)', cl.length === 1 && ci.length === 1, [cl.length, ci.length]);
  if(cl[0]) await cl[0].fill('예약 문의');
  await shot('1-contact-edit');
  await pg.evaluate(() => ciSave());
  await pg.waitForTimeout(500);
  const saved = await pg.evaluate(() => ({ cinfo: curBoat().cinfo, phone: curBoat().phone, txt: document.getElementById('mrPanel').innerText }));
  T(L + '네 줄이 저장된다', Array.isArray(saved.cinfo) && saved.cinfo.length === 4, saved.cinfo);
  T(L + '종류·용도가 그대로', saved.cinfo && saved.cinfo[1].t === 'email' && saved.cinfo[1].lab === 'office' && saved.cinfo[2].v === 'baetnil_yacht' && saved.cinfo[3].cl === '예약 문의', saved.cinfo);
  T(L + '대표 전화는 옛 칸(phone)에도', saved.phone === '010-1111-2222', saved.phone);
  T(L + '기본정보 화면에 네 줄이 보인다', /office@baetnil\.com/.test(saved.txt) && /baetnil_yacht/.test(saved.txt) && /예약 문의/.test(saved.txt), saved.txt.slice(0, 400));
  await shot('2-contact-info');
  // 틀린 이메일은 막는다
  await pg.evaluate(() => { openCiEdit(); ciDraft[1].v = 'office.baetnil.com'; ciSave(); });
  await pg.waitForTimeout(300);
  const er = await pg.evaluate(() => ({ err: !!document.querySelector('#mrPanel .ferr'), still: curBoat().cinfo[1].v }));
  T(L + '틀린 이메일은 그 줄 아래 오류, 저장 안 함', er.err && er.still === 'office@baetnil.com', er);
  await pg.evaluate(() => ciCancel());

  // ── 공개 사본(남이 보는 배 화면)에 연락처가 실린다 — 연락처 공개를 켰을 때만
  const pubA = await pg.evaluate(() => { const b = curBoat(); b.pub = b.pub || {}; b.pub.phone = false; return buildPublic(b).cinfo; });
  T(L + '연락처 공개를 끄면 공개 사본에 연락처가 없다', !pubA, pubA);
  const pubB = await pg.evaluate(() => { const b = curBoat(); b.pub.phone = true; const o = buildPublic(b); return { c: o.cinfo, html: boatPageBody ? (() => { try{ return boatPageBody(o, 'info'); }catch(e){ return 'ERR ' + e.message; } })() : '' }; });
  T(L + '연락처 공개를 켜면 네 줄이 공개 사본에', Array.isArray(pubB.c) && pubB.c.length === 4, pubB.c);

  // ── 배 둘러보기 스위치
  await pg.evaluate(() => { const b = curBoat(); b.pub = { spec:true }; saveMR(); openPublish(); });
  await pg.waitForTimeout(500);
  const p1 = await pg.evaluate(() => ({ has: !!document.querySelector('#mrPanel .pubmaster'), first: (document.querySelector('#mrPanel .permrow') || {}).className, pub: isPublic(curBoat()) }));
  T(L + '공개 설정 맨 위가 「배 둘러보기에 표시」 스위치', p1.has && /pubmaster/.test(p1.first || ''), p1);
  T(L + '예전 배(항목 하나 켬)는 그대로 표시 중', p1.pub === true);
  await shot('3-publish-master');
  await pg.evaluate(() => setListedUI(false));
  await pg.waitForTimeout(400);
  T(L + '끄면 배 둘러보기에서 빠진다 (항목은 그대로 켜져 있어도)', await pg.evaluate(() => isPublic(curBoat()) === false && curBoat().pub.spec === true));
  await pg.evaluate(() => openBoat('info'));
  await pg.waitForTimeout(300);
  const infoRow = await pg.evaluate(() => document.getElementById('mrPanel').innerText);
  T(L + '기본정보에 「배 둘러보기 — 꺼짐」 과 설정 단추', /(배 둘러보기|Boats)[\s\S]{0,20}(꺼짐|Off)/i.test(infoRow), infoRow.slice(0, 600));
  await shot('4-info-listed-off');
  await pg.evaluate(() => setListedUI(true, 'info'));
  await pg.waitForTimeout(300);
  T(L + '다시 켜면 표시', await pg.evaluate(() => isPublic(curBoat()) === true));

  // ── 체크리스트 — 줄의 수정 단추 → 바로 항목 화면
  await pg.evaluate(() => {
    const ls = ckLists(); const lid = String(ls[0].id);
    for(let i = 0; i < 40; i++) checkt.push({ id: newId(), label: '점검 ' + (i + 1), url: '', list: lid });
    saveMR(); setHomeSub('check');
  });
  await pg.waitForTimeout(800);
  const scr = await pg.evaluate(() => ({ chips: !!document.querySelector('.ckpin'), rows: document.querySelectorAll('[onclick*="ckRowMenu"]').length }));
  T(L + '체크리스트 화면이 뜨고 줄마다 수정 단추', scr.rows >= 40, scr);
  const firstLabel = await pg.evaluate(() => { const m = document.querySelector('[onclick*="ckRowMenu"]').getAttribute('onclick').match(/ckRowMenu\('([^']+)'\)/); const it = checkt.find(c => String(c.id) === m[1]); return it ? it.label : null; });
  await pg.click('[onclick*="ckRowMenu"]');
  await pg.waitForTimeout(400);
  const f = await pg.evaluate(() => {
    const ov = document.getElementById('formOv'); const box = ov && ov.querySelector('.formBox');
    return { open: ov && getComputedStyle(ov).display !== 'none', title: (document.getElementById('lkFormTitle') || {}).textContent,
      inputs: [...(ov ? ov.querySelectorAll('input') : [])].map(i => i.value), del: !!(ov && /삭제|Delete/.test(ov.innerText)), w: box ? box.getBoundingClientRect().width : 0,
      menuAsk: window.__al.some(x => /무엇을 할까요/.test(x)) };
  });
  T(L + '한 번 누르면 바로 항목 화면 (이름 칸에 지금 이름)', f.open && f.inputs[0] === firstLabel && !f.menuAsk, { firstLabel, ...f });
  T(L + '항목 화면 안에 삭제 단추', f.del, f);
  T(L + '항목 화면이 화면 폭을 채운다 (좁게 안 뜬다)', f.w > 300, f.w);
  await shot('5-check-edit');
  await pg.evaluate(() => { const ov = document.getElementById('formOv'); const i = ov.querySelector('input'); i.value = '연료 확인'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.evaluate(() => { const b = [...document.querySelectorAll('#formOv button')].find(x => /^(저장|Save)$/.test(x.textContent.trim())); b && b.click(); });
  await pg.waitForTimeout(400);
  T(L + '저장하면 이름이 바뀐다', await pg.evaluate(() => checkt.some(c => c.label === '연료 확인')));
  // 목록 이름
  await pg.evaluate(() => ckListMenu(ckLists()[0].id));
  await pg.waitForTimeout(300);
  const lf = await pg.evaluate(() => ({ name: ckLists()[0].name, title: document.getElementById('lkFormTitle').textContent, v: [...document.querySelectorAll('#formOv input')].map(i => i.value), del: /목록 삭제|Delete the list/i.test(document.getElementById('formOv').innerText) }));
  T(L + '「목록 수정」 이 바로 목록 화면 (이름 칸에 목록 이름 · 목록 삭제)', lf.v[0] === lf.name && lf.del, lf);
  await pg.evaluate(() => { try{ closeForm(); }catch(_){ const o = document.getElementById('formOv'); if(o) o.style.display = 'none'; } });

  // ── 갈래 줄이 스크롤해도 남는가 (체크리스트 목록 줄)
  await pg.evaluate(() => { window.scrollTo(0, 0); });
  await pg.waitForTimeout(200);
  const top0 = await pg.evaluate(() => { const e = document.querySelector('.ckpin'); return e ? e.getBoundingClientRect().top : null; });
  await pg.mouse.wheel(0, 1600); await pg.waitForTimeout(500);
  const pin = await pg.evaluate(() => {
    const e = document.querySelector('.ckpin'); const h = document.getElementById('hdr') || document.querySelector('header');
    const r = e ? e.getBoundingClientRect() : null;
    const se = document.scrollingElement;
    return { top: r && r.top, bottom: r && r.bottom, hdr: h ? h.getBoundingClientRect().bottom : null, sy: se.scrollTop, stickyTop: getComputedStyle(document.documentElement).getPropertyValue('--stickyTop') || getComputedStyle(document.documentElement).getPropertyValue('--hdrH') };
  });
  T(L + '아래로 스크롤해도 체크리스트 목록 줄이 머리줄 밑에 남는다', pin.sy > 300 && pin.top !== null && pin.top >= 0 && pin.top < 140, { top0, ...pin });
  await shot('6-check-scrolled');

  T(L + '오류 없음', errs.length === 0, errs);
  await ctx.close();
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  try{
    await run(br, 'ko');
    await run(br, 'en');
  }catch(e){ bad++; console.log('★ 실패: 검사가 멈춤 — ' + e.message.slice(0, 300)); }
  await br.close(); server.close();
  console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
  process.exit(bad ? 1 : 0);
})();
