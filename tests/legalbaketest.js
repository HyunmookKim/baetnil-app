// 4.96 — 약관 세 편을 앱에서 구워 낸다 (한국어 · 영어 · 러시아어 · 일본어 = 12장)
//
// ★ 왜 이 검사가 있나
//   웹의 terms.html 은 판 1.2 인데 앱 안의 약관은 1.6 이었다. 사본이 둘이라 어긋난 것이다.
//   **법 문서가 두 곳에서 서로 다른 말을 하고 있었다.** 제일 나쁜 종류의 어긋남이다.
//   ★ 이제 정본은 앱의 LEGAL_DOCS 하나뿐이고 웹은 구워 낸 것이다.
//     이 검사는 「진짜로 앱에서 구워지는가 · 네 말이 다 나오는가 · 판이 같은가」 를 본다.
const fs = require('fs'), path = require('path'), os = require('os');
const SITE = 'https://baetnil.com';
const a2 = process.argv[2];
const APP   = (a2 && /\.html$/.test(a2)) ? a2 : '/home/claude/work.html';
const BUILD = process.argv[3] || '/home/claude/webout/scripts/build_web.js';

let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0,220) : '')); } };

const bsrc = fs.readFileSync(BUILD, 'utf8');
// ★ 중괄호를 세면 본문의 CSS·템플릿에 걸린다. 맨 왼쪽 '}' 로 끊는다.
function fn(name){
  const i = bsrc.indexOf('function ' + name + '(');
  if(i < 0) return '';
  const j = bsrc.indexOf('\n}\n', i);
  return j < 0 ? '' : bsrc.slice(i, j + 2);
}
const pick = re => (bsrc.match(re) || [''])[0];

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'legal-'));
fs.mkdirSync(path.join(OUT, 'app'), { recursive:true });
fs.copyFileSync(APP, path.join(OUT, 'app', 'index.html'));

const wr = `function write(rel, body){ const p = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(p), { recursive:true }); fs.writeFileSync(p, body); }`;
const BAKE = [
  pick(/const LANGS = \[[^\]]*\];/),
  pick(/const LEGAL_KEYS  = \[[^\]]*\];/),
  pick(/const LEGAL_HEAD  = \{[\s\S]*?\n\};/),
  pick(/const LEGAL_FOOT = \{[\s\S]*?\n\};/),
  pick(/const LEGAL_OPEN = \{[^}]*\};/),
  pick(/const LEGAL_ASK  = \{[^}]*\};/),
  pick(/const legalFile = [^\n]*\n/),
  pick(/const LEGAL_CSS = `[\s\S]*?`;/),
  pick(/const esc = s => [\s\S]*?;\n/),
  wr, fn('bakeLegal'), 'return bakeLegal();'
].join('\n');
const bake = dir => new Function('fs','path','OUT','SITE', BAKE)(fs, path, dir, SITE);
let made = 0, err = '';
try{ made = bake(OUT); }catch(e){ err = e.message; }

T('★★★ 약관을 구웠다 — ' + (made || err) + '장 (3편 × 4말)', made === 12);

const KEYS = ['terms','privacy','location'];
const LANGS = ['ko','en','ru','ja'];
const NEED = { ko:/[가-힣]/, en:/[A-Za-z]/, ru:/[Ѐ-ӿ]/, ja:/[ぁ-んァ-ヶ]/ };
const file = (k,L) => path.join(OUT, k + (L==='ko' ? '' : '.'+L) + '.html');
const read = (k,L) => { try{ return fs.readFileSync(file(k,L), 'utf8'); }catch(_){ return ''; } };

