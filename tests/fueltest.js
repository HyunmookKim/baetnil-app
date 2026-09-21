// 4.98 — 연료: L/시간과 잔량을 사람이 고칠 수 있게 한다
//
// ★ 사장님 지적 (2026-09-01)
//   "이거 리터당 시간이랑 잔량은 수정할수 있게 해야지
//    그리고 63리터는 무슨의민지 모르겠다
//    이거 만탱크와 만탱크사이 앤진가동 가지고 알아서 계산하는거 맞냐?"
//
// ★ 왜 사고인가 —
//   ① 앱이 셈한 L/시간이 틀려도 사람이 고칠 길이 없었다. 엔진을 바꿨거나
//      만탱크 체크를 잊었으면 그 숫자는 영영 틀린 채로 남는다.
//   ② 계기판을 보고 잔량을 아는 사람이, 앱이 우기는 숫자를 고칠 수 없었다.
//      기름이 실제보다 많다고 믿는 것이 배에서 제일 위험하다.
//   ③ 「63」 위에 「리터」 라고만 적혀 있었다. 무슨 리터인지 알 수 없다.
//   ④ 큰 숫자는 마지막 구간(rate.last), 아래 잔글씨는 평균(rate.avg) —
//      다른 두 수가 같은 이름표를 달고 있었다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,240):'')); } };

const from = src.indexOf('// 엔진 가동시간: 항해일지 engineH');
const to   = src.indexOf('function fuelStats(){');
T('연료 셈하는 자리가 있다', from > 0 && to > from);
const blk = src.slice(from, to);

// 화면 그리는 곳은 따로 본다
const rf0 = src.indexOf('function renderFuel(){');
const rf1 = src.indexOf('\n  const rows = [', rf0);
const rf = src.slice(rf0, rf1 > 0 ? rf1 : rf0 + 4000);

// ── 셈하는 자리를 진짜로 돌려 본다 ──────────────────────────────
//    말로만 「있다」 를 보면 틀린 셈도 통과한다. 값을 넣고 답을 잰다.
function F(o){
  o = o || {};
  const boat = { fuelSet: o.fuelSet ? JSON.parse(JSON.stringify(o.fuelSet)) : undefined };
  const env = {
    voyage: o.voyage || [], runs: o.runs || [], fuel: o.fuel || [],
    tank: (o.tank === undefined ? 240 : o.tank),
    boat, saved: 0, drawn: 0, forms: []
  };
  const mk = new Function('E', `
    const voyage = E.voyage, runs = E.runs, fuel = E.fuel;
    const hm = s => String(s||'');
    const boatSpec = k => (k === 'fuelTank' ? E.tank : null);
    const curBoat = () => E.boat;
    const save = () => { E.saved++; };
    const renderFuel = () => { E.drawn++; };
    const t = s => s;
    const tsub = (s,ob) => String(s).replace(/\\{(\\w+)\\}/g, (_,k)=> ob[k]);
    const today = () => '2026-09-01';
    const tell = m => { E.told = m; };
    // ★ 4.101 — 칸이 잘못된 것은 알림창이 아니라 그 칸 아래 빨간 한 줄로 말한다
    const formErr = (k, m) => { E.told = m; E.badKey = k; return false; };
    const fieldErr = (el, m) => { E.told = m; return false; };
    const esc = s => String(s);
    const needEdit = (why, go) => { E.needEdit = why; go(); };
    const openForm = c => { E.forms.push(c); E.form = c; };
    ${blk}
    return { fuelRate, fuelLeft, fuelSet, fuelSetPut, fuelLphSet, fuelMark,
             fuelEditLph, fuelEditLeft, fuelClearLph, fuelClearMark, engineHours };
  `);
  const A = mk(env); A.E = env; return A;
}

// ══ 1. 사장님 물음에 대한 답 — 만탱크↔만탱크가 맞나 ════════════════
{
  // 1월 1일 만탱크 → 60시간 돌림 → 3월 1일 만탱크에 180L
  const A = F({
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 } ]
  });
  const r = A.fuelRate();
  T('★★★ 만탱크와 만탱크 사이만 잰다 (180L ÷ 60h = 3.0)', r && Math.abs(r.avg - 3) < 0.001, r);
  T('★★ 구간을 하나로 센다', r && r.n === 1, r);
  const B = F({
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'x', date:'2026-02-10', liters:50 } ],
    runs: [ { id:'r', date:'2026-02-01', hours:10 } ]
  });
  T('★★★ 만탱크가 한 번뿐이면 셈하지 않는다 (부분 주유로 부풀리지 않는다)',
    B.fuelRate() === null, B.fuelRate());
  // 사이에 낀 부분 주유도 그 구간에 쓴 기름이다
  const C = F({
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'x', date:'2026-02-01', liters:80 },
            { id:'b', date:'2026-03-01', liters:100, full:true } ],
    runs: [ { id:'r', date:'2026-01-15', hours:60 } ]
  });
  T('★★★ 사이에 낀 부분 주유도 그 구간에 더한다 (180 ÷ 60 = 3.0)',
    Math.abs(C.fuelRate().avg - 3) < 0.001, C.fuelRate());
}

