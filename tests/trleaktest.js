// 4.100 — 한글이 사전(t·tsub)을 안 지나고 화면으로 나가는 자리를 센다
//
// ★ 사장님: 「야이 씨발년아 그리고 여기 왜이렇게 번역안된게 많냐?」
//           「싹다 처음부터 끝까지 어플 다시 점검해」
//   한 자리씩 고쳐서는 끝이 안 난다. 켤 때마다 새로 나온다.
//   그래서 **앱 전체를 훑어서 새는 자리를 세는 검사**를 만들고,
//   그 수가 늘면 파일이 아예 못 나가게 막는다. (사장님이 정하신 것 12)
//
// ★ 어떻게 세나 — 정규식으로 대충 보면 놓치고 헛것도 잡는다.
//   자바스크립트를 한 글자씩 읽어서 주석·정규식·문자열·틀문자열(`)·${} 를 제대로 가른다.
const fs = require('fs');
const path = process.argv[2] || '/home/claude/work.html';
const s = fs.readFileSync(path, 'utf8');
const body = (s.match(/<script[^>]*>[\s\S]*?<\/script>/g) || [])
  .map(x => x.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''))
  .reduce((a, b) => a.length > b.length ? a : b, '');
const off = s.indexOf(body);
const lineOf = i => s.slice(0, off + i).split('\n').length;

// ── 사전 블록은 뺀다 (거기 한글은 사전 그 자체다)
function blockRange(name){
  const k = body.indexOf('const ' + name);
  if(k < 0) return null;
  const j = body.indexOf('{', k);
  let d = 0;
  for(let m = j; m < body.length; m++){
    if(body[m] === '{') d++;
    else if(body[m] === '}'){ d--; if(!d) return [k, m + 1]; }
  }
  return null;
}
// ★ 화면에 안 나가는 말 표는 뺀다 — 걸러 낼 욕설 목록이다.
//   이건 사람에게 보이는 글이 아니라 **거르는 잣대** 자체다. 옮기면 오히려 안 걸린다.
// ★ 자료 표는 뺀다 — 사전이 아니라 **다른 길로** 보는 사람 말이 되는 것들이다.
//   SPOT_SEED   정박지 이름은 nameFor(소리), 설명은 trWord(자동 번역) 를 지난다
//   LANGS       말 이름은 제 나라 말로 적는다 (日本語·한국어·English·Русский)
//   LEGAL_DOCS  약관은 나라별 판(EN·JA·RU)이 따로 있다
const SKIP = ['I18N', 'BAD_OK', 'BAD_WORDS', 'BAD_RU', 'BAD_EN', 'BAD_JA', 'SPOT_SEED', 'LANGS']
  .map(blockList).filter(Boolean)
  //   KANA_어두·KANA_어중 — 가나를 한글로 **읽는** 표다. 사전이 아니라 소리 대조표라
  //     옮길 것이 없다 (국립국어원 「가나와 한글 대조표」).
  //   CAL_DOW·CAL_MON — 요일·달 이름은 **사전으로 못 만든다.**
//     ① '일'·'월'·'수'·'금' 은 다른 뜻으로 이미 사전에 있어서, 요일로 넣으면 엉뚱하게 옮겨진다.
//     ② 사전은 {m} 자리에 숫자만 끼울 수 있어 영어의 「September 2026」 을 만들 길이 없다.
//     그래서 LANGS 와 같은 방식으로 언어별 표를 따로 둔다. 옮길 것이 아니라 이미 옮겨진 것이다.
  //   BORDER — 나라마다 「배로 들어올 수 있는 항」 목록이다. 법령 원문에서 그대로 옮긴
//     **고유명사**라 사전을 지나면 안 된다 — 인천항을 「Incheon Port」 로 바꿔 적으면
//     세관에 대고 보여 줄 수가 없다. 그 나라 적힌 대로 보여 준다(関門·Владивосток).
//     근거(law) 도 법 이름이라 같다.
  .concat(['KANA_어두', 'KANA_어중', 'I18N', 'CAL_DOW', 'CAL_MON', 'LEGAL_DOCS', 'LEGAL_DOCS_EN', 'LEGAL_DOCS_JA', 'LEGAL_DOCS_RU', 'BIZ_FMT', 'LBS_FMT', 'LEGAL_DATES', 'LEGAL_OWNER', 'LEGAL_BIZ', 'BORDER']
    .map(blockRange).filter(Boolean))
  //   calTitle — 달력 머리의 「2026년 9월」·「2026年9月」. 언어를 보고 제 나라 글자를
//     곧장 짜 넣는 자리다 (CAL_MON 과 한 짝). 사전을 지날 것이 아니다.
  // ★ 5.6 — errBody 도 같은 갈래다. 화면에 뜨는 말이 아니라 **오류 보고서 본문**이라
  //   내가 읽을 것이다 (붙는 데까지 · 로그인 여부 · 기기). 화면 한 줄은 errSay 를 지난다.
  .concat(['supportInfo', 'supportMail', 'calTitle', 'errBody'].map(funcRange).filter(Boolean));
