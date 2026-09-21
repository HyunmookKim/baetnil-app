// 3.45 — 반응 (도움됐어요 · 가봤어요 · 찜)
//
// 왜 넣는가
//  · 순위를 매기려는 것이 아니다. 글 쓴 사람이 반응을 받게 하려는 것이다.
//    정박지 수심을 재서 정성껏 올렸는데 아무 기척이 없으면 두 번은 안 올린다.
//
// ★ 지켜야 할 것 셋
//  1. 0이면 숫자를 안 보인다 — 사람이 적을 때 '0' 이 줄줄이 있으면 죽은 동네로 보인다
//  2. 누가 눌렀는지를 문서에 안 적는다 — 1,000명이면 글 하나가 30KB, 목록 30개면 900KB
//  3. 규칙이 숫자 하나만, 1씩만 움직이게 막는다 — 앱에서만 막으면 브라우저로 뚫린다
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
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(e){}

let pass = 0, fail = 0;
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 곳마다 이름이 다르다
{
  const L = (js.match(/const LIKE_LABEL = \{[^\n]*\n/) || [''])[0];
  T('이름표가 있다', L.length > 0);
  T('글판은 도움됐어요', /talk:\s*(t\()?'도움됐어요'/.test(L));
  T('배 게시판도 도움됐어요', /post:\s*(t\()?'도움됐어요'/.test(L));
  // ★ 정박지에 '좋아요' 는 어색하다. 다녀온 사람이 하는 말이어야 한다.
  T('정박지는 가봤어요', /spots:\s*(t\()?'가봤어요'/.test(L));
  T('장터는 찜', /market:\s*(t\()?'찜'/.test(L));
  T('좋아요라는 말은 안 쓴다', !/좋아요/.test(L));
}

// ── 2. ★ 0이면 숫자를 안 보인다
{
  const c = grab(js, 'likeCount') || '';
  T('숫자를 만드는 곳이 있다', c.length > 0);
  let F = null;
  try{ F = new Function(c + '\n return likeCount;')(); }catch(e){}
  T('숫자 만들기를 돌렸다', !!F);
  if(F){
    T('0이면 아무것도 안 나온다 — "' + F(0) + '"', F(0) === '');
    T('없어도 아무것도 안 나온다', F(undefined) === '' && F(null) === '');
    T('1이면 나온다 — "' + F(1) + '"', F(1).trim() === '1');
    T('이상한 값도 안 무너진다', F('abc') === '');
  } else fail += 4;

  const b = grab(js, 'likeBtn') || '';
  T('단추를 만드는 곳이 있다', b.length > 0);
  T('단추가 그 숫자를 쓴다', /likeCount\(/.test(b));
  T('단추마다 이름이 붙는다 — 하나만 다시 그리려고', /id="lk_\$\{kind\}_/.test(b));
  // ★ 목록에서 글을 열려고 누르다가 반응이 눌리면 안 된다
  T('목록 누름과 겹치지 않는다', /event\.stopPropagation\(\)/.test(b));
  T('이미 누른 것은 표시가 남는다', /likedOn\(/.test(b) && /' on'/.test(b));
}

// ── 3. ★ 누가 눌렀는지는 내 폰에
{
  const a = grab(js, 'likedAll') || '', m = grab(js, 'likedMark') || '';
  T('내가 누른 것을 기억하는 곳이 있다', a.length > 0 && m.length > 0);
  // ★ 5.0 — 추천은 이제 **계정마다** 담는다 (pGet/pSet). 기기 한 칸에 담으면
  //   폰 하나를 둘이 쓸 때 앞사람이 누른 추천이 내 것으로 보인다.
  T('폰에 둔다 (계정마다)', /pGet\('bt_likes'\)/.test(a) && /pSet\('bt_likes'/.test(m));
  T('한 열쇠에 모아 둔다', /'bt_likes'/.test(js) && /PERSONAL_KEYS/.test(js));
  T('망가진 자료에도 안 죽는다', /catch\(_\)\{ return \{\}; \}/.test(a));

  let F = null;
  try{
    const store = {};
    // ★ 5.0 — 개인 칸의 문(pGet/pSet)을 흉내 내서 넘긴다
    F = new Function('pGet', 'pSet',
      a + '\n' + (grab(js,'likedOn')||'') + '\n' + m
      + '\n return { likedOn, likedMark };')(
        k => (k in store ? store[k] : null),
        (k, v) => { store[k] = String(v); }
      );
  }catch(e){}
  T('눌림 기억을 돌렸다', !!F);
  if(F){
    T('처음엔 안 눌린 상태', F.likedOn('talk', 'A1') === false);
    F.likedMark('talk', 'A1', true);
    T('누르면 기억한다', F.likedOn('talk', 'A1') === true);
    T('다른 글은 그대로', F.likedOn('talk', 'A2') === false);
    // ★ 같은 번호라도 곳이 다르면 다른 것이다
    T('글판 A1 과 장터 A1 은 다른 것', F.likedOn('market', 'A1') === false);
    F.likedMark('talk', 'A1', false);
    T('다시 누르면 지워진다', F.likedOn('talk', 'A1') === false);
  } else fail += 5;

  // ★ 계정 번호를 문서에 적으면 목록이 무거워진다
  const t = grab(js, 'toggleLike') || '';
  // ★ 3.61 부터는 숫자를 앱이 계산해 쓰지 않는다.
  //   누가 눌렀는지 방을 하나 남기고, 숫자는 서버가 더한다(increment).
  //   앱이 계산해 쓰면 둘이 동시에 누를 때 하나가 사라진다.
  T('서버가 숫자를 더하게 맡긴다', /window\.__like\.set\(/.test(t));
  T('앱이 숫자를 계산해 쓰지 않는다', !/\{ likeN: next \}/.test(t));
  const M = src.slice(src.indexOf('<script type="module">'));
  const ls = M.slice(M.indexOf('window.__like'), M.indexOf('window.__like') + 1200);
  T('누가 눌렀는지 방을 남긴다', /'likes'/.test(ls));
  T('숫자는 서버가 더한다', /increment\(on \? 1 : -1\)/.test(ls));
  T('이미 그 상태면 숫자를 안 건드린다', /if\(on === had\) return;/.test(ls));
  T('누른 사람 목록을 문서에 안 적는다', !/likes\s*:/.test(t) && !/likedBy/.test(t));
}

// ── 4. 눌렀을 때
{
  const t = grab(js, 'toggleLike') || '';
  T('누르는 곳이 있다', t.length > 0);
  // ★ 인터넷을 기다리게 하면 안 눌린 줄 알고 또 누른다
  T('화면을 먼저 바꾼다', t.indexOf('likeRepaint(') < t.indexOf('await'));
  T('실패하면 되돌린다', /row\.likeN = before/.test(t) && /likedMark\(kind, id, was\)/.test(t));
  T('실패를 알려 준다', /tell\(/.test(t));
  T('0 아래로는 안 내려간다', /Math\.max\(0,/.test(t));
  T('배 게시판은 배 자료로 저장한다', /if\(kind === 'post'\)/.test(t) && /save\(\)/.test(t));
  T('로그인해야 누른다', /로그인해야/.test(t));
  // 배 게시판은 내 배 자료라 로그인 없이도 된다
  T('배 게시판은 로그인을 안 따진다', /kind !== 'post' && needLogin\(/.test(t));

  const r = grab(js, 'likeRepaint') || '';
  T('단추 하나만 다시 그린다', r.length > 0 && /getElementById\('lk_'/.test(r));
  T('없는 단추를 건드리지 않는다', /if\(!el\) return/.test(r));

  const ro = grab(js, 'likeRowOf') || '';
  T('네 곳을 다 찾는다', /talkList/.test(ro) && /spotList/.test(ro)
    && /marketList/.test(ro) && /postOf/.test(ro));
}

// ── 5. 화면에 실제로 붙어 있나
{
  const ot = grab(js, 'openTalk') || '';
  T('글판 글에 단추가 있다', /likeBtn\('talk'/.test(ot));
  const os = grab(js, 'openSpot') || '';
  T('정박지에 단추가 있다', /likeBtn\('spots'/.test(os));
  const oi = grab(js, 'openItem') || '';
  T('장터에 단추가 있다', /likeBtn\('market'/.test(oi));
  const op = grab(js, 'openPost') || '';
  T('배 게시판에 단추가 있다', /likeBtn\('post'/.test(op));
  // 목록에서는 숫자만 보인다 (잘못 누르기 쉬우므로 누르는 것은 글 안에서)
  const rt = grab(js, 'renderTalk') || '';
  T('글판 목록에 반응 수가 보인다', /likeN/.test(rt));
  T('글판 목록에 댓글 수도 보인다', /comments\|\|\[\]\)\.length/.test(rt));
  T('목록에는 누르는 단추를 안 둔다', !/likeBtn\(/.test(rt));
  T('단추 모양이 정해져 있다', /\.likeb\{/.test(src) && /\.likeb\.on\{/.test(src));

  // ★ 새로 올리는 것에 숫자 자리가 없으면 나중에 '도움된 순' 으로 못 줄 세운다
  T('새 글에 숫자 자리를 둔다', /likeN: 0,/.test(js));
  T('새 정박지에도 둔다', /likeN: spotPickCtx\.id/.test(js));
  T('새 장터 물건에도 둔다', /likeN: old \? \(old\.likeN\|\|0\) : 0/.test(js));
}

// ── 6. ★ 규칙 — 진짜 방어선
if(rules){
  const seg = n => {
    const i = rules.indexOf('match /' + n + '/');
    return i < 0 ? '' : rules.slice(i, rules.indexOf('\n    }', i));
  };
  ['community','spots','market'].forEach(n=>{
    const g = seg(n);
    T(n + ' 에 반응 갈래가 있다', /affectedKeys\(\)\.hasOnly\(\['likeN'\]\)/.test(g));
    // ★ 한 번에 1씩만. 안 그러면 브라우저에서 9999 로 올려 버린다.
    T(n + ' 은 1씩만 움직인다', /== resource\.data\.get\('likeN', 0\) \+ 1/.test(g)
      && /== resource\.data\.get\('likeN', 0\) - 1/.test(g));
    T(n + ' 은 숫자만 받는다', /get\('likeN', 0\) is int/.test(g));
    T(n + ' 은 0 아래로 못 내린다', /get\('likeN', 0\) >= 0/.test(g));
    T(n + ' 은 로그인·정지 확인을 지난다', /allow update: if signedIn\(\) && !banned\(\)/.test(g));
  });
  // ★ 예전 댓글 갈래는 남의 글 본문을 통째로 바꿀 수 있었다
  const c = seg('community');
  T('댓글 갈래가 comments 만 바꾸게 되어 있다',
    /affectedKeys\(\)\.hasOnly\(\['comments'\]\)/.test(c));
  T('옛 헐거운 댓글 갈래가 남아 있지 않다',
    !/댓글만 다는 경우 — 본문은 그대로여야 한다/.test(rules));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (17건)'); fail += 17; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
