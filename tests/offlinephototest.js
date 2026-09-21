// 3.42 — 사진을 창고로 옮긴 대가를 갚는다
//
// 무슨 문제인가
//  · 3.34~3.41 에서 사진을 파이어스토어 문서 밖 창고(Storage)로 옮겼다.
//    전송비는 크게 줄었지만 사진이 '주소' 가 되었다. 인터넷이 없으면 안 보인다.
//  · 배 위에서는 인터넷이 없는 것이 보통이다.
//    적재표 물품 사진은 배 위에서 보려고 찍는 것이다. 그게 안 보이면 앱이 아니다.
//
// ★ 그래서 두 겹으로 막는다
//   1. 서비스워커가 한 번 본 사진을 남긴다 (앱 버전을 올려도 안 지운다)
//   2. 내가 올린 사진은 '올리는 그 순간' 저장분에 넣는다 — 한 번도 안 봐도 남아 있다
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const sw = fs.readFileSync(process.argv[3] || 'sw.js', 'utf8');

let pass = 0, fail = 0;
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 서비스워커가 사진을 남긴다
{
  T('사진 전용 저장분이 있다', /const PHOTOS = 'baetnil-photos'/.test(sw));
  // ★ 앱 버전을 올릴 때마다 지우면, 새 판이 나갈 때마다 배에서 사진이 사라진다
  T('앱 버전을 올려도 사진은 안 지운다', /k!==PHOTOS/.test(sw));
  T('지도 타일도 그대로다 — 같이 잃으면 안 된다', /k!==TILES/.test(sw));
  T('창고 주소를 알아본다', /firebasestorage\.googleapis\.com/.test(sw));

  const f = grab(sw, 'photoFetch') || '';
  T('사진 받아오는 길이 따로 있다', f.length > 0);
  T('저장분을 먼저 본다', f.indexOf('caches.open(PHOTOS)') < f.indexOf('fetch('));
  // ★★ 3.44 — 서비스워커가 '아무 사진이나' **배에 나갈 자리에** 담으면 안 된다.
  //   글판·장터·정박지 사진이 400장을 채워 버리면
  //   정작 배에 나갔을 때 물품·정비·도면 사진이 없다.
  //   그 400장에 무엇을 남길지는 앱이 고른다.
  //   ★ 4.82 — 한 번 본 사진은 따로 판 자리(SEEN)에 담는다. 그건 담아도 된다.
  {
    // ★ 담는 곳마다, 그 앞에서 연 자리가 어디인지 본다.
    //   「PHOTOS 가 어딘가에 있고 put 도 어딘가에 있다」 로 보면 안 된다 — 늘 걸린다.
    const 담는곳 = f.split('.put(').slice(0, -1);
    const 어디 = 담는곳.map(앞 => {
      const i = 앞.lastIndexOf('caches.open(');
      return i < 0 ? '?' : 앞.slice(i + 12).split(')')[0];
    });
    T('★★★ 배에 나갈 자리(PHOTOS)에는 스스로 안 담는다',
      어디.length > 0 && 어디.every(x => x !== 'PHOTOS'), 어디);
  }
  T('★★★ 한 번 본 사진은 담는다 (안 담으면 돌아올 때마다 다시 받는다)',
    /caches\.open\(SEEN\)[\s\S]*?\.put\(req, copy\)/.test(f));
  T('★★★ 그 자리에도 끝이 있다', /const SEEN_KEEP = \d+/.test(sw));
  T('담아 둔 것이 없으면 그냥 받아온다', /await fetch\(req\)/.test(f));
  T('끝내 안 되면 조용히 넘어간다', /status\s*:\s*504/.test(f));

  // ★ 4.90 — 내 배 사진을 버리는 일은 서비스워커가 안 한다.
  //   여기서는 「이게 도면인지 항해 사진인지」를 알 수가 없어 넣은 순서로밖에 못 버린다.
  //   그러면 제일 먼저 넣고 제일 오래 쓰는 도면이 제일 먼저 죽는다. 앱이 한다.
  const app = require('fs').readFileSync(__dirname + '/../../work.html', 'utf8');
  T('★★★ 서비스워커는 내 배 사진을 안 버린다', !/async function trimPhotos/.test(sw));
  T('★★★ 버리는 곳은 앱에 있다', /async function trimBoatPhotos\(\)/.test(app));
  T('★★★ 그리고 덜 중요한 것부터 버린다', /boatPhotoUrls\(\)[\s\S]{0,400}slice\(0, PHOTO_KEEP_MAX\)/.test(app));
  T('★★ 남의 사진 자리는 서비스워커가 그대로 치운다', /async function trimSeen/.test(sw));

  T('사진 요청을 실제로 가로챈다', /PHOTO_HOSTS\.includes\(u\.hostname\)/.test(sw));
  // ★ 가로채기는 '외부 요청은 건드리지 않는다' 보다 먼저 와야 한다. 뒤에 두면 영영 안 걸린다.
  T('바깥 요청을 흘려보내기 전에 가로챈다',
    sw.indexOf('PHOTO_HOSTS.includes') < sw.indexOf("u.origin !== self.location.origin"));
  T('날씨·파이어스토어는 여전히 안 건드린다', /u\.origin !== self\.location\.origin\) return/.test(sw));
}

