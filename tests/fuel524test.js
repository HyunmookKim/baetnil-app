// 5.24 — 기록이 빠져도 잔량이 맞게 · 입항 단추가 엔진 시간을 넣는다 · 빈 항해 채우기 · 며칠짜리 항해 · 연료 게이지
//
// ★ 사장님 말씀 (2026-09-30)
//   「만탱크 채우고 시간당 3리터로 해서 운행했는데 40시간인가 남았다고 나오는데 실제로는 0리터 남아서
//    0리터로 고치고 다시 100리터 넣었는데 왜 계속 3리터로 계산되냐 ㅈㄴ 심각한 문제네」
//   「도착 버튼에서 바로 이제 엔진 시간이랑 … 항해 시간이 자동으로 들어가야 되지 않나?」
//   「엔진 시간이 빈 지난 항해는 … 이번에 업데이트 할 때 예비 다 자동으로 채워 주기 하면 되잖아.
//    그거 해서 뭐 오류가 난다든지? 뭐가 잘못되는 그러한 경우는 없겠냐?」
//   「만들어라」
//
// ★ 말로 「있다」 만 보지 않는다. 함수를 뽑아 값을 넣고 답을 잰다.
//   사장님 백업(2026-09-30)과 같은 모양의 기록으로도 돌린다(tests/fuel524-sample.json).
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(typeof w === 'string' ? w : JSON.stringify(w)).slice(0, 300) : '')); } };

function grab(name){
  const re = new RegExp('(^|\\n)(async )?function ' + name + '\\(');
  const m = re.exec(src); if(!m) return '';
  let i = m.index + m[1].length, j = src.indexOf('{', i), d = 0;
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } } }
  return src.slice(i, j);
}
function grabConst(name){
  const i = src.indexOf('\nconst ' + name + ' '); if(i < 0) return '';
  const re = /;[ \t]*(\/\/[^\n]*)?\n/g; re.lastIndex = i; const m = re.exec(src);
  return src.slice(i + 1, m.index + 1);
}
const FNS = ['hm','hhmmToH','tsOf','logEngine','voyOutMs','voyInMs','voyMultiDay','voyLogMs','sailHours',
  'engineHoursFromLogs','engineHoursMultiDay','voyInAt','engineHours','fuelAt','fuelUses','fuelHoursIn','fuelLegacyAt',
  'fuelEvents','fuelSplit','fuelModel','fuelRate','fuelLeft','fuelSet','fuelSetPut','fuelLphSet','fuelMarkRaw','fuelMark',
  'fuelHow','fuelHowSet','fuelLevelAdd','fuelEditLeft','fuelClearMark','fmtNumF','fuelSinceFull','fuelHoursLeft',
  'voyTrkSpanH','voyHoursFill','fuelMarkAt'];
const CONSTS = ['SAIL_ENGINE','round1','voyDay','fuelKey','FUEL_IDLE','FUEL_RECENT','FUEL_GAUGE','fuelGaugeShow'];
const miss = FNS.filter(f => !grab(f)).concat(CONSTS.filter(c => !grabConst(c)));
T('5.24 문들이 다 있다', miss.length === 0, miss);
if(miss.length){ console.log('\n통과 ' + pass + ' / 실패 ' + fail); process.exit(1); }
const CODE = CONSTS.map(grabConst).join('\n') + '\n' + FNS.map(grab).join('\n');

