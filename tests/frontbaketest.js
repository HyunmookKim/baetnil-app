// 4.94 — 대문을 말마다 한 장씩 굽는다 (/ja/ /en/ /ru/)
//
// ★ 왜 이 검사가 있나
//   대문은 자바스크립트로 글자만 바꿔 왔다. 주소가 하나뿐이라 구글이 보는 것은
//   「한국어 문서 한 장」 이었고, 일본 사람이 구글에서 우리를 찾을 길이 없었다.
//   ★ 구운 판이 잘못되면 아무도 모른다 — 사람은 뿌리(/)만 보기 때문이다.
//     그래서 구운 판을 여기서 실제로 굽고 뜯어본다.
const fs = require('fs'), path = require('path'), os = require('os');
const SITE = 'https://baetnil.com';
// ★ 전체 검사 돌리개는 검사마다 work.html 을 건네준다. 이 검사가 볼 것은 대문이라 그건 무시한다.
//   (돌리개가 주는 work.html 은 앱이고, 여기서 볼 것은 대문이다.)
// ★ 4.99 — 예전에는 파일 이름이 work.html 인지로만 갈랐다.
//   돌리개에 앱을 index.html 이라는 이름으로 건네자 앱을 대문으로 알고 구우려 했다.
//   이제는 알맹이를 보고 가른다 — 대문에만 `var I18N` 이 있다.
const a2 = process.argv[2];
const isFront = p => { try { return /var I18N = \{/.test(fs.readFileSync(p, 'utf8')); }
                       catch(_){ return false; } };
const FRONT = (a2 && isFront(a2)) ? a2 : '/home/claude/site/index.html';
const BUILD = process.argv[3] || '/home/claude/webout/scripts/build_web.js';

let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (x ? '\n   ' + String(x).slice(0,220) : '')); } };

// 굽는 함수만 떼어 돌린다
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const bsrc = fs.readFileSync(BUILD, 'utf8');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'front-'));
fs.copyFileSync(FRONT, path.join(OUT, 'site.html'));   // ★ 4.97 — 틀은 site.html 이다

let made = 0, err = '';
try{
  const langs  = (bsrc.match(/const LANGS = \[[^\]]*\];/) || [''])[0];
  const lpath  = (bsrc.match(/const LPATH = \{[^}]*\};/) || [''])[0];
  const escfn  = (bsrc.match(/const esc = s => [\s\S]*?;\n/) || [''])[0];
  const fsrc   = (bsrc.match(/const FRONT_SRC = [^\n]*\n/) || [''])[0];
  const wr = `function write(rel, body){ const p = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(p), { recursive:true }); fs.writeFileSync(p, body); }`;
  made = new Function('fs','path','OUT','SITE',
    langs + '\n' + lpath + '\n' + escfn + '\n' + fsrc + '\n' + wr + '\n'
    + grab(bsrc, 'bakeFront') + '\n return bakeFront();')(fs, path, OUT, SITE);
}catch(e){ err = e.message; }

T('대문을 구웠다 — ' + (made || err) + '장 (한국어까지 넷)', made === 4);

