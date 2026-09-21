// 여수에 있어도 일본 정박지와 나라 띠가 나오는가 (4.80)
//
// ★ 사장님이 사진으로 잡아 주신 것 — 여수에 계신데 정박지에 한국 것만 나오고
//   한국/일본 나라 띠도 없었다. 「일본에 있거나 일본어를 쓸 때만 자료를 받는다」 는
//   문을 내가 걸어 놨기 때문이다.
//
//   ★ 함수 검사로는 못 잡는다. spotPackSync 는 멀쩡히 돌고 있었고, 다만
//     받아 올 꾸러미가 0개였을 뿐이다. 그래서 실물 화면에서 눈으로 보이는지를 잰다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] || '../../work.html';
const JP = JSON.stringify({ from:'테스트', rows:[
  { i:'jp_香川_0', n:'高松港ビジターバース', k:'marina', la:34.3512, lo:134.0466, r:'香川', f:'water', t:'설명' },
  { i:'jp_広島_1', n:'広島観音マリーナ', k:'marina', la:34.3700, lo:132.4200, r:'広島', f:'water', t:'설명' }
]});
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0];
  if(/spots-jp\.json$/.test(f)){ r.writeHead(200,{'content-type':'application/json'}); r.end(JP); return; }
  const p = (f === '/' && path.isAbsolute(SRC)) ? SRC
          : path.join(__dirname, (f === '/' ? SRC : f).replace(/^\//,''));
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  r.writeHead(200,{'content-type': path.extname(p)==='.js'?'text/javascript':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({viewport:{width:430,height:930}, locale:'ko-KR'})).newPage();
  await p.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });
  // 여수에 배를 둔다 — 일본이 아니고 말도 한국어다
  await p.evaluate(()=>{
    try{ boats=[{ id:'b1', name:'테스트호', lat:34.7404, lon:127.7357 }]; currentBoatId='b1';
         window.currentBoatId='b1'; }catch(_){}
    switchTab('community'); if(typeof setComSub==='function') setComSub('spots');
  });
  await p.waitForTimeout(2500);
  const r = await p.evaluate(()=>{
    const W = document.getElementById('spotWrap');
    const txt = (W && W.innerText) || '';
    let 받은수 = 0;
    try{ 받은수 = (spotPackRows.jp || []).length; }catch(_){}
    return { 말: (typeof langNow==='function') ? langNow() : '?',
             받은수,
             일본이름보임: /高松港|広島観音/.test(txt),
             // ★ 4.132 말 전수점검 — 나라 이름이 「한국」 에서 「대한민국」 으로 바뀌었다
             나라띠: /일본/.test(txt) && /대한민국/.test(txt),
             옛말남음: /(^|[^민])한국([^\uac00-\ud7a3]|$)/.test(txt),
             글: txt.replace(/\s+/g,' ').slice(0, 160) };
  });

  let pass=0, fail=0;
  const T=(n,ok,x)=>{ ok?(pass++,console.log('통과: '+n)):(fail++,console.log('★ 실패: '+n+(x===undefined?'':' — '+JSON.stringify(x).slice(0,240)))); };
  T('한국어로 켜져 있다 (일본어라서 받은 것이 아니다)', r.말 === 'ko', r.말);
  T('★★★ 여수에 있어도 일본 자료를 받는다', r.받은수 === 2, r);
  T('★★★ 그 이름이 화면에 실제로 보인다', r.일본이름보임, r.글);
  T('★★★ 대한민국/일본 나라 띠가 뜬다 (나라가 둘이 되었으므로)', r.나라띠, r.글);
  T('★★ 옛말 「한국」 이 안 남아 있다 (4.132)', r.옛말남음 === false, r.글);
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
