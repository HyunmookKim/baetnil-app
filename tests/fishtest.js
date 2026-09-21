// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 3.10 — 낚시배 조행기
//
// 정한 것
//  · 낚시배(fishing)일 때만 조행기 칸이 뜬다. 요트·보트에는 안 보인다.
//  · 항해일지의 '중간 기록' 을 포인트로 쓴다. 포인트마다
//    수심 · 수온 · 미끼 · 채비 · 어종별 마릿수와 최대 cm 를 남긴다.
//  · 출조 전체에 물때와 총 조과가 붙는다.
//  · 배 위에서 쓴다 — 숫자 타이핑 대신 눌러서 세고, 목록에서 골라 넣는다.
//
// ★ 물때는 지어내면 안 된다.
//   삭(신월) 시각을 계산해 음력일을 구하고, 표로 물때 이름을 정한다.
//   서해식(7물때식)과 남해식(8물때식)은 부르는 법이 다르다 —
//   음력 8일·23일이 조금인 것은 같고, 서해는 조금 다음이 무시, 남해는 바로 1물이다.
//   음력 15일·30일이 사리다.
const fs = require('fs');
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
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 물때 계산을 실제로 돌려 본다
//    ★ '함수가 있다' 로는 부족하다. 값이 맞아야 한다.
let ok = true;
const need = ['MOON_A','newMoonJD','lastNewMoonKST','lunarDay','TIDE_WEST','TIDE_SOUTH','tideIdx','tideName','tideMark'];
const bodies = need.map(n => {
  const f = grab(js, n);
  if(f) return f;
  const m = js.match(new RegExp('const ' + n + ' *=[\\s\\S]*?\\];'));
  return m ? m[0] : null;
});
need.forEach((n,i)=> T('물때 계산에 ' + n + ' 이 있다', !!bodies[i]));
if(bodies.every(Boolean)){
  const ctx = {};
  try{
    (new Function(bodies.join('\n') + '\nreturn {' + need.join(',') + '};'))
      .call(ctx) && Object.assign(ctx, (new Function(bodies.join('\n') + '\nreturn {' + need.join(',') + '};'))());
  }catch(e){ ok = false; console.log('★ 실패: 물때 계산을 돌리지 못했습니다 — ' + e.message); fail++; }
  if(ok){
    const { newMoonJD, lunarDay, tideName, tideMark } = ctx;

    // 삭 시각 — 미국 해군천문대(USNO) 발표값과 맞아야 한다 (UTC)
    // k 는 2000년 1월 삭부터 센 번호다.
    const USNO = [
      [322, '2026-01-18 19:52'], [323, '2026-02-17 12:01'], [324, '2026-03-19 01:23'],
      [325, '2026-04-17 11:52'], [326, '2026-05-16 20:01'], [327, '2026-06-15 02:54'],
      [328, '2026-07-14 09:43'], [329, '2026-08-12 17:37'], [330, '2026-09-11 03:27'],
      [331, '2026-10-10 15:50'], [332, '2026-11-09 07:02'], [333, '2026-12-09 00:52']
    ];
    let worst = 0;
    USNO.forEach(([k, want])=>{
      const jd = newMoonJD(k);
      const got = new Date((jd - 2440587.5) * 86400000);
      const diff = Math.abs(got.getTime() - new Date(want.replace(' ','T') + ':00Z').getTime()) / 60000;
      if(diff > worst) worst = diff;
    });
    T('삭 시각이 USNO 발표값과 2분 이내로 맞는다 (가장 어긋난 것 ' + worst.toFixed(1) + '분)', worst <= 2);

    // 음력일 — 삭이 든 날이 음력 1일이다 (한국 기준, KST)
    T('삭이 든 날이 음력 1일이다 (2026-08-13)', lunarDay('2026-08-13') === 1);
    T('그 전날은 음력 29일이다 (2026-08-12)', lunarDay('2026-08-12') === 30 || lunarDay('2026-08-12') === 29);
    T('7월 삭이 든 날도 음력 1일이다 (2026-07-14)', lunarDay('2026-07-14') === 1);
    T('음력 8일이 맞다 (2026-07-21)', lunarDay('2026-07-21') === 8);
    T('음력 15일이 맞다 (2026-07-28)', lunarDay('2026-07-28') === 15);

    // 물때 이름 — 서해식(7물때식)
    T('서해식: 음력 1일은 7물', tideName('2026-07-14','west') === '7물');
    T('서해식: 음력 8일은 조금', tideName('2026-07-21','west') === '조금');
    T('서해식: 음력 9일은 무시', tideName('2026-07-22','west') === '무시');
    T('서해식: 음력 10일은 1물', tideName('2026-07-23','west') === '1물');
    T('서해식: 음력 15일은 6물', tideName('2026-07-28','west') === '6물');
    // 남해식(8물때식) — 한 물씩 많고, 조금 다음이 바로 1물이다
    T('남해식: 음력 1일은 8물', tideName('2026-07-14','south') === '8물');
    T('남해식: 음력 8일은 조금', tideName('2026-07-21','south') === '조금');
    T('남해식: 음력 9일은 1물', tideName('2026-07-22','south') === '1물');
    T('남해식: 음력 15일은 7물', tideName('2026-07-28','south') === '7물');
    // 사리와 조금
    T('음력 15일은 사리', tideMark('2026-07-28') === '사리');
    T('음력 8일은 조금', tideMark('2026-07-21') === '조금');
    T('음력 3일은 사리도 조금도 아니다', tideMark('2026-07-16') === '');
    // 두 방식이 조금·무시 말고는 한 물씩 차이 난다
    let gap = true;
    for(let d = 0; d < 15; d++){
      const dt = new Date(Date.UTC(2026,6,14) + d*86400000).toISOString().slice(0,10);
      const w = tideName(dt,'west'), s2 = tideName(dt,'south');
      if(w === '조금' || w === '무시') continue;
      if(parseInt(s2,10) !== parseInt(w,10) + 1) gap = false;
    }
    T('남해식은 서해식보다 한 물 많다', gap);
  }
} else { console.log('★ 실패: 물때 계산이 없어 값 검사를 못 했습니다 (18건)'); fail += 18; }