// ★ 사장님(운영자)이 읽는 글은 한국어로 둔다 —
//   고객센터로 가는 기기 정보·메일 본문이다. 이것을 러시아어로 옮기면
//   받는 사람이 못 읽는다. 화면에 잠깐 보이지만 **보내는 글**이다.
function funcRange(name){
  const k = body.indexOf('function ' + name + '(');
  if(k < 0) return null;
  let d = 0;
  const st = body.indexOf('{', k);
  for(let m = st; m < body.length; m++){
    if(body[m] === '{') d++;
    else if(body[m] === '}'){ d--; if(!d) return [k, m + 1]; }
  }
  return null;
}
function blockList(name){
  const k = body.indexOf('const ' + name);
  if(k < 0) return null;
  const st = body.indexOf('[', k);
  if(st < 0) return null;
  let d = 0;
  for(let m = st; m < body.length; m++){
    if(body[m] === '[') d++;
    else if(body[m] === ']'){ d--; if(!d) return [k, m + 1]; }
  }
  return null;
}
const skipped = i => SKIP.some(r => i >= r[0] && i < r[1]);

// ── 사전에 실려 있는 말인가
//   자료표(고르는 칸의 이름·설명 같은 것)는 그리는 쪽에서 t() 를 지난다.
//   그런 말은 **사전에 실려 있으면** 새는 것이 아니다.
//   사전에도 없고 t() 도 안 지나면 그 말은 어느 나라 말로 켜도 한국어로 남는다.
const DICT = (function(){
  const r = blockRange('I18N');
  if(!r) return new Set();
  const blk = body.slice(r[0], r[1]);
  const out = new Set();
  ['en', 'ru', 'ja'].forEach(lang => {
    const k = blk.indexOf('\n  ' + lang + ': {');
    if(k < 0) return;
    let d = 0, st = blk.indexOf('{', k), en = st;
    for(let m = st; m < blk.length; m++){
      if(blk[m] === '{') d++;
      else if(blk[m] === '}'){ d--; if(!d){ en = m + 1; break; } }
    }
    const sub = blk.slice(st, en);
    const re1 = /'((?:[^'\\]|\\.)*)'\s*:/g, re2 = /"((?:[^"\\]|\\.)*)"\s*:/g;
    let m2;
    while((m2 = re1.exec(sub))) out.add(m2[1].replace(/\\'/g, "'").replace(/\\n/g, '\n').replace(/\\\\/g, '\\'));
    while((m2 = re2.exec(sub))) out.add(m2[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\'));
  });
  return out;
})();

const HAN = /[가-힣]/;
// ★ 글자 그대로 되살린다 — \n 을 'n' 으로 읽으면 사전 열쇠가 어긋난다
const ESC = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', '0': '\0' };
function unesc(c){ return Object.prototype.hasOwnProperty.call(ESC, c) ? ESC[c] : c; }
const found = [];

function isRegexPos(i){
  let j = i - 1;
  while(j >= 0 && /\s/.test(body[j])) j--;
  if(j < 0) return true;
  return !/[A-Za-z0-9_$)\]]/.test(body[j]);
}
// ★ 틀문자열 안의 onclick="…" 같은 자리는 **또 다른 코드**다.
//   거기 든 한글(needEdit('장비를 넣습니다.') 같은 것)은 그 함수가 사전을 지나므로
//   따로 재야 한다. 통째로 보면 틀 하나가 통으로 걸려 어디가 문제인지 알 수 없다.
function eatAttrJs(st, buf){
  return buf.replace(/\son[a-z]+="([^"]*)"/g, function(all, inner){
    const re = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g;
    let m;
    while((m = re.exec(inner))){
      const v = (m[1] != null ? m[1] : m[2]).replace(/\\'/g, "'").replace(/&#39;/g, "'");
      if(!HAN.test(v)) continue;
      if(DICT.has(v.trim())) continue;
      const before = inner.slice(Math.max(0, m.index - 30), m.index);
      if(/(?:^|[^A-Za-z0-9_$.])(t|tsub|tOr)\(\s*$/.test(before)) continue;
      found.push({ line: lineOf(st), text: v.slice(0, 120), pre: '<= ' + before.slice(-30) });
    }
    return ' ';
  });
}
function take(st, buf){
  if(skipped(st)) return;
  if(!HAN.test(buf)) return;
  buf = eatAttrJs(st, buf);
  if(!HAN.test(buf)) return;
  const pre = body.slice(Math.max(0, st - 60), st);
  if(/(?:^|[^A-Za-z0-9_$.])(t|tsub|tOr)\s*\(\s*$/.test(pre)) return;   // 사전을 지난다
  // ★ 화면에 안 나가는 자리 — 개발자 기록(console)은 사람이 보는 글이 아니다
  if(/console\.(log|warn|error|info)\s*\([^)]*$/.test(pre)) return;
  // ★ 조사 고르기 — '은/는' 은 낱말이 아니라 **문법 조각**이다.
  //   사전에 넣을 것이 아니라 한국어 틀 안에서만 쓰인다 (josa 가 고른다).
  if(/josa\s*\([^()]*$/.test(pre)) return;
  if(DICT.has(buf) || DICT.has(buf.trim())) return;                     // 사전에 실려 있다
  found.push({ line: lineOf(st), text: buf,
               pre: pre.slice(-40).replace(/\n/g, ' ') });
}
// ── 한 덩이씩 읽어 나간다. 주석·정규식·문자열·틀문자열을 다 가른다.
//   ★ ${ } 안도 **같은 함수**로 읽는다. 따로 쓰면 반드시 어긋난다 —
//     실제로 `.replace(/'/g, "\\'")` 의 정규식 속 따옴표에 속아 코드를 글로 잡았다.
function readStr(i, q, end){
  let j = i + 1, buf = '';
  for(; j < end; j++){
    if(body[j] === '\\'){ buf += unesc(body[j + 1] || ''); j++; continue; }
    if(body[j] === q || body[j] === '\n') break;
    buf += body[j];
  }
  take(i, buf);
  return j + 1;
}
function readRe(i, end){
  let j = i + 1, cls = false;
  for(; j < end; j++){
    if(body[j] === '\\'){ j++; continue; }
    if(body[j] === '[') cls = true;
    else if(body[j] === ']') cls = false;
    else if(body[j] === '\n') break;
    else if(body[j] === '/' && !cls) break;
  }
  return j + 1;
}
function readTpl(i, end){
  let j = i + 1, buf = '';
  for(; j < end; j++){
    if(body[j] === '\\'){ buf += unesc(body[j + 1] || ''); j++; continue; }
    if(body[j] === '$' && body[j + 1] === '{'){
      const k = walk(j + 2, end, true);
      buf += ' ';
      j = k - 1;
      continue;
    }
    if(body[j] === '`') break;
    buf += body[j];
  }
  take(i, buf);
  return j + 1;
}
// inSub 이면 짝이 맞는 '}' 를 만나는 자리에서 멈추고 그 다음 자리를 돌려준다
function walk(i, end, inSub){
  let d = 0;
  while(i < end){
    const c = body[i];
    if(c === '/' && body[i + 1] === '/'){ const z = body.indexOf('\n', i); i = z < 0 ? end : z; continue; }
    if(c === '/' && body[i + 1] === '*'){ const z = body.indexOf('*/', i + 2); i = z < 0 ? end : z + 2; continue; }
    if(c === '/' && isRegexPos(i)){ i = readRe(i, end); continue; }
    if(c === "'" || c === '"'){ i = readStr(i, c, end); continue; }
    if(c === '`'){ i = readTpl(i, end); continue; }
    if(inSub){
      if(c === '{'){ d++; i++; continue; }
      if(c === '}'){ if(d === 0) return i + 1; d--; i++; continue; }
    }
    i++;
  }
  return i;
}
walk(0, body.length, false);

// ── 사전을 안 지나도 되는 자리 (까닭이 있는 것만)
const OK = [
  /^[\s\u00b7:()\[\]{}<>\/|,.\-\u2013\u2014~+*#%@=&?!'"`\d]*$/,   // 글자가 아닌 것
  // ★ 글 안에 그대로 박히는 **표시**다. 정규식으로 다시 읽어 사진을 끼운다.
  //   옮기면 글과 사진이 어긋난다 — 안 옮기는 것이 맞다.
  /^<b>\[사진1\]<\/b>$/,
  /^\[사진$/,
  // ★ 사장님(운영자)에게 보내는 메일 본문. 러시아어로 옮기면 받는 분이 못 읽는다.
  /^옮긴 글 \(허락 필요\)$/,
  /^그동안 쓴 글: $/
];
const leaks = found.filter(f => !OK.some(r => r.test(f.text)));
const uniq = new Map();
leaks.forEach(f => { if(!uniq.has(f.text)) uniq.set(f.text, f); });

const LIMIT = Number(process.env.TR_LIMIT || 0);
console.log('사전을 안 지나는 한글: ' + leaks.length + '곳 (서로 다른 글 ' + uniq.size + '개)');
leaks.slice(0, 8).forEach(x => console.log('   ' + JSON.stringify(x).slice(0, 200)));
if(process.env.TR_LIST){
  Array.from(uniq.values()).sort((a, b) => a.line - b.line)
    .forEach(f => console.log(f.line + '\t' + f.text.replace(/\n/g, '\\n').replace(/\t/g, ' ') + '\t<= ' + f.pre));
}
if(process.env.TR_JSON){
  require('fs').writeFileSync(process.env.TR_JSON,
    JSON.stringify(Array.from(uniq.values()).sort((a, b) => a.line - b.line).map(f => f.text), null, 0));
}
if(leaks.length > LIMIT){
  console.log('★ 실패: ' + leaks.length + '곳이 사전을 안 지납니다 (허용 ' + LIMIT + ')');
  process.exitCode = 1;
}else{
  console.log('trleaktest: 통과');
}