// ══ 2. L/시간을 사람이 고칠 수 있다 ═══════════════════════════════
{
  T('고치는 문이 있다', /function fuelEditLph\(/.test(blk));
  T('되돌리는 문이 있다', /function fuelClearLph\(/.test(blk));
  const A = F({
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 } ]
  });
  T('★★ 안 적었으면 사람 값이 없다', A.fuelLphSet() === null);
  A.fuelSetPut({ lph: 4.5 });
  T('★★★ 적으면 그 값을 쓴다', A.fuelLphSet() === 4.5, A.fuelSet());
  T('★★★ 셈한 값을 지우지 않는다 (되돌릴 수 있다)',
    Math.abs(A.fuelRate().avg - 3) < 0.001, A.fuelRate());
  T('★★ 적으면 저장한다', A.E.saved > 0);
  T('★★ 적으면 화면을 다시 그린다', A.E.drawn > 0);
  A.fuelClearLph();
  T('★★★ 되돌리면 다시 앱이 셈한 값이다', A.fuelLphSet() === null, A.fuelSet());
  // 말이 되는 값만 받는다
  A.fuelSetPut({ lph: 0 });     T('★★ 0 은 값으로 안 본다', A.fuelLphSet() === null);
  A.fuelSetPut({ lph: -2 });    T('★★ 음수는 값으로 안 본다', A.fuelLphSet() === null);
  A.fuelSetPut({ lph: 'abc' }); T('★★ 글자는 값으로 안 본다', A.fuelLphSet() === null);
}

// ══ 3. 잔량을 사람이 적을 수 있다 ════════════════════════════════
{
  T('적는 문이 있다', /function fuelEditLeft\(/.test(blk));
  T('되돌리는 문이 있다', /function fuelClearMark\(/.test(blk));
  const A = F({
    tank: 240,
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 } ]     // 총 60시간
  });
  T('★★ 안 적었으면 표시가 없다', A.fuelMark() === null);
  // 지금(60시간 시점) 잔량 200L 이라고 적는다
  A.fuelSetPut({ mark: { left: 200, hours: 60, date: '2026-09-01' } });
  T('★★★ 적은 값과 그때 가동시간을 함께 담는다',
    A.fuelMark() && A.fuelMark().left === 200 && A.fuelMark().hours === 60, A.fuelMark());
  const L0 = A.fuelLeft();
  T('★★★ 적은 직후에는 적은 값 그대로다', Math.abs(L0.left - 200) < 0.01, L0);
  T('★★★ 사람이 적은 값임을 밝힌다', L0.mine === true, L0);
  // 그 뒤 10시간 더 돌리면 3.0 L/h × 10 = 30L 줄어야 한다
  const B = F({
    tank: 240,
    fuelSet: { mark: { left: 200, hours: 60, date: '2026-03-02' } },
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 }, { id:'r2', date:'2026-04-01', hours:10 } ]
  });
  const L1 = B.fuelLeft();
  T('★★★ 적은 뒤 돌린 만큼 뺀다 (200 − 3.0×10 = 170)', Math.abs(L1.left - 170) < 0.01, L1);
  T('★★ 몇 시간 돌렸는지 함께 알려준다', Math.abs(L1.since - 10) < 0.01, L1);
  // 적은 뒤에 기름을 더 넣으면 다시 더해야 한다
  const C = F({
    tank: 240,
    fuelSet: { mark: { left: 100, hours: 60, date: '2026-03-02' } },
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true },
            { id:'c', date:'2026-04-02', liters:50 } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 }, { id:'r2', date:'2026-04-01', hours:10 } ]
  });
  T('★★★ 적은 뒤 넣은 기름은 다시 더한다 (100 − 30 + 50 = 120)',
    Math.abs(C.fuelLeft().left - 120) < 0.01, C.fuelLeft());
  // 탱크보다 많아지지 않는다
  const D = F({
    tank: 240,
    fuelSet: { mark: { left: 230, hours: 60, date: '2026-03-02' } },
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true },
            { id:'c', date:'2026-04-02', liters:200 } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 } ]
  });
  T('★★★ 탱크 용량을 넘지 않는다 (230 + 200 이라도 240)',
    Math.abs(D.fuelLeft().left - 240) < 0.01, D.fuelLeft());
  // 0 아래로 안 내려간다
  const E2 = F({
    tank: 240,
    fuelSet: { mark: { left: 10, hours: 0, date: '2026-01-01' } },
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 } ]
  });
  T('★★★ 0 아래로 안 내려간다', E2.fuelLeft().left >= 0, E2.fuelLeft());
  // 되돌리면 앱 셈으로 간다
  B.fuelClearMark();
  T('★★★ 되돌리면 사람 표시가 사라진다', B.fuelMark() === null, B.fuelSet());
  const L2 = B.fuelLeft();
  T('★★ 되돌린 뒤에는 「내가 적음」 이 아니다', !L2 || !L2.mine, L2);
}

