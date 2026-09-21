// 게시물 자동 번역 (4.70)
//
// ★ 사장님이 정하신 것
//   「사용자가 이게 번역인지 아닌지 알면 불편하잖아. 그냥 누르면 자동으로 번역되게 하고
//    게시물 제목은 처음부터 번역돼서 보여야지. 그게 뭔 줄 알고 사용자가 번역을 할지 말지를 하냐」
//
//   맞는 말이다. 무슨 글인지 알아야 누를지 말지를 정하는데, 알려면 이미 읽은 뒤다.
//   그래서 **내 말이 아닌 글은 알아서 옮겨서 보여 준다.** 단추는 「원어로 보기」 하나만 남는다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(n){
  let i = src.indexOf('function ' + n + '('); if(i < 0) i = src.indexOf('async function ' + n + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

// ── ① 일본어를 알아본다 (여기가 막혀 있으면 아래가 다 소용없다)
{
  const F = new Function(grab('trSameLang') + '\nreturn trSameLang;')();
  T('★★★ 일본어에서 한국어 글을 「남의 말」 로 본다', F('회로 뚜껑 자물쇠 파손','ja') === false);
  T('★★ 일본어 글은 일본어에서 그대로 둔다', F('インペラ交換','ja') === true);
  T('★★ 한자만 있는 글도 일본어로 본다', F('海水系統 点検','ja') === true);
  T('★ 한국어에서 일본어 글은 남의 말이다', F('インペラ交換','ko') === false);
  T('★ 영어·러시아어는 그대로다', F('Impeller replaced','en') === true && F('Замена','ru') === true);
  T('★ 숫자·날짜뿐이면 옮길 것이 없다', F('2026-08-29','ja') === true);
  // ★ 옛 흠 — 마지막 줄이 return true 라 일본어에서는 무엇이든 「내 말」 이었다
  T('★★★ 일본어가 무조건 통과되지 않는다', F('안녕하세요 여수입니다','ja') === false);
}

// ── ② 누르게 하지 않는다
{
  const B = grab('trBar');
  T('★★★ 안 옮겨진 남의 말 글은 알아서 옮긴다', /trAuto\(/.test(B), B.slice(-500));
  T('★★★ 「번역해서 보기」 를 기본으로 내놓지 않는다',
    B.indexOf('trAuto(') < B.indexOf("t('번역해서 보기')"), B.slice(-500));
  T('★★ 옮긴 뒤에는 「원어로 보기」 만 남는다', /trOff\(/.test(B) && /원어로 보기/.test(B));
  // ★ 4.85 — 「내 말인가」 를 셈하는 곳을 trMine 하나로 모았다.
  //   전에는 trBar 와 trAuto 가 따로 셈해서, 한국어 글에 러시아어 댓글이 달리면
  //   trBar 는 옮기라 하고 trAuto 는 「한국어네」 하며 되돌아갔다 — 영영 안 옮겨졌다.
  T('★ 내 말로 쓰인 글에는 아무것도 안 붙인다', /if\(trMine\(/.test(B), B.slice(0,600));
}

// ── ③ 자동 번역이 값을 새게 하지 않는다
{
  const A = grab('trAuto'), P = grab('trPump');
  T('★★ 자동으로 부르는 곳이 있다 (trAuto)', !!A);
  T('★★★ 이미 옮긴 것은 다시 안 부른다', /TR_GOT\[key \+ ':' \+ lang\]/.test(A), A);
  T('★★★ 부르는 중인 것은 또 안 부른다', /TR_BUSY\[key\]/.test(A));
  T('★★★ 같은 글을 줄에 두 번 넣지 않는다', /trQ\.some/.test(A), A);
  T('★★ 내 말로 쓰인 글은 안 부른다', /trMine\(src, cmt\)/.test(A));
  T('★★★ 「원어로 보기」 를 누른 글은 다시 자동으로 안 옮긴다', /TR_SKIP\[key\]/.test(A));
  T('★★ 한 번에 몇 개만 부른다 (목록에서 수십 개가 한꺼번에 나가지 않게)',
    /TR_PAR/.test(P) && /const TR_PAR = \d+/.test(src), (src.match(/const TR_PAR = \d+/)||[''])[0]);
  T('★ 인터넷이 없으면 안 부른다', /navigator\.onLine === false/.test(A));
  T('★ 로그인 안 했으면 안 부른다 (서버가 안 받는다)', /meUid\(\)/.test(A));
}

// ── ④ 제목이 처음부터 옮겨져 보인다
{
  T('★★★ 배 문서 안의 기록을 골라 쓰는 곳이 있다 (trIn)', !!grab('trIn'));
  T('★★ 옮겨 온 것이 없으면 원문 그대로 둔다 (빈 글자로 갈아 끼우지 않는다)',
    /\(v == null \|\| v === ''\) \? String\(orig/.test(grab('trIn')), grab('trIn'));
  // 남의 배 목록 — 사장님이 제일 먼저 보는 자리
  const E = grab('expRowsHtml');
  T('★★★ 남의 배 목록이 배마다 알아서 옮긴다', /trAuto\('boatPublic'/.test(E), E.slice(0,700));
  T('★★ 배마다 한 번만 부른다', /seen\[bid\]/.test(E), E.slice(0,700));
  ['voyage','mlog','review'].forEach(k=>
    T('★★ 목록 제목이 ' + k + ' 번역을 지난다', new RegExp("trIn\\('" + k + "'").test(src), k));
  // 배 페이지 안
  T('★★ 정비수첩 절차 한 줄 한 줄도 옮긴다', /trIn\('mlog', m\.id, 'h'\+i/.test(src));
  T('★★ 항해 메모도 옮긴다', /trIn\('voyage', v\.id, 'note'/.test(src));
  T('★★ 리뷰 본문·아쉬운 점도 옮긴다',
    /trIn\('review', r\.id, 'text'/.test(src) && /trIn\('review', r\.id, 'bad'/.test(src));
  // 소개가 비어도 기록으로 말을 가려낸다
  T('★★★ 소개가 비어 있어도 기록 제목으로 말을 가려낸다', /function pubBoatText\(/.test(src)
    && /pubBoatText\(x\)/.test(src), grab('pubBoatText'));
}

// ── ⑤ 옮겨 온 것이 도착하면 화면이 다시 그려진다
{
  const R = grab('trRepaint');
  T('★★ 배 페이지를 다시 그린다', /paintBoatPage\(\)/.test(R));
  T('★★★ 목록을 보고 있으면 목록을 다시 그린다 (안 그리면 제목이 원문으로 남는다)',
    /exploreRowsHtml\(\)/.test(R), R);
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
