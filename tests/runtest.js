// 엔진 켜고 끄기 — 가동시간을 앱이 셈하는가 (4.109)
//
// ★ 사장님 말씀
//   「지금은 처음에 몇 시부터 한지는 들어가는데, 나중에 얼마나 돌렸는지는
//    계산해 가지고 넣어야 돼. 그게 조금 그렇네.」
//
// ★ 왜 여기를 검사로 묶나
//   엔진 시간은 **정기점검 주기의 근거**다(engNow → mHourLeft). 여기가 틀리면
//   「250시간마다 오일」 같은 것이 조용히 어긋나 정비 때를 놓친다.
//   숫자가 틀려도 화면은 멀쩡해 보이므로 사람 눈으로는 못 잡는다.
//
// ★ 특히 지키는 것 셋
//   ① 자정을 넘겨도 맞는다 (23:30 켜서 01:00 끄면 1시간 30분)
//   ② 돌고 있는 동안에도 총 가동시간에 들어간다 — 안 그러면 정기점검이 「아직 멀었다」 고 거짓말한다
//   ③ 손으로 적은 가동시간을 함부로 덮지 않는다
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(JSON.stringify(w)).slice(0, 260) : '')); } };

const need = ['runOn', 'runAt', 'runMins', 'runSync', 'runStop', 'addRun', 'engineHours', 'durText'];
const miss = need.filter(f => !grab(src, f));
if(miss.length){
  console.log('★ 실패: 함수가 없습니다 — ' + miss.join(', '));
  console.log('\n합계: 0개 통과 / ' + miss.length + '개 실패');
  process.exit(1);
}

// ── 앱 바깥에서 돌리기
globalThis.window = {};
globalThis.t = x => String(x);
globalThis.tsub = (x, o) => String(x).replace(/\{(\w+)\}/g, (_, k) => (o && o[k] != null ? o[k] : ''));
globalThis.hm = x => { const m = String(x || '').match(/^(\d{1,2}):(\d{2})$/);
  return m ? String(m[1]).padStart(2, '0') + ':' + m[2] : ''; };
{ const m = src.match(/const RUN_MAXH = \d+;/); if(m) eval(m[0].replace('const RUN_MAXH', 'globalThis.RUN_MAXH')); }
for(const f of ['runOn', 'runAt', 'runMins', 'runSync', 'durText']){
  eval('globalThis.' + f + ' = ' + grab(src, f));
}

// ══════════════════════════════════════════════════════
// ① 켠 때와 끈 때로 셈한다
// ══════════════════════════════════════════════════════
const R = (o) => Object.assign({ id:'r1', date:'2026-09-08', time:'', endDate:'', endTime:'',
                                 on:false, hours:'', purpose:'충전' }, o);

T('①-1 켠 때 · 끈 때가 있으면 분으로 셈한다',
  runMins(R({ time:'09:00', endTime:'11:30' })) === 150,
  runMins(R({ time:'09:00', endTime:'11:30' })));
T('①-2 1분도 센다', runMins(R({ time:'09:00', endTime:'09:01' })) === 1);
T('①-3 같은 시각이면 0분', runMins(R({ time:'09:00', endTime:'09:00' })) === 0);

// ★★ 자정 넘기기 — 배에서 실제로 있는 일이다
T('①-4 ★★ 자정을 넘겨도 맞는다 (23:30 → 01:00 은 1시간 30분)',
  runMins(R({ time:'23:30', endTime:'01:00' })) === 90,
  runMins(R({ time:'23:30', endTime:'01:00' })));
T('①-5 ★ 끝난 날짜를 적어 두면 그것을 그대로 믿는다 (하루 넘게 돌린 항해)',
  runMins(R({ date:'2026-09-08', time:'09:00', endDate:'2026-09-10', endTime:'09:00' })) === 2880,
  runMins(R({ date:'2026-09-08', time:'09:00', endDate:'2026-09-10', endTime:'09:00' })));

T('①-6 켠 시각이 없으면 셈하지 않는다', runMins(R({ endTime:'11:00' })) === null);
T('①-7 끈 시각이 없으면 셈하지 않는다', runMins(R({ time:'09:00' })) === null);
T('①-8 날짜가 없으면 셈하지 않는다', runMins(R({ date:'', time:'09:00', endTime:'11:00' })) === null);

