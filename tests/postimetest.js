// 4.99 — 「지금 여기」 를 누르면 시각도 같이 들어간다 · 지도 이름표가 안 겹친다
//
// ★ 사장님 지적 (2026-09-02)
//   ① "도착이라고 찍었는데 니미랄 시간은 또 따로 버튼 눌러서 찍는게 말이나 되냐"
//   ② 지도에 「도착0 출발」 이라고 두 이름표가 겹쳐 찍혔다
//
// ★ ①이 왜 사고인가 — 「지금 여기」 는 「나 지금 여기 있다」 는 뜻이다.
//   자리를 알면 시각도 아는 것이다. 사람에게 같은 말을 두 번 시키면 안 된다.
//   배 위에서 손이 하나뿐일 때 단추를 두 번 찾아 눌러야 하는 것이 그것이다.
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

// ══ 1. 시각을 넣는 문이 하나다 ════════════════════════════════════
{
  T('시각을 넣는 문이 있다', !!grab(src, 'posStampTime'));
  T('문이 하나다', (src.match(/function posStampTime\(/g) || []).length === 1);
  const F = new Function(`
    const hm = v => v;
    ${grab(src, 'posTimeKey')}
    ${grab(src, 'posStampTime')}
    return posStampTime;`)();
  const 이제 = () => { const d=new Date(), p=n=>String(n).padStart(2,'0');
                       return p(d.getHours())+':'+p(d.getMinutes()); };

  const A = { logs:[] };
  T('★★★ 도착 시각이 비어 있으면 넣는다', F(A, 'wxIn') === 이제() && A.timeIn === 이제(), A);
  const B = { logs:[] };
  T('★★★ 출발도 마찬가지다', F(B, 'wxOut') === 이제() && B.timeOut === 이제(), B);

  // ★★★ 적어 두신 것은 안 건드린다 (사장님이 정하신 것 0번)
  const C = { timeIn:'09:30', logs:[] };
  T('★★★ 이미 적어 두신 시각은 절대 안 덮는다', F(C, 'wxIn') === '' && C.timeIn === '09:30', C);
  const D = { timeOut:'07:00', logs:[] };
  T('★★★ 출발도 안 덮는다', F(D, 'wxOut') === '' && D.timeOut === '07:00', D);

  // 중간 기록
  const E = { logs:[{ id:'g1' }, { id:'g2', time:'11:11' }] };
  T('★★★ 중간 기록도 비어 있으면 넣는다', F(E, 'log:g1') === 이제() && E.logs[0].time === 이제(), E);
  T('★★★ 중간 기록도 적혀 있으면 안 덮는다', F(E, 'log:g2') === '' && E.logs[1].time === '11:11', E);
  T('★★ 없는 중간 기록에는 안 터진다', F(E, 'log:없음') === '');
  T('★★ 모르는 자리에는 아무것도 안 한다', F({ logs:[] }, '엉뚱') === '');
  T('★★ 빈 것에도 안 터진다', F(null, 'wxIn') === '');
}

// ══ 2. 「지금 여기」 가 실제로 그 문을 부른다 ═══════════════════════
{
  const ph = grab(src, 'posHere') || '';
  T('★★★ 자리를 잡으면 시각도 넣는다', /const 넣은 = quiet \? '' : posStampTime\(it, key\)/.test(ph), ph);
  T('★★★ 앱이 스스로 부른 것(quiet)에는 손대지 않는다 (부르는 쪽이 이미 넣었다)',
    /quiet \? '' : posStampTime/.test(ph), ph);
  T('★★★ 넣었으면 항해 시간·엔진 시간을 다시 잡는다',
    /if\(넣은\)\{[\s\S]{0,300}sailHours\(it\)[\s\S]{0,200}engineHoursFromLogs\(it\)/.test(ph), ph);
  T('★★★ 그 시각 날씨도 같이 받는다 (또 「받기」 를 안 누르게)',
    /if\(넣은\)\{[\s\S]{0,200}wxCapture\(key, id\)/.test(ph), ph);
  T('★★★ 무엇을 넣었는지 사람에게 말한다 (몰래 고치지 않는다)',
    /\{what\} 시각도 \{t\}로 함께 넣었습니다\./.test(ph), ph);
  T('★★ 어느 자리인지 사람 말로 적는다', !!grab(src, 'posWhatName'));
  const wn = new Function(`const t = s => s; ${grab(src, 'posWhatName')} return posWhatName;`)();
  T('★★ 출발이라고 부른다', wn('wxOut') === '출발');
  T('★★ 도착이라고 부른다', wn('wxIn') === '도착');
  T('★★ 중간 기록이라고 부른다', wn('log:g1') === '중간 기록');

  // ★★★ 「지도에서」 는 「지금」 이 아니다 — 집에서 찍을 수도 있다
  const pp = grab(src, 'posPickSave') || '';
  T('★★★ 지도에서 찍은 것에는 시각을 안 넣는다', !/posStampTime/.test(pp), pp);
}

// ══ 3. 「한 번에」 단추가 그 칸 안에 있다 ═══════════════════════════
{
  const lr = grab(src, 'legRow') || '';
  T('★★★ 출발 칸 안에 「지금 출발」 이 있다', /지금 출발 \(시각·위치·날씨\)/.test(lr), lr);
  T('★★★ 도착 칸 안에 「지금 도착」 이 있다', /지금 도착 \(시각·위치·날씨\)/.test(lr), lr);
  T('★★★ 칸 안에 있다 (밖이 아니다)',
    lr.indexOf('지금 도착') > lr.indexOf('legc ${kind}'), lr);
  T('★★★ 이미 적어 두신 시각이 있으면 안 내민다 (덮어쓸 일이 없어야 한다)',
    /unlocked && !String\(it\[timeKey\]\|\|''\)\.trim\(\)/.test(lr), lr);
  T('★★ 크게 낸다', /class="mrbtn big ok" style="width:100%"/.test(lr), lr);
  // ★ 글귀만 있고 단추가 그 일을 안 하면 소용없다. 실제로 그 문을 부르는지 본다.
  T('★★★ 출발 단추가 departNow 를 부른다', /departNow\(\)/.test(lr), lr);
  T('★★★ 도착 단추가 arriveNow 를 부른다', /arriveNow\(\)/.test(lr), lr);
  T('★★★ 옛 자리(칸 밖 아래)에는 안 남아 있다',
    !/입항하면 한 번에 —/.test(grab(src, 'openMR') || ''));
  T('★★★ 출발도 한 번에 찍는 문이 생겼다 (도착만 있으면 짝이 안 맞는다)',
    !!grab(src, 'departNow'));
  const dn = grab(src, 'departNow') || '';
  T('★★★ 출발은 시각·자리·날씨를 한 번에 넣는다',
    /it\.timeOut = /.test(dn) && /posHere\('wxOut'/.test(dn) && /wxCapture\('wxOut'/.test(dn), dn);
  T('★★★ 출발을 찍으면 항적도 켠다 (그때부터 길을 남기는 것이 맞다)',
    /trkStart\(/.test(dn), dn);
}

// ══ 4. 지도 이름표가 겹쳐 찍히지 않는다 ════════════════════════════
{
  const mp = src.slice(src.indexOf('function mapPaint('), src.indexOf('function mapPaint(') + 24000);
  T('겹침을 피하는 문이 있다', /const 자리잡기 = /.test(mp), mp.slice(mp.indexOf('const 놓인'), mp.indexOf('const 놓인')+120));

  // ★★★ 사장님 지적 — 「출발 도착이 겹치는 건 둘이 같은 곳이기 때문이겠지」.
  //   맞다. 같은 자리면 위아래로 벌릴 게 아니라 **한 줄로 합쳐야** 한다.
  const M = new Function(`
    const sx = p => p.x, sy = p => p.y;
    const S = { pts: [] };
    return pts => {
      S.pts = pts;
      ${(mp.match(/const 합침 = \{\};[\s\S]*?\n  \}\n/) || [''])[0]}
      return 합침;
    };`)();
  const 같자리 = M([{ x:100, y:100, time:'18:20', label:'출발' },
                    { x:103, y:101, time:'20:10', label:'도착' }]);
  T('★★★ 같은 자리면 한 줄로 합친다', 같자리[0] === '18:20 출발 · 20:10 도착', 같자리);
  T('★★★ 뒤엣것은 따로 안 그린다 (겹쳐 찍히지 않는다)', 같자리[1] === null, 같자리);
  const 딴자리 = M([{ x:100, y:100, time:'18:20', label:'출발' },
                    { x:400, y:300, time:'20:10', label:'도착' }]);
  T('★★★ 다른 자리면 따로따로 적는다', 딴자리[0] === '18:20 출발' && 딴자리[1] === '20:10 도착', 딴자리);
  const 깃발섞임 = M([{ x:100, y:100, time:'18:20', label:'출발' },
                      { x:101, y:100, time:'18:54', label:'세일', key:'log:g1' },
                      { x:102, y:101, time:'20:10', label:'도착' }]);
  T('★★★ 중간 기록 깃발은 안 합친다 (그건 제 깃발로 선다)',
    깃발섞임[0] === '18:20 출발 · 20:10 도착' && 깃발섞임[1] === undefined, 깃발섞임);
  T('★★★ 이름표를 그릴 때 합친 글자를 쓴다',
    /const lab = \(합침\[i\] !== undefined\) \? 합침\[i\]/.test(mp), mp);
  // ★★★ 4.102 — 이름표를 **밀지 않고 안 그린다** (사장님: 「글씨들 안 겹치게 하려고 ㅈㄴ 이상하게 배치된다」)
  //   밀어서 놓으면 이름표가 제 핀에서 떨어져 **엉뚱한 핀의 이름처럼** 보인다.
  //   지도학이 정한 대로 핀 옆 여섯 자리를 차례로 보고(오른쪽 위가 1순위),
  //   여섯 다 막혔으면 **그 이름표는 안 그린다.** 몇 개를 가렸는지는 지도 밑에 적는다.
  const F = new Function(`
    ${(mp.match(/const 놓인 = \[\];[\s\S]*?가린이름\+\+;[\s\S]*?\n  \};/) || [''])[0]}
    return { 자리잡기, 놓인, 글자폭, 자리막기 };`)();
  const a = F.자리잡기(100, 200, '출발');
  T('★★★ 첫 이름표는 핀 오른쪽 위에 놓인다', !!a && a.x > 100 && a.y < 200, a);
  const b = F.자리잡기(100, 200, '도착');   // 똑같은 자리 — 첫 자리는 막혔다
  T('★★★ 겹치면 밀지 않고 **다른 자리**로 간다 (「도착0 출발」 이 안 생긴다)',
    !!b && (b.x !== a.x || b.y !== a.y), [a, b]);
  T('★★★ 옮겨 간 자리도 제 핀 옆이다 (남의 핀으로 안 간다)',
    !!b && Math.abs(b.x - 100) < 200 && Math.abs(b.y - 200) < 60, b);
  const 여섯 = [];
  for(let k = 0; k < 8; k++) 여섯.push(F.자리잡기(100, 200, '아주아주긴이름표입니다'));
  T('★★★ 여섯 자리가 다 막히면 **안 그린다** (null)', 여섯.some(v => v === null), 여섯.length);
  const d = F.자리잡기(600, 200, '멀리');   // 멀리 떨어진 것은 1순위 그대로
  T('★★★ 멀리 떨어진 이름표는 1순위 자리에 그대로 놓인다', !!d && d.x > 600 && d.y < 200, d);
  // ★ 한글·한자는 로마자보다 넓다. 좁게 재면 자리를 잡아 놓고도 실제로는 겹친다.
  T('★★★ 한글 폭을 로마자보다 넓게 잰다', F.글자폭('가나다') > F.글자폭('abc'),
    [F.글자폭('가나다'), F.글자폭('abc')]);

  // ★ 이름표를 그리는 곳이 셋이다 (출발·도착 / 정박지 / 중간 기록 깃발).
  //   **셋 다** 이 문을 지나야 한다. 한 곳이라도 빠지면 그 이름표가 남의 것 위에 얹힌다.
  const 쓴곳 = (mp.match(/자리잡기\(sx\(p\)/g) || []).length;
  T('★★★ 이름표를 그리는 세 곳이 모두 그 문을 쓴다', 쓴곳 >= 3, 쓴곳);
  T('★★★ 자리를 못 잡으면 그 이름표는 안 그린다',
    (mp.match(/if\(자\)/g) || []).length >= 3, (mp.match(/if\(자\)/g) || []).length);
  T('★★★ 몇 개를 가렸는지 사람에게 알린다 (몰래 지우지 않는다)', /가린이름/.test(src) && /mapHidLbl/.test(src));
  // ★ 점을 그리는 곳이 세 군데다. **하나라도** 자리를 흔들면 어디였는지가 틀어진다.
  const 점들 = mp.match(/class="mdot" style="left:[^"]*"/g) || [];
  T('★★★ 점은 안 옮긴다 — 이름표만 내린다 (어디였는지가 틀어지면 안 된다)',
    점들.length >= 2 && 점들.every(x => /left:\$\{sx\(p\)\.toFixed\(1\)\}px;top:\$\{sy\(p\)\.toFixed\(1\)\}px/.test(x)),
    점들);
}

// ══ 5. 앱 만드는 사람 말을 안 쓴다 ════════════════════════════════
{
  T('★★★ 「수리 탭」 이 화면에서 없어졌다 (「정비 탭」 과 같은 자리)',
    !/t\('수리 탭'\)/.test(src));
  T('★★★ 「정비 탭」 도 없다', !/t\('정비 탭'\)/.test(src));
}

// ══ 6. 새로 쓴 말이 네 나라 말에 다 있다 ═══════════════════════════
{
  ['{what} 시각도 {t}로 함께 넣었습니다.','지금 출발 (시각·위치·날씨)'].forEach(k=>{
    ['en','ru','ja'].forEach(lg=>{
      const i = src.indexOf('\n  ' + lg + ': {');
      const j = src.indexOf('\n  },', i);
      T(lg + ' 에 「' + k.slice(0,20) + '」 이 있다', src.slice(i, j).indexOf("'" + k + "'") >= 0);
    });
  });
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