function A(o){
  o = o || {};
  const E = { boat: o.boat || { spec: { fuelTank: o.tank === undefined ? 240 : o.tank }, fuelSet: o.fuelSet },
              voyage: o.voyage || [], runs: o.runs || [], fuel: o.fuel || [], unlocked: o.unlocked !== false,
              perm: o.perm !== false, told: [], forms: [], saved: 0, trash: [], today: o.today || '2026-09-30' };
  const mk = new Function('E', `
    let voyage = E.voyage, runs = E.runs, fuel = E.fuel, mrTrash = E.trash;
    const unlocked = E.unlocked;
    const permOk = k => E.perm;
    const boatSpec = k => (E.boat.spec || {})[k];
    const curBoat = () => E.boat;
    const save = () => { E.saved++; }; const saveMR = () => { E.saved++; };
    const renderFuel = () => {}; const renderVoyage = () => {};
    const t = s => s; const tsub = (s, ob) => String(s).replace(/\\{(\\w+)\\}/g, (_, k) => ob[k]);
    const tell = m => { E.told.push(m); };
    const setTimeout = f => f();
    const today = () => E.today;
    const nowHM = () => E.nowHM || '12:00';
    let _n = 0; const newId = () => String(1790000000000 + (++_n)) + '-x';
    const formErr = (k, m) => { E.err = m; return false; };
    const needEdit = (why, go) => go();
    const openForm = c => { E.form = c; E.forms.push(c); };
    const fmtNum = n => String(Math.round(n * 10) / 10);
    const runOn = r => !!(r && r.on);
    const runMins = r => null;
    ${CODE}
    return { fuelModel, fuelRate, fuelLeft, fuelMark, fuelHoursLeft, fuelSinceFull, voyHoursFill, fuelMarkAt,
             engineHours, fuelEditLeft, fuelClearMark, fuelHowSet, fuelHow, sailHours, engineHoursFromLogs, voyInAt,
             fuelSetPut };
  `);
  const R = mk(E); R.E = E; return R;
}
const at = (d, tm) => new Date(d + 'T' + tm + ':00').getTime();

// ══ 1. 「0 으로 고쳐도 계속 3리터」 — 잔량 확인이 소비율을 다시 잰다 ═══════════
{
  // 8월에 짧게 잰 두 구간(2.8·3.2) → 앱은 3.0.  그 뒤 만탱크에서 40시간 돌리고 「0」 확인.
  const base = {
    fuel: [ { id:'1', date:'2026-08-07', liters:10, full:true },
            { id:'2', date:'2026-08-10', liters:8,  full:true },
            { id:'3', date:'2026-08-17', liters:15, full:true } ],
    voyage: [ { id:'v1', date:'2026-08-09', timeOut:'07:00', timeIn:'10:00', engineH:2.9, hours:3 },
              { id:'v2', date:'2026-08-12', timeOut:'10:00', timeIn:'15:00', engineH:4.7, hours:5 },
              { id:'v3', date:'2026-09-01', timeOut:'10:00', timeIn:'20:00', engineH:40, hours:10 } ]
  };
  const B = A(base);
  T('★ 확인 전에는 옛 셈과 같이 3.0 근처다', Math.abs(B.fuelRate().avg - 23 / 7.6) < 0.01, B.fuelRate());
  const C = A(Object.assign({}, base, { fuel: base.fuel.concat([
    { id:'4', kind:'level', date:'2026-09-30', time:'15:00', level:0 } ]) }));
  const r = C.fuelRate();
  T('★★★ 「잔량 0」 을 적으면 소비율을 다시 잰다 (240L ÷ 40h 가 들어간다)', r && r.avg > 5, r);
  T('★★★ 최근 구간들의 「쓴 기름 합 ÷ 시간 합」 이다 ((8+15+240) ÷ (2.9+4.7+40))',
    r && Math.abs(r.avg - 263 / 47.6) < 0.01, r);
  T('★★★ 더 갈 수 있는 시간은 가장 많이 쓴 최근 구간으로 셈한다 (6.0)', r && Math.abs(r.safe - 6) < 0.01, r);
  const L = C.fuelLeft();
  T('★★★ 잔량은 확인한 값에서 시작한다 (0)', L && L.left === 0 && L.fromKind === 'level' && L.mine === true, L);
  // 확인 뒤 100L 넣고 2시간
  const D = A(Object.assign({}, base, {
    fuel: base.fuel.concat([ { id:'4', kind:'level', date:'2026-09-20', time:'15:00', level:0 },
                             { id:'5', date:'2026-09-20', time:'15:30', liters:100 } ]),
    runs: [ { id:'r', date:'2026-09-20', time:'16:00', endTime:'18:00', hours:2, purpose:'충전' } ] }));
  const L2 = D.fuelLeft(), r2 = D.fuelRate();
  T('★★★ 확인 뒤 넣은 기름을 더하고, 돌린 만큼 새 소비율로 뺀다', L2 && Math.abs(L2.left - (100 - 2 * r2.avg)) < 0.01, { L2, r2 });
  T('★★★ 더 갈 수 있는 시간 = 잔량 ÷ 안전한 소비율', Math.abs(D.fuelHoursLeft() - L2.left / r2.safe) < 0.001);
  // 어긋나면 알린다 — 앱이 보던 값과 실제
  const M = C.fuelModel(), s = M.segs[M.segs.length - 1];
  T('★★★ 확인한 때 앱이 보던 양(예상)과 실제를 견준다', s.pred != null && s.before === 0 && s.pred > 100, s);
}

