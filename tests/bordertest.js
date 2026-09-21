// 나라를 건너는 배 — 「어느 항으로 들어올 수 있나」 안내
//
// ★ 사장님 지적 (2026-09-16): 「러시아 사람도 쓸 거 아니야. 그럼 거기에 안내를 하면 되지」
//   이 앱은 네 나라 말로 나가고 정박지는 세 나라 것을 담는데,
//   「이 나라에 배로 들어올 때 어디로 들어오느냐」 를 한 글자도 안 적고 있었다.
//   모르고 아무 항에나 대면 밀항이 된다.
//
// ★ 목록은 법령 원문에서 그대로 옮긴 것이다. 하나라도 어긋나면 실패한다.
//   한국 25곳 — 관세법 시행령 제155조
//   일본 118곳 — 関税法施行令 別表第一
//   러시아 8곳 — 연해주 해상 검문소 (Росгранстрой)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, x) => { if(c){ ok++; } else { bad++; console.log('★ 실패: ' + n + (x===undefined?'':' — '+JSON.stringify(x).slice(0,200))); } };

function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, st = false;
  for(let j = i; j < src.length; j++){
    const c = src[j];
    if(c === '{'){ d++; st = true; }
    else if(c === '}'){ d--; if(st && d === 0) return src.slice(i, j+1); }
  }
  return '';
}
// BORDER 표를 통째로 잘라 낸다
const bi = src.indexOf('const BORDER = {');
const bj = src.indexOf('\n};', bi);
const BSRC = bi > 0 ? src.slice(bi, bj + 3) : '';
T('BORDER 표가 있다', !!BSRC);
let B = null;
try{ B = new Function(BSRC + '\nreturn BORDER;')(); }catch(e){ console.log('★ 실패: BORDER 를 읽지 못했습니다 — ' + e.message); bad++; }

if(B){
  // ── 세 나라가 다 있다
  ['kr','jp','ru'].forEach(cc => T('나라가 있다 — ' + cc, !!B[cc]));

  // ── 곳 수가 법령과 같다
  T('★★★ 한국 국제항 25곳', B.kr.ports.length === 25, B.kr.ports.length);
  T('★★★ 일본 開港 118곳',  B.jp.ports.length === 118, B.jp.ports.length);
  T('★★★ 러시아 연해주 해상 검문소 8곳', B.ru.ports.length === 8, B.ru.ports.length);

  // ── 반드시 들어 있어야 하는 것 (사장님 배가 있는 여수, 건너갈 곳)
  T('★★★ 여수항이 들어 있다', B.kr.ports.indexOf('여수항') >= 0);
  T('★ 부산항·인천항·제주항이 들어 있다',
    ['부산항','인천항','제주항'].every(x => B.kr.ports.indexOf(x) >= 0));
  T('★★★ 블라디보스토크가 들어 있다', B.ru.ports.indexOf('Владивосток') >= 0);
  T('★ 일본 쪽 첫 기항지로 흔한 곳들이 들어 있다',
    ['博多','厳原','境','下関'].filter(x => B.jp.ports.indexOf(x) >= 0).length >= 2, B.jp.ports.slice(0,3));

  // ── 이름이 비거나 겹치지 않는다
  ['kr','jp','ru'].forEach(cc => {
    T('빈 이름이 없다 — ' + cc, B[cc].ports.every(x => x && x.trim()));
    T('같은 이름이 두 번 안 나온다 — ' + cc, new Set(B[cc].ports).size === B[cc].ports.length);
  });

  // ── 근거를 반드시 적는다 (어디서 왔는지 모르는 법 안내는 위험하다)
  ['kr','jp','ru'].forEach(cc => T('★ 근거가 적혀 있다 — ' + cc, !!(B[cc].law && B[cc].law.length > 5), B[cc].law));
  T('★ 한국 근거가 관세법 시행령이다', /관세법 시행령 제155조/.test(B.kr.law), B.kr.law);
  T('★ 일본 근거가 関税法施行令 別表第一 이다', /関税法施行令/.test(B.jp.law) && /別表第一/.test(B.jp.law), B.jp.law);
  // ★ 근거 줄은 사전을 안 지난다 — 그 나라 글자로만 적어야 다른 말 쓰는 사람도 그대로 찾는다
  T('★ 러시아 근거에 한국어가 섞여 있지 않다', !/[가-힣]/.test(B.ru.law), B.ru.law);
  T('★ 일본 근거에 한국어가 섞여 있지 않다', !/[가-힣]/.test(B.jp.law), B.jp.law);
}

// ── 화면에 붙는 자리
const line = grab('borderLine');
T('borderLine() 이 있다', !!line);
T('★ 모르는 나라면 아무것도 안 그린다', /if\(!b\) return '';/.test(line), line.slice(0,120));
T('★ 자세히 보는 단추를 단다', /helpBtn\('border_' \+ cc\)/.test(line));
T('★★★ 정박지 화면이 그 줄을 부른다', /\+ borderLine\(spotCc\)/.test(src));

const help = grab('borderHelp');
T('borderHelp() 가 있다', !!help);
T('★ 목록을 다 보여 준다', /b\.ports\.map/.test(help));
T('★★★ 여기 없는 항으로 가려면 허가가 필요하다고 알려 준다',
  /여기 없는 항으로 들어오려면 미리 세관의 허가를 받아야 합니다\./.test(help));
T('★★★ 법이 바뀔 수 있다고 알려 준다', /법이 바뀔 수 있습니다/.test(help));
T('★ 도움말 문이 border_ 를 받는다', /key\.startsWith\('border_'\)/.test(src));

// ── 네 말에 다 들어가 있다 (한 말만 고치면 그 말 쓰는 사람에게는 안 고쳐진 것이다)
const need = [
  '다른 국가에서 배로 들어올 때는 정해진 항으로만 들어올 수 있습니다.',
  '들어올 수 있는 항 {n}곳',
  '여기 없는 항으로 들어오려면 미리 세관의 허가를 받아야 합니다.',
  '근거',
  '대한민국에 배로 들어올 때', '일본에 배로 들어올 때', '러시아에 배로 들어올 때'
];
const L = src.split('\n');
const at = re => L.findIndex(l => re.test(l)) + 1;
const en = at(/^  en\s*:\s*\{/), ru = at(/^  ru\s*:\s*\{/), ja = at(/^  ja\s*:\s*\{/);
const blocks = { en: L.slice(en-1, ru).join('\n'), ru: L.slice(ru-1, ja).join('\n'), ja: L.slice(ja-1).join('\n') };
need.forEach(k => {
  ['en','ru','ja'].forEach(lang => {
    T('★ ' + lang + ' 에 있다 — ' + k.slice(0,18), blocks[lang].indexOf("'" + k + "':") >= 0);
  });
});

console.log(`\n${ok}/${ok+bad} 통과`);
process.exit(bad ? 1 : 0);
