// ══════════════════════════════════════════════════════════════════════
// 5.0 — 표 칸에 글을 치고 [저장] 을 **한 번만** 눌러도 저장되는가
//
//   겪은 고장 — 표 칸을 누르면 줄·칸 단추줄(약 49px)이 펴진다. 그 상태에서
//   창 아래 [저장] 을 누르면, 손가락이 닿는 순간(mousedown) 단추줄이 접히면서
//   그 아래가 통째로 위로 뛰고, 손가락 밑에서 단추가 달아났다.
//   → 첫 번째 누름이 헛눌리고 두 번 눌러야 저장됐다.
//     쓰는 사람에게는 「표를 고치고 저장을 눌렀는데 아무 반응이 없다」 였다.
//
//   ★ 고친 방법 — 접는 일을 mousedown 이 아니라 **누름이 다 끝난 뒤(click)** 로 미뤘다.
//   ★ 이 검사는 **진짜 손가락(touchscreen.tap)** 으로 딱 한 번 누른다. 두 번 누르지 않는다.
// ══════════════════════════════════════════════════════════════════════
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const FILE = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const MIME = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
const srv = http.createServer((rq, rs) => {
  const u = rq.url.split('?')[0];
  const f = (u === '/' && path.isAbsolute(FILE)) ? FILE
          : (u === '/' ? path.join(__dirname, FILE) : path.join(__dirname, u));
  fs.readFile(f, (e, d) => { if(e){ rs.writeHead(404); rs.end(); return; }
    rs.writeHead(200, {'content-type': MIME[path.extname(f)] || 'application/octet-stream'}); rs.end(d); });
});
let ok = 0, bad = 0;
const T = (n, c, x) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (x === undefined ? '' : ' — ' + JSON.stringify(x))); } };

(async () => {
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const pg = await b.newPage({ viewport: { width: 412, height: 820 }, hasTouch: true, isMobile: true });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e.message).slice(0, 120)));
  try{
    await pg.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load' });
    await pg.waitForTimeout(3000);
    await pg.evaluate(() => { try{ skipWelcome(); }catch(_){}
      window.__user = { uid:'U1', name:'나' };
      window.ask = () => Promise.resolve(true); window.tell = () => Promise.resolve(true); });

    await pg.evaluate(() => { window.__saved = null;
      openForm({ title:'검사', okText:'저장',
        fields:[{ key:'body', type:'rich', label:'내용',
          value:[{t:'text',h:1,v:'앞 글'},
                 {t:'table',head:1,rows:[['이름','값'],['출처','9/10'],['쓸모','10/10']]}] }],
        onOk: v => { window.__saved = v.body; } }); });
    await pg.waitForTimeout(700);
    T('표가 편집기에 열린다', await pg.evaluate(() => !!document.querySelector('#ff0 .qltbl table')));

    // 칸에 커서를 두고 글자를 친다 → 단추줄이 펴진다
    await pg.click('#ff0 .qltbl td[contenteditable]');
    await pg.keyboard.type('가나다');
    await pg.waitForTimeout(350);
    const 전 = await pg.evaluate(() => {
      const g = document.querySelector('#formFoot .fbtn.go');
      return { 펴짐: !!document.querySelector('.qltbl.on'),
               바: !!document.querySelector('.qltbl.on .qltblbar'),
               y: g ? Math.round(g.getBoundingClientRect().y) : null };
    });
    T('★ 칸을 누르면 줄·칸 단추줄이 펴진다', 전.펴짐 && 전.바, 전);

    // ★ 딱 한 번 — 진짜 손가락으로
    const g = await pg.$('#formFoot .fbtn.go');
    const box = await g.boundingBox();
    await pg.touchscreen.tap(box.x + box.width/2, box.y + box.height/2);
    await pg.waitForTimeout(800);

    const 후 = await pg.evaluate(() => ({
      저장됨: !!window.__saved,
      표: window.__saved ? window.__saved.filter(x => x.t === 'table').length : 0,
      친글: window.__saved ? JSON.stringify(window.__saved.filter(x => x.t === 'table')).indexOf('가나다') >= 0 : false
    }));
    T('★★★ 표 칸에 글을 친 뒤 [저장] 을 **한 번만** 눌러도 저장된다', 후.저장됨, 후);
    T('★★ 표가 한 개 그대로 담긴다', 후.표 === 1, 후);
    T('★★ 방금 친 글자가 표 안에 담긴다', 후.친글, 후);

    // 접는 자리가 mousedown 이 아니라 click 인지 — 되돌아가는 것도 잡는다
    const 소스 = fs.readFileSync(path.isAbsolute(FILE) ? FILE : path.join(__dirname, FILE), 'utf8');
    const md = (소스.match(/addEventListener\('mousedown', e => \{\s*\n\s*const el = 표of\(e\);[\s\S]{0,1400}?\}, true\);/) || [''])[0];
    T('★★★ mousedown 에서는 접지 않는다 (여기서 접으면 단추가 달아난다)',
      md.length > 0 && md.indexOf("classList.remove('on')") < 0);
    T('★★★ 접는 자리가 click(버블)로 옮겨져 있다',
      /addEventListener\('click', e => \{\s*\n\s*if\(표of\(e\)\) return;[\s\S]{0,400}?\}, false\);/.test(소스));

    T('브라우저가 터지지 않았다', errs.length === 0, errs.slice(0, 2));
  }catch(e){
    bad++; console.log('★ 실패: 검사가 터졌습니다 — ' + String(e).slice(0, 160));
  }
  await b.close(); srv.close();
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
})();