// ══ 2. 적은 양으로 잰 짧은 구간이 큰 무게를 갖지 않는다 ═══════════════════
{
  const B = A({
    fuel: [ { id:'1', date:'2026-01-01', liters:100, full:true },
            { id:'2', date:'2026-01-10', liters:2,   full:true },     // 1시간에 2L (짧다)
            { id:'3', date:'2026-03-01', liters:200, full:true } ],   // 40시간에 200L
    runs: [ { id:'a', date:'2026-01-05', hours:1 }, { id:'b', date:'2026-02-01', hours:40 } ]
  });
  T('★★★ 구간마다 평균(3.5)이 아니라 합 ÷ 합(202/41)이다', Math.abs(B.fuelRate().avg - 202 / 41) < 0.001, B.fuelRate());
  // 최근 셋만 본다
  const f = [], rn = [];
  for(let i = 0; i < 6; i++){
    f.push({ id:'f' + i, date:'2026-0' + (i + 1) + '-01', liters: i < 3 ? 10 : 50, full:true });
    if(i > 0) rn.push({ id:'r' + i, date:'2026-0' + (i + 1) + '-01', time:'00:00', hours:10 });
  }
  // 각 구간 10시간, 앞 둘 10L·10L, 뒤 셋 50L — 최근 셋이면 5.0
  const C = A({ fuel: f.map(x => Object.assign({}, x, { time:'12:00' })), runs: rn.map(x => Object.assign({}, x, { time:'06:00' })) });
  T('★★ 최근 구간 셋만 본다 (옛 값이 오래 끌지 않는다)', Math.abs(C.fuelRate().avg - 5) < 0.001 && C.fuelRate().n === 3, C.fuelRate());
}

// ══ 3. 충전(공회전)과 항해를 따로 잰다 — 모자라면 하나로 ═════════════════
{
  // 항해 5 L/h, 충전 1 L/h 로 만든 구간 넷
  const plan = [ [10, 2], [4, 6], [8, 1], [2, 5] ];
  const f = [ { id:'f0', date:'2026-01-01', time:'00:00', liters:50, full:true } ], rn = [];
  plan.forEach(([u, i], k) => {
    const d = '2026-0' + (k + 2) + '-01';
    rn.push({ id:'u' + k, date: d, time:'01:00', hours: u, purpose:'항해' });
    rn.push({ id:'i' + k, date: d, time:'15:00', hours: i, purpose:'충전' });
    f.push({ id:'f' + (k + 1), date:'2026-0' + (k + 2) + '-10', time:'00:00', liters: u * 5 + i * 1, full:true });
  });
  const B = A({ fuel: f, runs: rn });
  const sp = B.fuelRate().split;
  T('★★★ 쌓이면 항해·충전을 따로 잰다 (5.0 · 1.0)', sp && Math.abs(sp.voy - 5) < 0.01 && Math.abs(sp.idle - 1) < 0.01, sp);
  const C = A({ fuel: f.slice(0, 3), runs: rn.slice(0, 4) });
  T('★★ 구간이 모자라면 가르지 않는다', !C.fuelRate().split, C.fuelRate());
  // 이어서 충전만 3시간 돌리면 3L 만 뺀다
  const D = A({ fuel: f, runs: rn.concat([ { id:'z', date:'2026-06-01', time:'10:00', hours:3, purpose:'충전' } ]) });
  T('★★★ 충전으로 돌린 것은 충전 소비율로 뺀다 (240 − 3)', Math.abs(D.fuelLeft().left - 237) < 0.05, D.fuelLeft());
}

