// 5.32 — 사진을 화면에 띄울 때마다 다시 받던 것 (사장님: 「사용자가 나 혼자였는데 135원 나온거면 … 뭐지?」, 2026-10-02)
//
// ★ 원인: 사진 창고 2,729장 중 1,900장(4.82 이전)에 보관 설정(Cache-Control)이 없었다 → 「저장하지 마라」.
//   앱 안에서는 서비스워커를 끄므로, 화면에 뜰 때마다 웹뷰가 인터넷에서 다시 받았다.
// ★ 고침
//   ① 창고 쪽 — 2,729장 전부에 public, max-age=31536000, immutable (2026-10-02, 클라우드 셸에서 확인: 2729 전부)
//   ② 안드로이드 — 웹뷰의 자체 저장 공간이 작아(크로미엄: 디스크 20MB) BaetnilWebViewClient 가 폰 디스크에 챙겨 두고 그것부터 준다
//   ③ 아이폰 — 웹뷰(WKWebView)는 https 요청을 앱이 가로챌 수 없다. 대신 웹킷 디스크 저장은 여유 공간에 따라 최대 1GB 이고
//      보관 설정을 따른다 → ① 로 같은 사진을 다시 안 받는다.
//
// 이 검사: (가) 보관 설정이 있으면 같은 사진을 여러 번 띄워도 서버에 한 번만 가는지 브라우저로 직접 잰다
//          (보관 설정이 없을 때와 견준다 — 고치기 전 상태 재현)
//          (나) 안드로이드 가로채기가 사진 창고 사진만 잡고 앱 파일은 캐퍼시터에 그대로 넘기는지
//          (다) 새로 올리는 사진에도 보관 설정이 붙는지
const fs = require('fs');
const http = require('http');
const path = require('path');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '../www/index.html'), 'utf8');
const ROOT = path.join(__dirname, '..');

// (다) 새로 올리는 사진
T('새 사진은 1년 보관 설정으로 올린다', /cacheControl: 'public, max-age=31536000, immutable'/.test(src));

