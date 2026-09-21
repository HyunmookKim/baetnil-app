// 사진이 왜 느렸나 — 그리고 안 느려졌는가 (4.82)
//
// ★ 사장님 지적: 「사진 로딩이 좀 오래 걸리네. 다른 어플들은 바로바로 되는데」
//
// ★ 짐작하지 않고 실물에서 쟀다 (사장님 브라우저, 실제 창고 사진):
//     1077×801 · 78KB · 한 장에 1.3~2.3초
//     cache-control: private, max-age=0     ← 창고가 「들고 있지 마라」 고 하고 있었다
//
// ★ 까닭이 셋이었다
//   ① 창고가 「저장하지 마라」 를 붙여 보냈다 → 화면을 돌아올 때마다 다시 받았다
//   ② 38픽셀 자리에 원본(1077px)을 걸었다 → 작은 사본을 만들어 두고도 안 썼다
//   ③ 화면 밖 사진까지 다 받았다 → 스무 장짜리 목록이 스무 장을 다 받고서야 떴다
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const SWP = require('path').join(require('path').dirname(process.argv[2] || 'work.html'), 'sw.js');
let sw = ''; try{ sw = fs.readFileSync(SWP, 'utf8'); }catch(_){ try{ sw = fs.readFileSync('sw.js','utf8'); }catch(__){} }
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };
const grab=(js,name)=>{ for(const pre of ['function ','async function ']){
    const i=js.indexOf(pre+name+'('); if(i<0) continue;
    let d=0, st=js.indexOf('{',i);
    for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} } }
  return ''; };