// ══ 4. 「지금 잔량」 은 기록으로 쌓인다 · 오늘 넣은 기름을 밝힌다 · 게이지 ═════════
{
  const B = A({ fuel: [ { id:'1', date:'2026-09-30', time:'09:00', liters:100 } ], nowHM:'10:00' });
  B.fuelEditLeft();
  T('★★★ 오늘 넣은 기름까지 합친 양을 적으라고 밝힌다', /09:00에 주유하신 100L를 포함한/.test(B.E.form.sub)  /* 5.30 — 문구 바뀜 */, B.E.form.sub);
  B.E.form.onOk({ left:'150' });
  const lv = B.E.fuel.filter(f => f.kind === 'level');
  T('★★★ 잔량 확인이 연료 기록에 쌓인다 (배 설정 하나를 덮지 않는다)', lv.length === 1 && lv[0].level === 150, B.E.fuel);
  T('★★ 옛 곳(배 설정 mark)에는 안 쓴다', !(B.E.boat.fuelSet && B.E.boat.fuelSet.mark));
  B.fuelClearMark();
  T('★★★ 「앱이 셈한 값으로」 는 그 확인을 휴지통으로 보낸다 (되돌릴 수 있다)',
    B.E.fuel.filter(f => f.kind === 'level').length === 0 && B.E.trash.length === 1 && B.E.trash[0].id === 'fuel_' + lv[0].id, B.E.trash);
  // 게이지
  const G = A({ fuelSet: { how: 'gauge' } });
  T('★★ 배마다 잔량 확인 방법을 고른다 — 연료 게이지', G.fuelHow() === 'gauge');
  G.fuelEditLeft();
  const 칸 = G.E.form.fields.find(x => x.key === 'g');
  T('★★★ 게이지면 눈금 다섯(E·¼·½·¾·F)을 누르게 한다', 칸 && 칸.type === 'pick' && 칸.options.length === 5
    && 칸.options.map(o => o.name).join('') === 'E¼½¾F', 칸);
  G.E.form.onOk({ g:'3/4', left:'' });
  const g = G.E.fuel.find(f => f.kind === 'level');
  T('★★★ 눈금을 누르면 탱크의 그만큼으로 적는다 (¾ × 240 = 180)', g && g.level === 180 && g.gauge === '3/4', g);
  G.fuelHowSet('est');
  T('★★ 앱 추정으로 되돌릴 수 있다', G.fuelHow() === 'est');
}

// ══ 5. 옛 「지금 잔량」 (4.98~5.23) 을 버리지 않는다 — 사장님 9/30 기록 ═══════════
{
  // 사장님 기록 모양: 9/30 15:30 충전 시작(끝 16:22, 0.87h) · 15:35 100L · 「0」 을 적었을 때 총 43.85h
  const o = {
    fuelSet: { mark: { left: 0, hours: 43.846666666666664, date: '2026-09-30' } },
    fuel: [ { id:'1', date:'2026-08-17', liters:15, full:true },
            { id:'1790750158432-9', date:'2026-09-30', time:'15:35', liters:'100' } ],
    voyage: [ { id:'a', date:'2026-08-20', timeOut:'10:00', timeIn:'20:00', engineH: 42.98, hours: 10 },
              // 입항 단추로 도착해 엔진 시간이 빈 항해
              { id:'b', date:'2026-09-29', timeOut:'12:30', timeIn:'14:32', engineH:'', hours:'' } ],
    runs: [ { id:'r0', date:'2026-09-08', time:'15:17', hours:0.5, purpose:'충전' },
            { id:'r1', date:'2026-09-30', time:'15:30', endDate:'2026-09-30', endTime:'16:22', hours:0.87, purpose:'충전' } ]
  };
  const B = A(o);
  const M0 = B.fuelModel(at('2026-09-30', '17:00'));
  const lv = M0.last;
  T('★★★ 옛 잔량의 때를 되살린다 — 그날 첫 주유(15:35)보다 앞', lv && lv.kind === 'level' && lv.legacy && lv.ms <= at('2026-09-30', '15:34'), lv);
  T('★★★ 그래서 0L 확인 뒤 넣은 100L 가 더해진다 (옛 셈과 같다)', M0.left && M0.left.left > 90 && M0.left.left <= 100, M0.left);
  T('★★ 박기 전에는 at 이 없다', B.E.boat.fuelSet.mark.at == null);
  T('★★★ fuelMarkAt 이 그 때를 배 설정에 박는다', B.fuelMarkAt() === true && B.E.boat.fuelSet.mark.at === lv.ms, B.E.boat.fuelSet.mark);
  T('★★ 두 번째는 손대지 않는다', B.fuelMarkAt() === false);
  // 빈 항해를 채운 뒤에도 옛 잔량의 때가 안 움직인다
  T('★★★ 빈 항해를 채운다', B.voyHoursFill() === true && B.E.voyage[1].engineH === 2 && B.E.voyage[1].hours === 2, B.E.voyage[1]);
  const M1 = B.fuelModel(at('2026-09-30', '17:00'));
  T('★★★ 채운 뒤에도 옛 잔량의 때는 그대로다 (채운 시간이 「0 을 적은 뒤」 로 안 셈해진다)',
    M1.last.ms === lv.ms && Math.abs(M1.left.since - M0.left.since) < 0.001, { before: M0.left.since, after: M1.left.since });
  T('★★★ 채운 시간은 소비율에 들어간다 (구간 시간이 늘었다)',
    M1.segs[M1.segs.length - 1].h > M0.segs[M0.segs.length - 1].h + 1.9, M1.segs.map(s => s.h));
  // 사보타주 — 박지 않고 채우면 틀어지는 것을 이 검사가 잡는가
  const X = A(JSON.parse(JSON.stringify(o)));
  X.voyHoursFill();
  const MX = X.fuelModel(at('2026-09-30', '17:00'));
  T('★★ (확인) 박지 않고 먼저 채우면 옛 잔량의 때가 틀어진다 — 그래서 차례가 중요하다',
    MX.last.ms !== lv.ms, { X: MX.last.ms, ok: lv.ms });
}

