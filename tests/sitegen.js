// 약관 세 장을 웹 페이지로 뽑는다 (site/*.html)
//
// ★ 왜 앱에서 뽑나
//   플레이스토어에 낼 개인정보처리방침 주소는 앱 안 문서와 한 글자도 달라선 안 된다.
//   손으로 옮겨 적으면 앱만 고치고 웹은 그대로 두는 날이 반드시 온다.
//   그래서 앱을 진짜 브라우저로 띄워 LEGAL_DOCS 에서 그대로 꺼내 쓴다.
//   (legalout.js 가 legal.json 을 만들고, 이 파일이 그것으로 페이지를 찍는다)
const fs = require('fs'), path = require('path');
const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'legal.json'), 'utf8'));
const M = L.__meta;

// ★ 말마다 한 벌씩 찍는다. 한국어는 예전 이름 그대로 두어야 이미 나가 있는 주소가 안 깨진다.
//   (스토어·약관 화면에 이미 걸려 있는 주소다)
const LANGS = [
  { v:'ko', suffix:'',     htmlLang:'ko',
    app:'뱃일 · BAETNIL', foot:'뱃일 — 배 타는 사람들을 위한 앱', open:'앱 열기', ask:'문의',
    verWord:'판', fromWord:'부터 적용' },
  { v:'en', suffix:'.en',  htmlLang:'en',
    app:'BAETNIL', foot:'Baetnil — an app for people who go to sea', open:'Open the app', ask:'Contact',
    verWord:'Version', fromWord:', in force from' },
  { v:'ru', suffix:'.ru',  htmlLang:'ru',
    app:'BAETNIL', foot:'«Пэннiль» — приложение для тех, кто выходит в море', open:'Открыть приложение', ask:'Связь',
    verWord:'Редакция', fromWord:', действует с' }
];
const KEYS = ['privacy', 'terms', 'location'];
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const CSS = `  :root{--bg:#081521;--sf:#0E1D2B;--bd:#1B2E3E;--tx:#D6E2EC;--th:#F1F7FC;--tm:#8AA0B4;--ac:#9CC6E8}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--tx);
    font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Malgun Gothic",sans-serif;
    line-height:1.75;font-size:15px;-webkit-text-size-adjust:100%}
  .wrap{max-width:760px;margin:0 auto;padding:28px 20px 80px}
  header{border-bottom:1px solid var(--bd);padding-bottom:16px;margin-bottom:22px}
  .app{font-size:13px;letter-spacing:.14em;color:var(--tm);font-weight:700}
  h1{font-size:23px;margin:8px 0 6px;color:var(--th);letter-spacing:-.02em}
  .meta{font-size:13px;color:var(--tm)}
  nav{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 0}
  nav a{display:inline-block;padding:7px 13px;border:1px solid var(--bd);border-radius:999px;
    color:var(--tx);text-decoration:none;font-size:13px;font-weight:600;background:var(--sf)}
  nav a[aria-current]{background:var(--ac);border-color:var(--ac);color:#08131F}
  pre{white-space:pre-wrap;word-break:break-word;font:inherit;margin:0}
  footer{margin-top:40px;padding-top:16px;border-top:1px solid var(--bd);font-size:13px;color:var(--tm)}
  footer a{color:var(--ac)}
  @media(prefers-color-scheme:light){
    body{background:#fff;color:#1a2632}
    :root{--sf:#f2f6fa;--bd:#d6e0ea;--th:#0d1a26;--tm:#5b7085;--ac:#1d6ea8}
    nav a[aria-current]{color:#fff}
  }`;

const dir = path.join(__dirname, 'site');
if(!fs.existsSync(dir)) fs.mkdirSync(dir);

let n = 0;
LANGS.forEach(LG => {
  const set = (L.langs && L.langs[LG.v]) || L;      // 예전 legal.json 도 읽힌다
  const date = (M.dates && M.dates[LG.v]) || M.date;
  KEYS.forEach(key => {
    const doc = set[key];
    if(!doc){ console.log('★ 없음:', LG.v, key); process.exitCode = 1; return; }
    const file = key + LG.suffix + '.html';
    const nav = KEYS.map(k2 =>
      `<a href="${k2}${LG.suffix}.html"${k2 === key ? ' aria-current="page"' : ''}>${esc(set[k2].title)}</a>`).join('');
    // 다른 말로 가는 길 — 스토어 심사가 이것을 본다
    const alt = LANGS.filter(x => x.v !== LG.v)
      .map(x => `<a href="${key}${x.suffix}.html" hreflang="${x.v}">${
        x.v === 'ko' ? '한국어' : x.v === 'en' ? 'English' : 'Русский'}</a>`).join('');
    const html = `<!doctype html>
<html lang="${LG.htmlLang}">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.title)} — ${LG.v === 'ko' ? '뱃일' : 'Baetnil'}</title>
<meta name="description" content="Baetnil ${esc(doc.title)}. ${esc(LG.verWord)} ${esc(M.ver)}${esc(LG.fromWord)} ${esc(date)}.">
${LANGS.map(x => `<link rel="alternate" hreflang="${x.v}" href="${key}${x.suffix}.html">`).join('\n')}
<style>
${CSS}
</style>
<div class="wrap">
<header>
  <div class="app">${esc(LG.app)}</div>
  <h1>${esc(doc.title)}</h1>
  <div class="meta">${esc(LG.verWord)} ${esc(M.ver)}${esc(LG.fromWord)} ${esc(date)}</div>
  <nav>${nav}</nav>
  <nav style="margin-top:8px">${alt}</nav>
</header>
<pre>${esc(doc.body.trim())}</pre>
<footer>
  ${esc(LG.foot)} · <a href="./">${esc(LG.open)}</a><br>
  ${esc(LG.ask)} <a href="mailto:${esc(M.email)}">${esc(M.email)}</a>
</footer>
</div>
`;
    fs.writeFileSync(path.join(dir, file), html);
    n++;
    console.log('찍음:', 'site/' + file, html.length + '자');
  });
});
console.log('모두', n, '장 · 판', M.ver);
