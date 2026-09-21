// 사진째 붙여넣기 검증
//
// 사용자가 글과 사진이 섞인 내용을 통째로 복사해서 붙여넣으면
// 사진까지 그대로 들어가야 한다. 지금은 글자만 들어가고 사진이 사라진다.
//
// 파이어스토어 문서 한 개는 1MB 가 한계다. 사진을 그대로 넣으면 넘는다.
// 붙여넣을 때 줄여 넣고, 그래도 넘치면 사람이 읽을 수 있게 알려야 한다.
//
// ★★★ 4.118 — pasteParts 가 **진짜 DOM** 을 쓰게 바뀌었다 (서식을 지킨 채 나눈다).
//   DOMParser · richClean · richSafe · richText · tblFromNode 가 필요하다.
//   node 에서 함수만 떼어 eval 하면 DOMParser 가 없어 예비 길로 빠지고,
//   그러면 「사진이 사라지는」 옛 동작을 시험하게 된다 — 헛통과다.
//   그래서 이 대목만 진짜 브라우저에서 앱을 띄워 놓고 부른다.
const fs = require('fs'), http = require('http'), path = require('path');
const { chromium } = require('playwright');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const FILE = process.argv[2] || 'work.html';
// 인자가 절대경로면 그대로 쓴다
const rel = q => path.isAbsolute(q) ? q : path.join(__dirname, q);
const src = fs.readFileSync(rel(FILE), 'utf8');
const BASEDIR = path.dirname(rel(FILE));
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const server = http.createServer((rq, rs) => {
  const u = rq.url === '/' ? null : rq.url.split('?')[0];
  const f = u === null ? rel(FILE) : path.join(BASEDIR, u);
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type', 'font/woff2');
    rs.writeHead(200); rs.end(d); });
});

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

const need = ['pasteParts', 'photoBudget', 'formPhotoAdd', 'formPhotoDel', 'onFormPaste'];
const missing = need.filter(f => !grab(js, f));
if(missing.length){
  console.log('★ 실패: 함수가 없습니다 — ' + missing.join(', '));
  fail += missing.length;
}

// ── 2. 크기 한계를 지킨다 (문서 1MB)
if(grab(js, 'photoBudget')){
  eval('globalThis.photoBudget = ' + grab(js, 'photoBudget'));
  const kb = n => 'x'.repeat(n * 1024);
  T('한계 안이면 다 받는다', photoBudget([kb(100), kb(100)], 900).ok === true);
  T('넘치면 넘는 것만 뺀다', photoBudget([kb(400), kb(400), kb(400)], 900).kept.length === 2);
  T('넘치면 알린다', photoBudget([kb(400), kb(400), kb(400)], 900).ok === false);
  T('몇 장이 빠졌는지 말해준다', photoBudget([kb(400), kb(400), kb(400)], 900).dropped === 1);
}

// ── 3. 줄여서 넣는다
{
  const rz = grab(js, 'resizePhoto') || '';
  T('사진을 줄이는 함수가 있다', rz.length > 0);
  T('가로세로를 줄인다', /canvas|drawImage/.test(rz));
  T('용량이 넘으면 화질을 더 낮춘다', /while|for/.test(rz) && /toDataURL/.test(rz));
}

// ── 4. 입력 화면에 사진이 붙는다
{
  const of = grab(js, 'openForm') || '';
  T('입력 화면이 사진 항목을 그린다', /'photos'/.test(of));
  T('여러 줄 칸에 붙여넣기를 받는다', /onFormPaste|onpaste/.test(of));
  const fv = grab(js, 'formVals') || '';
  T('저장할 때 사진도 함께 넘긴다', /photo/i.test(fv));
}

// ── 5. 게시판과 소개 페이지에서 쓴다
{
  const wp = grab(js, 'writePost') || '';
  // 3.0 부터 사진 칸을 따로 두지 않는다 — 편집기 안에 글과 섞여 들어간다
  T('게시판 글쓰기가 편집기를 쓴다', /type\s*:\s*'rich'/.test(wp));
  T('게시판 글에 사진이 저장된다', /photos/.test(wp));
  // 소개 페이지도 같은 입력 화면(openForm)의 사진 항목을 쓴다
  const ai = grab(js, 'addIntro') || '';
  T('소개 페이지 글 넣기에 사진 항목이 있다', /type\s*:\s*'photos'/.test(ai));
  T('소개 페이지가 사진을 순서대로 넣는다', /t\s*:\s*'photo'/.test(ai));
  // 3.41 부터 용량 재기는 storePhotos 안에서 한다 (창고로 보낸 뒤에 재야 맞다)
  T('소개 페이지도 용량 한계를 지킨다', /photoBudget|storePhotos/.test(ai));
}

