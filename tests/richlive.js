// 글 편집기 — 소제목 · 굵게 · 사진, 그리고 연재. 진짜 브라우저에서 눌러 본다.
// ★ 정규식으로 소스만 보는 검사로는 "실제로 굵게 저장되는가" 를 못 잡는다.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = process.argv[2] || 'work.html';
const server = http.createServer((rq,rs)=>{
  const f = ((rq.url === '/' && path.isAbsolute(FILE)) ? FILE : path.join(__dirname, rq.url === '/' ? FILE : rq.url.split('?')[0]));
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w):''));} };

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:780}, isMobile:true, hasTouch:true });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} });

  const PNG = 'data:image/png;base64,iVBORw0KGgo=';
  await pg.evaluate(p=>{ window.PNGX = p; }, 'data:image/png;base64,iVBORw0KGgo=');
  const URL1 = 'https://firebasestorage.googleapis.com/v0/b/x/o/a.jpg?alt=media';
  const URL2 = 'https://firebasestorage.googleapis.com/v0/b/x/o/b.jpg?alt=media';

  // ── 1. 블록 → 편집기 → 블록 왕복
  const rt = await pg.evaluate(({PNG,URL1,URL2})=>{
    // ★ 3.80 부터 편집기 속살이 Quill 이다. 덩이 → Delta → 덩이 로 돈다.
    const put = b => deltaToBlocks(blocksToDelta(b));
    return {
      plain: put([{t:'text',v:'첫줄\n둘째줄'}]),
      head:  put([{t:'head',v:'소제목입니다'},{t:'text',v:'본문'}]),
      bold:  put([{t:'text',v:'앞 **굵게** 뒤'}]),
      mixed: put([{t:'text',v:'하나'},{t:'photo',v:URL1},{t:'text',v:'둘'},{t:'photo',v:PNG}]),
      two:   put([{t:'photo',v:URL1},{t:'photo',v:URL2}])
    };
  }, {PNG,URL1,URL2});

  // ★ 3.78 부터 글자는 '안전한 HTML'(h:1) 로 담는다 — 기울임·밑줄까지 담으려면
  //   별표 방식으로는 안 된다. 옛 글(h 없음)은 그대로 읽는다.
  T('글이 그대로 돌아온다',
    rt.plain.length===1 && rt.plain[0].h===1 && rt.plain[0].v==='첫줄<br>둘째줄', rt.plain);
  T('소제목이 소제목으로 돌아온다',
    rt.head.length===2 && rt.head[0].t==='head' && rt.head[0].v==='소제목입니다' && rt.head[1].t==='text', rt.head);
  T('옛 글의 별표 굵게가 굵게로 읽힌다',
    rt.bold.length===1 && rt.bold[0].v==='앞 <b>굵게</b> 뒤', rt.bold);
  // ★ 사고 — 창고에 올린 사진(https)이 고칠 때마다 사라졌다
  T('창고 사진이 고칠 때 사라지지 않는다',
    rt.mixed.filter(x=>x.t==='photo').length===2, rt.mixed);
  T('사진 자리가 글 사이 그대로다',
    rt.mixed.map(x=>x.t).join(',')==='text,photo,text,photo', rt.mixed.map(x=>x.t));
  T('사진 두 장이 순서대로 남는다',
    rt.two.length===2 && rt.two[0].v===URL1 && rt.two[1].v===URL2, rt.two);

  // ── 2. 화면에 그리기
  const rb = await pg.evaluate(({PNG,URL1})=>{
    const h = renderBlocks([{t:'text',v:'하나'},{t:'photo',v:URL1},{t:'head',v:'소제목'},{t:'photo',v:PNG}], 'PH');
    return { h,
      idx: (h.match(/pvOpen\(PH,(\d+)\)/g)||[]),
      esc: renderBlocks([{t:'text',v:'<script>alert(1)</script> **굵게**'}], null),
      hd:  renderBlocks([{t:'head',v:'<b>나쁜</b> 소제목'}], null) };
  }, {PNG,URL1});
  // ★ 사고 — 사진 번호가 블록 번호였다. 글이 섞이면 엉뚱한 사진이 열렸다
  T('사진 번호가 0,1 로 이어진다',
    rb.idx.join('|')==='pvOpen(PH,0)|pvOpen(PH,1)', rb.idx);
  T('소제목이 pbhead 로 나온다', rb.h.indexOf('class="pbhead"')>=0);
  T('굵게가 <b> 로 나온다', rb.esc.indexOf('<b>굵게</b>')>=0, rb.esc);
  T('나쁜 글자는 그대로 안 나간다',
    rb.esc.indexOf('<script>')<0 && rb.esc.indexOf('&lt;script&gt;')>=0, rb.esc);
  T('소제목 안 나쁜 글자도 막는다', rb.hd.indexOf('&lt;b&gt;')>=0, rb.hd);

  // ── 3. 소개 한 조각 (세 곳이 이것 하나를 쓴다)
  const ii = await pg.evaluate(()=>({
    head: introInner({t:'head',v:'제목'},{flat:true}),
    text: introInner({t:'text',v:'글 **굵게**'},{flat:true}),
    vid:  introInner({t:'video',v:'https://youtu.be/x'})
  }));
  T('소개에도 소제목이 나온다', ii.head.indexOf('pbhead')>=0, ii.head);
  T('소개 글에도 굵게가 걸린다', ii.text.indexOf('<b>굵게</b>')>=0, ii.text);
  T('소개 유튜브는 그대로다', ii.vid.indexOf('유튜브 열기')>=0);

  // ── 4. 편집기 단추를 실제로 눌러 본다
  await pg.evaluate(()=>{
    window.__got = null;
    openForm({ title:'검사', fields:[{ key:'doc', type:'rich', label:'내용',
      value:[{t:'text',v:'첫 줄'},{t:'text',v:'둘째 줄'}] }],
      onOk: v => { window.__got = v.doc; } });
  });
  await pg.waitForTimeout(200);
  T('rich 칸에 소제목 단추가 있다',
    await pg.evaluate(()=>!!document.querySelector('.rtool .rtb[onclick*="richHead"]')));
  // 워드패드에 있는 것이 다 있는가
  // ★ 3.80 부터 Quill 이름을 쓴다 (strikeThrough → strike, insert…List → bullet/ordered)
  for(const [cmd, nm] of [['bold','굵게'],['italic','기울임'],['underline','밑줄'],
                          ['strike','취소선'],
                          ['bullet','글머리표'],['ordered','번호']]){
    T('도구줄에 ' + nm + ' 이 있다',
      await pg.evaluate(c=>!!document.querySelector(`.rtool .rtb[onclick*="'${c}'"]`), cmd));
  }
  T('단추가 글 칸에서 손을 떼지 않게 막았다',
    await pg.evaluate(()=>{
      const b=document.querySelector('.rtool .rtb[onclick*="bold"]');
      return !!(b && (b.getAttribute('onmousedown')||'').indexOf('preventDefault')>=0); }));
  // ★ 도구줄은 글 칸 '위' 에 있어야 한다. 아래에 뒀다가 지적받았다.
  T('도구줄이 글 칸 위에 있다',
    await pg.evaluate(()=>{
      const el=document.getElementById('ff0');
      const b=document.querySelector('.rtool .rtb[onclick*="richHead"]');
      return !!(el && b && b.getBoundingClientRect().top < el.getBoundingClientRect().top); }));
  T('사진 단추도 도구줄에 있다',
    await pg.evaluate(()=>!!document.querySelector('.rtool .rtb[onclick*="richPickPhoto"]')));

  // ★ 3.80 부터 편집기 속살이 Quill 이다.
  //   단추를 눌러 보는 검사(소제목·굵게·사진 고르기·백스페이스·한글 조합)는
  //   qlive.js 로 옮겼다 — 거기서 진짜로 누르고 진짜 IME 로 친다.
  //   여기서는 '이미 올라간 글이 편집기를 한 번 다녀와도 그대로인가' 만 본다.
  //   그것이 깨지면 남이 쓴 글을 우리가 망가뜨리는 것이라 제일 무겁다.
  const fmt = await pg.evaluate(()=>{
    const put = b => deltaToBlocks(blocksToDelta(b));
    return {
      it:   put([{t:'text',h:1,v:'<i>기울임</i>보통'}]),
      un:   put([{t:'text',h:1,v:'<u>밑줄</u>'}]),
      st:   put([{t:'text',h:1,v:'<s>취소</s>'}]),
      bo:   put([{t:'text',h:1,v:'<b>굵게</b>보통'}]),
      ul:   put([{t:'list',ord:0,items:['하나','<b>둘</b>']}]),
      ol:   put([{t:'list',ord:1,items:['첫째']}]),
      mix:  put([{t:'text',h:1,v:'글'},{t:'list',ord:0,items:['목록']},{t:'text',h:1,v:'뒤'}]),
      hd:   put([{t:'head',h:1,v:'소제목'},{t:'text',h:1,v:'본문'}]),
      two:  put([{t:'text',h:1,v:'첫 줄<br>둘째 줄'}])
    };
  });
  T('기울임이 남는다', fmt.it[0] && fmt.it[0].v==='<i>기울임</i>보통', fmt.it);
  T('밑줄이 남는다',   fmt.un[0] && fmt.un[0].v==='<u>밑줄</u>', fmt.un);
  T('취소선이 남는다', fmt.st[0] && fmt.st[0].v==='<s>취소</s>', fmt.st);
  T('굵게가 남는다',   fmt.bo[0] && fmt.bo[0].v==='<b>굵게</b>보통', fmt.bo);
  T('글머리표가 목록으로 담긴다',
    fmt.ul.length===1 && fmt.ul[0].t==='list' && !fmt.ul[0].ord
    && fmt.ul[0].items.join('|')==='하나|<b>둘</b>', fmt.ul);
  T('번호 매기기가 목록으로 담긴다',
    fmt.ol.length===1 && fmt.ol[0].t==='list' && fmt.ol[0].ord===1, fmt.ol);
  T('글과 목록이 섞여도 순서가 지켜진다',
    fmt.mix.map(x=>x.t).join(',')==='text,list,text', fmt.mix.map(x=>x.t));
  T('소제목은 소제목으로 남는다',
    fmt.hd.map(x=>x.t).join(',')==='head,text' && fmt.hd[0].v==='소제목', fmt.hd);
  T('한 덩이 안 두 줄이 그대로다', fmt.two.length===1 && fmt.two[0].v==='첫 줄<br>둘째 줄', fmt.two);

  // ★ 옛 글은 style 로 굵어진 채 담겨 있을 수 있다 (execCommand 시절).
  //   그것도 화면에 굵게 나와야 한다 — 안 그러면 옛 글의 서식이 사라진다.
  T('style 로 굵어진 옛 글도 굵게 나온다',
    await pg.evaluate(()=>renderBlocks(
      [{t:'text',h:1,v:'<span style="font-weight:700">굵</span>보통'}], null).indexOf('<b>굵</b>')>=0),
    await pg.evaluate(()=>renderBlocks(
      [{t:'text',h:1,v:'<span style="font-weight:700">굵</span>보통'}], null)));

  // ── ★ 서식을 HTML 로 담으니 거르는 것이 생명이다
  const safe = await pg.evaluate(()=>{
    const put = b => deltaToBlocks(blocksToDelta(b));
    return {
      scr:  put([{t:'text',h:1,v:'앞<span>가운데</span>뒤'}]),
      // 저장돼 있던 나쁜 글자를 화면에 낼 때
      show: renderBlocks([{t:'text',h:1,v:'<script>alert(1)<\/script><b>굵게</b>'}], null),
      img:  renderBlocks([{t:'text',h:1,v:'<img src=x onerror="window.__hacked=1">글'}], null),
      on:   renderBlocks([{t:'text',h:1,v:'<b onclick="window.__hacked=1">굵게</b>'}], null),
      list: renderBlocks([{t:'list',ord:0,items:['<script>x<\/script>하나']}], null),
      hacked: !!window.__hacked
    };
  });
  T('모르는 꼬리표는 알맹이만 남는다', safe.scr[0] && safe.scr[0].v==='앞가운데뒤', safe.scr);
  T('저장된 <script> 는 화면에 안 나간다',
    safe.show.indexOf('<script')<0 && safe.show.indexOf('<b>굵게</b>')>=0, safe.show);
  T('저장된 <img onerror> 도 걸러진다', safe.img.indexOf('<img')<0, safe.img);
  T('꼬리표에 붙은 onclick 이 떨어진다', safe.on.indexOf('onclick')<0, safe.on);
  T('목록 안 나쁜 글자도 걸러진다', safe.list.indexOf('<script')<0, safe.list);
  T('그리는 사이에 아무것도 실행되지 않았다', safe.hacked===false);
  T('목록이 화면에 목록으로 나온다',
    await pg.evaluate(()=>renderBlocks([{t:'list',ord:1,items:['가','나']}],null).indexOf('<ol')>=0));

  // ── 5. 연재
  const sr = await pg.evaluate(()=>{
    const src = String(writeSeries);
    return { rich: /key:'body',\s*type:'rich'/.test(src),
             multi: /key:'body',\s*type:'multi'/.test(src),
             store: src.indexOf('storePhotos')>=0,
             plain: src.indexOf('body: plain')>=0 };
  });
  T('연재 본문이 편집기다', sr.rich && !sr.multi, sr);
  T('연재 사진이 창고로 간다', sr.store, sr);
  T('연재는 옛 판을 위해 글자도 남긴다', sr.plain, sr);

  const sb = await pg.evaluate(()=>({
    old: seriesBody({ body:'옛 글입니다' }),
    neu: seriesBody({ body:'글자', blocks:[{t:'head',v:'ㄱ'},{t:'text',v:'ㄴ'}] }),
    non: seriesBody(null)
  }));
  T('옛 연재 글이 그대로 보인다',
    sb.old.length===1 && sb.old[0].t==='text' && sb.old[0].v==='옛 글입니다', sb.old);
  T('새 연재 글은 블록으로 읽는다', sb.neu.length===2 && sb.neu[0].t==='head', sb.neu);
  T('빈 것도 터지지 않는다', Array.isArray(sb.non) && sb.non.length===0);

  T('앱이 터지지 않았다', errs.length===0, errs.slice(0,2));
  console.log('합계: '+ok+'개 통과 / '+bad+'개 실패');
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
