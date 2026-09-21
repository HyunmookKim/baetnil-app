// 물품을 도면에서 골라 옮기기 — 진짜 손가락으로 눌러 본다.
//
// ★ 왜 이 검사가 있나
//   여태 이동은 「구역 이름 고르기 → 칸 이름 고르기」 였다.
//   오랜만에 배에 나가면 '선수 창고 2' 가 배의 어디인지 아무도 기억 못 한다.
//
//   그리고 ★ 이것은 정비 화면의 「핀 지정」 과 같은 구조다.
//   그 기능은 3.82 부터 4.06 까지 죽어 있었고, 내가 세 번이나 잘못 고쳤다.
//   진짜 원인은 「도면 그리기」 가 눈에 안 보이게 켜져 있어서였다 —
//   같은 손가락 끌기를 그리기와 고르기가 나눠 가질 수 없었던 것이다.
//   그때 검사가 못 잡은 까닭은 함수를 코드로 불러서 시험했기 때문이다.
//   그래서 여기서는 반드시 **진짜 마우스 클릭**으로 누른다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
// 인자가 절대경로면 그대로 쓴다 (__dirname 을 무조건 붙이면 ENOENT 가 났다)
const rel = q => path.isAbsolute(q) ? q : path.join(__dirname, q);
const src = fs.readFileSync(rel(FILE), 'utf8');
const BASEDIR = path.dirname(rel(FILE));
const server = http.createServer((rq, rs) => {
  const u = rq.url === '/' ? null : rq.url.split('?')[0];
  const f = u === null ? rel(FILE) : path.join(BASEDIR, u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,240) : '')); } };

function grab(name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}

