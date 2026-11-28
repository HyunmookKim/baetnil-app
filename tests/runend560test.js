// 5.60 — 엔진 끄는 것을 잊었을 때: 돌고 있는 기록에 정지 시각을 넣어 끝낸다
// ★ 사장님 (2026-11-27): 「이건 내가 나중에 3시간 돌렸다고 쓰고 싶어도 못쓰게 되있네」
//   돌고 있는 화면에는 「지금 껐습니다」 만 있어서 지금 시각으로만 끌 수 있었다.
//   Clockify 모바일처럼(돌고 있는 기록을 열어 끝 시각을 고침) 정지 시각 칸을 둔다.
// ★ 같이 고친 것: 「지금 껐습니다」 를 며칠 뒤에 눌러 끈 날짜가 그날로 들어가면,
//   정지 시각만 고쳐서는 가동시간이 안 맞았다 → 「종료일」 칸 · 자정 넘김 자동.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', 'www', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(d===0){ j++; break; } } }
  return s.slice(i, j);
}
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w) : '')); } };

for(const f of ['runEndAt','runTimeSet','runOn','runAt','runMins','runSync','addDay','durText'])
  if(!grab(src, f)){ console.log('★ 실패: 함수 없음 ' + f); process.exit(1); }

globalThis.unlocked = true;
globalThis.t = x => String(x);
globalThis.tsub = (x, o) => String(x).replace(/\{(\w+)\}/g, (_, k) => (o && o[k] != null ? o[k] : ''));
globalThis.hm = x => { const m = String(x || '').match(/^(\d{1,2}):(\d{2})$/); return m ? m[1].padStart(2,'0') + ':' + m[2] : ''; };
globalThis.dParts = s => { const m = String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? {y:+m[1], m:+m[2], d:+m[3]} : null; };
globalThis.today = () => '2026-11-27';
let told = [];
globalThis.tell = (m) => told.push(m);
globalThis.saveMR = () => {}; globalThis.schedulePush = () => {}; globalThis.renderFuel = () => {};
globalThis.openMR = () => {};
let IT = null;
globalThis.mrOpenId = 'r1';
globalThis.getMR = () => IT;
for(const f of ['runEndAt','runTimeSet','runOn','runAt','runMins','runSync','addDay','durText'])
  eval('globalThis.' + f + ' = ' + grab(src, f));

const R = o => Object.assign({ id:'r1', date:'2026-11-26', time:'21:47', endDate:'', endTime:'', on:true, hours:'' }, o);

// ① 사장님 화면 그대로: 11-26 21:47 시동, 끄는 것을 잊음 → 정지 00:47 입력 → 3시간
IT = R(); runEndAt('00:47');
T('①-1 정지 시각을 넣으면 가동이 끝난다', IT.on === false, IT.on);
T('①-2 자정을 넘긴 정지 시각은 다음 날로', IT.endDate === '2026-11-27' && IT.endTime === '00:47', [IT.endDate, IT.endTime]);
T('①-3 ★ 가동시간 3시간', IT.hours === 3 && runMins(IT) === 180, [IT.hours, runMins(IT)]);
T('①-4 끈 뒤 알림을 띄운다', told.length === 1 && /3/.test(told[0]), told);

// ② 같은 날 안에서 끈 시각
IT = R({ date:'2026-11-27', time:'09:00' }); runEndAt('11:30');
T('②-1 같은 날 11:30 → 2시간 30분', IT.endDate === '2026-11-27' && runMins(IT) === 150, [IT.endDate, runMins(IT)]);

// ③ 잘못 친 값이면 끝내지 않는다
IT = R(); runEndAt('');
T('③-1 빈 값이면 계속 돈다', IT.on === true);
IT = R(); runEndAt('25:99x');
T('③-2 시각 꼴이 아니면 계속 돈다', IT.on === true);

// ④ 「지금 껐습니다」 를 며칠 뒤에 누른 기록 — 끈 날짜를 고치면 맞게 셈한다
IT = R({ on:false, endDate:'2026-11-28', endTime:'10:00' }); runSync(IT);
T('④-0 (고치기 전) 며칠 뒤에 끄면 36시간 넘게 잡힌다', runMins(IT) > 36*60, runMins(IT));
runTimeSet('endTime', '00:47');
T('④-1 정지 시각만 고치면 끈 날짜는 그대로 (11-28 00:47)', IT.endDate === '2026-11-28', IT.endDate);
runTimeSet('endDate', '2026-11-27');
T('④-2 ★ 종료일을 고치면 3시간', runMins(IT) === 180 && IT.hours === 3, [runMins(IT), IT.hours]);
runTimeSet('endDate', '2026-11-20');
T('④-3 종료일은 시동 날짜보다 앞일 수 없다', IT.endDate === '2026-11-27', IT.endDate);

// ⑤ 끈 날짜를 시동 날짜로 적어 두고 정지 시각을 시동보다 앞으로 적으면 셈하지 않는다
//   (runlive ⑤-2 가 지키는 옛 규칙 — 거꾸로 된 값으로 총 가동시간이 줄면 안 된다. 날짜는 「종료일」 에서 고친다)
IT = R({ on:false, endDate:'2026-11-26', endTime:'23:00' }); runSync(IT);
const 전 = IT.hours;
runTimeSet('endTime', '01:15');
T('⑤-1 끈 날짜는 그대로 · 가동시간도 옛값 그대로', IT.endDate === '2026-11-26' && IT.hours === 전, [IT.endDate, IT.hours, 전]);
runTimeSet('endDate', '2026-11-27');
T('⑤-2 종료일을 다음 날로 고치면 맞게 셈한다 (3시간 28분)', runMins(IT) === 208, runMins(IT));

// ⑥ 시동 날짜를 끈 날짜 뒤로 옮기면 끈 날짜가 따라간다
IT = R({ on:false, endDate:'2026-11-26', endTime:'23:00' });
runTimeSet('date', '2026-11-28');
T('⑥-1 끈 날짜도 11-28', IT.endDate === '2026-11-28', IT.endDate);

// ⑦ 화면: 돌고 있을 때 정지 시각 칸 · 끈 뒤 종료일 칸
const body = src.slice(src.indexOf("} else if(kind==='run'){"), src.indexOf("} else if(kind==='fuel' && it.kind==='level'){"));
T('⑦-1 돌고 있을 때 정지 시각 칸이 runEndAt 으로 간다', /hmRow\('정지 시각', '', "v => runEndAt\(v\)"/.test(body));
T('⑦-2 끈 뒤 종료일 칸 (정지 시각이 있을 때만, 시동 날짜보다 앞 못 고름)', /it\.endTime \? 날짜칸\('종료일', 'endDate', it\.endDate \|\| it\.date, it\.date\)/.test(body));
T('⑦-3 날짜를 고쳐도 가동시간을 다시 셈한다 (mrField 가 아니라 runTimeSet)', !/tf\('날짜','date'/.test(body) && /runTimeSet\('\$\{key\}'/.test(body));
T('⑦-4 가동시간 칸은 돌고 있을 때 여전히 안 보인다', !/도는중\s*\n?\s*\? runOnBox\(it\)[^:]*durRow/.test(body));
T('⑦-5 「종료일」 은 이미 있는 말 (ja·en·ru)', (src.match(/'종료일':'/g) || []).length >= 3);

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
