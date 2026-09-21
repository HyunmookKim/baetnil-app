// 3.29 — 커뮤니티 목록: 30개씩 받고, 받아 둔 것은 다시 안 받는다
//
// 왜
//  · 배 동기화는 3.28 에서 500번 → 30번으로 줄였는데, 커뮤니티는 그대로였다.
//    탭을 한 번 열 때마다 글판 200개 · 정박지 500개 · 장터 300개를 통째로 읽는다.
//    탭을 오갈 때마다 또 읽는다. 이제 여기가 읽기의 대부분이다.
//
// 어떻게
//  · 처음에는 30개(정박지는 100개)만 받고, 아래 '더 보기' 로 이어 받는다.
//  · 한 번 받은 것은 잠시 기억해 둔다. 탭을 오가도 다시 안 받는다.
//  · ★ 기억한 것이 낡으면 안 된다 — 새로고침 버튼을 두고,
//    글을 쓰거나 지우거나 신고한 뒤에는 기억을 스스로 버린다.
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
function grabM(s, name){
  const re = new RegExp('(?:^|[\\n{,])\\s*(?:async\\s+)?' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(s);
  if(!m) return null;
  let d = 0;
  for(let j = m.index + m[0].length - 1; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0) return s.slice(m.index, j + 1); }
  }
  return null;
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const mod = src.slice(src.indexOf('<script type="module">'));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 모듈 — 한 쪽씩 받는다
{
  T('이어받기를 들여온다 (startAfter)', /startAfter/.test(mod));
  const p = grab(mod, 'pageList') || '';
  T('쪽 단위로 받는 곳이 있다', p.length > 0);
  T('한 곳에서만 쪽을 나눈다 (컬렉션마다 따로 짜지 않는다)',
    (mod.match(/startAfter\(/g) || []).length <= 2);
  T('최신순으로 받는다', /orderBy\(/.test(p));
  T('개수를 정해 받는다', /limit\(/.test(p));
  T('이어받을 자리를 기억한다', /cursor/i.test(p));
  // ★ 처음부터 다시 받을 때 옛 자리를 안 지우면 첫 쪽을 건너뛴다
  T('처음부터 받을 때는 자리를 지운다', /if\(!more\)/.test(p));
  T('끝인지 알려 준다', /done/.test(p));
  const sz = (mod.match(/const PAGE_N = \{[\s\S]*?\};/) || [''])[0];
  T('쪽 크기가 한 곳에 정해져 있다', sz.length > 0);
  T('글판은 30개', /community\s*:\s*30/.test(sz));
  T('장터는 30개', /market\s*:\s*30/.test(sz));
  // 정박지는 지역을 훑어야 해서 조금 넉넉히 (배를 대는 자리라 찾기가 중요하다)
  T('정박지는 100개', /spots\s*:\s*100/.test(sz));

  ['__talk','__market','__spots'].forEach(k=>{
    const seg = mod.slice(mod.indexOf('window.' + k), mod.indexOf('window.' + k) + 900);
    T(k + ' 이 쪽 단위로 받는다', /pageList\(/.test(seg));
    // 3.51 부터 글판은 줄 세우기(ord)도 함께 받는다
    T(k + ' 이 더 받기를 받아 넘긴다', /list\(more[,)]/.test(seg));
  });
  // 옛 방식(통째로 받기)이 남아 있으면 안 된다
  T('글판을 200개씩 통째로 받지 않는다', !/limit\(200\)/.test(mod));
  T('장터를 300개씩 통째로 받지 않는다',
    !/limit\(300\)/.test(mod.slice(mod.indexOf('window.__market'),
      mod.indexOf('\n    };', mod.indexOf('window.__market')))));
  T('정박지를 500개씩 통째로 받지 않는다', !/limit\(500\)/.test(mod));
}

// ── 2. 앱 — 받아 둔 것은 다시 안 받는다
{
  const f = grab(js, 'listFresh') || '';
  T('기억이 쓸 만한지 보는 곳이 있다', f.length > 0);
  T('시간이 지나면 버린다', /LIST_TTL/.test(f));
  const ttl = (js.match(/const LIST_TTL = [^\n]*/) || [''])[0];
  T('기억해 두는 시간이 한 곳에 정해져 있다 — ' + ttl, ttl.length > 0);
  // ★ 너무 오래 들고 있으면 남이 쓴 글이 안 보인다. 5분 안쪽.
  T('그 시간이 5분을 넘지 않는다', /3e5|300000|18e4|180000/.test(ttl));
  T('기억을 넣는 곳이 있다', !!grab(js, 'listSet'));
  T('기억을 버리는 곳이 있다', !!grab(js, 'listDrop'));

  let ok = null, err = '';
  try{
    const src2 = (js.match(/const LIST_TTL = [^\n]*/) || [''])[0] + '\n'
      + (js.match(/let listCache = \{\};/) || [''])[0] + '\n'
      + grab(js,'listFresh') + '\n' + grab(js,'listSet') + '\n' + grab(js,'listDrop');
    const F = new Function(src2 + '\n return { listFresh, listSet, listDrop };')();
    F.listSet('talk', [{id:1}], false);
    ok = { 갓넣음: F.listFresh('talk'), 없는것: F.listFresh('market') };
    F.listDrop('talk');
    ok.버린뒤 = F.listFresh('talk');
  }catch(e){ err = e.message; }
  T('기억 다루기를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!ok);
  if(ok){
    T('막 넣은 것은 쓸 만하다', ok.갓넣음 === true);
    T('없는 것은 안 쓴다', !ok.없는것);
    T('버리면 안 쓴다', !ok.버린뒤);
  } else fail += 3;
}

// ── 3. 화면이 그 기억을 쓴다
{
  // 줄을 그리는 곳이 화면 함수에서 따로 떨어져 나온 것도 있다 (찾기 칸 때문에)
  [['renderTalk','renderTalk'], ['renderMarket','marketRowsHtml'], ['renderSpots','spotRowsHtml']]
   .forEach(([f, rf])=>{
    const g = grab(js, f) || '';
    T(f + ' 이 기억을 먼저 본다', /listFresh\(/.test(g));
    T(f + ' 이 받은 뒤 기억에 넣는다', /listSet\(/.test(g));
    T(rf + ' 아래에 더 보기·새로고침 줄이 붙는다', /listFoot\(/.test(grab(js, rf) || ''));
  });
  // ★ 더 보기는 '이어서' 받아야 한다. 처음부터 다시 받으면 같은 글이 겹친다.
  const foot = grab(js, 'listFoot') || '';
  T('더 보기·새로고침 줄이 한 곳에서 만들어진다', foot.length > 0);
  // ★ 4.115 — 「더 보기」 는 물품 카드의 ⋮ 차림표 이름이기도 했다. 자리가 둘이라
  //   한 낱말로 둘 다 맞출 수 없어 목록 이어받기를 「더 불러오기」 로 갈랐다.
  T('더 불러오기가 있다', /더 불러오기/.test(foot), foot.slice(0, 200));
  T('새로고침이 있다', /새로고침/.test(foot));
  T('끝까지 받았으면 더 불러오기를 안 보여 준다', /listDone\(/.test(foot));
  ['talkMore','marketMore','spotMore'].forEach(f=>{
    const g = grab(js, f) || '';
    T(f + ' 가 있다', g.length > 0);
    T(f + ' 는 이어받기를 부른다', /listMore\(/.test(g));
  });
  const lm = grab(js, 'listMore') || '';
  T('이어받기가 한 곳에 있다', lm.length > 0);
  // 3.51 부터 두 번째 값(줄 세우기)을 함께 넘긴다 — 첫 값은 그대로 true 여야 한다
  T('이어받기는 처음부터 다시 받지 않는다', /list\(true[,)]/.test(lm));
  // ★ 줄 세우기가 바뀌었는데 이어받기가 옛 순서로 받으면 목록이 뒤섞인다
  T('이어받기도 같은 줄 세우기를 쓴다', /api\.list\(true, ord\)/.test(lm)
    && /listMore\('talk',   window\.__talk, talkSort\)/.test(js));
  T('이어받은 것을 앞의 것에 잇는다', /concat\(/.test(lm));
}

// ── 4. ★ 낡은 것을 보여 주지 않는다
{
  // ★ 앱 곳곳에서 '버려라' 를 부르게 하면 언젠가 한 군데를 빠뜨린다.
  //   쓰는 그 자리(모듈)에서 버리게 한다.
  T('앱이 버리는 문을 열어 둔다', /window\.__listDrop = listDrop/.test(js));
  T('모듈이 그 문을 두드린다', /window\.__listDrop/.test(mod));
  const bust = (mod.match(/const bust = [^\n]*/) || [''])[0];
  T('버리기가 한 곳에 있다 — ' + bust.slice(0,60), bust.length > 0);
  [['__talk','talk'], ['__spots','spots'], ['__market','market']].forEach(([w,k])=>{
    // 그 창구가 끝나는 자리까지만 본다 — 더 가면 다음 창구의 함수를 잡는다
    const i0 = mod.indexOf('window.' + w);
    const seg = mod.slice(i0, mod.indexOf('\n    };', i0));
    const ms = [...seg.matchAll(/async (put|add|edit|del)\(/g)].map(x=>x[1]);
    T(w + ' 의 쓰기 창구를 찾았다 — ' + ms.join(','), ms.length >= 3);
    ms.forEach(m=>{
      const f = grabM(seg, m) || '';
      T(w + '.' + m + ' 뒤에 기억을 버린다', new RegExp("bust\\('" + k + "'\\)").test(f));
    });
  });
  const r = grab(js, 'listRefresh') || '';
  T('새로고침이 있다', r.length > 0);
  T('새로고침이 기억을 버리고 다시 그린다', /listDrop\(/.test(r));
}

// ── 5. ★ 모양을 바꿨으면 쓰던 곳을 다 고쳤는가
{
  // 실제로 겪은 일: 목록을 쪽 단위({rows, done})로 바꾸면서
  // 운영자 화면 두 곳이 배열로 받아 쓰던 것을 빠뜨렸다.
  // '사람' 탭이 (talk || []).forEach is not a function 으로 통째로 죽었다.
  T('전체가 필요할 때 쓰는 창구가 있다', !!grab(js, 'listAll'));
  const la = grab(js, 'listAll') || '';
  T('쪽 모양을 배열로 푼다', /\.rows/.test(la));
  T('옛 모양(배열)이 와도 받아 준다', /Array\.isArray\(/.test(la));
  T('실패해도 빈 배열을 준다', /return \[\]/.test(la));

  // ★ list() 를 부르면서 배열인 척 쓰는 곳이 남아 있으면 안 된다
  // __pub(배 둘러보기)은 쪽을 안 나눴다 — 그대로 배열이다
  const calls = [...js.matchAll(/window\.__(talk|market|spots)\.list\(([^)]*)\)/g)];
  const bad = calls.filter(m => {
    const after = js.slice(m.index + m[0].length, m.index + m[0].length + 60);
    // .rows 로 풀거나, listSet/listAll 안에서 쓰는 것만 옳다
    const before = js.slice(Math.max(0, m.index - 60), m.index);
    return !/\.rows|listSet\(|const r = /.test(before + after);
  }).map(m => m[0]);
  T('배열인 척 쓰는 곳이 없다 — ' + (bad.join(' | ') || '없음'), bad.length === 0);

  ['adminReports','adminPeople'].forEach(f=>{
    const g = grab(js, f) || '';
    if(g) T(f + ' 이 그 창구를 쓴다', /listAll\(/.test(g));
  });
}

// ── 6. ★ 찾기 칸에 글자를 치면 그 글자가 다 들어가야 한다
{
  // 실제로 겪은 일: 화면을 통째로 다시 그리니 찾기 칸이 새로 생기고,
  // 커서가 빠져서 두 번째 글자부터 아예 안 들어갔다.
  // 사람은 계속 다시 눌러 치고, 그때마다 목록을 다시 받아 하루 한도를 다 썼다.
  const inputs = [...js.matchAll(/oninput="([^"]+)"/g)].map(m=>m[1]);
  T('찾기 칸을 다 찾았다 — ' + inputs.length + '개', inputs.length >= 4);
  const bad = inputs.filter(x => /render[A-Z]\w*\(\)|openExplore\(/.test(x));
  T('찾기 칸이 화면을 통째로 다시 그리지 않는다 — ' + (bad.join(' | ') || '없음'), bad.length === 0);

  // ★ 3.83 부터 정박지·장터는 찾기 칸이 [앱 안 걸러내기 + 서버에 물어보기] 두 가지를 한다.
  //   줄만 갈아 끼우는 일은 따로 뺀 함수(spotPaintRows·marketPaintRows)가 맡는다.
  //   중요한 것은 함수 이름이 아니라 '화면을 통째로 다시 그리지 않는가' 이므로 둘을 함께 본다.
  [['spotFilter','spotRows','spotRowsHtml','renderSpots','spotPaintRows'],
   ['marketFilter','marketRows','marketRowsHtml','renderMarket','marketPaintRows'],
   ['exploreFilterUI','exploreRows','exploreRowsHtml','openExplore',null]].forEach(([f, id, rows, full, helper])=>{
    const g = (grab(js, f) || '') + (helper ? (grab(js, helper) || '') : '');
    T(f + ' 가 있다', g.length > 0);
    T(f + ' 는 목록 자리만 갈아 끼운다', new RegExp("getElementById\\('" + id + "'\\)").test(g));
    T(f + ' 가 줄을 따로 만든다', new RegExp(rows + "\\(\\)").test(g));
    // ★ 그 자리가 없을 때(화면이 아직 안 그려짐) 아무것도 안 하면 찾기가 먹통이 된다
    T(f + ' 는 자리가 없으면 통째로 그린다', new RegExp(full + "\\(").test(g));
    T(rows + ' 가 따로 있다', !!grab(js, rows));
    T('화면이 그 줄 자리를 만든다', new RegExp('id="' + id + '"').test(js));
  });
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
