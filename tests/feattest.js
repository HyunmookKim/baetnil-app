// 3.39 — 커뮤니티 기능을 운영자가 그 자리에서 잠근다
//
// 왜
//  · 중고 장터는 돈이 오가는 곳이고 면책 조항이 아직 변호사 검토 전이다.
//    베타 중에 사기가 한 건 나면 앱보다 운영자가 다친다.
//  · 그때 앱을 새로 만들어 올리고 사람들이 받기를 기다릴 수는 없다.
//    그 자리에서 잠그고, 모든 사람에게 곧바로 먹혀야 한다.
//
// ★ 제일 중요한 것 — 기본은 '켬' 이다.
//   설정을 못 받아왔다고 기능이 통째로 사라지면, 인터넷이 잠깐 끊긴 사람에게
//   앱의 절반이 없어진다. 잠그는 것은 운영자가 분명히 잠갔을 때뿐이다.
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
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(e){}

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 잠글 수 있는 것들
{
  const f = (js.match(/const FEATURES = \[[\s\S]*?\];/) || [''])[0];
  T('잠글 수 있는 것 목록이 있다', f.length > 0);
  ['talk','spots','market','news'].forEach(k=>
    T(k + ' 을 잠글 수 있다', new RegExp("k:'" + k + "'").test(f)));
  T('무엇을 잠그는지 사람 말로 적는다', /why:/.test(f));
  // ★ 장터는 왜 잠그는지가 특히 중요하다 — 운영자가 급할 때 헤매면 안 된다
  T('장터에 이유가 붙어 있다', /돈이 오가는/.test(f));
}

