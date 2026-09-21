// 3.46 — 홈 화면에 추가
//
// 왜
//  · 뱃일은 앱스토어에 없다. 주소를 열면 브라우저 안에서 돈다.
//  · '홈 화면에 추가' 를 해야 아이콘이 생기고, 전체 화면으로 뜨고,
//    서비스워커가 제대로 붙어 배 위에서 인터넷 없이 열린다.
//  · 그런데 그걸 할 줄 아는 사람은 열에 한둘이다.
//    지금까지 앱에 그 안내가 한 줄도 없었다. 광고를 걸면 여기서 대부분이 샌다.
//
// ★ 지켜야 할 것
//   1. 이미 깔았으면 안 띄운다 — 깔고 나서도 계속 조르면 앱이 멍청해 보인다
//   2. 닫으면 한동안 안 띄운다 — 매번 띄우면 미움받는다
//   3. 아이폰은 브라우저가 도와주지 않는다 — 손으로 하는 길을 적어 줘야 한다
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
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 브라우저의 물음을 붙잡아 둔다
{
  // ★ 그냥 두면 브라우저가 제 방식대로 작은 띠를 띄웠다 지운다. 아무도 못 본다.
  T('브라우저가 물어 오면 붙잡아 둔다', /addEventListener\('beforeinstallprompt'/.test(js));
  T('브라우저 제 방식은 막는다', /e\.preventDefault\(\)/.test(
    js.slice(js.indexOf("addEventListener('beforeinstallprompt'"),
             js.indexOf("addEventListener('beforeinstallprompt'") + 300)));
  T('붙잡아 둘 자리가 있다', /let installEvt = null/.test(js));
  T('깔고 나면 잊는다', /addEventListener\('appinstalled'/.test(js));
}

// ── 2. ★ 언제 내놓나 — 실제로 돌려 본다
{
  const w = grab(js, 'installWanted') || '';
  T('내놓을 때를 정하는 곳이 있다', w.length > 0);
  const parts = [grab(js,'isStandalone'), grab(js,'isIOS'), grab(js,'installHidden'), w]
    .filter(Boolean).join('\n');
  const consts = ['INSTALL_HIDE_KEY','INSTALL_HIDE_DAYS']
    .map(k => (js.match(new RegExp('const ' + k + ' = [^\\n]*\\n')) || [''])[0]).join('');
  let F = null, err = '';
  try{
    F = (opt) => new Function('window','navigator','localStorage','Date','installEvt',
      consts + parts + '\n return { installWanted, isStandalone, isIOS, installHidden };')(
      { matchMedia: () => ({ matches: !!opt.standalone }),
        navigator: { standalone: !!opt.iosHome } },
      { userAgent: opt.ua || 'Mozilla/5.0 (Linux; Android 13) Chrome', maxTouchPoints: opt.touch || 0 },
      { getItem: () => (opt.hidAt == null ? null : String(opt.hidAt)), setItem: ()=>{} },
      { now: () => opt.now || 1e12 },
      opt.evt || null);
  }catch(e){ err = e.message; }
  T('판단을 돌렸다' + (err ? ' — ' + err : ''), !!F);
  if(F){
    const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari';
    // 안드로이드 크롬 — 브라우저가 물어 왔을 때만
    T('안드로이드: 물어 오면 내놓는다', F({ evt:{} }).installWanted() === true);
    T('안드로이드: 안 물어 오면 안 내놓는다 (깔 수 없는 곳이다)',
      F({}).installWanted() === false);
    // 아이폰 — 브라우저가 안 물어 온다. 그래도 안내는 해야 한다.
    T('아이폰: 물어 오지 않아도 내놓는다', F({ ua:IOS }).installWanted() === true);
    T('아이폰인 줄 안다', F({ ua:IOS }).isIOS() === true);
    // 요즘 아이패드는 맥인 척한다
    T('아이패드도 알아본다 (맥인 척한다)',
      F({ ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari', touch:5 }).isIOS() === true);
    T('진짜 맥은 아이폰이 아니다',
      F({ ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X) Safari', touch:0 }).isIOS() === false);

    // ★ 이미 깔았으면 안 띄운다
    T('이미 깔았으면 안 내놓는다 (전체화면)',
      F({ standalone:true, evt:{} }).installWanted() === false);
    T('아이폰에서 깔았어도 안 내놓는다',
      F({ ua:IOS, iosHome:true }).installWanted() === false);

    // ★ 닫으면 한동안 안 띄운다
    const now = 1e12;
    T('막 닫았으면 안 내놓는다',
      F({ evt:{}, hidAt: now - 1000, now }).installWanted() === false);
    const days = Number((js.match(/const INSTALL_HIDE_DAYS = (\d+)/) || [])[1] || 0);
    T('며칠 뒤에는 다시 내놓는다 — ' + days + '일',
      F({ evt:{}, hidAt: now - (days + 1) * 864e5, now }).installWanted() === true);
    T('쉬는 날수가 알맞다 — ' + days + '일', days >= 3 && days <= 30);
    T('기억이 없어도 안 죽는다', F({ evt:{} }).installHidden() === false);
  } else fail += 12;
}

// ── 3. 화면에 붙어 있나
{
  const c = grab(js, 'installCard') || '';
  T('오늘 화면에 놓을 안내가 있다', c.length > 0);
  T('내놓을 때만 그린다', /if\(!installWanted\(\)\) return ''/.test(c));
  // ★ 닫을 길이 없으면 미움받는다
  T('닫을 수 있다', /hideInstall\(\)/.test(c));
  // ★ 3.84 부터 사전을 거친다 — t('…') 로 감싸여 있다. 두 글자가 다른지가 요점이다.
  T('아이폰과 그 밖의 글자가 다르다',
    /isIOS\(\) \? t\('하는 법 보기'\) : t\('지금 추가하기'\)/.test(c));
  // ★ 왜 해야 하는지 말해 주지 않으면 아무도 안 누른다
  T('왜 해야 하는지 말한다', /인터넷이 없어도/.test(c));

  const rh = grab(js, 'renderHome') || '';
  T('오늘 화면 맨 위에 있다', rh.indexOf('installCard()') >= 0
    && rh.indexOf('installCard()') < rh.indexOf('homeCard('));
  T('서랍에도 자리가 있다', /id="insBtn"/.test(src));
  T('그 자리는 처음에 감춰져 있다', /id="insBtn" style="display:none"/.test(src));
  // ★ 글자 모양을 보는 대신 함수를 실제로 돌려 본다.
  //   4.41 에서 한 줄이 두 줄로 늘었더니 예전 글자 검사가 그냥 깨졌다.
  //   앞으로 어떻게 적든 「무엇이 감춰지는가」만 물으면 안 깨진다.
  const pm = grab(js, 'paintInstallMenu') || '';
  const runPM = (std, nat) => {
    const els = { insBtn:{style:{}}, reloadBtn:{style:{}} };
    const doc = { getElementById: id => els[id] || null };
    try {
      new Function('isStandalone','isNative','document',
        pm + '\nreturn paintInstallMenu;')(()=>std, ()=>nat, doc)();
    } catch(e){ return { ins:'터짐:'+e.message, rel:'터짐' }; }
    return { ins: els.insBtn.style.display, rel: els.reloadBtn.style.display };
  };
  T('그냥 브라우저면 둘 다 보인다',
    runPM(false,false).ins === '' && runPM(false,false).rel === '');
  T('깔았으면 서랍에서도 감춘다', runPM(true,false).ins === 'none');
  // ★ isStandalone() 은 캐퍼시터 앱을 못 알아본다.
  //   그래서 앱을 깔아 쓰는 사람에게도 「홈 화면에 추가」가 떠 있었다 — 눌러도 쓸모없는 줄.
  T('★ 앱에서도 홈 화면에 추가를 감춘다', runPM(false,true).ins === 'none');
  // ★ 앱에는 서비스워커가 없다. 「앱 새로 받기」는 못 하는 일을 하는 척하는 줄이었다.
  T('★ 앱에서는 앱 새로 받기를 감춘다', runPM(false,true).rel === 'none');
  T('PWA 에서는 앱 새로 받기가 남는다', runPM(true,false).rel === '');
  T('켤 때 한 번 살핀다', /\npaintInstallMenu\(\);/.test(js));
  T('모양이 정해져 있다', /\.insstep\{/.test(src) && /\.hcard\.ins\{/.test(src));
}

// ── 4. 누르면
{
  const o = grab(js, 'openInstall') || '';
  T('누르면 할 일이 있다', o.length > 0);
  // 안드로이드 — 붙잡아 둔 물음을 그대로 띄운다
  T('붙잡아 둔 물음을 띄운다', /installEvt\.prompt\(\)/.test(o));
  T('사람이 고른 결과를 본다', /userChoice/.test(o));
  // ★ 한 번 쓴 물음은 다시 못 쓴다. 안 비우면 두 번째부터 조용히 아무 일도 안 일어난다.
  T('쓴 물음은 비운다', /installEvt = null/.test(o));
  T('물음이 없으면 손으로 하는 길을 보여 준다', /installHowTo\(\)/.test(o));

  const h = grab(js, 'installHowTo') || '';
  T('손으로 하는 길이 있다', h.length > 0);
  T('아이폰 길과 그 밖의 길이 다르다', /isIOS\(\) \? ios : etc/.test(h));
  T('아이폰은 공유 단추부터', /공유/.test(h));
  T('그 밖은 점 세 개부터', /⋮/.test(h));
  // ★ 카카오톡·인스타그램 안에서 열면 설치가 아예 안 된다. 광고로 들어오면 대부분 그렇다.
  T('앱 안에서 열었을 때를 알려 준다', /카카오톡|인스타그램/.test(h));
  T('단계에 번호가 붙어 있다', /insno/.test(h));
}

// ── ★ 머리(head)에 박힌 앱 이름
// 화면 글자만 보면 이 자리를 못 본다. 실제로 앱 이름을 「뱃일」로 바꾼 뒤에도
// 아이폰 홈 화면 이름만 옛 이름(선내적재표)으로 여러 판 남아 있었다.
// 아이콘 밑에 찍히는 이름이라 사람이 가장 먼저 보는 자리다.
{
  const NAME = '뱃일';
  const head = src.slice(0, src.indexOf('</head>'));   // ★ js 는 <script> 안이라 head 가 없다
  const meta = (head.match(/<meta name="apple-mobile-web-app-title" content="([^"]*)"/) || [])[1];
  T('아이폰 홈 화면 이름이 있다', !!meta);
  T('아이폰 홈 화면 이름이 앱 이름과 같다 — ' + meta, meta === NAME);
  const title = (head.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  T('창 제목이 앱 이름으로 시작한다 — ' + title, title.startsWith(NAME));
  // 옛 이름이 어디에도 남아 있으면 안 된다
  T('옛 이름(선내적재표)이 남아 있지 않다', src.indexOf('선내적재표') < 0);
  // 설치에 필요한 파일을 가리키고 있나 (배포 서버에 있는지는 눈으로 확인할 것)
  T('manifest 를 가리킨다', /<link rel="manifest" href="manifest\.webmanifest">/.test(head));
  T('아이폰 아이콘을 가리킨다', /<link rel="apple-touch-icon"/.test(head));
  T('테마 색이 있다 (시작 화면 색)', /<meta name="theme-color"/.test(head));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
