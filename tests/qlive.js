// 글 편집기 (Quill) — 진짜 브라우저에서, 진짜 한글 입력까지
//
// ★ 왜 이 검사가 있나
//   편집기를 통째로 갈아 끼웠다. 화면이 멀쩡해 보여도 저장하는 모양(덩이)이
//   한 칸이라도 달라지면, 이미 올려 둔 글이 열릴 때 서식이 날아가거나
//   사진이 자리를 잃는다. 그것은 쓴 사람의 글을 우리가 망가뜨리는 일이다.
//   그래서 [옛 글을 열어 → 그대로 저장] 했을 때 똑같이 나오는지를 먼저 본다.
//   한글은 조합(IME)으로 들어간다. 손으로 만든 이벤트는 실제와 다르므로
//   브라우저의 진짜 입력 통로(CDP)로 넣는다.
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

const PIX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ viewport:{width:390,height:820}, isMobile:true, hasTouch:true, locale:'ko-KR' });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  const alerts=[]; pg.on('dialog', d=>{ alerts.push(d.message()); d.dismiss().catch(()=>{}); });
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(900);
  await pg.evaluate(()=>{ try{ skipWelcome(); }catch(_){} window.__user={uid:'U1',name:'나'}; });

  T('Quill 이 앱 안에 들어 있다', await pg.evaluate(()=>typeof Quill === 'function'));

  // 편집기 하나를 띄우는 짧은 길 — 실제 글쓰기 폼과 같은 openForm 을 쓴다
  const openEd = (blocks) => pg.evaluate(b=>{
    window.__saved = null;
    openForm({ title:'검사', okText:'저장',
      fields:[{ key:'body', type:'rich', label:'내용', value:b, placeholder:'여기에 쓰세요' }],
      onOk: v => { window.__saved = v.body; } });
  }, blocks);
  const save = async () => {
    await pg.click('#formFoot .fbtn.go');
    await pg.waitForTimeout(200);
    return await pg.evaluate(()=>window.__saved);
  };

  // ── 1. 옛 글이 그대로 열리고 그대로 저장되는가 (제일 중요한 것)
  const OLD = [
    { t:'text', h:1, v:'첫 문단<b>굵게</b>입니다.' },
    { t:'photo', v:PIX },
    { t:'head', h:1, v:'소제목입니다' },
    { t:'list', ord:0, items:['하나','<i>둘</i>'] },
    { t:'list', ord:1, items:['첫째','둘째'] },
    { t:'text', h:1, v:'끝 <u>줄</u>과 <s>지운 줄</s>' }
  ];
  await openEd(OLD);
  await pg.waitForTimeout(400);
  T('편집기가 세워졌다', await pg.evaluate(()=>!!QL['ff0'] && !!document.querySelector('#ff0 .ql-editor')));
  const shown = await pg.evaluate(()=>{
    const e = document.querySelector('#ff0 .ql-editor');
    return { html:e.innerHTML, imgs:e.querySelectorAll('img').length,
             h4:e.querySelectorAll('h4').length,
             bul:e.querySelectorAll('li[data-list=bullet]').length,
             ord:e.querySelectorAll('li[data-list=ordered]').length };
  });
  T('사진이 화면에 보인다', shown.imgs === 1, shown);
  T('소제목이 소제목으로 보인다', shown.h4 === 1, shown);
  T('글머리표 두 줄', shown.bul === 2, shown);
  T('번호 두 줄', shown.ord === 2, shown);
  T('굵게·기울임·밑줄·취소선이 살아 있다',
    /<strong>|<b>/.test(shown.html) && /<em>|<i>/.test(shown.html)
    && /<u>/.test(shown.html) && /<s>/.test(shown.html), shown.html.slice(0,220));

  const back = await save();
  T('저장한 덩이 수가 같다', back.length === OLD.length, back.map(b=>b.t));
  T('덩이 종류가 그대로다',
    back.map(b=>b.t).join(',') === OLD.map(b=>b.t).join(','), back.map(b=>b.t));
  T('사진 주소가 안 바뀐다', back[1].v === PIX, back[1] && back[1].v && back[1].v.slice(0,30));
  T('소제목 글자가 그대로다', back[2].v === '소제목입니다', back[2]);
  T('글머리표 항목이 그대로다',
    back[3].ord === 0 && back[3].items.join('|') === '하나|<i>둘</i>', back[3]);
  T('번호 목록이 번호로 남는다',
    back[4].ord === 1 && back[4].items.join('|') === '첫째|둘째', back[4]);
  T('첫 문단 서식이 그대로다', back[0].v === '첫 문단<b>굵게</b>입니다.', back[0]);
  T('밑줄·취소선이 그대로다', back[5].v === '끝 <u>줄</u>과 <s>지운 줄</s>', back[5]);

  // ── 2. 옛 판으로 쓴 글 (**별표** 로 굵게 하던 시절)
  await openEd([{ t:'text', v:'예전 **굵게** 글' }]);
  await pg.waitForTimeout(350);
  const oldHtml = await pg.evaluate(()=>document.querySelector('#ff0 .ql-editor').innerHTML);
  T('옛 별표 글이 굵게로 열린다', /<strong>굵게<\/strong>|<b>굵게<\/b>/.test(oldHtml), oldHtml.slice(0,150));
  const oldBack = await save();
  T('옛 글이 새 모양으로 저장된다',
    oldBack.length === 1 && oldBack[0].h === 1 && /<b>굵게<\/b>/.test(oldBack[0].v), oldBack);

  // ── 3. 진짜 한글 입력 (조합)
  await openEd([]);
  await pg.waitForTimeout(350);
  await pg.click('#ff0 .ql-editor');
  const cdp = await ctx.newCDPSession(pg);
  const ime = async (steps, done) => {
    for(const x of steps){
      await cdp.send('Input.imeSetComposition', { text:x, selectionStart:x.length, selectionEnd:x.length });
      await pg.waitForTimeout(35);
    }
    await cdp.send('Input.insertText', { text: done });
    await pg.waitForTimeout(50);
  };
  await ime(['ㅇ','아','안'], '안');
  await ime(['ㄴ','녀','녕'], '녕');
  await ime(['ㅎ','하'], '하');
  await ime(['ㅅ','세'], '세');
  await ime(['ㅇ','요'], '요');
  await pg.waitForTimeout(200);
  T('한글 조합이 안 깨진다',
    (await pg.evaluate(()=>QL['ff0'].getText().replace(/\n+$/,''))) === '안녕하세요',
    await pg.evaluate(()=>QL['ff0'].getText()));

  // 조합 끝난 글자 뒤 백스페이스 — 한 글자만 지워져야 한다
  await cdp.send('Input.dispatchKeyEvent', { type:'rawKeyDown', windowsVirtualKeyCode:8, code:'Backspace', key:'Backspace' });
  await cdp.send('Input.dispatchKeyEvent', { type:'keyUp', windowsVirtualKeyCode:8, code:'Backspace', key:'Backspace' });
  await pg.waitForTimeout(200);
  T('백스페이스가 한 글자만 지운다',
    (await pg.evaluate(()=>QL['ff0'].getText().replace(/\n+$/,''))) === '안녕하세',
    await pg.evaluate(()=>QL['ff0'].getText()));

  const koBack = await save();
  T('한글이 그대로 저장된다',
    koBack.length === 1 && koBack[0].v === '안녕하세', koBack);

  // ── 4. 도구줄 — 손으로 누른다
  await openEd([]);
  await pg.waitForTimeout(350);
  await pg.click('#ff0 .ql-editor');
  await pg.keyboard.type('bold');
  await pg.evaluate(()=>QL['ff0'].setSelection(0,4));
  await pg.click('#formBody .rtool button[title="굵게"]');
  await pg.waitForTimeout(150);
  T('도구줄 굵게가 걸린다',
    /<strong>bold<\/strong>/.test(await pg.evaluate(()=>document.querySelector('#ff0 .ql-editor').innerHTML)),
    await pg.evaluate(()=>document.querySelector('#ff0 .ql-editor').innerHTML));
  await pg.click('#formBody .rtool button[title="굵게"]');
  await pg.waitForTimeout(150);
  T('한 번 더 누르면 되돌아온다',
    !/<strong>/.test(await pg.evaluate(()=>document.querySelector('#ff0 .ql-editor').innerHTML)));

  await pg.click('#formBody .rtool button[title="소제목"]');
  await pg.waitForTimeout(150);
  T('소제목 단추가 줄 전체를 바꾼다',
    (await pg.evaluate(()=>document.querySelectorAll('#ff0 .ql-editor h4').length)) === 1);
  await pg.click('#formBody .rtool button[title="소제목"]');
  await pg.click('#formBody .rtool button[title="글머리표"]');
  await pg.waitForTimeout(150);
  T('글머리표 단추가 먹는다',
    (await pg.evaluate(()=>document.querySelectorAll('#ff0 .ql-editor li[data-list=bullet]').length)) === 1);
  await pg.click('#formBody .rtool button[title="번호"]');
  await pg.waitForTimeout(150);
  T('번호 단추가 먹는다',
    (await pg.evaluate(()=>document.querySelectorAll('#ff0 .ql-editor li[data-list=ordered]').length)) === 1);

  // ── 5. 사진 — 넣고, 눌러서 고르고, 지운다
  await openEd([{ t:'text', h:1, v:'위' }, { t:'photo', v:PIX }, { t:'text', h:1, v:'아래' }]);
  await pg.waitForTimeout(400);
  T('처음엔 [사진 지우기] 가 안 보인다',
    (await pg.evaluate(()=>document.getElementById('ff0_del').style.display)) === 'none');
  await pg.click('#ff0 .ql-editor img');
  await pg.waitForTimeout(250);
  T('사진을 누르면 [사진 지우기] 가 나온다',
    (await pg.evaluate(()=>document.getElementById('ff0_del').style.display)) !== 'none');
  T('고른 사진에 테두리가 생긴다',
    (await pg.evaluate(()=>document.querySelectorAll('#ff0 .ql-editor img.sel').length)) === 1);
  await pg.click('#ff0_del');
  await pg.waitForTimeout(250);
  T('사진이 지워진다',
    (await pg.evaluate(()=>document.querySelectorAll('#ff0 .ql-editor img').length)) === 0);
  const noPhoto = await save();
  T('사진을 뺀 뒤에도 글은 남는다',
    noPhoto.filter(b=>b.t==='photo').length === 0 && noPhoto.length === 1
    && noPhoto[0].v.indexOf('위') >= 0 && noPhoto[0].v.indexOf('아래') >= 0, noPhoto);

  // 백스페이스로도 지워져야 한다 (사진은 글자 하나다)
  await openEd([{ t:'photo', v:PIX }]);
  await pg.waitForTimeout(400);
  await pg.evaluate(()=>{ QL['ff0'].setSelection(1,0); QL['ff0'].focus(); });
  await pg.keyboard.press('Backspace');
  await pg.waitForTimeout(200);
  T('백스페이스로 사진이 지워진다',
    (await pg.evaluate(()=>document.querySelectorAll('#ff0 .ql-editor img').length)) === 0);

  // 고르지 않고 [사진 지우기] 를 누르면 알려 준다
  await openEd([{ t:'text', h:1, v:'글만' }]);
  await pg.waitForTimeout(350);
  // ★ 앱은 브라우저 기본창을 안 쓴다 — 자기 창(tell/ask)으로 말한다. 그것도 받아 적는다.
  await pg.evaluate(()=>{ window.__said = [];
    const t0 = window.tell, a0 = window.ask;
    window.tell = m => { window.__said.push(String(m)); return Promise.resolve(); };
    window.ask  = m => { window.__said.push(String(m)); return Promise.resolve(true); }; });
  await pg.evaluate(()=>{ const b=document.getElementById('ff0_del'); b.style.display=''; b.click(); });
  await pg.waitForTimeout(200);
  alerts.push(...(await pg.evaluate(()=>{ const a = window.__said || []; window.__said = []; return a; })));
  T('고르지 않고 누르면 알려 준다', alerts.some(a=>/지울 사진/.test(a)), alerts.slice(-2));

  // ── 6. 기록 넣기 (richInsert 를 밖에서 부른다)
  await openEd([{ t:'text', h:1, v:'앞' }]);
  await pg.waitForTimeout(350);
  await pg.evaluate(p=>{
    QL['ff0'].setSelection(QL['ff0'].getLength()-1, 0);
    richInsert('ff0', [{ t:'text', v:'넣은 글' }, { t:'photo', v:p }]);
  }, PIX);
  await pg.waitForTimeout(250);
  const ins = await save();
  T('밖에서 넣은 글과 사진이 들어간다',
    ins.some(b=>b.t==='photo') && JSON.stringify(ins).indexOf('넣은 글') >= 0, ins.map(b=>b.t));

  // ── 7. 남의 글 붙여넣기 — 색·글꼴 같은 것은 안 따라와야 한다
  await openEd([]);
  await pg.waitForTimeout(350);
  await pg.evaluate(()=>{
    const q = QL['ff0'];
    q.clipboard.dangerouslyPasteHTML(0,
      '<p style="color:red;font-size:40px"><b>굵게</b> <span style="background:yellow">노랑</span></p>'
      + '<table><tr><td>표</td></tr></table>');
  });
  await pg.waitForTimeout(250);
  const pasted = await pg.evaluate(()=>document.querySelector('#ff0 .ql-editor').innerHTML);
  T('붙여넣어도 색·크기가 안 따라온다',
    pasted.indexOf('color') < 0 && pasted.indexOf('font-size') < 0 && pasted.indexOf('background') < 0,
    pasted.slice(0,200));
  T('붙여넣어도 표는 안 들어온다', pasted.indexOf('<table') < 0, pasted.slice(0,200));
  T('붙여넣은 굵게는 살아 있다', /<strong>굵게<\/strong>/.test(pasted), pasted.slice(0,200));

  // ── 8. 빈 편집기 — 안내 글자가 보이고, 저장하면 빈 덩이다
  await openEd([]);
  await pg.waitForTimeout(350);
  T('빈 칸에 안내 글자가 뜬다',
    (await pg.evaluate(()=>{
      const e = document.querySelector('#ff0 .ql-editor');
      return e.classList.contains('ql-blank') && e.getAttribute('data-placeholder');
    })) === '여기에 쓰세요');
  T('빈 채로 저장하면 덩이가 없다', (await save()).length === 0);

  T('페이지 오류 없음', errs.length === 0, errs.slice(0,3));
  console.log('\n통과 ' + ok + ' / 실패 ' + bad);
  await br.close(); server.close();
  process.exit(bad ? 1 : 0);
})();
