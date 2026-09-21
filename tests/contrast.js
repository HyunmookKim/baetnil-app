// 글씨가 바탕에 묻히는 곳을 찾는다.
//
// 어떻게
//  1) 화면을 그대로 한 장 찍는다
//  2) 글씨만 투명하게 만들고 한 장 더 찍는다  → 그 자리의 '바탕색' 을 알 수 있다
//  3) 글씨색과 바탕색의 밝기 차(WCAG 명암비)를 잰다
//  바탕이 그림(새벽 바다)이라 자리마다 색이 다르므로, 이렇게 실제로 찍어서 재야 한다.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const sharp = require('sharp');
const server=http.createServer((rq,rs)=>{const f=path.join(__dirname, rq.url==='/'?'work.html':rq.url.split('?')[0]);
 fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;} if(f.endsWith('.woff2'))rs.setHeader('Content-Type','font/woff2'); rs.writeHead(200);rs.end(d);});});

const D = JSON.parse(fs.readFileSync('real.json','utf8'));
D.items = (D.items||[]).map(x=>Object.assign({},x,{photos:[]}));

const load = (D) => {
  try{ skipWelcome(); }catch(_){}
  window.__user={uid:'U1',email:'a@b.c',name:'김선장'}; me=window.__user;
  const b=Object.assign({id:'B1'}, D.boat||{}); boats=[b]; seedRanks(b);
  b.members={U1:ownerRank(b).id}; currentBoatId=b.id; window.currentBoatId=b.id;
  unlocked=true; dgLocked=false; lkLocked=false;
  lockers=D.lockers||[]; items=D.items||[]; shapes=D.shapes||[];
  maint=D.maint||[]; repair=D.repair||[]; voyage=D.voyage||[];
  trash=[{id:9,name:'버린 물품',qty:'1',unit:'개',locker:'창고',zone:'선수',photos:[]}];
  const g={}; (D.dgimgs||[]).forEach(x=>{ g[x.id]=(x.ref==='seed')?dgSeedUrl(x.id,'first45'):(x.url||x.img); });
  dgImgs=g; dgSmall={plan:null,side:null};
  save&&save(); saveLocal&&saveLocal(); try{applyBoatName();}catch(_){}
  try{setSync('동기화됨');}catch(_){}
};

// 글씨가 든 칸을 모은다
// ★ 처음 판은 글씨 마디를 만나면 walk 를 통째로 빠져나가서 한 곳도 못 모았다.
//   (빈칸도 글씨 마디다 — body 의 첫 줄바꿈에서 바로 끝났다)
const collect = () => {
  const out = [];
  const walk = el => {
    let own = '';
    el.childNodes.forEach(n=>{
      if(n.nodeType === 3) own += n.textContent;
      else if(n.nodeType === 1) walk(n);
    });
    own = own.trim();
    if(!own) return;
    if(el.offsetWidth === 0 || el.offsetHeight === 0) return;
    const r = el.getBoundingClientRect();
    if(r.width < 2 || r.height < 2) return;
    if(r.bottom < 4 || r.top > innerHeight - 4) return;
    const cs = getComputedStyle(el);
    if(cs.visibility === 'hidden' || +cs.opacity < .15) return;
    out.push({ t: own.slice(0,26),
               x: Math.round(r.left + Math.min(r.width/2, 40)),
               y: Math.round(r.top + r.height/2),
               col: cs.color, size: parseFloat(cs.fontSize), weight: cs.fontWeight,
               sel: el.tagName.toLowerCase() +
                    (el.className && typeof el.className === 'string'
                      ? '.' + el.className.trim().split(/\s+/).slice(0,3).join('.') : '') });
  };
  walk(document.body);
  return out;
};

const lum = (r,g,b) => { const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};
  return .2126*f(r)+.7152*f(g)+.0722*f(b); };
const ratio = (a,b) => { const l1=Math.max(a,b), l2=Math.min(a,b); return (l1+.05)/(l2+.05); };
const parseCol = c => { const m=c.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? {r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:+m[4]} : null; };

