// 시간대 — 한국이 아닌 곳에서도 시각이 어긋나지 않는가.
//
// ★ 왜 이 검사가 있나
//   앱은 사람이 적은 시각을 무조건 한국 시각(+09:00)으로 읽고, 화면에는 기기 시각으로 썼다.
//   한국에서는 두 시계가 같아 아무 일도 없다. 그래서 여태 안 걸렸다.
//   그런데 러시아어 판을 냈다. 블라디보스토크(UTC+10)에서 13:36 으로 적은 출항이
//   화면에 14:36 으로 나온다. 실측으로도 04:52 로 적은 것이 19:52 로 나왔다.
//
//   이 검사는 시간대를 바꿔 가며 돌린다. 서울·블라디보스토크·모스크바·런던.
const { execFileSync } = require('child_process');
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const src = fs.readFileSync(FILE, 'utf8');

let pass=0, fail=0;
const T=(n,c,w)=>{ if(c){pass++;console.log('통과: '+n);}
  else{fail++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,140):''));} };

// ── 코드에 표준시가 박혀 있지 않은가
{
  const body = src.replace(/^\s*\/\/.*$/gm, '');       // 주석은 뺀다
  T('코드에 +09:00 이 박혀 있지 않다', !/\+09:00/.test(body),
    (body.match(/.{0,40}\+09:00.{0,20}/) || [''])[0]);
  T('예보를 그 자리 표준시로 받는다 (timezone=auto)',
    !/timezone=Asia%2FSeoul/.test(body) && (body.match(/timezone=auto/g) || []).length >= 2);
  T('예보 시각을 읽는 곳이 한 군데로 모여 있다', /function wxTs\(str, d\)/.test(src));
  T('자료가 준 표준시를 쓴다', /utc_offset_seconds/.test(src));
}

// ── 실제로 돌려 본다 (시간대를 바꿔 가며)
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d=0, j=src.indexOf('{', i);
  for(; j<src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
const CODE = [grab('tsOf'), grab('fmtWhen'), grab('wxOffStr'), grab('wxOff'),
              grab('wxTs'), grab('wxHourIndex')].join('\n');

function runIn(tz, body){
  return execFileSync(process.execPath, ['-e', CODE + '\n' + body],
    { env: { ...process.env, TZ: tz }, encoding:'utf8' }).trim();
}

const ZONES = [['Asia/Seoul','서울'], ['Asia/Vladivostok','블라디보스토크'],
               ['Europe/Moscow','모스크바'], ['Europe/London','런던'],
               ['America/New_York','뉴욕']];

// ㉮ 적은 시각과 보이는 시각이 같은가 — 이것이 핵심이다
for(const [tz, name] of ZONES){
  const out = runIn(tz, `
    const ts = tsOf('2026-08-17', '13:36');
    console.log(fmtWhen(ts));`);
  T(name + ' — 13:36 으로 적으면 13:36 으로 보인다', /13:36$/.test(out), tz + ' → ' + out);
}
// 날짜가 넘어가는 자리도
for(const [tz, name] of ZONES){
  const out = runIn(tz, `console.log(fmtWhen(tsOf('2026-08-17','23:50')));`);
  T(name + ' — 자정 가까운 시각도 그대로', /2026-08-17 23:50$/.test(out), tz + ' → ' + out);
}

// ㉯ 예보 시각 — 자료가 준 표준시로 읽는다
{
  const out = runIn('Europe/London', `
    // 예보가 +09:00 자리에서 왔다고 하자
    const d = { w: { utc_offset_seconds: 32400 } };
    const ms = wxTs('2026-08-17T13:00', d);
    console.log(ms === Date.parse('2026-08-17T13:00+09:00') ? 'OK' : 'BAD ' + ms);`);
  T('예보 시각을 자료의 표준시로 읽는다 (기기 시계를 안 쓴다)', out === 'OK', out);

  const out2 = runIn('Asia/Seoul', `
    const d = { w: { utc_offset_seconds: -14400 } };   // 뉴욕 여름
    const ms = wxTs('2026-08-17T13:00', d);
    console.log(ms === Date.parse('2026-08-17T13:00-04:00') ? 'OK' : 'BAD ' + ms);`);
  T('한국 폰으로 봐도 예보는 그 자리 표준시로 읽는다', out2 === 'OK', out2);
}

// ㉰ 예보 칸 고르기 — 적은 시각에 맞는 칸을 고르는가
{
  const out = runIn('Asia/Vladivostok', `
    // 블라디보스토크(+10) 앞바다 예보 — 자료도 +10 으로 온다
    globalThis.wxData = { w: { utc_offset_seconds: 36000 } };
    const times = [];
    for(let h=0; h<24; h++) times.push('2026-08-17T' + String(h).padStart(2,'0') + ':00');
    const ts = tsOf('2026-08-17', '13:36');      // 사람이 13:36 에 출항
    console.log(wxHourIndex(times, ts));`);
  T('블라디보스토크에서 13:36 출항 → 14시 예보 칸을 고른다', out === '14', out);

  const out2 = runIn('Asia/Seoul', `
    globalThis.wxData = { w: { utc_offset_seconds: 32400 } };
    const times = [];
    for(let h=0; h<24; h++) times.push('2026-08-17T' + String(h).padStart(2,'0') + ':00');
    console.log(wxHourIndex(times, tsOf('2026-08-17','13:36')));`);
  T('서울에서도 그대로 14시 칸 (달라지지 않았다)', out2 === '14', out2);
}

// ㉱ 표준시 글자 만들기
{
  const out = runIn('UTC', `
    console.log([wxOffStr(32400), wxOffStr(0), wxOffStr(-14400), wxOffStr(19800), wxOffStr(null)].join(' '));`);
  T('표준시 글자를 제대로 만든다 (+09:00 · +00:00 · -04:00 · +05:30 · Z)',
    out === '+09:00 +00:00 -04:00 +05:30 Z', out);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
