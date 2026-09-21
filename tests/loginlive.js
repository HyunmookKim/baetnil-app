// 로그인 단추 — 브라우저 검사
//
// ★ 왜 브라우저여야 하나
//   구글도 애플도 「내 단추가 남의 것보다 덜 눈에 띄면 안 된다」고 요구한다.
//   그건 글자를 봐서는 알 수 없다. **실제로 그려 놓고 크기를 재야** 안다.
//   로고도 마찬가지다 — 길(path) 이 한 글자 깨지면 소스는 멀쩡해 보이는데
//   화면에는 아무것도 안 그려진다. 실제로 4.44 에서 그럴 뻔했다.
const { chromium } = require('playwright');
const fs = require('fs'), http = require('http'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const srv = http.createServer((req,res)=>{
  let f = req.url.split('?')[0]; const 뿌리 = (f==='/'||f==='/index.html'); if(뿌리) f='/'+SRC;
  const p = (뿌리 && path.isAbsolute(SRC)) ? SRC : path.join(__dirname, f.replace(/^\//,''));
  if(!fs.existsSync(p)){ res.writeHead(404); res.end(''); return; }
  const ext = path.extname(p);
  res.writeHead(200, { 'content-type': ext==='.html'?'text/html; charset=utf-8'
    : ext==='.js'?'text/javascript':'application/octet-stream' });
  res.end(fs.readFileSync(p));
});
const UA = {
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  and: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36'
};
let pass=0, fail=0;
const T=(n,ok,x)=>{ ok?pass++:(fail++,console.log('★ 실패:',n, x===undefined?'':JSON.stringify(x))); };

(async ()=>{
  await new Promise(r=>srv.listen(0,r));
  const port = srv.address().port;
  const src = fs.readFileSync(path.isAbsolute(SRC) ? SRC : path.join(__dirname, SRC), 'utf8');
  const b = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  // ── 소스에서 못 박을 것
  T('애플 로그인 스위치가 있다', /const APPLE_LOGIN = (true|false);/.test(src));
  T('로고를 앱 안에 그려 넣는다 — 밖에서 안 받아온다',
    /const SVG_G = /.test(src) && /const SVG_APPLE = /.test(src)
    && !/SVG_(G|APPLE)[^\n]*https?:\/\//.test(src));
  T('구글 네 색을 그대로 쓴다',
    ['#EA4335','#4285F4','#FBBC05','#34A853'].every(c => src.indexOf(c) >= 0));
  // ★ 4.44 에서 실제로 저지른 실수 —
  //   로고의 길(d="...") 을 여러 줄로 토막내 이어 붙였더니 끝 숫자와 앞 숫자가 맞붙어
  //   '14.92' + '6.15' → '14.926.15' 가 됐다. 문법은 멀쩡하고 그림만 조용히 틀어진다.
  //   그림을 재서 잡기는 어렵다(사람 눈에도 안 보일 만큼 조금 틀어진다).
  //   그러니 **그 실수를 아예 못 하게** 막는다 — 길 하나는 따옴표 하나 안에 통째로 있어야 한다.
  {
    const 쪼갠길 = [];
    for(const 이름 of ['SVG_G','SVG_APPLE']){
      const i = src.indexOf('const ' + 이름 + ' = ');
      if(i < 0){ 쪼갠길.push(이름 + ' 없음'); continue; }
      const 끝 = src.indexOf(";\n", i);
      const 몸 = src.slice(i, 끝 < 0 ? i + 4000 : 끝);
      let k = -1;
      while((k = 몸.indexOf('d="', k + 1)) >= 0){
        const 닫 = 몸.indexOf('"', k + 3);
        if(닫 < 0 || 몸.slice(k, 닫).indexOf("'") >= 0) 쪼갠길.push(이름);
      }
    }
    T('★ 로고의 길을 토막내 잇지 않는다', 쪼갠길.length === 0, 쪼갠길);
  }
  // ★ 단추를 만드는 자리가 하나뿐이어야 한다 (문 하나)
  {
    const 부름 = (src.match(/onclick="doGoogle\(\)"/g) || []).length;
    T('★ 구글 단추를 만드는 자리가 하나다', 부름 === 1, 부름 + '곳');
  }

  const 보기 = async (ua, 켬) => {
    const ctx = await b.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, userAgent: UA[ua] });
    const page = await ctx.newPage();
    await page.route('**://tile.openstreetmap.org/**', r=>r.abort());
    await page.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(1600);
    const r = await page.evaluate(on=>{
      if(on){
        // 파일은 안 고친다. 이 창에서만 스위치를 켜 본 것처럼 만든다.
        const s = loginBtns.toString().replace('APPLE_LOGIN', 'true');
        window.loginBtns = new Function('return ' + s)();
      }
      openWelcome();
      const bs = [...document.querySelectorAll('#mrPanel .lgbtn')];
      return bs.map(x=>{
        const q = x.getBoundingClientRect();
        const sv = x.querySelector('svg');
        let 로고 = 0;
        try{ const bb = sv.getBBox(); 로고 = Math.round(bb.width); }catch(_){}
        return { 글: x.textContent.trim(),
                 w: Math.round(q.width), h: Math.round(q.height),
                 r: getComputedStyle(x).borderRadius,
                 f: getComputedStyle(x).fontSize,
                 로고 };
      });
    }, 켬);
    await ctx.close();
    return r;
  };

  // ── 1. ★ 4.131 에서 애플 로그인을 켰다 (스토어 심사규정 4.8).
  //    이제는 손대지 않은 그대로 두 단추가 다 나와야 한다.
  const 그대로 = await 보기('and', false);
  T('★ 애플 로그인이 켜져 있다 (4.131)', /const APPLE_LOGIN = true;/.test(src));
  T('★★ 손대지 않아도 단추가 둘이다', 그대로.length === 2, 그대로.map(x=>x.글));
  T('구글 단추가 있다', 그대로.some(x=>/Google/.test(x.글)), 그대로.map(x=>x.글));
  T('★ 애플 단추가 있다', 그대로.some(x=>/Apple/.test(x.글)), 그대로.map(x=>x.글));
  // ★ 끄는 길은 그대로 남아 있어야 한다 — 파이어베이스 쪽이 막히면 되돌려야 하므로
  T('★ 애플 단추를 끄는 길이 아직 있다',
    /APPLE_LOGIN\s*\n?\s*\?/.test(src) || /APPLE_LOGIN\s*\?/.test(src));
  T('★ 구글 로고가 실제로 그려진다', 그대로.every(x=>x.로고 > 0), 그대로);

  // ── 2. 켜면 — 차례가 기기 주인 쪽이다
  const 안 = await 보기('and', true);
  const 아 = await 보기('ios', true);
  T('안드로이드에서는 구글이 먼저', /Google/.test((안[0]||{}).글||''), 안.map(x=>x.글));
  T('아이폰에서는 애플이 먼저', /Apple/.test((아[0]||{}).글||''), 아.map(x=>x.글));
  T('어느 쪽이든 단추는 둘이다', 안.length === 2 && 아.length === 2, [안.length, 아.length]);

  // ── 3. ★ 크기가 똑같아야 한다 — 양쪽 규정이 같은 것을 요구한다
  for(const [이름, 목] of [['안드로이드', 안], ['아이폰', 아]]){
    if(목.length !== 2){ fail++; console.log('★ 실패: ' + 이름 + ' 단추가 둘이 아니다'); continue; }
    const [x, y] = 목;
    T(이름 + ' — 두 단추의 너비가 같다', x.w === y.w, [x.w, y.w]);
    T(이름 + ' — 두 단추의 높이가 같다', x.h === y.h, [x.h, y.h]);
    T(이름 + ' — 모서리가 같다', x.r === y.r, [x.r, y.r]);
    T(이름 + ' — 글자 크기가 같다', x.f === y.f, [x.f, y.f]);
    T('★ ' + 이름 + ' — 로고가 둘 다 그려진다', x.로고 > 0 && y.로고 > 0, [x.로고, y.로고]);
  }

  // ── 3-b. 로고가 통째로 사라지거나 크게 망가지지 않았나
  //    ★ 이 검사는 「완전히 안 그려진다 / 크게 틀어졌다」만 잡는다.
  //      숫자 한 자리가 틀린 것은 못 잡는다 — 그건 위의 「토막내지 마라」로 막는다.
  {
    const ctx = await b.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, userAgent: UA.and });
    const page = await ctx.newPage();
    await page.addInitScript(()=>{ try{ localStorage.setItem('bt_agree','1'); }catch(e){} });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil:'domcontentloaded' });
    await page.waitForTimeout(1600);
    const n = await page.evaluate(async ()=>{
      const draw = async (svg) => {
        const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(
          svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" '))));
        const im = new Image(); im.src = url;
        await new Promise(r2=>{ im.onload=r2; im.onerror=r2; });
        const c = document.createElement('canvas'); c.width=128; c.height=128;
        const g = c.getContext('2d'); g.drawImage(im,0,0,128,128);
        const d = g.getImageData(0,0,128,128).data;
        let k=0; for(let i=3;i<d.length;i+=4) if(d[i]>128) k++;
        return k;
      };
      return { g: await draw(SVG_G), a: await draw(SVG_APPLE) };
    });
    await ctx.close();
    // 128×128 = 16384 칸. 로고는 그 절반쯤을 채운다.
    const 사이 = (v, lo, hi) => v >= lo && v <= hi;
    T('★ 구글 로고가 제 모양으로 그려진다', 사이(n.g, 7000, 9500), n);
    T('★ 애플 로고가 제 모양으로 그려진다', 사이(n.a, 6800, 9200), n);
  }

  // ── 4. 글자는 두 회사가 허락한 것 중에서만
  const 허락 = /^(Google|Apple)로 (로그인|계속하기|가입하기)$/;
  for(const x of 안) T('허락된 글자다 — ' + x.글, 허락.test(x.글));

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  await b.close(); srv.close();
  if(fail) process.exit(1);
})();
