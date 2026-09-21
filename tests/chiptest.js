// 새로 만든 단추 갈래가 기존 규칙에서 빠지지 않았는가
//
// ★ 왜 (2026-08-29, 사장님이 사진 셋으로 잡아 주신 것)
//   D테마 바탕은 새벽 바다 그림이고 위에서 16.8% 자리에 수평선의 밝은 띠가 있다.
//   그 위에 반투명한 것을 얹으면 바탕과 같은 밝기가 되어 글씨가 사라진다.
//   이미 겪고 고쳐 놓은 규칙이 있다 —
//     .tab,.mrbtn,.minib,.chip,#lockBtn { background:rgba(9,24,39,.62); ... }
//   그런데 4.63 에서 하위-하위 줄(.tfilt/.tchip)을 새로 만들면서 이 줄에 안 넣었다.
//   그래서 장비 탭(.tab)만 읽히고 정비·문서의 하위-하위(.tchip)는 안 보였다.
//
// ★ 이 검사가 지키는 것은 딱 하나다 — 「새 단추 갈래를 만들면 그 줄에 같이 넣는다」.
//   색이 예쁜지 대비가 몇인지는 재지 않는다. 색은 사장님이 하나하나 맞춰 놓으신 것이라
//   내가 WCAG 숫자를 들이대서 뒤집을 자리가 아니다.
const { chromium } = require('playwright');
const fs=require('fs'), http=require('http'), path=require('path');
const SRC = process.argv[2] && /\.html$/.test(process.argv[2]) ? process.argv[2] : 'work.html';
// 인자가 절대경로면 그대로 쓴다 (앞에 cwd 를 덧붙이면 /home/claude/hv/tests/home/claude/... 가 되어 못 읽는다)
const SRCPATH = path.isAbsolute(SRC) ? SRC : path.join(process.cwd(), SRC);
const SRCURL  = path.basename(SRCPATH);
const src = fs.readFileSync(SRCPATH, 'utf8');
const srv = http.createServer((q,r)=>{
  let f=q.url.split('?')[0]; if(f==='/') f='/'+SRCURL;
  const rel=f.replace(/^\/+/,'');
  // 앱 본체는 절대경로에서, 곁딸린 것(글씨체 등)은 검사 폴더에서 집는다
  const p = (rel===SRCURL) ? SRCPATH : path.join(__dirname, rel);
  if(!fs.existsSync(p)){ r.writeHead(404); r.end(''); return; }
  const e=path.extname(p);
  r.writeHead(200,{'content-type': e==='.js'?'text/javascript':e==='.woff2'?'font/woff2':'text/html; charset=utf-8'});
  r.end(fs.readFileSync(p));
});
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?(pass++,console.log('통과: '+n)):(fail++,console.log('★ 실패: '+n+(x===undefined?'':' — '+JSON.stringify(x).slice(0,240)))); };

