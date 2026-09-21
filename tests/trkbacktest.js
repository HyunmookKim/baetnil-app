// 4.99 — 나갔다가 그대로 되돌아온 점 골라내기
//
// ★ 사장님 지적 (2026-09-02): "항적은 많이 좋아졌는데 아직도 하나 이상하게 찍힌거 있네"
//   여수 항적에서 서쪽으로 길게 뻗었다 **그대로 되돌아오는** 선 하나가 남아 있었다.
//
// ★ 왜 여태 안 걸렸나 — 다듬기가 **속도로만** 걸렀다.
//   점 사이 시간이 넓으면 500m 를 튀어도 16노트라 20노트 한도를 통과한다.
//
// ★★★ 이 검사에서 제일 중요한 것 — **진짜 태킹을 지우면 안 된다.**
//   요트는 맞바람에서 지그재그로 간다. 그것을 「튄 점」 이라고 지워 버리면
//   앱이 사람의 항해를 지우는 것이다. 사장님이 정하신 것 0번을 정면으로 어긴다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,240):'')); } };
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) i = s.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}
const CONST = k => (src.match(new RegExp('const ' + k + '\\s*=\\s*([\\d.]+);')) || [])[1];

// ── 실제로 돌려 본다
const F = new Function(`
  const hav = (la1, lo1, la2, lo2) => {           // km
    const R = 6371, r = Math.PI/180;
    const x = (lo2-lo1)*r*Math.cos((la1+la2)/2*r), y = (la2-la1)*r;
    return Math.sqrt(x*x+y*y)*R;
  };
  const TRK_MAXKT = ${CONST('TRK_MAXKT')};
  const TRK_LOST  = ${CONST('TRK_LOST')};
  const TRK_BACK_R = ${CONST('TRK_BACK_R')};
  const TRK_BACK_M = ${CONST('TRK_BACK_M')};
  ${grab(src, 'trkTooFast')}
  ${grab(src, 'trkBackTrack')}
  ${grab(src, 'trkClean1')}
  ${grab(src, 'trkClean')}
  return { trkBackTrack, trkClean, TRK_BACK_R, TRK_BACK_M };`)();

// 여수 앞바다 근처. m 를 도로 바꿔 점을 놓는다
const LA0 = 34.727, LO0 = 127.68;
const M = 1 / 111320;                                   // 위도 1m
const MO = 1 / (111320 * Math.cos(LA0 * Math.PI / 180)); // 경도 1m
const P = (dx, dy, sec) => ({ la: LA0 + dy * M, lo: LO0 + dx * MO,
                              t: new Date(Date.parse('2026-09-02T10:00:00Z') + sec * 1000).toISOString() });

// ══ 1. 값을 한 곳에서 정한다 ══════════════════════════════════════
{
  T('되돌아온 정도를 한 곳에서 정한다', !!CONST('TRK_BACK_R'));
  T('벗어난 거리도 한 곳에서 정한다', !!CONST('TRK_BACK_M'));
  T('★★★ 되돌아온 정도가 태킹을 안 건드릴 만큼 낮다 (' + CONST('TRK_BACK_R') + ')',
    Number(CONST('TRK_BACK_R')) <= 0.35,
    '맞바람 태킹은 90°쯤 꺾어 0.7 쯤 나온다. 0.35 를 넘기면 진짜 태킹이 지워진다');
  T('★★ 짧게 흔들린 것은 안 건드린다 (' + CONST('TRK_BACK_M') + 'm 이상만)',
    Number(CONST('TRK_BACK_M')) >= 50);
}

// ══ 2. 나갔다가 그대로 되돌아온 점을 잡는다 ═══════════════════════
{
  const B = F.trkBackTrack;
  // 500m 서쪽으로 갔다가 제자리로
  T('★★★ 500m 나갔다 제자리로 온 점을 잡는다',
    B(P(0,0,0), P(-500,0,60), P(10,0,120)) === true);
  T('★★★ 화면에서 본 그것 — 길게 뻗었다 그대로 되돌아온 선',
    B(P(0,0,0), P(-800,20,90), P(5,-5,180)) === true);
  T('★★ 앞뒤가 살짝 어긋나도 잡는다 (딱 제자리로 오지는 않는다)',
    B(P(0,0,0), P(-500,0,60), P(60,30,120)) === true);
}

