// 5.18 — 운영자는 공개하지 않은 배도 「있다는 것」 은 본다. 기록은 못 본다 (사장님 2026-09-27)
//   「안전을 위해서 운영자가 배 어느 정도는 볼 수 있어야 되는 거 아니냐 — 범죄에 활용될 수 있잖아」
//   다른 앱(카카오톡·디스코드·노션)과 법(개인정보 보호법 제18조) 을 보고 정한 선:
//     · 늘 보이는 것: 배 이름·선종·선주·인원·만든 날 (boatIndex)
//     · 게시판 글: 구성원이 신고하면 **그 글만** 신고에 담겨 온다
//     · 그 밖의 기록: 앱에서는 운영자도 못 연다
//   사용: node adminprivlive.js ../www/index.html
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const FILE=path.resolve(process.argv[2]||'../www/index.html'), ROOT=path.dirname(FILE), MAIN=path.basename(FILE);
const SRC=fs.readFileSync(FILE,'utf8');
const srv=http.createServer((q,r)=>{const u=q.url.split('?')[0];fs.readFile(path.join(ROOT,u==='/'?MAIN:u),(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':/\.js$/.test(u)?'text/javascript':'text/html'});r.end(d);});});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,400):''));} };
// 소스 — 배 목록 한 줄에 기록이 안 들어가는가
{
  const i=SRC.indexOf('function boatIndexBody('); const seg=SRC.slice(i, SRC.indexOf('\n}', i));
  T('운영자 목록 한 줄이 있다', i>0);
  ['lat','lon','phone','roster','spec','intro','items','posts'].forEach(k=>
    T('운영자 목록 한 줄에 「'+k+'」 이 안 들어간다', !new RegExp('\\b'+k+'\\s*:').test(seg) && !new RegExp('b\\.'+k+'\\b').test(seg)));
  const m=SRC.indexOf('window.__boatIndex = {'); const ms=SRC.slice(m, SRC.indexOf('\n    };', m));
  T('배를 저장하면 그 줄도 맞춘다', /__boatIndex\.put\(boat\)/.test(SRC.slice(SRC.indexOf('window.__saveBoat = async'), m)));
  T('배를 지우면 그 줄도 지운다 (배보다 먼저)', /__boatIndex\.del\(id\)[\s\S]{0,200}deleteDoc\(doc\(fdb, 'boats', id\)\)/.test(SRC));
  T('운영자 목록은 boatIndex 만 읽는다 (boats 를 통째로 읽지 않는다)', /collection\(fdb, 'boatIndex'\)/.test(ms) && !/collection\(fdb, 'boats'\)/.test(ms));
}
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const ctx=await br.newContext({locale:'ko-KR',viewport:{width:412,height:924},isMobile:true,hasTouch:true});
  await ctx.route(/googleapis|gstatic|firebaseio|open-meteo|firestore/,r=>r.abort());
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); localStorage.setItem('bt_agree', JSON.stringify({v:'x'})); }catch(_){} });
  const pg=await ctx.newPage(); const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+srv.address().port+'/');
  await pg.waitForFunction(()=>typeof adminBoats==='function'); await pg.waitForTimeout(800);
  // 배 게시판 글 신고 — 그 글만 담긴다
  const rp=await pg.evaluate(async()=>{
    try{ skipWelcome(); }catch(_){}
    window.__user={uid:'U1',name:'현묵'}; try{ me=window.__user; }catch(_){}
    boats=[{id:'B1',name:'SUNSHINE',type:'sail'}]; const b=boats[0]; seedRanks(b);
    b.members={U1:ownerRank(b).id,U2:ownerRank(b).id}; b.memberNames={U1:'현묵',U2:'김재운'};
    currentBoatId='B1'; window.currentBoatId='B1';
    posts=[{id:'p1',title:'밀수 이야기',body:'본문',by:'U2',byName:'김재운',ts:'2026-09-27',comments:[]},
           {id:'p2',title:'다른 글',body:'이건 안 가야 한다',by:'U2',byName:'김재운',ts:'2026-09-27',comments:[]}];
    let sent=null; window.__report={ send: async(x)=>{ sent=x; return x.id; } };
    openPost('p1'); await new Promise(r=>setTimeout(r,300));
    const acts=(typeof ACT_LIST!=='undefined'?ACT_LIST:[]).map(a=>a.name);
    reportBoatPost('p1'); await new Promise(r=>setTimeout(r,300));
    // 사유를 고르고 보낸다
    const ok=[...document.querySelectorAll('button')].find(x=>x.getClientRects().length && /^보내기$/.test(x.textContent.trim()));
    if(ok) ok.click();
    await new Promise(r=>setTimeout(r,500));
    return {acts, sent};
  });
  T('남이 쓴 배 게시판 글 머리줄에 「신고」 가 있다', rp.acts.includes('신고'), rp.acts);
  T('신고가 보내진다', !!rp.sent, rp);
  T('신고에 그 글이 담긴다', rp.sent && rp.sent.snap && rp.sent.snap.title==='밀수 이야기' && rp.sent.postId==='p1', rp.sent);
  T('다른 글은 안 담긴다', rp.sent && !JSON.stringify(rp.sent).includes('이건 안 가야 한다'), rp.sent);
  T('신고 종류는 배 게시판 글', rp.sent && rp.sent.kind==='boatPost', rp.sent);
  const mine=await pg.evaluate(async()=>{ posts[0].by='U1'; openPost('p1'); await new Promise(r=>setTimeout(r,200)); return ACT_LIST.map(a=>a.name); });
  T('내가 쓴 글에는 「신고」 가 없다', !mine.includes('신고'), mine);
  // 운영자 배 화면
  const ad=await pg.evaluate(async()=>{
    window.__pub={ list: async(h)=> h ? [] : [{id:'PB',name:'공개배',typeName:'세일링 요트',owner:'U5'}] };
    window.__boatIndex={ list: async()=>[{id:'PB',name:'공개배',type:'sail',owner:'U5',ownerName:'가',memberN:1,createdAt:'2026-09-01'},
      {id:'X1',name:'자동검사배2',type:'motor',owner:'Uabcdef123456',ownerName:'검사',memberN:2,createdAt:'2026-09-20'}] };
    const h=await adminBoats(); const d=document.createElement('div'); d.innerHTML=h; return d.textContent;
  });
  T('운영자 배 화면에 비공개 배가 나온다', /비공개 배 1척/.test(ad) && /자동검사배2/.test(ad), ad.slice(0,300));
  T('공개된 배는 비공개 목록에 두 번 안 나온다', (ad.match(/공개배/g)||[]).length===1, ad.slice(0,300));
  T('비공개 배 줄에 선주·인원·만든 날이 있다', /검사 ·123456/.test(ad) && /2명/.test(ad) && /2026-09-20/.test(ad), ad);
  const ad2=await pg.evaluate(async()=>{ window.__boatIndex={ list: async()=>{ throw new Error('permission-denied'); } };
    const h=await adminBoats(); const d=document.createElement('div'); d.innerHTML=h; return d.textContent; });
  T('규칙이 아직 안 열렸어도 화면이 죽지 않는다', /불러오지 못했습니다/.test(ad2) && /공개배/.test(ad2), ad2.slice(0,200));
  // 신고 관리
  const rb=await pg.evaluate(async()=>{
    window.__talk={ list: async()=>({rows:[],done:true}) };
    let done=null;
    window.__report={ list: async()=>[{id:'r1',kind:'boatPost',boatName:'SUNSHINE',reason:'illegal',by:'U1',byName:'현묵',ts:'2026-09-27',status:'new',
      snap:{title:'밀수 이야기',body:'본문',by:'U2',byName:'김재운'}},{id:'r2',kind:'boat',target:'PB',reason:'spam',status:'done',ts:'2026-09-01'}],
      done: async(id,on)=>{ done=[id,on]; } };
    const h=await adminReportBox(); const d=document.createElement('div'); d.innerHTML=h;
    return {txt:d.textContent};
  });
  T('신고 관리에 미처리 건수가 나온다', /신고 관리 · 미처리 1건/.test(rb.txt), rb.txt.slice(0,200));
  T('배 게시판 글 신고는 그 글이 보인다', /밀수 이야기/.test(rb.txt) && /불법·범죄/.test(rb.txt), rb.txt);
  T('처리 완료 / 처리 취소 단추가 있다', /처리 완료/.test(rb.txt) && /처리 취소/.test(rb.txt), rb.txt);
  T('오류 없음', errs.length===0, errs.slice(0,3));
  console.log('\n통과 '+ok+' · 실패 '+bad);
  await br.close(); srv.close(); process.exit(bad?1:0);
})();
