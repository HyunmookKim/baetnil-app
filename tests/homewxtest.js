// 3.11 — 오늘 탭 날씨
//
// 실제로 일어난 일 (사장님 화면)
//  · 앱을 열면 오늘 탭이 비어 있다가, 날씨·물때 탭을 눌러야 채워졌다.
//  · 오늘 탭은 "바람 24kt · 돌풍 44kt", 같은 시각 상세는 "바람 10kt · 돌풍 18".
//    여수에서 돌풍 44kt 는 말이 안 된다.
//  · 카드 밑에 "2" 라는 숫자만 덩그러니 찍혔다.
//
// 원인 셋
//  1) wxNowIdx() 라는 함수가 아예 없었다. 그래서 늘 idx 0 —
//     예보의 첫 시각(아침) 값을 '지금' 인 것처럼 보여 줬다.
//  2) 날씨는 이미 노트(kt)로 받아 오는데 오늘 탭에서 1.94 를 또 곱했다.
//  3) reefStage() 는 숫자(0·1·2·3)를 돌려주는데 그것을 그대로 글자로 찍었다.
//
// ★ 값이 틀리는 버그는 글자 검사로 못 잡는다. 실제로 돌려서 값을 본다.
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

// ── 1. 지금 몇 번째 시각인가 — 실제로 돌려 본다
{
  const f = grab(js, 'wxNowIdx');
  T('지금 시각을 찾는 함수가 있다', !!f);
  if(f){
    let ok = true, got = null, err = '';
    try{
      const run = new Function('wxData', 'nowTs', f + '\n return wxNowIdx(nowTs);');
      // 예보가 오늘 00시부터 시작하고, 지금이 21시라고 해 보자
      const t0 = Date.UTC(2026, 7, 11, 0, 0) - 9 * 3600000;   // 8/11 00시 KST
      const g = w => { global.wxData = w; return run(w, undefined); };
      global.wxData = { _t0: t0, _n: 120 };
      got = new Function('wxData','Date', f + '\n return wxNowIdx();')
        .call(null, { _t0: t0, _n: 120 },
              class extends Date { static now(){ return t0 + 21 * 3600000; } });
    }catch(e){ ok = false; err = e.message; }
    T('지금 시각 계산을 돌렸다' + (err ? ' — ' + err : ''), ok);
    T('21시면 21번째 칸을 집는다 (첫 칸이 아니다) — 나온 값: ' + got, got === 21);
  } else fail += 2;
  // ★ 함수가 없으면 0 으로 넘어가던 자리 — 그렇게 두면 아침 값이 '지금' 이 된다
  const rh = grab(js, 'renderHome') || '';
  T('없으면 0 으로 넘기던 임시 코드가 남아 있지 않다',
    !/typeof wxNowIdx === 'function'\) \? wxNowIdx\(\) : 0/.test(rh));
  T('오늘 탭이 지금 시각으로 본다', /wxNowIdx\(\)/.test(rh));
}

// ── 2. 단위를 두 번 곱하지 않는다
{
  const rh = grab(js, 'renderHome') || '';
  // 받아올 때 이미 노트로 달라고 한다
  T('날씨를 노트(kt)로 받아온다', /wind_speed_unit=kn/.test(js));
  T('오늘 탭에서 노트로 다시 곱하지 않는다', !/1\.94384/.test(rh));
  T('오늘 탭이 바람을 보여 준다', /바람/.test(rh) && /kt/.test(rh));
  // 상세 카드와 같은 값을 써야 한다
  const bw = grab(js, 'boatWxCard') || '';
  T('상세 카드도 다시 곱하지 않는다', !/1\.94384/.test(bw));
  // ★ 앱 전체에서 wxAt() 이 준 값에 1.94 를 곱하는 곳이 없어야 한다
  const bad = (js.match(/\.wind[^;]{0,40}?1\.94384|\.gust[^;]{0,40}?1\.94384/g) || []);
  T('바람 값에 다시 곱하는 곳이 없다 — 찾은 것: ' + (bad.slice(0,2).join(' / ') || '없음'),
    bad.length === 0);
}