// ── ① 올릴 때 「오래 들고 있어도 된다」 고 말하는가
T('★★★ 사진을 올릴 때 오래 들고 있어도 된다고 붙인다',
  /cacheControl: 'public, max-age=31536000, immutable'/.test(src));
{
  const f = grab(src, 'put') || (src.match(/async put\(dataUrl\)\{[\s\S]*?\n      \}/)||[''])[0];
  T('★★★ 그 말을 실제로 올릴 때 넘긴다',
    /uploadString\(r, dataUrl, 'data_url',\s*\n?\s*\{ cacheControl:/.test(src), f.slice(0,300));
}
// ★ 주소가 매번 새로 지어지는지 — 안 그러면 immutable 이 위험하다 (옛 사진이 남는다)
T('★★★ 사진 주소는 올릴 때마다 새로 짓는다 (그래야 immutable 이 안전하다)',
  /Date\.now\(\)\.toString\(36\) \+ Math\.random\(\)\.toString\(36\)/.test(src));

// ── ② 작은 자리에는 작은 사진
[['적재표 사진칸', /<img class="thumb" loading="lazy" src="\$\{thumbOf\(it, 0\)\}"/],
 ['찾기 결과',    /<img loading="lazy" src="\$\{thumbOf\(i, 0\)\}">/],
].forEach(([이름, re]) => T('★★★ ' + 이름 + ' 이 작은 사본을 쓴다', re.test(src)));

// ★ 4.132 — 휴지통 줄은 trashRows() 가 미리 지어 둔 r.thumb 를 건다.
//   그래도 그 r.thumb 이 작은 사본(thumbOf)이라야 한다. 두 마디를 다 본다.
T('★★★ 휴지통 줄감(trashRows)이 작은 사본을 담는다',
  /thumb:\(it\.photos && it\.photos\.length\) \? thumbOf\(it, 0\) : ''/.test(src));
T('★★★ 휴지통 줄 이 작은 사본을 쓴다',
  /<img loading="lazy" src="\$\{r\.thumb\}" style="width:34px/.test(src));

T('★★★ 작은 자리에 원본을 그대로 거는 곳이 없다',
  !/<img[^>]*src="\$\{(it|i)\.photos\[0\]\}"/.test(src),
  (src.match(/<img[^>]*src="\$\{(it|i)\.photos\[0\]\}"[^>]*>/g)||[]).slice(0,3));

// ★ 작은 사본이 없는 옛 기록은 원본으로 되돌아야 한다 — 빈칸이 되면 안 된다
{
  const F = new Function(grab(src,'thumbOf') + 'return thumbOf;')();
  T('★★★ 작은 사본이 있으면 그것을 쓴다',
    F({ thumbs:['T0'], photos:['P0'] }, 0) === 'T0');
  T('★★★ 작은 사본이 없는 옛 기록은 원본을 쓴다 (빈칸이 되면 안 된다)',
    F({ thumbs:[''], photos:['P0'] }, 0) === 'P0');
  T('★★ 아무것도 없으면 빈 글자다 (터지지 않는다)', F({}, 0) === '');
}

// ── ③ 화면 밖 사진은 안 받는다
{
  const imgs = (src.match(/<img[^>]*src="\$\{esc\(u\)\}"/g) || []);
  const lazy = imgs.filter(x => /loading="lazy"/.test(x));
  T('★★★ 사진을 거는 곳이 다 화면 밖은 안 받는다 (' + lazy.length + '/' + imgs.length + ')',
    imgs.length > 0 && lazy.length === imgs.length,
    imgs.filter(x => !/loading="lazy"/.test(x)).slice(0,3));
}

// ── ④ 이미 올라간 사진 — 우리가 들고 있는다
T('★★★ 한 번 본 사진을 담는 자리가 따로 있다', /const SEEN = 'baetnil-seen'/.test(sw));
{
  const f = grab(sw, 'photoFetch');
  T('★★★ 받아 온 사진을 실제로 담는다', /caches\.open\(SEEN\)\s*\n?\s*\.then\(c => c\.put\(req, copy\)\)/.test(f), f.slice(0,400));
  T('★★★ 오류 화면은 안 담는다 (그 사진이 영영 안 보인다)', /res\.status === 200/.test(f));
  T('★★★ 담아 둔 것을 먼저 본다 (인터넷을 안 쓴다)', /caches\.open\(SEEN\)[\s\S]*?hit2/.test(f));
  T('★★★ 배에 나갈 사진(PHOTOS)을 먼저 본다', f.indexOf('PHOTOS') < f.indexOf('SEEN'));
}
T('★★★ 본 사진 자리에도 끝이 있다 (폰이 가득 차면 안 된다)', /const SEEN_KEEP = \d+/.test(sw));
T('★★★ 넘치면 오래된 것부터 버린다', /async function trimSeen\(\)/.test(sw));
{
  const m = sw.match(/const SEEN_KEEP = (\d+)/);
  const seen = m ? Number(m[1]) : 0;
  // ★ 4.90 — 내 배 한도는 서비스워커에 없다. 앱이 폰 여유를 보고 정한다.
  //   그래도 「남의 사진 자리가 내 배 최소 자리보다 작아야 한다」는 뜻은 그대로다.
  const app = require('fs').readFileSync(__dirname + '/../../work.html', 'utf8');
  const min = Number((app.match(/const PHOTO_KEEP_MIN = (\d+)/) || [])[1] || 0);
  T('★★★ 본 사진 자리가 내 배 최소 자리보다 작다 (' + seen + ' < ' + min + ')',
    seen > 0 && min > 0 && seen < min, { seen: seen, min: min });
}
T('★★★ 앱을 새로 올려도 두 자리 다 안 지운다',
  /k!==CACHE && k!==TILES && k!==PHOTOS && k!==SEEN/.test(sw));

// ── ⑤ 판 번호가 맞는가 (안 맞으면 새 서비스워커가 안 깨어난다)
{
  const a = (src.match(/const APP_VER = '([\d.]+)'/)||[])[1];
  const b = (sw.match(/const CACHE = 'baetnil-([\d.]+)'/)||[])[1];
  T('★★★ 앱과 서비스워커의 판 번호가 같다 (' + a + ' / ' + b + ')', !!a && a === b, { a, b });
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
