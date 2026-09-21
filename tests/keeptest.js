// 3.44 — 폰에 남길 사진은 '배 사진' 만이다
//
// 무슨 문제였나
//  · 3.42 에서 서비스워커가 창고 사진을 400장까지 폰에 남기게 했다.
//    그런데 '창고 사진' 이면 아무거나 담았다 — 글판 사진, 장터 사진, 정박지 사진까지.
//  · 커뮤니티를 한 번 훑기만 해도 400장이 남의 사진으로 찬다.
//    그러고 배에 나가면 정작 내 물품·정비·도면 사진이 없다.
//    배에서 보려고 찍은 그 사진이 없는 것이다.
//
// ★ 그래서 배에 나갈 사진 자리(PHOTOS 400장)에는 서비스워커가 스스로 담지 않는다.
//   앱이 고른 것만 남는다.
//   남기는 것   — 적재표 물품 · 정기점검 · 수리 · 항해일지 · 서류 · 배 게시판 · 도면
//   안 남기는 것 — 글판 · 정박지 · 중고 장터 · 배 소개
//
// ★★★ 4.82 — 「스스로 아무것도 안 담는다」 로 바뀌었다. 그건 지나쳤다.
//   창고가 「저장하지 마라」 를 붙여 보내는 바람에, 안 담으면 화면을 돌아올 때마다
//   같은 사진을 다시 받았다 (한 장 1.3~2.3초). 그래서 **자리를 따로 팠다** —
//   SEEN(200장, 한 번 본 사진). 지켜야 할 것은 「아무것도 안 담기」 가 아니라
//   **배에 나갈 400장을 남의 사진이 잡아먹지 않는 것**이다. 이 검사도 그것을 본다.
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

// ── 1. 서비스워커는 스스로 담지 않는다
{
  const f = grab(sw, 'photoFetch') || '';
  T('사진 받아오는 길이 있다', f.length > 0);
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
  T('★★★ 한 번 본 사진은 따로 판 자리에 담는다', /caches\.open\(SEEN\)[\s\S]*?\.put\(req, copy\)/.test(f));
  T('담아 둔 것이 있으면 그것부터 준다', /caches\.open\(PHOTOS\)/.test(f) && /return hit/.test(f));
  T('없으면 그냥 받아온다', /await fetch\(req\)/.test(f));
  T('왜 그런지 적어 두었다', /글판|장터|정박지/.test(sw));
}

// ── 2. ★ 무엇을 남길지 실제로 골라 본다
{
  const b = grab(js, 'boatPhotoUrls') || '';
  T('배 사진을 모으는 곳이 있다', b.length > 0);
  let F = null, err = '';
  try{
    F = new Function('items','maint','repair','voyage','vdocs','posts','dgImgs',
      b + '\n return boatPhotoUrls;');
  }catch(e){ err = e.message; }
  T('모으기를 돌렸다' + (err ? ' — ' + err : ''), !!F);
  if(F){
    const u = n => 'https://firebasestorage.googleapis.com/' + n + '.jpg';
    const got = F(
      [{ photos:[u('물품1'), u('물품2')] }, { photos:[] }, { name:'사진없음' }],
      [{ photos:[u('정비1')] }],
      [{ photos:[u('수리1')] }],
      [{ photos:[u('항해1')] }],
      [{ photos:[u('서류1')] }],
      [{ photos:[u('게시판1')] }],
      { plan: u('평면도'), side: u('측면도') }
    )();
    const has = n => got.includes(u(n));
    T('물품 사진을 챙긴다', has('물품1') && has('물품2'));
    T('정기점검 사진을 챙긴다', has('정비1'));
    T('수리 사진을 챙긴다', has('수리1'));
    T('항해일지 사진을 챙긴다', has('항해1'));
    T('서류 사진을 챙긴다 — 보험증서·검사증은 배에서 봐야 한다', has('서류1'));
    T('배 게시판 사진을 챙긴다 — 인수인계가 여기 있다', has('게시판1'));
    T('도면도 챙긴다', has('평면도') && has('측면도'));
    T('모두 ' + got.length + '장', got.length === 9);

    // ★ 커뮤니티 사진은 여기 들어올 길이 없어야 한다 — 목록 자체가 배 자료뿐이다
    T('커뮤니티 목록을 보지 않는다',
      !/talkList|spotList|marketList|intro/.test(b));

    // 같은 사진이 두 번 들어가면 그만큼 자리를 버린다
    const dup = F([{ photos:[u('같은것'), u('같은것')] }], [], [], [], [], [], {})();
    T('같은 사진은 한 번만', dup.length === 1);
    // 창고에 안 올라간 옛 사진(data:)은 폰에 챙길 것이 없다
    const old = F([{ photos:['data:image/jpeg;base64,옛것'] }], [], [], [], [], [], {})();
    T('자료 안에 든 옛 사진은 건너뛴다', old.length === 0);
    // 빈 것·이상한 것
    const empty = F([], null, undefined, [{ photos:null }], [], [{}], { plan:null, side:null })();
    T('빈 것도 무너지지 않는다', empty.length === 0);
  } else fail += 11;
}

