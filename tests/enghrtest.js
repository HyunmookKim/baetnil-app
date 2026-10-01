// 4.93 — 정기점검을 달력과 엔진 시간, 먼저 오는 쪽으로
//
// ★ 배 정비의 절반은 달력이 아니라 엔진 시간으로 온다 (엔진오일·임펠러·발전기).
//   Vessel Vanguard · UpKeep · Fiix · MaintainX 전부 「둘 중 먼저 오는 것」을 갖는다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?' — '+JSON.stringify(w).slice(0,200):'')); } };

const from = src.indexOf('const engNow =');
const to   = src.indexOf('\n// ★ 장비는 maint 배열에 함께 산다');
T('시간 주기 코드가 있다', from > 0 && to > from);
const blk = src.slice(from, to);

const 하루 = 864e5;
const 날 = d => { const x = new Date(Date.now() + d*하루); return x.toISOString().slice(0,10); };
// ★ 5.29 — 엔진 시간은 「마지막 날 뒤 가동시간」 으로 센다. 가동 기록(runs)·항해일지(voyage)를 넣어 준다.
//   R: [[며칠 전, 시간], …] 엔진 가동 기록. H: 앱 총 가동시간(옛 셈에만 쓰던 값).
const F = (H, R, V) => new Function('H', 'runs', 'voyage', `
  const t = s => s;
  const tsub = (s,o) => String(s).replace(/\\{(\\w+)\\}/g, (_,k)=> o[k]);
  const engineHours = () => ({ total: H });
  const voyDay = v => /^\\d{4}-\\d{2}-\\d{2}$/.test(String(v||'')) ? String(v) : '';
  const voyOutMs = v => v && v.timeOut ? new Date(v.date + 'T' + v.timeOut + ':00').getTime() : null;
  const runAt = (d, h) => (d && h) ? new Date(d + 'T' + h + ':00') : null;
  const runOn = r => !!(r && r.on);
  const runMins = () => null;
  function addPeriod(d, n, u){
    const x = new Date(d + 'T00:00:00');
    if(u === 'd') x.setDate(x.getDate() + n);
    else if(u === 'w') x.setDate(x.getDate() + n*7);
    else x.setMonth(x.getMonth() + n);
    return x;
  }
  ${blk}
  return { mStatus, mHourLeft, engNow, engHoursSince, mHoursUsed };`)(H,
  (R || []).map(([d, h]) => ({ date: 날(-d), time: '10:00', hours: h })),
  (V || []).map(([d, h, tm]) => ({ date: 날(-d), timeOut: tm || '', engineH: h })));

// ══ 1. 시간 주기를 안 적으면 여태와 똑같다 ═══════════════════════════
{
  const A = F(500, [[3, 5]]);
  T('★★★ 시간 주기가 없으면 달력만 본다 (있던 기록 그대로)',
    A.mStatus({ lastDate: 날(-10), months:12, unit:'m' }).t.includes('일'));
  T('★★ 아무것도 없으면 「미기록」', A.mStatus({}).k === 'none');
  T('★★ 시간 주기가 없으면 mHourLeft 가 null', A.mHourLeft({ months:12, lastDate: 날(-10) }) === null);
}

// ══ 2. ★★★ 5.29 — 마지막 날 뒤 가동시간으로 센다 (사장님: 「엔진 시간 저건 가동 시간이고 사람이 직접 쓰는
//      엔진시간은 엔진 가동 얼마나 하고 나서 점검을 받는지 세는 기준인데 … 같이 동기화하면 어떻게 하냐」)
{
  // 마지막 40일 전. 그 전 가동 50시간(안 센다), 그 뒤 가동 4+6=10시간, 항해일지 엔진 2시간
  const A = F(59.8, [[60, 50], [20, 4], [5, 6]], [[10, 2, '09:00'], [45, 7, '09:00']]);
  const it = { lastDate: 날(-40), months:'', hrs:30 };
  T('★★★ 마지막 날 뒤 가동시간만 센다 (12시간 — 앞의 57시간은 안 센다)', A.mHoursUsed(it) === 12, A.mHoursUsed(it));
  T('★★★ 남은 시간 = 주기 − 그 뒤 가동시간 (30 − 12 = 18)', A.mHourLeft(it) === 18, A.mHourLeft(it));
  T('★★★ 앱 총 가동시간(59.8)은 셈에 안 들어간다', A.mHourLeft(it) !== (30 + 30 - 59.8));
  T('★★★ 옛 「마지막 엔진」 값(lastH)이 있어도 셈에 안 쓴다', A.mHourLeft(Object.assign({ lastH:30 }, it)) === 18);
  const s = A.mStatus(it);
  T('★★ 상태가 시간으로 나온다 (남음 18시간)', /18/.test(s.t) && /시간/.test(s.t), s);
  T('★★★ 주기를 넘기면 「지남」', F(0, [[5, 35]]).mStatus({ lastDate: 날(-10), months:'', hrs:30 }).k === 'late');
  T('★★ 20시간 안쪽이면 「곧」', F(0, [[5, 15]]).mStatus({ lastDate: 날(-10), months:'', hrs:30 }).k === 'soon');
  T('★★★ 마지막 날짜가 없으면 시간으로 안 센다 (「미기록」)', A.mStatus({ months:'', hrs:30 }).k === 'none');
  // 완료 처리를 누른 날 — 누른 때 뒤부터
  const 오늘 = 날(0);
  const B = F(0, [], [[0, 3, '00:01']]);   // 오늘 00:01 에 나간 항해 엔진 3시간
  T('★★★ 완료 처리한 날은 누른 때 뒤부터 센다 (그날 앞선 항해는 안 센다)',
    B.engHoursSince(오늘, Date.now()) === 0 && B.engHoursSince(오늘) === 3);
  T('★★ 누른 때가 다른 날이면 마지막 날짜 0시부터', B.engHoursSince(오늘, Date.now() - 3 * 864e5) === 3);
}