const SCREENS = [
  ['적재표',        ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat(); }],
  ['물품 목록화면', ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat(); view='map'; toggleView(); }],
  ['정기점검',      ()=>{ switchTab('boat'); setBoatSubTab('maint'); }],
  ['수리',          ()=>{ switchTab('boat'); setBoatSubTab('repair'); }],
  ['연료',          ()=>{ switchTab('boat'); setBoatSubTab('fuel'); }],
  ['문서',          ()=>{ switchTab('boat'); setBoatSubTab('docs'); }],
  ['오늘',          ()=>{ switchTab('home'); setHomeSub('today'); }],
  ['출항 전 점검',  ()=>{ switchTab('home'); setHomeSub('check'); }],
  ['항해일지',      ()=>{ switchTab('voyage'); }],
  ['커뮤니티',      ()=>{ switchTab('community'); }],
  ['내 배',         ()=>{ openBoat('info'); }],
  ['제원',          ()=>{ openBoat('spec'); }],
  ['물품 목록',     ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat(); openLocker(lockers[0].id); }],
  ['휴지통',        ()=>{ switchTab('boat'); setBoatSubTab('stow'); closeBoat(); openTrash(); }],
  ['서랍',          ()=>{ openDrawer(); }],
];

(async()=>{
  await new Promise(r=>server.listen(8765,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const bad = [];
  for(const [name, go] of SCREENS){
    const p=await b.newPage({ locale:'ko-KR',viewport:{width:360,height:780},deviceScaleFactor:2});
    await p.goto('http://localhost:8765/work.html'); await p.waitForTimeout(2300);
    await p.evaluate(load, D); await p.waitForTimeout(600);
    try{ await p.evaluate(go); }catch(e){}
    await p.waitForTimeout(1100);
    const items = await p.evaluate(collect);
    // 글씨만 지운 판을 찍는다 → 그 자리의 바탕색
    await p.addStyleTag({content:'*{color:transparent!important;text-shadow:none!important}'});
    await p.waitForTimeout(350);
    const buf = await p.screenshot();
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({resolveWithObject:true});
    const px = (x,y)=>{ const X=Math.min(info.width-1,Math.max(0,Math.round(x*2)));
      const Y=Math.min(info.height-1,Math.max(0,Math.round(y*2)));
      const i=(Y*info.width+X)*info.channels; return [data[i],data[i+1],data[i+2]]; };
    console.log('  ' + name + ' — 글씨 ' + items.length + '곳');
    items.forEach(it=>{
      const c = parseCol(it.col); if(!c || c.a < .1) return;
      const [br,bg,bb] = px(it.x, it.y);
      // 반투명 글씨는 바탕과 섞인 색으로 본다
      const fr = c.r*c.a + br*(1-c.a), fg = c.g*c.a + bg*(1-c.a), fb = c.b*c.a + bb*(1-c.a);
      const R = ratio(lum(fr,fg,fb), lum(br,bg,bb));
      const big = it.size >= 18.66 || (it.size >= 14 && +it.weight >= 700);
      const need = big ? 3.0 : 4.5;
      if(R < need) bad.push({ 화면:name, 글:it.t, 명암비:+R.toFixed(2), 필요:need,
                              크기:it.size, 색:it.col, 자리:it.sel.slice(0,58) });
    });
    await p.close();
  }
  bad.sort((a,b)=>a.명암비-b.명암비);
  const seen = new Set(), uniq = [];
  bad.forEach(x=>{ const k=x.화면+'|'+x.자리+'|'+x.색; if(seen.has(k)) return; seen.add(k); uniq.push(x); });
  console.log('묻히는 글씨 ' + uniq.length + '곳 (같은 자리는 한 번만)\n');
  uniq.slice(0,45).forEach(x=>console.log(
    '  ' + String(x.명암비).padStart(5) + ' (필요 ' + x.필요 + ')  ' +
    x.화면.padEnd(12) + ' "' + x.글 + '"  ' + x.색 + '  ' + x.자리));
  fs.writeFileSync('contrast.json', JSON.stringify(uniq, null, 1));
  await b.close(); server.close();
})();