// ══════════════════════════════════════════════════════
// ② 돌고 있는 동안은 「지금까지」
// ══════════════════════════════════════════════════════
{
  const now = new Date('2026-09-08T12:00:00');
  T('②-1 ★ 돌고 있으면 지금까지를 센다',
    runMins(R({ time:'09:00', on:true }), now) === 180,
    runMins(R({ time:'09:00', on:true }), now));
  T('②-2 ★ 돌고 있으면 끈 시각을 안 본다 (잘못 적혀 있어도)',
    runMins(R({ time:'09:00', endTime:'09:30', on:true }), now) === 180);
  T('②-3 켠 때가 미래여도 뒤로 안 간다',
    runMins(R({ time:'13:00', on:true }), now) === 0);
}

// ══════════════════════════════════════════════════════
// ③ 셈한 값을 넣는다
// ══════════════════════════════════════════════════════
{
  const a = R({ time:'09:00', endTime:'11:30' });
  runSync(a);
  T('③-1 ★ 가동시간이 시간 단위로 들어간다 (150분 → 2.5)', a.hours === 2.5, a.hours);

  const b = R({ time:'09:00', endTime:'09:20' });
  runSync(b);
  T('③-2 ★ 소수 둘째 자리까지 (20분 → 0.33)', b.hours === 0.33, b.hours);

  const c = R({ time:'23:30', endTime:'01:00' });
  runSync(c);
  T('③-3 ★ 자정 넘긴 것도 넣는다', c.hours === 1.5, c.hours);

  // ★★ 돌고 있는 것은 안 건드린다 — 아직 안 끝난 값을 넣어 버리면
  //   나중에 진짜로 끌 때 사람이 이미 값이 있는 줄 알고 넘어간다
  const d = R({ time:'09:00', on:true, hours:'' });
  runSync(d);
  T('③-4 ★★ 돌고 있는 동안에는 가동시간을 안 넣는다', d.hours === '', d.hours);

  // ★ 끈 시각이 없으면 손으로 적은 값을 그대로 둔다
  const e = R({ time:'09:00', hours:3.5 });
  runSync(e);
  T('③-5 ★ 끈 시각이 없으면 손으로 적은 값을 안 덮는다', e.hours === 3.5, e.hours);
}

// ══════════════════════════════════════════════════════
// ④ 총 가동시간 — 정기점검 주기의 근거다
// ══════════════════════════════════════════════════════
{
  eval('globalThis.engineHours = ' + grab(src, 'engineHours'));
  globalThis.voyage = [{ engineH: 10 }];
  globalThis.runs = [{ id:'a', date:'2026-09-08', time:'09:00', endTime:'11:00', on:false, hours: 2 }];
  T('④-1 항해와 엔진가동을 더한다', engineHours().total === 12, engineHours());

  // ★★ 돌고 있는 것도 세야 한다
  const 시작 = new Date(Date.now() - 90 * 60000);
  const p = n => String(n).padStart(2, '0');
  globalThis.runs.push({ id:'b',
    date: 시작.getFullYear() + '-' + p(시작.getMonth() + 1) + '-' + p(시작.getDate()),
    time: p(시작.getHours()) + ':' + p(시작.getMinutes()), on:true, hours:'' });
  const 총 = engineHours().total;
  T('④-2 ★★ 지금 돌고 있는 것도 총 가동시간에 든다 (안 세면 정기점검이 거짓말한다)',
    Math.abs(총 - 13.5) < 0.05, 총);
  globalThis.runs.pop();
}