// ══ 6. 빈 항해 채우기 — 막는 다섯 가지 ═══════════════════════════════
{
  const V = () => [
    { id:'ok',   date:'2026-09-12', timeOut:'10:35', timeIn:'12:47', engineH:'', hours:'' },
    { id:'sail', date:'2026-09-26', timeOut:'15:51', timeIn:'17:33', engineH:'', hours:'',
      logs:[ { id:'1', time:'16:13', kind:'세일 올림' }, { id:'2', time:'17:16', kind:'세일 내림' } ] },
    { id:'kept', date:'2026-09-13', timeOut:'12:40', timeIn:'14:20', engineH:'', hours: 1.7 },    // 일부러 비운 것
    { id:'typed',date:'2026-09-14', timeOut:'15:45', timeIn:'17:15', engineH: 1.5, hours:'' },
    { id:'plan', date:'2026-10-02', timeOut:'17:30', timeIn:'', engineH:'', hours:'', plan:true },
    { id:'open', date:'2026-09-30', timeOut:'10:00', timeIn:'', engineH:'', hours:'' },
    { id:'long', date:'2026-09-01', timeOut:'08:00', timeIn:'14:00', engineH:'', hours:'',
      trk:[ { t:'2026-09-01T08:00:00+09:00' }, { t:'2026-09-02T12:00:00+09:00' }, { t:'2026-09-03T14:00:00+09:00' } ] },
    { id:'seed', date:'2026-08-01', timeOut:'10:00', timeIn:'11:00', engineH:'', hours:'', seed:true }
  ];
  const B = A({ voyage: V() });
  T('★★★ 채운다', B.voyHoursFill() === true);
  const g = id => B.E.voyage.find(v => v.id === id);
  T('★★★ 입항 단추 흔적(항해·엔진 둘 다 빈 것)을 채운다', g('ok').hours === 2.2 && g('ok').engineH === 2.2, g('ok'));
  T('★★★ 세일 올림·내림은 뺀다 (1.7h 가운데 엔진 0.7h)', g('sail').hours === 1.7 && g('sail').engineH === 0.7, g('sail'));
  T('★★★ 항해 시간이 적혀 있으면 일부러 비운 것 — 안 건드린다', g('kept').engineH === '', g('kept'));
  T('★★ 엔진 시간을 적은 것은 안 건드린다', g('typed').engineH === 1.5 && g('typed').hours === '', g('typed'));
  T('★★★ 예정 항해는 안 건드린다', g('plan').engineH === '', g('plan'));
  T('★★★ 도착을 안 찍은 항해는 안 건드린다', g('open').engineH === '', g('open'));
  T('★★★ 항적이 하루를 넘겼는데 도착 날짜가 없으면 건너뛴다 (6시간으로 틀리게 채우지 않는다)', g('long').engineH === '', g('long'));
  T('★★ 보기 예(seed)는 안 건드린다', g('seed').engineH === '', g('seed'));
  T('★★★ 채웠으면 사람에게 몇 개인지 말한다', B.E.told.some(m => /항해 2개를/.test(m)), B.E.told);
  T('★★★ 두 번째는 할 일이 없다 (같은 것을 또 안 고친다)', B.voyHoursFill() === false);
  const L = A({ voyage: V(), unlocked: false });
  T('★★★ 편집 중이 아니면(보기 전용) 안 채운다', L.voyHoursFill() === false && L.E.voyage[0].engineH === '');
  const P = A({ voyage: V(), perm: false });
  T('★★★ 항해일지를 적을 권한이 없으면 안 채운다', P.voyHoursFill() === false && P.E.voyage[0].engineH === '');
}

