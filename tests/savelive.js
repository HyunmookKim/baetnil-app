// 파일 내보내기 — 앱인 척하고 진짜로 나가는지 본다
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const srv = http.createServer((req,res)=>{
  let f = req.url.split('?')[0];
  const 뿌리 = (f === '/' || f === '/index.html');
  if(뿌리) f = '/' + SRC;
  // ★ 절대경로로 건네받은 앱 파일은 cwd 를 앞에 붙이면 안 된다.
  const p = (뿌리 && path.isAbsolute(SRC)) ? SRC : path.join(process.cwd(), f.replace(/^\//,''));
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const e = path.extname(p);
  res.writeHead(200,{'content-type': e==='.html'?'text/html; charset=utf-8':e==='.js'?'text/javascript':'application/octet-stream'});
  res.end(fs.readFileSync(p));
});
const FAKE = `
window.__fslog = { write: [], uri: 0, share: [] };
window.__shareFail = '';
window.__writeFail = '';
window.__hasShare = true;
window.Capacitor = { isNativePlatform: () => true, Plugins: {
  Filesystem: {
    async writeFile(o){ window.__fslog.write.push(o);
      if(window.__writeFail) throw new Error(window.__writeFail);
      return { uri: 'file:///cache/' + o.path }; },
    async getUri(o){ window.__fslog.uri++; return { uri: 'file:///cache/' + o.path }; }
  },
  Share: {
    async share(o){ if(window.__shareFail) throw new Error(window.__shareFail);
      window.__fslog.share.push(o); return {}; }
  }
} };`;
(async ()=>{
  await new Promise(r => srv.listen(0, r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await b.newContext({ locale:'ko-KR', viewport:{width:411,height:900} });
  await ctx.addInitScript(FAKE);
  const page = await ctx.newPage();
  let pass=0, fail=0;
  const t=(n,ok,w)=>{ok?pass++:(fail++,console.log('★ 실패:',n,(w!==undefined?' — '+JSON.stringify(w).slice(0,220):'')));};
  const errs=[]; page.on('pageerror', e=>errs.push(String(e.message).slice(0,140)));
  const alerts=[]; page.on('dialog', d=>{ alerts.push(d.message()); d.accept(); });
  // ★ 4.37 부터 앱은 브라우저 창이 아니라 자기 창으로 말한다(tell).
  //   page.on('dialog') 로는 안 잡히므로, 앱의 tell 을 감싸 밖으로 넘긴다.
  await page.exposeFunction('__toldTest', m => { alerts.push(String(m)); });
  await page.addInitScript(()=>{
    const iv = setInterval(()=>{
      if(typeof window.tell === 'function' && !window.tell.__wrapped){
        const orig = window.tell;
        const w = function(m, o){ try{ window.__toldTest(String(m)); }catch(e){} return orig(m, o); };
        w.__wrapped = true; window.tell = w; clearInterval(iv);
      }
    }, 20);
  });


  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.evaluate(()=>{ try{ skipWelcome(); }catch(_){} });

  // ── 백업을 진짜로 눌러 본다
  const r = await page.evaluate(async ()=>{
    window.__fslog = { write: [], uri: 0, share: [] };
    await backupData();
    return window.__fslog;
  });
  // ★ 4.128 — 백업은 「어디에 둘까」를 안 묻는다. 폰 안 Baetnil 칸에 말없이 넣는다.
  //   사장님 말씀: 「백업 파일은 저장해 놓고 어디다 가져가서 쓰지는 거의 않잖아」
  t('앱에서 파일을 실제로 썼다', r.write.length === 1, r.write.map(x=>x.path));
  t('★ 폰 안 Baetnil 칸에 넣는다', r.write[0] && r.write[0].directory === 'DOCUMENTS',
    r.write[0] && r.write[0].directory);
  t('★ 칸 안에 폴더를 만들며 넣는다', r.write[0] && r.write[0].recursive === true, r.write[0]);
  t('이름이 ASCII 다',
    r.write[0] && /^Baetnil\/backup\/baetnil-backup-\d{8}\.json$/.test(r.write[0].path),
    r.write[0] && r.write[0].path);
  t('★ 어디에 넣을지 묻지 않는다 (공유 창을 안 띄운다)', r.share.length === 0, r.share);
  await page.waitForTimeout(200);
  t('★ 어디에 넣었는지 말해 준다',
    alerts.some(a=>/^문서\/Baetnil\/backup\/baetnil-backup-\d{8}\.json에 넣었습니다\.$/.test(a)), alerts);
  t('★ 조사가 붙여 쓰여 있다 (「… 에」 가 아니다)', !alerts.some(a=>/ 에 넣었습니다/.test(a)), alerts);

  // ── 첫 자리가 막히면 다음 자리로 내려간다 (안드로이드 판마다 쓸 수 있는 자리가 다르다)
  const 내려감 = await page.evaluate(async ()=>{
    window.__fslog = { write: [], uri: 0, share: [] };
    const F = window.Capacitor.Plugins.Filesystem;
    const 옛 = F.writeFile;
    F.writeFile = async o => { window.__fslog.write.push(o);
      if(o.directory === 'DOCUMENTS') throw new Error('막힘');
      return { uri:'x' }; };
    const r2 = await saveHere('backup','a.json','application/json','{}');
    F.writeFile = 옛;
    return { dirs: window.__fslog.write.map(x=>x.directory), r2 };
  });
  t('★ 한 자리가 막히면 다음 자리에 넣는다',
    내려감.dirs[0] === 'DOCUMENTS' && 내려감.dirs[1] === 'EXTERNAL_STORAGE'
    && 내려감.r2.why === '' && /Baetnil\/backup/.test(내려감.r2.where), 내려감);

  // ── 내용이 진짜 백업인가 (base64 를 도로 풀어 본다)
  const ok = await page.evaluate(async ()=>{
    window.__fslog = { write: [], uri: 0, share: [] };
    boats = [{ id:'B1', name:'테스트호' }]; currentBoatId = 'B1';
    maint = [{ id:'m1', name:'엔진 오일' }];
    await backupData();
    const b64 = window.__fslog.write[0].data;
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    const txt = new TextDecoder('utf-8').decode(bytes);
    const j = JSON.parse(txt);
    return { app: j.app, maint: (j.maint||[]).length, name: (j.maint||[])[0] && j.maint[0].name };
  });
  t('내용이 진짜 백업이다', ok.app === 'baetnil' && ok.maint === 1, ok);
  t('★ 한글이 안 깨진다', ok.name === '엔진 오일', ok.name);

  // ── 건네줄 것(saveFile)은 여전히 「어디에 넣을까」 를 묻는다
  const 건넴 = await page.evaluate(async ()=>{
    window.__fslog = { write: [], uri: 0, share: [] };
    const why = await saveFile('건네줄것.json','application/json','{"a":1}');
    return { why, write: window.__fslog.write.map(x=>({p:x.path,d:x.directory})),
             share: window.__fslog.share };
  });
  t('★ 건네줄 파일은 잠깐 두는 자리에 쓴다',
    건넴.write.length === 1 && 건넴.write[0].d === 'CACHE', 건넴.write);
  t('★ 건네줄 파일은 어디에 넣을지 묻는다', 건넴.share.length === 1, 건넴.share);
  t('그 파일을 넘겼다',
    건넴.share[0] && 건넴.share[0].files && /건네줄것\.json/.test(건넴.share[0].files[0]), 건넴.share[0]);
  t('건네주고 나면 잘못이 없다', 건넴.why === '', 건넴.why);

  // ── 사람이 그만두면 잘못이라고 하지 않는다
  const cancel = await page.evaluate(async ()=>{
    window.__shareFail = 'Share canceled';
    const why = await saveFile('a.json','application/json','{}');
    window.__shareFail = '';
    return why;
  });
  t('사람이 그만두면 잘못이라고 안 한다', cancel === '', cancel);

  // ── 진짜 잘못이면 까닭을 말한다
  const bad = await page.evaluate(async ()=>{
    window.__shareFail = 'no activity found';
    const why = await saveFile('a.json','application/json','{}');
    window.__shareFail = '';
    return why;
  });
  t('진짜 잘못이면 까닭을 돌려준다', /no activity/.test(bad), bad);

  // ★ 5.0 — 백업이 안 되는 것은 「공유가 안 됨」 이 아니라 「어느 자리에도 못 씀」 이다.
  alerts.length = 0;
  await page.evaluate(async ()=>{
    window.__writeFail = 'no place to write';
    await backupData();
    window.__writeFail = '';
  });
  await page.waitForTimeout(200);
  t('안 되면 사람에게 말한다', alerts.some(a=>/파일로 저장하지 못했습니다/.test(a)), alerts);
  t('★ 왜 안 되는지 까닭도 같이 말한다', alerts.some(a=>/no place to write/.test(a)), alerts);
  t('★ 네 자리를 다 해 보고 나서 말한다',
    await page.evaluate(async ()=>{
      window.__fslog = { write: [], uri: 0, share: [] };
      window.__writeFail = 'x';
      const r3 = await saveHere('backup','a.json','application/json','{}');
      window.__writeFail = '';
      return window.__fslog.write.length === 4 && r3.why !== '' && r3.where === '';
    }));

  // ── 공유 부품이 아예 없으면 문서 자리에라도 넣는다
  const nos = await page.evaluate(async ()=>{
    delete window.Capacitor.Plugins.Share;
    window.__fslog = { write: [], uri: 0, share: [] };
    const why = await saveFile('a.json','application/json','{}');
    return { why, dirs: window.__fslog.write.map(x=>x.directory) };
  });
  t('공유 부품이 없어도 어딘가엔 넣는다', nos.why === '' && nos.dirs.indexOf('DOCUMENTS') >= 0, nos);

  // ── 웹에서는 예전대로 (앱이 아닌 척)
  const web = await page.evaluate(async ()=>{
    window.Capacitor.isNativePlatform = () => false;
    let clicked = null;
    const orig = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function(){ clicked = this.download; };
    const why = await saveFile('web.json','application/json','{}');
    HTMLAnchorElement.prototype.click = orig;
    return { why, clicked };
  });
  t('웹에서는 예전 방식 그대로', web.why === '' && web.clicked === 'web.json', web);

  t('앱이 터지지 않았다 — ' + (errs[0]||''), errs.length === 0);
  console.log(`\n${pass}/${pass+fail} 통과`);
  await b.close(); srv.close();
  process.exit(fail ? 1 : 0);
})().catch(e=>{ console.log('★ 검사가 돌지 못했다:', e.message); srv.close(); process.exit(1); });
