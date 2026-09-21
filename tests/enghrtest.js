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
const F = new Function('H', `
  const t = s => s;
  const tsub = (s,o) => String(s).replace(/\\{(\\w+)\\}/g, (_,k)=> o[k]);
  const engineHours = () => ({ total: H });
  function addPeriod(d, n, u){
    const x = new Date(d + 'T00:00:00');
    if(u === 'd') x.setDate(x.getDate() + n);
    else if(u === 'w') x.setDate(x.getDate() + n*7);
    else x.setMonth(x.getMonth() + n);
    return x;
  }
  ${blk}
  return { mStatus, mHourLeft, engNow };`);

// ══ 1. 시간 주기를 안 적으면 여태와 똑같다 ═══════════════════════════
{
  const A = F(500);
  T('★★★ 시간 주기가 없으면 달력만 본다 (있던 기록 그대로)',
    A.mStatus({ lastDate: 날(-10), months:12, unit:'m' }).t.includes('일'));
  T('★★ 아무것도 없으면 「미기록」', A.mStatus({}).k === 'none');
  T('★★ 시간 주기가 없으면 mHourLeft 가 null', A.mHourLeft({ months:12 }) === null);
}

// ══ 2. 시간 주기만 있을 때 ═══════════════════════════════════════════
{
  const A = F(300);                       // 지금까지 300시간 돌았다
  // 100시간에 마지막으로 했고 250시간마다 → 350에 해야 함 → 50 남음
  const s = A.mStatus({ hrs:250, lastH:100 });
  T('★★★ 시간 주기만 있어도 셈한다', /시간/.test(s.t), s);
  T('★★★ 남은 시간이 맞다 (50)', /50/.test(s.t), s);
  T('★★ 아직 여유 있으면 초록', s.k === 'ok', s);
  // 60시간에 했고 250마다 → 310 → 10 남음 → 곧
  T('★★★ 20시간 안쪽이면 「곧」 으로 본다', A.mStatus({ hrs:250, lastH:60 }).k === 'soon');
  // 20에 했고 250마다 → 270 → 이미 30 지남
  const 지남 = A.mStatus({ hrs:250, lastH:20 });
  T('★★★ 지났으면 빨강', 지남.k === 'late', 지남);
  T('★★ 얼마나 지났는지 말한다 (30)', /30/.test(지남.t), 지남);
}

// ══ 3. ★★★ 둘 다 있으면 먼저 오는 쪽 ═══════════════════════════════
{
  const A = F(300);
  // 달력은 아직 멀었고(300일), 시간은 이미 지남 → 시간이 이긴다
  const a = A.mStatus({ lastDate: 날(-65), months:12, unit:'m', hrs:250, lastH:20 });
  T('★★★ 달력은 멀었어도 엔진 시간이 지났으면 그것을 알려 준다',
    a.k === 'late' && /시간/.test(a.t), a);
  // 달력은 지났고, 시간은 아직 멀었다 → 달력이 이긴다
  const b = A.mStatus({ lastDate: 날(-400), months:12, unit:'m', hrs:250, lastH:290 });
  T('★★★ 엔진 시간은 멀었어도 달력이 지났으면 그것을 알려 준다',
    b.k === 'late' && /일/.test(b.t), b);
  // 둘 다 여유 — 더 가까운 쪽
  const c = A.mStatus({ lastDate: 날(-1), months:12, unit:'m', hrs:250, lastH:295 });
  T('★★★ 둘 다 여유면 더 가까운 쪽을 보여 준다 (시간 245 < 날짜 364)',
    /시간/.test(c.t), c);
}