// ══ 7. 며칠짜리 항해 — 도착 날짜 ═════════════════════════════════════
{
  const B = A();
  const v = { date:'2026-10-01', dateIn:'2026-10-03', timeOut:'08:00', timeIn:'14:00',
              logs:[ { id:String(new Date('2026-10-01T20:00:00').getTime()) + '-a', time:'20:00', kind:'세일 올림' },
                     { id:String(new Date('2026-10-02T06:00:00').getTime()) + '-b', time:'06:00', kind:'세일 내림' },
                     { id:String(new Date('2026-10-02T07:00:00').getTime()) + '-c', time:'07:00', kind:'세일 올림' },
                     { id:String(new Date('2026-10-03T12:00:00').getTime()) + '-d', time:'12:00', kind:'세일 내림' } ] };
  T('★★★ 항해 시간이 이틀을 넘게 센다 (54시간)', B.sailHours(v) === 54, B.sailHours(v));
  T('★★★ 엔진 시간도 날짜로 센다 (첫날 12h + 둘째 날 1h + 셋째 날 2h = 15h)', B.engineHoursFromLogs(v) === 15, B.engineHoursFromLogs(v));
  T('★★★ 도착 때(voyInAt)가 셋째 날이다 — 둘째 날 항적을 「도착 뒤」 로 안 지운다',
    B.voyInAt(v) === new Date('2026-10-03T14:00:00').getTime(), B.voyInAt(v));
  const one = { date:'2026-10-01', timeOut:'22:00', timeIn:'02:00' };
  T('★★ 도착 날짜가 없으면 예전처럼 하루 안으로 본다', B.sailHours(one) === 4 && B.voyInAt(one) === new Date('2026-10-02T02:00:00').getTime());
  T('★★ 도착 날짜가 출발과 같으면 하루짜리 셈 그대로', B.sailHours(Object.assign({}, one, { dateIn:'2026-10-01' })) === 4);
  // 연료 셈도 도착 날짜를 따른다
  const C = A({ fuel: [ { id:'1', date:'2026-10-01', time:'00:00', liters:10, full:true },
                        { id:'2', date:'2026-10-02', time:'12:00', liters:10, full:true } ],
                voyage: [ Object.assign({}, v, { engineH: 54 }) ] });
  const s = C.fuelModel().segs[0];
  T('★★★ 사흘짜리 항해의 엔진 시간은 그 사이에 고르게 나뉜다 (둘째 날 정오까지 28h)', s && Math.abs(s.h - 28) < 0.01, s);
}

