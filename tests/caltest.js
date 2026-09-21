// 달력 — 흩어져 있는 날짜를 한 장에 모아 보는 화면
//
// ★ 이 검사가 지키는 것 (제일 중요한 것부터)
//   ① 달력은 **읽기만 한다.** 아무것도 저장하지 않는다.
//      달력이 기록을 건드리기 시작하면, 잘못 만들었을 때 항해일지·정비 기록이 상한다.
//      그래서 calItems 를 돌리는 동안 save·saveMR 이 한 번이라도 불리면 실패로 본다.
//   ② 새 저장 칸을 만들지 않는다. 한 배의 기록이 어느 칸에 있는지가 네 곳에
//      손으로 나열돼 있어서(colltest 가 지킨다), 칸을 더하면 스무 곳을 고쳐야 한다.
//      한 곳만 빠뜨려도 기록이 조용히 사라진다. 그래서 칸 수가 그대로여야 한다.
//   ③ 정기점검은 **다음 할 날**로 들어간다. 마지막에 한 날이 아니다.
//      마지막 한 날로 넣으면 달력에 지난 일만 쌓이고 앞으로 할 일이 안 보인다.
//   ④ 내보내는 달력 파일이 규격을 지킨다. 한 줄이라도 어긋나면 구글·아이폰이
//      말없이 안 읽는다 — 사람은 「눌렀는데 아무 일도 없다」 로만 겪는다.
const fs = require('fs');
const path = require('path');
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
const T = (n, c, w) => {
  if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(JSON.stringify(w)).slice(0, 300) : '')); }
};

// ══════════════════════════════════════════════════════
// 1. 화면이 제자리에 붙어 있는가
// ══════════════════════════════════════════════════════
const homesub = (src.match(/const HOMESUB_TITLES = \{[^}]*\}/) || [''])[0];
T('①-1 「오늘」 탭 갈래에 달력이 있다', /cal\s*:\s*t\('달력'\)/.test(homesub), homesub.slice(0, 200));
T('①-2 달력 화면 칸(calWrap)이 문서에 있다', /id="calWrap"/.test(src));
T('①-3 탭을 옮기면 달력이 켜지고 꺼진다',
  /show\('calWrap',\s*t==='home'\s*&&\s*homeSub==='cal'\)/.test(src));
T('①-4 그 갈래를 고르면 달력을 그린다',
  /homeSub\s*===\s*'cal'\s*\)\s*renderCal\(\)|else if\(homeSub==='cal'\) renderCal\(\)/.test(src));

