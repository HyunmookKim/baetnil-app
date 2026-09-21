// 남의 배 게시물의 댓글·추천 (4.77)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let rules = ''; try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt','utf8'); }catch(_){}
let fn = ''; try{ fn = fs.readFileSync('/home/claude/index-merged.js','utf8'); }catch(_){}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };
const grab=(js,name)=>{ let i=js.indexOf('async function '+name+'('); if(i<0) i=js.indexOf('function '+name+'(');
  if(i<0) return ''; let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

// ── 열쇠를 만드는 곳은 하나
T('★★★ 열쇠 만드는 곳이 하나다', (src.match(/function bpKey\(/g)||[]).length === 1);
{
  const f = new Function(grab(src,'bpKey') + '\nreturn bpKey;')();
  T('★★ 배번호_기록번호 로 만든다', f('b1','r2') === 'b1_r2');
  T('★ 빈 값이어도 안 터진다', typeof f(null, null) === 'string');
}
// ── 새 코드를 만들지 않고 쓰던 문을 쓴다
T('★★★ 댓글은 쓰던 __cmt 를 그대로 쓴다', /window\.__cmt\.add\(BP_COLL/.test(src));
T('★★★ 추천은 쓰던 likeBtn 을 그대로 쓴다', /likeBtn\('bp'/.test(src));
T('★★ 추천 갈래에 이름이 붙어 있다', /bp:t\('도움됐어요'\)/.test(src));
T('★★ 추천이 어느 모음으로 가는지 적혀 있다', /bp:BP_COLL/.test(src));
T('★★ 그 줄을 찾는 곳도 있다', /kind === 'bp'/.test(grab(src,'likeRowOf')));

// ── 세 곳에 다 붙었나 (한 곳만 붙으면 나머지는 못 단다)
T('★★★ 항해일지에 붙는다', /\$\{bpSocial\(x\.id, v\.id\)\}/.test(src));
T('★★★ 정비수첩에 붙는다', /bpSocial\(\(boatPageData && boatPageData\.id\) \|\| '', m\.id\)/.test(src));
T('★★★ 리뷰에 붙는다',     /\$\{bpSocial\(x\.id, r\.id\)\}/.test(src));
T('★★ 만드는 곳은 하나다', (src.match(/function bpSocial\(/g)||[]).length === 1);

// ── 부르는 횟수
{
  const L = grab(src,'loadBpMeta');
  T('★★★ 숫자는 배 하나당 한 번에 받는다 (기록마다 안 부른다)', /window\.__bp\.many\(/.test(L), L.slice(0,200));
  T('★★ 파이어스토어 30개 한도를 지킨다', /i \+= 30/.test(src));
  T('★★ 댓글은 그 기록을 열 때만 받는다',
    /loadBpCmts\(\(boatPageData\|\|\{\}\)\.id, id\)/.test(src));
}
// ── 글을 남기는 문
{
  const W = grab(src,'bpWriteComment');
  T('★★ 로그인해야 남긴다', /needLogin|로그인해야/.test(W));
  T('★★ 막힌 사람은 못 남긴다', /myBan/.test(W));
  T('★★ 밖으로 나가는 글이라 거른다', /filter: true/.test(W));
  T('★ 빈 글은 안 남는다', /내용을 넣어 주세요/.test(W));
  T('★★ 지울 때는 묻는다', /await ask\(/.test(grab(src,'bpDelComment')));
}
// ── 규칙
{
  const g = (rules.match(/match \/bpMeta\/\{[a-zA-Z]+\}[\s\S]*?\n    \}/)||[''])[0];
  T('★★★ 규칙에 자리가 있다', !!g);
  T('★★ 누구나 읽는다', /allow read: if true/.test(g));
  T('★★★ 숫자는 한 번에 1씩만 움직인다',
    /== resource\.data\.get\('likeN', 0\) \+ 1/.test(g) && /== resource\.data\.get\('cmtN', 0\) \+ 1/.test(g));
  T('★★★ 숫자 말고 다른 칸은 못 넣는다', /hasOnly\(\['cmtN', 'likeN'\]\)/.test(g));
  T('★★★ 지우지 못한다 (지우면 추천이 통째로 날아간다)', /allow delete: if false/.test(g));
  T('★★ 댓글 방이 있다', /match \/comments\/\{cmtId\}/.test(g));
  T('★★ 남의 댓글은 못 고친다', /allow update: if false/.test(g));
  T('★★ 누른 방 이름이 uid 다 (두 번 못 누른다)', /match \/likes\/\{uid\}/.test(g));
  T('★★ 글 길이를 막는다', /text\.size\(\) <= 2000/.test(g));
}
// ── 서버 알림
{
  const F = grab(fn,'onBoatRecComment');
  T('★★★ 댓글 알림 함수가 있다', !!F && /exports\.pushBoatRecComment/.test(fn));
  T('★★★ 배 번호에 밑줄이 있어도 안 깨진다 (마지막 밑줄로 자른다)', /lastIndexOf\('_'\)/.test(F), F.slice(0,300));
  T('★★ 배 주인에게 보낸다', /b\.owner/.test(F));
  T('★★ 내 기록에 내가 단 것은 안 보낸다', /String\(b\.owner\) === String\(cmt\.by\)/.test(F));
  T('★★ 무슨 기록인지 제목을 찾아 준다', /\['voyage', 'mlog', 'review'\]/.test(F));
  T('★ 옛 함수 아홉 개가 그대로 있다', (fn.match(/^exports\./gm)||[]).length === 10, (fn.match(/^exports\.\w+/gm)||[]));
}
// ── 사전
['en','ru','ja'].forEach(L=>{
  const i = src.indexOf('\n  ' + L + ': {'), j = src.indexOf('\n  },', i);
  const d = i > 0 ? src.slice(i, j) : '';
  ['댓글','댓글 남기기'].forEach(k => T(L + " 에 「" + k + "」 가 있다", d.indexOf("'" + k + "':") >= 0));
});
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
