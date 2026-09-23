// 같이 타기 · 예정 항해 — 진짜 브라우저에서 눌러 본다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };

(async ()=>{
  await new Promise(r=>server.listen(0, r));
  const SRC = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:780 }, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto(SRC, { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  try{ await pg.evaluate(()=>{ skipWelcome(); }); }catch(_){}
  await pg.waitForTimeout(200);

  // 배 하나 만든다
  await pg.evaluate(()=>{
    boats = [{ id:'b1', name:'테스트호', type:'sail', homeport:'여수', maker:'Beneteau',
               model:'First 45', year:'2007', spec:{} }];
    curBoatId = 'b1'; unlocked = true;
    if(typeof save === 'function') save();
  });

  // ── 예정 항해 만들기
  const made = await pg.evaluate(()=>{
    voyage = []; addPlan();
    const v = voyage[voyage.length-1];
    return { n:voyage.length, plan:!!v.plan, date:v.date, future: v.date > today() };
  });
  T('예정 항해가 만들어진다', made.n === 1 && made.plan);
  T('예정 날짜는 앞날이다', made.future, made.date);

  // 통계·공개에서 빠지는가
  const out = await pg.evaluate(()=>({ cnt: voyStats().cnt }));
  T('올해 항해 수에 안 들어간다', out.cnt === 0);

  // ── 모집 켜기 (글판 없이 앱 안 자료만)
  const ride = await pg.evaluate(()=>{
    const v = voyage[0];
    v.rideN = 2; v.rideTrip = 'fish'; v.rideWant = ['new','gear'];
    v.rideCost = 'share'; v.rideClose = 1;
    v.rideUntil = rideDeadline(v.date, 1); v.rideOn = true;
    return { until: v.rideUntil, date: v.date, title: rideTitle(v),
             lines: rideLines(v).join(' | '), info: rideInfo(v) };
  });
  T('마감이 출항 하루 전이다',
    (()=>{ const a=new Date(ride.date+'T00:00:00'), b=new Date(ride.until+'T00:00:00');
           return (a-b)/86400000 === 1; })(), ride.until);
  T('글 제목에 날짜·곳·자리가 들어간다',
    /자리/.test(ride.title) && /낚시/.test(ride.title), ride.title);
  T('모집 내용에 금액이 없다', !/원/.test(ride.lines), ride.lines);
  T('모집 자료에 배 종류가 붙는다', !!ride.info.boatType, JSON.stringify(ride.info.boatType));

  // ── 화면에 그려지는가
  const shown = await pg.evaluate(()=>{
    renderVoyage();
    const L = document.getElementById('voyageList');
    return { txt: L.innerText, hasSec: /앞으로 나갈 항해/.test(L.innerText) };
  });
  T('목록에 예정 묶음이 따로 보인다', shown.hasSec);
  T('목록에 자리 수가 보인다', /2자리/.test(shown.txt), shown.txt.slice(0,180));

  // ── 항해 자세히 — 예정에는 '나간 뒤' 칸이 없다
  const det = await pg.evaluate(()=>{
    openMR('voyage', voyage[0].id);
    const t = document.getElementById('mrPanel').innerText;
    return { t, plan:/출항했습니다/.test(t), noNm:!/항해 시간/.test(t), ride:/같이 타기/.test(t) };
  });
  T('예정 항해에 [출항했습니다] 가 있다', det.plan);
  T("예정 항해에 '나간 뒤' 칸이 없다", det.noNm, det.t.slice(0,200));
  T('같이 타기 칸이 보인다', det.ride);

  // ── 출항 처리
  const started = await pg.evaluate(async ()=>{
    // ★ 앱은 confirm 을 안 쓴다 — 자기 창(ask)을 띄우고 답을 기다린다(async).
    window.confirm = () => true;
    window.ask = () => Promise.resolve(true);
    window.tell = () => Promise.resolve();
    await planStart();
    for(let i=0;i<5;i++) await new Promise(r=>setTimeout(r,0));
    const v = voyage[0];
    return { plan:!!v.plan, date:v.date, time:v.timeOut, rideOn:!!v.rideOn };
  });
  T('출항하면 예정이 풀린다', !started.plan);
  T('출항하면 오늘 날짜가 된다', started.date === new Date().toISOString().slice(0,10)
      || /^\d{4}-\d{2}-\d{2}$/.test(started.date), started.date);
  T('출항하면 시각이 찍힌다', /^\d{2}:\d{2}$/.test(started.time||''), started.time);
  T('출항하면 모집이 닫힌다', !started.rideOn);
  const after = await pg.evaluate(()=>({ cnt: voyStats().cnt }));
  T('나간 뒤에는 항해 수에 들어간다', after.cnt === 1);

  // ── 여러 개 고르기 칸이 진짜 눌리는가
  const picks = await pg.evaluate(()=>{
    openForm({ title:'시험', fields:[{ key:'w', label:'모집 대상', type:'picks',
      value:['new'], options:RIDE_WANT }], onOk:()=>{} });
    const box = document.getElementById('fp0');
    const on0 = [...box.children].filter(b=>b.classList.contains('on')).length;
    box.children[2].click();          // 하나 더 켠다
    const on1 = [...box.children].filter(b=>b.classList.contains('on')).length;
    box.children[0].click();          // 원래 것을 끈다
    const on2 = [...box.children].filter(b=>b.classList.contains('on')).length;
    const v = formVals().w;
    closeForm();
    return { on0, on1, on2, v };
  });
  T('여러 개를 켜고 끌 수 있다', picks.on0 === 1 && picks.on1 === 2 && picks.on2 === 1,
    JSON.stringify(picks));
  T('고른 값이 그대로 나온다', Array.isArray(picks.v) && picks.v.length === 1, JSON.stringify(picks.v));

  // ── 배 둘러보기 항해일지
  const pub = await pg.evaluate(()=>{
    boatPageData = { id:'x', name:'남의배', typeName:'세일링 요트', port:'부산',
      voyage:[ { id:'v1', date:'2026-07-01', title:'', from:'', to:'', note:'속엣말' },
               { id:'v2', date:'2026-07-05', title:'제주 다녀옴', from:'여수', to:'제주', note:'좋았다' } ] };
    boatPageTab = 'voyage'; pubVoyId = '';
    paintBoatPage();
    const t = document.getElementById('mrPanel').innerText;
    return { t, noEmpty: !/제목 없음/.test(t), noNote: !/속엣말/.test(t) };
  });
  T("목록에 '(제목 없음)' 이 없다", pub.noEmpty, pub.t.slice(0,200));
  T('목록에 메모가 안 나온다', pub.noNote, pub.t.slice(0,200));
  T('제목 없는 항해는 날짜만 나온다', /2026-07-01/.test(pub.t));

  const opened = await pg.evaluate(()=>{
    pubVoyOpen('v1');
    const t = document.getElementById('mrPanel').innerText;
    return { t, note:/속엣말/.test(t), back:/항해일지/.test(t) };
  });
  T('눌러 들어가면 내용이 보인다', opened.note, opened.t.slice(0,160));
  T('돌아갈 길이 있다', opened.back);

  const backed = await pg.evaluate(()=>{
    pubVoyBack();
    const t = document.getElementById('mrPanel').innerText;
    return !/속엣말/.test(t);
  });
  T('목록으로 돌아온다', backed);


  // ── 편집 ↔ 보기 전용을 바꾸면 그 자리에서 바뀐다
  const lock = await pg.evaluate(()=>{
    unlocked = true; applyLock();
    openMR('voyage', voyage[0].id);
    const before = document.getElementById('mrPanel').querySelectorAll('input,textarea,select').length;
    toggleLock();                                   // 보기 전용으로
    const after = document.getElementById('mrPanel').querySelectorAll('input,textarea,select').length;
    toggleLock();                                   // 도로 편집으로
    const back = document.getElementById('mrPanel').querySelectorAll('input,textarea,select').length;
    return { before, after, back };
  });
  T('보기 전용으로 바꾸면 입력칸이 그 자리에서 사라진다',
    lock.before > 0 && lock.after === 0, JSON.stringify(lock));
  T('편집으로 되돌리면 입력칸이 돌아온다', lock.back === lock.before, JSON.stringify(lock));

  // ── 밖으로 내보내는 항해일지에 내용이 다 담기는가
  const pubData = await pg.evaluate(()=>{
    const b = boats[0];
    b.pub = { voyage:true };
    const v = voyage[0];
    v.nm = 12.5; v.hours = 3.2; v.engineH = 1.1; v.timeIn = '17:40'; v.to = '거문도';
    v.logs = [{ id:'g1', time:'14:00', kind:'기록', text:'돌고래 봄', eng:'off',
                pos:{ lat:34.1, lon:127.3 } }];
    v.wxOut = { text:'맑음 · 북동 8kt', at:'', spot:'여수' };
    v.note = '좋았다';
    const o = buildPublic(b);
    return o.voyage[0];
  });
  T('공개 자료에 거리·시간이 담긴다', pubData.nm === 12.5 && pubData.hours === 3.2);
  T('공개 자료에 중간 기록이 담긴다', (pubData.logs||[]).length === 1 && pubData.logs[0].text === '돌고래 봄');
  T('중간 기록에서 좌표가 빠진다', pubData.logs[0].pos === undefined, JSON.stringify(pubData.logs[0]));
  T('날씨는 글 한 줄만 나간다', pubData.wxOut === '맑음 · 북동 8kt', String(pubData.wxOut));
  T('동승자 이름은 안 나간다', pubData.crew === undefined);

  // ── 눌러 들어가면 다 보이는가
  const full = await pg.evaluate(()=>{
    const b = boats[0];
    boatPageData = Object.assign({ id:b.id, name:b.name, typeName:'세일링 요트' }, buildPublic(b));
    boatPageTab = 'voyage'; pubVoyId = '';
    paintBoatPage();
    pubVoyOpen(voyage[0].id);
    return document.getElementById('mrPanel').innerText;
  });
  T('자세히 보기에 거리가 있다', /12\.5/.test(full), full.slice(0,240));
  T('자세히 보기에 중간 기록이 있다', /돌고래 봄/.test(full));
  T('자세히 보기에 날씨가 있다', /북동 8kt/.test(full));
  T('자세히 보기에 메모가 있다', /좋았다/.test(full));

  // ── 정비 글에 배 정보
  const rec = await pg.evaluate(()=>{
    const b = boats[0];
    b.loa = 13.7; b.spec = { engine:'Yanmar 4JH4E' };
    maint = [{ id:'m1', name:'엔진 오일 교환', grp:'기관', months:6, unit:'m',
               lastDate:'2026-01-26', history:[], photos:[] }];
    return talkRecordText('maint', maint[0]);
  });
  T('정비 글에 제조사·모델·연식이 들어간다',
    /Beneteau/.test(rec) && /First 45/.test(rec) && /2007년/.test(rec), rec);
  T('길이가 피트와 미터로 함께 나온다', /ft \(13\.7m\)/.test(rec), rec);
  T('엔진이 들어간다', /Yanmar 4JH4E/.test(rec));
  T('배 이름은 안 들어간다', !/테스트호/.test(rec), rec);
  T('앱이 터지지 않았다', errs.length === 0, errs.join(' / ').slice(0,200));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
