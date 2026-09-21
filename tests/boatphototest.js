// 3.41 — 배 안쪽 사진(게시판·소개)도 창고로, 그리고 길을 하나로 모은다
//
// 왜
//  · 3.34 에서 커뮤니티 사진만 창고로 옮겼다. 배 게시판과 배 소개는 그대로였다.
//  · 배 소개는 배 문서 '본체' 에 들어간다. 배 문서는 동기화할 때마다 오간다.
//    사진 700KB 를 켤 때마다 주고받고 있었다.
//  · 게다가 파이어스토어 문서는 1MB 가 한계다. 사진 몇 장이면 배가 통째로 저장이 안 된다.
//
// ★ 그리고 더 큰 문제 —
//   '창고로 보내고 · 크기를 재고 · 글 속 사진 자리를 새 주소로 바꾼다'
//   이 세 가지를 글판·정박지·장터가 각자 하고 있었다.
//   그래서 글판만 순서가 달랐다 — 창고로 보내기 '전' 에 크기를 재서,
//   창고에 올라가면 주소 몇 글자로 줄어들 사진을 미리 잘라내고 있었다.
//   이제 다섯 곳이 storePhotos 하나를 쓴다.
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

let pass = 0, fail = 0;
// 실패할 때 사진 자료가 통째로 찍히면 화면을 못 본다 — 앞부분만 남긴다
const cut = n => { n = String(n); return n.length > 90 ? n.slice(0, 90) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 한 길을 실제로 돌려 본다
let SP = null, err = '';
try{
  const consts = ['PHOTO_BUDGET_KB']
    .map(k => (js.match(new RegExp('const ' + k + ' = [^\\n]*\\n')) || [''])[0]).join('\n');
  SP = new Function('toStored',
    consts + '\n' + grab(js, 'photoBudget') + '\n' + grab(js, 'storePhotos')
    + '\n return storePhotos;');
}catch(e){ err = e.message; }
T('사진 옮기는 길이 하나 있다', !!grab(js, 'storePhotos'));
T('그 길을 돌렸다' + (err ? ' — ' + err : ''), !!SP);

if(SP){
  // 창고가 잘 도는 상황 — 사진은 주소로 바뀐다
  const 창고 = SP(async list => ({
    photos: list.map((_, i) => 'https://창고/사진' + i + '.jpg'),
    thumbs: list.map((_, i) => 'https://창고/작은' + i + '.jpg')
  }));
  const 큰사진 = 'data:image/jpeg;base64,' + 'A'.repeat(400 * 1024);   // 400KB 한 장

  (async ()=>{
    const r = await 창고([큰사진, 큰사진]);
    T('창고로 가면 주소만 남는다 — ' + r.photos.join(','),
      r.photos.length === 2 && r.photos.every(u => /^https:/.test(u)));
    // ★ 여기가 옛 버그다. 400KB 두 장이면 예산(700KB)을 넘어 한 장이 잘렸다.
    //   창고에 올리면 주소 몇 글자뿐인데 미리 재서 자른 것이다.
    T('창고에 올렸으면 자르지 않는다', r.ok === true && r.dropped === 0);
    T('작은 사진도 함께 온다', r.thumbs.length === 2);

    // 글 속 사진 자리도 새 주소로 따라온다 — 한쪽만 바꾸면 사진이 사라진다
    const blocks = [{ t:'text', v:'앞글' }, { t:'photo', v:큰사진 }, { t:'text', v:'뒷글' }];
    const fixed = r.fix(blocks);
    T('글 속 사진 자리가 새 주소로 바뀐다 — ' + fixed[1].v, /^https:/.test(fixed[1].v));
    T('글자는 건드리지 않는다', fixed[0].v === '앞글' && fixed[2].v === '뒷글');
    T('원래 글을 망가뜨리지 않는다', blocks[1].v === 큰사진);
    T('사진 없는 글도 무너지지 않는다', r.fix([]).length === 0 && r.fix(null).length === 0);

    // ★ 창고를 못 쓸 때(로그인 전·인터넷 없음) — 옛날처럼 문서에 담고, 그때는 크기를 잰다
    const 창고없음 = SP(async list => ({ photos: list.slice(), thumbs: [] }));
    const r2 = await 창고없음([큰사진, 큰사진]);
    T('창고를 못 쓰면 문서에 담는다', r2.photos.every(u => !/^https:/.test(u)));
    T('그때는 넘치는 것을 잘라 낸다 — ' + r2.photos.length + '장 남김',
      r2.ok === false && r2.dropped === 1 && r2.photos.length === 1);
    T('빈 것도 다룬다', (await 창고([])).photos.length === 0
      && (await 창고(null)).photos.length === 0);
    T('빈 자리는 걸러 낸다', (await 창고([큰사진, null, ''])).photos.length === 1);
    // ★ 같은 사진을 두 번 넣으면 창고에도 두 번 올라간다 — 한 번만 올린다
    let 올린수 = 0;
    const 셈하는창고 = SP(async list => {
      올린수 += list.length;
      return { photos: list.map((_, i) => 'https://창고/사진' + i + '.jpg'), thumbs: [] };
    });
    const r3 = await 셈하는창고([큰사진, 큰사진, 큰사진]);
    T('같은 사진은 한 번만 올린다 — ' + 올린수 + '번', 올린수 === 1);
    T('그래도 자리 수는 그대로다 — ' + r3.photos.length + '장', r3.photos.length === 3);
    T('세 자리가 같은 주소를 가리킨다', new Set(r3.photos).size === 1);

    // 못 넣었을 때 하는 말
    const m = grab(js, 'storeShortMsg') || '';
    T('못 넣은 사진을 알리는 말이 있다', m.length > 0);
    // ★ 4.100 — 붙여 만든 글은 사전이 통째로 못 찾는다. tsub 로 토막마다 지난다.
    T('몇 장인지 말한다', /\{n\}/.test(m));
    T('어디인지 말한다', /\{where\}/.test(m));
    T('까닭도 말한다', /클라우드/.test(m));

    // ── 2. 다섯 곳이 모두 그 길을 쓴다
    const WHERE = [
      ['배 게시판',  'writePost'],
      ['배 소개 고치기', 'editIntro'],
      ['배 소개 넣기',   'addIntro'],
      ['글판',       'writeTalk'],
      ['정박지',     'spotSave'],
      ['장터',       'itemSave']
    ];
    // 이름이 다를 수 있으니 실제로 있는 것만 본다
    const found = WHERE.filter(([, f]) => !!grab(js, f));
    T('사진을 다루는 화면을 찾았다 — ' + found.map(x=>x[0]).join(', '), found.length >= 4);
    found.forEach(([name, f])=>{
      const b = grab(js, f) || '';
      T(name + ' 이(가) 한 길을 쓴다', /storePhotos\(/.test(b));
      T(name + ' 이(가) 옛 길을 안 쓴다', !/await toStored\(/.test(b));
    });

    // ★ 배 게시판·배 소개는 3.41 에서 처음 옮긴 곳이다 — 여기가 핵심
    const bp = grab(js, 'writePost') || '';
    T('배 게시판이 주소를 저장한다', /photos = st\.photos|addPost\([^)]*st\.photos/.test(bp));
    T('배 게시판이 작은 사진도 남긴다', /thumbs = st\.thumbs|thumbs = st\.thumbs/.test(bp));
    T('배 게시판이 글 속 자리도 바꾼다', /st\.fix\(/.test(bp));
    const ei = grab(js, 'editIntro') || '';
    T('배 소개가 글 속 자리도 바꾼다', /st\.fix\(/.test(ei));
    const ai = grab(js, 'addIntro') || '';
    T('배 소개 사진 넣기도 창고를 지난다', /storePhotos\(/.test(ai));

    // 옛 길이 앱 어디에도 남아 있으면 안 된다 (storePhotos 안은 빼고)
    const withoutFunnel = js.replace(grab(js, 'storePhotos') || '', '');
    const left = [...withoutFunnel.matchAll(/await toStored\(/g)].length;
    T('옛 길을 직접 부르는 곳이 없다 — ' + left + '곳', left === 0);

    // ── 3. 사진을 못 받았을 때
    T('못 받은 사진을 알아채는 곳이 있다', /classList\.add\('imgfail'\)/.test(js));
    T('까닭을 사람 말로 적는다', /인터넷 연결을 확인/.test(js));
    // ★ 문서에 담긴 옛 사진(data:)까지 실패로 잡으면 멀쩡한 사진에 금이 간다
    T('창고 사진만 본다', /getAttribute\('src'\)[\s\S]{0,120}\/\^https\?:\/i\.test/.test(js));
    T('인터넷이 돌아오면 다시 받는다', /addEventListener\('online'/.test(js));
    // ★ 지도 타일은 사진이 아니다 — 인터넷이 없을 때 지도 칸마다 그 문구가 도배됐다
    T('지도 타일에는 그 문구를 안 붙인다', /classList\.contains\('mt'\)\) return/.test(js));
    T('다시 받을 때 표시를 지운다', /classList\.remove\('imgfail'\)/.test(js));
    T('못 받은 자리에 모양이 있다', /\.imgfail\{/.test(src));

    console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
    process.exit(fail ? 1 : 0);
  })();
} else {
  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(1);
}
