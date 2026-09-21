// 항해 시간 / 엔진 시간 계산 검증
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
globalThis.alert = ()=>{};
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
{ const m = src.match(/const SAIL_ENGINE = [^;]+;/); if(m) eval(m[0].replace('const SAIL_ENGINE','globalThis.SAIL_ENGINE')); }

{ const m = src.match(/const round1 = [^;]+;/); if(m) eval(m[0].replace('const round1','globalThis.round1')); }
function grabFn(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
eval('globalThis.hm = ' + grabFn(src, 'hm'));
eval('globalThis.logEngine = ' + grabFn(src, 'logEngine'));
const need = ['hhmmToH','sailHours','engineHoursFromLogs'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// 시각 → 시간
T('시각을 시간으로 바꾼다', hhmmToH('10:30')===10.5);
T('자정도 된다', hhmmToH('00:00')===0);
T('빈 값은 null', hhmmToH('')===null && hhmmToH(null)===null);
T('이상한 값은 null', hhmmToH('아무거나')===null);
T('자릿수가 모자라도 읽는다 (13:1 → 13:01)', hhmmToH('13:1')===13+1/60);
T('시각 표기를 두 자리로 맞춘다', hm('13:1')==='13:01' && hm('9:5')==='09:05');
T('이미 맞으면 그대로', hm('13:01')==='13:01');

// 항해 시간
T('출발 도착으로 계산', sailHours({timeOut:'10:38', timeIn:'14:42'})===4.1);
T('자정을 넘겨도 된다', sailHours({timeOut:'22:00', timeIn:'02:00'})===4);
T('한쪽이 없으면 null', sailHours({timeOut:'10:00'})===null);

// 엔진 시간 — 중간 기록의 엔진ON/OFF 구간을 더한다
const V = logs => ({ timeOut:'10:00', timeIn:'14:00', logs });
T('엔진 기록이 없으면 항해 내내 켠 것으로 본다',
  engineHoursFromLogs(V([]))===4);
T('세일을 올리면 그때부터 엔진이 꺼진다',
  engineHoursFromLogs(V([{time:'11:00', kind:'세일 올림'}]))===1);
T('세일을 내리면 다시 켜진다 (10~11 + 13~14 = 2h)',
  engineHoursFromLogs(V([{time:'11:00', kind:'세일 올림'},
                         {time:'13:00', kind:'세일 내림'}]))===2);
T('엔진OFF·ON 도 그대로 먹힌다',
  engineHoursFromLogs(V([{time:'11:00', kind:'엔진OFF'},
                         {time:'12:00', kind:'엔진ON'}]))===3);
T('세일과 엔진 기록이 섞여도 시각순으로 본다',
  engineHoursFromLogs(V([{time:'13:00', kind:'엔진ON'},
                         {time:'11:00', kind:'세일 올림'}]))===2);
T('엔진 시간이 항해 시간을 넘지 않는다',
  engineHoursFromLogs(V([{time:'09:00', kind:'엔진ON'}]))<=4);
T('상관없는 기록은 무시한다',
  engineHoursFromLogs(V([{time:'11:00', kind:'관측'}]))===4);
T('출발·도착이 없으면 null', engineHoursFromLogs({logs:[]})===null);

// 세일 ↔ 엔진 짝
T('세일 올림은 엔진OFF', SAIL_ENGINE['세일 올림']==='엔진OFF');
T('세일 올림 기록은 엔진 끔으로 본다', logEngine({kind:'세일 올림'})==='off');
T('세일 내림 기록은 엔진 켬으로 본다', logEngine({kind:'세일 내림'})==='on');
T('직접 정한 값이 짐작보다 먼저다', logEngine({kind:'세일 올림', eng:'on'})==='on');
T('그대로를 고르면 엔진을 안 건드린다', logEngine({kind:'세일 올림', eng:'keep'})==='keep');
T('상관없는 기록은 그대로', logEngine({kind:'관측'})==='keep');
T('그대로인 기록은 엔진 시간에 영향 없다',
  engineHoursFromLogs({timeOut:'10:00', timeIn:'14:00',
    logs:[{time:'11:00', kind:'세일 올림', eng:'keep'}]})===4);
T('세일을 올렸어도 엔진을 켜 뒀다고 고칠 수 있다',
  engineHoursFromLogs({timeOut:'10:00', timeIn:'14:00',
    logs:[{time:'11:00', kind:'세일 올림', eng:'on'}]})===4);
T('세일 내림은 엔진ON', SAIL_ENGINE['세일 내림']==='엔진ON');

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
