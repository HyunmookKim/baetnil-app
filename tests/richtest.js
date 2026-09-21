// 글 편집기 검증 — 워드처럼 쓰다가 사진이 그 위치에 들어간다
//
// 2.15 까지의 잘못: 글 칸과 사진 칸이 따로 있고, [사진1] 표시를 손으로 맞춰야 했다.
// 소개 페이지는 더 나빴다 — 글 넣기 → 사진 넣기 → 또 글 넣기 로 조립을 시켰다.
// 게시판이 아니라 조립기였다.
//
// 있어야 하는 것: 그냥 쓰다가 붙여넣으면 사진이 커서 자리에 들어가고, 그 뒤로 계속 써진다.
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
const css = src.slice(0, src.indexOf('</style>'));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 편집기가 있는가
T('편집기 항목(rich)이 있다', /'rich'/.test(grab(js, 'openForm') || ''));
// ★ 3.80 부터 속살이 Quill 이다. 글 칸은 Quill 이 만들므로 앱에는
//   contenteditable 이 없다 — 대신 편집기를 세우는 자리가 있어야 한다.
T('편집기를 세우는 자리가 있다', /qlMake\(/.test(grab(js, 'openForm') || ''));
T('남의 서버에서 안 불러온다 (앱 안에 있다)',
  /<script id="quilljs">/.test(src) && !/src=["'][^"']*quill/i.test(src));
T('편집기 칸에 모양이 있다', /\.rich\b/.test(css) && /\.ql-editor/.test(css));

// ── 2. 블록 ↔ 편집기 (Delta) 변환
T('블록을 편집기 내용으로 바꾼다', !!grab(js, 'blocksToDelta'));
T('편집기 내용을 블록으로 되돌린다', !!grab(js, 'deltaToBlocks'));
{
  const bd = grab(js, 'blocksToDelta') || '';
  T('사진은 그림 조각으로 넣는다', /image\s*:/.test(bd));
  T('소제목·목록도 넣는다', /header/.test(bd) && /list/.test(bd));
  const db = grab(js, 'deltaToBlocks') || '';
  const wr = grab(js, 'qlWrap') || '';
  T('글은 줄바꿈을 지킨다', /<br>/.test(db));
  T('남의 글자를 그대로 넣지 않는다 (esc)', /esc\(/.test(wr));
  // ★ 받을 서식을 못 박아야 남의 글을 붙여넣어도 색·글꼴이 안 딸려 온다
  T('받을 서식을 못 박아 둔다',
    /formats\s*:\s*\[/.test(grab(js, 'qlMake') || ''));
}

// ── 3. 붙여넣기 — 커서 자리에 들어간다
{
  const rp = grab(js, 'onRichPaste') || '';
  T('편집기가 붙여넣기를 받는다', rp.length > 0);
  T('붙여넣기가 글과 사진을 순서대로 읽는다', /pasteParts/.test(rp));
  T('사진을 줄여서 넣는다', /resizePhotos|resizePhoto/.test(rp));
  // 커서 다루기는 richMark/richInsert 가 한다 — 거기까지 같이 본다
  const cur = rp + (grab(js, 'richMark') || '') + (grab(js, 'richInsert') || '');
  // ★ Quill 은 커서를 글자 번호로 다룬다 (DOM Range 가 아니다)
  T('커서 자리에 넣는다',
    /getSelection\(\)/.test(cur) && /setSelection\(/.test(cur));
  T('사진 넣는 동안 자리를 잡아 둔다', /placeholder|자리|넣는 중/.test(rp));
  T('사진이 없으면 브라우저에 맡기지 않고 글자만 넣는다', /preventDefault/.test(rp));
  // 빠져나가는 조건이 '사진이 없을 때' 여야 한다.
  // 조건을 늘 참으로 바꾸면 사진이 통째로 무시되는데 글자만 보면 안 잡힌다.
  T('사진이 있으면 빠져나가지 않는다',
    /if\(\s*!photos\.length\s*\)/.test(rp)
    && rp.indexOf('resizePhotos') > rp.indexOf('!photos.length'));

  // 편집기 내용에서 사진을 실제로 뽑아내는가
  // ★ 3.80 부터 Quill 의 Delta 에서 뽑는다. 사진은 insert:{image:…} 로 들어 있다.
  const rb = grab(js, 'deltaToBlocks') || '';
  T('편집기가 사진을 블록으로 돌려준다',
    /ins\.image|insert\.image/.test(rb) && /t\s*:\s*'photo'/.test(rb));
  // 중요한 것은 이름이 아니라 '사진을 담기 전에 모아 둔 글을 먼저 비우는가' 다.
  T('보이는 순서를 지킨다 (모아 둔 글을 먼저 비운다)',
    /flush\(\)/.test(rb)
    && rb.indexOf('flush();') < rb.indexOf("t:'photo'"));
}

// ── 4. [사진N] 표시는 이제 안 쓴다
T('사진 표시를 손으로 맞추게 하지 않는다',
  !/\[사진' \+/.test(grab(js, 'onFormPaste') || '') || !grab(js, 'onFormPaste'));

// ── 5. 소개 페이지 — 한 번에 쓴다
{
  const ob = grab(js, 'openBoat') || '';
  T('소개는 버튼 하나로 고친다', /editIntro\(\)/.test(ob));
  T('글 넣기·사진 넣기 버튼을 따로 두지 않는다',
    !/addIntro\('text'\)/.test(ob) && !/addIntro\('photo'\)/.test(ob));
  const ei = grab(js, 'editIntro') || '';
  T('소개 고치기가 편집기를 쓴다', /type\s*:\s*'rich'/.test(ei));
  T('소개 고치기가 지금 내용을 그대로 불러온다', /b\.intro/.test(ei));
  T('저장하면 순서 그대로 남는다', /saveIntro|b\.intro\s*=/.test(ei));
}

// ── 6. 게시판도 같은 편집기
{
  const wp = grab(js, 'writePost') || '';
  T('게시판 글쓰기가 편집기를 쓴다', /type\s*:\s*'rich'/.test(wp));
  T('사진 칸을 따로 두지 않는다', !/type\s*:\s*'photos'/.test(wp));
  T('글을 블록으로 저장한다', /blocks/.test(wp));
}

// ── 7. 용량 (문서 1MB)
{
  const fv = grab(js, 'formVals') || '';
  T('저장할 때 블록을 넘긴다', /qlRead\(/.test(fv));
  T('용량이 넘으면 알린다', /photoBudget/.test(js));
}

// ── 8. 보여주는 쪽은 그대로
// ★ 4.126 — 그리는 문을 postBodyHtml 하나로 합쳤다.
//   (남의 배 게시판이 body 글자만 그려 사진·표가 사라지던 것을 고치면서.)
{
  const pb = grab(js, 'postBodyHtml') || '';
  T('글 몸통을 그리는 문이 있다 (postBodyHtml)', !!pb);
  T('글 화면은 블록을 순서대로 그린다', /renderBlocks\(p\.blocks/.test(pb), pb.slice(0,200));
  T('내 배 글 화면이 그 문을 쓴다', /postBodyHtml\(p,/.test(grab(js, 'openPost') || ''));
  T('남의 배 글도 같은 문으로 그린다 (사진·표가 사라지지 않는다)',
    (js.match(/postBodyHtml\(p/g) || []).length >= 2);
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
