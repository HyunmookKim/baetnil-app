// 5.43 — 진짜 브라우저에서 눌러 본다
// 사장님 (2026-10-06)
//   ① 「항해기록이랑 거리 엔신시간은 … 월별 일별 1년 3년 5년 … 자율적으로 기간 선택」 — 5.42 는 「이번 달」 하나로 줄이고 「2026년」 칩을 남겼다
//      → 「다른 어플들 확인해 가지고 정해 가지고 만들어라」: Apple 건강 「1일·1개월·1년」 + ‹ › 넘기기(삼성 헬스·앱 달력) + 전체 + 직접 입력(은행)
//   ② 「총가동시간도 어느 기점으로 총가동시간인데?」 — 칸을 눌러 시작 시점(전체·직접 입력), 전체면 첫 기록 날 「…부터」
//   ③ 「선주가 권한주는식」 — 등급 설정에 「일정」 (옛 등급은 배 정보 권한을 따름)
//   ④ 「디자인이랑 문장 같은 거 다 확인했냐」 — 노을·검정·흰 × 한·영·러·일, 칩이 한 줄에 들어가는가
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'));
const ROOT = path.dirname(FILE);
const server = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOT = process.env.SHOT || '';

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function open(theme, lang, pre){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    await ctx.addInitScript(({ theme, lang, pre }) => { try{ if(sessionStorage.getItem('__pre')) return; sessionStorage.setItem('__pre', '1');
      localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done');
      if(theme) localStorage.setItem('bt_theme', theme); if(lang && lang !== 'ko') localStorage.setItem('bt_lang', lang);
      if(pre) Object.keys(pre).forEach(k => localStorage.setItem(k, pre[k])); }catch(_){} }, { theme, lang, pre });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url, { waitUntil:'domcontentloaded' }); await sleep(1500);
    await pg.evaluate(() => { window.ask = () => Promise.resolve(true); try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
    await sleep(400);
    await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = '시험호'; createBoat(); } });
    await sleep(900);
    // 항해: 오늘 · 오늘 전날(같은 달이면) · 이번 달 1일 · 올해 1월 1일 · 작년 3월 · 작년 12월 · 3년 전 · 예정(오늘 뒤)
    await pg.evaluate(() => {
      const p = n => String(n).padStart(2, '0'), d0 = new Date(), Y = d0.getFullYear(), M = d0.getMonth() + 1, D = d0.getDate();
      const td = Y + '-' + p(M) + '-' + p(D), m1 = Y + '-' + p(M) + '-01';
      voyage = [
        { id:'a1', date: td, title:'오늘', nm:'10', engineH:'1', logs:[] },
        { id:'a2', date: m1, title:'이달 1일', nm:'20', engineH:'2', logs:[] },
        { id:'a3', date: Y + '-01-01', title:'설날', nm:'30', engineH:'3', logs:[] },
        { id:'a4', date: (Y - 1) + '-03-14', title:'작년 3월', nm:'40', engineH:'4', logs:[] },
        { id:'a5', date: (Y - 1) + '-12-31', title:'작년 마지막 날', nm:'50', engineH:'5', logs:[] },
        { id:'a6', date: (Y - 3) + '-06-01', title:'3년 전', nm:'60', engineH:'6', logs:[] },
        { id:'a7', date: (Y + 1) + '-01-02', plan:true, title:'예정', nm:'99', engineH:'0', logs:[] }
      ];
      window.__td = td; window.__Y = Y; window.__M = M; window.__D = D;
      fuel = [ { id:'f1', date: (Y - 1) + '-12-01', liters:240, full:true } ];
      runs = [ { id:'r1', date: (Y - 1) + '-12-20', hours:2, purpose:'충전' } ];
      saveMR();
    });
    return { ctx, pg, errs };
  }
  const goVoy = pg => pg.evaluate(() => { boatSubTab = 'voyage'; switchTab('boat'); });
  const 숫자 = pg => pg.evaluate(() => [...document.querySelectorAll('#voyageList .statrow .stat b')].map(b => b.textContent.trim()).join());
  const 칩 = pg => pg.evaluate(() => [...document.querySelectorAll('#voyageList .perrow .tab')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')).join('|'));
  const 줄 = pg => pg.evaluate(() => { const n = document.querySelector('#voyageList .pernav'); if(!n) return null;
    const bs = [...n.querySelectorAll('.calnav')];
    return { title: (n.querySelector('.calym') || {}).textContent.trim(), prev: bs[0] ? !bs[0].disabled : null, next: bs[1] ? !bs[1].disabled : null, arrows: bs.length }; });
  const 누름 = async (pg, name) => { await pg.locator('#voyageList .perrow .tab', { hasText: name }).first().click(); await sleep(350); };
  const 넘김 = async (pg, n) => { await pg.locator('#voyageList .pernav .calnav').nth(n < 0 ? 0 : 1).click(); await sleep(350); };

  // ══ ① 항해 기간 ══
  let { ctx, pg, errs } = await open(null, 'ko');
  await goVoy(pg); await sleep(600);
  const Y = await pg.evaluate(() => __Y), M = await pg.evaluate(() => __M), D = await pg.evaluate(() => __D);
  T('① 칩 다섯: 1일 · 1개월 · 1년 · 전체 · 직접 입력 (처음은 올해 = 1년)', await 칩(pg) === '1일|1개월|1년*|전체|직접 입력', await 칩(pg));
  T('① 「2026년」·「이번 달」·「3년」·「5년」 칩이 없다', !/이번 달|3년|5년|\d{4}년/.test(await 칩(pg)));
  let z = await 줄(pg);
  T('① 1년 — 넘기는 줄 「‹ ' + Y + '년 ›」, 올해라 › 는 막힘', z && z.title === Y + '년' && z.prev && z.next === false, z);
  const 올해 = await 숫자(pg);
  const 올해기대 = (D === 1) ? '2,30,4' : '3,60,6';   // 오늘이 1일이면 a1·a2 가 같은 날
  T('① 1년(올해) — 예정은 빼고 올해 것 (' + 올해기대 + ')', 올해 === 올해기대 || (M === 1 && D === 1), 올해);
  await 넘김(pg, -1); z = await 줄(pg);
  T('① ‹ — 작년 「' + (Y - 1) + '년」 (작년 3월·12월 → 2 · 90 · 9), › 가 열린다', z.title === (Y - 1) + '년' && (await 숫자(pg)) === '2,90,9' && z.next, { z, n: await 숫자(pg) });
  await 넘김(pg, 1); z = await 줄(pg);
  T('① › — 다시 올해', z.title === Y + '년' && z.next === false, z);
  // 1개월
  await 누름(pg, '1개월'); z = await 줄(pg);
  T('① 1개월 — 「' + Y + '년 ' + M + '월」 (달력 머리 줄과 같은 글)', z && z.title === Y + '년 ' + M + '월' && z.next === false, z);
  await 넘김(pg, -1); z = await 줄(pg);
  const pm = M === 1 ? 12 : M - 1, py = M === 1 ? Y - 1 : Y;
  T('① 1개월 ‹ — 지난달 「' + py + '년 ' + pm + '월」', z.title === py + '년 ' + pm + '월', z);
  // 지난해 12월까지 넘겨서 숫자 확인
  for(let i = 0; i < 24 && (await 줄(pg)).title !== (Y - 1) + '년 12월'; i++) await 넘김(pg, -1);
  T('① 1개월 — 작년 12월로 넘기면 그 달 것만 (1 · 50 · 5)', (await 줄(pg)).title === (Y - 1) + '년 12월' && (await 숫자(pg)) === '1,50,5', { t: (await 줄(pg)).title, n: await 숫자(pg) });
  // 1일
  await 누름(pg, '1일'); z = await 줄(pg);
  T('① 1일 — 오늘 「' + Y + '년 ' + M + '월 ' + D + '일」, 오늘 것만 (1 · 10 · 1)', z && z.title === Y + '년 ' + M + '월 ' + D + '일' && (await 숫자(pg)) === (D === 1 ? '2,30,3' : '1,10,1') && z.next === false, { z, n: await 숫자(pg) });
  await 넘김(pg, -1); z = await 줄(pg);
  T('① 1일 ‹ — 어제로 넘어간다', z.title !== Y + '년 ' + M + '월 ' + D + '일' && z.next, z);
  // 전체
  await 누름(pg, '전체');
  T('① 전체 — 넘기는 줄 없음, 예정 빼고 다 (6 · 210 · 21)', (await 줄(pg)) === null && (await 숫자(pg)) === '6,210,21', await 숫자(pg));
  // 다섯 칩이 한 줄에 다 들어간다 (5.42 는 「직접 입력」 이 잘렸다)
  const 들어감 = await pg.evaluate(() => { const R = document.querySelector('#voyageList .perrow'); return { sw: R.scrollWidth, cw: R.clientWidth }; });
  T('① 다섯 칩이 폰(390) 한 줄에 다 들어간다', 들어감.sw <= 들어감.cw + 1, 들어감);
  // 직접 입력
  await 누름(pg, '직접 입력');
  const 폼 = await pg.evaluate(() => ({ t: document.getElementById('lkFormTitle').textContent, lbl: [...document.querySelectorAll('#formBody label')].map(x => x.textContent), ty: [...document.querySelectorAll('#formBody input')].map(x => x.type) }));
  T('① 직접 입력 — 시작일·종료일 날짜 칸', 폼.t === '직접 입력' && 폼.lbl.join() === '시작일,종료일' && 폼.ty.join() === 'date,date', 폼);
  const a = (Y - 3) + '-01-01', b = (Y - 1) + '-06-30';
  await pg.locator('#ff0').fill(a); await pg.locator('#ff1').fill(b); await pg.locator('#formFoot .fbtn.go').click(); await sleep(500);
  z = await 줄(pg);
  T('① 직접 입력 — 3년 전 1월 ~ 작년 6월 (3년 전·작년 3월 → 2 · 100 · 10), 넘김 화살표 없이 기간만', (await 숫자(pg)) === '2,100,10' && z && z.arrows === 0 && z.title === a.replace(/-/g, '.') + ' – ' + b.replace(/-/g, '.'), { n: await 숫자(pg), z });
  T('① 직접 입력 칩은 「직접 입력」 그대로 (잘리지 않게)', await 칩(pg) === '1일|1개월|1년|전체|직접 입력*', await 칩(pg));
  await pg.locator('#voyageList .pernav .pertitle').click(); await sleep(300);
  T('① 기간을 누르면 다시 고친다 (고른 날이 들어 있다)', await pg.evaluate(() => document.getElementById('lkFormTitle').textContent === '직접 입력' && document.getElementById('ff0').value), await pg.evaluate(() => document.getElementById('ff0').value));
  await pg.locator('#ff0').fill(''); await pg.locator('#formFoot .fbtn.go').click(); await sleep(300);
  T('① 시작일이 비면 칸 아래에 알리고 창은 그대로', await pg.evaluate(() => /시작일을 입력해 주세요/.test(document.getElementById('formBody').textContent) && getComputedStyle(document.getElementById('formOv')).display !== 'none'));
  await pg.evaluate(() => closeForm()); await sleep(200);
  // 기억 — 칩은 남고, 넘긴 자리는 다시 켜면 오늘로
  await 누름(pg, '1개월'); await 넘김(pg, -1);
  await pg.reload({ waitUntil:'domcontentloaded' }); await sleep(1600);
  await goVoy(pg); await sleep(500);
  z = await 줄(pg);
  T('① 다시 켜면 고른 칩(1개월)은 남고, 넘긴 자리는 이번 달로 (Apple 건강과 같음)', await 칩(pg) === '1일|1개월*|1년|전체|직접 입력' && z && z.title === Y + '년 ' + M + '월', { c: await 칩(pg), z });
  // 보기 전용에서도
  await pg.evaluate(() => { unlocked = false; applyLock(); renderVoyage(); }); await sleep(300);
  await 누름(pg, '1년'); await 넘김(pg, -1);
  T('① 보기 전용에서도 고르고 넘긴다 (보는 것이지 고치는 것이 아님)', (await 줄(pg)).title === (Y - 1) + '년', await 줄(pg));
  T('오류 없음 (①)', errs.length === 0, errs);
  await ctx.close();
  // 5.42 에 기억된 「3년」 은 1년(올해)으로
  ({ ctx, pg, errs } = await open(null, 'ko', { bt_voyper: JSON.stringify({ k:'y3' }) }));
  await goVoy(pg); await sleep(500);
  T('① 5.42 에 기억된 「3년」 은 「1년」 으로 바뀐다', await 칩(pg) === '1일|1개월|1년*|전체|직접 입력', await 칩(pg));
  await ctx.close();

  // ══ ② 총 가동시간 ══
  ({ ctx, pg, errs } = await open(null, 'ko'));
  await pg.evaluate(() => { boatSubTab = 'maint'; mntSub = 'fuel'; switchTab('boat'); }); await sleep(600);
  const 총칸 = () => pg.evaluate(() => { const s = [...document.querySelectorAll('#fuelList .stat.pickstat')][1]; if(!s) return null;
    const i = s.querySelector('.statsub'); return { b: s.querySelector('b').textContent.replace(/\s+/g, ''), l: s.querySelector('span').textContent.trim(), sub: i ? i.textContent.trim() : '' }; });
  let c = await 총칸();
  const 첫날 = (Y - 3) + '-06-01';
  const 전체값 = await pg.evaluate(() => engineHours().total);
  T('② 처음은 「총 가동시간 ▾」 + 아래 「' + 첫날 + '부터」 (앱에 처음 기록한 날)', c && c.l === '총 가동시간▾' && c.sub === 첫날 + '부터', c);
  T('② 값은 예전 그대로 — 항해 엔진 시간 + 엔진만 가동 (' + 전체값 + '시간)', 전체값 === 23 && /^23시간/.test(c.b), { c, 전체값 });
  await pg.locator('#fuelList .stat.pickstat').nth(1).click(); await sleep(400);
  const 고름 = await pg.evaluate(() => ({ t: document.getElementById('lkFormTitle').textContent, o: [...document.querySelectorAll('#formBody .fopt b')].map(x => x.textContent) }));
  T('② 누르면 「시작 시점」 — 전체 · 직접 입력', 고름.t === '시작 시점' && 고름.o.join() === '전체,직접 입력', 고름);
  await pg.locator('#formBody .fopt', { hasText:'직접 입력' }).click(); await pg.locator('#formFoot .fbtn.go').click(); await sleep(400);
  const 날폼 = await pg.evaluate(() => ({ t: document.getElementById('lkFormTitle').textContent, ty: [...document.querySelectorAll('#formBody input')].map(x => x.type), v: document.getElementById('ff0').value }));
  T('② 직접 입력 — 시작일 날짜 칸, 처음 값은 첫 기록 날', 날폼.t === '직접 입력' && 날폼.ty.join() === 'date' && 날폼.v === 첫날, 날폼);
  const 시작 = Y + '-01-01';
  await pg.locator('#ff0').fill(시작); await pg.locator('#formFoot .fbtn.go').click(); await sleep(400);
  c = await 총칸();
  const 날값 = await pg.evaluate(() => ehTotal().h);
  T('② 직접 입력 — 이름이 「' + 시작 + ' 이후 가동 ▾」, 아래 날짜 줄은 없다', c && c.l === 시작 + ' 이후 가동▾' && c.sub === '', c);
  T('② 직접 입력 — 올해 1월 1일부터의 엔진 시간만 (올해 항해 엔진 시간 합 = 1년 칩 숫자와 같다)', Math.abs(날값 - (D === 1 ? 5 : 6)) < 0.01 || M === 1, 날값);
  await pg.evaluate(d => { localStorage.setItem('bt_ehtot@' + currentBoatId, JSON.stringify({ k:'date', d })); }, 첫날);
  T('② 첫 기록 날을 시작일로 고르면 「전체」 와 같은 값', await pg.evaluate(() => Math.abs(ehTotal().h - engineHours().total) < 0.01));
  await pg.evaluate(d => { localStorage.setItem('bt_ehtot@' + currentBoatId, JSON.stringify({ k:'date', d })); renderFuel(); }, 시작);
  T('② 고른 기준은 배마다 기기에 남는다', await pg.evaluate(() => /"k":"date"/.test(localStorage.getItem('bt_ehtot@' + currentBoatId) || '')));
  await pg.locator('#fuelList .stat.pickstat').nth(1).click(); await sleep(300);
  await pg.locator('#formBody .fopt', { hasText:'전체' }).click(); await pg.locator('#formFoot .fbtn.go').click(); await sleep(400);
  c = await 총칸();
  T('② 다시 「전체」 — 총 가동시간 + 첫 기록 날', c.l === '총 가동시간▾' && c.sub === 첫날 + '부터', c);
  T('② 만탱크 칸(5.42)은 그대로 첫 칸', await pg.evaluate(() => /만탱크 후 가동/.test(document.querySelectorAll('#fuelList .stat.pickstat')[0].textContent)));
  await pg.evaluate(() => { unlocked = false; applyLock(); renderFuel(); }); await sleep(300);
  await pg.locator('#fuelList .stat.pickstat').nth(1).click(); await sleep(300);
  T('② 보기 전용에서도 시작 시점을 고른다 (보는 기준)', await pg.evaluate(() => document.getElementById('lkFormTitle').textContent === '시작 시점'));
  await pg.evaluate(() => closeForm());
  await pg.evaluate(() => { voyage = []; runs = []; saveMR(); renderFuel(); }); await sleep(300);
  c = await 총칸();
  T('② 기록이 없으면 날짜 줄 없이 0분', c && c.sub === '' && /0분/.test(c.b), c);
  T('오류 없음 (②)', errs.length === 0, errs);
  await ctx.close();

  // ══ ③ 일정 권한 ══
  ({ ctx, pg, errs } = await open(null, 'ko'));
  const 권 = await pg.evaluate(() => {
    const b = curBoat(); seedRanks(b);
    const L = rankList(b), owner = L.find(r => r.owner), crew = L.find(r => r.pos === 3), guest = L.find(r => r.pos === 4), co = L.find(r => r.pos === 1);
    // ★ 5.42 까지 만든 등급처럼 sched 값을 지운다 — 옛 등급
    L.forEach(r => { if(r.perms) delete r.perms.sched; });
    return { crew: permOf(crew, 'sched'), guest: permOf(guest, 'sched'), co: permOf(co, 'sched'), owner: permOf(owner, 'sched'),
             crewBoat: permOf(crew, 'boat'), ids: { owner: owner.id, crew: crew.id, guest: guest.id } };
  });
  T('③ 옛 등급은 배 정보 권한을 따른다 — 공동 관리자 쓰기 · 크루 보기 · 손님 없음 · 선주 전체 (5.41 과 같다)',
    권.co === 'write' && 권.crew === 'view' && 권.guest === 'none' && 권.owner === 'full', 권);
  // 등급 설정 화면에 「일정」 줄
  await pg.evaluate(id => editRankUI(id), 권.ids.crew); await sleep(400);
  const 줄들 = await pg.evaluate(() => [...document.querySelectorAll('#mrPanel .permrow .permname')].map(x => x.textContent.trim()));
  T('③ 등급 설정에 「일정」 줄이 체크리스트 바로 아래', 줄들.indexOf('일정') === 줄들.indexOf('체크리스트') + 1, 줄들);
  const 켜짐 = await pg.evaluate(() => { const r = [...document.querySelectorAll('#mrPanel .permrow')].find(x => x.querySelector('.permname').textContent.trim() === '일정');
    return [...r.querySelectorAll('.permb')].map(b => b.textContent.trim() + (b.classList.contains('on') ? '*' : '')).join(); });
  T('③ 크루 「일정」 은 처음 「보기」 (배 정보를 따름)', 켜짐 === '없음,보기*,쓰기,전체 권한', 켜짐);
  // 선주가 크루에게 쓰기를 준다 — 크루로 들어가 일정 넣기
  await pg.evaluate(() => { window.ask = () => Promise.resolve(true); });
  await pg.locator('#mrPanel .permrow', { hasText:'일정' }).locator('.permb', { hasText:'쓰기' }).click(); await sleep(300);
  const 준값 = await pg.evaluate(id => curBoat().ranks[id].perms.sched, 권.ids.crew);
  T('③ 선주가 「쓰기」 를 누르면 크루 등급에 sched:write 가 저장된다', 준값 === 'write', 준값);
  const 크루로 = async rid => pg.evaluate(rid => { const b = curBoat(); window.__user = { uid:'crewU' };
    b.members = { ownerU: Object.values(b.ranks).find(r => r.owner).id, crewU: rid }; }, rid);
  await 크루로(권.ids.crew);
  T('③ 쓰기를 받은 크루는 일정을 넣을 수 있다 (배 정보는 여전히 보기)', await pg.evaluate(() => permOk('sched') && !permOk('boat') && canPush('scheds')));
  await pg.evaluate(id => { curBoat().ranks[id].perms.sched = 'view'; }, 권.ids.crew);
  const 막힘 = await pg.evaluate(() => { let said = ''; const tl = window.tell; window.tell = m => { said = String(m); }; const n = scheds.length; addSched(today()); window.tell = tl; return { said, added: scheds.length - n }; });
  T('③ 보기만 있는 크루가 「+ 일정」 을 누르면 넣지 않고 「일정을(를) 작성할 권한이 없습니다」', 막힘.added === 0 && /일정을\(를\) 작성할 권한이 없습니다/.test(막힘.said), 막힘);
  // 없음이면 달력에 안 보인다
  await pg.evaluate(() => { scheds.push({ id:'s1', title:'청소', date: today(), time:'', rep:'', note:'' }); });
  const 보임 = await pg.evaluate(() => calItems(today(), today()).some(r => r.kind === 'sched'));
  await pg.evaluate(id => { curBoat().ranks[id].perms.sched = 'none'; }, 권.ids.crew);
  const 안보임 = await pg.evaluate(() => calItems(today(), today()).some(r => r.kind === 'sched'));
  T('③ 「보기」 면 달력에 일정이 보이고, 「없음」 이면 안 보인다', 보임 && !안보임, { 보임, 안보임 });
  await pg.evaluate(() => { window.__user = null; curBoat().members = {}; });
  T('③ 혼자 쓰는 배(명부 없음)는 그대로 넣고 본다', await pg.evaluate(() => permOk('sched') && schedSee()));
  T('오류 없음 (③)', errs.length === 0, errs);
  await ctx.close();

  // ══ ④ 세 화면 × 네 언어 — 칩이 한 줄에 들어가고 번역돼 뜬다 ══
  const 말 = { ko:['1일', '1개월', '1년', '전체', '직접 입력'], en:['1 day', '1 month', '1 year', 'All', 'Manual entry'],
               ru:['1 день', '1 месяц', '1 год', 'Все', 'Ручной ввод'], ja:['1日', '1か月', '1年', 'すべて', '手入力'] };
  for(const theme of ['sunset', 'black', 'light']){
    for(const lang of ['ko', 'en', 'ru', 'ja']){
      const o = await open(theme, lang);
      await goVoy(o.pg); await sleep(500);
      const r = await o.pg.evaluate(() => { const R = document.querySelector('#voyageList .perrow');
        return { c: [...R.querySelectorAll('.tab')].map(b => b.textContent.trim()), sw: R.scrollWidth, cw: R.clientWidth,
                 title: (document.querySelector('#voyageList .pernav .calym') || {}).textContent }; });
      if(SHOT) await o.pg.screenshot({ path: SHOT + '-' + theme + '-' + lang + '-voy.png', clip:{ x:0, y:0, width:390, height:420 } });
      T('④ ' + theme + '·' + lang + ' — 칩 다섯이 번역되고 한 줄에 들어간다', r.c.length === 5 && !r.c.some(x => /[가-힣]/.test(x) && lang !== 'ko') && r.sw <= r.cw + 1, r);
      T('④ ' + theme + '·' + lang + ' — 넘기는 줄 제목(올해)', !!r.title && r.title.indexOf(String(new Date().getFullYear())) >= 0 && (lang === 'ko' || !/년/.test(r.title)), r.title);
      if(말[lang]) T('④ ' + lang + ' 칩 글', r.c.join('|') === 말[lang].join('|'), r.c);
      await o.pg.evaluate(() => { boatSubTab = 'maint'; mntSub = 'fuel'; switchTab('boat'); }); await sleep(500);
      const f = await o.pg.evaluate(() => { const s = [...document.querySelectorAll('#fuelList .stat.pickstat')][1]; const i = s && s.querySelector('.statsub');
        return s ? { l: s.querySelector('span').textContent.trim(), sub: i ? i.textContent.trim() : '', over: s.scrollWidth > s.clientWidth + 1 } : null; });
      if(SHOT) await o.pg.screenshot({ path: SHOT + '-' + theme + '-' + lang + '-fuel.png' });
      T('④ ' + theme + '·' + lang + ' — 총 가동시간 칸 번역 · 날짜 줄 · 칸 밖으로 안 넘침', f && f.sub && !f.over && (lang === 'ko' || !/[가-힣]/.test(f.l + f.sub)), f);
      T('④ ' + theme + '·' + lang + ' — 오류 없음', o.errs.length === 0, o.errs);
      await o.ctx.close();
    }
  }
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 멈췄습니다 — ' + e); process.exit(1); });