// ══════════════════════════════════════════════════════
// ⑤ 화면과 이어져 있는가
// ══════════════════════════════════════════════════════
{
  const ar = grab(src, 'addRun') || '';
  T('⑤-1 ★ 켜면 「돌고 있음」으로 시작한다', /on:\s*true/.test(ar), ar);
  T('⑤-2 켠 시각을 앱이 찍는다', /time:\s*nowHM\(\)/.test(ar));
  T('⑤-3 끝난 자리를 미리 비워 둔다', /endDate:\s*''/.test(ar) && /endTime:\s*''/.test(ar));

  const st = grab(src, 'runStop') || '';
  T('⑤-4 ★ 끄면 끈 날짜·시각을 찍는다',
    /it\.endDate = today\(\)/.test(st) && /it\.endTime = nowHM\(\)/.test(st), st.slice(0, 300));
  T('⑤-5 ★ 끄면 「돌고 있음」을 내린다', /it\.on = false/.test(st));
  T('⑤-6 ★ 끄면 그 자리에서 셈해 넣는다', /runSync\(it\)/.test(st));
  T('⑤-7 껐다고 알려 준다', /엔진을 껐습니다/.test(st));
  T('⑤-8 클라우드에도 올린다', /schedulePush/.test(st));

  T('⑤-9 ★ 잘못 껐을 때 되돌릴 길이 있다', !!grab(src, 'runResume'));
  const rs = grab(src, 'runResume') || '';
  T('⑤-10 되돌리면 끈 시각과 가동시간을 지운다',
    /it\.endTime = ''/.test(rs) && /it\.hours = ''/.test(rs), rs);

  const ts = grab(src, 'runTimeSet') || '';
  T('⑤-11 ★ 시각을 고치면 가동시간을 다시 셈한다', /runSync\(it\)/.test(ts), ts);

  T('⑤-12 ★ 「지금 껐습니다」 단추가 화면에 있다',
    /runStopUI\(/.test(grab(src, 'runOnBox') || ''), grab(src, 'runOnBox'));
  // ★ 보기 전용이어도 단추를 감추지 않는다 — 감추면 기능이 없는 줄 안다 (앱의 규칙).
  //   backtest 가 「unlocked ? `<button」 꼴을 잡아 준다. 여기서는 needEdit 을 지나는지 본다.
  T('⑤-12b ★★ 보기 전용에서 단추를 감추지 않고, 눌렀을 때 풀어 준다',
    /needEdit\(/.test(grab(src, 'runStopUI') || ''), grab(src, 'runStopUI'));
  T('⑤-12c ★ 「돌고 있음」 틀을 제 함수로 뺐다 (겹겹이 낀 틀문자열은 사전 검사기가 못 읽는다)',
    !!grab(src, 'runOnBox'));
  T('⑤-13 돌고 있으면 목록에서 눈에 띈다', /돌고 있음/.test(src));
  T('⑤-14 ★ 끄는 것을 잊으면 알려 준다', /const RUN_MAXH = \d+;/.test(src) && /하루가 넘었습니다/.test(src));
  T('⑤-15 켠 시각 · 끈 시각 두 칸이 있다',
    /'켠 시각'/.test(src) && /'끈 시각'/.test(src));
  T('⑤-16 ★ 끈 시각 칸이 runTimeSet 을 지난다',
    /runTimeSet\('endTime', v\)/.test(src));
}

// ══════════════════════════════════════════════════════
// ⑥ 새 낱말이 세 언어에 다 있는가
// ══════════════════════════════════════════════════════
{
  const dict = l => (src.match(new RegExp('\\n  ' + l + ': \\{[\\s\\S]*?\\n  \\},')) || [''])[0];
  const EN = dict('en'), RU = dict('ru'), JA = dict('ja');
  T('⑥-0 사전 셋을 읽었다', EN.length > 1000 && RU.length > 1000 && JA.length > 1000);
  ['엔진이 돌고 있습니다', '지금 껐습니다', '켠 시각', '끈 시각', '돌고 있음',
   '아직 돌고 있습니다', '{d} {t}부터', '엔진을 껐습니다 — {v} 돌렸습니다',
   '적으시면 가동시간이 저절로 계산됩니다',
   '하루가 넘었습니다. 끄는 것을 잊으셨다면 시각을 고쳐 주세요.'].forEach(w => {
    const q = "'" + w + "':";
    T('⑥ 「' + w.slice(0, 18) + '」 세 언어', EN.indexOf(q) >= 0 && RU.indexOf(q) >= 0 && JA.indexOf(q) >= 0,
      { en: EN.indexOf(q) >= 0, ru: RU.indexOf(q) >= 0, ja: JA.indexOf(q) >= 0 });
  });
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
