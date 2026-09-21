// 4.102 — 지도 이름표는 겹치면 **밀어내지 않고 안 그린다** (사장님 지적)
//
// ★ 사장님 말씀
//   「글씨들 서로 안 겹치게 하려고 존나 이상하게 배치되는데 이것도 고쳐야 하고」
//
// ★ 여태 무엇을 했나 — 겹치면 16px 씩 아래로 밀었고 **여덟 번까지** 밀었다(128px).
//   이름표가 제 핀에서 한참 떨어져 **엉뚱한 자리를 가리켰다.**
//
// ★ 남들은 어떻게 하나 (찾아본 것)
//   · 맵박스 — 기본이 text-allow-overlap:false, 겹치면 **감춘다.** 감추기 전에
//     text-variable-anchor 로 **핀 바로 옆 몇 자리**를 차례로 시도한다.
//   · 구글 지도 — CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY, 겹치면 안 보인다.
//   · 지도학(Penn State GEOG 486) — 오른쪽 위가 1순위, 안 되면 그다음 자리.
//     「연결은 지키되 읽히는 것을 희생하면서까지는 아니다」
//
// ★ 진짜 브라우저에서 **핀을 잔뜩 겹쳐 놓고 잰다.** 코드를 읽어서는 못 잰다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 260) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await pg.route('**://tile.openstreetmap.org/**', r => r.abort());
  await pg.route('**://tiles.openseamap.org/**', r => r.abort());
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} });
  await pg.waitForTimeout(300);

  // ── 아주 좁은 자리에 서른 곳을 몰아넣는다 (세토내해처럼)
  await pg.evaluate(() => {
    const pts = [];
    for(let i = 0; i < 30; i++)
      pts.push({ lat: 34.20 + (i % 6) * 0.004, lon: 133.20 + Math.floor(i / 6) * 0.004,
                 label: '宮島ビジターバース' + i, key: 'spot:s' + i });
    document.getElementById('mrPanel').innerHTML =
      '<div id="시험지도" class="mapbox" style="width:360px;height:420px"></div>';
    document.getElementById('mrPanel').classList.add('open','full');
    mapInit('시험지도', pts, { mode:'view' });
  });
  await pg.waitForTimeout(600);

  const 잰것 = await pg.evaluate(() => {
    const el = document.getElementById('시험지도');
    const R = el.getBoundingClientRect();
    const 핀 = [...el.querySelectorAll('.mpin')].map(p => {
      const r = p.getBoundingClientRect();
      return { key: p.dataset.key, x: r.left + r.width / 2 - R.left, y: r.top + r.height / 2 - R.top };
    });
    const 표 = [...el.querySelectorAll('.mlbl')].map(l => {
      const r = l.getBoundingClientRect();
      return { key: l.dataset.key, x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height };
    });
    // 이름표가 제 핀에서 얼마나 떨어졌나
    const 거리 = 표.map(l => {
      const p = 핀.find(q => q.key === l.key);
      if(!p) return 9999;
      const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
      return Math.round(Math.hypot(cx - p.x, cy - p.y));
    });
    // 이름표끼리 겹치나
    let 겹침 = 0;
    for(let i = 0; i < 표.length; i++)
      for(let j = i + 1; j < 표.length; j++){
        const a = 표[i], b = 표[j];
        if(!(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)) 겹침++;
      }
    return { 핀수: 핀.length, 이름표수: 표.length, 최대거리: Math.max(...거리, 0),
             겹침, 가린수: (typeof mapS !== 'undefined' && mapS) ? mapS.가린이름 : null };
  });

  T('핀은 서른 개가 다 찍힌다 (이름표가 없어도 핀은 남는다)', 잰것.핀수 === 30, 잰것);
  T('★★★ 겹치면 이름표를 **안 그린다** (밀어내지 않는다)',
    잰것.이름표수 < 30 && 잰것.이름표수 > 0, 잰것);
  T('★★★ 그린 이름표는 제 핀 **바로 옆**에 있다 (여태는 128px 까지 밀렸다)',
    잰것.최대거리 <= 90, 잰것);
  T('★★★ 그린 이름표끼리 겹치지 않는다', 잰것.겹침 === 0, 잰것);
  T('★★ 몇 개를 가렸는지 세어 둔다 — ' + 잰것.가린수,
    typeof 잰것.가린수 === 'number' && 잰것.가린수 > 0, 잰것);

  // ── 넉넉히 떨어져 있으면 다 그린다 (괜히 감추지 않는다)
  await pg.evaluate(() => {
    const pts = [];
    for(let i = 0; i < 6; i++)
      pts.push({ lat: 34.0 + i * 0.4, lon: 133.0 + i * 0.4, label: '마리나' + i, key: 'spot:w' + i });
    mapInit('시험지도', pts, { mode:'view' });
  });
  await pg.waitForTimeout(500);
  const 넉넉 = await pg.evaluate(() => ({
    핀: document.querySelectorAll('#시험지도 .mpin').length,
    이름: document.querySelectorAll('#시험지도 .mlbl').length,
    가린: (typeof mapS !== 'undefined' && mapS) ? mapS.가린이름 : null }));
  T('★★★ 안 겹치면 이름표를 다 그린다 (괜히 감추지 않는다)',
    넉넉.이름 === 6 && 넉넉.가린 === 0, 넉넉);

  // ── 밀어내는 옛 코드가 남아 있지 않은가
  const 옛것 = await pg.evaluate(() => {
    const f = String(mapPaint);
    return { 여덟칸: /칸 \* 16/.test(f), 후보여섯: (f.match(/x: px/g) || []).length };
  });
  T('★★★ 아래로 여덟 칸 미는 옛 방식이 없어졌다', 옛것.여덟칸 === false, 옛것);
  T('★★ 핀 옆 여섯 자리를 시도한다 (지도학 차례)', 옛것.후보여섯 >= 6, 옛것);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
