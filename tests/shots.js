const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname,rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}
  const ct=f.endsWith('.js')?'text/javascript':f.endsWith('.webmanifest')?'application/manifest+json'
   :f.endsWith('.woff2')?'font/woff2':f.endsWith('.png')?'image/png':'text/html';
  rs.writeHead(200,{'Content-Type':ct}); rs.end(d);});});
(async()=>{
 await new Promise(r=>server.listen(0,r));
 const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 // 1080x1920 = 플레이 권장. 540x960 논리픽셀 x2
 const ctx=await br.newContext({viewport:{width:540,height:960},isMobile:true,hasTouch:true,
   deviceScaleFactor:2,locale:'ko-KR'});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});
 await pg.waitForTimeout(1200);

 await pg.evaluate(()=>{
  try{ skipWelcome(); }catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김현묵'}; me=window.__user;
  boats=[{id:'B1',name:'SHUNSHINE',type:'sail',port:'여수 웅천마리나',
          maker:'Beneteau',model:'First 45',year:2007,loa:13.7,beam:4.4,draft:2.3,
          engine:'Yanmar 4JH4E'}];
  seedRanks(boats[0]); boats[0].members={U1:ownerRank(boats[0]).id};
  currentBoatId='B1'; window.currentBoatId='B1'; unlocked=true; dgLocked=false; lkLocked=false;
  dgImgs={plan:DG_BUILTIN.sail.plan, side:DG_BUILTIN.sail.side};
  lockers=[];
  const L=(x,y,w,h,z,n)=>lkAdd({x,y,w,h},z,n);
  const a=L(30,18,16,7,'선수','앞 침실 아래'),  b=L(52,30,14,7,'갤리','싱크대 아래'),
        c=L(30,44,15,7,'살롱','좌현 소파 밑'), d=L(52,52,15,7,'살롱','우현 소파 밑'),
        e=L(34,66,16,7,'선미','선미 창고'),    f=L(54,74,14,7,'기관실','엔진룸 선반');
  items=[
   {id:1,lockerId:a.id,locker:a.label,zone:a.zone,name:'구명조끼',qty:'6',unit:'벌',note:'성인용',photos:[]},
   {id:2,lockerId:a.id,locker:a.label,zone:a.zone,name:'구명부환',qty:'2',unit:'개',note:'',photos:[]},
   {id:3,lockerId:b.id,locker:b.label,zone:b.zone,name:'식수',qty:'12',unit:'L',note:'2L x 6',photos:[]},
   {id:4,lockerId:b.id,locker:b.label,zone:b.zone,name:'버너 가스',qty:'4',unit:'통',photos:[]},
   {id:5,lockerId:c.id,locker:c.label,zone:c.zone,name:'구급함',qty:'1',unit:'개',note:'2026-11 만료',photos:[]},
   {id:6,lockerId:c.id,locker:c.label,zone:c.zone,name:'조명탄',qty:'4',unit:'발',note:'2027-03 만료',photos:[]},
   {id:7,lockerId:d.id,locker:d.label,zone:d.zone,name:'예비 시트',qty:'2',unit:'줄',photos:[]},
   {id:8,lockerId:e.id,locker:e.label,zone:e.zone,name:'예비 앵커',qty:'1',unit:'개',note:'단포스 16kg',photos:[]},
   {id:9,lockerId:e.id,locker:e.label,zone:e.zone,name:'계류 로프',qty:'6',unit:'줄',note:'16mm 10m',photos:[]},
   {id:10,lockerId:f.id,locker:f.label,zone:f.zone,name:'엔진 오일',qty:'5',unit:'L',note:'15W-40',photos:[]},
   {id:11,lockerId:f.id,locker:f.label,zone:f.zone,name:'임펠러',qty:'2',unit:'개',note:'예비',photos:[]},
   {id:12,lockerId:f.id,locker:f.label,zone:f.zone,name:'연료 필터',qty:'3',unit:'개',photos:[]}];
  maint=[
   {id:'m1',grp:'기관',name:'엔진 오일 교환',months:6,unit:'m',lastDate:'2026-02-14',history:[],photos:[]},
   {id:'m2',grp:'기관',name:'임펠러 점검',months:12,unit:'m',lastDate:'2025-09-02',history:[],photos:[]},
   {id:'m3',grp:'기관',name:'연료 필터 교환',months:12,unit:'m',lastDate:'2026-03-20',history:[],photos:[]},
   {id:'m4',grp:'선체',name:'선저 청소',months:4,unit:'m',lastDate:'2026-05-30',history:[],photos:[]},
   {id:'m5',grp:'선체',name:'아연 교체',months:12,unit:'m',lastDate:'2025-11-11',history:[],photos:[]},
   {id:'m6',grp:'의장',name:'리깅 점검',months:24,unit:'m',lastDate:'2025-04-08',history:[],photos:[]},
   {id:'m7',grp:'안전',name:'소화기 점검',months:12,unit:'m',lastDate:'2026-01-05',history:[],photos:[]},
   {id:'m8',grp:'안전',name:'구명뗏목 검사',months:36,unit:'m',lastDate:'2024-06-19',history:[],photos:[]}];
  const V=(id,date,title,from,to,nm,h,eh,note)=>({id,date,title,pub:true,from,to,nm,hours:h,
    engineH:eh,crew:'',timeOut:'06:20',timeIn:'15:40',logs:[],weather:'북동 8kt · 파고 0.5m',
    note,photos:[],wxOut:null,wxIn:null,posOut:null,posIn:null});
  voyage=[
   V('v1','2026-08-09','거문도 1박','여수 웅천','거문도','38.4','7.5','6.0','물때 맞춰 05시 출항. 돌아올 때 남서 12kt.'),
   V('v2','2026-07-26','금오도 한 바퀴','여수 웅천','여수 웅천','21.2','4.2','2.1','오후에 바람 죽어서 기관 운전.'),
   V('v3','2026-07-12','나로도','여수 웅천','나로도','26.8','5.0','3.4',''),
   V('v4','2026-06-28','시험 항해','여수 웅천','여수 웅천','9.6','2.1','1.8','세일 트림 확인.')];
  save&&save(); saveMR&&saveMR(); applyBoatName();
  // 화면 사진용 — 정박지는 클라우드 손잡이가 있어야 그려진다. 관 자료만 보이게 흉내 낸다.
  window.__spots = { list: async()=>[], add: async()=>{}, edit: async()=>{}, del: async()=>{} };
  window.__user = me;
 });
 await pg.waitForTimeout(600);

 const shot = async (name, setup, wait)=>{
   await pg.evaluate(setup);
   await pg.waitForTimeout(wait||800);
   await pg.screenshot({path:'ss_'+name+'.png'});
   const t=(await pg.locator('body').innerText()).replace(/\n+/g,' / ').slice(0,110);
   console.log(name.padEnd(12), t);
 };

 await shot('01_stow_map', ()=>{ switchTab('boat'); setBoatSubTab('stow'); toggleView(true); });
 await shot('02_stow_list',()=>{ switchTab('boat'); setBoatSubTab('stow'); toggleView(false); });
 await shot('03_maint',    ()=>{ switchTab('boat'); setBoatSubTab('maint'); });
 await shot('04_voyage',   ()=>{ switchTab('voyage'); });
 await shot('05_check',    ()=>{ switchTab('home'); setHomeSub('check'); });
 await shot('06_spot',     ()=>{ switchTab('community'); setComSub('spot'); }, 1500);
 await shot('07_fuel',     ()=>{ switchTab('boat'); setBoatSubTab('fuel'); });
 await shot('08_docs',     ()=>{ switchTab('boat'); setBoatSubTab('docs'); });
 await shot('09_repair',   ()=>{ switchTab('boat'); setBoatSubTab('repair'); });

 console.log('터짐:', errs.length ? errs.slice(0,2) : '없음');
 await br.close(); server.close();
})();
