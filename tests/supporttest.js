// 3.24 — 고객센터 (오류·불편·건의 받기)
//
// 정한 것
//  · 앱 안에서 바로 보낸다. 메일 주소를 찾아 헤매게 하지 않는다.
//  · 접수한 것은 클라우드에 남는다 — 메일이 안 가도 사라지지 않는다.
//  · 운영자 화면에서 모아 본다. 읽음 표시를 해서 놓치지 않는다.
//  · 메일로도 보낼 수 있게 한다 (mailto). 제목에 [뱃일] 을 붙여
//    받는 쪽에서 자동으로 걸러 담을 수 있게 한다.
//
// ★ 오류 신고에 기기 정보가 없으면 고칠 수가 없다.
//   앱 버전·브라우저·화면 크기·지금 보던 화면을 앱이 알아서 붙인다.
//   사람에게 "무슨 폰 쓰세요?" 를 묻는 것은 답을 못 받는 길이다.
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
const mod = src.slice(src.indexOf('<script type="module">'));
const drawer = src.slice(src.indexOf('<aside id="drawer"'), src.indexOf('</aside>') + 8);
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(e){}
const seg = k => (rules.match(new RegExp('match /' + k + '/\\{[a-zA-Z]+\\}[\\s\\S]*?\\n    \\}')) || [''])[0];
const allows = g => g.split('\n').map(l=>l.replace(/\/\/.*$/, '')).join('\n')
  .split(/allow /).slice(1).map(x => x.split(';')[0]);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 어디서나 닿는 자리에 있다
{
  T('서랍에 고객센터가 있다', /openSupport\(\)/.test(drawer));
  T('보내는 화면이 있다', !!grab(js, 'openSupport'));
  const o = grab(js, 'openSupport') || '';
  // ★ 3.73 부터 고객센터 화면은 SUPPORT_ASK 를 쓴다 —
  //   SUPPORT_KINDS 에서 '연재자 신청' 을 뺀 것이다 (그건 전용 화면으로 받는다).
  T('무엇을 보낼지 고른다', /SUPPORT_(KINDS|ASK)/.test(o));
  const k = (js.match(/const SUPPORT_KINDS = \[[\s\S]*?\];/) || [''])[0];
  ['bug','idea','ask','etc'].forEach(v=>
    T('보낼 것에 ' + v + ' 가 있다', new RegExp("v:'" + v + "'").test(k)));
}

// ── 2. ★ 기기 정보를 앱이 알아서 붙인다
{
  const f = grab(js, 'supportInfo') || '';
  T('기기 정보를 모으는 곳이 있다', f.length > 0);
  T('앱 버전을 붙인다', /APP_VER/.test(f));
  T('브라우저를 붙인다', /userAgent/.test(f));
  T('화면 크기를 붙인다', /innerWidth|screen\./.test(f));
  T('지금 보던 화면을 붙인다', /curTab|curScreen\(/.test(f));
  T('온라인인지도 붙인다', /onLine/.test(f));
  // 실제로 돌려서 값이 나오는지 본다
  let out = null, err = '';
  if(f){
    try{
      const fn = new Function('APP_VER','navigator','window','curTab','homeSub','boatSubTab','comSub',
        f + '\n return supportInfo;')(
        '3.24',
        { userAgent:'Mozilla/5.0 (Linux; Android 14) Chrome/120', onLine:true },
        { innerWidth:412, innerHeight:915 },
        'community','today','stow','talk');
      out = fn();
    }catch(e){ err = e.message; }
  }
  T('기기 정보를 실제로 만들었다' + (err ? ' — ' + err : ''), typeof out === 'string' && out.length > 0);
  if(typeof out === 'string'){
    T('버전이 들어 있다 — ' + out.slice(0, 40) + '…', /3\.24/.test(out));
    T('화면 크기가 들어 있다', /412/.test(out));
    T('보던 화면이 들어 있다', /community/.test(out));
  } else fail += 3;
}

// ── 3. 보낸 것이 사라지지 않는다
{
  const s2 = grab(js, 'sendSupport') || '';
  T('보내는 곳이 있다', s2.length > 0);
  T('내용 없이 보내지 않는다', /trim\(\)/.test(s2));
  T('클라우드에 남긴다', /__support/.test(s2));
  T('기기 정보를 함께 남긴다', /supportInfo\(/.test(s2));
  // ★ 인터넷이 안 될 수 있다. 그때도 길이 있어야 한다.
  T('못 보내면 메일로 보내라고 알려 준다', /메일/.test(s2));
  const m = grab(js, 'supportMail') || '';
  T('메일로 보내는 길이 있다', m.length > 0);
  T('메일 주소가 정해져 있다', /SUPPORT_MAIL/.test(m) || /mailto:/.test(m));
  // ★ 제목에 표가 있어야 받는 쪽에서 자동으로 걸러 담을 수 있다
  T('메일 제목에 [뱃일] 표를 붙인다', /\[뱃일\]/.test(m));
  T('메일에도 기기 정보를 넣는다', /supportInfo\(/.test(m));
}

// ── 4. 운영자가 모아 본다
{
  const a = grab(js, 'adminSupport') || '';
  T('운영자 화면에 접수함이 있다', a.length > 0);
  T('안 읽은 것이 먼저 보인다', /done|read/.test(a));
  T('읽음 표시를 할 수 있다', !!grab(js, 'supportDone'));
  T('보낸 사람에게 갈 수 있다', /openPerson\(/.test(a));
  const tabs = (js.match(/const ADMIN_TABS = \[[\s\S]*?\];/) || [''])[0];
  T('운영자 칸 목록에 들어 있다', /support/.test(tabs));
}

// ── 5. 클라우드
{
  T('접수를 주고받는 곳이 있다', /window\.__support = \{/.test(mod));
  ['add','list','edit'].forEach(k=>
    T('__support 에 ' + k + ' 이 있다',
      new RegExp('async ' + k + '\\(').test(mod.slice(mod.indexOf('window.__support')))));
}

// ── 6. ★ 규칙
if(rules){
  const g = seg('support');
  T('접수 규칙이 있다', g.length > 0);
  const A = allows(g);
  const one = k => A.filter(x=>new RegExp('^' + k).test(x)).join(' ');
  T('로그인한 사람은 보낼 수 있다', /signedIn\(\)/.test(one('create')));
  T('남의 이름으로 못 보낸다',
    /request\.resource\.data\.by == request\.auth\.uid/.test(one('create')));
  // ★ 남의 신고를 아무나 읽으면 안 된다 — 사연이 들어 있다
  T('아무나 남의 접수를 훑지 못한다', /isAdmin\(\)|isStaff\(\)|adminCan\(/.test(one('list')));
  T('처리 표시는 운영자만', /adminCan\(|isAdmin\(\)|isStaff\(\)/.test(one('update')));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (5건)'); fail += 5; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