// ── 3. 챙기기가 조심스러운가
{
  const k = grab(js, 'keepPhoto') || '';
  T('사진 한 장 챙기는 곳이 있다', k.length > 0);
  // ★ 이미 있는 것을 또 받으면 데이터 요금만 나간다
  T('이미 챙긴 것은 다시 안 받는다', /if\(await c\.match\(url\)\) return false/.test(k));
  T('cors 로 받는다 — 껍데기는 자리를 몇 배로 잡는다', /mode\s*:\s*'cors'/.test(k));
  T('제대로 못 받으면 담지 않는다', /if\(!res \|\| !res\.ok\) return false/.test(k));
  T('주소가 아니면 아무 일도 안 한다', /\/\^https\?:\/i\.test\(url\)/.test(k));
  T('실패해도 조용히 넘어간다', /catch\(_\)\{ return false; \}/.test(k));

  const kb = grab(js, 'keepBoatPhotos') || '';
  T('한꺼번에 챙기는 곳이 있다', kb.length > 0);
  // ★ 배에서 인터넷이 없을 때 헛되이 400번 두드리면 안 된다
  T('인터넷이 없으면 하지 않는다', /navigator\.onLine === false/.test(kb));
  T('두 번 겹쳐 돌지 않는다', /keepBusy/.test(kb));
  // ★ 한 번에 몰아 받으면 데이터 요금이 튄다
  T('한 번에 받는 수를 제한한다', /KEEP_PER_RUN/.test(kb));
  T('그 수가 한 곳에 정해져 있다', /const KEEP_PER_RUN = \d+/.test(js));
  const per = Number((js.match(/const KEEP_PER_RUN = (\d+)/) || [])[1] || 0);
  T('한 번에 받는 수가 알맞다 — ' + per + '장', per >= 10 && per <= 100);
  T('폰에 둘 수를 넘지 않는다', /PHOTO_KEEP_MAX/.test(kb));

  // ★ 4.90 — 수를 두 곳에 두지 않는다 (문 하나).
  //   전에는 앱과 서비스워커가 같은 숫자를 따로 들고 있었다. 한쪽만 고치면 어긋난다.
  //   이제 앱이 폰 여유를 보고 정하고, 서비스워커는 숫자를 아예 안 갖는다.
  T('★★★ 서비스워커는 내 배 사진 한도를 따로 갖지 않는다 (문 하나)',
    !/const PHOTO_KEEP\s*=\s*\d+/.test(sw));
  T('★★★ 한도는 앱이 폰 여유를 보고 정한다', /async function photoKeepN\(\)/.test(js));
  const appMin = Number((js.match(/const PHOTO_KEEP_MIN = (\d+)/) || [])[1] || 0);
  T('★★ 아무리 빠듯해도 담는 최소가 있다 — ' + appMin + '장', appMin >= 200);
  T('같은 저장분 이름을 쓴다',
    /const PHOTO_CACHE = 'baetnil-photos'/.test(js) && /const PHOTOS = 'baetnil-photos'/.test(sw));
}

// ── 4. 언제 챙기나
{
  T('자료를 받은 뒤에 챙긴다', /keepBoatPhotos\(\); \}catch\(_\)\{\} \}, 1500\)/.test(js));
  T('인터넷이 돌아오면 챙긴다',
    /addEventListener\('online'[\s\S]{0,120}?keepBoatPhotos\(\)/.test(js));
  // ★ 자료 받는 것을 사진 받느라 늦추면 안 된다
  const cp = grab(js, 'cloudPull') || '';
  T('자료 받기를 기다리게 하지 않는다', !/await keepBoatPhotos\(/.test(cp));
}

// ── 5. 올릴 때 챙기는 것은 그대로다 (내가 올린 사진은 그 자리에서 남는다)
{
  const ts = grab(js, 'toStored') || '';
  T('내가 올린 사진은 올리는 순간 남는다', /primePhoto\(url, p\)/.test(ts));
  const pp = grab(js, 'primePhoto') || '';
  T('그 길도 같은 저장분을 쓴다', /PHOTO_CACHE/.test(pp));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