// ── 6. 넣은 사진을 실제로 보여준다 (넣기만 하면 반쪽 작업이다)
{
  // ★ 본문 그리기는 postBodyHtml 한 곳으로 모았다 (글 화면·배 소개가 같이 쓴다)
  const op = grab(js, 'openPost') || '';
  const pb = grab(js, 'postBodyHtml') || '';
  T('글 화면이 본문 그리는 문을 쓴다', /postBodyHtml\(p,/.test(op));
  T('글 화면이 붙인 사진을 보여준다', /p\.photos/.test(pb));
  T('사진을 눌러 크게 볼 수 있다', /pvOpen/.test(pb));
  const bp = grab(js, 'buildPublic') || '';
  T('공개 글에도 사진이 실린다', /photos/.test(bp));
  T('공개 문서도 용량 한계를 지킨다', /photoBudget/.test(bp));
}

// ── 7. 사진은 클라우드로 나간다 (게시판은 posts 컬렉션)
T('게시판 글은 통째로 올라가 사진도 따라간다', /curPO = snapOf\(posts\)/.test(js));

// ── 8. 글과 사진이 섞인 순서 그대로 들어간다
//    주신 소개글 파일처럼 글 → 사진 → 글 → 사진 순서가 지켜져야 한다.
//    2.14 까지는 글은 글대로, 사진은 뒤에 몰아서 붙었다.
{
  T('사진 자리 표시가 있다', /const PHOTO_MARK/.test(js) || /\[사진/.test(js));
  // 3.0 부터 [사진N] 표시는 안 쓴다. 편집기가 커서 자리에 바로 꽂는다.
  const rp = grab(js, 'onRichPaste') || '';
  T('붙여넣기가 사진을 커서 자리에 꽂는다',
    /pasteParts/.test(rp) && /richInsert/.test(rp));

  const bf = grab(js, 'blocksFromText');
  T('글과 사진을 순서대로 엮는 함수가 있다', !!bf);
  if(bf){
    // 새 상수는 하네스에도 올려야 한다 (실행방법.txt 규칙)
    { const m = js.match(/const PHOTO_MARK = [^;]+;/);
      if(m) eval(m[0].replace('const PHOTO_MARK', 'globalThis.PHOTO_MARK')); }
    eval('globalThis.blocksFromText = ' + bf);
    const ph = ['A','B'];
    const r = blocksFromText('첫 글\n[사진1]\n둘째 글\n[사진2]', ph);
    T('표시 자리에 사진이 들어간다',
      r.length === 4 && r[0].t === 'text' && r[1].t === 'photo' && r[1].v === 'A'
      && r[2].t === 'text' && r[3].v === 'B');
    T('표시가 없으면 글 뒤에 사진을 붙인다',
      (function(){ const q = blocksFromText('글만', ph);
        return q[0].t === 'text' && q[1].t === 'photo' && q.length === 3; })());
    T('표시만 있고 사진이 없으면 표시를 지운다',
      (function(){ const q = blocksFromText('글 [사진5] 끝', []);
        return q.length === 1 && !/\[사진/.test(q[0].v); })());
    T('사진을 두 번 쓰지 않는다',
      (function(){ const q = blocksFromText('[사진1][사진1]', ['A']);
        return q.filter(x=>x.t==='photo').length === 1; })());
    T('빈 글은 넣지 않는다',
      (function(){ const q = blocksFromText('[사진1]', ['A']);
        return q.length === 1 && q[0].t === 'photo'; })());
  } else { fail += 5; console.log('★ 실패: blocksFromText 가 없어 5건 건너뜀'); }

  // 화면에 순서대로 그린다
  T('블록을 그리는 함수가 있다', !!grab(js, 'renderBlocks'));
  const op = grab(js, 'openPost') || '';
  const pb = grab(js, 'postBodyHtml') || '';
  T('글 화면이 섞인 순서대로 보여준다',
    /postBodyHtml\(p,/.test(op) && /renderBlocks/.test(pb));
  const wp = grab(js, 'writePost') || '';
  T('글을 저장할 때 순서를 남긴다', /blocks/.test(wp));
  // 새 글에서 사진을 안 넘기면 붙여넣은 사진이 통째로 사라진다
  T('새 글에도 사진을 넘긴다', /addPost\([^)]*photos\)/.test(wp));
  T('새 글에도 순서(blocks)를 남긴다', /np\.blocks\s*=/.test(wp));
  const ai = grab(js, 'addIntro') || '';
  T('소개 페이지도 순서대로 넣는다', /blocksFromText/.test(ai));
  const bp = grab(js, 'buildPublic') || '';
  T('공개 글도 순서를 가져간다', /blocks/.test(bp));
  // 옛 글은 그대로 보여야 한다
  T('옛 글(블록 없음)도 그대로 보인다', /Array\.isArray\(p\.blocks\)/.test(pb) && /p\.body/.test(pb));
}

// ── 9. ★ 붙여넣은 내용을 글과 사진으로 나눈다 (진짜 브라우저에서)
//   4.118 부터 pasteParts 는 DOMParser 와 richClean/richSafe/richText 를 쓴다.
//   함수만 떼어 node 에서 부르면 예비 길로 빠져 **사진이 사라지는 옛 동작**을 시험하게 된다.
(async () => {
  await new Promise(r => server.listen(0, r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  await pg.goto('http://127.0.0.1:' + server.address().port + '/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);

  T('앱 안에 붙여넣기를 가르는 문이 있다',
    await pg.evaluate(() => typeof pasteParts === 'function'));

  // 앱의 pasteParts 를 그대로 부르고, 글 덩이는 앱의 richText 로 읽어 본다
  const 나누기 = (html, plain) => pg.evaluate(([h, p]) => {
    const out = pasteParts(h, p);
    return (out || []).map(x => Object.assign({}, x,
      x.t === 'text' || x.t === 'head' ? { 글: richText(x.v) } : {}));
  }, [html, plain]);

  const D = 'data:image/jpeg;base64,AAAA';
  {
    const html = '<p>여수 웅천에 배를 대놨다.</p>'
               + '<p><img src="' + D + '1"></p>'
               + '<p>1991년 프랑스에서 만들어진 베네토.</p>'
               + '<p><img src="' + D + '2"></p>';
    const r = await 나누기(html, '');
    T('글과 사진을 순서대로 나눈다',
      r.length === 4 && r[0].t === 'text' && r[1].t === 'photo'
      && r[2].t === 'text' && r[3].t === 'photo');
    T('글에서 태그를 벗겨낸다', r[0].글 === '여수 웅천에 배를 대놨다.');
    T('사진은 그림 자료(data:)를 그대로 가져온다', r[1].v === D + '1');
  }
  {
    const r2 = await 나누기('', '그냥 글자만 붙여넣기');
    T('사진 없이 글만 붙여넣어도 된다',
      r2.length === 1 && r2[0].t === 'text' && r2[0].v === '그냥 글자만 붙여넣기');
  }
  {
    const r3 = await 나누기('<p>글</p><img src="https://example.com/a.jpg">', '');
    T('인터넷 주소 사진은 가져오지 않는다 (안 보이는 사진을 넣지 않는다)',
      r3.every(x => x.t !== 'photo'));
  }
  T('빈 문단은 버린다', (await 나누기('<p></p><p>  </p><p>글</p>', '')).length === 1);
  {
    // ★ 4.118 부터 줄바꿈은 <br> 로 **지킨 채** 담는다. 읽으면 같은 줄이 나와야 한다.
    const r4 = await 나누기('<p>줄1<br>줄2</p>', '');
    T('줄바꿈을 지킨다', /줄1\n줄2/.test(r4[0].글));
  }
  {
    // ★ 4.118 부터 글 덩이는 안전한 HTML 이다 — 읽어 내면 원래 글자가 나와야 한다
    const r5 = await 나누기('<p>&lt;배&gt; &amp; 짐</p>', '');
    T('&amp; 같은 문자를 되돌린다', r5[0].글 === '<배> & 짐');
  }
  {
    // ★ 4.118 에서 서식을 지키기로 했다 — 굵게가 살아 있어야 한다 (표 때문에 죽였던 자리)
    const r6 = await 나누기('<p>보통 <b>굵게</b></p>', '');
    T('굵게·기울임 같은 서식을 지킨다', /<(b|strong)>/i.test(r6[0].v) && r6[0].글 === '보통 굵게');
  }

  await br.close();
  server.close();
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})();