// ══ 3. ★★★ 진짜 태킹은 절대 안 지운다 ═══════════════════════════
{
  const B = F.trkBackTrack;
  T('★★★ 맞바람 태킹(90°)은 안 지운다',
    B(P(0,0,0), P(300,300,60), P(600,0,120)) === false,
    '이걸 지우면 앱이 사람의 항해를 지우는 것이다');
  T('★★★ 좁게 꺾는 태킹(70°)도 안 지운다',
    B(P(0,0,0), P(300,420,60), P(600,0,120)) === false);
  T('★★★ 아주 좁게 꺾어도(50°) 안 지운다',
    B(P(0,0,0), P(250,530,60), P(500,0,120)) === false);
  T('★★ 곧게 가는 것은 당연히 안 지운다',
    B(P(0,0,0), P(300,0,60), P(600,0,120)) === false);
  T('★★★ 짧게 흔들린 것(30m)은 안 건드린다 — 그건 GPS 흔들림이다',
    B(P(0,0,0), P(-30,0,10), P(1,0,20)) === false);
  T('★★ 크게 도는 것(U턴 항로)도 점이 여럿이면 안 지운다',
    B(P(0,0,0), P(400,300,60), P(800,0,120)) === false);
}

// ══ 4. 항적 전체에서 그 점만 빠진다 ═══════════════════════════════
{
  // 곧게 가다가 한 점만 서쪽으로 600m 튀고 다시 제 길로
  const 항적 = [ P(0,0,0), P(100,0,60), P(200,0,120), P(-400,0,180),
                 P(300,0,240), P(400,0,300), P(500,0,360) ];
  const r = F.trkClean(항적);
  T('★★★ 튄 점 하나가 빠진다', r.dropped === 1, r);
  T('★★★ 되돌아온 것으로 셈한다 (속도가 아니라)', r.back === 1 && r.fast === 0, r);
  T('★★★ 나머지는 다 남는다', r.pts.length === 6, r.pts.length);
  T('★★★ 튄 점이 진짜로 없어졌다',
    !r.pts.some(p => p.lo < LO0 - 100 * MO), r.pts.map(p => Math.round((p.lo-LO0)/MO)));

  // ★★★ 태킹만 있는 항적은 한 점도 안 빠진다
  const 태킹 = [];
  for(let i = 0; i < 10; i++)
    태킹.push(P(i * 200, (i % 2 ? 1 : -1) * 200, i * 120));   // 지그재그, 한 칸 200m
  const r2 = F.trkClean(태킹);
  T('★★★ 태킹만 있는 항적에서는 한 점도 안 지운다', r2.dropped === 0, r2);

  // 처음과 끝은 지키는가
  // ★ 시간을 넉넉히 벌려 「속도로는 안 걸리는」 튐으로 만든다 — 그래야 끝점 규칙만 본다
  const 끝튐 = [ P(0,0,0), P(100,0,60), P(200,0,120), P(-600,0,600) ];
  const r3 = F.trkClean(끝튐);
  T('★★★ 마지막 점은 안 지운다 (항해가 어디서 끝났는지가 없어진다)',
    r3.pts[r3.pts.length-1].lo === 끝튐[3].lo, r3.pts.length);
  T('★★★ 첫 점도 안 지운다', r3.pts[0].lo === 끝튐[0].lo);
  // ★ 값으로만 보면, 나중에 「뒷점이 없을 때」 를 다르게 다루도록 고쳐도 안 잡힌다.
  //   끝점을 지키는 못이 코드에 박혀 있는지도 같이 본다.
  T('★★★ 뒷점이 없으면 아예 안 본다는 못이 박혀 있다',
    /i \+ 1 < a\.length && trkBackTrack\(/.test(grab(src, 'trkClean1') || ''), grab(src, 'trkClean1'));
  T('★★★ 셋 중 하나라도 없으면 안 본다',
    /if\(!a \|\| !b \|\| !c\) return false;/.test(grab(src, 'trkBackTrack') || ''), grab(src, 'trkBackTrack'));

  // 속도로 튄 것과 되돌아온 것이 같이 있으면 둘 다 센다
  // ★ 되돌아온 쪽은 시간을 넓게 벌려 속도로는 안 걸리게 한다 (실제 사장님 항적이 그랬다)
  const 섞임 = [ P(0,0,0), P(100,0,60), P(9000,0,62), P(200,0,120),
                 P(-500,0,600), P(300,0,1200), P(400,0,1260) ];
  const r4 = F.trkClean(섞임);
  T('★★ 속도로 튄 것도 그대로 잡는다', r4.fast >= 1, r4);
  T('★★ 되돌아온 것도 같이 잡는다', r4.back >= 1, r4);
  T('★★ 둘을 합친 수가 맞다', r4.dropped === r4.fast + r4.back, r4);

  // 점이 적으면 손대지 않는다
  T('★★ 점이 둘뿐이면 손대지 않는다', F.trkClean([P(0,0,0), P(-900,0,60)]).dropped === 0);
  T('★★ 빈 항적에도 안 터진다', F.trkClean([]).dropped === 0);
}

// ══ 5. ★★★ 앱이 알아서 다듬는다 — 사람이 누를 단추가 없다 ═══════════
//
// ★ 사장님 지적: "도대체 왜 항적다듬기 버튼이 있냐?
//                사용자는 어플 고치는 사람이 아니라고"
//   누를 줄 알아야 깨끗해지는 기록은 안 깨끗한 기록이다.
{
  // ★ 사전에 남은 낱말과 주석은 상관없다. **화면에 나가는 자리**가 있는지만 본다.
  // ★ 증거를 만들 때 `[^\n]*…[^\n]*` 를 쓰면 안 된다 — 이 파일에는 20만 자짜리 한 줄
  //   (끼워 넣은 편집기 꾸러미)이 있어서 되짚기가 폭발한다. 실제로 검사가 멎었다.
  T('★★★ 「튄 점 다듬기」 단추가 화면에 없다', !/t\('튄 점 다듬기'\)/.test(src),
    src.indexOf("t('튄 점 다듬기')"));
  T('★★★ 사람이 부르는 문(trkTidy)이 없다', !/function trkTidy\(/.test(src));
  T('★★★ 그 단추를 부르는 자리도 없다', !/onclick="trkTidy\(\)"/.test(src));

  // ★ 없앤 대신 **그릴 때 앱이 거른다**
  const tl = grab(src, 'trkLine') || '';
  T('★★★ 그릴 때 걸러서 그린다', /trkClean\(a\)\.pts/.test(tl), tl);
  T('★★★ 점이 셋 미만이면 그냥 둔다 (거를 것이 없다)',
    /a\.length > 2\) \? trkClean\(a\)\.pts : a/.test(tl), tl);
  // ★★★ 자료는 안 건드린다 — 화면에 그릴 때만 거른다 (사장님이 정하신 것 0번)
  T('★★★ 그리면서 저장된 자료를 안 고친다',
    !/it\.trk\s*=/.test(tl) && !/saveMR\(/.test(tl), tl);

  // ★ 실제로 돌려 본다 — 튄 점이 든 항적을 넣으면 그 점 없이 나오는가
  const F2 = new Function(`
    const hav = (la1, lo1, la2, lo2) => {
      const R = 6371, r = Math.PI/180;
      const x = (lo2-lo1)*r*Math.cos((la1+la2)/2*r), y = (la2-la1)*r;
      return Math.sqrt(x*x+y*y)*R;
    };
    const TRK_MAXKT = ${CONST('TRK_MAXKT')}, TRK_LOST = ${CONST('TRK_LOST')};
    const TRK_BACK_R = ${CONST('TRK_BACK_R')}, TRK_BACK_M = ${CONST('TRK_BACK_M')};
    // ★ 4.116 — 기록이 끊긴 데를 가리는 문이 trkLine 안에 들어왔다 (trkgaptest 가 따로 잰다)
    const TRK_GAP_S = ${CONST('TRK_GAP_S')}, TRK_GAP_M = ${CONST('TRK_GAP_M')};
    ${grab(src, 'trkGap')}
    let RAW = [];
    const trkRaw = () => RAW;
    ${grab(src, 'trkTooFast')}
    ${grab(src, 'trkBackTrack')}
    ${grab(src, 'trkClean1')}
    ${grab(src, 'trkClean')}
    ${tl}
    return { set: a => { RAW = a; }, trkLine };`)();
  const 원본 = [ P(0,0,0), P(100,0,60), P(200,0,120), P(-400,0,180),
                 P(300,0,240), P(400,0,300), P(500,0,360) ];
  F2.set(원본);
  const 선 = F2.trkLine({});
  T('★★★ 튄 점이 화면에 안 그려진다', 선.length === 6, 선.length);
  T('★★★ 튀었던 자리가 선에 없다',
    !선.some(p => p.lon < LO0 - 100 * MO), 선.map(p => Math.round((p.lon-LO0)/MO)));
  T('★★★ 저장된 자료는 그대로다 (일곱 점 그대로)', 원본.length === 7);
}

// ══ 5-2. 도착하면 항적이 거기서 끝난다 ═════════════════════════════
//
// ★ 사장님 지적: "왜 이게 집까지 따라와요?"
//   여수 앞바다에서 시내 도로를 타고 무선산까지 올라간 그 선이 이것이다.
{
  T('도착을 다루는 문이 하나 있다', !!grab(src, 'voyArrived'));
  T('문이 하나다', (src.match(/function voyArrived\(/g) || []).length === 1);
  const va = grab(src, 'voyArrived') || '';
  T('★★★ 이 항해의 항적이면 멈춘다', /trkNow\.vid\) === String\(it\.id\)[\s\S]{0,40}await trkStop\(\)/.test(va), va);
  T('★★★ 도착 뒤에 찍힌 점을 잘라낸다', /trkCutAfterIn\(it\)/.test(va), va);
  T('★★★ 잘랐으면 저장한다', /saveMR\(\)/.test(va), va);
  T('★★ 잘랐을 때만 말해 준다 (아무 일 없으면 조용하다)',
    /if\(잘림\)\{/.test(va), va);

  const F3 = new Function(`
    const hm = v => v;
    ${(src.match(/const VOY_IN_GRACE = [^;]+;/) || [''])[0]}
    ${grab(src, 'voyInAt')}
    ${grab(src, 'trkAfterIn')}
    ${grab(src, 'trkCutAfterIn')}
    return { voyInAt, trkAfterIn, trkCutAfterIn };`)();
  const 점 = (h, m2) => ({ la:34.7, lo:127.7, t: new Date('2026-09-02T' + h + ':' + m2 + ':00').toISOString() });
  const 항해 = { date:'2026-09-02', timeOut:'18:30', timeIn:'20:00',
    trk: [ 점('18','35'), 점('19','00'), 점('19','50'), 점('20','02'),
           점('20','30'), 점('21','10') ] };
  T('★★★ 도착 뒤 점을 센다 (20:30 · 21:10 두 개)', F3.trkAfterIn(항해) === 2, F3.trkAfterIn(항해));
  T('★★ 도착 직후 몇 분은 봐 준다 (20:02 는 안 센다)', F3.trkAfterIn(항해) === 2);
  const 잘림 = F3.trkCutAfterIn(항해);
  T('★★★ 그 둘만 잘라낸다', 잘림 === 2 && 항해.trk.length === 4, [잘림, 항해.trk.length]);
  T('★★★ 도착 전 점은 하나도 안 지운다',
    항해.trk.every(p => Date.parse(p.t) <= Date.parse('2026-09-02T20:05:00')), 항해.trk.map(p=>p.t));

  // 자정을 넘긴 항해
  const 밤 = { date:'2026-09-02', timeOut:'22:00', timeIn:'01:30',
    trk: [ 점('22','30'), 점('23','50') ] };
  T('★★★ 자정을 넘긴 항해도 안 잘린다 (도착이 다음 날이다)', F3.trkAfterIn(밤) === 0, F3.trkAfterIn(밤));

  // 도착 시각이 없으면 손대지 않는다
  T('★★★ 도착 시각이 없으면 아무것도 안 자른다',
    F3.trkAfterIn({ date:'2026-09-02', trk:[점('20','30')] }) === 0);
  T('★★ 항적이 없어도 안 터진다', F3.trkAfterIn({ date:'2026-09-02', timeIn:'20:00' }) === 0);

  // ★★★ 도착을 어떤 길로 찍든 여기로 모이는가 (문 하나)
  T('★★★ 「지금 도착」 이 이 문을 쓴다', /voyArrived\(it, true\)/.test(grab(src, 'arriveNow') || ''),
    grab(src, 'arriveNow'));
  T('★★★ 도착 시각을 손으로 적어도 이 문을 쓴다',
    /timeKey === 'timeIn'[\s\S]{0,120}voyArrived\(it\)/.test(grab(src, 'voyTime') || ''),
    grab(src, 'voyTime'));
  T('★★★ 도착 자리를 찍어도 이 문을 쓴다',
    /key === 'wxIn' && !quiet[\s\S]{0,60}voyArrived\(it\)/.test(grab(src, 'posHere') || ''),
    (grab(src, 'posHere') || '').slice(-700));
  T('★★★ 출발 자리를 찍을 때는 안 부른다 (그때 끝나면 안 된다)',
    !/key === 'wxOut'[\s\S]{0,60}voyArrived/.test(grab(src, 'posHere') || ''));
}

// ══ 6. 새로 쓴 말이 네 나라 말에 다 있다 ═══════════════════════════
{
  const 새말 = ['튄 점 {n}개를 찾았습니다 — {why}.\\n\\n{m}개만 남기고 지울까요?\\n\\n되돌리기로 되살릴 수 있습니다.',
    '배가 낼 수 없는 속도 {n}개', '나갔다가 그대로 되돌아온 자리 {n}개'];
  ['en','ru','ja'].forEach(lg=>{
    const i = src.indexOf('\n  ' + lg + ': {');
    const j = src.indexOf('\n  },', i);
    const d = src.slice(i, j);
    새말.forEach(k=>{
      T(lg + ' 에 「' + k.slice(0,22) + '」 이 있다',
        d.indexOf("'" + k.replace(/'/g, "\\'") + "'") >= 0 || d.indexOf('"' + k + '"') >= 0);
    });
  });
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
