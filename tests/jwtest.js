// 5.00 — 일본 해상경보 칸 검사
//
// ★ 왜 만드나 (사장님 지시: "해상경보 받아라")
//   4.97 부터 배가 한국 해역 밖이면 「그 나라 기상 기관에서 확인해 주세요」 한 줄이었다.
//   이제 気象庁 해상경보를 그대로 가져다 보여 준다.
//
// ★ 이 검사가 지키는 것
//   ① 어느 해역인지 모르면 아무 말도 안 한다 (남의 해역 경보를 내 것인 양 보여 주지 않는다)
//   ② 못 받았으면 「경보 없음」 이라고 하지 않는다
//   ③ 경보 이름·해역 이름은 気象庁 글자 그대로 낸다
//   ④ 출처를 화면에서 뺄 수 없다 (政府標準利用規約·CC BY 4.0 의 조건이다)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,240):'')); } };
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}

const NAMES = ['inRing','seaAt','seaMine','jwMineZones','jwKeyOf','jwSeaName','jwLine','jwAlertBox'];
const bodies = NAMES.map(n => { const b = grab(src, n); T('함수가 있다 — ' + n, !!b); return b || ''; });
const note = (src.match(/const JMA_KIND = \{[\s\S]*?\n\};/) || [''])[0];
T('気象庁 경보 표가 있다', !!note);
const seatbl = (src.match(/const JMA_SEA = \{[\s\S]*?\n\};/) || [''])[0];
T('해역 이름표가 있다', !!seatbl);
T('★★★ 気象庁 예보구 48곳을 다 담았다', (seatbl.match(/^  '/gm) || []).length === 48,
  (seatbl.match(/^  '/gm) || []).length);
// ★★★ 네 말로 다 나오나 — 우리말 이름이 en·ru·ja 사전에 다 있어야 한다.
//   하나라도 빠지면 그 해역만 영어 화면에서 한국어로 나온다. 소리 없이 샌다.
{
  const L = src.split('\n');
  const at = re => L.findIndex(l => re.test(l));
  const blk = (a, b) => L.slice(at(a), at(b)).join('\n');
  const dict = { en: blk(/^  en\s*:\s*\{/, /^  ru\s*:\s*\{/),
                 ru: blk(/^  ru\s*:\s*\{/, /^  ja\s*:\s*\{/),
                 ja: blk(/^  ja\s*:\s*\{/, /^\};/) };
  const names = [...seatbl.matchAll(/':\s*'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
  T('해역 우리말 이름을 48개 읽었다', names.length === 48, names.length);
  ['en','ru','ja'].forEach(v => {
    const 빠진 = names.filter(n => dict[v].indexOf("'" + n + "':") < 0);
    T('★★★ 해역 이름이 ' + v + ' 사전에 다 있다', 빠진.length === 0, 빠진);
  });
  // 이름이 실제로 그 말로 바뀌는가 (사전 값이 우리말 그대로면 안 바뀐 것이다)
  const 세토 = (dict.en.match(/'세토 내해':'([^']*)'/) || [])[1];
  T('★★★ 세토 내해가 영어로 바뀐다', 세토 === 'Seto Inland Sea', 세토);
  const 세토ja = (dict.ja.match(/'세토 내해':'([^']*)'/) || [])[1];
  T('★★★ 일본어로는 気象庁 이름 그대로', 세토ja === '瀬戸内海', 세토ja);
  const 쓰시마 = (dict.ru.match(/'쓰시마 해협':'([^']*)'/) || [])[1];
  T('★★ 러시아어도 있다', /Цусим/.test(쓰시마 || ''), 쓰시마);
}
['瀬戸内海','四国沖南部','対馬海峡','沖縄南方海上','日本海西部','済州島西海上'].forEach(n => {
  T('★★ 예보구가 표에 있다 — ' + n, seatbl.indexOf("'" + n + "':") > 0);
});

const make = new Function('ctx', `
  let seaJP = ctx.seaJP, jwCache = ctx.jwCache;
  const curBoat = ctx.curBoat, boatOutsideKR = ctx.boatOutsideKR;
  const t = x => x;
  const tsub = (s, o) => String(s).replace(/\\{(\\w+)\\}/g, (m, k) => o[k]);
  const esc = x => String(x);
  ${seatbl}
  ${note}
  ${bodies.join('\n')}
  return { inRing, seaAt, seaMine, jwMineZones, jwKeyOf, jwLine, jwAlertBox };
`);

// ── 흉내 자료
const ring = (x0,y0,x1,y1) => [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
const SEA = { areas: [
  // ★ 넓은 해역을 일부러 맨 앞에 둔다 — 「먼저 만난 것」 이 아니라 「작은 상자」 를 골라야 한다.
  { c:'9999', n:'넓은바다', p:'', pn:'',
    box:[30.0,125.0,40.0,140.0], rings:[ ring(139.0,39.0,140.0,40.0) ] },
  { c:'4010', n:'瀬戸内海', p:'4000', pn:'四国沖及び瀬戸内海',
    box:[33.0,130.9,34.8,135.5], rings:[ ring(130.9,33.0,135.5,34.8) ] },
  { c:'4030', n:'四国沖南部', p:'4000', pn:'四国沖及び瀬戸内海',
    box:[31.0,132.0,33.5,135.0], rings:[ ring(132.0,31.0,135.0,32.9) ] },
  // 이웃 해역 — 상자는 세토내해 상자와 겹치고 더 작다.
  //   테두리를 안 보면 세토내해 한복판에 있는 배가 이쪽으로 붙어 버린다.
  { c:'4020', n:'四国沖北部', p:'4000', pn:'四国沖及び瀬戸内海',
    box:[33.5,134.0,34.5,135.2], rings:[ ring(134.0,33.5,135.2,34.0) ] },
  { c:'5000', n:'対馬海峡', p:'', pn:'',
    box:[33.0,127.0,35.0,131.0], rings:[ ring(127.0,33.0,131.0,35.0) ] },
] };
const W = { ok:true, read:'2026-09-02T14:40:00.000Z', zones:[
  { kind:'海上風警報',   code:'20', reg:'四国沖南部', regCode:'4030', office:'神戸海上気象' },
  { kind:'海上濃霧警報', code:'11', reg:'三陸沖西部', regCode:'2020', office:'仙台海上気象' },
  { kind:'海上強風警報', code:'21', reg:'オホーツク海', regCode:'9050', office:'札幌海上気象' }
] };
const 배 = (lat, lon) => ({ lat, lon });
const ctxOf = (o) => Object.assign({
  seaJP: SEA, jwCache: W, curBoat: () => 배(34.35, 134.05), boatOutsideKR: () => true }, o);

// ══ 1. 테두리 안 판정 ═══════════════════════════════════════════
{
  const m = make(ctxOf({}));
  T('테두리 안이면 안이라고 한다', m.inRing(134.0, 34.0, ring(130.9,33.0,135.5,34.8)));
  T('테두리 밖이면 밖이라고 한다', !m.inRing(120.0, 34.0, ring(130.9,33.0,135.5,34.8)));
}

// ══ 2. 어느 예보구인가 ══════════════════════════════════════════
{
  const m = make(ctxOf({}));
  T('★★★ 다카마쓰는 세토내해', (m.seaAt(34.35, 134.05)||{}).c === '4010', m.seaAt(34.35,134.05));
  T('시코쿠 남쪽 바다는 四国沖南部', (m.seaAt(32.0, 133.5)||{}).c === '4030', m.seaAt(32.0,133.5));
  T('대한해협은 対馬海峡', (m.seaAt(34.0, 129.0)||{}).c === '5000', m.seaAt(34.0,129.0));
  T('★★★ 일본 해역 밖이면 모른다고 한다', m.seaAt(1.3, 103.8) === null, m.seaAt(1.3,103.8));
  // 테두리 밖이지만 상자 안 — 뭍·섬 가장자리에 댄 배. 작은 상자를 고른다.
  T('★★ 테두리 밖이라도 상자 안이면 그 해역', (m.seaAt(32.95, 133.5)||{}).c === '4030', m.seaAt(32.95,133.5));
  T('★★★ 넓은 상자가 언저리를 삼키지 않는다', (m.seaAt(32.95, 133.5)||{}).c !== '9999', m.seaAt(32.95,133.5));
  T('★★★ 테두리 안이 작은 상자보다 세다', (m.seaAt(34.2, 134.5)||{}).c === '4010', m.seaAt(34.2,134.5));
  T('테두리만 있는 해역도 찾는다', (m.seaAt(39.5, 139.5)||{}).c === '9999', m.seaAt(39.5,139.5));
}
{
  // ★★★ 경계 자료가 없으면 아무 말도 안 한다
  const m = make(ctxOf({ seaJP: null }));
  T('★★★ 경계 자료가 없으면 해역을 지어내지 않는다', m.seaAt(34.35, 134.05) === null);
  T('★★★ 경계 자료가 없으면 칸을 아예 안 그린다', m.jwAlertBox() === '', m.jwAlertBox());
}
{
  const m = make(ctxOf({ boatOutsideKR: () => false }));
  T('★★★ 한국 해역 안이면 일본 칸을 안 그린다', m.seaMine() === null && m.jwAlertBox() === '');
}
{
  const m = make(ctxOf({ curBoat: () => ({ lat:null, lon:null }) }));
  T('배 자리를 모르면 일본 칸을 안 그린다', m.jwAlertBox() === '');
}

// ══ 3. 내 해역 경보 고르기 ══════════════════════════════════════
{
  const m = make(ctxOf({ curBoat: () => 배(32.0, 133.5) }));   // 四国沖南部
  const mine = m.jwMineZones(W, SEA.areas.find(a => a.c === '4030'));
  T('내 해역 경보를 고른다', mine.length === 1 && mine[0].regCode === '4030', mine);
  T('★★★ 남의 해역 경보를 내 것으로 세지 않는다',
    mine.every(z => z.regCode !== '2020' && z.regCode !== '9050'), mine);
  // 윗 예보구(四国沖及び瀬戸内海)로 나온 경보도 내 것이다
  const 위 = { ok:true, zones:[{ kind:'海上濃霧警報', code:'11', reg:'四国沖及び瀬戸内海', regCode:'4000' }] };
  T('★★ 윗 예보구로 나온 경보도 내 것', m.jwMineZones(위, SEA.areas.find(a => a.c === '4030')).length === 1);
  T('못 받은 자료에서는 아무것도 안 고른다',
    m.jwMineZones({ ok:false }, SEA.areas.find(a => a.c === '4030')).length === 0);
}

// ══ 4. 화면 ═════════════════════════════════════════════════════
{
  const m = make(ctxOf({ curBoat: () => 배(32.0, 133.5) }));   // 경보가 걸린 해역
  const h = m.jwAlertBox();
  T('★★★ 경보가 있으면 붉은 칸', /class="wxbox warn"/.test(h), h.slice(0,120));
  // ★★★ 海の安全情報 처럼 「해역 │ 현상」 이 크게 앞에 온다. 「海上風警報」 통짜가 아니다.
  T('★★★ 해역도 현상도 보는 사람 말로 앞에 크게',
    /<div class="jwz"><b>시코쿠 앞바다 남부<\/b> — 바람<\/div>/.test(h), h);
  T('★★★ 気象庁 원래 이름을 늘 남긴다 (대조용)',
    /<div class="jwsub">최대풍속 28~33노트 · 四国沖南部 · 海上風警報/.test(h), h);
  T('★★ 気象庁이 정한 영문 이름과 기호도 적는다',
    h.indexOf('WIND WARNING [W]') > 0, h);
  T('★★★ 경보 이름을 気象庁 글자 그대로 남긴다', h.indexOf('海上風警報') > 0, h);
  T('★★★ 출처를 화면에서 뺄 수 없다', h.indexOf('気象庁') > 0, h);
  T('★★★ 気象庁 실시간 자리로 가는 길이 있다',
    h.indexOf('https://www.jma.go.jp/bosai/seawarning/') > 0, h);
  // ★ 언제 읽은 것인지는 **보는 사람 시각**으로 적어야 한다.
  //   세계표준시를 그대로 내면 아홉 시간 전 것으로 읽혀 「낡은 자료」 로 오해한다.
  {
    const d = new Date('2026-09-02T14:40:00.000Z'), p2 = n => String(n).padStart(2, '0');
    const 제자리 = p2(d.getMonth()+1) + '-' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
    T('★★ 언제 읽은 것인지 보는 사람 시각으로 적는다', h.indexOf(제자리) > 0, [제자리, h]);
    if(process.env.TZ === 'Asia/Seoul')
      T('★★★ 세계표준시를 그대로 내지 않는다', h.indexOf('14:40') < 0, h);
  }
  T('★★ 내 배가 어느 해역인지 밝힌다', h.indexOf('내 배 자리') > 0, h);
  T('★★ 제목에 해역을 두 번 적지 않는다',
    h.slice(0, h.indexOf('jwz')).indexOf('해역') < 0, h.slice(0, 160));
  T('알림 셈에도 잡힌다', m.jwKeyOf(W) === '海上風警報@四国沖南部', m.jwKeyOf(W));
  // ★★★ 표에 없는 경보는 気象庁 이름을 그대로 낸다 — 모르는 것을 아는 척하지 않는다
  const 낯선 = m.jwLine({ kind:'海上高潮警報', code:'99', reg:'四国沖南部', regCode:'4030' });
  T('★★★ 모르는 경보는 気象庁 이름 그대로', /<b>시코쿠 앞바다 남부<\/b> — 海上高潮警報/.test(낯선), 낯선);
  T('★★★ 모르는 경보에 기준을 지어내지 않는다', 낯선.indexOf('노트') < 0, 낯선);
}
{
  const m = make(ctxOf({}));   // 세토내해 — 걸린 경보가 없다
  const h = m.jwAlertBox();
  T('경보가 없으면 붉지 않다', !/wxbox warn/.test(h), h.slice(0,120));
  T('★★ 이 해역에는 없다고 말한다', h.indexOf('이 해역에 발효 중인 일본 해상경보 없음') > 0, h);
  T('★★ 다른 해역에 걸린 것이 몇인지 알려 준다', h.indexOf('다른 해역 3구역') > 0, h);
  T('출처를 뺄 수 없다', h.indexOf('気象庁') > 0, h);
  T('경보가 없으면 알림 셈도 비어 있다', m.jwKeyOf(W) === '', m.jwKeyOf(W));
}
{
  // ★★★ 못 받았을 때 — 「경보 없음」 이라고 하면 그 말을 믿고 바다에 나간다
  const m = make(ctxOf({ jwCache: { ok:false, why:'HTTP 503' } }));
  const h = m.jwAlertBox();
  T('★★★ 못 받았으면 못 받았다고 말한다', h.indexOf('못 받았습니다') > 0, h);
  T('★★★ 못 받았을 때 「경보 없음」 이라고 하지 않는다', h.indexOf('경보 없음') < 0, h);
  T('★★★ 못 받았을 때도 출처를 적는다', h.indexOf('気象庁') > 0, h);
  T('★★★ 못 받았을 때도 気象庁 자리로 가는 길을 준다',
    h.indexOf('https://www.jma.go.jp/bosai/seawarning/') > 0, h);
}
{
  const m = make(ctxOf({ jwCache: null }));
  T('아직 못 받았을 때도 「없음」 이라고 안 한다',
    m.jwAlertBox().indexOf('경보 없음') < 0, m.jwAlertBox());
}

// ══ 5. 앱에 제대로 이어 붙었나 ══════════════════════════════════
{
  const wa = grab(src, 'wxAlertBox') || '';
  T('★★★ 특보 칸이 일본 것을 먼저 본다 (문 하나)',
    wa.indexOf('jwAlertBox()') > 0 && wa.indexOf('myWarnings()') > wa.indexOf('jwAlertBox()'), wa.slice(0,300));
  const rw = grab(src, 'renderWeather') || '';
  T('★★ 날씨 화면이 일본 자료를 받아 둔다',
    rw.indexOf('loadSeaJP()') > 0 && rw.indexOf('loadJW(') > 0, rw.slice(0,600));
  T('★★ 한국 해역 안이면 일본 자료를 안 부른다',
    rw.indexOf('boatOutsideKR()') > 0 && rw.indexOf('boatOutsideKR()') < rw.indexOf('loadSeaJP()'), rw.slice(0,600));
  const wk = grab(src, 'wxKeyOf') || '';
  T('★★★ 알림 셈에 일본 것이 들어간다', wk.indexOf('jwKeyOf(') > 0, wk);
  // ★★★ 어느 나라 것을 셀지는 화면과 같은 문에서 갈려야 한다.
  //   따로 가르면 일본 바다에 있는 배에 한국 특보로 점이 켜진다.
  T('★★★ 알림 셈도 화면과 같은 문(seaMine)에서 갈린다',
    wk.indexOf('seaMine()') > 0 && wk.indexOf('seaMine()') < wk.indexOf('SEA_ZONE'), wk);
  const cb = grab(src, 'checkNewsBadge') || '';
  T('★★ 점 세는 자리도 일본 자료를 받아 둔다', cb.indexOf('loadJW(') > 0, cb.slice(0,600));
  // ★★★ 앱에 이미 있는 이름과 부딪히면 나중 것이 먼저 것을 덮어쓴다.
  //   실제로 seaName(위도,경도) 를 덮어써서 한국 해역 이름 자리에 숫자가 나올 뻔했다.
  const 새이름 = ['jwSeaName','jwLine','jwAlertBox','jwMineZones','jwKeyOf','seaAt','seaMine','inRing','loadJW','loadSeaJP'];
  새이름.forEach(n => {
    const c = (src.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
    T('★★★ 이름이 겹치지 않는다 — ' + n, c === 1, c);
  });
  T('★★ 자료는 우리 자리에서 받는다',
    /DATA_BASE \+ 'warn-jp\.json/.test(src) && /DATA_BASE \+ 'sea-jp\.json'/.test(src));
}

console.log(`jwtest: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