// 앱이 말하는 판 — 구운 것이 이것과 같아야 한다
const app = fs.readFileSync(APP, 'utf8');
const VER = ((app.match(/const LEGAL_VER\s+= '([^']+)'/) || [])[1]) || '';
T('앱의 판을 읽었다 — ' + VER, !!VER);

for(const L of LANGS){
  for(const k of KEYS){
    const h = read(k, L);
    if(!h){ T(k + '.' + L + ' 이 있다', false); fail += 4; continue; }
    T(k + '.' + L + ' 이 있다', true);
    T(k + '.' + L + ' — <html lang> 이 맞다', new RegExp('<html lang="'+L+'">').test(h));
    // ★★★ 판이 앱과 같다. 여기가 이 검사의 급소다 — 1.2 와 1.6 이 갈렸던 자리다.
    // ★ 사람이 보는 「적용일」 줄에 있어야 한다. 머리말 어딘가에만 있으면 소용없다.
    const meta = (h.match(/class="meta">([^<]*)/) || ['',''])[1];
    T(k + '.' + L + ' — 적용일 줄에 판이 적혀 있다 (' + VER + ')', meta.indexOf(VER) >= 0, meta);
    const body = (h.match(/<pre>([\s\S]*?)<\/pre>/) || ['',''])[1];
    T(k + '.' + L + ' — 그 나라 말이다 (' + body.length + '자)',
      body.length > 800 && NEED[L].test(body), body.slice(0,80));
    // 채우다 만 자리가 남으면 안 된다
    T(k + '.' + L + ' — 안 채운 자리가 없다',
      !/\{OWNER\}|\{EMAIL\}|\{DATE\}|\{VER\}|\{BIZ\}|\{LBS\}/.test(body),
      (body.match(/\{[A-Z]+\}/g) || []).join(','));
  }
}
// ★ 한국어가 정본이라고 번역본 첫머리에 적혀 있어야 한다
['en','ru','ja'].forEach(L => {
  const b = (read('terms', L).match(/<pre>([\s\S]*?)<\/pre>/) || ['',''])[1];
  T('terms.' + L + ' — 한국어가 정본이라고 적혀 있다',
    /Korean|корейск|韓国語/.test(b.slice(0, 200)), b.slice(0,120));
});
// ★ 일본어 판에 한글이 남아 있으면 안 옮긴 자리다 (앱 이름 「뱃일」 은 뺀다)
KEYS.forEach(k => {
  const b = (read(k, 'ja').match(/<pre>([\s\S]*?)<\/pre>/) || ['',''])[1].replace(/뱃일/g, '');
  const kor = (b.match(/[가-힣]/g) || []).length;
  T('ja ' + k + ' — 남은 한글 ' + kor + '자', kor === 0,
    (b.match(/[가-힣][가-힣 ]*/g) || []).slice(0,5).join(' | '));
});
// ★ hreflang 은 넷이 서로를 다 가리켜야 한다
KEYS.forEach(k => LANGS.forEach(L => {
  const h = read(k, L);
  T(k + '.' + L + ' — hreflang 넷을 다 가리킨다',
    LANGS.every(x => h.indexOf('hreflang="' + x + '"') >= 0) && /hreflang="x-default"/.test(h));
}));
// ★ 문서끼리·말끼리 오가는 길
{
  const h = read('terms', 'ja');
  T('ja — 다른 문서로 가는 길이 일본어 파일을 가리킨다',
    /href="privacy\.ja\.html"/.test(h) && /href="location\.ja\.html"/.test(h),
    (h.match(/href="[a-z.]*\.html"/g) || []).join(' '));
  T('ja — 지금 문서에 표시가 되어 있다', /href="terms\.ja\.html" aria-current="page"/.test(h));
  T('ja — 다른 말로 가는 길이 있다',
    /href="terms\.html"/.test(h) && /href="terms\.en\.html"/.test(h) && /href="terms\.ru\.html"/.test(h));
  T('ja — 제 말로 가는 길은 안 걸어 둔다',
    (h.match(/hreflang="ja">日本語/g) || []).length === 0);
  T('ja — 대문으로 갈 때 일본어 대문으로 간다', h.indexOf(SITE + '/ja/') > 0);
  const ko = read('terms', 'ko');
  T('ko — 대문으로 갈 때 뿌리로 간다', ko.indexOf('href="' + SITE + '/"') > 0);
}
// ★★★ 앱을 고치면 웹이 따라오는가 — 사본이면 안 따라온다
{
  const OUT2 = fs.mkdtempSync(path.join(os.tmpdir(), 'legal2-'));
  fs.mkdirSync(path.join(OUT2, 'app'), { recursive:true });
  fs.writeFileSync(path.join(OUT2, 'app', 'index.html'),
    app.replace('제1조 (목적)', '제1조 (목적·확인용표식)'));
  let n2 = 0;
  try{ n2 = bake(OUT2); }catch(_){}
  const h2 = (()=>{ try{ return fs.readFileSync(path.join(OUT2,'terms.html'),'utf8'); }catch(_){ return ''; } })();
  T('앱을 고쳐도 굽힌다 — ' + n2 + '장', n2 === 12);
  T('★★★ 앱을 고치면 웹이 따라온다 (사본이 아니다)', /확인용표식/.test(h2), h2.slice(0,200));
  try{ fs.rmSync(OUT2, { recursive:true, force:true }); }catch(_){}
}
try{ fs.rmSync(OUT, { recursive:true, force:true }); }catch(_){}
console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
