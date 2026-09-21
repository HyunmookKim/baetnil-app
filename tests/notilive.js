// 설정·알림 브라우저 검사 — 글자가 아니라 화면에 실제로 나오는가를 본다
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';

// ★ 뉴스 자료를 여기서 흉내 낸다.
//   krCache·newsCache 는 스크립트 안에 든 변수라 바깥에서 넣어 줄 수 없다.
//   진짜 받아 오는 길(newsLoadIf → fetch)을 그대로 태워야 「진짜 되는가」를 본 것이 된다.
const FIX = {
  '/kr.json':   JSON.stringify({ gov: [
    {title:'가',cat:'기상',date:'2026-08-25T00:00:00.000Z'},
    {title:'나',cat:'안전',date:'2026-08-25T00:00:00.000Z'},
    {title:'다',cat:'기상',date:'2026-08-25T00:00:00.000Z'}] }),
  '/news.json': JSON.stringify({ updated:'2026-08-25T00:00:00.000Z', items: [
    {title:'a',cat:'장비',date:'2026-08-25T00:00:00.000Z'},
    {title:'b',cat:'레이스',date:'2026-08-25T00:00:00.000Z'}] })
};
// ★ 뿌리(/) 요청이 절대경로 파일이면 cwd 를 붙이지 말고 그대로 연다.
//   전에는 process.cwd() 를 무조건 앞에 붙여 절대경로를 못 받고
//   ERR_HTTP_RESPONSE_CODE_FAILURE 로 검사가 아예 돌지 못했다.
const __MAIN = path.isAbsolute(SRC) ? SRC : path.join(process.cwd(), SRC);
const __BASE = path.dirname(__MAIN);
const __pick = u => {
  const f = u.split('?')[0];
  if(f === '/' || f === '/index.html') return __MAIN;
  const rel = f.replace(/^\//,'');
  for(const d of [__BASE, __dirname, process.cwd()]){ const c = path.join(d, rel); if(fs.existsSync(c)) return c; }
  return path.join(__BASE, rel);
};
const srv = http.createServer((req,res)=>{
  let f = req.url.split('?')[0];
  if(FIX[f]){ res.writeHead(200,{'content-type':'application/json'}); res.end(FIX[f]); return; }
  const p = __pick(req.url);
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const ext = path.extname(p);
  res.writeHead(200, { 'content-type':
    ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript':
    ext==='.json'?'application/json':'application/octet-stream' });
  res.end(fs.readFileSync(p));
});

(async ()=>{
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ locale:'ko-KR', viewport:{width:411,height:900} });
  const page = await ctx.newPage();
  let pass=0, fail=0;
  const t=(n,ok)=>{ok?pass++:(fail++,console.log('★ 실패:',n));};
  const errs=[];
  page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1400);

  // 서랍 열기
  await page.evaluate(()=>{ try{ openDrawer(); }catch(e){} });
  await page.waitForTimeout(300);
  const drawer = await page.evaluate(()=> {
    const els = [...document.querySelectorAll('#drawer .ditem')];
    return els.map(e=>e.textContent.trim());
  });
  t('서랍에 「설정」이 보인다', drawer.some(x=>x.includes('설정')));
  t('서랍에 「언어」가 이제 없다', !drawer.some(x=>x.trim().startsWith('언어')));

  // 설정 열기
  await page.evaluate(()=>{ try{ closeDrawer(); openSettings(); }catch(e){} });
  await page.waitForTimeout(400);
  const set = await page.evaluate(()=> ({
    panel: (document.getElementById('mrPanel')||{}).innerText || '',
    // ★ 제목은 패널이 아니라 화면 위쪽 머리줄에 나온다. 패널만 보면 헛걸린다.
    head: document.body.innerText.slice(0, 400),
    shown: (()=>{ const e=document.getElementById('mrPanel'); return e && getComputedStyle(e).display !== 'none'; })()
  }));
  t('설정 화면이 뜬다', set.shown && /알림/.test(set.panel) && /언어/.test(set.panel));
  t('설정 제목이 머리줄에 나온다', /설정/.test(set.head));
  t('설정 안에 알림이 보인다', /알림/.test(set.panel));
  t('설정 안에 언어가 보인다', /언어/.test(set.panel));

  // 알림 열기
  await page.evaluate(()=>{ try{ openNoti(); }catch(e){} });
  await page.waitForTimeout(400);
  const noti = await page.evaluate(()=> (document.getElementById('mrPanel')||{}).innerText || '');
  t('알림 화면이 뜬다', /알림 받기/.test(noti));
  t('내 글에 댓글이 보인다', /내 글에 댓글/.test(noti));
  t('정비 기한이 보인다', /정비/.test(noti) && /기한/.test(noti));
  t('밤에는 안 울리기가 보인다', /밤에는 안 울리기/.test(noti));
  t('구독한 연재 줄이 보인다', /구독한 연재/.test(noti));
  t('관심 분야 소식 줄이 보인다', /관심 분야 소식/.test(noti));
  t('이제 준비 중이 아니다', !/준비 중/.test(noti));
  // ★ 정비(폰이 스스로)와 서버가 보내는 것은 되는 조건이 다르다. 갈라서 말해야 한다.
  t('무엇이 되고 무엇이 아직인지 갈라서 말한다',
    /정비/.test(noti) && /댓글/.test(noti) && /앱으로 여셔야/.test(noti));

  // 스위치가 실제로 눌리는 크기인가
  const sizes = await page.evaluate(()=>
    [...document.querySelectorAll('#mrPanel .notisw')].map(e=>{
      const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)];
    }));
  t('스위치가 하나 이상 그려졌다', sizes.length >= 4);
  t('스위치가 손가락 크기다 (38 이상 폭)', sizes.every(s=>s[0] >= 38));

  // 전체가 꺼져 있으면 아래가 안 눌려야 한다
  const offBlocked = await page.evaluate(()=>{
    const box = document.querySelector('#mrPanel .notioff');
    if(!box) return null;
    return getComputedStyle(box).pointerEvents;
  });
  t('전체가 꺼져 있으면 아래가 안 눌린다', offBlocked === 'none');

  // 켜 보기 (폰 부품이 없으니 허락은 unknown 으로 지나간다)
  await page.evaluate(()=>{ try{ notiSet({on:true}); openNoti(); }catch(e){} });
  await page.waitForTimeout(350);
  const on = await page.evaluate(()=>{
    const box = document.querySelector('#mrPanel .notioff');
    return { blocked: !!box, saved: JSON.parse(localStorage.getItem('bt_noti')||'{}').on };
  });
  t('켜면 아래가 살아난다', on.blocked === false);
  t('켠 것이 저장된다', on.saved === true);

  // 하나 껐다 켜기
  await page.evaluate(()=>{ try{ notiToggle('maint'); }catch(e){} });
  await page.waitForTimeout(300);
  const m1 = await page.evaluate(()=> JSON.parse(localStorage.getItem('bt_noti')||'{}').maint);
  t('항목 하나를 끄면 그것만 꺼진다', m1 === false);

  // 밤 시간 판정 — 자정을 넘는 구간
  const quiet = await page.evaluate(()=>{
    notiSet({ quiet:true, from:'22:00', to:'06:00' });
    const at = (hh,mm)=>{ const d=new Date(); d.setHours(hh,mm,0,0); return notiQuietNow(d); };
    return { at23: at(23,0), at3: at(3,0), at12: at(12,0), at22: at(22,0), at6: at(6,0) };
  });
  t('밤 11시는 참는다', quiet.at23 === true);
  t('새벽 3시도 참는다', quiet.at3 === true);
  t('낮 12시는 안 참는다', quiet.at12 === false);
  t('딱 22:00 은 참는다', quiet.at22 === true);
  t('딱 06:00 은 안 참는다', quiet.at6 === false);

  // ── 구독 · 관심 — 진짜 눌러 본다
  await page.evaluate(()=>{ try{ notiSet({ on:true, series:[], krCats:[], wwCats:[] }); }catch(e){} });

  // 연재 목록에 구독 단추가 진짜 그려지는가 (연재 자료를 심어 놓고 본다)
  const srBtn = await page.evaluate(async ()=>{
    window.seriesList = [
      { id:'S1', sname:"돛 다는 법", no:1, title:'1편', author:'김', date:'2026-08-01', ts:'2026-08-01' },
      { id:'S2', sname:"돛 다는 법", no:2, title:'2편', author:'김', date:'2026-08-02', ts:'2026-08-02' },
      { id:'S3', sname:'',           no:0, title:'옛 글', author:'김', date:'2026-07-01', ts:'2026-07-01' }
    ];
    window.__series = { list: async ()=> window.seriesList };
    const box = document.createElement('div'); box.id = '__srtest';
    box.innerHTML = await seriesHtml();
    document.body.appendChild(box);
    const bs = [...box.querySelectorAll('.subbtn')];
    return {
      n: bs.length,
      text: bs.map(e=>e.textContent.trim()),
      size: bs.map(e=>{ const r=e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }),
      heads: [...box.querySelectorAll('.srghead')].length
    };
  });
  t('연재 묶음이 그려졌다', srBtn.heads >= 2);
  t('이름 있는 연재에만 구독 단추가 붙는다', srBtn.n === 1);
  t('단추에 「구독」이라고 쓰여 있다', srBtn.text[0] === '구독');
  t('구독 단추가 손가락 크기다', srBtn.size.every(z=>z[0] >= 38 && z[1] >= 38));

  // 진짜 눌러 본다 — 따옴표가 든 이름으로
  await page.evaluate(async ()=>{
    await notiSubToggle(encodeURIComponent('돛 "다는" 법'), '');
  });
  await page.waitForTimeout(200);
  const saved = await page.evaluate(()=> JSON.parse(localStorage.getItem('bt_noti')||'{}').series);
  t('누르면 구독이 저장된다', Array.isArray(saved) && saved[0] === '돛 "다는" 법');
  await page.evaluate(async ()=>{ await notiSubToggle(encodeURIComponent('돛 "다는" 법'), ''); });
  await page.waitForTimeout(200);
  const off = await page.evaluate(()=> JSON.parse(localStorage.getItem('bt_noti')||'{}').series);
  t('한 번 더 누르면 풀린다', Array.isArray(off) && off.length === 0);

  // 구독한 연재 화면
  await page.evaluate(async ()=>{ try{ await openNotiSubs(); }catch(e){} });
  await page.waitForTimeout(400);
  const subs = await page.evaluate(()=> (document.getElementById('mrPanel')||{}).innerText || '');
  t('구독한 연재 화면이 뜬다', /돛 다는 법/.test(subs));
  t('그 화면에도 구독 단추가 있다',
    await page.evaluate(()=> document.querySelectorAll('#mrPanel .subbtn').length >= 1));

  // 관심 분야 화면 — 뉴스 자료를 심어 놓고 본다
  const cats = await page.evaluate(async ()=>{
    await openNotiCats();
    await new Promise(r=>setTimeout(r,600));
    const bs = [...document.querySelectorAll('#mrPanel .catbtn')];
    return { text: bs.map(e=>e.textContent.trim()),
             size: bs.map(e=>{const r=e.getBoundingClientRect(); return [Math.round(r.width),Math.round(r.height)];}) };
  });
  t('분야 단추가 그려진다', cats.text.length === 4);
  t('같은 분야가 두 번 안 나온다', new Set(cats.text).size === cats.text.length);
  t('한국·해외 분야가 다 나온다', ['기상','안전','장비','레이스'].every(c=>cats.text.includes(c)));
  t('분야 단추가 손가락 크기다', cats.size.every(z=>z[0] >= 38 && z[1] >= 38));

  await page.evaluate(async ()=>{ await notiCatToggle('kr', encodeURIComponent('기상'), ''); });
  await page.waitForTimeout(200);
  const kc = await page.evaluate(()=> JSON.parse(localStorage.getItem('bt_noti')||'{}'));
  t('분야를 누르면 저장된다', (kc.krCats||[])[0] === '기상');
  t('해외 분야와 섞이지 않는다', (kc.wwCats||[]).length === 0);

  // 알림 화면으로 돌아오면 몇 개 골랐는지 보인다
  await page.evaluate(()=>{ try{ openNoti(); }catch(e){} });
  await page.waitForTimeout(300);
  const back = await page.evaluate(()=> (document.getElementById('mrPanel')||{}).innerText || '');
  t('몇 개 골랐는지 알림 화면에 보인다', /1개/.test(back));

  t('앱이 터지지 않았다 — ' + (errs[0]||''), errs.length === 0);

  console.log(`\n${pass}/${pass+fail} 통과`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{ console.log('★ 검사가 돌지 못했다:', e.message); srv.close(); process.exit(1); });