// ── 2. 낚시배일 때만 뜬다
{
  T('낚시배인지 보는 곳이 있다', !!grab(js, 'isFishing'));
  const f = grab(js, 'isFishing') || '';
  T('선종으로 판단한다', /boatType\(\)/.test(f) && /fishing/.test(f));
  // ★ 'fishing' 글자만 찾으면 정비 항목 목록에 걸려 헛통과한다. 실제로 갈라지는지 본다.
  const v = grab(js, 'openMR') || '';
  T('항해일지 화면이 낚시배일 때 갈라진다', /isFishing\(\)/.test(v));
  T('요트·보트에는 조행기가 안 붙는다',
    /isFishing\(\)\s*\?/.test(v) || /isFishing\(\)\s*&&/.test(v) || /if\(isFishing\(\)\)/.test(v));
  T('중간 기록 종류에 포인트가 있다', /포인트/.test(js));
  // ★ 포인트 칸이 모든 중간 기록에 붙으면 요트에서도 나오고, 낚시배에서도 지저분해진다.
  //   낚시배이면서 종류가 포인트일 때만 붙는지 본다.
  const lr = grab(js, 'logRows') || '';
  T('포인트 칸은 낚시배의 포인트 기록에만 붙는다',
    /isFishing\(\)\s*&&\s*g\.kind === '포인트'[\s\S]{0,40}?fishRows\(/.test(lr));
  T('낚시배 중간 기록은 포인트로 시작한다',
    /isFishing\(\) \? '포인트'/.test(grab(js, 'logAdd') || ''));
}

// ── 3. 포인트 한 곳에 남기는 것
{
  const fr = grab(js, 'fishRows') || '';
  T('포인트 기록을 그리는 곳이 있다', fr.length > 0);
  ['수심','수온','미끼','채비'].forEach(k=>
    T('포인트에 ' + k + ' 가 있다', fr.includes(k)));
  T('미끼 목록이 있다', /const FISH_BAITS +=\s*\[/.test(js));
  T('채비 목록이 있다', /const FISH_RIGS +=\s*\[/.test(js));
  T('어종 목록이 있다', /const FISH_SPECIES +=\s*\[/.test(js));
  const sp = (js.match(/const FISH_SPECIES +=[\s\S]*?\];/) || [''])[0];
  ['광어','우럭','참돔','갈치'].forEach(x=>
    T('어종에 ' + x + ' 가 있다', sp.includes(x)));
  T('목록에 없는 것도 직접 넣을 수 있다', /catchOther|직접/.test(fr + (grab(js,'catchAdd')||'')));
}

// ── 4. 배 위에서 쓴다 — 눌러서 센다
{
  const cn = grab(js, 'catchN') || '';
  T('마릿수를 눌러서 세는 곳이 있다', cn.length > 0);
  T('한 마리씩 더하고 뺀다', /[+-]\s*1|\+1|-1/.test(cn) || /d\s*\)/.test(cn));
  T('0 아래로 내려가지 않는다', /Math\.max\(\s*0/.test(cn));
  // ★ prompt() 로 숫자를 받게 하면 배 위에서 못 쓴다. 앱 전체에서 금지다.
  //   ★ 3.46 — 다만 브라우저가 건네준 '홈 화면에 추가' 물음(installEvt.prompt())은
  //     글자를 받는 창이 아니라 브라우저가 띄우는 설치 확인창이다. 그것만 빼고 본다.
  const noIns = js.replace(/installEvt\.prompt\(\)/g, '')
                  .replace(/beforeinstallprompt/g, '');
  const hits = (noIns.match(/\bprompt\s*\(/g) || []);
  T('숫자를 타이핑시키지 않는다 (prompt 금지) — 남은 것 ' + hits.length + '곳', hits.length === 0);
}

// ── 5. 조과 합계
//   ★ '/logs/ 글자가 있다' 로는 첫 포인트만 세는 버그를 못 잡는다. 실제로 돌려 본다.
{
  const ct = grab(js, 'catchTotal') || '';
  const cc = grab(js, 'catchCount') || '';
  T('총 조과를 세는 곳이 있다', ct.length > 0);
  T('마릿수 합계를 내는 곳이 있다', cc.length > 0);
  if(ct && cc){
    let total = null, count = null, err = '';
    try{
      const fn = new Function(ct + '\n' + cc + '\nreturn { catchTotal, catchCount };')();
      // ★ 시험 자료를 아무렇게나 두면 안 된다.
      //   우럭을 먼저 넣어야 '정렬 안 함' 을 잡고,
      //   광어 큰 것을 먼저 넣어야 '최대 대신 마지막 값' 을 잡는다.
      const it = { logs: [
        { id:'a', fish:{ catches:[ {sp:'우럭', n:1, cm:30}, {sp:'광어', n:2, cm:52} ] } },
        { id:'b', fish:{ catches:[ {sp:'광어', n:3, cm:45}, {sp:'갈치', n:0, cm:''} ] } },
        { id:'c' },
        { id:'d', fish:{} }
      ] };
      total = fn.catchTotal(it); count = fn.catchCount(it);
    }catch(e){ err = e.message; }
    T('조과 계산을 돌렸다' + (err ? ' — ' + err : ''), Array.isArray(total));
    if(Array.isArray(total)){
      const g = sp => total.find(x=>x.sp===sp);
      T('포인트 여러 곳의 같은 어종을 합친다 (광어 2+3=5)', !!g('광어') && g('광어').n === 5);
      T('어종을 뭉개지 않는다 (우럭 1)', !!g('우럭') && g('우럭').n === 1);
      T('가장 큰 것을 남긴다 (광어 최대 52cm)', !!g('광어') && g('광어').cm === 52);
      T('0마리는 목록에 넣지 않는다', !g('갈치'));
      T('포인트가 아닌 기록에서 터지지 않는다', total.length === 2);
      T('마릿수를 모두 더한다 (6마리)', count === 6);
      T('많이 잡은 것부터 보여 준다', total[0].sp === '광어');
    } else fail += 7;
  } else fail += 8;
  T('출조 목록에 조과가 보인다',
    /catchTotal\(|catchCount\(/.test(grab(js, 'renderVoyage') || ''));
  T('요트·보트 목록에는 조과가 안 붙는다',
    /isFishing\(\)&&catchCount\(|isFishing\(\) && catchCount\(/.test(grab(js, 'renderVoyage') || ''));
}

// ── 6. 물때가 화면에 붙는다
{
  const v = grab(js, 'openMR') || '';
  T('출조에 물때가 붙는다', /tideName\(/.test(v) || /tideRow\(/.test(v));
  const tr = grab(js, 'tideRow') || v;
  T('서해식·남해식을 고를 수 있다', /west/.test(tr) && /south/.test(tr));
  T('계산이 어긋날 수 있다고 알려준다', /지역|부르는|다를 수|다릅니다/.test(tr));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