// ── ① 있어야 할 것
{
  T('도면에서 고르기 시작하는 곳이 있다 (mvFromMap)', !!grab('mvFromMap'));
  T('칸을 눌렀을 때 받는 곳이 있다 (mvHit)', !!grab('mvHit'));
  T('그만두는 곳이 있다 (mvCancel)', !!grab('mvCancel'));
  T('★ 옮기는 셈은 doMove 한 곳에서만 한다',
    /doMove\(/.test(grab('mvDo')) && !/items\s*=\s*items\.map/.test(grab('mvDo')),
    grab('mvDo').slice(0,200));
  T('★ 시작할 때 도면 그리기를 끈다 (4.06 에서 겪은 함정)',
    /lkEdit[\s\S]{0,60}toggleLkEdit\(\)/.test(grab('mvFromMap')), grab('mvFromMap').slice(0,400));
  T('★ 그리기를 켜면 고르기를 그만둔다',
    /mvCancel\(\)/.test(grab('toggleLkEdit')), grab('toggleLkEdit').slice(0,240));
  T('★ 목록 보기로 가면 그만둔다', /mvCancel\(\)/.test(grab('toggleView')), grab('toggleView').slice(0,300));
  T('★ 적재표 탭을 떠나면 그만둔다', /mvCancel\(\)/.test(grab('switchTab')));
  T('이름으로 고르는 길도 남아 있다', /renderMoveSub\(this\.value/.test(src));
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0,140)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(() => { window.__al = [];
    window.alert = m => window.__al.push(String(m).replace(/\n+/g,' / '));
    window.confirm = () => true;  // ★ 앱은 alert/confirm 을 안 쓴다 — 자기 창(tell/ask)
    window.tell = m => { window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(); };
    window.ask  = m => { window.__al.push(String(m).replace(/\n+/g,' / ')); return Promise.resolve(true); };
    window.__user = { uid:'testuid', email:'t@example.com', name:'시험' };
    try{ skipWelcome(); }catch(_){} unlocked = true; openBoatSetup(); });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { document.getElementById('nbName').value = '시험호'; createBoat(); });
  await pg.waitForTimeout(1500);

  // 칸 셋과 물품 둘을 심는다. 칸은 서로 안 겹치게 넉넉히 띄운다.
  await pg.evaluate(() => {
    lockers = [
      { id:'L1', zone:'선수', label:'선수 창고', x:8,  y:8,  w:34, h:26 },
      { id:'L2', zone:'선미', label:'선미 창고', x:8,  y:52, w:34, h:26 },
      { id:'L3', zone:'중앙', label:'중앙 사물함', x:56, y:30, w:34, h:26 },
    ];
    items = [
      { id:1, name:'구명조끼', qty:6, unit:'개', lockerId:'L1', zone:'선수', locker:'선수 창고',
        parentId:null, photos:[], note:'' },
      { id:2, name:'공구 상자', box:true, lockerId:'L3', zone:'중앙', locker:'중앙 사물함',
        parentId:null, photos:[], note:'' },
    ];
    dgImgs = dgImgs || {};
    save(); switchTab('boat'); setBoatSubTab('stow');
  });
  await pg.waitForTimeout(1200);
  // 칸 그림은 refreshBoxes 가 만든다 — 자료만 심고 바로 세면 아직 0개다
  await pg.evaluate(() => { refreshBoxes(); });
  await pg.waitForTimeout(500);

  const seen = await pg.evaluate(() => ({
    도면보임: getComputedStyle(document.getElementById('mapWrap')).display !== 'none',
    칸수: document.querySelectorAll('#map .box').length }));
  T('도면에 칸 셋이 보인다', seen.도면보임 && seen.칸수 === 3, seen);

  // ── ② 「선수 창고」 의 구명조끼를 「선미 창고」 로 — 진짜 클릭으로
  await pg.evaluate(() => { openLocker('L1'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { moveId = 1; renderPanelItems(); });
  await pg.waitForTimeout(600);

  // 4.117 이후 단추 이름이 「도면에서 고르기」 → 「도면에서 선택」 으로 바뀌었다
  const btn = await pg.$('button.minib.grn:has-text("도면에서 선택")');
  T('★ 「도면에서 선택」 단추가 화면에 있다', !!btn);
  if(btn){
    await btn.click();
    await pg.waitForTimeout(800);
    const st = await pg.evaluate(() => ({
      고르는중: !!mvPick,
      띠보임: getComputedStyle(document.getElementById('mvBanner')).display !== 'none',
      띠글: (document.getElementById('mvBannerText') || {}).textContent || '',
      도면표시: document.getElementById('map').classList.contains('mvpick'),
      현재칸표시: !!document.querySelector('#map .box.mvfrom'),
      현재칸: (document.querySelector('#map .box.mvfrom') || {}).id,
      창닫힘: !document.getElementById('panel').classList.contains('open') }));
    T('★ 고르기가 켜지고 띠가 뜬다', st.고르는중 && st.띠보임, st);
    T('띠에 무엇을 옮기는지 적혀 있다', /구명조끼/.test(st.띠글), st.띠글);
    T('★ 지금 들어 있는 칸이 표시된다', st.현재칸표시 && st.현재칸 === 'bx_L1', st);
    T('물품 창이 닫혀 도면이 보인다', st.창닫힘, st);

    // ★ 도면을 다시 그려도 표시가 남아야 한다.
    //   (확대하거나 자료가 바뀌면 칸 그림이 다시 만들어진다. 그때 표시가 날아가면
    //    「내가 어디서 빼는 거였지」 를 잃는다. 사보타주에서 이걸 안 봐서 못 잡았다.)
    await pg.evaluate(() => { buildBoxes(); refreshBoxes(); });
    await pg.waitForTimeout(500);
    const again = await pg.evaluate(() => ({
      표시: !!document.querySelector('#map .box.mvfrom'),
      어느칸: (document.querySelector('#map .box.mvfrom') || {}).id,
      고르는중: !!mvPick }));
    T('★★ 도면을 다시 그려도 지금 들어 있는 칸 표시가 남는다',
      again.표시 && again.어느칸 === 'bx_L1' && again.고르는중, again);

    // ★★ 진짜 마우스 클릭으로 「선미 창고」 를 누른다
    const box = await pg.$('#bx_L2');
    T('선미 창고 칸을 화면에서 찾았다', !!box);
    if(box){
      await box.scrollIntoViewIfNeeded();
      await box.click();
      await pg.waitForTimeout(1200);
      const got = await pg.evaluate(() => {
        const it = items.find(x => x.id === 1);
        return { 칸: it && it.lockerId, 구역: it && it.zone, 이름: it && it.locker,
                 고르는중: !!mvPick, 띠보임: getComputedStyle(document.getElementById('mvBanner')).display !== 'none',
                 말: (window.__al || []).slice() };
      });
      T('★★ 구명조끼가 선미 창고로 옮겨졌다', got.칸 === 'L2', got);
      T('★ 구역과 칸 이름도 같이 바뀐다 (목록에서 엉뚱한 데 나오면 안 된다)',
        got.구역 === '선미' && got.이름 === '선미 창고', got);
      T('★ 옮기고 나면 고르기가 저절로 꺼진다', got.고르는중 === false && got.띠보임 === false, got);
      T('군말이 안 뜬다', (got.말 || []).length === 0, got.말);
    }
  }

  // ── ③ 같은 칸을 다시 누르면 알려 주고 아무것도 안 한다
  await pg.evaluate(() => { window.__al = []; openLocker('L2'); });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { moveId = 1; renderPanelItems(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { mvFromMap(1); });
  await pg.waitForTimeout(700);
  {
    const box = await pg.$('#bx_L2');
    if(box){ await box.click(); await pg.waitForTimeout(700); }
    const r = await pg.evaluate(() => ({
      칸: (items.find(x => x.id === 1) || {}).lockerId,
      말: (window.__al || []).join(' '), 고르는중: !!mvPick }));
    T('★ 이미 그 칸이면 이미 있다고 알려 준다', /이미 이 칸에 있습니다/.test(r.말), r);
    T('그때는 그대로 두고 고르기도 안 끝낸다', r.칸 === 'L2' && r.고르는중 === true, r);
    await pg.evaluate(() => mvCancel());
  }

  // ── ④ ★★ 도면 그리기를 켜 뒀다가 이동을 시작한다 (핀 지정을 죽였던 바로 그 상황)
  await pg.evaluate(() => { window.__al = []; switchTab('boat'); setBoatSubTab('stow'); });
  await pg.waitForTimeout(700);
  await pg.evaluate(() => { if(!lkEdit) toggleLkEdit(); });   // 그리기 켬
  await pg.waitForTimeout(500);
  const drew = await pg.evaluate(() => !!lkEdit);
  T('도면 그리기를 켰다', drew === true);
  await pg.evaluate(() => { openLocker('L2'); });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { moveId = 1; renderPanelItems(); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { mvFromMap(1); });
  await pg.waitForTimeout(800);
  const afterDraw = await pg.evaluate(() => ({ 그리기: !!lkEdit, 고르는중: !!mvPick,
    도면표시: document.getElementById('map').classList.contains('mvpick') }));
  T('★★ 그리기가 켜져 있어도 이동을 시작하면 그리기가 꺼진다', afterDraw.그리기 === false, afterDraw);
  T('★★ 그리고 고르기가 제대로 켜진다', afterDraw.고르는중 === true && afterDraw.도면표시, afterDraw);
  {
    const box = await pg.$('#bx_L1');
    if(box){ await box.click(); await pg.waitForTimeout(1000); }
    const r = await pg.evaluate(() => ({ 칸: (items.find(x => x.id === 1) || {}).lockerId }));
    T('★★ 그 상태에서도 진짜로 옮겨진다 (핀 지정이 죽었던 그 자리)', r.칸 === 'L1', r);
  }

  // ── ⑤ 탭을 떠나면 눈에 안 보이는 모드가 안 남는다
  await pg.evaluate(() => { openLocker('L1'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { mvFromMap(1); });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { switchTab('voyage'); });
  await pg.waitForTimeout(800);
  const left = await pg.evaluate(() => ({ 고르는중: !!mvPick }));
  T('★★ 다른 탭으로 가면 고르기가 남지 않는다', left.고르는중 === false, left);

  // 돌아와서 칸을 눌러도 엉뚱하게 안 옮겨지고 칸이 열려야 한다
  await pg.evaluate(() => { switchTab('boat'); setBoatSubTab('stow'); });
  await pg.waitForTimeout(900);
  {
    const before = await pg.evaluate(() => (items.find(x => x.id === 1) || {}).lockerId);
    const box = await pg.$('#bx_L3');
    if(box){ await box.click(); await pg.waitForTimeout(900); }
    const r = await pg.evaluate(() => ({
      칸: (items.find(x => x.id === 1) || {}).lockerId,
      열린칸: selected }));
    T('★★ 돌아와서 칸을 누르면 옮겨지지 않고 칸이 열린다',
      r.칸 === before && String(r.열린칸) === 'L3', { before, ...r });
  }

  // ── ⑥ 목록 보기로 가도 안 남는다
  await pg.evaluate(() => { openLocker('L1'); });
  await pg.waitForTimeout(500);
  await pg.evaluate(() => { mvFromMap(1); });
  await pg.waitForTimeout(600);
  await pg.evaluate(() => { view = 'map'; toggleView(); });   // 목록으로
  await pg.waitForTimeout(700);
  const lst = await pg.evaluate(() => ({ 고르는중: !!mvPick, 보기: view }));
  T('★ 목록 보기로 가면 고르기가 남지 않는다', lst.고르는중 === false, lst);

  T('앱이 터지지 않았다', errs.length === 0, errs.slice(0,2));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
