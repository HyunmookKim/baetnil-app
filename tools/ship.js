// 뱃일 — 내보내는 화면 파일 만들기 (5.35, 2026-10-03)
//
// ★ 사장님: 「더 빠르게 … 응 한다음에 조금이라도 문제 생기면 되돌려라」
//   원본(www/index.html)은 그대로 둔다 — 설명 글·네 말 사전이 다 들어 있다(검사들이 원본을 읽는다).
//   폰(안드로이드·아이폰)과 웹으로 내보내는 파일만 이렇게 바꾼다.
//     ① 앱 본체 코드의 설명 글·빈칸을 뺀다(esbuild — 공백만 줄인다. 이름은 안 바꾼다: 화면 단추가 함수 이름으로 부른다).
//        V8 블로그 「Blazingly fast parsing, part 1: optimizing the scanner」 — 설명 글·빈칸도 한 글자씩 훑는다.
//     ② 영·러·일 사전을 코드 밖 JSON 칸으로 옮긴다(i18next·FormatJS 「쓰는 언어만 불러오기」).
//        앱은 지금 쓰는 말 사전만 i18nDict() 로 그때 읽는다. 사전은 파일 안에 그대로 있어 인터넷이 없어도 된다.
//   잰 것(크로미움 CPU 4배 느리게, 7번 중앙값): 본 코드 689ms → 429ms · 다시 켤 때 446 → 234ms.
//
// ★ 쓰는 법:  node tools/ship.js 원본.html 내보낼.html [대조표.json]   (같은 이름을 주면 그 자리에 덮어쓴다 — 깃허브 빌드에서만)
// ★ 오류 신고의 「index.html:줄:칸」 은 내보낸 파일 기준이다. 스택의 함수 이름은 그대로라 이름으로도 원본을 찾는다.
//   줄로 찾으려면: 같은 원본으로 이 도구를 대조표와 함께 다시 돌리고(늘 같은 결과가 나온다)
//     node tools/ship.js www/index.html /tmp/s.html /tmp/s.map.json
//     node tools/where.js /tmp/s.map.json 12:34567      → 원본 www/index.html 몇째 줄인지
'use strict';
const fs = require('fs');
let esbuild;
try{ esbuild = require('esbuild'); }catch(e){ console.error('::error::esbuild 가 없습니다 — npm i --no-save esbuild@0.24.0'); process.exit(1); }

const [, , IN, OUT, MAP] = process.argv;
if(!IN || !OUT){ console.error('쓰는 법: node tools/ship.js 원본.html 내보낼.html'); process.exit(1); }
const src = fs.readFileSync(IN, 'utf8');
const die = m => { console.error('::error::' + m); process.exit(1); };

// ── 따옴표·설명 글을 알아보며 짝 괄호 끝을 찾는다 ('{n}' 같은 글자 안 괄호에 속지 않게)
function braceEnd(s, open){
  let d = 0, q = null, esc = false;
  for(let k = open; k < s.length; k++){
    const c = s[k];
    if(q){
      if(esc) esc = false;
      else if(c === '\\') esc = true;
      else if(c === q) q = null;
      continue;
    }
    if(c === '"' || c === "'" || c === '`'){ q = c; continue; }
    if(c === '/' && s[k + 1] === '/'){ k = s.indexOf('\n', k); if(k < 0) return -1; continue; }
    if(c === '/' && s[k + 1] === '*'){ k = s.indexOf('*/', k + 2) + 1; if(k <= 0) return -1; continue; }
    if(c === '{') d++;
    else if(c === '}'){ d--; if(d === 0) return k; }
  }
  return -1;
}

// ── 앱 본체 script 칸 (속성 없는 script 중 I18N 이 든 것)
const re = /<script>/g;
let m, body = null;
while((m = re.exec(src))){
  const a = m.index + m[0].length, b = src.indexOf('</script>', a);
  if(b > a && src.slice(a, b).includes('const I18N = {')){ body = { tagAt: m.index, a, b }; break; }
}
if(!body) die('앱 본체 script 칸을 못 찾았습니다');
let js = src.slice(body.a, body.b);

