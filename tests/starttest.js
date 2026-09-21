// 3.12 — 처음 켰을 때
//
// 실제로 일어난 일 (사장님 화면)
//  · 앱을 처음 켜면 로그인도 없이 '배 등록' 부터 나왔다.
//  · 로그인해도 어느 탭을 눌러도 계속 배 등록 화면이 떠서 아무것도 못 했다.
//  · 배 등록 화면에는 닫기 버튼조차 없었다. 막다른 골목이었다.
//
// 원인
//  · switchTab() 이 배가 없으면 무조건 openBoatSetup() 하고 돌아섰다.
//  · ensureBoat() 도 마찬가지였다.
//  · openBoatSetup() 에 닫는 길이 없었다.
//
// 정한 것
//  · 처음 켜면 로그인 화면부터. 로그인하면 클라우드에서 자기 배를 받아오므로
//    이미 배가 있는 사람은 등록할 필요가 없다.
//  · 다만 배 위에서는 인터넷이 없을 수 있다. 막다른 골목을 만들면 안 되니
//    '나중에 하기' 로 빠져나갈 수 있어야 한다.
//  · 배가 없어도 탭은 다 열린다. 배가 필요한 화면만 안내를 보여 준다.
//  · 배 등록 화면에는 닫는 길이 반드시 있다.
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