// ── ① 규칙 줄에 다 들어 있나 (글로만 봐도 잡힌다)
{
  const m = src.match(/\n([^\n]*#lockBtn)\{\s*\n?\s*background:rgba\(9,24,39,\.62\)/);
  const 줄 = m ? m[1] : '';
  T('★ 「짙게 채운다」 규칙 줄을 찾았다', !!줄, 줄);
  ['.tab','.mrbtn','.minib','.chip','.tchip','#lockBtn'].forEach(k=>
    T('★★ 그 줄에 ' + k + ' 가 들어 있다', 줄.split(',').map(x=>x.trim()).includes(k), 줄));
  const on = (src.match(/\n([^\n]*\.minib\.blu[^\n]*)\{\s*\n?\s*background:rgba\(22,58,86,\.82\)/)||[])[1] || '';
  T('★★ 고른 것 규칙 줄에도 .tchip.on 이 들어 있다',
    on.split(',').map(x=>x.trim()).includes('.tchip.on'), on);
}

// ── ② 진짜로 그려서, .tchip 이 .tab 과 똑같이 보이는가
(async()=>{
  await new Promise(r=>srv.listen(0,r));
  const port=srv.address().port;
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await(await b.newContext({viewport:{width:430,height:930}, locale:'ko-KR'})).newPage();
  p.on('pageerror', e=>{ fail++; console.log('★ 실패: 터짐 —', e.message); });
  await p.route('**://tile.openstreetmap.org/**', r=>r.abort());
  await p.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
  await p.goto(`http://127.0.0.1:${port}/`);
  await p.waitForTimeout(2200);
  await p.evaluate(()=>{ window.ask=()=>Promise.resolve(true); window.tell=()=>Promise.resolve(true);
    try{ skipWelcome(); }catch(_){}
    const o=document.getElementById('welcomeOv'); if(o) o.classList.remove('open'); });
  // 배가 없으면 정비·문서 화면이 「배 등록」 안내로 덮여서 하위-하위가 안 그려진다
  const DATA = [__dirname + '/sample-backup.json']
    .find(f => { try{ fs.accessSync(f); return true; }catch(e){ return false; } });
  if(DATA){
    await p.evaluate(async (body)=>{
      const f=new File([body],'m.json',{type:'application/json'});
      restoreData({ target:{ files:[f], value:'' } });
      for(let i=0;i<80;i++){ await new Promise(r=>setTimeout(r,150)); if(items.length>100) break; }
      const j=JSON.parse(body);
      if(j.boat){ boats=[j.boat]; currentBoatId=j.boat.id; window.currentBoatId=currentBoatId;
        applyBoatName(); saveLocal(); if(typeof sysSave==='function') sysSave(); }
      if(typeof saveMR==='function') saveMR();
      await new Promise(r2=>setTimeout(r2,1200));
    }, fs.readFileSync(DATA,'utf8'));
  }

  const 재기 = () => p.evaluate(()=>{
    const one = (sel, on) => {
      const el = [...document.querySelectorAll(sel)]
        .find(x=>{ const s=getComputedStyle(x);
          return s.display!=='none' && x.getBoundingClientRect().height>4
              && x.classList.contains('on') === !!on; });
      if(!el) return null;
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, ring: (s.boxShadow||'').includes('inset') };
    };
    return { tabOff: one('.tab', false), tabOn: one('.tab', true),
             chipOff: one('.tchip', false), chipOn: one('.tchip', true) };
  });

  // 장비 탭 = .tab 이 있는 자리, 정비 탭 = .tchip 이 있는 자리
  await p.evaluate(()=>{ switchTab('boat'); if(typeof setBoatSubTab==='function') setBoatSubTab('maint'); });
  await p.waitForTimeout(800);
  const r1 = await 재기();
  T('★★ 안 고른 하위-하위(.tchip)가 짙은 채움을 갖는다',
    !!r1.chipOff && /rgba\(9, 24, 39, 0\.62\)/.test(r1.chipOff.bg), r1.chipOff);
  T('★★ 고른 하위-하위(.tchip.on)가 고른 탭과 같은 채움을 갖는다',
    !!r1.chipOn && /rgba\(22, 58, 86, 0\.82\)/.test(r1.chipOn.bg), r1.chipOn);
  T('★ 가는 흰 선(inset)도 같이 붙는다', !!r1.chipOff && r1.chipOff.ring, r1.chipOff);

  // 문서 탭의 하위-하위도 같은 것을 쓴다
  await p.evaluate(()=>{ switchTab('boat'); if(typeof setBoatSubTab==='function') setBoatSubTab('docs'); });
  await p.waitForTimeout(800);
  const r2 = await 재기();
  T('★★ 문서 › 연락처 쪽 하위-하위도 짙은 채움을 갖는다',
    !!r2.chipOff && /rgba\(9, 24, 39, 0\.62\)/.test(r2.chipOff.bg), r2.chipOff);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})();