// ══ 8. 화면·흐름에 실제로 붙어 있나 ═══════════════════════════════════
{
  const an = grab('arriveNow');
  T('★★★ 「지금 도착」 이 도착 날짜를 넣는다', /it\.dateIn = today\(\)/.test(an), an);
  T('★★★ 「지금 도착」 이 항해 시간·엔진 시간을 넣는다',
    /const sh = sailHours\(it\); if\(sh !== null\) it\.hours = sh;/.test(an)
    && /const eh = engineHoursFromLogs\(it\); if\(eh !== null\) it\.engineH = eh;/.test(an), an);
  T('★★★ 넣은 것을 사람에게 말한다', /항해 \{a\} · 엔진 \{b\}을 입력했습니다/.test(an));  // 5.30 — 문구 바뀜
  T('★★★ 셈은 저장보다 먼저다', an.indexOf('it.engineH = eh') < an.indexOf('saveMR()'), an);
  const fx = src.slice(src.indexOf('const FORMAT_FIXERS = ['), src.indexOf('];', src.indexOf('const FORMAT_FIXERS = [')));
  T('★★★ 받아온 뒤 고치는 문에 두 문이 들어 있다', /fuelMarkAt/.test(fx) && /voyHoursFill/.test(fx), fx);
  T('★★★ 차례 — 옛 잔량의 때를 먼저 박고 그 뒤에 채운다', fx.indexOf('fuelMarkAt') < fx.indexOf('voyHoursFill'), fx);
  T('★★★ 도착 날짜는 밖에 내보내는 칸에 들어 있다 (PUB_OUT)', /plain: \['id','date',[^\]]*'dateIn'\]/.test(src));
  const lr = grab('legRow');
  T('★★★ 도착 칸에 날짜가 있다', /voyDateIn\(this\.value\)/.test(lr), lr);
  T('★★★ 출항·입항 칸에 게이지 눈금 줄이 붙는다', /voyGaugeRow\(it, kind\)/.test(lr));
  T('★★ 게이지 눈금은 게이지를 고른 배에서만 보인다', /fuelHow\(\) !== 'gauge'/.test(grab('voyGaugeRow')));
  const rf = grab('renderFuel');
  T('★★★ 잔량 확인 방법을 고르는 줄이 연료 화면에 있다', /fuelHowSet\('est'\)/.test(rf) && /fuelHowSet\('gauge'\)/.test(rf));
  T('★★★ 어긋나면 알린다 (앱이 보던 양과 실제)', /추정 잔량은 \{p\}L, 실제 잔량은/.test(rf));  // 5.30 — 문구 바뀜
  T('★★★ 엔진 시간이 빈 항해가 있으면 함께 알린다', /엔진 시간이 입력되지 않은 항해가 \{n\}개/.test(rf));  // 5.30 — 문구 바뀜
  T('★★ 잔량 확인이 목록에 보인다', /x\.o\.kind==='level'/.test(rf));
  T('★★★ 실제가 더 많았으면(넣은 기록 없이 늘었다) 「다시 셈했습니다」 라고 하지 않는다',
    /끝\.lph != null/.test(rf) && /주유 기록이 누락되었을 수 있습니다/.test(rf));  // 5.30 — 문구 바뀜
  T('★★★ 확인 뒤 넣은 기름을 잔량 설명에 밝힌다', /이후 주유량 \{a\}L를 더하고/.test(rf));  // 5.30 — 문구 바뀜
  T('★★★ 홈의 연료 칸도 잔량 확인에서 시작하면 그렇게 말한다', /잔량 확인 후 \{h\} 가동/.test(src));  // 5.30 — 문구 바뀜
  const cb = grab('createBoat');
  T('★★★ 5.25 — 새 배의 잔량 확인 방법은 연료 게이지다 (사장님: 「더 정확한 방식으로」)', /fuelSet: \{ how: 'gauge' \}/.test(cb), cb.slice(0, 900));
  T('★★★ 혼자 쓰는 배(명부 없음)는 받아올 것이 없으니 바로 채운다', /fuelMarkAt\(\), c = voyHoursFill\(\)/.test(grab('migrateVoyage')));
}

// ══ 9. 새 말이 네 나라 말에 다 있다 ═══════════════════════════════════
{
  const 새말 = ['항해 {a} · 엔진 {b}을 입력했습니다. 다르면 아래 칸에서 수정해 주세요.','도착 날짜가 출발 날짜보다 앞입니다.',
    '연료 게이지','잔량 확인 방법','앱 추정','만탱크 주유','잔량 확인','남은 양','잔량 {L} L',
    '{d} {what} 때 추정 잔량은 {p}L, 실제 잔량은 {a}L였습니다. 이 차이를 반영해 연료 소비량을 다시 계산했습니다.',   // 5.30 — 문구 바뀜
    '그 사이에 엔진 시간이 입력되지 않은 항해가 {n}개 있습니다. 항해일지에서 입력해 주세요.',
    '엔진 시간이 입력되지 않은 항해 {n}개를 출발·도착 시각으로 채웠습니다.','{d} 잔량 확인 후 {h} 가동',
    '오늘 {t}에 주유하신 {L}L를 포함한 현재 잔량을 입력해 주세요.'];
  ['en','ru','ja'].forEach(lg => {
    const i = src.indexOf('\n  ' + lg + ': {');
    const j = src.indexOf('\n  },', i);
    const d = src.slice(i, j);
    const 없음 = 새말.filter(k => d.indexOf("'" + k + "'") < 0);
    T(lg + ' 에 새 말이 다 있다', 없음.length === 0, 없음);
  });
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
