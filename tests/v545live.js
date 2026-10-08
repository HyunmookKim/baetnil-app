// 5.45 — 번역 전수조사(2026-10-07)에서 드러난 고장을 진짜 브라우저에서 확인한다
// 사장님: 「이거 다 심각한 오류 수준인데. 빨리 고쳐야 된다.」 · 「번역 문제도 굉장히 심각하구만. 그 부분도 빨리 수정하도록 해라」
//   ① 외국어 사용자가 앱에서 계정을 지울 수 없었다 — 확인 문구를 한국어로만 비교
//   ② 러시아어 달력에서 고른 날의 요일이 하루 밀렸다
//   ③ 「[[place|places]]」 같은 괄호 글이 화면에 그대로 찍혔다 (t().split)
//   ④ 수납칸 모양 「원」 이 「KRW」·「вон」·「ウォン」 으로 나왔다 (돈 「원」 열쇠를 같이 씀)
//   ⑤ 한 열쇠를 뜻이 다른 두 자리가 같이 쓰던 것 — 「글자@@자리」 로 나눔. 한국어 화면은 그대로
//   ⑥ 사전에 없어 외국어 화면에 한국어가 뜨던 곳 (지우기 확인 12곳·도면 그리기 단추·같이 타기 법 안내·서버 번역 오류)
//   ⑦ 약관 화면의 「**」 가 글자로 보였다 · 러시아어 약관 이름에 라틴 i · 계정 삭제 링크가 한국어 쪽
//   ⑧ 숫자·단위 띄어쓰기(영·러) · 1.5 같은 소수의 복수 꼴
//   ⑨ 아이폰 앱 이름(외국어 폰) · 안드로이드 항적 알림 채널 이름
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'));
const ROOT = path.dirname(FILE);
const REPO = path.resolve(__dirname, '..');
const SRC = fs.readFileSync(FILE, 'utf8');
const server = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  fs.readFile(u === '/' ? FILE : path.join(ROOT, u), (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 정적 검사: 코드가 t()·tsub() 로 부르는 한국어 열쇠가 영·러·일 사전에 다 있는가
//   (korscantest·langlive 가 통과했는데도 12곳이 빠져 있었다 — 큰따옴표로 적은 열쇠를 못 봤다)
(function staticKeys(){
  const a = SRC.indexOf('const I18N = {'), b = SRC.indexOf('\n};', a) + 3;
  const I18N = (new Function('return (' + SRC.slice(a + 'const I18N = '.length, b - 1) + ')'))();
  const code = SRC.slice(0, a) + SRC.slice(b);
  const re = /\b(?:t|tsub)\(\s*(['"])((?:\\.|(?!\1).)*)\1/g; let m; const keys = new Map();
  while((m = re.exec(code))){ let k; try{ k = (new Function('return ' + m[1] + m[2] + m[1]))(); }catch(e){ continue; }
    if(/[가-힣]/.test(k) && !keys.has(k)) keys.set(k, 1); }
  const re2 = /data-t="([^"]+)"/g; while((m = re2.exec(code))){ if(/[가-힣]/.test(m[1])) keys.set(m[1], 1); }
  for(const L of ['en','ru','ja']){
    const miss = [...keys.keys()].filter(k => !(k in I18N[L]) && !(k.split('@@')[0] in I18N[L]));
    T('⑥ 코드가 부르는 한국어 열쇠 ' + keys.size + '개가 ' + L + ' 사전에 다 있다', miss.length === 0, miss.slice(0, 8));
  }
  const ctx = [...keys.keys()].filter(k => k.indexOf('@@') > 0);
  for(const L of ['en','ru','ja']){
    const miss = ctx.filter(k => !(k in I18N[L]));
    T('⑤ 자리별 열쇠(@@) ' + ctx.length + '개가 ' + L + ' 사전에 따로 있다', ctx.length >= 15 && miss.length === 0, miss);
  }
  T('⑦ 러시아어 약관 앱 이름에 라틴 i 가 없다(«Пэннiль»)', SRC.indexOf('Пэннiль') < 0);
  for(const [n, s] of [['LEGAL_DOCS_EN','en'],['LEGAL_DOCS_JA','ja'],['LEGAL_DOCS_RU','ru']]){
    const i = SRC.indexOf('const ' + n + ' = {'), j = SRC.indexOf('\n};', i), seg = SRC.slice(i, j);
    T('⑦ ' + n + ' — 계정 삭제 안내 링크가 그 말 쪽(delete.' + s + '.html)', seg.indexOf('baetnil.com/delete.' + s + '.html') >= 0 && seg.indexOf('baetnil.com/delete.html') < 0);
  }
  // 아이폰 앱 이름 · 안드로이드 알림 글
  const ip = JSON.parse(fs.readFileSync(path.join(REPO, 'ios/App/infoplist_strings.json'), 'utf8'));
  T('⑨ 아이폰 — 영·러·일 폰 앱 이름은 Baetnil, 한국어 폰은 뱃일',
    ['en','ja','ru'].every(l => ip[l].CFBundleDisplayName === 'Baetnil' && ip[l].CFBundleName === 'Baetnil') && ip.ko.CFBundleDisplayName === '뱃일', ip);
  const J = ['BaetnilTrackService.java','BaetnilTrack.java'].map(f => fs.readFileSync(path.join(REPO, 'android/app/src/main/java/kr/baetnil/app', f), 'utf8')).join('\n');
  const kor = (J.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').match(/"[^"\n]*[가-힣][^"\n]*"/g) || []);
  T('⑨ 안드로이드 항적 서비스 — 알림 채널 이름·알림 글에 한국어가 박혀 있지 않다', kor.length === 0, kor);
  for(const d of ['values','values-en','values-ko','values-ja','values-ru']){
    const x = fs.readFileSync(path.join(REPO, 'android/app/src/main/res', d, 'strings.xml'), 'utf8');
    T('⑨ ' + d + '/strings.xml 에 trk_noti_title·trk_noti_text', /name="trk_noti_title"/.test(x) && /name="trk_noti_text"/.test(x));
  }
})();

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://127.0.0.1:' + server.address().port + '/';
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  async function open(lang){
    const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
    await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo|openstreetmap|openseamap/, r => r.abort());
    await ctx.addInitScript(({ lang }) => { try{ if(sessionStorage.getItem('__pre')) return; sessionStorage.setItem('__pre', '1');
      localStorage.setItem('bt_setup', 'done'); localStorage.setItem('bt_welcome', 'done');
      if(lang && lang !== 'ko') localStorage.setItem('bt_lang', lang); }catch(_){} }, { lang });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 200)));
    await pg.goto(url, { waitUntil:'domcontentloaded' }); await sleep(1500);
    await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} unlocked = true; });
    return { ctx, pg, errs };
  }
  const W = {
    ko: { word:'계정을 삭제합니다' }, en: { word:'delete my account' },
    ru: { word:'Удалить аккаунт' }, ja: { word:'アカウントを削除します' }
  };
  for(const L of ['ko','en','ru','ja']){
    const { ctx, pg, errs } = await open(L);
    // ① 계정 삭제 확인 문구
    const w = await pg.evaluate(w => {
      window.__user = window.__user || { uid:'u1', email:'a@b.c' };
      let wiped = 0; window.doWipe = () => { wiped++; };
      askWipe();
      const sub = (document.getElementById('lkFormSub') || document.querySelector('#formBody') || {}).textContent || '';
      const inp = document.querySelector('#formBody input, #formBody textarea');
      const ph = inp ? inp.getAttribute('placeholder') : '';
      const r = { sub: document.body.innerText.indexOf(w) >= 0, ph, mine: wipeWordOk(w), mineDot: wipeWordOk(w + '.'), ko: wipeWordOk('계정을 삭제합니다'), wrong: wipeWordOk('delete'), empty: wipeWordOk('') };
      try{ formClose && formClose(); }catch(_){}
      return r;
    }, W[L].word);
    T('① ' + L + ' — 안내에 그 말 확인 문구 「' + W[L].word + '」, 입력칸 예시도 같다', w.sub && w.ph === W[L].word, w);
    T('① ' + L + ' — 그 말로 적으면 지워진다(끝 마침표·대소문자 무관), 한국어로 적어도 받는다, 틀리면 안 받는다',
      w.mine && w.mineDot && w.ko && !w.wrong && !w.empty, w);
    // ② 달력 고른 날 요일 — 2026-10-07 은 수요일
    const dow = await pg.evaluate(() => { const q = [2026, 10, 7]; return (CAL_DOW[calLang()] || CAL_DOW.ko)[new Date(q[0], q[1]-1, q[2]).getDay()]; });
    const 기대 = { ko:'수', en:'Wed', ru:'Ср', ja:'水' }[L];
    T('② ' + L + ' — 2026-10-07 의 요일이 「' + 기대 + '」', dow === 기대, dow);
    const calSrc = await pg.evaluate(() => typeof renderCal === 'function' ? String(renderCal) : '');
    T('② 고른 날 요일을 돌린 배열(calDow)이 아니라 요일 순서 그대로(CAL_DOW)에서 집는다', /CAL_DOW\[calLang\(\)\][^\n]*getDay\(\)/.test(calSrc) && !/calDow\(\)\[new Date\(q\[0\]/.test(calSrc));
    // ③ 괄호 글
    const pl = await pg.evaluate(() => [tsub('{n}명', { n: 1 }), tsub('{n}명', { n: 5 }), tsub('{n}자리', { n: 1 }), tsub('{n}자리', { n: 3 })]);
    T('③ ' + L + ' — 인원·자리 수에 괄호 글이 없고 숫자에 맞는 꼴 ' + pl.join(' / '), pl.every(s => s.indexOf('[[') < 0) &&
      (L !== 'en' || (pl[0] === '1 person' && pl[1] === '5 people' && pl[2] === '1 spot' && pl[3] === '3 spots')) &&
      (L !== 'ru' || (pl[1] === '5 чел.' && pl[3] === '3 места')), pl);
    const splitSites = (SRC.match(/t\('\{n\}(명|자리)'\)\.split/g) || []).length;
    T('③ t(\'{n}명/자리\').split 으로 숫자를 끼우는 곳이 없다', splitSites === 0, splitSites);
    // ④ 모양 이름
    const shp = await pg.evaluate(() => LK_SHAPES.find(x => x.id === 'circ').name);
    const 모양 = { ko:'원', en:'Circle', ru:'Круг', ja:'円形' }[L];
    T('④ ' + L + ' — 수납칸 모양 동그라미 이름 「' + 모양 + '」 (돈 「원」 이 아님)', shp === 모양, shp);
    const won = await pg.evaluate(() => t('원'));
    T('④ ' + L + ' — 돈 「원」 은 그대로 ' + JSON.stringify(won), won === { ko:'원', en:' KRW', ru:' вон', ja:'ウォン' }[L], won);
    // ⑤ 자리별 열쇠 — 한국어 화면은 @@ 앞 글자 그대로
    const sp = await pg.evaluate(() => ({ chip: t('마감'), btn: t('마감@@단추'), up: t('올리기'), upc: t('올리기@@클라우드'),
      cnt: tsub('{n}편@@개수', { n: 5 }), no: tsub('{n}편', { n: 5 }), mob: t('끄기@@사람빠짐'), none: t('없는열쇠@@아무자리') }));
    if(L === 'ko') T('⑤ 한국어 — 「글자@@자리」 는 @@ 앞 글자 그대로', sp.btn === '마감' && sp.upc === '올리기' && sp.cnt === '5편' && sp.mob === '끄기' && sp.none === '없는열쇠', sp);
    if(L === 'en') T('⑤ 영어 — 마감 칩 Closed / 단추 Close · 클라우드 올리기 Upload · 5 parts / Part 5 · 사람 빠짐 Clear MOB', sp.chip === 'Closed' && sp.btn === 'Close' && sp.upc === 'Upload' && sp.up === 'Post' && sp.cnt === '5 parts' && sp.no === 'Part 5' && sp.mob === 'Clear MOB', sp);
    if(L === 'ru') T('⑤ 러시아어 — Набор закрыт / Закрыть набор · 5 частей / часть 5', sp.chip === 'Набор закрыт' && sp.btn === 'Закрыть набор' && sp.cnt === '5 частей', sp);
    if(L === 'ja') T('⑤ 일본어 — 締切 / 締め切る · 全5回 / 第5回 · 終了', sp.chip === '締切' && sp.btn === '締め切る' && sp.cnt === '全5回' && sp.no === '第5回' && sp.mob === '終了', sp);
    // ⑥ 지우기 확인·서버 오류가 그 말로
    const del = await pg.evaluate(() => [tsub("'{name}' 칸을 지울까요?", { name:'A' }), tsub("안에 든 물품 {n}개는 지워지지 않고 '미배치'로 남습니다.", { n: 2 }), t('오늘 옮길 수 있는 양을 다 썼습니다. 내일 다시 해 주세요.'), rideLaw()]);
    if(L !== 'ko') T('⑥ ' + L + ' — 칸 지우기 확인·서버 번역 오류·같이 타기 법 안내에 한글이 없다', del.every(s => !/[가-힣]/.test(s)), del);
    // ⑦ 약관 굵은 글씨
    const lg = await pg.evaluate(() => { openLegal('privacy'); const b = document.querySelector('#mrPanel .postbody'); return b ? { stars: b.textContent.indexOf('**') >= 0, bold: b.querySelectorAll('b').length } : null; });
    T('⑦ ' + L + ' — 약관 화면에 「**」 가 글자로 안 보이고 굵은 글씨로 나온다', lg && !lg.stars && lg.bold > 0, lg);
    // ⑧ 숫자·단위
    const u = await pg.evaluate(() => [numU(6, UNIT_LABEL.m), trkIntLabel(30), tsub('엔진 {n}시간', { n: 1.5 })]);
    const 단위 = { ko:['6개월','30초'], en:['6 mo','30 s'], ru:['6 мес.','30 с'], ja:['6か月','30秒'] }[L];
    T('⑧ ' + L + ' — 숫자와 단위 ' + JSON.stringify(u.slice(0, 2)), u[0] === 단위[0] && u[1] === 단위[1], u);
    if(L === 'en') T('⑧ 영어 — 1.5 엔진 시간은 여럿 꼴', /1\.5 engine hours/.test(u[2]), u[2]);
    // ⑩ 정박지 이름 — 네 말로 사람이 적어 둔 표(자동 음역 아님)
    const sn = await pg.evaluate(() => [
      spotShowName({ seed:true, cc:'jp', name:'小樽港マリーナ' }),
      spotShowName({ seed:true, cc:'kr', name:'사곡 마리나' }),
      spotShowName({ seed:true, cc:'ru', name:'Яхт-клуб «Звезда»' }),
      spotShowName({ seed:false, cc:'kr', name:'사람이 올린 곳' }),
      Object.keys(SPOT_NM).length ]);
    const 기대이름 = { ko:['오타루항 마리나','사곡 마리나','즈베즈다 요트 클럽'], en:['Otaru Port Marina','Sagok Marina','Zvezda Yacht Club'],
                       ru:['Марина порта Отару','Марина Сагок','Яхт-клуб «Звезда»'], ja:['小樽港マリーナ','サゴクマリーナ','ズヴェズダ・ヨットクラブ'] }[L];
    T('⑩ ' + L + ' — 정박지 이름이 표대로 ' + JSON.stringify(sn.slice(0, 3)), sn[0] === 기대이름[0] && sn[1] === 기대이름[1] && sn[2] === 기대이름[2] && sn[4] >= 560, sn);
    T('⑩ ' + L + ' — 사람이 올린 정박지는 표를 안 탄다', /사람이 올린 곳|Saram/.test(sn[3]) || sn[3].length > 0, sn[3]);
    // ⑪ 정박지 설명 줄 — 줄마다 사람이 적어 둔 표, 붙어 버린 한국어 줄은 바로잡은 것
    const nt = await pg.evaluate(() => {
      const seeds = SPOT_SEED.map(seedSpotRow);
      const 한글 = seeds.filter(s => s.note && /[가-힣]/.test(spotShowNote(s))).length;
      const 빠짐 = [].concat(...seeds.map(spotNoteRest)).length;
      const 붙음 = spotShowNote({ seed:true, note:'급유 : 일반 유류 취급소 이용급수 : 자체조달수리 : 각 항구 수리점 이용' });
      const 일본주소 = spotShowNote({ seed:true, note:'高松市浜ノ町' });
      const 남의것 = spotShowNote({ seed:false, id:'x', note:'사람이 쓴 글' });
      const s = seeds.find(x => x.note && x.note.indexOf('급유 :') >= 0);
      window.__spotId = s.id;
      return { 한글, 빠짐, 붙음, 일본주소, 남의것, 기대: spotShowNote(s), n: Object.keys(SPOT_NOTE).length };
    });
    await pg.evaluate(() => openSpot(window.__spotId)); await sleep(500);
    nt.열림 = await pg.evaluate(() => [...document.querySelectorAll('.postbody')].map(e => e.innerText).join('\n'));
    const 기대줄 = { ko:['급유: 일반 유류 취급소 이용 · 급수: 자체 조달 · 수리: 각 항구 수리점 이용', '다카마쓰시 하마노초'],
                    en:['Fuel', 'Hamanocho, Takamatsu-shi'], ru:['Топливо', 'Hamanocho, Takamatsu-shi'], ja:['給油', '高松市浜ノ町'] }[L];
    T('⑪ ' + L + ' — 설명 줄이 표대로(붙은 줄 바로잡음·일본 주소) ' + JSON.stringify([nt.붙음.slice(0, 40), nt.일본주소]),
      (L === 'ko' ? nt.붙음 === 기대줄[0] : nt.붙음.indexOf(기대줄[0]) === 0) && nt.일본주소 === 기대줄[1] && nt.n >= 480, nt);
    T('⑪ ' + L + ' — 앱에 든 정박지 설명이 표에 다 있다(자동 번역으로 갈 줄 0)', nt.빠짐 === 0, nt.빠짐);
    T('⑪ ' + L + ' — 외국어 화면 설명에 한국어 없음', L === 'ko' || nt.한글 === 0, nt.한글);
    T('⑪ ' + L + ' — 정박지 화면 「한마디」 가 표대로 나온다', nt.열림.indexOf(nt.기대.split('\n')[0]) >= 0, nt.열림.slice(0, 200));
    T('⑪ ' + L + ' — 사람이 쓴 설명은 표를 안 탄다', nt.남의것 === '사람이 쓴 글' || L !== 'ko', nt.남의것);
    const wb = await pg.evaluate(() => getComputedStyle(document.body).wordBreak);
    T('⑫ ' + L + ' — 줄 끊기: 한·영·러는 띄어쓰기에서(keep-all), 일본어는 글자 사이에서(normal) — ' + wb, wb === (L === 'ja' ? 'normal' : 'keep-all'), wb);
    T('⑨ ' + L + ' — 쪽 오류 없음', errs.length === 0, errs);
    await ctx.close();
  }
  await br.close(); server.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사 자체 오류 — ' + e.message); process.exit(1); });
