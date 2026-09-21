// 남의 말로 쓴 글 옮겨 보기 — 진짜 브라우저에서
//
// ★ 왜 이 검사가 있나
//   번역은 부를 때마다 돈이 나간다. 그래서 '언제 부르지 않는가' 가 '잘 옮기는가'
//   만큼 중요하다. 한국어 글에 단추가 붙거나, 같은 글을 두 번 부르거나,
//   로그인도 안 한 사람이 부를 수 있으면 그대로 요금이 된다.
//   또 옮긴 글이 원문을 덮어써 버리면 수심·요금·연락처가 기계 말로 바뀐다 —
//   그것을 믿고 배를 대면 사고가 난다. 그래서 원문으로 돌아오는 길도 함께 본다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,160):''));} };

const RU_TITLE = 'Хорошая стоянка в Пусане';
const RU_BODY  = 'Глубина четыре метра.\n\nДно песчаное, держит хорошо.';

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:800}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  const alerts=[]; pg.on('dialog', d=>{ alerts.push(d.message()); d.dismiss().catch(()=>{}); });
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  // ── 가짜 번역 서버. 몇 번 불렀는지 세어 둔다.
  await pg.evaluate(({ru_t, ru_b})=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', name:'나' };
    window.__cmt = null;
    window.trCalls = [];
    window.__tr = {
      async get(coll, id, lang){
        window.trCalls.push(coll + '/' + id + '/' + lang);
        if(window.trFail) throw new Error('부러 낸 탈');
        if(window.trThin) return { lang, n:1 };   // 서버가 한 칸도 못 옮긴 꼴
        const got = { title:'[옮김] ' + coll, name:'[옮김] ' + coll,
                 body:'첫째 줄입니다.\n\n둘째 줄입니다.', note:'[옮김] 한마디',
                 intro:'첫째 줄입니다.\n\n둘째 줄입니다.',
                 lang, n:10 };
        // 서버는 댓글도 함께 옮겨 준다 (c1 만 옮기고 c2 는 한도에 걸린 셈)
        if(!window.trNoCmt) got.c = { c1:'[옮김] 댓글 하나' };
        return got;
      }
    };
    // 러시아어로 쓴 글 하나 (사진이 글 사이에 끼어 있다)
    talkList = [{
      id:'T1', kind:'free', region:'그 밖', title:ru_t,
      blocks:[ { t:'text', v:'Глубина четыре метра.' },
               { t:'photo', v:'data:image/gif;base64,R0lGODlhAQABAAAAACw=' },
               { t:'text', v:'Дно песчаное, держит хорошо.' } ],
      body:ru_b, by:'U9', byName:'Иван', ts:'2026-08-01T00:00:00.000Z', likeN:0
    },{
      id:'T2', kind:'free', region:'그 밖', title:'부산 정박 후기',
      blocks:[ { t:'text', v:'수심이 넉넉했습니다.' } ],
      body:'수심이 넉넉했습니다.', by:'U8', byName:'김', ts:'2026-08-02T00:00:00.000Z', likeN:0
    }];
    talkCmts.T1 = [
      { id:'c1', by:'U7', byName:'Пётр', text:'Спасибо за отчёт.', ts:'2026-08-02T00:00:00.000Z' },
      { id:'c2', by:'U6', byName:'Олег', text:'Был там в мае.',   ts:'2026-08-03T00:00:00.000Z' }
    ];
    talkCmts.T2 = [];
  }, { ru_t:RU_TITLE, ru_b:RU_BODY });

  const grab = () => pg.evaluate(()=>{
    const P = document.getElementById('mrPanel');
    return { html: P ? P.innerHTML : '', text: P ? P.innerText : '',
             calls: (window.trCalls||[]).slice() };
  });

  // ── 1. 한국어 글에는 단추가 안 붙는다 (한국 사람이 보면 고장으로 보인다)
  await pg.evaluate(()=>openTalk('T2')); await pg.waitForTimeout(250);
  let v = await grab();
  T('한국어 글 — 번역 단추가 없다', v.html.indexOf('trGo(') < 0, v.text.slice(0,90));

  // ── 2. 남의 말로 쓴 글은 **누르지 않아도** 제 말로 나온다
  //   ★ 4.70 에서 바꾼 것이다. 사장님 말씀 — 「모든 내용이 다 자기 언어로 보이게 하라니까
  //     니멋대로 어떤건 아니고 어떤건 되고 기준을 만들었냐」.
  //     그래서 사람이 누를 것은 「원어로 보기」 하나뿐이다.
  //   이 검사는 그 전 설계(「번역해서 보기」를 눌러야 옮겨진다)를 못 박고 있었다.
  //   옛 설계를 못 박은 검사는 옳게 고친 것을 틀렸다고 한다.
  await pg.evaluate(()=>openTalk('T1'));
  await pg.waitForTimeout(700);
  v = await grab();
  T('한 번만 불렀다', v.calls.length === 1, v.calls);
  T('부른 곳이 맞다', v.calls[0] === 'community/T1/ko', v.calls);
  T('제목이 옮겨졌다', v.html.indexOf('[옮김] community') >= 0, v.text.slice(0,90));
  T('본문이 옮겨졌다', v.text.indexOf('첫째 줄입니다.') >= 0 && v.text.indexOf('둘째 줄입니다.') >= 0,
    v.text.slice(0,160));
  T('기계가 옮겼다고 알려 준다', v.text.indexOf('자동 번역') >= 0, v.text.slice(0,120));
  T('원어로 돌아가는 길이 있다', v.html.indexOf("trOff('community','T1')") >= 0);

  // 사진이 글 사이 제자리에 남아 있어야 한다 (뒤로 몰리면 글이 안 맞는다)
  const ord = await pg.evaluate(()=>{
    const b = document.querySelectorAll('#mrPanel .postbody, #mrPanel img.postimg');
    return Array.prototype.map.call(b, e => e.tagName === 'IMG' ? 'IMG' : e.innerText.slice(0,6));
  });
  T('사진이 두 글 사이 제자리에 있다',
    ord.length === 3 && ord[1] === 'IMG', ord);

  T('댓글도 함께 옮겨진다', v.text.indexOf('[옮김] 댓글 하나') >= 0, v.text.slice(0,300));
  // ★ 서버가 못 옮긴 댓글은 원문으로 남아야 한다 — 빈 칸이 되면 안 된다
  T('못 옮긴 댓글은 원문으로 남는다', v.text.indexOf('Был там в мае.') >= 0, v.text.slice(0,300));
  T('댓글 쓴 사람 이름은 안 건드린다', v.text.indexOf('Пётр') >= 0, v.text.slice(0,300));

  // ── 4. 원어로 보기
  await pg.click("#mrPanel button[onclick*=\"trOff('community','T1')\"]");
  await pg.waitForTimeout(300);
  v = await grab();
  T('원문이 그대로 돌아온다', v.html.indexOf(RU_TITLE) >= 0 && v.html.indexOf('[옮김]') < 0, v.text.slice(0,90));
  T('돌아오면서 서버를 또 안 부른다', v.calls.length === 1, v.calls);
  T('댓글도 원문으로 돌아온다',
    v.text.indexOf('Спасибо за отчёт.') >= 0 && v.text.indexOf('[옮김] 댓글') < 0, v.text.slice(0,300));

  // ── 5. 두 번째로 눌러도 서버를 안 부른다 (한 번 받아 둔 것을 쓴다)
  //   ★ 「원어로 보기」 를 누른 뒤에는 그 글만 원문으로 남고 「번역해서 보기」 가 나온다.
  //     그 자리에서는 눌러야 옮겨진다 — 사람이 원문을 보겠다고 정한 글이기 때문이다.
  await pg.click("#mrPanel button[onclick*=\"trGo('community','T1')\"]");
  await pg.waitForTimeout(350);
  v = await grab();
  T('두 번째 번역은 서버를 안 부른다', v.calls.length === 1, v.calls);
  T('그래도 옮긴 것이 보인다', v.html.indexOf('[옮김] community') >= 0, v.text.slice(0,90));
  await pg.click("#mrPanel button[onclick*=\"trOff('community','T1')\"]");
  await pg.waitForTimeout(250);

  // ── 6. 로그인 안 한 사람 — 함수가 안 받는다. 단추부터 안 보여야 한다.
  await pg.evaluate(()=>{ window.__user = null; openTalk('T1'); });
  await pg.waitForTimeout(300);
  v = await grab();
  T('로그인 안 하면 단추가 없다', v.html.indexOf('trGo(') < 0, v.text.slice(0,90));
  await pg.evaluate(()=>{ window.__user = { uid:'U1', name:'나' }; });

  // ── 7. 인터넷이 없으면 부르지 않는다 (배 위에서 늘 이렇다)
  await pg.evaluate(()=>{
    window.__onlineBak = Object.getOwnPropertyDescriptor(Navigator.prototype,'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable:true, get:()=>false });
    openTalk('T1');
  });
  await pg.waitForTimeout(300);
  v = await grab();
  T('인터넷이 없으면 단추가 없다', v.html.indexOf('trGo(') < 0, v.text.slice(0,90));
  await pg.evaluate(()=>{ Object.defineProperty(navigator,'onLine',{configurable:true,get:()=>true}); });

  // ── 8. 서버가 못 옮겼을 때 — 원문이 그대로 남아야 한다
  await pg.evaluate(()=>{
    window.trFail = true;
    TR_GOT['community:T1:ko'] = undefined; delete TR_GOT['community:T1:ko'];
    TR_ON['community:T1'] = false;
    openTalk('T1');
  });
  await pg.waitForTimeout(250);
  // ★ 앱은 브라우저 기본창을 안 쓴다 — 자기 창(tell/ask)으로 말한다. 그것도 받아 적는다.
  await pg.evaluate(()=>{ window.__said = [];
    const t0 = window.tell, a0 = window.ask;
    window.tell = m => { window.__said.push(String(m)); return Promise.resolve(); };
    window.ask  = m => { window.__said.push(String(m)); return Promise.resolve(true); }; });
  // ★ 저절로 옮기다 못 옮기면 **조용히 넘어간다** — 화면을 막지 않는다.
  //   말해 주는 것은 사람이 「번역해서 보기」 를 눌렀을 때다. 누른 사람은 답을 기다리기 때문이다.
  await pg.evaluate(()=>trGo('community','T1'));
  await pg.waitForTimeout(600);
  v = await grab();
  alerts.push(...(await pg.evaluate(()=>{ const a = window.__said || []; window.__said = []; return a; })));
  // ★ 5.0 에서 말이 바뀌었다 — 「옮기지 못했습니다」 → 「번역하지 못했습니다」.
  //   옛말을 붙들고 있으면 옳게 고친 것을 틀렸다고 한다.
  T('눌러서 못 옮기면 알려 준다', alerts.some(a=>/번역하지 못했습니다/.test(a)), alerts.slice(-2));
  T('★ 왜 못 옮겼는지까지 알려 준다', alerts.some(a=>/번역하지 못했습니다/.test(a) && /부러 낸 탈/.test(a)), alerts.slice(-2));
  T('★ 옛말(「옮기지 못했습니다」)로는 안 말한다', !alerts.some(a=>/옮기지 못했습니다/.test(a)), alerts.slice(-2));
  T('못 옮겨도 원문은 그대로', v.html.indexOf(RU_TITLE) >= 0 && v.html.indexOf('[옮김]') < 0, v.text.slice(0,90));
  T('못 옮기면 「자동 번역」 이라고 안 한다', v.text.indexOf('자동 번역') < 0, v.text.slice(0,120));
  await pg.evaluate(()=>{ window.trFail = false; });

  // ── 9. 정박지 — 관 자료(seed)에는 옮길 글이 없다
  await pg.evaluate(({t2,b2})=>{
    spotList = [
      { id:'S1', name:t2, kind:'port', lat:35.1, lon:129.0, region:'경남', note:b2,
        by:'U9', byName:'Иван', ts:'2026-08-01T00:00:00.000Z', fac:{}, open:[] },
      { id:'S2', name:'국가어항', kind:'port', lat:35.2, lon:129.1, region:'경남',
        seed:true, fac:{}, open:[] }
    ];
    spotCmts.S1 = []; spotCmts.S2 = [];
    openSpot('S2');
  }, { t2:RU_TITLE, b2:RU_BODY });
  await pg.waitForTimeout(350);
  v = await grab();
  T('관 자료에는 번역 단추가 없다', v.html.indexOf('trGo(') < 0, v.text.slice(0,90));

  // ── 10. 정박지 — 사람이 올린 러시아어 자리
  await pg.evaluate(()=>openSpot('S1')); await pg.waitForTimeout(350);
  v = await grab();
  T('정박지에 저절로 옮겨진다', v.html.indexOf("trOff('spots','S1')") >= 0, v.text.slice(0,90));
  // ★ 누를 것이 없다 — 열면 저절로 옮겨진다 (4.70)
  await pg.waitForTimeout(450);
  v = await grab();
  // ★ 4.100 에서 설계가 바뀌었다 (사장님이 정하신 것 9 — 검사도 같이 고친다)
  //   옛 설계: 정박지 **이름**도 기계 번역에 태웠다 → 「宮島ビジターバース」 가 「미야지마 방문자 버스」 가 됐다.
  //   지금 설계: 이름은 번역기에 안 태우고 **그 나라 글자로 소리**를 적는다 (nameFor).
  //   그래서 러시아어 이름은 원문 그대로 나오는 것이 맞다 — 한글이 아니라 손댈 것이 없다.
  T('★★★ 정박지 이름은 기계 번역에 안 태운다', v.html.indexOf('[옮김] ' + RU_TITLE) < 0, v.text.slice(0,90));
  T('★★ 이름은 원문 그대로 보인다', v.text.indexOf(RU_TITLE) >= 0, v.text.slice(0,120));
  T('정박지 한마디가 옮겨졌다', v.text.indexOf('[옮김] 한마디') >= 0, v.text.slice(0,200));
  const spotCalls = (await grab()).calls;
  T('정박지도 한 번만 불렀다', spotCalls.filter(x=>x.indexOf('spots/')===0).length === 1, spotCalls);

  // ── 11. 장터
  await pg.evaluate(({t2,b2})=>{
    marketList = [{ id:'M1', title:t2, cat:'etc', state:'sale', price:100,
      region:'경남', note:b2, by:'U9', byName:'Иван', ts:'2026-08-01T00:00:00.000Z',
      photos:[], likeN:0 }];
    openItem('M1');
  }, { t2:RU_TITLE, b2:RU_BODY });
  await pg.waitForTimeout(350);
  v = await grab();
  T('장터에 저절로 옮겨진다', v.html.indexOf("trOff('market','M1')") >= 0, v.text.slice(0,120));
  if(v.html.indexOf("trOff('market','M1')") >= 0){
  // ★ 누를 것이 없다 — 열면 저절로 옮겨진다 (4.70)
    await pg.waitForTimeout(450);
    v = await grab();
    T('장터 제목이 옮겨졌다', v.html.indexOf('[옮김] market') >= 0, v.text.slice(0,90));
    T('장터 설명이 옮겨졌다', v.text.indexOf('[옮김] 한마디') >= 0, v.text.slice(0,240));
  } else { bad += 2; }

  // ── 12. 연재
  await pg.evaluate(({t2,b2})=>{
    seriesList = [{ id:'R1', no:1, mine:true, title:t2, author:'Иван',
      body:b2, blocks:[{ t:'text', v:'Глубина четыре метра.' },
                       { t:'text', v:'Дно песчаное, держит хорошо.' }],
      by:'U9', byName:'Иван', date:'2026-08-01T00:00:00.000Z', ts:'2026-08-01T00:00:00.000Z' }];
    openSeries('R1');
  }, { t2:RU_TITLE, b2:RU_BODY });
  await pg.waitForTimeout(400);
  v = await grab();
  T('연재에 저절로 옮겨진다', v.html.indexOf("trOff('series','R1')") >= 0, v.text.slice(0,120));
  if(v.html.indexOf("trOff('series','R1')") >= 0){
  // ★ 누를 것이 없다 — 열면 저절로 옮겨진다 (4.70)
    await pg.waitForTimeout(500);
    v = await grab();
    T('연재 제목이 옮겨졌다', v.html.indexOf('[옮김] series') >= 0, v.text.slice(0,90));
    T('연재 본문이 옮겨졌다', v.text.indexOf('둘째 줄입니다.') >= 0, v.text.slice(0,240));
  } else { bad += 2; }

  // ── 12.5 배 소개 (공개 사본) — 덩이 배열이라 함수 쪽 뽑는 모양이 앱과 같아야 한다
  await pg.evaluate(({b2})=>{
    boatPageData = { id:'B9', name:'Мечта', typeName:'세일링 요트', port:'Владивосток',
      intro:[ { t:'text', v:'Глубина четыре метра.' },
              { t:'video', v:'https://youtu.be/xxxx' },
              { t:'text', v:'Дно песчаное, держит хорошо.' } ],
      voyage:[], spec:{} };
    boatPageTab = 'intro';
    paintBoatPage();
  }, { b2:RU_BODY });
  await pg.waitForTimeout(350);
  v = await grab();
  T('배 소개에 저절로 옮겨진다', v.html.indexOf("trOff('boatPublic','B9')") >= 0, v.text.slice(0,140));
  if(v.html.indexOf("trOff('boatPublic','B9')") >= 0){
  // ★ 누를 것이 없다 — 열면 저절로 옮겨진다 (4.70)
    await pg.waitForTimeout(450);
    v = await grab();
    T('배 소개가 옮겨졌다', v.text.indexOf('첫째 줄입니다.') >= 0, v.text.slice(0,200));
    T('배 이름은 안 건드린다', v.html.indexOf('Мечта') >= 0, v.text.slice(0,120));
    const yt = await pg.evaluate(()=>document.querySelectorAll('#mrPanel a[href*="youtu"]').length);
    T('유튜브 링크가 그대로 남는다', yt === 1, yt);
  } else { bad += 3; }

  // ── 12.7 한국어 글에 러시아어 댓글만 달린 경우 — 단추가 나와야 한다
  await pg.evaluate(()=>{
    talkCmts.T2 = [{ id:'c9', by:'U5', byName:'Иван', text:'Отличное место.', ts:'2026-08-04T00:00:00.000Z' }];
    openTalk('T2');
  });
  await pg.waitForTimeout(900);   // 저절로 옮기는 데 한 번 오가는 시간이 든다
  v = await grab();
  T('한국어 글이라도 남의 말 댓글이 있으면 저절로 옮겨진다',
    v.html.indexOf("trOff('community','T2')") >= 0, v.text.slice(0,160));

  // 한국어 댓글이 여럿인 사이에 러시아어 하나 — 그것으로는 안 뜬다 (성가시기만 하다)
  await pg.evaluate(()=>{
    talkCmts.T2 = [
      { id:'k1', by:'U1', byName:'김', text:'저도 지난주에 다녀왔습니다. 바닥이 모래라 잘 물립니다.', ts:'2026-08-04' },
      { id:'k2', by:'U2', byName:'박', text:'요금은 얼마였나요? 저는 다음 달에 갑니다.', ts:'2026-08-05' },
      { id:'k3', by:'U3', byName:'최', text:'부잔교가 새로 생겼다고 들었습니다.', ts:'2026-08-06' },
      { id:'r1', by:'U5', byName:'Иван', text:'Да.', ts:'2026-08-07' }
    ];
    openTalk('T2');
  });
  await pg.waitForTimeout(300);
  v = await grab();
  T('한국어 댓글 사이 남의 말 하나로는 단추가 안 뜬다',
    v.html.indexOf('trGo(') < 0, v.text.slice(0,200));

  // ── 12.8 댓글이 새로 달리면 옮겨 둔 것을 버린다
  //   ★ 안 버리면 새 댓글만 영영 원문으로 남는다.
  await pg.evaluate(()=>{
    TR_GOT['community:T1:ko'] = { title:'지켜야 할 것' };
    TR_GOT['community:T2:ko'] = { title:'x', c:{} };
    trDrop('community', 'T2');
  });
  const dropped = await pg.evaluate(()=>Object.keys(TR_GOT).filter(k=>k.indexOf('community:T2:')===0).length);
  T('댓글이 바뀌면 옮겨 둔 것을 버린다', dropped === 0, dropped);
  T('버려도 다른 글 것은 안 건드린다',
    (await pg.evaluate(()=>Object.keys(TR_GOT).some(k=>k.indexOf('community:T1:')===0))) === true);

  // ── 13. 말 가리기 — 잣대 자체를 따로 본다
  const lg = await pg.evaluate(()=>({
    koko: trSameLang('부산 정박 후기입니다', 'ko'),
    ruko: trSameLang('Хорошая стоянка', 'ko'),
    enko: trSameLang('Nice mooring in Busan', 'ko'),
    koen: trSameLang('부산 정박 후기입니다', 'en'),
    ruru: trSameLang('Хорошая стоянка', 'ru'),
    num:  trSameLang('2026-08-15  35.10 / 129.00', 'ko'),
    mix:  trSameLang('부산 Busan 정박지 후기입니다', 'ko')
  }));
  T('한국어 글 · 한국어 화면 → 안 옮긴다', lg.koko === true, lg);
  T('러시아어 글 · 한국어 화면 → 옮긴다', lg.ruko === false, lg);
  T('영어 글 · 한국어 화면 → 옮긴다', lg.enko === false, lg);
  T('한국어 글 · 영어 화면 → 옮긴다', lg.koen === false, lg);
  T('러시아어 글 · 러시아어 화면 → 안 옮긴다', lg.ruru === true, lg);
  T('숫자뿐인 글은 옮길 것이 없다', lg.num === true, lg);
  T('한글이 섞인 한국어 글은 안 옮긴다', lg.mix === true, lg);

  // ── 14. 블록에 도로 끼우기 — 사진 자리
  const bl = await pg.evaluate(()=>{
    const b = [{t:'text',v:'가'},{t:'photo',v:'p1'},{t:'head',v:'나'},{t:'text',v:'다'}];
    const r = trBlocks(b, 'A\n\nB\n\nC');
    const r2 = trBlocks(b, 'A\n\nB');                 // 조각이 모자랄 때
    const r3 = trBlocks(b, 'A\n\nB\n\nC\n\nD\n\nE');  // 남을 때
    const r4 = trBlocks(b, '');                        // 아무것도 못 옮겼을 때
    return { r, kinds:r.map(x=>x.t), photo:r.filter(x=>x.t==='photo').length,
             r2:{ n:r2.length, first:r2[0] && r2[0].v, last:r2[r2.length-1] && r2[r2.length-1].t },
             r3:{ n:r3.length, first:r3[0] && r3[0].v },
             r4:{ n:r4.length, same:r4[0] === b[0] } };
  });
  T('사진은 자리도 내용도 그대로', bl.kinds.join(',') === 'text,photo,head,text' && bl.photo === 1, bl.kinds);
  T('소제목은 소제목으로 남는다', bl.r[2].t === 'head' && bl.r[2].v === 'B', bl.r);
  // ★ 조각 수가 안 맞으면 한 칸씩 밀려 붙는 것보다 통째로 한 덩이가 낫다.
  //   밀려 붙으면 화면은 멀쩡한데 내용만 뒤섞여서 아무도 못 알아챈다.
  T('조각이 모자라면 억지로 안 끼운다',
    bl.r2.n === 2 && bl.r2.first === 'A\n\nB' && bl.r2.last === 'photo', bl.r2);
  T('조각이 남아도 억지로 안 끼운다', bl.r3.n === 2 && bl.r3.first.indexOf('E') >= 0, bl.r3);
  T('아무것도 못 옮기면 원문 덩이 그대로', bl.r4.n === 4 && bl.r4.same === true, bl.r4);

  const it = await pg.evaluate(()=>introText([
    { t:'text', v:'가나' }, { t:'photo', v:'p' }, { t:'video', v:'y' },
    { t:'head', h:1, v:'<b>다</b>' }, { t:'list', items:['라','마'] }
  ]));
  // ── 15. 서버가 본문을 못 옮겼을 때 — 빈 화면이 되면 안 된다
  await pg.evaluate(()=>{
    window.trThin = true;
    Object.keys(TR_GOT).forEach(k=>delete TR_GOT[k]);
    Object.keys(TR_ON).forEach(k=>delete TR_ON[k]);
    openTalk('T1');
  });
  await pg.waitForTimeout(250);
  // ★ 누를 것이 없다 — 열면 저절로 옮겨진다 (4.70)
  await pg.waitForTimeout(450);
  v = await grab();
  T('본문을 못 옮겨도 원문이 남는다', v.text.indexOf('Глубина четыре метра.') >= 0, v.text.slice(0,160));
  T('제목도 원문이 남는다', v.html.indexOf(RU_TITLE) >= 0, v.text.slice(0,90));
  await pg.evaluate(()=>{ window.trThin = false; });

  T('소개에서 사진·영상은 글자로 안 센다', it.indexOf('p') < 0 && it.indexOf('y') < 0, it);
  T('소개 글자를 꼬리표 없이 뽑는다', it.indexOf('<b>') < 0 && it.indexOf('다') >= 0, it);

  T('페이지 오류 없음', errs.length === 0, errs.slice(0,3));

  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
