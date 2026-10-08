// 5.46 — 스토어 그림을 찍다 찾은 것 (노을·검정·흰 × 한·영·러·일)
//   ① 단위 기호: 러시아어 화면은 уз·м·см·л 와 소수 쉼표 (사전의 '바람 {n}kt'→'Ветер {n} уз' 와 같게). 한국어는 예전 그대로
//   ② 날씨 날짜: 러시아어 일.월 (사전 'на {d}.{m} ({w})' 와 같게)
//   ③ 기상청 특보 이름·구역이 외국어 화면에 한국어로 안 나온다
//   ④ 러시아어 정기점검 줄 — 「Просрочено на 50 дн.」 이 화면 밖으로 안 넘친다 (칩·상태가 다음 줄로)
//   ⑤ 러시아어 날씨 표 왼쪽 칸 이름 폭 84px (WLBL_RU 와 같다)
//   ⑥ 정기점검 이름 없는 줄 「(이름 없음)」 이 사전을 지난다
//   ⑧ 관심 분야 고르기 칸 — 뉴스 탭과 같은 「내 말 소식 / 세계 소식」 (일본어로 켠 사람에게 「대한민국 소식」 분야를 고르게 하던 것)
//   ⑦ 뉴스 분야 이름(안전·레이스…)이 외국어 화면에 한국어로 안 나온다 (서버 알림 NEWS_CAT 과 같은 말)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'));
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(JSON.stringify(w)).slice(0, 300) : '')); } };
(async () => {
  const s = http.createServer((q, r) => { const u = q.url.split('?')[0]; fs.readFile(u === '/' ? FILE : path.join(path.dirname(FILE), u), (e, d) => { if(e){ r.writeHead(404); r.end(); return; } r.writeHead(200); r.end(d); }); });
  await new Promise(r => s.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // 숫자와 단위 사이는 줄이 안 갈리는 빈칸(\u00a0) — 「0,1 / м」 로 갈라졌었다
  const 단위 = Object.fromEntries(Object.entries({ ko:['0.1m','6kt','134cm','95 L','14.2 m'], en:['0.1 m','6 kt','134 cm','95 L','14.2 m'],
                ru:['0,1 м','6 уз','134 см','95 л','14,2 м'], ja:['0.1m','6kt','134cm','95 L','14.2 m'] }).map(([k, v]) => [k, v.map(x => x.replace(' ', '\u00a0'))]));
  const 날짜 = { ko:'10/4(일)', en:'10/4 (Sun)', ru:'4.10 (Вс)', ja:'10/4(日)' };
  const 특보 = { ko:['풍랑주의보','남해동부안쪽먼바다'], en:['Wind wave advisory','South Sea, eastern part, inner offshore waters'],
                ru:['Волнение — предупреждение','Южное море, восточная часть, ближние воды открытого моря'], ja:['波浪注意報','南海東部内側沖合'] };
  for(const [th, fsz] of [['sunset','normal'], ['black','big'], ['light','bigger']]) for(const L of ['ko','en','ru','ja']){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, timezoneId:'Asia/Seoul' });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    await ctx.addInitScript(({ th, L, fsz }) => { try{ if(sessionStorage.getItem('_p')) return; sessionStorage.setItem('_p', '1');
      localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done'); localStorage.setItem('bt_theme', th); localStorage.setItem('bt_fs', fsz);
      if(L !== 'ko') localStorage.setItem('bt_lang', L); }catch(_){} }, { th, L, fsz });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto('http://127.0.0.1:' + s.address().port + '/'); await pg.waitForTimeout(1400);
    const K = th + '/' + fsz + ' ' + L;
    // ① 단위
    const u = await pg.evaluate(() => [nU(0.1,'m'), nU(6,'kt'), nU(134,'cm'), nU(95,'L'), nU(14.2,'m',1)]);
    T('① ' + K + ' — 단위 ' + JSON.stringify(u), JSON.stringify(u) === JSON.stringify(단위[L]), u);
    // ② 날짜
    const d = await pg.evaluate(() => fmtMD(new Date('2026-10-04T10:00:00+09:00').getTime()));
    T('② ' + K + ' — 날씨 날짜 ' + d, d === 날짜[L], d);
    // ③ 특보
    const k = await pg.evaluate(() => [kmaKindName('풍랑주의보'), kmaZoneName('남해동부안쪽먼바다')]);
    T('③ ' + K + ' — 특보 이름·구역 ' + JSON.stringify(k), k[0] === 특보[L][0] && k[1] === 특보[L][1], k);
    // ④ 정기점검 줄이 화면 밖으로 안 넘친다 (실제 목록을 그려서)
    await pg.evaluate(() => { window.ask = () => Promise.resolve(true); try{ skipWelcome(); }catch(_){} unlocked = true; try{ openBoatSetup(); }catch(_){} });
    await pg.waitForTimeout(300);
    await pg.evaluate(() => { const n = document.getElementById('nbName'); if(n){ n.value = 'Shunshine'; createBoat(); } });
    await pg.waitForTimeout(600);
    const ov = await pg.evaluate(L => {
      const nm = { ko:'휘발유 발전기 시동', en:'Run the portable generator', ru:'Запуск бензогенератора', ja:'ガソリン発電機の試運転' }[L];
      maint.push({ id:'t1', grp:'기타', name:nm, months:1, unit:'w', lastDate:'2026-08-09', noti:false },
                 { id:'t2', grp:'기타', name:'', months:12, unit:'m', lastDate:'' });
      try{ switchTab('boat'); setBoatSubTab('gear'); setGearSub('maint'); }catch(_){}
      try{ renderMaintList(); }catch(e){ return { err:String(e) }; }
      const out = []; let rows = 0;
      document.querySelectorAll('.mr .ct').forEach(ct => { if(!ct.offsetParent) return; rows++;
        const mr = ct.closest('.mr').getBoundingClientRect();
        [...ct.children].forEach(c => { const r = c.getBoundingClientRect(); if(r.right > mr.right + 1 || r.right > innerWidth) out.push((c.textContent || '').trim().slice(0, 30) + ' ' + Math.round(r.right) + '>' + Math.round(Math.min(mr.right, innerWidth))); }); });
      const txt = [...document.querySelectorAll('.mr .cn')].filter(e => e.offsetParent).map(e => e.textContent.trim());
      return { rows, out, sw: document.documentElement.scrollWidth, iw: innerWidth, noname: txt.some(x => x.indexOf('(이름 없음)') >= 0) };
    }, L);
    T('④ ' + K + ' — 정기점검 줄 ' + (ov.rows || 0) + '개, 화면 밖으로 넘친 것 없음', !ov.err && ov.rows > 0 && ov.out.length === 0 && ov.sw <= ov.iw, ov);
    T('⑥ ' + K + ' — 이름 없는 정기점검은 그 말로 「(이름 없음)」', L === 'ko' ? true : !ov.noname, ov);
    // ⑤ 날씨 표 칸 이름 폭
    const wl = await pg.evaluate(() => { const g = document.createElement('div'); g.className = 'wlbl'; g.textContent = 'x'; document.body.appendChild(g);
      const w = g.getBoundingClientRect().width; g.remove(); return { w, f: wlblW() }; });
    T('⑤ ' + K + ' — 날씨 표 칸 이름 폭 ' + wl.w + ' = wlblW() ' + wl.f, Math.round(wl.w) === wl.f && wl.f === (L === 'ru' ? 84 : 62), wl);
    // ⑦ 뉴스 분야 이름 (관심 분야 단추·뉴스 칩·서버 알림 NEWS_CAT 과 같은 말)
    const nc = await pg.evaluate(() => ['안전','레이스','항해술','기타','새분야'].map(newsCatName));
    const 분야 = { ko:['안전','레이스','항해술','기타','새분야'], en:['Safety','Racing','Seamanship','Other','새분야'],
                  ru:['Безопасность','Регаты','Морская практика','Другое','새분야'], ja:['安全','レース','シーマンシップ','その他','새분야'] }[L];
    T('⑦ ' + K + ' — 뉴스 분야 이름 ' + JSON.stringify(nc), JSON.stringify(nc) === JSON.stringify(분야), nc);
    // ⑧ 관심 분야 고르기 — 뉴스 탭과 같은 기준(내 말 소식 / 세계 소식), 분야 이름은 그 말로
    const pk = await pg.evaluate(async () => {
      krCache = { gov:[{ cat:'항만', date:'2026-10-08' }] };
      newsCache = { items:[{ cat:'레이스', lang:'en', date:'2026-10-08' }, { cat:'사고', lang:'ru', date:'2026-10-08' }, { cat:'기상', lang:'ja', date:'2026-10-08' }] };
      await openNotiCats();
      const P = document.getElementById('mrPanel');
      const lbl = [...P.querySelectorAll('.notilbl')].map(e => e.textContent.trim());
      const wraps = [...P.querySelectorAll('.catwrap')].map(w => [...w.querySelectorAll('.catbtn')].map(b => b.textContent.trim()));
      return { lbl, wraps, home: newsHomeName(), world: t('세계 소식') };
    });
    const 첫칸 = { ko:['항만'], en:['Racing'], ru:['Происшествия'], ja:['気象'] }[L];
    T('⑧ ' + K + ' — 관심 분야 첫 칸 이름 = 뉴스 탭 「' + pk.home + '」, 그 칸 분야 ' + JSON.stringify(pk.wraps[0]),
      pk.lbl[0] === pk.home && pk.lbl[1] === pk.world && JSON.stringify(pk.wraps[0]) === JSON.stringify(첫칸), pk);
    // ⑩ 정박지 원자료 바로잡음 — 빠진 숫자(0.kn)·있을 수 없는 값(대조승 0m)·없는 지번(704번지)·닫힌 누리집(plala)
    const sn = await pg.evaluate(() => spotShowNote({ seed:true, note:[
      '조류 — 사두도 북측에서 창조류는 0.kn로 남쪽으로 흐르며 낙조류는 0.3kn로 북동쪽으로 흐른다. 복잡한 해안선의 영향으로 비교적 약한 편이다.',
      '조류 — 강릉항에 인접한 묵호항에서의 평균해수면은 0.19m, 대조승은 0m, 평균고조간격은 2시간 57분이다.',
      '전라남도 완도군 완도읍 북방파제 704번지 일원',
      '누리집 — http://www7.plala.or.jp/hasikuni/hashikuni.ht_' ].join('\n') }));
    T('⑩ ' + K + ' — 정박지 원자료 바로잡음(0.kn·대조승 0m·704번지·닫힌 누리집 없음, 3줄) ' + JSON.stringify(sn.slice(0, 80)),
      !/0\.kn|0\. уз|0\.ノット|0 ?m,|0 м,|大潮升0m|704|plala/.test(sn) && sn.split('\n').length === 3, sn);
    // ⑪ 스토어 평가 요청 — 설치 7일·실행 10번 넘고, 일을 끝낸 때(도착·정비 완료)에만, 120일에 한 번
    const rv = await pg.evaluate(async () => {
      const d = 864e5, now = Date.now(), out = {};
      const set = o => localStorage.setItem('bt_review', JSON.stringify(o));
      set({ first: now - 3 * d, launches: 20 }); out.새것 = reviewDue();
      set({ first: now - 30 * d, launches: 5 }); out.적게켬 = reviewDue();
      set({ first: now - 30 * d, launches: 20 }); out.됨 = reviewDue();
      set({ first: now - 30 * d, launches: 20, last: now - 30 * d }); out.최근물음 = reviewDue();
      set({ first: now - 300 * d, launches: 20, last: now - 130 * d }); out.오래전 = reviewDue();
      // 폰 앱인 척 — 부품을 부르는지
      let 불림 = 0; const oldCap = window.Capacitor;
      window.Capacitor = { isNativePlatform: () => true, Plugins: { InAppReview: { requestReview: async () => { 불림++; } } } };
      set({ first: now - 30 * d, launches: 20 }); reviewSoon(); reviewSoon();
      await new Promise(r => setTimeout(r, 2800)); out.불림 = 불림;
      window.Capacitor = oldCap; localStorage.removeItem('bt_review');
      out.웹 = (reviewSoon(), 'ok');
      return out;
    });
    T('⑪ ' + K + ' — 평가 요청 문턱 ' + JSON.stringify(rv), rv.새것 === false && rv.적게켬 === false && rv.됨 === true && rv.최근물음 === false && rv.오래전 === true && rv.불림 === 1, rv);
    T('⑨ ' + K + ' — 쪽 오류 없음', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close(); s.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사 자체 오류 — ' + e.message); process.exit(1); });