// ── 3. 리프 단수는 숫자다 — 글자로 바꿔서 보여 준다
{
  T('리프 단수를 글로 바꾸는 곳이 있다', !!grab(js, 'reefText'));
  const rt = grab(js, 'reefText') || '';
  let out = null, err = '';
  if(rt){
    try{
      // ★ 3.84 부터 사전을 거친다. 한국어에서는 원문을 그대로 내주므로
      //   t 만 끼워 주면 검사는 그대로 뜻이 산다.
      const fn = new Function("const t = x => x;\n" + rt + '\n return reefText;')();
      out = [fn(null), fn(0), fn(1), fn(3)];
    }catch(e){ err = e.message; }
  }
  T('리프 글자 만들기를 돌렸다' + (err ? ' — ' + err : ''), Array.isArray(out));
  if(Array.isArray(out)){
    T('기준이 없으면 아무 말도 안 한다', out[0] === '');
    T('0단은 숫자가 아니라 말로 알려준다', out[1] !== '0' && /리프/.test(out[1]));
    T('1단도 말로 알려준다', /1/.test(out[2]) && /리프/.test(out[2]));
    T('3단도 말로 알려준다', /3/.test(out[3]) && /리프/.test(out[3]));
  } else fail += 4;
  const rh = grab(js, 'renderHome') || '';
  T('오늘 탭이 숫자를 그대로 찍지 않는다', /reefText\(/.test(rh));
}

// ── 3-2. 언제 자료인지 — 기기 시계가 아니라 자료에 적힌 한국 시각으로
{
  const w = grab(js, 'wxWhenText') || '';
  T('언제 자료인지 알려 주는 곳이 있다', w.length > 0);
  T('오늘 탭이 그것을 보여 준다', /wxWhenText\(/.test(grab(js, 'renderHome') || ''));
  // ★ 기기 표준시로 다시 계산하면 UTC 기기에서 12시로 찍힌다. 실제로 그랬다.
  T('기기 시계로 다시 계산하지 않는다', !/getHours\(\)/.test(w));
  let out = null, err = '';
  if(w){
    try{
      const fn = new Function('wxData', "const t = x => x;\n" + (grab(js, 'weekDay') || '') + '\n' + w + '\n return wxWhenText;')(
        { w:{ hourly:{ time:['2026-08-11T00:00','2026-08-11T21:00'] } } });
      out = [fn(1), fn(-1), fn(9)];
    }catch(e){ err = e.message; }
  }
  T('언제 자료인지 계산을 돌렸다' + (err ? ' — ' + err : ''), Array.isArray(out));
  if(Array.isArray(out)){
    T('자료에 적힌 21시를 그대로 쓴다 — 나온 값: ' + out[0], /21시/.test(out[0]));
    T('날짜와 요일도 자료에서 뽑는다', /8\/11\(화\)/.test(out[0]));
    T('없는 칸이면 아무 말도 안 한다', out[1] === '' && out[2] === '');
  } else fail += 3;
}

// ── 4. 앱을 열면 오늘 탭이 스스로 채워진다
{
  T('날씨를 미리 받아 두는 곳이 있다', !!grab(js, 'ensureWx'));
  const e = grab(js, 'ensureWx') || '';
  T('이미 받았으면 다시 안 받는다', /wxData/.test(e));
  T('받은 뒤 오늘 탭을 다시 그린다', /renderHome\(/.test(e));
  T('시작할 때 부른다', /ensureWx\(/.test(js.replace(e, '')));
  // 두 번 동시에 받으러 가지 않는다
  // ★ '표시 글자가 있다' 로는 부족하다. 표시만 하고 안 돌아서면 동시에 여러 번 받아온다.
  T('한 번에 하나만 받아온다',
    /if\(wxEnsuring\) return[\s\S]{0,400}?wxEnsuring = true/.test(e));
  // ★ 5.0 — 한 시간 안이면 다시 안 부른다 (Open-Meteo 하루 한도)
  T('★ 담아 둔 것이 한 시간 안이면 안 부른다', /WX_FRESH_MS/.test(e) && /wxCacheGet\(key\)/.test(e));
  T('★ 못 받으면 담아 둔 것이라도 쓴다', /WX_KEEP_MS/.test(e));
  // ★ 예보 시작 시각(_t0)을 날씨 탭에서만 잡으면, 오늘 탭을 먼저 열 때 없다.
  //   잡는 곳을 한 군데(wxStamp)로 모으고, 받아온 뒤 반드시 부르는지 본다.
  const st = grab(js, 'wxStamp') || '';
  T('예보 시작 시각을 잡는 곳이 한 군데다', st.length > 0 && /_t0/.test(st) && /_n/.test(st));
  // ★ 받아온 '뒤' 에 불러야 한다. 앞쪽 지름길에만 있으면 새로 받았을 때 안 잡힌다.
  T('새로 받아온 뒤에 그것을 부른다',
    /wxData = \{ ?key[\s\S]{0,120}?wxStamp\(\)/.test(e));
  T('날씨 탭도 같은 곳을 쓴다', /wxStamp\(\)/.test(grab(js, 'renderWeather') || ''));
  T('시작 시각을 딴 데서 따로 잡지 않는다',
    (js.match(/_t0 = [^=]/g) || []).length === 1);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
