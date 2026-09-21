// 3.53 — 지운 사진 치우기 (고아 사진)
//
// 왜
//  · 글·물건·자리를 지워도 창고에 올려 둔 사진은 그대로 남았다.
//    아무 데서도 안 보이는 사진이 자리를 차지하고, 그만큼 매달 돈이 나간다.
//
// ★ 지켜야 할 것
//  1. 지우는 모든 길에서 함께 치운다 — 한 곳이라도 빠지면 거기서부터 쌓인다
//  2. 못 치워도 조용히 넘어간다 — 글은 이미 지워졌고 이것은 뒷정리다
//  3. 문서에 담긴 옛 사진(data:)은 창고에 없다. 건드리지 않는다
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
const mod = src.slice(src.indexOf('<script type="module">'));
let srules = '';
try{ srules = fs.readFileSync(process.argv[3] || 'storage_rules.txt', 'utf8'); }catch(e){}

let pass = 0, fail = 0;
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 무엇을 치울지 고르기 — 실제로 돌려 본다
{
  const u = grab(js, 'photoUrlsOf') || '';
  T('사진 주소를 모으는 곳이 있다', u.length > 0);
  let F = null, err = '';
  try{ F = new Function(u + '\n return photoUrlsOf;')(); }catch(e){ err = e.message; }
  T('모으기를 돌렸다' + (err ? ' — ' + err : ''), !!F);
  if(F){
    const U = n => 'https://firebasestorage.googleapis.com/' + n + '.jpg';
    const got = F({
      photos: [U('사진1'), U('사진2')],
      thumbs: [U('작은1')],
      blocks: [{ t:'text', v:'글' }, { t:'photo', v:U('글속1') }]
    });
    T('사진을 모은다', got.includes(U('사진1')) && got.includes(U('사진2')));
    // ★ 작은 사진도 창고에 올라간 것이다. 안 지우면 그것만 남는다.
    T('작은 사진도 모은다', got.includes(U('작은1')));
    T('글 속에 섞인 사진도 모은다', got.includes(U('글속1')));
    T('모두 ' + got.length + '장', got.length === 4);
    // ★ 문서에 담긴 옛 사진은 창고에 없다 — 지우려 들면 헛일이다
    T('문서에 담긴 옛 사진은 안 모은다',
      F({ photos:['data:image/jpeg;base64,AAA'] }).length === 0);
    T('같은 사진을 두 번 안 모은다', F({ photos:[U('가'), U('가')] }).length === 1);
    T('빈 것도 무너지지 않는다',
      F(null).length === 0 && F({}).length === 0 && F({ photos:null }).length === 0);
  } else fail += 7;
}

// ── 2. 치우는 곳
{
  const d = grab(js, 'dropPhotos') || '';
  T('치우는 곳이 있다', d.length > 0);
  T('창고에서 지운다', /window\.__photos/.test(d) && /\.del\(/.test(d));
  // ★ 폰에 담아 둔 사본도 같이 버려야 한다. 안 그러면 지운 사진이 배에서 계속 보인다.
  T('폰에 담아 둔 사본도 버린다', /caches\.open\(PHOTO_CACHE\)/.test(d) && /c\.delete\(u\)/.test(d));
  T('주소가 아닌 것은 거른다', /\/\^https\?:\/i\.test\(u\)/.test(d));
  T('한 장만 줘도 받는다', /Array\.isArray\(urls\) \? urls : \[urls\]/.test(d));
  // ★ 글은 이미 지워졌다. 뒷정리가 안 됐다고 사람에게 소리치면 안 된다.
  T('못 치워도 조용히 넘어간다', (d.match(/catch\(_\)\{\}/g) || []).length >= 2);
  T('알림창을 띄우지 않는다', !/tell\(/.test(d));
  const o = grab(js, 'dropPhotosOf') || '';
  T('덩어리째 치우는 길도 있다', o.length > 0 && /photoUrlsOf\(o\)/.test(o));
}

// ── 3. ★ 지우는 모든 길에서 치우는가 (한 곳이라도 빠지면 거기서부터 쌓인다)
{
  const WHERE = [
    ['글판',        'delTalk'],
    ['중고 장터',   'delItem'],
    ['정박지',      'delSpot'],
    ['배 게시판',   'delPost'],
    ['정비 사진',   'mrDelPhoto'],
    ['배 소개',     'delIntro']
  ];
  WHERE.forEach(([name, f])=>{
    const g = grab(js, f) || '';
    T(name + ' 을 지울 때 사진도 치운다 — ' + f, /dropPhotos/.test(g));
  });
  // ★ 지우기가 성공한 뒤에 치워야 한다. 먼저 치우면 글은 남고 사진만 사라진다.
  const dt = grab(js, 'delTalk') || '';
  T('글판은 지워진 뒤에 치운다', dt.indexOf('.then(') < dt.indexOf('dropPhotosOf'));
  const di = grab(js, 'delItem') || '';
  T('장터도 지워진 뒤에 치운다', di.indexOf('.then(') < di.indexOf('dropPhotosOf'));
  const ds = grab(js, 'delSpot') || '';
  T('정박지도 지워진 뒤에 치운다', ds.indexOf('.then(') < ds.indexOf('dropPhotosOf'));
  // 정비 사진은 목록에서 뺀 뒤에 치운다 — 화면이 먼저 정리돼야 한다
  const md = grab(js, 'mrDelPhoto') || '';
  T('정비 사진은 뺀 뒤에 치운다', md.indexOf('splice') < md.indexOf('dropPhotos'));
  T('정비 사진은 그 한 장만 치운다', /const gone = it\.photos\[i\]/.test(md));
  const dn = grab(js, 'delIntro') || '';
  T('배 소개는 사진일 때만 치운다', /gone\.t === 'photo'/.test(dn));
}

// ── 4. 창고 규칙이 그것을 허락하는가
if(srules){
  T('내 사진은 내가 지울 수 있다',
    /allow delete: if request\.auth != null && request\.auth\.uid == uid/.test(srules));
  // ★ 남의 사진은 못 지운다. 운영자가 남의 글을 지울 때 사진이 안 지워지는 것은 맞는 일이다.
  T('남의 사진은 못 지운다', !/allow delete: if request\.auth != null;/.test(srules));
  T('그 밖은 다 막혀 있다',
    /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/.test(srules));
} else { console.log('★ 실패: 창고 규칙 파일이 없습니다 (3건) — hv/tests/storage_rules.txt 에 Firebase 콘솔 → Storage → Rules 내용을 넣어 주세요'); fail += 3; }

// ── 5. 창고 창구
{
  const seg = mod.slice(mod.indexOf('window.__photos'), mod.indexOf('window.__photos') + 1400);
  T('창고에 지우는 길이 있다', /async del\(/.test(seg));
  T('주소로 지운다', /sref\(fst, url\)/.test(seg));
  T('없는 것을 지워도 안 죽는다', /catch\(_\)\{\}/.test(seg));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