// ── 2. ★ 내가 올린 사진은 올리는 그 순간 넣어 둔다
{
  const p = grab(js, 'primePhoto') || '';
  T('올린 사진을 미리 넣는 곳이 있다', p.length > 0);
  T('서비스워커와 같은 저장분을 쓴다', /PHOTO_CACHE/.test(p)
    && /const PHOTO_CACHE = 'baetnil-photos'/.test(js));
  T('주소를 열쇠로 넣는다', /c\.put\(url,/.test(p));
  T('사진 종류를 함께 적는다', /Content-Type/.test(p));
  // ★ 실패해도 글 올리기가 멈추면 안 된다 — 이것은 덤이다
  T('실패해도 조용히 넘어간다', /catch\(_\)\{\}/.test(p));
  T('주소가 아니면 아무 일도 안 한다', /\/\^https\?:\/i\.test\(url\)/.test(p));
  T('저장분을 못 쓰는 곳에서도 안 죽는다', /typeof caches === 'undefined'/.test(p));

  const ts = grab(js, 'toStored') || '';
  T('창고에 올릴 때마다 넣어 둔다', /primePhoto\(url, p\)/.test(ts));
  T('작은 사진도 넣어 둔다', /primePhoto\(turl, t\)/.test(ts));
  // ★ 여기서 기다리면 글 올리는 시간이 두 배가 된다
  T('넣기를 기다리지 않는다', !/await primePhoto\(/.test(ts));
}

// ── 3. 적재표·정비 사진이 창고로 간다
{
  const pk = grab(js, 'pickPhoto') || '';
  // ★ 320픽셀 품질 0.5 로는 나중에 부품 사진을 봐도 무엇인지 못 알아본다
  T('적재표 사진을 제대로 된 화질로 줄인다', /resizePhoto\(/.test(pk));
  T('옛 방식(320픽셀 손수 그리기)이 남아 있지 않다', !/max = 320/.test(pk) && !/toDataURL/.test(pk));

  const ai = grab(js, 'addItem') || '';
  T('적재표 물품 사진이 창고로 간다', /storePhotos\(/.test(ai));
  T('창고 주소를 물품에 저장한다', /photos:st\.photos/.test(ai));
  // ★ 사진이 올라가는 사이에 다른 칸을 누르면 엉뚱한 칸에 들어간다
  T('넣던 칸을 붙잡아 둔다', /myLocker/.test(ai) && /lockerId:myLocker/.test(ai));
  T('상자 안 자리도 붙잡아 둔다', /myIn/.test(ai) && /parentId:myIn/.test(ai));
  T('고치던 것이 무엇인지도 붙잡아 둔다', /myEdit/.test(ai));
  T('사진을 붙잡아 둔다 — 화면을 먼저 비우기 때문', /myPhotos = formPhotos\.slice\(\)/.test(ai));
  T('화면을 먼저 비운다', ai.indexOf('resetForm()') < ai.indexOf('await storePhotos'));
  T('다 되면 저장한다', /save\(\);/.test(ai));
  T('못 넣은 사진이 있으면 알린다', /storeShortMsg\(/.test(ai));

  const mp = grab(js, 'mrPickPhoto') || '';
  T('정비·수리 사진도 제대로 된 화질', /resizePhoto\(/.test(mp));
  T('정비·수리 사진도 창고로 간다', /storePhotos\(/.test(mp));
  T('옛 방식이 남아 있지 않다', !/max=320/.test(mp) && !/toDataURL/.test(mp));
  // ★ 사진이 올라가는 사이에 다른 기록을 열면 엉뚱한 화면을 다시 그린다
  T('열어 둔 기록이 그대로일 때만 다시 그린다', /mrOpenType === ty && mrOpenId === id/.test(mp));
  T('창고에 못 올려도 사진은 남는다', /st\.photos\[0\] \|\| url/.test(mp));
}

// ── 3-b. ★ 저장분 이름이 셋이 되었다 — 앱 파일만 골라내야 한다
{
  // 예전에는 'baetnil-' 로 시작하는 것 아무거나 집었다.
  // baetnil-tiles / baetnil-photos 를 집으면
  // '저장된 파일 photos (새로고침 필요)' 라는 헛소리 띠가 뜬다.
  T('앱 파일은 판 번호로 골라낸다', /\/\^baetnil-\\d\/\.test\(k\)/.test(js));
  T('아무거나 집던 것이 남아 있지 않다', !/indexOf\('baetnil-'\) === 0/.test(js));
  // 실제로 골라 보게 한다
  const pick = ks => ks.find(k => /^baetnil-\d/.test(k));
  T('타일·사진이 먼저 있어도 앱 파일을 집는다 — ' + pick(['baetnil-tiles','baetnil-photos','baetnil-3.42']),
    pick(['baetnil-tiles','baetnil-photos','baetnil-3.42']) === 'baetnil-3.42');
  T('앱 파일이 없으면 아무것도 안 집는다', pick(['baetnil-tiles','baetnil-photos']) === undefined);

  // ★ '앱 새로 받기' 가 사진·지도까지 지우면 배에 나가서 아무것도 없다
  const hr = grab(js, 'hardReload') || grab(js, 'appReload') || js;
  T('앱 새로 받기가 사진은 남긴다', /k !== 'baetnil-photos'/.test(js));
  T('앱 새로 받기가 지도 타일도 남긴다', /k !== 'baetnil-tiles'/.test(js));
}

// ── 4. 도면은 3.43 에서 옮겼다 — 자세한 것은 dgstoretest 가 본다
{
  const ps = grab(js, 'pinShot') || '';
  T('도면에 핀 찍는 곳이 있다', ps.length > 0);
  const ud = grab(js, 'uploadDg') || '';
  T('도면도 창고로 간다', /storePhotos\(/.test(ud));
}

// ── 1-b. ★ 실제로 돌려 본다 (글자만 보고 넘어가면 안 돌아가는 것을 못 잡는다)
{
  const consts = ["const PHOTOS = 'baetnil-photos';",
    "const SEEN = 'baetnil-seen';",
    "const SEEN_KEEP = " + ((sw.match(/const SEEN_KEEP = (\d+)/) || [])[1] || '200') + ';'].join('\n');
  // 가짜 저장분
  function mkCache(){
    const m = new Map();
    return {
      m,
      async match(req){ return m.get(String(req.url || req)) || undefined; },
      async put(req, res){ m.set(String(req.url || req), res); },
      async keys(){ return [...m.keys()].map(u => ({ url:u })); },
      async delete(req){ return m.delete(String(req.url || req)); }
    };
  }
  let 저장분 = mkCache();
  let 받은횟수 = { cors:0, plain:0 };
  const run = (fetchImpl) => new Function('caches', 'fetch', 'Response',
    consts + '\n' + (grab(sw, 'trimPhotos') || '') + '\n' + (grab(sw, 'photoFetch') || '')
    + '\n return photoFetch;')(
      { async open(){ return 저장분; } }, fetchImpl,
      class { constructor(b, o){ this.body = b; this.opts = o; this.ok = true;
                                 this.status = (o && o.status) || 200;
                                 this.clone = () => this; } });

  (async ()=>{
    const req = { url:'https://firebasestorage.googleapis.com/사진1.jpg' };
    // 담아 둔 것이 없는 사진 — 그냥 받아오고, 담지는 않는다
    const plain = run(async ()=>{ 받은횟수.plain++; return { ok:true, clone(){ return this; } }; });
    const r1 = await plain(req);
    T('담아 두지 않은 사진은 그냥 받아온다', !!r1 && 받은횟수.plain === 1);
    await new Promise(r=>setTimeout(r, 5));
    T('★ 받아온 것을 저장분에 밀어 넣지 않는다 — ' + 저장분.m.size + '장', 저장분.m.size === 0);
    // 두 번째도 그냥 받아온다 (브라우저 자기 저장분이 받쳐 준다)
    await plain(req);
    T('앱이 고르지 않은 사진은 계속 그냥 받는다', 받은횟수.plain === 2);

    // 인터넷이 아예 없는 경우
    저장분 = mkCache();
    const off = run(async ()=>{ throw new Error('오프라인'); });
    const r3 = await off(req);
    T('인터넷이 없으면 조용히 비운다 — ' + (r3 && r3.status), !!r3 && r3.status === 504);

    // ★ 인터넷이 없어도 저장분에 있으면 나와야 한다. 배 위에서 이것이 전부다.
    저장분 = mkCache();
    저장분.m.set(req.url, { ok:true, 저장분에서:true });
    const off2 = run(async ()=>{ throw new Error('오프라인'); });
    const r4 = await off2(req);
    T('인터넷이 없어도 담아 둔 사진은 나온다', !!(r4 && r4.저장분에서));

    // ★ 4.90 — 여기서 돌려 보던 trimPhotos 는 없어졌다.
    //   내 배 사진을 버리는 일은 앱의 trimBoatPhotos 가 한다 (photokeeptest · photolive).
    //   서비스워커가 치우는 것은 「한 번 본 사진」 자리뿐이다.
    저장분 = mkCache();
    for(let i = 0; i < 260; i++) await 저장분.put('u' + i, {});
    const trimS = new Function('caches', consts + '\n' + (grab(sw, 'trimSeen') || '')
      + '\n return trimSeen;')({ async open(){ return 저장분; } });
    await trimS();
    const seen = Number((sw.match(/const SEEN_KEEP = (\d+)/) || [])[1] || 200);
    T('★★ 한 번 본 사진은 넘치면 버린다 — ' + 저장분.m.size + '장 남음', 저장분.m.size === seen);
    T('★★ 그 자리는 오래된 것부터 버린다', !저장분.m.has('u0') && 저장분.m.has('u259'));

    console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
    process.exit(fail ? 1 : 0);
  })();
}