// ══ 4. 두 값이 서로 얽힌다 — 사람이 적은 L/시간으로 잔량을 센다 ═════
{
  const A = F({
    tank: 240,
    fuelSet: { lph: 5, mark: { left: 200, hours: 60, date: '2026-03-02' } },
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],   // 앱 셈은 3.0
    runs: [ { id:'r', date:'2026-02-01', hours:60 }, { id:'r2', date:'2026-04-01', hours:10 } ]
  });
  T('★★★ 사람이 적은 L/시간으로 잔량을 센다 (200 − 5×10 = 150)',
    Math.abs(A.fuelLeft().left - 150) < 0.01, A.fuelLeft());
  // 잔량 표시는 없고 L/시간만 적었을 때 — 마지막 만탱크 기준으로 사람 값을 쓴다
  const B = F({
    tank: 240,
    fuelSet: { lph: 5 },
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 }, { id:'r2', date:'2026-04-01', hours:10 } ]
  });
  T('★★★ 잔량은 안 적고 L/시간만 적어도 그 값을 쓴다 (240 − 5×10 = 190)',
    Math.abs(B.fuelLeft().left - 190) < 0.01, B.fuelLeft());
}

// ══ 5. 탱크 용량을 모르면 잔량을 지어내지 않는다 ═══════════════════
{
  const A = F({
    tank: 0,
    fuelSet: { mark: { left: 200, hours: 0, date: '2026-01-01' } },
    fuel: [], runs: []
  });
  T('★★★ 탱크 용량을 모르면 잔량을 말하지 않는다', A.fuelLeft() === null, A.fuelLeft());
}

// ══ 6. 고치는 창이 사람에게 말이 되게 열린다 ══════════════════════
{
  const A = F({
    tank: 240,
    fuel: [ { id:'a', date:'2026-01-01', liters:100, full:true },
            { id:'b', date:'2026-03-01', liters:180, full:true } ],
    runs: [ { id:'r', date:'2026-02-01', hours:60 } ]
  });
  A.fuelEditLph();
  T('★★★ 잠금을 지나서 연다 (남의 배에서 못 고친다)', !!A.E.needEdit, A.E.needEdit);
  T('★★ 창이 열린다', !!A.E.form);
  T('★★★ 앱이 셈한 값을 창에 알려 준다', /3\.0/.test(String(A.E.form.sub)), A.E.form.sub);
  // 말이 안 되는 값은 되돌려 보낸다
  T('★★★ 0 을 적으면 저장하지 않는다', A.E.form.onOk({ lph: '0' }) === false);
  T('★★★ 글자를 적으면 저장하지 않는다', A.E.form.onOk({ lph: 'ㅁ' }) === false);
  A.E.form.onOk({ lph: '4.2' });
  T('★★★ 옳은 값은 저장한다', A.fuelLphSet() === 4.2, A.fuelSet());
  A.E.form.onOk({ lph: '' });
  T('★★★ 비우면 앱이 셈한 값으로 돌아간다', A.fuelLphSet() === null, A.fuelSet());

  A.fuelEditLeft();
  T('★★ 잔량 창도 잠금을 지난다', !!A.E.needEdit);
  T('★★★ 탱크 용량을 알려 준다', /240/.test(String(A.E.form.sub)), A.E.form.sub);
  T('★★★ 음수는 저장하지 않는다', A.E.form.onOk({ left: '-5' }) === false);
  T('★★★ 탱크보다 많으면 저장하지 않는다', A.E.form.onOk({ left: '999' }) === false);
  A.E.form.onOk({ left: '150' });
  T('★★★ 옳은 값은 저장하고 그때 가동시간을 함께 담는다',
    A.fuelMark() && A.fuelMark().left === 150 && A.fuelMark().hours === 60, A.fuelMark());
  T('★★ 적은 날짜도 담는다', A.fuelMark().date === '2026-09-01', A.fuelMark());
}