// ── ② 사전을 꺼낸다
const i0 = js.indexOf('const I18N = {');
const e0 = braceEnd(js, js.indexOf('{', i0));
if(e0 < 0 || js[e0 + 1] !== ';') die('I18N 끝을 못 찾았습니다');
let dict;
try{ dict = new Function('return ' + js.slice(js.indexOf('{', i0), e0 + 1))(); }catch(e){ die('I18N 을 읽지 못했습니다: ' + e.message); }
const langs = Object.keys(dict).filter(k => k !== 'ko');
if(!langs.length) die('사전이 비었습니다');
const counts = {};
langs.forEach(k => { counts[k] = Object.keys(dict[k]).length; });
// 뺀 자리에 줄바꿈 수를 그대로 남긴다 — 그래야 대조표의 원본 줄 번호가 맞는다
const nl = (js.slice(i0, e0 + 2).match(/\n/g) || []).length;
js = js.slice(0, i0) + 'const I18N = { ko:{} };' + '\n'.repeat(nl) + js.slice(e0 + 2);
if(!/const I18N_N = null;/.test(js)) die('const I18N_N = null; 자리가 없습니다 (원본이 5.35 이전입니다)');
js = js.replace('const I18N_N = null;', 'const I18N_N = ' + JSON.stringify(counts) + ';');
if(!/function i18nDict\(v\)/.test(js)) die('i18nDict 가 없습니다');

// JSON 칸 — '<' 를 < 로 바꿔 </script>·<!-- 가 칸을 끊지 못하게 한다(JSON 으로는 같은 글자).
const blocks = langs.map(k =>
  '<script type="application/json" id="i18n-' + k + '">' + JSON.stringify(dict[k]).replace(/</g, '\\u003c') + '</script>'
).join('\n');

// ── ① 설명 글·빈칸 빼기 (이름은 그대로)
const strip = (code, what, map) => {
  try{
    const r = esbuild.transformSync(code, { loader: 'js', minifyWhitespace: true, legalComments: 'none', charset: 'utf8',
      sourcemap: map ? 'external' : false, sourcefile: 'main.js' });
    return map ? r : r.code;
  }catch(e){ die(what + ' 줄이기 실패: ' + e.message); }
};
const mainR = strip(js, '앱 본체', true);
const jsOut = mainR.code;
if(/<\/script/i.test(jsOut)) die('줄인 코드 안에 </script 가 생겼습니다');

let out = src.slice(0, body.tagAt) + blocks + '\n<script>' + jsOut + '</script>' + src.slice(body.b + '</script>'.length);

// btLook(머리 쪽 작은 칸)도 같이 줄인다
out = out.replace(/(<script id="btLook">)([\s\S]*?)(<\/script>)/, (all, a, code, c) => {
  const s2 = strip(code, 'btLook');
  if(/<\/script/i.test(s2)) die('btLook 안에 </script 가 생겼습니다');
  return a + s2 + c;
});

// ── 확인: 판 번호가 그대로 있는가 (안드로이드 build.gradle 이 이 줄을 읽는다)
const ver = (src.match(/const APP_VER = '([^']+)'/) || [])[1];
if(!ver) die('원본에 APP_VER 가 없습니다');
//   esbuild 는 큰따옴표로 다시 쓴다 → 원본 꼴(작은따옴표·띄어쓰기)로 되돌린다. build.gradle·워크플로가 이 꼴을 찾는다.
out = out.replace('const APP_VER="' + ver + '"', "const APP_VER = '" + ver + "'");
if(!out.includes("const APP_VER = '" + ver + "'")) die('내보낸 파일에서 APP_VER 줄이 사라졌습니다');

// ── 대조표 (원하면): 내보낸 파일의 본체 script 가 몇째 줄·몇째 칸에서 시작하나 + esbuild 대조표 + 원본 시작 줄
if(MAP){
  const lineCol = (s, at) => { const pre = s.slice(0, at); const L = pre.split('\n'); return { line: L.length, col: L[L.length - 1].length }; };
  const shipAt = out.indexOf('<script>' + jsOut.slice(0, 200)) + '<script>'.length;
  if(shipAt < '<script>'.length) die('대조표: 내보낸 파일에서 본체 자리를 못 찾았습니다');
  fs.writeFileSync(MAP, JSON.stringify({ ver, ship: lineCol(out, shipAt), orig: lineCol(src, body.a), map: JSON.parse(mainR.map) }));
}
fs.writeFileSync(OUT, out);
const kb = n => (n / 1024).toFixed(0) + 'KB';
console.log('[ship] ' + ver + ' · ' + kb(Buffer.byteLength(src)) + ' → ' + kb(Buffer.byteLength(out))
  + ' · 사전 ' + langs.map(k => k + ' ' + counts[k]).join(' · '));
