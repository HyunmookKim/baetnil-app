// 4.18 눈으로 보기 — 연재 묶음 목록 · 글 아래 다른 편 · 글쓰기 창
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const server = http.createServer((rq,rs)=>{
  const f = path.join(__dirname, rq.url === '/' ? 'work.html' : rq.url.split('?')[0]);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;}
    if(f.endsWith('.woff2')) rs.setHeader('Content-Type','font/woff2');
    rs.writeHead(200); rs.end(d); });
});
(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await (await br.newContext({ locale:'ko-KR', viewport:{width:390,height:840}, isMobile:true, hasTouch:true })).newPage();
  pg.on('dialog', d=>d.accept());
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'networkidle' });
  await pg.waitForTimeout(1000);
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user = { uid:'U1', email:'a@b.c', name:'김명준' };
    adminMe = { uid:'U1', owner:true, perms:{ series:true } };
    const mk = (id,sname,no,title,ts,author,source) => ({ id, sname, no, title,
      mine:!source, author, source:source||'', link: source?'https://x.y/'+id:'',
      body:'본문입니다. 여기에 글이 이어집니다.', blocks:[], photos:[], thumbs:[],
      by:'U1', date:ts, ts });
    const DB = [
      mk('a1','요트인을 위한 인공지능',1,'요트인에게 인공지능이 왜 필요한가','2026-08-15T00:00:00Z','Вадим Михайлов','yacht Russia'),
      mk('a2','요트인을 위한 인공지능',2,'NoR(대회요강) 분석 완료. 우리가 놓친 것은 없을까?','2026-08-24T00:00:00Z','Вадим Михайлов','yacht Russia'),
      mk('b1','여수 앞바다 한 바퀴',1,'첫 출항','2026-08-20T00:00:00Z','김명준',''),
      mk('b2','여수 앞바다 한 바퀴',2,'거문도까지','2026-08-21T00:00:00Z','김명준',''),
      mk('b3','여수 앞바다 한 바퀴',3,'돌아오는 길','2026-08-22T00:00:00Z','김명준',''),
      Object.assign(mk('z1','',0,'옛날에 올린 글','2026-07-01T00:00:00Z','김명준',''), { sname: undefined })
    ];
    window.__series = { list: async()=>DB.map(x=>Object.assign({},x)),
                        put: async()=>{}, del: async()=>{} };
    seriesList = null;
    switchTab('community'); setComSub('news'); newsSub='sr'; renderNews();
  });
  await pg.waitForTimeout(1200);
  await pg.screenshot({ path:'s418_list.png' });

  await pg.evaluate(()=>openSeries('b2'));
  await pg.waitForTimeout(700);
  await pg.evaluate(()=>{ const p=document.getElementById('mrPanel'); p.scrollTop = p.scrollHeight; });
  await pg.waitForTimeout(400);
  await pg.screenshot({ path:'s418_also.png' });

  await pg.evaluate(()=>{ closeBoat(); writeSeries(); });
  await pg.waitForTimeout(800);
  await pg.screenshot({ path:'s418_form.png' });

  console.log('찍었다: s418_list.png s418_also.png s418_form.png');
  await br.close(); server.close();
})();
