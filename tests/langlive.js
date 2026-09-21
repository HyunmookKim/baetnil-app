// 외국어판 — 화면을 진짜로 영어·러시아어로 그려 보고, 한글이 남았나 센다.
//
// ★ 왜 이 검사가 있나
//   사전에 낱말을 넣는 것과 화면이 그 말로 나오는 것은 다른 일이다.
//   t() 로 감싸는 것을 한 군데 빠뜨리면 그 자리만 한국어로 남는데,
//   한국어로 쓰는 동안에는 아무도 못 알아챈다. 말을 바꿔서 눈으로 봐야 잡힌다.
//   그래서 화면마다 '남은 한글' 을 세고, 늘면 실패로 친다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
// ★ 넘겨받은 파일을 본다. 검사 폴더에 남은 옛 work.html 을 보면 안 된다.
//   실제로 4.44 에서 이 검사가 4.41 짜리 옛 파일을 보고 「다 지났다」고 했다.
const __ARG  = process.argv[2];
const __BASE = __ARG ? require('path').dirname(require('path').resolve(__ARG)) : __dirname;
const __MAIN = __ARG ? require('path').basename(__ARG) : 'work.html';
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = (rq.url === '/')
    ? (path.isAbsolute(__ARG || '') ? __ARG : path.join(__BASE, __MAIN))
    : path.join(__dirname, rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

// 화면마다 아직 옮기지 못한 한글 수. 옮길 때마다 이 값을 낮춘다.
// ★ 늘어나면 실패다 — 새로 만든 문구를 사전에 안 넣은 것이다.
// ★ 3.90 부터 전부 0 이다. 「출항 전」(점검 목록 이름) 「선주」(등급 이름) 처럼
//   앱이 처음 만들어 주는 자료도 만들 때 사전을 거치게 했다 — 외국어로 처음 켠
//   사람에게는 그 말로 만들어 준다. 그래서 한 자도 남으면 안 된다.
const LIMIT = { home: 0, boat: 0, voyage: 0, stow: 0 };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const base = 'http://127.0.0.1:' + server.address().port + '/';

  const look = async (lang) => {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:900}, isMobile:true, hasTouch:true });
    const pg = await ctx.newPage();
    const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
    await pg.goto(base, { waitUntil:'networkidle' });
    await pg.evaluate(l=>{ try{ localStorage.setItem('bt_lang', l); }catch(_){} }, lang);
    await pg.reload({ waitUntil:'networkidle' });
    await pg.waitForTimeout(800);
    await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} });

    // ① 배가 없는 사람 (처음 온 사람 카드가 나온다)
    // ★ 4.128 — 맨 위에 「어느 쪽이십니까」 고르는 줄이 생겼고, 처음에는 배 쪽이 펴져 있다.
    //   크루 쪽 칸(커뮤니티·정박지)은 눌러야 나온다. 그래서 두 쪽을 다 그려 보고 둘 다 센다.
    await pg.evaluate(()=>{ try{ localStorage.removeItem('bt_introside'); }catch(_){}
      boats = []; currentBoatId = null; switchTab('home'); renderHome(); });
    await pg.waitForTimeout(400);
    const first = await pg.evaluate(()=>document.getElementById('homeList').innerText);
    await pg.evaluate(()=>{ introPick('crew'); });
    await pg.waitForTimeout(400);
    const crew = await pg.evaluate(()=>document.getElementById('homeList').innerText);
    await pg.evaluate(()=>{ introPick('own'); });
    await pg.waitForTimeout(300);

    // ② 배가 있는 사람 (날씨·물때·점검·정비·할 일·항해)
    await pg.evaluate(()=>{
      boats = [{ id:'B1', name:'Test', type:'sail', port:'Yeosu', lat:34.74, lon:127.74 }];
      seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id };
      currentBoatId = 'B1'; window.currentBoatId = 'B1';
      wxCur = { lat:34.74, lon:127.74, name:'Yeosu' };
      wxData = { _t0: Date.now(), _n: 1,
        w:{ hourly:{ time:['2026-08-16T09:00'], wind_speed_10m:[9],
                     wind_gusts_10m:[14], wind_direction_10m:[220] } },
        m:{ hourly:{ wave_height:[0.6], wave_period:[4] } } };
      maint = [{ id:'m1', name:'Engine oil', months:6, unit:'m', lastDate:'2020-01-01' }];
      voyage = [{ id:'v1', date:'2026-08-01', from:'A', to:'B' }];
      renderHome();
    });
    await pg.waitForTimeout(500);
    const full = await pg.evaluate(()=>document.getElementById('homeList').innerText);
    await ctx.close();
    return { first, crew, full, errs };
  };

  const han = s => (String(s).match(/[가-힣]/g) || []).length;
  const hanWords = s => [...new Set((String(s).match(/[가-힣][가-힣\s·]*/g) || [])
    .map(x=>x.trim()).filter(Boolean))];

  for(const lang of ['en', 'ru']){
    const r = await look(lang);
    console.log('── ' + lang);
    T(lang + ' — 앱이 터지지 않았다', r.errs.length === 0, r.errs.slice(0,2));

    // 처음 온 사람 카드 — 고르는 줄과 「배가 있습니다」 쪽 (처음에 펴져 있는 쪽)
    const need1 = lang === 'en'
      ? ['Which are you?', 'I have a boat', 'I sail on other boats',
         'One boat, all its records in one place', 'The maintenance log sits at the centre.',
         'Register a boat']
      : ['Что вам ближе?', 'У меня есть судно', 'Хожу на чужом судне',
         'Всё о вашем судне — в одном месте', 'В центре — журнал работ.',
         'Зарегистрировать судно'];
    need1.forEach(x => T(lang + ' — 처음 화면에 「' + x + '」 가 있다',
      r.first.indexOf(x) >= 0, r.first.slice(0, 200)));
    // 「타기만 합니다」 를 누르면 크루 쪽 칸이 그 말로 나온다
    const need1c = lang === 'en'
      ? ['Even without a boat', 'Where do I moor?', 'Browse the community']
      : ['Даже без судна', 'Где встать?', 'Посмотреть сообщество'];
    need1c.forEach(x => T(lang + ' — 「타기만 합니다」 쪽에 「' + x + '」 가 있다',
      r.crew.indexOf(x) >= 0, r.crew.slice(0, 220)));

    // 배가 있을 때
    const need2 = lang === 'en'
      // ★ 점검 카드 제목은 「지금 고른 목록 이름」이다 (사람이 이름을 마음대로 짓는다).
      //   그래서 카드 제목 대신 그 아래 줄(「n개 목록 중」)로 이 카드가 나왔는지 본다.
      ? ['Wind', 'Gust', 'Wave', 'across 3 lists', 'Maintenance due soon', 'Last voyage']
      : ['Ветер', 'Порыв', 'Волна', 'по 3 спискам', 'Скоро обслуживание', 'Последний выход'];
    need2.forEach(x => T(lang + ' — 오늘 화면에 「' + x + '」 가 있다',
      r.full.indexOf(x) >= 0, r.full.slice(0, 300)));

    // 남은 한글 — 두 쪽 다 센다
    const 다 = r.first + r.crew + r.full;
    T(lang + ' — 오늘 화면에 남은 한글 ' + han(다) + '자 (한도 ' + LIMIT.home + ')',
      han(다) <= LIMIT.home, hanWords(다));
  }

  // ── 내 배 화면 (기본정보 · 제원 · 배소개)
  const boat = async (lang) => {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:900}, isMobile:true, hasTouch:true });
    const pg = await ctx.newPage();
    const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
    await pg.goto(base, { waitUntil:'networkidle' });
    await pg.evaluate(l=>{ try{ localStorage.setItem('bt_lang', l); }catch(_){} }, lang);
    await pg.reload({ waitUntil:'networkidle' });
    await pg.waitForTimeout(800);
    const out = {};
    for(const tab of ['info','spec','intro']){
      await pg.evaluate(tb=>{
        try{ skipWelcome(); }catch(_){}
        boats = [{ id:'B1', name:'Test', type:'sail', port:'Yeosu', lat:34.74, lon:127.74,
                   maker:'Beneteau', model:'First 45f5', year:2004, spec:{}, intro:[] }];
        seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id };
        currentBoatId = 'B1'; window.currentBoatId = 'B1';
        window.__user = { uid:'U1', name:'me' };
        unlocked = true;
        switchTab('boat'); openBoat(tb);
      }, tab);
      await pg.waitForTimeout(400);
      out[tab] = await pg.evaluate(()=>document.getElementById('mrPanel').innerText);
    }
    await ctx.close();
    return { out, errs };
  };
  for(const lang of ['en', 'ru']){
    const r = await boat(lang);
    console.log('── 내 배 ' + lang);
    T(lang + ' 내 배 — 앱이 터지지 않았다', r.errs.length === 0, r.errs.slice(0,2));
    const need = lang === 'en'
      ? ['Basics', 'Specs', 'About', 'Home port', 'Join code', 'Length overall', 'Air draft']
      : ['Основное', 'Характеристики', 'О судне', 'Порт приписки', 'Код вступления', 'Осадка'];
    const all = r.out.info + '\n' + r.out.spec + '\n' + r.out.intro;
    need.forEach(x => T(lang + ' 내 배 — 「' + x + '」 가 있다', all.indexOf(x) >= 0, all.slice(0,300)));
    T(lang + ' 내 배 — 남은 한글 ' + han(all) + '자 (한도 ' + LIMIT.boat + ')',
      han(all) <= LIMIT.boat, hanWords(all));
  }

  // ── 항해일지 (목록 · 같이 타기)
  const voy = async (lang) => {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:900}, isMobile:true, hasTouch:true });
    const pg = await ctx.newPage();
    const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
    await pg.goto(base, { waitUntil:'networkidle' });
    await pg.evaluate(l=>{ try{ localStorage.setItem('bt_lang', l); }catch(_){} }, lang);
    await pg.reload({ waitUntil:'networkidle' });
    await pg.waitForTimeout(800);
    await pg.evaluate(()=>{
      try{ skipWelcome(); }catch(_){}
      boats = [{ id:'B1', name:'Test', type:'sail', port:'Yeosu', lat:34.74, lon:127.74, spec:{} }];
      seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id };
      currentBoatId = 'B1'; window.currentBoatId = 'B1';
      window.__user = { uid:'U1', name:'me' }; unlocked = true;
      const day = new Date(Date.now() + 7*864e5).toISOString().slice(0,10);
      voyage = [
        { id:'v1', date:'2026-08-01', from:'A', to:'B', nm:12, engineH:2 },
        { id:'v2', date:day, plan:true, from:'A', to:'C', rideOn:true, rideN:2,
          rideTrip:'air', rideCost:'share', rideWant:['new'], rideUntil:day }
      ];
      switchTab('voyage'); renderVoyage();
    });
    await pg.waitForTimeout(500);
    const list = await pg.evaluate(()=>document.getElementById('voyageList').innerText);
    // 같이 타기 칸은 글로 만들어 본다 (화면을 열지 않고도 글자를 볼 수 있다)
    const ride = await pg.evaluate(()=>rideBox(voyage[1]) + '\n' + rideLines(voyage[1]).join('\n'));
    await ctx.close();
    return { list, ride, errs };
  };
  for(const lang of ['en', 'ru']){
    const r = await voy(lang);
    console.log('── 항해일지 ' + lang);
    T(lang + ' 항해 — 앱이 터지지 않았다', r.errs.length === 0, r.errs.slice(0,2));
    const need = lang === 'en'
      ? ['Distance NM', 'Engine h', 'Upcoming voyages', 'Past voyages', 'Sail together', 'Day sail']
      : ['Дистанция', 'Моточасы', 'Предстоящие выходы', 'Прошлые выходы', 'Пойти вместе', 'Прогулка'];
    const all = r.list + '\n' + r.ride.replace(/<[^>]*>/g, ' ');
    need.forEach(x => T(lang + ' 항해 — 「' + x + '」 가 있다', all.indexOf(x) >= 0, all.slice(0,300)));
    T(lang + ' 항해 — 남은 한글 ' + han(all) + '자 (한도 ' + LIMIT.voyage + ')',
      han(all) <= LIMIT.voyage, hanWords(all));
  }

  // ── 적재표 (도면 · 목록 · 머리줄 도구)
  const stow = async (lang) => {
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:900}, isMobile:true, hasTouch:true });
    const pg = await ctx.newPage();
    const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
    await pg.goto(base, { waitUntil:'networkidle' });
    await pg.evaluate(l=>{ try{ localStorage.setItem('bt_lang', l); }catch(_){} }, lang);
    await pg.reload({ waitUntil:'networkidle' });
    await pg.waitForTimeout(900);
    await pg.evaluate(()=>{
      try{ skipWelcome(); }catch(_){}
      boats = [{ id:'B1', name:'Test', type:'sail', port:'Yeosu', spec:{} }];
      seedRanks(boats[0]); boats[0].members = { U1: ownerRank(boats[0]).id };
      currentBoatId = 'B1'; window.currentBoatId = 'B1';
      window.__user = { uid:'U1', name:'me' }; unlocked = true;
      lockers = []; items = [];
      switchTab('boat'); setBoatSubTab('stow');
      view = 'list'; toggleView(true); renderList();
    });
    await pg.waitForTimeout(600);
    const empty = await pg.evaluate(()=>document.getElementById('listView').innerText);
    // 수납칸과 물품이 있을 때
    await pg.evaluate(()=>{
      lockers = [{ id:'L1', label:'Sink', zone:'Galley', x:10, y:10, w:20, h:20 }];
      items = [{ id:1, name:'Rope', qty:2, unit:'', note:'', lockerId:'L1', photos:[] },
               { id:2, name:'Flare', qty:1, unit:'', note:'', lockerId:'L9', photos:[] }];
      renderList();
    });
    await pg.waitForTimeout(400);
    const list = await pg.evaluate(()=>document.getElementById('listView').innerText);
    const tools = await pg.evaluate(()=>document.getElementById('stowTools').innerText);
    const hint  = await pg.evaluate(()=>document.getElementById('hint').innerText);
    const srch  = await pg.evaluate(()=>document.getElementById('searchInput').placeholder);
    const lock  = await pg.evaluate(()=>document.getElementById('lockBtn').innerText);
    // ★ 4.132 — 휴지통은 적재표 도구줄에서 없어지고 설정 「지운 기록」 줄로 갔다.
    //   그 줄도 그 말로 나오는지 여기서 같이 본다.
    const trash = await pg.evaluate(()=>{
      try{ openSettings(); }catch(_){}
      const r2 = document.getElementById('setTrashRow');
      const s2 = r2 ? r2.innerText : '';
      try{ closePanel(); }catch(_){}
      return s2;
    });
    await ctx.close();
    return { all: [empty, list, tools, hint, srch, lock, trash].join('\n'), errs };
  };
  for(const lang of ['en', 'ru']){
    const r = await stow(lang);
    console.log('── 적재표 ' + lang);
    T(lang + ' 적재표 — 앱이 터지지 않았다', r.errs.length === 0, r.errs.slice(0,2));
    const need = lang === 'en'
      ? ['No lockers yet', 'Unplaced', 'Draw lockers', 'Select', 'Trash', 'Search items', 'Editing']
      : ['Рундуков пока нет', 'Не размещено', 'Рисовать рундуки', 'Выбрать', 'Корзина',
         'Поиск вещей', 'Правка'];
    need.forEach(x => T(lang + ' 적재표 — 「' + x + '」 가 있다', r.all.indexOf(x) >= 0, r.all.slice(0,300)));
    T(lang + ' 적재표 — 남은 한글 ' + han(r.all) + '자 (한도 ' + LIMIT.stow + ')',
      han(r.all) <= LIMIT.stow, hanWords(r.all));
  }

  // 한국어판은 그대로여야 한다 — 사전을 거쳐도 원문이 나온다
  // ★ 4.94 부터 앱은 아무것도 안 골랐을 때 폰 말을 따른다.
  //   검사 브라우저는 기본이 영어라, 여기서 한국어 폰을 흉내 내지 않으면
  //   「한국어판」 을 보는 것이 아니라 영어판을 보게 된다.
  {
    const ctx = await br.newContext({ viewport:{width:390,height:900}, isMobile:true, hasTouch:true,
                                      locale:'ko-KR' });
    const pg = await ctx.newPage();
    await pg.goto(base, { waitUntil:'networkidle' });
    await pg.waitForTimeout(700);
    await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){}
      try{ localStorage.removeItem('bt_introside'); }catch(_){}
      boats=[]; currentBoatId=null; switchTab('home'); renderHome(); });
    await pg.waitForTimeout(400);
    const ko = await pg.evaluate(()=>document.getElementById('homeList').innerText);
    T('한국어판은 그대로다 — 고르는 줄',
      ko.indexOf('어느 쪽이십니까') >= 0 && ko.indexOf('배가 있습니다') >= 0
      && ko.indexOf('타기만 합니다') >= 0, ko.slice(0,160));
    T('한국어판은 그대로다 — 배 쪽이 먼저 펴져 있다',
      ko.indexOf('배 한 척의 기록을 한 곳에') >= 0 && ko.indexOf('배 등록하기') >= 0, ko.slice(0,220));
    await pg.evaluate(()=>{ introPick('crew'); });
    await pg.waitForTimeout(400);
    const koc = await pg.evaluate(()=>document.getElementById('homeList').innerText);
    T('한국어판은 그대로다 — 크루 쪽',
      koc.indexOf('배가 없어도') >= 0 && koc.indexOf('커뮤니티 둘러보기') >= 0, koc.slice(0,220));
    await ctx.close();
  }

  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