// ══ 7. 화면 이름표 — 「63 리터」 가 무슨 수인지 알 수 있다 ═══════════
{
  T('★★★ 「리터」 만 있는 이름표가 없다', !/<span>\$\{st\.y\}?\s*\$\{esc\(t\('리터'\)\)\}/.test(rf)
    && !/>\{?\s*리터\s*<\/span>/.test(rf), rf.match(/리터/g));
  // 4.120 에서 해마다 쌓이는 칸(「2026 주유」·「2026 주유량」·「2026 연료비」)을 아예 뺐다 —
  // 배를 띄우기 전에 쓰지 않는 수라서다. 그러니 「주유량에 해가 붙는가」 를 물을 자리가 없어졌다.
  // 대신 그 칸들이 정말로 사라졌는지를 본다 (슬그머니 되살아나면 4.98 의 문제가 그대로 돌아온다).
  T('★★★ 해마다 쌓이는 칸(주유 횟수·주유량·연료비)이 연료 화면에 없다',
    !/\$\{st\.y\}/.test(rf) && !/t\('주유량 L'\)/.test(rf) && !/t\('연료비'\)/.test(rf), rf);
  T('★★★ 큰 숫자와 아래 잔글씨가 같은 수다 (둘 다 평균)',
    /const lphShow = 내lph \|\| \(rate \? rate\.avg : null\)/.test(rf), rf);
  T('★★★ 마지막 구간 값을 큰 자리에 안 쓴다', !/rate\.last/.test(rf), rf);
  T('★★★ 눌러서 고칠 수 있다고 밝힌다', /L\/시간과 잔량은 눌러서 고칠 수 있습니다/.test(rf));
  T('★★ L\/시간 칸을 누르면 고치는 창이 열린다', /class="stat tapstat" onclick="fuelEditLph\(\)"/.test(rf));
  T('★★ 잔량 칸을 누르면 적는 창이 열린다', /class="stat tapstat" onclick="fuelEditLeft\(\)"/.test(rf));
  T('★★★ 사람이 적은 값이면 그렇다고 밝힌다', /내가 적음/.test(rf), rf);
  T('★★ 눌러지는 칸으로 보이게 한다 (밑줄·손가락)',
    /\.stat\.tapstat\{cursor:pointer\}/.test(src) && /\.stat\.tapstat b\{text-decoration:underline/.test(src));
  T('★★★ 앱이 셈한 값으로 되돌리는 단추가 있다',
    /onclick="fuelClearLph\(\)"/.test(src) && /onclick="fuelClearMark\(\)"/.test(src));
}

// ══ 8. 문이 하나다 ═══════════════════════════════════════════════
{
  const one = n => (src.match(new RegExp('function ' + n + '\\(', 'g')) || []).length === 1;
  ['fuelSet','fuelSetPut','fuelLphSet','fuelMark','fuelLeft','fuelRate',
   'fuelEditLph','fuelEditLeft','fuelClearLph','fuelClearMark'].forEach(n=>
    T('문이 하나다 — ' + n, one(n)));
  T('★★★ 사람이 적은 값은 배 안에 산다 (배를 바꾸면 그 배 값이다)',
    /b\.fuelSet = Object\.assign/.test(blk), blk.slice(blk.indexOf('function fuelSetPut'), blk.indexOf('function fuelSetPut')+300));
}

// ══ 9. 새로 쓴 말이 네 나라 말에 다 있다 ═══════════════════════════
{
  const 새말 = ['내가 적음','L/시간과 잔량은 눌러서 고칠 수 있습니다.','주유량 L','지금 잔량',
    '앱이 셈한 값으로','0보다 큰 수를 적어 주세요.','0 이상의 수를 적어 주세요.'];
  ['en','ru','ja'].forEach(lg=>{
    const i = src.indexOf('\n  ' + lg + ': {');
    const j = src.indexOf('\n  },', i);
    const d = src.slice(i, j);
    새말.forEach(k=>{
      T(lg + ' 에 「' + k.slice(0,18) + '」 이 있다',
        d.indexOf("'" + k + "'") >= 0 || d.indexOf('"' + k + '"') >= 0);
    });
  });
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