// ★ 5.0 — window.__onAuth 가 길어졌다. 글자 수로 잘라 보면 뒷부분(redraw)을 놓친다.
//   중괄호를 세어 함수 전체를 떼어 온다.
function onAuth(){
  const i = js.indexOf('window.__onAuth');
  if(i < 0) return '';
  let d = 0, st = false;
  for(let j = i; j < js.length; j++){
    const c = js[j];
    if(c === '{'){ d++; st = true; }
    else if(c === '}'){ d--; if(st && d === 0) return js.slice(i, j + 1); }
  }
  return js.slice(i);
}

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. ★ 배가 없다고 탭을 막지 않는다
{
  const st = grab(js, 'switchTab') || '';
  T('탭 바꾸는 곳이 있다', st.length > 0);
  // ★ 이 한 줄 때문에 앱 전체가 잠겼다. 다시 들어오면 안 된다.
  T('배가 없다고 탭에서 돌아서지 않는다',
    !/!boats\.length\s*\)\s*\{\s*openBoatSetup\(\);\s*return/.test(st));
  T('탭 바꾸기가 배 등록을 억지로 띄우지 않는다', !/openBoatSetup\(/.test(st));
  const eb = grab(js, 'ensureBoat') || '';
  T('배를 챙기는 곳도 억지로 띄우지 않는다', !/openBoatSetup\(/.test(eb));
  // 대신 배가 필요한 화면은 안내를 보여 준다
  T('배가 필요하다고 알려 주는 곳이 있다', !!grab(js, 'needBoatCard'));
  const nb = grab(js, 'needBoatCard') || '';
  T('안내에서 바로 등록하러 갈 수 있다', /openBoatSetup\(/.test(nb));
}

// ── 2. ★ 배 등록 화면에는 닫는 길이 있다
{
  const bs = grab(js, 'openBoatSetup') || '';
  T('배 등록 화면이 있다', bs.length > 0);
  T('닫는 길이 있다', /closeBoatSetup\(/.test(bs));
  // 앱은 '닫기' 라는 글자 대신 '← 오늘' 로 되돌아간다 (사장님이 정한 모양)
  T('되돌아가는 모양이 앱과 같다', /← 오늘|←/.test(bs) && !/>닫기</.test(bs));
  const cs = grab(js, 'closeBoatSetup') || '';
  T('닫는 함수가 있다', cs.length > 0);
  T('닫으면 오늘 탭으로 돌아간다', /switchTab\('home'\)|closeBoat\(/.test(cs));
  // 첫 등록이든 두 번째 배든 언제나 닫을 수 있어야 한다
  T('배가 없을 때도 닫을 수 있다', !/boats\.length \?/.test(bs.slice(0, 400)));
}

// ── 3. 처음 켜면 로그인부터
{
  T('처음 켰을 때 화면이 있다', !!grab(js, 'openWelcome'));
  const w = grab(js, 'openWelcome') || '';
  T('로그인 길이 있다', /doGoogle\(|openAccount\(/.test(w));
  // ★ 배 위에서는 인터넷이 없을 수 있다. 막다른 골목을 만들면 안 된다.
  T('나중에 하기로 빠져나갈 수 있다', /skipWelcome\(/.test(w));
  const sk = grab(js, 'skipWelcome') || '';
  T('한 번 건너뛰면 다시 안 묻는다', /localStorage|bt_welcome/.test(sk));
  // 언제 띄우는가 — 실제로 돌려서 본다
  const nw = grab(js, 'needWelcome') || '';
  T('띄울지 판단하는 곳이 있다', nw.length > 0);
  if(nw){
    let out = null, err = '';
    try{
      const fn = new Function('boats','user','skipped',
        nw.replace(/localStorage[^;]*?;/g, '')
          .replace(/window\.__user/g, 'user')
          .replace(/welcomeSkipped\(\)/g, 'skipped') + '\n return needWelcome();');
      out = {
        처음:      fn([], null, false),
        로그인함:  fn([], { uid:'u' }, false),
        배있음:    fn([{ id:'b' }], null, false),
        건너뜀:    fn([], null, true)
      };
    }catch(e){ err = e.message; }
    T('띄울지 판단을 돌렸다' + (err ? ' — ' + err : ''), !!out);
    if(out){
      T('아무것도 없으면 로그인부터 띄운다', out.처음 === true);
      T('로그인했으면 안 띄운다', out.로그인함 === false);
      T('배가 이미 있으면 안 띄운다', out.배있음 === false);
      T('건너뛴 사람에게 다시 안 띄운다', out.건너뜀 === false);
    } else fail += 4;
  } else fail += 5;
}

// ── 3-2. ★ 앱을 켜면 언제나 '오늘' 부터
//   마지막에 본 하위 화면을 기억해 두면, 날씨를 보고 껐을 때
//   다음에 켜도 날씨가 먼저 나온다. 사장님이 그것을 겪었다.
{
  const m = js.match(/let homeSub = [^\n]*/);
  T('오늘 탭 값이 있다', !!m);
  T('켤 때는 언제나 오늘부터다 — 지금 값: ' + (m ? m[0].trim() : ''),
    !!m && /let homeSub = 'today';/.test(m[0]));
  T('마지막에 본 화면을 기억하지 않는다',
    !!m && !/localStorage/.test(m[0]) && !/bt_homesub/.test(m[0]));
  // 화면을 옮기는 것 자체는 그대로 된다
  T('하위 화면을 옮길 수 있다', !!grab(js, 'setHomeSub'));
}

// ── 3-3. ★ 늦게 끝나는 일이 보고 있던 화면을 건드리지 않는다
//   켠 직후 다른 탭으로 옮기면, 로그인이 뒤늦게 확정되면서
//   switchTab 이 다시 돌아 열어 둔 화면이 닫히고 탭이 되돌아갔다.
{
  T('내용만 다시 그리는 곳이 있다', !!grab(js, 'renderCurrent'));
  const rc = grab(js, 'renderCurrent') || '';
  T('그곳은 화면을 옮기지 않는다', !/switchTab\(/.test(rc));
  T('그곳은 열어 둔 것을 닫지 않는다', !/closeBoat\(|closePanel\(/.test(rc));
  T('배가 필요한 화면 안내는 그대로 한다', /boatNeedGuard\(/.test(rc));
  // 로그인 뒤 다시 그리기가 그것을 쓴다
  const oa = onAuth();
  T('로그인 뒤 다시 그리기가 화면을 옮기지 않는다',
    /const redraw = [^\n]*renderCurrent\(\)/.test(oa));
  T('로그인 뒤 switchTab 을 부르지 않는다',
    !/const redraw = [^\n]*switchTab\(/.test(oa));
  // 탭 바꾸기는 여전히 그 함수를 쓴다 (같은 곳에서 그린다)
  T('탭 바꾸기도 같은 곳에서 그린다', /renderCurrent\(\)/.test(grab(js, 'switchTab') || ''));
}

// ── 4. 로그인하면 클라우드에서 배를 받아온다 (등록할 필요가 없어야 한다)
{
  T('로그인하면 클라우드 배를 합친다', /mergeCloudBoats\(/.test(js));
  // 받아온 뒤 화면을 다시 그려야 배가 나타난다
  const oa = onAuth();
  T('로그인 뒤 화면을 다시 그린다', /switchTab\(|renderHome\(|applyBoatName\(/.test(oa));
}

// ── 5. 배가 없어도 터지지 않는다 — 배를 꺼내 쓰는 곳이 조심하는가
{
  // curBoat() 는 배가 없으면 null 을 준다. 그걸 그냥 쓰면 터진다.
  const cb = grab(js, 'curBoat') || '';
  T('배가 없으면 null 을 준다', /\|\| null/.test(cb) || /boats\[0\] \|\| null/.test(cb));
  const rh = grab(js, 'renderHome') || '';
  T('오늘 탭이 배 없이도 그려진다', /if\(!b\)/.test(rh));
  // 3.49 부터 등록 단추는 소개 카드(introCard) 안에 있다
  T('오늘 탭에서 등록하러 갈 수 있다',
    /openBoatSetup\(/.test(rh) || (/introCard\(\)/.test(rh) && /openBoatSetup\(/.test(grab(js,'introCard')||'')));
  // ★ 처음 온 사람에게 이 앱이 뭘 해 주는지 말해 준다 (빈 껍데기만 보이면 다시 안 온다)
  T('처음 온 사람에게 앱이 하는 일을 알려 준다', /introCard\(\)/.test(rh));
  T('하는 일이 네 가지 이상 적혀 있다',
    ((js.match(/const INTRO_OPEN = \[[\s\S]*?\];/) || [''])[0].match(/\[\s*(t\()?'/g) || []).length >= 4);
  // ★ 날씨 지점이 없을 때 '못 받았습니다' 로 뭉뚱그리면 고장으로 보인다
  T('날씨 지점이 없으면 정하는 길을 준다', /homeUseGPS\(\)/.test(rh));
  T('정했으면 받는 중이라고 말한다', /받는 중입니다/.test(rh));
  // ★ 배가 필요한 화면을 어디에 그릴지 한 곳에 모은다.
  //   흩어 놓으면 화면을 더할 때 빠뜨리고, 배 없이 물건을 넣게 된다.
  const m = js.match(/const NEED_BOAT_WRAP = \{[\s\S]*?\};/);
  T('배가 필요한 화면 목록이 한 곳에 있다', !!m);
  if(m){
    ['boat:stow','boat:maint','boat:docs','boat:voyage','home:check']
      .forEach(k => T('그 목록에 ' + k + ' 가 있다', m[0].includes("'" + k + "'")));
  } else fail += 7;
  const g = grab(js, 'boatNeedGuard') || '';
  T('안내를 그리고 원래 화면은 안 그린다', /return true/.test(g));
  // 3.16 에서 그리는 부분이 renderCurrent 로 옮겨졌다. 검사도 거기를 본다.
  T('화면을 그릴 때 그 검사를 쓴다',
    /if\(!curBoat\(\) && boatNeedGuard\(t\)\) return;/.test(grab(js, 'renderCurrent') || ''));
  // ★ 4.22 부터 함께 감출 것들을 STOW_EXTRA 한 곳에 모아 두었다 (벗길 때도 같은 목록을 쓴다).
  const extra = (js.match(/const STOW_EXTRA = \[[^\]]*\]/) || [''])[0];
  T('함께 감출 것들이 한 곳에 모여 있다', /stowTools/.test(extra) && /mapWrap/.test(extra), extra);
  T('적재표는 도구줄까지 함께 감춘다', /STOW_EXTRA/.test(g) || /stowTools/.test(g));
  // ★ 4.21 사고 — 안내를 넣으면서 화면 속살을 지웠더니, 배가 늦게 오면 그릴 칸이 없어 터졌다.
  T('지우지 않고 기억해 둔다', /needBoatSaved/.test(g));
  const off = grab(js, 'boatGuardOff') || '';
  T('배가 오면 도로 벗기는 문이 있다', off.length > 40);
  T('벗길 때 속살을 도로 넣는다', /innerHTML = needBoatSaved/.test(off));
  T('벗길 때 감췄던 것도 도로 보인다', /needBoatHid/.test(off));
  T('화면을 그릴 때 그 문을 쓴다',
    /if\(curBoat\(\)\) boatGuardOff\(\);/.test(grab(js, 'renderCurrent') || ''));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
