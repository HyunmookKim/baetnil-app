// 사진 보기 — 확대·이동·화질
//
// ★ 왜 브라우저여야 하나 (사장님 지적)
//   ① 「사진이 뭉개져서 분간이 안 된다」 — 창고로 가는데도 인라인 시절의 180KB 를
//      그대로 쓰고 있었다. 이건 숫자를 재야 안다.
//   ② 「눌러 봐도 확대가 안 된다」 — 두 손가락·휠·두 번 톡은 진짜로 해 봐야 안다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] || 'work.html';
// ★ 뿌리(/) 요청이 절대경로 파일이면 cwd 를 붙이지 말고 그대로 연다.
//   전에는 process.cwd() 를 무조건 앞에 붙여 절대경로를 못 받고
//   ERR_HTTP_RESPONSE_CODE_FAILURE 로 검사가 아예 돌지 못했다.
const __MAIN = path.isAbsolute(SRC) ? SRC : path.join(process.cwd(), SRC);
const __BASE = path.dirname(__MAIN);
const __pick = u => {
  const f = u.split('?')[0];
  if(f === '/' || f === '/index.html') return __MAIN;
  const rel = f.replace(/^\//,'');
  for(const d of [__BASE, __dirname, process.cwd()]){ const c = path.join(d, rel); if(fs.existsSync(c)) return c; }
  return path.join(__BASE, rel);
};
const srv = http.createServer((q,r)=>{
  const p = __pick(q.url);
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  r.writeHead(200,{'content-type':'text/html; charset=utf-8'}); r.end(fs.readFileSync(p));
});
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?pass++:(fail++,console.log('★ 실패:',n, x===undefined?'':JSON.stringify(x).slice(0,200))); };
(async()=>{
  await new Promise(r=>srv.listen(0,r)); const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({ locale:'ko-KR',viewport:{width:430,height:930}, hasTouch:true, isMobile:true})).newPage();
  p.on('pageerror', e=>{ fail++; console.log('★ 실패: 터짐 —', e.message); });
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`); await p.waitForTimeout(2000);

  // ── ① 화질 — 진짜 사진을 넣어 줄여 본다
  const 화질 = await p.evaluate(async ()=>{
    // 자잘한 무늬가 있는 사진을 만든다 (밋밋하면 압축이 잘 돼서 차이가 안 난다)
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1800;
    const g = c.getContext('2d');
    for(let y=0;y<1800;y+=6) for(let x=0;x<2400;x+=6){
      g.fillStyle = 'hsl(' + ((x*y)%360) + ',60%,' + (30+((x+y)%50)) + '%)';
      g.fillRect(x,y,6,6);
    }
    const blob = await (await fetch(c.toDataURL('image/jpeg',0.95))).blob();
    const f = new File([blob],'x.jpg',{type:'image/jpeg'});
    const big = await new Promise(r=>resizePhoto(f, r));
    const small = await smallInline(big);
    const px = u => new Promise(r=>{ const im=new Image(); im.onload=()=>r(im.naturalWidth); im.src=u; });
    // ★ 창고에는 base64 를 푼 것이 올라간다 (uploadString ..., 'data_url').
    //   창고 규칙이 1MB 를 막으므로 그 크기로 재야 한다.
    const 올라갈바이트 = u => { const i = String(u).indexOf(','); 
      return i < 0 ? String(u).length : Math.floor((String(u).length - i - 1) * 3 / 4); };
    return { 창고KB: Math.round(big.length/1024), 창고폭: await px(big),
             창고올라갈KB: Math.round(올라갈바이트(big)/1024),
             문서KB: Math.round(small.length/1024), 문서폭: await px(small),
             한도: { px: PHOTO_MAX_PX, kb: PHOTO_MAX_KB, qmin: PHOTO_Q_MIN,
                     hard: PHOTO_HARD_KB, storeMin: PHOTO_STORE_MIN } };
  });
  console.log('   ' + JSON.stringify(화질));
  T('★ 창고로 갈 사진이 1600픽셀이다', 화질.창고폭 === 1600, 화질);
  T('★ 창고로 갈 사진이 옛 180KB 보다 훨씬 크다', 화질.창고KB > 300, 화질);
  T('품질 하한이 0.6 이다 (0.35 로 안 내려간다)', 화질.한도.qmin >= 0.6, 화질.한도);
  T('문서에 남을 사진은 여전히 작다 (1MB 문서에 들어가야 한다)',
    화질.문서KB <= 200 && 화질.문서폭 <= 1280, 화질);
  // ★★ 창고 규칙(storage_rules.txt)이 1MB 를 막는다. 넘으면 올리기가 통째로 거부된다.
  //   앱과 규칙이 어긋나면 아무도 안 알려 주고 사진만 조용히 안 올라간다.
  T('★★ 창고에 올라갈 크기가 규칙의 1MB 한도 안이다',
    화질.창고올라갈KB < 1024, 화질);

  // ── ①-2 ★ 한도 지킴이가 진짜로 도는가
  //   위 사진은 한도(1MB)에 한참 못 미쳐서 지킴이가 돌 일이 없다.
  //   그래서 한도를 일부러 낮춰 걸고 「폭을 줄여서라도 지키는가」 를 본다.
  const 지킴이 = await p.evaluate(async ()=>{
    const c = document.createElement('canvas'); c.width = 2400; c.height = 1800;
    const g = c.getContext('2d');
    for(let y=0;y<1800;y+=2) for(let x=0;x<2400;x+=2){
      g.fillStyle = 'hsl(' + ((x*7+y*13)%360) + ',70%,' + (20+((x*3+y*5)%60)) + '%)';
      g.fillRect(x,y,2,2);
    }
    const blob = await (await fetch(c.toDataURL('image/jpeg',0.95))).blob();
    const f = new File([blob],'x.jpg',{type:'image/jpeg'});
    const 지킴 = await new Promise(r=>resizePhoto(f, r, { hardkb: 120, minpx: 400 }));
    const 안지킴 = await new Promise(r=>resizePhoto(f, r, { hardkb: 999999 }));
    const px = u => new Promise(r=>{ const im=new Image(); im.onload=()=>r(im.naturalWidth); im.src=u; });
    return { 지킴KB: Math.round(지킴.length/1024), 지킴폭: await px(지킴),
             안지킴KB: Math.round(안지킴.length/1024), 안지킴폭: await px(안지킴) };
  });
  console.log('   ' + JSON.stringify(지킴이));
  T('★★ 한도를 넘으면 폭을 줄여서라도 지킨다', 지킴이.지킴KB <= 120, 지킴이);
  T('★ 그때 폭이 실제로 줄었다', 지킴이.지킴폭 < 1600 && 지킴이.지킴폭 >= 400, 지킴이);
  T('★ 한도를 안 걸면 안 줄인다 (쓸데없이 깎지 않는다)',
    지킴이.안지킴폭 === 1600 && 지킴이.안지킴KB > 지킴이.지킴KB, 지킴이);

  // ── ② 확대
  const 열기 = await p.evaluate(()=>{
    const c = document.createElement('canvas'); c.width=1200; c.height=900;
    const g=c.getContext('2d'); g.fillStyle='#38a'; g.fillRect(0,0,1200,900);
    const u = c.toDataURL('image/jpeg',0.9);
    pvOpen([u], 0);
    const v = document.getElementById('photoView');
    return { 열림: getComputedStyle(v).display !== 'none', 배수: pvZ.s };
  });
  T('사진 보기가 열린다', 열기.열림 === true, 열기);
  T('열면 원래 크기다', 열기.배수 === 1, 열기);

  const 휠 = await p.evaluate(async ()=>{
    const im = document.getElementById('photoViewImg');
    const r = im.getBoundingClientRect();
    im.dispatchEvent(new WheelEvent('wheel', { deltaY:-120, clientX:r.left+r.width/2,
      clientY:r.top+r.height/2, bubbles:true, cancelable:true }));
    await new Promise(x=>setTimeout(x,250));
    return { 배수: pvZ.s, 모양: im.style.transform };
  });
  T('★ 휠을 굴리면 커진다', 휠.배수 > 1.1, 휠);
  T('실제로 화면에 확대가 걸린다', /scale\(/.test(휠.모양 || ''), 휠);

  const 두손가락 = await p.evaluate(async ()=>{
    pvReset();
    const im = document.getElementById('photoViewImg');
    const mk = (type, pts) => {
      const ev = new Event(type, { bubbles:true, cancelable:true });
      ev.touches = pts.map(q=>({ clientX:q[0], clientY:q[1] }));
      im.dispatchEvent(ev);
    };
    mk('touchstart', [[180,400],[240,400]]);       // 60 벌림
    mk('touchmove',  [[120,400],[300,400]]);       // 180 벌림 → 3배
    const s = pvZ.s;
    mk('touchend', []);
    return { 배수: Math.round(s*100)/100 };
  });
  T('★ 두 손가락으로 벌리면 커진다', 두손가락.배수 > 2, 두손가락);

  const 끌기 = await p.evaluate(async ()=>{
    const im = document.getElementById('photoViewImg');
    const 전 = { x:pvZ.x, y:pvZ.y };
    im.dispatchEvent(new PointerEvent('pointerdown', { clientX:200, clientY:400, bubbles:true }));
    im.dispatchEvent(new PointerEvent('pointermove', { clientX:260, clientY:430, bubbles:true }));
    im.dispatchEvent(new PointerEvent('pointerup',   { clientX:260, clientY:430, bubbles:true }));
    return { 전, 후:{ x:pvZ.x, y:pvZ.y } };
  });
  T('★ 확대한 뒤 끌면 움직인다', 끌기.전.x !== 끌기.후.x || 끌기.전.y !== 끌기.후.y, 끌기);

  // ★ 끌다 손을 떼면 닫히면 안 된다 (배경 누르기와 겹치는 자리)
  const 안닫힘 = await p.evaluate(()=>{
    const v = document.getElementById('photoView');
    v.dispatchEvent(new MouseEvent('click', { bubbles:true }));
    return getComputedStyle(v).display !== 'none';
  });
  T('★ 끌고 나서 손을 떼도 안 닫힌다', 안닫힘 === true);

  const 닫힘 = await p.evaluate(()=>{
    pvMoved = 0;
    const v = document.getElementById('photoView');
    v.dispatchEvent(new MouseEvent('click', { bubbles:true }));
    return { 닫힘: getComputedStyle(v).display === 'none', 배수: pvZ.s };
  });
  T('배경을 누르면 닫힌다', 닫힘.닫힘 === true, 닫힘);
  T('닫으면 배수가 처음으로 돌아온다', 닫힘.배수 === 1, 닫힘);

  // 사진을 넘기면 배수가 처음으로
  const 넘김 = await p.evaluate(async ()=>{
    const mk = k => { const c=document.createElement('canvas'); c.width=800;c.height=600;
      const g=c.getContext('2d'); g.fillStyle=k; g.fillRect(0,0,800,600); return c.toDataURL('image/jpeg',0.8); };
    pvOpen([mk('#a33'), mk('#3a3')], 0);
    pvZoomAt(3, 100, 100);
    const 전 = pvZ.s;
    pvNav(1);
    return { 전: Math.round(전*10)/10, 후: pvZ.s, 몇번째: pvIdx };
  });
  T('★ 다음 사진으로 넘기면 배수가 처음으로', 넘김.전 > 1 && 넘김.후 === 1, 넘김);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  if(fail) process.exit(1);
})();