// ══ 4. 마지막에 찍어 둔 시간부터 센다 ════════════════════════════════
{
  T('★★★ 완료할 때 그때의 엔진 시간을 찍는다', /it\.lastH = engNow\(\)/.test(src));
  const A = F(1000);
  // ★★★ 4.102 — 찍어 둔 값이 없으면 **시간으로 세지 않는다** (사장님 지적으로 고침).
  //   여태는 기준이 없으면 0시간부터 센 셈으로 봤다. 엔진을 이미 400시간 돌린 배에서는
  //   「250시간 지남」 이 바로 떠 버린다 — 앱이 모르는 것을 아는 척한 것이다.
  //   기준이 없으면 달력만 보고, 화면에서 [지금부터] 로 기준을 잡게 한다.
  T('★★★ 찍어 둔 값이 없으면 시간으로 안 센다 (0부터 셌다고 거짓말하지 않는다)',
    A.mStatus({ hrs:250 }).k === 'none');
  T('★★ 기준이 있으면 그때부터 센다', A.mStatus({ hrs:250, lastH:900 }).k === 'ok');
  T('★★★ 기준 + 주기를 넘으면 「지남」 이다', A.mStatus({ hrs:250, lastH:600 }).k === 'late');
}

// ══ 5. 이상한 값에 안 무너진다 ═══════════════════════════════════════
{
  const A = F(300);
  [ {hrs:0}, {hrs:-5}, {hrs:'abc'}, {hrs:null}, {hrs:''} ].forEach(x=>{
    T('★ 시간 주기가 ' + JSON.stringify(x.hrs) + ' 이면 안 센다', A.mHourLeft(x) === null);
  });
  T('★ 엔진 시간을 못 재도 안 터진다',
    new Function(`const t=s=>s; const tsub=(s,o)=>s; const engineHours=()=>{throw new Error('x')};
      ${blk} return engNow();`)() === 0);
}

// ══ 6. 화면에 칸이 있다 ══════════════════════════════════════════════
//
// ★★★ 4.102 — 화면을 **다시 만들었다** (사장님 지적)
//   사장님: 「이해가 딱 봐서 하나도 안 되는데 이걸 어떻게 쓰라는 거야? 누가 어플을 공부해서 쓰냐?」
//   옛 화면: 「엔진 시간 [ ] 안 쓰면 달력만 · 지금까지 21.6시간 · [지금부터][기준 지움][오늘로 맞춤]」
//     — 「기준」 이 뭔지 화면에 없고, 단추 셋이 뭐가 다른지 눌러 봐야 알았다.
//   새 화면: 차량 정비 앱(오토업·마카롱·카닥)처럼 **두 가지만** 묻는다 —
//     주기   [6][개월▾]  엔진 [250] 시간
//     마지막 [2026-09-04]  엔진 [21.6] 시간  [지금 21.6시간]
//   ★ 그래서 여기서 보는 것도 바뀌었다. 「엔진 시간」 이라는 **낱말**이 아니라
//     **주기 옆과 마지막 옆에 엔진 칸이 하나씩 있는가** 를 본다.
T('★★★ 주기 줄에 엔진 시간 칸이 있다',
  /function mCycleRow/.test(src) && /mrField\('hrs'/.test(src));
T('★★★ 마지막 줄에 그때의 엔진 시간 칸이 있다',
  /function mLastRow/.test(src) && /mrField\('lastH'/.test(src));
T('★★★ 단추 이름에 들어갈 숫자를 그대로 보여 준다 (눌러 보지 않아도 안다)',
  /지금 \{n\}시간/.test(src));
// ★ 주석에는 「무엇이 잘못이었나」 를 적어 두었으므로 옛 이름이 나온다.
//   보아야 할 것은 **화면에 그 말이 나가는가** 다 — t('…') 로 지나는 것만 본다.
T('★★★ 「기준」 이라는 말이 화면에 안 나간다',
  !/t\('기준 지움'\)|t\('지금부터'\)|t\('오늘로 맞춤'\)/.test(src));
T('★★ 엔진 칸을 비우면 달력만 본다고 알려 준다',
  /비워 두면 달력만 봅니다/.test(src));
T('★★ 둘 다 적으면 먼저 오는 쪽을 알려 준다고 적혀 있다',
  /먼저 오는 쪽을 알려 드립니다/.test(src));
T('★★ 도움말이 있다 (「?」 를 둘에서 하나로 줄였다)',
  /cycle: \[t\('점검 주기'\)/.test(src) && !/hrs: \[t\(/.test(src));

console.log('\n통과 ' + pass + ' · 실패 ' + fail);
process.exit(fail ? 1 : 0);