// ══════════════════════════════════════════════════════
// 2. 새 저장 칸을 만들지 않았는가  ★★ 기록이 사라지는 것을 막는 자리
// ══════════════════════════════════════════════════════
const listOf = re => { const m = src.match(re); return m ? (m[0].match(/'[^']+'/g) || []).map(x => x.slice(1, -1)) : null; };
const SY = listOf(/const SYNC_COLLS = \[[\s\S]*?\];/);
T('②-1 동기화 칸 목록을 읽었다', !!SY);
T('②-2 저장 칸이 열여섯 그대로다 (달력이 칸을 안 늘렸다)', SY && SY.length === 16, SY && SY.length);
T('②-3 달력 이름의 저장 칸이 없다', SY && SY.every(x => !/^cal/i.test(x)), SY);

// ══════════════════════════════════════════════════════
// 3. 실제로 돌려 본다
// ══════════════════════════════════════════════════════
const need = ['calItems', 'calIcs', 'mStatus', 'mHourLeft', 'addPeriod', 'addMonths',
              'fmtDate', 'vdocDue', 'maintRows', 'mlogRows', 'icsEsc', 'icsFold'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 실패: 함수가 없습니다 — ' + missing.join(', '));
  bad += missing.length;
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(1);
}

// ── 앱 바깥에서 돌리기 위한 최소한의 자리
globalThis.window = {};
globalThis.saved = 0;
globalThis.save   = () => { globalThis.saved++; };
globalThis.saveMR = () => { globalThis.saved++; };
globalThis.t    = x => String(x);
globalThis.tsub = (x, o) => String(x).replace(/\{(\w+)\}/g, (_, k) => (o && o[k] != null ? o[k] : ''));
globalThis.esc  = x => String(x);
globalThis.engNow  = () => 0;
globalThis.curBoat = () => ({ name: '테스트배' });
globalThis.isPlan  = v => !!(v && v.plan);
globalThis.isGear  = x => !!(x && x.typ === 'gear');
globalThis.isMlog  = x => !!(x && x.typ === 'log');
globalThis.VDOC_BEFORE = 30;
globalThis.mlogTitle = x => String((x && x.title) || '정비수첩');
globalThis.tideName = () => '';
globalThis.APP_VER = '0';

{ const m = src.match(/const CAL_KINDS = \{[\s\S]*?\n\};/);
  if(!m){ console.log('★ 실패: 갈래 표(CAL_KINDS)가 없습니다'); process.exit(1); }
  eval(m[0].replace('const CAL_KINDS', 'globalThis.CAL_KINDS')); }

for(const f of ['mHourLeft', 'addMonths', 'addPeriod', 'fmtDate', 'vdocDue',
                'maintRows', 'mlogRows', 'mStatus', 'icsEsc', 'icsFold', 'calItems', 'calIcs']){
  eval('globalThis.' + f + ' = ' + grab(src, f).replace(/^(async )?function /, (a, b) => (b || '') + 'function '));
}
globalThis.today = () => '2026-09-06';

// ── 가짜 기록. 여섯 갈래를 하나씩 둔다.
globalThis.voyage = [
  { id: 'v1', plan: true,  date: '2026-09-12', title: '광어 손님 8명' },
  { id: 'v2', plan: false, date: '2026-09-03', title: '여수 왕복' },
  { id: 'v3', plan: true,  date: '2026-11-30', title: '범위 밖 예정' }
];
globalThis.maint = [
  // 정기점검: 마지막이 6월 1일, 주기 3개월 → 다음은 9월 1일
  { id: 'm1', name: '엔진오일', lastDate: '2026-06-01', months: 3, unit: 'm',
    history: [{ date: '2026-06-01' }, { date: '2026-03-01' }, { date: '2025-12-01' }] },
  // 정비수첩: 9월 4일에 한 일
  { id: 'g1', typ: 'log', date: '2026-09-04', title: '임펠러 교체' },
  // 장비는 달력에 안 나온다
  { id: 'e1', typ: 'gear', name: '빌지펌프' }
];
globalThis.repair = [
  { id: 'r1', title: '빌지 스위치 고장', status: 'open',  created: '2026-09-02', doneDate: '' },
  { id: 'r2', title: '윈치 수리',        status: 'done',  created: '2026-08-20', doneDate: '2026-09-05' }
];
globalThis.vdocs = [
  { id: 'd1', title: '선박검사증', expiry: '2026-09-25' },
  { id: 'd2', title: '만료일 없음', expiry: '' }
];

globalThis.saved = 0;
const rows = calItems('2026-09-01', '2026-09-30');
// 넓은 범위 — 지난 정비 이력과 옛날에 올린 고장까지 본다
const wide = calItems('2025-01-01', '2026-12-31');
const byKind = k => rows.filter(r => r.kind === k);
const on = d => rows.filter(r => r.date === d);

T('③-1 ★★ 달력을 그리는 동안 아무것도 저장하지 않는다', globalThis.saved === 0, globalThis.saved);
T('③-2 예정을 모은다',        byKind('plan').length === 1 && byKind('plan')[0].id === 'v1', byKind('plan'));
T('③-3 항해일지를 모은다',    byKind('voyage').length === 1 && byKind('voyage')[0].id === 'v2', byKind('voyage'));
T('③-4 정기점검을 모은다',    byKind('maint').length === 1, byKind('maint'));
T('③-5 정비수첩을 모은다',    byKind('mlog').length === 1 && byKind('mlog')[0].id === 'g1', byKind('mlog'));
T('③-6 수리를 모은다 (9월에는 올린 날 하나 + 고친 날 하나)',
  byKind('repair').length === 1 && byKind('repairDone').length === 1,
  { repair: byKind('repair'), repairDone: byKind('repairDone') });
T('③-7 문서 만료일을 모은다', byKind('vdoc').length === 1 && byKind('vdoc')[0].date === '2026-09-25', byKind('vdoc'));

T('③-8 ★ 정기점검은 「다음 할 날」로 들어간다 (마지막 한 날이 아니다)',
  byKind('maint')[0] && byKind('maint')[0].date === '2026-09-01', byKind('maint'));
T('③-9 장비는 달력에 안 나온다', rows.every(r => r.id !== 'e1'), rows.map(r => r.id));
T('③-10 만료일이 없는 문서는 안 나온다', rows.every(r => r.id !== 'd2'));
T('③-11 ★ 범위 밖 날짜는 안 들어온다 (11월 예정)', rows.every(r => r.id !== 'v3'), rows.map(r => r.date));
// ★★ 한 기록에 날짜가 여럿이면 그 날짜마다 다 올라와야 한다 (4.107 — 사장님 지적).
//   4.106 은 수리를 「고쳤으면 고친 날, 아니면 올린 날」 로 하나만 올렸다.
//   그러면 2일에 올려 5일에 고친 고장이 5일에만 보이고 2일은 빈 날이 된다.
T('③-13 안 고친 수리는 올린 날에 들어간다',
  byKind('repair').some(r => r.id === 'r1' && r.date === '2026-09-02'), byKind('repair'));
T('③-13b ★ 고친 날이 따로 올라간다',
  byKind('repairDone').some(r => r.id === 'r2' && r.date === '2026-09-05'), byKind('repairDone'));
T('③-13c ★ 지난 정기점검(마지막 한 날)이 올라간다',
  wide.some(r => r.kind === 'maintDone' && r.id === 'm1' && r.date === '2026-06-01'),
  wide.filter(r => r.kind === 'maintDone'));
T('③-13d ★ 정기점검 이력에 적힌 옛 날짜도 다 올라간다',
  wide.some(r => r.kind === 'maintDone' && r.date === '2026-03-01')
  && wide.some(r => r.kind === 'maintDone' && r.date === '2025-12-01'),
  wide.filter(r => r.kind === 'maintDone').map(r => r.date));
T('③-13e ★ 고장은 올린 날과 고친 날 두 줄이 된다',
  wide.filter(r => r.id === 'r2').length === 2
  && wide.some(r => r.id === 'r2' && r.kind === 'repair'     && r.date === '2026-08-20')
  && wide.some(r => r.id === 'r2' && r.kind === 'repairDone' && r.date === '2026-09-05'),
  wide.filter(r => r.id === 'r2'));
T('③-13f 같은 날이 두 번 적혀 있어도 한 줄만 올라간다 (마지막 한 날 = 이력 첫 줄)',
  wide.filter(r => r.kind === 'maintDone' && r.id === 'm1' && r.date === '2026-06-01').length === 1,
  wide.filter(r => r.kind === 'maintDone' && r.id === 'm1'));

T('③-14 줄마다 날짜·갈래·번호·이름·색이 다 있다',
  rows.length > 0 && rows.every(r => /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.kind && r.id != null
                                     && typeof r.title === 'string' && /^#[0-9A-Fa-f]{6}$/.test(r.color)),
  rows[0]);
T('③-15 날짜순으로 정렬돼 나온다',
  rows.every((r, i) => i === 0 || rows[i - 1].date <= r.date), rows.map(r => r.date));

// 같은 날에 여러 건이 있으면 다 나와야 한다
globalThis.voyage.push({ id: 'v4', plan: true, date: '2026-09-12', title: '오후 손님' });
const rows2 = calItems('2026-09-01', '2026-09-30');
T('③-16 한 날에 여러 건이 다 들어간다', rows2.filter(r => r.date === '2026-09-12').length === 2,
  rows2.filter(r => r.date === '2026-09-12'));
globalThis.voyage.pop();

// ══════════════════════════════════════════════════════
// 4. 내보내는 달력 파일
// ══════════════════════════════════════════════════════
const icsRaw = calIcs('2026-09-01', '2026-09-30');
// 접힌 줄을 도로 편다 (규격: CRLF 다음에 빈칸 하나면 앞줄에 이어 붙인다)
const unfold = s => String(s).replace(/\r\n[ \t]/g, '');
const ics = unfold(icsRaw);
const L = ics.split(/\r\n/);
T('④-1 줄 끝이 CRLF 다 (규격)', /\r\n/.test(icsRaw) && !/[^\r]\n/.test(icsRaw));
// ★ 접기는 **긴 줄이 실제로 생겨야** 검사가 된다.
//   짧은 자료만 넣고 「다 75바이트 아래」 라고 하면 접기를 안 해도 통과한다 —
//   실제로 그렇게 새는 것을 겪었다. 그래서 긴 이름을 일부러 하나 넣는다.
globalThis.voyage.push({ id:'vlong', plan:true, date:'2026-09-18',
  title:'가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호' });
const icsLong = calIcs('2026-09-01', '2026-09-30');
const longLines = icsLong.split(/\r\n/).map(x => Buffer.byteLength(x, 'utf8'));
T('④-1b0 ★ 검사 자체 점검 — 접지 않으면 75바이트를 넘을 만큼 긴 줄이 자료에 있다',
  Buffer.byteLength('SUMMARY:[예정] 가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호', 'utf8') > 75);
T('④-1b ★ 긴 줄은 75바이트에서 접힌다 (규격)',
  longLines.every(n => n <= 75), longLines.filter(n => n > 75));
T('④-1b2 ★ 접힌 줄을 펴면 긴 이름이 그대로 나온다',
  /SUMMARY:\[[^\]]*\] 가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호/
    .test(unfold(icsLong)),
  (unfold(icsLong).match(/SUMMARY:[^\r\n]*가나다[^\r\n]*/) || [''])[0]);
globalThis.voyage.pop();
T('④-1c ★ 접을 때 글자 가운데를 자르지 않는다 (한글이 안 깨진다)',
  !/\uFFFD/.test(Buffer.from(icsRaw, 'utf8').toString('utf8')) &&
  icsRaw.split(/\r\n/).every(x => !/[\uD800-\uDFFF]$/.test(x)));
T('④-1d 짧은 줄은 안 접는다', icsFold('VERSION:2.0') === 'VERSION:2.0');
T('④-1e ★ 접힌 줄을 도로 펴면 본디 글자가 나온다',
  (() => { const long = 'SUMMARY:' + '가나다라마바사아자차카타파하'.repeat(9);
           return unfold(icsFold(long)) === long; })());
T('④-2 BEGIN:VCALENDAR 로 시작한다', L[0] === 'BEGIN:VCALENDAR', L[0]);
T('④-3 END:VCALENDAR 로 끝난다', L.filter(x => x).slice(-1)[0] === 'END:VCALENDAR', L.slice(-3));
T('④-4 VERSION:2.0 이 있다', L.indexOf('VERSION:2.0') >= 0);
T('④-5 PRODID 가 있다', L.some(x => /^PRODID:/.test(x)), L.find(x => /^PRODID:/.test(x)));
T('④-6 CALSCALE:GREGORIAN 이 있다', L.indexOf('CALSCALE:GREGORIAN') >= 0);
T('④-7 일정 수가 달력에 모은 수와 같다',
  L.filter(x => x === 'BEGIN:VEVENT').length === rows.length,
  { 파일: L.filter(x => x === 'BEGIN:VEVENT').length, 달력: rows.length });
T('④-8 BEGIN:VEVENT 와 END:VEVENT 수가 같다',
  L.filter(x => x === 'BEGIN:VEVENT').length === L.filter(x => x === 'END:VEVENT').length);
T('④-9 일정마다 UID 가 있다', L.filter(x => /^UID:/.test(x)).length === rows.length);
T('④-10 UID 가 서로 겹치지 않는다',
  new Set(L.filter(x => /^UID:/.test(x))).size === rows.length);
T('④-11 일정마다 DTSTAMP 가 있다', L.filter(x => /^DTSTAMP:\d{8}T\d{6}Z$/.test(x)).length === rows.length,
  L.find(x => /^DTSTAMP/.test(x)));
T('④-12 ★ 하루 종일 일정이다 (DTSTART;VALUE=DATE)',
  L.filter(x => /^DTSTART;VALUE=DATE:\d{8}$/.test(x)).length === rows.length,
  L.find(x => /^DTSTART/.test(x)));
T('④-13 ★ 끝나는 날은 다음 날이다 (하루 종일 일정 규격)',
  (() => { const i = L.findIndex(x => x === 'BEGIN:VEVENT');
           const s = L.slice(i).find(x => /^DTSTART;VALUE=DATE:/.test(x));
           const e = L.slice(i).find(x => /^DTEND;VALUE=DATE:/.test(x));
           if(!s || !e) return false;
           const a = s.slice(-8), b = e.slice(-8);
           const d = new Date(a.slice(0,4)+'-'+a.slice(4,6)+'-'+a.slice(6)+'T00:00:00Z');
           d.setUTCDate(d.getUTCDate()+1);
           return b === d.toISOString().slice(0,10).replace(/-/g,''); })(),
  L.slice(L.findIndex(x => x === 'BEGIN:VEVENT'), L.findIndex(x => x === 'BEGIN:VEVENT') + 8));
T('④-14 일정마다 SUMMARY 가 있다', L.filter(x => /^SUMMARY:/.test(x)).length === rows.length);
T('④-15 기록 이름이 파일에 들어간다', /광어 손님 8명/.test(ics));

// 이스케이프 — 쉼표·세미콜론·역슬래시·줄바꿈이 규격대로 빠져나가야 한다
T('④-16 쉼표를 벗긴다',     icsEsc('가,나') === '가\\,나', icsEsc('가,나'));
T('④-17 세미콜론을 벗긴다', icsEsc('가;나') === '가\\;나', icsEsc('가;나'));
T('④-18 역슬래시를 벗긴다', icsEsc('가\\나') === '가\\\\나', icsEsc('가\\나'));
T('④-19 줄바꿈을 벗긴다',   icsEsc('가\n나') === '가\\n나', icsEsc('가\n나'));
T('④-20 ★ 역슬래시를 먼저 벗긴다 (순서가 틀리면 두 번 벗겨진다)',
  icsEsc('가\\,나') === '가\\\\\\,나', icsEsc('가\\,나'));

globalThis.voyage.push({ id: 'v5', plan: true, date: '2026-09-15', title: '쉼표, 그리고;세미콜론' });
const ics2 = unfold(calIcs('2026-09-01', '2026-09-30'));
T('④-21 ★ 이름 속 쉼표가 파일에서 벗겨져 있다',
  /SUMMARY:[^\r\n]*쉼표\\,/.test(ics2),
  (ics2.match(/SUMMARY:[^\r\n]*쉼표[^\r\n]*/) || [''])[0]);
globalThis.voyage.pop();

T('④-22 내보내기가 없으면 빈 달력이라도 규격을 지킨다',
  (() => { const e = unfold(calIcs('2030-01-01', '2030-01-31')).split(/\r\n/);
           return e[0] === 'BEGIN:VCALENDAR' && e.filter(x => x).slice(-1)[0] === 'END:VCALENDAR'
                  && e.filter(x => x === 'BEGIN:VEVENT').length === 0; })());

// ══════════════════════════════════════════════════════
// 5. 화면이 갖춰야 할 것
// ══════════════════════════════════════════════════════
const rc = grab(src, 'renderCal') || '';
T('⑤-1 달력을 그리는 함수가 있다', !!rc);
T('⑤-2 ★ 그리면서 저장하지 않는다', !/\bsave\(\)|\bsaveMR\(\)/.test(rc));
// ★ 그냥 renderCal 안에 tideName 이 있는지만 보면 안 된다 —
//   아래쪽 「고른 날」 판에도 물때를 부르므로, 날짜 칸에서 빼도 통과해 버린다.
//   실제로 그렇게 새는 것을 겪었다. 날짜 칸을 만드는 자리만 잘라서 본다.
const cellRegion = (() => {
  const a = rc.indexOf('for(let d = 1');
  const b = rc.indexOf('while(cells.length');
  return (a >= 0 && b > a) ? rc.slice(a, b) : '';
})();
T('⑤-3a 날짜 칸을 만드는 자리를 찾았다', cellRegion.length > 200, cellRegion.length);
T('⑤-3 ★ 날짜 칸 안에서 물때를 구한다 (배 쓰는 사람의 달력이다)',
  /tideName\(/.test(cellRegion));
T('⑤-3b 구한 물때를 그 칸에 그린다', /class="ctide"/.test(cellRegion) && /\$\{esc\(tide\)\}/.test(cellRegion));
T('⑤-4 오늘이 표시된다', /today\(\)/.test(rc));
T('⑤-5 한 칸에 다 못 넣으면 몇 건 더 있는지 알려 준다', /\{n\}건 더/.test(src));
T('⑤-6 달을 앞뒤로 넘길 수 있다', !!grab(src, 'calMove'));
T('⑤-7 날짜를 누르면 그 날을 펼친다', !!grab(src, 'calPick'));
T('⑤-8 줄을 누르면 그 기록 창이 열린다', !!grab(src, 'calGo') && /openMR\(/.test(grab(src, 'calGo')));
T('⑤-9 그 날짜로 새 기록을 만들 수 있다', !!grab(src, 'calAdd'));
T('⑤-10 ★ 파일 내보내기는 saveFile 한 곳을 지난다 (문 하나)',
  !!grab(src, 'calExport') && /saveFile\(/.test(grab(src, 'calExport')));
T('⑤-11 갈래별 색·이름 표가 한 곳에 있다', /const CAL_KINDS = \{/.test(src));
// ★ 요일·달 이름은 사전으로 못 만든다 — 영어의 「September 2026」 은 {m} 에 숫자만 끼워서는 안 나온다.
//   그래서 언어별 표를 따로 둔다. 표가 네 언어를 다 덮는지 여기서 지킨다.
const dowTbl = (src.match(/const CAL_DOW = \{[\s\S]*?\n\};/) || [''])[0];
const monTbl = (src.match(/const CAL_MON = \{[\s\S]*?\n\};/) || [''])[0];
['ko','en','ru','ja'].forEach(v => {
  T('⑤-14 요일 표에 ' + v + ' 가 있다', new RegExp('\\n\\s*' + v + ':').test(dowTbl), dowTbl.slice(0,120));
  T('⑤-15 달 이름 표에 ' + v + ' 가 있다', new RegExp('\\n\\s*' + v + ':').test(monTbl), monTbl.slice(0,120));
});
T('⑤-16 요일이 언어마다 일곱 개다',
  (dowTbl.match(/\[[^\]]*\]/g) || []).every(a => a.split(',').length === 7),
  (dowTbl.match(/\[[^\]]*\]/g) || []).map(a => a.split(',').length));
T('⑤-17 달 이름이 열두 개다',
  (monTbl.match(/\[[^\]]*\]/g) || []).every(a => a.split(',').length === 12),
  (monTbl.match(/\[[^\]]*\]/g) || []).map(a => a.split(',').length));
T('⑤-18 ★ 머리 제목을 만드는 함수가 있다', !!grab(src, 'calTitle'));

// ══════════════════════════════════════════════════════
// ⑦ 폰 달력에 바로 넣기 (4.108)
//   ★ 사장님: 「내가 파일로 받아서 넣어줘야 하는 거야? 바로 연동 안 되고?」
//   구글 캘린더 앱은 .ics 가져오기를 **PC 에서만** 지원한다 — 파일만으로는
//   안드로이드 폰에서 끝을 못 본다. 그래서 세 가지 길을 두고 하나로 가른다.
// ══════════════════════════════════════════════════════
{
  const ph = grab(src, 'calPhone') || '';
  T('⑦-1 폰 달력에 넣는 자리가 있다', !!ph);
  T('⑦-2 ★ 길이 세 가지다 — 부품 · 구글 달력 · 파일',
    /createEventWithPrompt/.test(ph) && /calGoogleUrl/.test(ph) && /saveFile\(/.test(ph), ph.slice(0, 400));
  T('⑦-3 ★ 부품이 먼저다 (권한을 안 묻는 길)',
    ph.indexOf('createEventWithPrompt') < ph.indexOf('calGoogleUrl')
    && ph.indexOf('calGoogleUrl') < ph.indexOf('saveFile('), {
      부품: ph.indexOf('createEventWithPrompt'), 구글: ph.indexOf('calGoogleUrl'), 파일: ph.indexOf('saveFile(') });
  T('⑦-4 ★ 부품이 없어도 앱이 안 터진다 (있는지 보고 쓴다)',
    /typeof P\.createEventWithPrompt === 'function'/.test(grab(src, 'calPlug') || ''), grab(src, 'calPlug'));
  T('⑦-5 ★ 사람이 그만둔 것을 잘못으로 안 본다', /cancel\|dismiss/.test(ph));
  T('⑦-6 하루 종일 일정으로 넣는다', /isAllDay: true/.test(ph));
  T('⑦-7 줄마다 단추가 붙는다', /calPhone\(\$\{rows\.indexOf\(r\)\}\)/.test(src));
  T('⑦-8 ★ 단추를 눌러도 기록 창이 같이 안 열린다', /event\.stopPropagation\(\);calPhone/.test(src));

  // 구글 달력 주소 — 실제로 만들어 본다
  globalThis.capPlug = () => null;
  globalThis.Intl = Intl;
  eval('globalThis.calRowName = ' + grab(src, 'calRowName'));
  eval('globalThis.calGoogleUrl = ' + grab(src, 'calGoogleUrl'));
  const u = calGoogleUrl({ date:'2026-09-12', kind:'plan', title:'광어 손님, 여덟 분' });
  const q = new URL(u).searchParams;
  T('⑦-9 구글 달력 주소를 만든다', u.indexOf('https://calendar.google.com/calendar/render?') === 0, u.slice(0, 60));
  T('⑦-10 TEMPLATE 로 연다', q.get('action') === 'TEMPLATE');
  T('⑦-11 ★ 하루 종일 일정은 끝나는 날이 다음 날이다',
    q.get('dates') === '20260912/20260913', q.get('dates'));
  T('⑦-12 갈래와 이름이 제목에 들어간다',
    /\[예정\] 광어 손님, 여덟 분/.test(q.get('text') || ''), q.get('text'));
  T('⑦-13 ★ 쉼표가 주소에서 깨지지 않는다 (URLSearchParams 가 감싼다)',
    (q.get('text') || '').indexOf('광어 손님, 여덟 분') >= 0, q.get('text'));
  T('⑦-14 어느 나라 시간인지 붙는다', !!q.get('ctz'), q.get('ctz'));
}

// ★★ 글자 차례만 보면 「부품이 먼저」 를 지키는 것처럼 보이면서 실제로는 안 쓸 수 있다.
//   (일부러 부품을 못 쓰게 망가뜨려 봤더니 위 검사들이 다 통과했다.)
//   그래서 **실제로 돌려 본다** — 부품이 있을 때·없을 때 어느 길로 가는지.
{
  const src2 = src;
  const run = async (플러그인있나) => {
    const 자국 = [];
    globalThis.calShown = [{ date:'2026-09-12', kind:'plan', id:'v1', title:'광어 손님', color:'#4C8FD0' }];
    globalThis.capPlug = () => 플러그인있나
      ? { createEventWithPrompt: async o => { 자국.push('부품:' + JSON.stringify(o)); return { id:null }; } }
      : null;
    globalThis.window = { open: () => { 자국.push('구글'); return { closed:false }; } };
    globalThis.saveFile = async () => { 자국.push('파일'); return ''; };
    globalThis.tell = () => {};
    globalThis.curBoat = () => ({ name:'시험호' });
    { const m = src2.match(/const CAL_PLUG = '[^']*';/);
      if(!m) throw new Error('CAL_PLUG 이름표가 없습니다');
      eval(m[0].replace('const CAL_PLUG', 'globalThis.CAL_PLUG')); }
    eval('globalThis.calPlug = ' + grab(src2, 'calPlug'));
    eval('globalThis.calPhone = ' + grab(src2, 'calPhone').replace(/^async function /, 'async function '));
    await calPhone(0);
    return 자국;
  };
  (async () => {
    const 있을때 = await run(true);
    const 없을때 = await run(false);
    T('⑦-15 ★★ 부품이 있으면 **부품으로** 넣는다 (구글·파일로 안 샌다)',
      있을때.length === 1 && 있을때[0].indexOf('부품:') === 0, 있을때);
    T('⑦-16 ★ 부품에 하루 종일 일정으로 넘긴다',
      /"isAllDay":true/.test(있을때[0] || ''), 있을때[0]);
    T('⑦-17 ★ 부품에 넘기는 이름에 갈래와 제목이 다 있다',
      /\[예정\] 광어 손님/.test(있을때[0] || ''), 있을때[0]);
    T('⑦-18 ★★ 부품이 없으면 구글 달력으로 간다 (파일까지 안 내려간다)',
      없을때.length === 1 && 없을때[0] === '구글', 없을때);
    console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
    process.exit(bad ? 1 : 0);
  })();
}
// ★ 옆으로 밀어 달 넘기기 (4.107 — 사장님 지적: 구글 달력은 되는데 뱃일은 안 된다)
{
  const sw = grab(src, 'calSwipeBind') || '';
  T('⑥-1 옆으로 밀기를 거는 자리가 있다', !!sw);
  T('⑥-2 ★ 손짓을 실제로 듣는다', /touchstart/.test(sw) && /touchend/.test(sw));
  T('⑥-3 ★ 왼쪽으로 밀면 다음 달 (구글·삼성과 같은 방향)',
    /calMove\(dx < 0 \? 1 : -1\)/.test(sw), sw.slice(-300));
  T('⑥-4 ★ 세로로 굴린 것은 달을 안 넘긴다',
    /Math\.abs\(dy\)/.test(sw), sw.slice(-300));
  T('⑥-5 ★ 민 손짓이 날짜 누르기로 새지 않는다',
    /calSwiped/.test(grab(src, 'calPick') || ''), grab(src, 'calPick'));
  T('⑥-6 다시 그릴 때마다 손짓을 겹쳐 걸지 않는다', /calSwipeOn/.test(sw));
  T('⑥-7 달력을 그리면 손짓이 걸린다', /calSwipeBind\(\);/.test(grab(src, 'renderCal') || ''));
}

// 갈래 표와 실제로 나온 갈래가 어긋나면 색 없는 줄이 생긴다
const kindTbl = (src.match(/const CAL_KINDS = \{[\s\S]*?\n\};/) || [''])[0];
const tblKeys = [...new Set((kindTbl.match(/^\s*([a-zA-Z]+)\s*:\s*\{/gm) || []).map(x => x.trim().replace(/\s*:\s*\{/, '')))];
T('⑤-12 ★ 달력에 나오는 갈래가 표에 다 있다',
  rows.every(r => tblKeys.indexOf(r.kind) >= 0), { 나온것: [...new Set(rows.map(r => r.kind))], 표: tblKeys });
T('⑤-13 ★ 표에만 있고 안 쓰는 갈래가 없다',
  tblKeys.length === 8, tblKeys);

// ══════════════════════════════════════════════════════
// 6. 새 낱말이 세 언어에 다 있는가
// ══════════════════════════════════════════════════════
function dictOf(lang){
  const m = src.match(new RegExp('\\n  ' + lang + ': \\{[\\s\\S]*?\\n  \\},'));
  return m ? m[0] : '';
}
const EN = dictOf('en'), RU = dictOf('ru'), JA = dictOf('ja');
T('⑥-0 사전 셋을 읽었다', EN.length > 1000 && RU.length > 1000 && JA.length > 1000,
  { en: EN.length, ru: RU.length, ja: JA.length });
const NEW_WORDS = ['달력', '{n}건 더', '이 날에 만들기',
                   '달력 파일 내보내기', '이 달에는 아무것도 없습니다',
                   '구글 · 아이폰 달력에 넣으실 수 있습니다'];
NEW_WORDS.forEach(w => {
  const q = "'" + w + "'";
  T('⑥ 「' + w + '」 — 영어', EN.indexOf(q + ':') >= 0);
  T('⑥ 「' + w + '」 — 러시아어', RU.indexOf(q + ':') >= 0);
  T('⑥ 「' + w + '」 — 일본어', JA.indexOf(q + ':') >= 0);
});

// ★ 마지막 셈은 위의 비동기 검사가 끝난 뒤에 찍는다.

// ── ★★ 4.111 — 예정의 출항 시각 (사장님 지적)
//   「출항하는 거는 이거는 시간을 정확히 적어야 되잖아. 시간이 없네.」
//   날짜만 있으면 손님도 크루도 몇 시에 나가는지 모른다. 달력에도 그 시각이 보여야 한다.
{
  // 4.128·4.132 — 시각 칸이 tf(...,'time') 에서 시각 전용 hmRow() 로 바뀌고 날짜 바로 아래로 올라갔다.
  // 칸 이름·읽는 값(it.timeOut)·적어 넣는 곳(mrField('timeOut', v))을 그대로 다 본다.
  T('⑨-1 ★★ 예정에 출항 시각 칸이 있다',
    /hmRow\('출항 시각', it\.timeOut, "v => mrField\('timeOut', v\)"\)/.test(src),
    (src.match(/[^\n]*'출항 시각'[^\n]*/) || [''])[0]);
  const CI = grab(src, 'calItems') || '';
  T('⑨-2 ★ 달력에 담는 것에 시각이 들어간다', /time:/.test(CI), CI.slice(0, 400));
  T('⑨-3 ★ 예정·항해일지의 시각은 출항 시각(timeOut)이다',
    /v\.timeOut\)/.test(CI), (CI.match(/[^\n]*v\.timeOut[^\n]*/) || [''])[0]);
  T('⑨-4 ★ 펼친 날 줄에 시각을 보여 준다', /class="cdhm"/.test(src));

  // 실제로 담기는지 돌려 본다 — 위의 가짜 기록에 시각만 얹는다
  globalThis.voyage = [
    { id:'p1', plan:true,  date:'2026-09-12', title:'광어 손님 8명', timeOut:'09:30' },
    { id:'p2', plan:true,  date:'2026-09-13', title:'시각 없는 예정', timeOut:'' },
    { id:'p3', plan:true,  date:'2026-09-14', title:'엉뚱한 값',     timeOut:'아무거나' },
    { id:'p4', plan:false, date:'2026-09-15', title:'다녀온 항해',   timeOut:'06:05' }
  ];
  const r9 = calItems('2026-09-01', '2026-09-30');
  const g = id => r9.find(x => x.id === id) || {};
  T('⑨-5 ★★★ 적어 둔 출항 시각이 달력에 그대로 담긴다', g('p1').time === '09:30', g('p1'));
  T('⑨-6 ★ 안 적었으면 빈 칸이다 (— 로 지어내지 않는다)', g('p2').time === '', g('p2'));
  T('⑨-7 ★★ 시각이 아닌 글자는 버린다', g('p3').time === '', g('p3'));
  T('⑨-8 ★ 다녀온 항해도 시각을 보여 준다', g('p4').time === '06:05', g('p4'));
}