// (나) 안드로이드
{
  const A = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/kr/baetnil/app/BaetnilWebViewClient.java'), 'utf8');
  const M = fs.readFileSync(path.join(ROOT, 'android/app/src/main/java/kr/baetnil/app/MainActivity.java'), 'utf8');
  T('안드로이드: 캐퍼시터 웹뷰 처리기를 이어받는다', /extends BridgeWebViewClient/.test(A));
  T('안드로이드: 앱이 켜질 때 그것으로 바꾼다', /setWebViewClient\(new BaetnilWebViewClient\(getBridge\(\)\)\)/.test(M));
  T('안드로이드: 바꾸는 자리가 super.onCreate 뒤다 (웹뷰가 있어야 한다)',
    M.indexOf('super.onCreate(savedInstanceState);') < M.indexOf('new BaetnilWebViewClient('));
  T('안드로이드: 우리 사진 창고 주소만 잡는다', /BUCKET_PATH = "\/v0\/b\/baetnil\.firebasestorage\.app\/o\/"/.test(A) && /"media"\.equals\(u\.getQueryParameter\("alt"\)\)/.test(A));
  T('안드로이드: GET 만 잡는다 (올리기·지우기는 손대지 않는다)', /"GET"\.equalsIgnoreCase\(req\.getMethod\(\)\)/.test(A));
  T('안드로이드: 나머지는 캐퍼시터에 그대로 넘긴다', /return super\.shouldInterceptRequest\(view, req\);/.test(A));
  T('안드로이드: 없는 사진은 곧바로 돌려주고 읽을 때 받는다 (다른 요청을 기다리게 하지 않게)', /in = new TeeStream\(url, f, this\);/.test(A) && !/static boolean download\(/.test(A));
  T('안드로이드: 다 받은 뒤에만 파일로 남긴다 (반쯤 받은 사진이 안 남게)', /\.part"\)/.test(A) && /part\.renameTo\(to\)/.test(A) && /if \(!done\) dropPart\(\);/.test(A));
  T('안드로이드: 넘치면 오래 안 본 것부터 버린다 (250MB — Glide 기본값)', /MAX_BYTES = 250L \* 1024 \* 1024/.test(A) && /comparingLong\(File::lastModified\)/.test(A));
  T('안드로이드: 챙겨 둔 것을 줄 때 CORS 를 연다 (keepPhoto 의 fetch 가 받게)', /Access-Control-Allow-Origin", "\*"/.test(A));
}


// (라) 못 받은 사진을 켤 때마다 다시 받던 것 — 진짜 원인 (사진 창고 cors_config 가 비어 있었다)
{
  const grab=(js,name)=>{ const i=js.indexOf('async function '+name+'(')>=0?js.indexOf('async function '+name+'('):js.indexOf('function '+name+'('); if(i<0) return '';
    let d=0, st=js.indexOf('{',i); for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} } return ''; };
  const C=k=>{ const m=src.match(new RegExp('const '+k+'\\s*=\\s*([^;]+);')); return m?m[1]:'undefined'; };
  const env=`const PHOTO_CACHE='p'; const KEEP_FAIL_MS=${C('KEEP_FAIL_MS')}; const KEEP_FAIL_KEY=${C('KEEP_FAIL_KEY')};
    const store={}; const localStorage={ getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v);} };
    const box=new Map(); const caches={ open: async()=>({ match: async u=>box.get(u), put: async(u,r)=>{ box.set(u,r); } }) };
    let net=0, corsOk=false;
    const fetch=async(u,o)=>{ net++; if(!corsOk) throw new TypeError('Failed to fetch (CORS)'); return { ok:true, status:200 }; };
    ${grab(src,'keepFailGet')} ${grab(src,'keepFailSet')} ${grab(src,'keepFailed')} ${grab(src,'keepFailNote')} ${grab(src,'keepPhoto')}
    return { keepPhoto, net:()=>net, setCors:v=>{corsOk=v;}, has:u=>box.has(u) };`;
  const F=new Function(env)();
  (async()=>{
    const u='https://firebasestorage.googleapis.com/v0/b/baetnil.firebasestorage.app/o/photos%2Fx.jpg?alt=media&token=t';
    for(let i=0;i<10;i++) await F.keepPhoto(u);       // 앱을 열 번 켰다 (동기화·인터넷 재연결)
    T(`허용 설정이 없어 못 받으면 하루 동안 다시 안 받는다 (열 번 켜서 ${F.net()}번)`, F.net()===1, F.net());
    F.setCors(true);
    const u2=u.replace('x.jpg','y.jpg');
    await F.keepPhoto(u2); await F.keepPhoto(u2); await F.keepPhoto(u2);
    T('받히면 폰에 담고, 담긴 것은 다시 안 받는다', F.has(u2) && F.net()===2, F.net());
  })();
}
// (마) 웹: 서비스워커가 사진을 실제로 담는다 (<img> 요청은 opaque 라 여태 하나도 안 담겼다)
{
  const SW=fs.readFileSync(path.join(ROOT,'www/sw.js'),'utf8');
  T('웹: 사진 창고 사진은 cors 로 다시 불러 담을 수 있는 응답을 받는다', /new Request\(req\.url, \{ mode:'cors', credentials:'omit' \}\)/.test(SW));
  T('웹: cors 가 막히면 다시 안 해 본다 (두 번씩 받지 않게)', /if\(photoCors !== false\)/.test(SW) && /photoCors = false;/.test(SW));
  T('웹: cors 가 안 되면 원래 요청으로 받아 사진은 보인다', /if\(!res \|\| res\.status !== 200\) res = await fetch\(req\);/.test(SW));
}

// (가) 브라우저로 직접 잰다
(async () => {
  let chromium;
  try{ ({ chromium } = require('playwright')); }catch(_){ try{ ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }catch(__){} }
  if(!chromium){ T('브라우저 검사 (playwright 없음)', false); return done(); }
  const jpg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');
  const hits = { keep:0, nokeep:0 };
  const srv = http.createServer((req, res) => {
    if(req.url.startsWith('/keep')){ hits.keep++; res.writeHead(200, { 'Content-Type':'image/jpeg', 'Cache-Control':'public, max-age=31536000, immutable' }); return res.end(jpg); }
    if(req.url.startsWith('/nokeep')){ hits.nokeep++; res.writeHead(200, { 'Content-Type':'image/jpeg', 'Cache-Control':'private, max-age=0' }); return res.end(jpg); }
    res.writeHead(200, { 'Content-Type':'text/html' });
    res.end('<!doctype html><div id=box></div>');
  });
  await new Promise(r => srv.listen(0, r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const b = await chromium.launch();
  try{
    const ctx = await b.newContext();
    const pg = await ctx.newPage();
    await pg.goto(base + '/');
    // 앱이 화면을 다시 그릴 때처럼 같은 사진을 열 번 새로 띄운다 (innerHTML 로 통째로)
    for(const kind of ['keep', 'nokeep']){
      for(let i = 0; i < 10; i++){
        await pg.evaluate(u => new Promise(res => {
          const box = document.getElementById('box');
          box.innerHTML = '<img src="' + u + '">';
          const im = box.querySelector('img');
          if(im.complete) return res(); im.onload = im.onerror = () => res();
        }), base + '/' + kind + '/photos%2Fa.jpg?alt=media&token=x');
        await pg.waitForTimeout(30);
      }
    }
    // 앱을 껐다 켠 것처럼 — 새 화면에서 다시 띄운다 (같은 저장 공간). 다섯 번.
    for(let k = 0; k < 5; k++){
      const pg2 = await ctx.newPage();
      await pg2.goto(base + '/');
      for(const kind of ['keep', 'nokeep']){
        await pg2.evaluate(u => new Promise(res => { const im = new Image(); im.onload = im.onerror = () => res(); im.src = u; document.body.appendChild(im); }),
          base + '/' + kind + '/photos%2Fa.jpg?alt=media&token=x');
      }
      await pg2.close();
    }
  } finally { await b.close(); srv.close(); }
  T(`보관 설정이 있으면 화면을 열 번 다시 그리고 앱을 다섯 번 다시 켜도 서버에는 한 번 (지금 ${hits.keep}번)`, hits.keep === 1, hits);
  T(`보관 설정이 없으면(고치기 전 1,900장) 앱을 다시 켤 때마다 서버에 간다 (지금 ${hits.nokeep}번)`, hits.nokeep >= 6, hits);
  done();
})();
function done(){ console.log(`\n${ok} 통과 · ${bad} 실패`); process.exit(bad ? 1 : 0); }