// ── 2. ★ 기본은 켬
{
  const on = grab(js, 'featOn') || '';
  T('켜졌는지 보는 곳이 있다', on.length > 0);
  let fn = null, err = '';
  try{
    fn = new Function('featOff', on + '\n return featOn;');
  }catch(e){ err = e.message; }
  T('판단을 실제로 돌렸다' + (err ? ' — ' + err : ''), !!fn);
  if(fn){
    const 아무것도없음 = fn({});
    const 장터잠금 = fn({ market:true });
    T('아무 설정이 없으면 다 켜져 있다', 아무것도없음('market') === true && 아무것도없음('talk') === true);
    T('잠근 것만 꺼진다', 장터잠금('market') === false && 장터잠금('talk') === true);
  } else fail += 2;
  const load = grab(js, 'loadFeat') || '';
  T('설정을 받아오는 곳이 있다', load.length > 0);
  // ★ 못 받아왔다고 기능이 사라지면 안 된다
  T('못 받아오면 전부 켠 것으로 본다', /catch\(e\)\{ featOff = \{\}/.test(load));
  T('한 번만 받는다', /featLoaded/.test(load));
  T('켤 때 한 번 받는다', /loadFeat\(\)/.test(js.replace(load, '')));
}

// ── 3. 잠근 것은 화면에서 빠진다
{
  const l = grab(js, 'comSubList') || '';
  T('하위 탭을 거르는 곳이 있다', l.length > 0);
  T('잠근 것을 뺀다', /featOn\(/.test(l));
  // ★ 운영자는 잠근 것도 봐야 한다. 안 그러면 다시 열 길이 없다.
  T('운영자에게는 보인다', /isAdmin\(/.test(l));
  T('운영자 화면에는 닫혔다고 표시한다', /닫힘/.test(l));
  T('제목 줄이 그 목록을 쓴다', /list: \(\) => comSubList\(\)/.test(js));

  const sc = grab(js, 'setComSub') || '';
  T('잠긴 곳으로 가면 열지 않는다', /!featOn\(comSub\)/.test(sc));
  T('그때 운영자는 통과시킨다', /!isAdmin\(\)/.test(sc));

  // 화면 셋이 스스로도 확인한다 — 안 보이게만 하면 옛 주소로 들어올 수 있다
  [['renderTalk','talk'], ['renderSpots','spots'], ['renderMarket','market']].forEach(([f,k])=>{
    const g = grab(js, f) || '';
    T(f + ' 이 잠금을 스스로 본다', new RegExp("featOn\\('" + k + "'\\)").test(g));
    T(f + ' 이 닫혔다고 알려 준다', /featClosedHtml\(/.test(g));
  });
  const c = grab(js, 'featClosedHtml') || '';
  T('닫힘 안내가 있다', c.length > 0);
  T('무엇이 닫혔는지 이름을 말한다', /f && f\.name|FEATURES\.find/.test(c));
  T('다시 열린다고 알려 준다', /다시 열리면/.test(c));
  T('물어볼 곳을 알려 준다', /고객센터/.test(c));
  // ★ '중고 장터은' 처럼 나오면 앱이 어설퍼 보인다
  T('받침에 맞는 조사를 쓴다', /josa\(/.test(c));
  const j = grab(js, 'josa') || '';
  T('조사 고르는 곳이 있다', j.length > 0);
  let jf = null;
  try{ jf = new Function(j + '\n return josa;')(); }catch(e){}
  T('조사 고르기를 돌렸다', !!jf);
  if(jf){
    T('받침 있으면 은 — 중고 장터' + jf('중고 장터','은','는'), jf('중고 장터','은','는') === '는');
    T('받침 있으면 은 — 글판' + jf('글판','은','는'), jf('글판','은','는') === '은');
    T('한글이 아니면 무너지지 않는다', typeof jf('Market','은','는') === 'string');
    T('빈 것도 다룬다', typeof jf('','은','는') === 'string');
  } else fail += 4;
}

// ── 4. 운영자 화면
{
  const tabs = (js.match(/const ADMIN_TABS = \[[\s\S]*?\];/) || [''])[0];
  T('운영자 칸에 기능 잠금이 있다', /k:'feat'/.test(tabs));
  T('그 칸은 운영자 권한이 있어야 한다', /k:'feat',[\s\S]{0,60}?need:'admin'/.test(tabs));
  const a = grab(js, 'adminFeat') || '';
  T('잠금 화면이 있다', a.length > 0);
  T('켜고 끄는 버튼이 있다', /setFeat\('\$\{f\.k\}',false\)/.test(a) && /setFeat\('\$\{f\.k\}',true\)/.test(a));
  // ★ 잠그면 자료가 지워지는 줄 알면 아무도 못 누른다
  T('자료는 안 지워진다고 알려 준다', /지워지지 않/.test(a));
  T('운영자 화면이 그 칸을 그린다', /adminTab === 'feat'/.test(js));

  const sf = grab(js, 'setFeat') || '';
  T('바꾸는 곳이 있다', sf.length > 0);
  T('운영자만 바꾼다', /isAdmin\(\)|isStaff\(\)/.test(sf));
  T('클라우드에 남긴다', /__config\.set\(/.test(sf));
  T('바꾸면 화면이 곧바로 따라온다', /paintHNav\(/.test(sf));
  T('실패하면 알려 준다', /tell\(/.test(sf));
}

// ── 5. 클라우드 창구
{
  T('설정 창구가 있다', /window\.__config = \{/.test(mod));
  const seg = mod.slice(mod.indexOf('window.__config'), mod.indexOf('window.__config') + 500);
  T('읽는 길이 있다', /async get\(/.test(seg));
  T('쓰는 길이 있다', /async set\(/.test(seg));
  // ★ 문서 하나뿐이라 읽기 한 번이면 끝난다
  T('문서 하나만 쓴다', /'config', ?'app'/.test(seg));
}

// ── 6. ★ 규칙 — 진짜 방어선
if(rules){
  const g = (rules.match(/match \/config\/\{[a-zA-Z]+\}[\s\S]*?\n    \}/) || [''])[0];
  T('설정 규칙이 있다', g.length > 0);
  // ★ 4.20 — 설정은 누구나 읽는다.
  //   로그인 없이도 커뮤니티를 보게 열었는데 설정만 막아 두면,
  //   기능 잠금을 못 읽어서 '못 받으면 전부 켠 것으로 본다' 로 떨어진다 —
  //   잠근 탭이 로그인 안 한 사람에게만 열려 버린다. 그래서 같이 열었다.
  T('설정은 누구나 읽는다 (그래야 기능 잠금이 모두에게 걸린다)',
    /allow read: if true/.test(g));
  // ★ 앱에서만 막으면 브라우저에서 고쳐 뚫린다. 아무나 장터를 잠그면 안 된다.
  // ★ 3.76 부터 isStaff() — 연재자를 뺀 진짜 운영자만. 더 좁아진 것이다.
  T('바꾸는 것은 운영자만', /allow write: if (isAdmin|isStaff)\(\)/.test(g));
  T('연재자는 기능을 못 잠근다', /allow write: if isStaff\(\)/.test(g));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (3건)'); fail += 3; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