// ══ 2-2. ★★★ 5.29 — 달력 주기를 비우면 엔진 시간만 (사장님: 「내가 엔진 시간으로만 하고 싶은데 왜 꼭 날짜가 들어가냐?」)
{
  const A = F(59.8, [[20, 4]]);
  const s = A.mStatus({ lastDate: 날(-44), months:'', unit:'m', hrs:30 });
  T('★★★ 달력 주기를 비우면 날짜로 세지 않는다 (다음 날짜 없음)', s.next === null && s.days === null, s);
  T('★★★ 엔진 시간으로만 남은 시간을 말한다', /시간/.test(s.t) && !/일/.test(s.t), s);
  T('★★ 오래전 날짜여도 달력으로 「지남 n일」 이 안 뜬다', !/일/.test(A.mStatus({ lastDate: 날(-900), months:'', hrs:30 }).t));
  T('★★ 달력 주기·마지막 날짜 둘 다 없으면 「미기록」', A.mStatus({ months:'', hrs:30 }).k === 'none');
  T('★★ months 가 0 이어도 달력을 안 본다', A.mStatus({ lastDate: 날(-900), months:0, hrs:30 }).days === null);
  T('★★★ 옛 기록(months 숫자)은 그대로 달력도 본다', A.mStatus({ lastDate: 날(-10), months:12, unit:'m' }).days !== null);
}

// ══ 3. ★★★ 둘 다 있으면 먼저 오는 쪽 ═══════════════════════════════
{
  // 달력은 아직 멀었고, 시간은 이미 지남 → 시간이 이긴다
  const a = F(0, [[30, 260]]).mStatus({ lastDate: 날(-65), months:12, unit:'m', hrs:250 });
  T('★★★ 달력은 멀었어도 엔진 시간이 지났으면 그것을 알려 준다', a.k === 'late' && /시간/.test(a.t), a);
  // 달력은 지났고, 시간은 아직 멀었다 → 달력이 이긴다
  const b = F(0, [[30, 10]]).mStatus({ lastDate: 날(-400), months:12, unit:'m', hrs:250 });
  T('★★★ 엔진 시간은 멀었어도 달력이 지났으면 그것을 알려 준다', b.k === 'late' && /일/.test(b.t), b);
  // 둘 다 여유 — 더 가까운 쪽 (시간 245 < 날짜 364)
  const c = F(0, [[0.5, 5]]).mStatus({ lastDate: 날(-1), months:12, unit:'m', hrs:250 });
  T('★★★ 둘 다 여유면 더 가까운 쪽을 보여 준다', /시간/.test(c.t), c);
}

// ══ 4. 완료 처리 ═════════════════════════════════════════════════════
T('★★★ 완료할 때 누른 때를 찍는다 (그 뒤부터 센다)', /it\.lastAt = Date\.now\(\)/.test(src));
T('★★ 지난 이력용 「그때 엔진시간」 은 그대로 남긴다', /it\.lastH = engNow\(\)/.test(src));

// ══ 5. 이상한 값에 안 무너진다 ═══════════════════════════════════════
{
  const A = F(300, [[3, 5]]);
  [ {hrs:0}, {hrs:-5}, {hrs:'abc'}, {hrs:null}, {hrs:''} ].forEach(x=>{
    T('★ 시간 주기가 ' + JSON.stringify(x.hrs) + ' 이면 안 센다', A.mHourLeft(Object.assign({ lastDate: 날(-10) }, x)) === null);
  });
  T('★ 마지막 날짜가 이상하면 안 센다', A.engHoursSince('abc') === null && A.engHoursSince('') === null);
}

// ══ 6. 화면 ══════════════════════════════════════════════════════════
T('★★★ 주기 줄에 엔진 시간 칸이 있다', /function mCycleRow/.test(src) && /mrField\('hrs'/.test(src));
T('★★★ 5.29 — 마지막 줄에 엔진 시간을 적는 칸이 없다 (사람은 날짜만 적는다)', !/mrField\('lastH'/.test(src));
T('★★★ 5.29 — 「지금 n시간」 단추(가동시간을 칸에 넣던 것)가 없다', !/mHourBaseNow\(/.test(src.replace(/\/\/[^\n]*/g, '')));
T('★★ 마지막 줄에 그 뒤 가동시간을 보여 준다 (앱이 센 값)', /t\('가동시간'\)/.test(src.slice(src.indexOf('function mLastRow'), src.indexOf('function mStatus'))));
T('★★★ 「기준」 이라는 말이 화면에 안 나간다', !/t\('기준 지움'\)|t\('지금부터'\)|t\('오늘로 맞춤'\)/.test(src));
T('★★ 엔진 칸을 비우면 달력만 본다고 알려 준다', /비워 두면 달력으로만 계산합니다/.test(src));  // 5.30 — 문구 바뀜
T('★★ 둘 다 적으면 먼저 오는 쪽을 알려 준다고 적혀 있다', /먼저 돌아오는 기한을 알려 드립니다/.test(src));  // 5.30 — 문구 바뀜
T('★★★ 5.29 — 지어낸 문장 「엔진 시간만 봅니다」 가 화면에 안 나간다', !/t\('엔진 시간만/.test(src) && !/'엔진 시간만 봅니다/.test(src));
T('★★ 도움말이 있다', /cycle: \[t\('점검 주기'\)/.test(src));

console.log('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