const NEED = { ja:/[ぁ-んァ-ヶ一-龥]/, en:/[A-Za-z]/, ru:/[Ѐ-ӿ]/ };
for(const L of ['ja','en','ru']){
  const f = path.join(OUT, L, 'index.html');
  if(!fs.existsSync(f)){ T(L + ' 판이 있다', false); fail += 6; continue; }
  const h = fs.readFileSync(f, 'utf8');
  T(L + ' 판이 있다', true);
  T(L + ' — <html lang> 이 맞다', new RegExp('<html lang="' + L + '">').test(h), h.slice(0,120));
  // ★ 글자가 실제로 채워져 있어야 한다. 비어 있으면 구글이 빈 페이지를 본다.
  // ★ 주석은 화면에 안 나온다 — 세면 안 된다
  const body = h.slice(h.indexOf('<body'), h.indexOf('<script'))
                .replace(/<!--[\s\S]*?-->/g, '');
  const empt = (body.match(/data-t="[^"]+"[^>]*><\//g) || []).length;
  T(L + ' — 안 채운 자리가 없다 — ' + empt + '곳', empt === 0);
  const tag = (body.match(/data-t="tag"[^>]*>([\s\S]*?)<\//) || ['',''])[1];
  T(L + ' — 첫 문구가 그 나라 말이다 — ' + tag.replace(/<[^>]*>/g,' ').slice(0,40),
    NEED[L].test(tag));
  // 한국어가 그대로 남아 있으면 안 옮긴 자리다 (제품 이름은 뺀다)
  // ★ 「뱃일」 은 상호고 「한국어」 는 그 말의 제 이름이다 (日本語·English·Русский 과 같다).
  //   그 말로 옮기면 오히려 틀린다. 세지 않는다.
  const strip = body.replace(/뱃일/g,'').replace(/한국어/g,'');
  const kor = (strip.match(/[가-힣]/g) || []).length;
  T(L + ' — 남은 한글 ' + kor + '자', kor === 0,
    (strip.match(/[가-힣][가-힣 ]*/g) || []).slice(0,6).join(' | '));
  // 머리
  T(L + ' — canonical 이 제 주소를 가리킨다',
    h.indexOf('<link rel="canonical" href="' + SITE + '/' + L + '/">') >= 0);
  T(L + ' — og:url 이 제 주소를 가리킨다',
    h.indexOf('content="' + SITE + '/' + L + '/"') >= 0);
  // ★ hreflang 은 넷이 서로를 다 가리켜야 한다. 한쪽만 가리키면 구글이 무시한다.
  ['ko','ja','en','ru'].forEach(x =>
    T(L + ' — hreflang ' + x + ' 을 가리킨다',
      h.indexOf('hreflang="' + x + '"') >= 0));
  T(L + ' — x-default 가 있다', h.indexOf('hreflang="x-default"') >= 0);
  // 말 고르는 줄에서 지금 판이 눌려 있다
  T(L + ' — 말 고르는 줄에 지금 판이 눌려 있다',
    new RegExp('data-lang="' + L + '" aria-pressed="true"').test(h),
    (h.match(/data-lang="[a-z]{2}" aria-pressed="[a-z]+"/g) || []).join(' '));
  T(L + ' — 눌린 것이 하나뿐이다',
    (h.match(/data-lang="[a-z]{2}" aria-pressed="true"/g) || []).length === 1);
  // 약관 주소가 절대 주소다 (/ja/terms.html 로 새면 404 다)
  const docs = h.match(/<a href="([^"]*)"[^>]*data-doc=/g) || [];
  T(L + ' — 약관 주소가 절대 주소다 — ' + docs.length + '개',
    docs.length >= 3 && docs.every(x => /href="\//.test(x)), docs.join(' '));
}

// ★★★ 한국어 대문도 채워서 구워야 한다 — 자바스크립트를 안 돌리는 읽개가 보는 자리다
{
  const h = fs.readFileSync(path.join(OUT, 'index.html'), 'utf8');
  const body = h.slice(h.indexOf('<body'), h.indexOf('<script')).replace(/<!--[\s\S]*?-->/g, '');
  const empt = (body.match(/data-t="[^"]+"[^>]*><\//g) || []).length;
  T('★★★ 한국어 대문에 안 채운 자리가 없다 — ' + empt + '곳', empt === 0);
  T('★★ 한국어 대문에 정비수첩 설명이 글자로 남아 있다',
    /난이도/.test(body) && /사용 부품/.test(body),
    body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,140));
  T('한국어 대문은 <html lang="ko"> 다', /<html lang="ko">/.test(h));
  T('한국어 대문의 canonical 은 뿌리다',
    h.indexOf('<link rel="canonical" href="' + SITE + '/">') >= 0,
    (h.match(/canonical[^>]*/) || [''])[0]);
  T('한국어 대문에서 한국어 단추가 눌려 있다',
    /data-lang="ko" aria-pressed="true"/.test(h));
  T('★ 틀(site.html)은 안 건드린다',
    fs.readFileSync(FRONT,'utf8') === fs.readFileSync(path.join(OUT,'site.html'),'utf8'));
}
// 사전은 대문 안에 하나뿐이다 (구운 판이 제 사전을 따로 갖지 않는다)
{
  const h = fs.readFileSync(path.join(OUT, 'ja', 'index.html'), 'utf8');
  T('구운 판도 사전을 하나만 갖는다', (h.match(/var I18N = \{/g) || []).length === 1);
}

try{ fs.rmSync(OUT, { recursive:true, force:true }); }catch(_){}
console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
