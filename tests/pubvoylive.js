// 4.102 — 남의 배 항해일지도 **내 화면과 같은 칸**으로 보여 준다 (사장님 지적)
//
// ★ 사장님 말씀
//   「자기가 보는 거는 이렇게 예쁜 화면에서 잘 나오는데 왜 사람들한테 보여주는 거는
//    화면이 이렇게 조같냐? 그리고 날씨 같은 거는 공개해줘도 상관없는 거 아니냐?
//    오히려 공개해줘야지. 그게 사람들이 보기에 재밌는 거 아니냐」
//   그리고 좌표는 — 「좌표는 선택하게 해라」
//
// ★ 같이 잡은 고장 — 공개 화면에 「출발 날씨 [object Object]」 가 떴다.
//   옛 자료는 날씨가 한 겹 더 싸여 온다({text:{kt:…}}). 그것을 그대로 글자로 찍었다.
//
// ★ 좌표는 **배 주인이 정한 만큼만** 자료에 실려 온다 (항적 보이기 · 가리개 넓이).
//   화면은 온 것만 그린다. 안 왔으면 안 그린다 — 화면이 제 마음대로 뚫지 않는다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq, rs) => {
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; } rs.writeHead(200); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };

(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 },
                                          isMobile:true, hasTouch:true })).newPage();
  const errs = []; pg.on('pageerror', e => errs.push(String(e).slice(0, 150)));
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'domcontentloaded' });
  await pg.waitForTimeout(1300);
  await pg.evaluate(() => { try{ skipWelcome(); }catch(_){} });
  await pg.waitForTimeout(300);

  await pg.evaluate(() => {
    const BOAT = { id:'pb1', name:'여수 Shunshine', typeName:'세일링 요트', port:'여수 원형 마리나',
      intro:[], mlog:[], maint:[], review:[], boatrv:[], gear:[], roster:[], posts:[],
      voyage:[{ id:'v1', title:'야간 항해 연습', date:'2026-09-03',
        from:'여수', to:'여수', timeOut:'17:48', timeIn:'19:40', nm:'2.5', hours:1.9, engineH:0.9,
        // ★ 지금 판이 내보내는 모양 (숫자)
        wxOut:{ dir:90, kt:10, gust:20, wave:0.4, temp:29, at:'2026-09-03 17:48' },
        // ★ 옛 판이 내보낸 모양 — 한 겹 더 싸여 있다. 여기서 [object Object] 가 났다.
        wxIn:{ text:{ dir:70, kt:8, wave:0.3, temp:27 } },
        posOut:{ lat:34.73867, lon:127.67888 },
        logs:[{ time:'18:08', kind:'세일', text:'', eng:'off',
                wx:{ dir:90, kt:10, gust:20, wave:0.4, temp:29 } },
              { time:'18:56', kind:'관측', text:'야경보기 좋음', eng:'',
                wx:{ dir:70, kt:10, wave:0.4, temp:27 }, area:'남해동부' },
              { time:'19:05', kind:'세일 내림', text:'', eng:'on' }],
        photos:[], phOut:[], phIn:[] }] };
    window.__pub = { one: async () => BOAT, list: async () => [BOAT] };
    setOtherSub('voyage');
  });
  await pg.waitForTimeout(400);
  await pg.evaluate(() => expOpen('pb1','voyage','v1'));
  await pg.waitForTimeout(700);

  const 본문 = () => pg.evaluate(() => document.getElementById('mrPanel').innerText);
  const 글 = await 본문();

  // ── ① [object Object] 가 없다
  T('★★★ 화면에 「[object Object]」 가 없다 (사장님이 보신 그것)',
    글.indexOf('[object Object]') < 0, 글.slice(0, 300));

  // ── ② 날씨가 실제로 나온다
  T('★★★ 출발 날씨가 글자로 나온다', /10kt/.test(글) && /파고 0\.4m/.test(글), 글.slice(0,400));
  T('★★★ 한 겹 더 싸인 옛 날씨도 풀어서 나온다 (도착)',
    /8kt/.test(글) && /파고 0\.3m/.test(글), 글.slice(0,600));
  T('★★★ 중간 기록의 날씨도 나온다 (사장님: 오히려 공개해줘야지)',
    (글.match(/파고/g) || []).length >= 3, (글.match(/파고/g)||[]).length);

  // ── ③ 내 화면과 같은 칸이다
  const 칸 = await pg.evaluate(() => ({
    출발: document.querySelectorAll('#mrPanel .legc.out').length,
    중간: document.querySelectorAll('#mrPanel .legc.mid').length,
    도착: document.querySelectorAll('#mrPanel .legc.in').length,
    점:   document.querySelectorAll('#mrPanel .legc .ldot').length }));
  T('★★★ 출발 칸이 있다 (초록 띠)', 칸.출발 === 1, 칸);
  T('★★★ 중간 기록마다 제 칸이 있다 (노랑 띠)', 칸.중간 === 3, 칸);
  T('★★★ 도착 칸이 있다 (빨강 띠)', 칸.도착 === 1, 칸);
  T('★★ 칸마다 색 점이 있다', 칸.점 === 5, 칸);

  // ── ④ 시각·갈래·엔진이 보인다
  T('★★ 시각이 나온다', /17:48/.test(글) && /18:08/.test(글) && /19:40/.test(글));
  T('★★ 갈래가 나온다', /세일/.test(글) && /관측/.test(글));
  // ★ 말이 「켬·끔」 에서 「켜짐·꺼짐」 으로 바뀌었다 (4.12x).
  //   글자만 보면 또 바뀔 때 놓친다 — 칩의 갈래(engon·engoff)까지 함께 잡는다.
  const 엔진 = await pg.evaluate(() => ({
    켜짐: [...document.querySelectorAll('#mrPanel .chip.engon')].map(x => (x.textContent||'').trim()),
    꺼짐: [...document.querySelectorAll('#mrPanel .chip.engoff')].map(x => (x.textContent||'').trim()),
    안적은칸: [...document.querySelectorAll('#mrPanel .legc.mid')]
                .filter(c => !c.querySelector('.chip.engon, .chip.engoff')).length
  }));
  T('★★ 엔진을 켠 기록에 「엔진 켜짐」 이 붙는다',
    엔진.켜짐.length === 1 && /엔진/.test(엔진.켜짐[0]) && /켜짐/.test(엔진.켜짐[0]), 엔진);
  T('★★ 엔진을 끈 기록에 「엔진 꺼짐」 이 붙는다',
    엔진.꺼짐.length === 1 && /엔진/.test(엔진.꺼짐[0]) && /꺼짐/.test(엔진.꺼짐[0]), 엔진);
  T('★★ 엔진을 안 건드린 기록에는 안 붙인다 (없는 말을 지어내지 않는다)',
    엔진.안적은칸 === 1, 엔진);
  T('★★ 그 말이 화면 글에도 그대로 나온다', /엔진/.test(글) && /켜짐/.test(글) && /꺼짐/.test(글), 글.slice(0,600));

  // ── ⑤ 좌표 — 온 것만 그린다
  T('★★★ 배 주인이 내보낸 좌표는 그린다', /34°/.test(글), 글.slice(0,500));
  T('★★★ 좌표가 안 온 자리는 안 그린다 (도착 자리는 안 왔다)',
    (글.match(/📍/g) || []).length === 1, (글.match(/📍/g)||[]).length);
  T('★★ 좌표 대신 해역 이름만 온 자리는 그 이름을 보여 준다', /남해동부/.test(글));

  // ── ⑥ 남의 배 화면에서는 고치는 칸이 하나도 없다
  const 고침 = await pg.evaluate(() => ({
    칸: document.querySelectorAll('#mrPanel input, #mrPanel textarea, #mrPanel select').length,
    바뀜: document.querySelectorAll('#mrPanel [onchange]').length }));
  T('★★★ 남의 배에서는 고치는 칸이 없다', 고침.칸 === 0 && 고침.바뀜 === 0, 고침);

  T('앱이 안 터졌다', errs.length === 0, errs);
  await br.close(); server.close();
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사가 터졌습니다 — ' + (e && e.message)); process.exit(1); });
