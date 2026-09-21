// 낱말이 「어느 자리에서」 쓰이는지 뽑아 낸다 (4.115)
//
// ★★★ 왜 이것을 만드나 — 사장님 지적, 2026-09-08
//   「지금 반복해서 찐빠가 나는 이유가 니가 일하는 방식이 틀렸을 수도 있으니」
//
//   맞는 말씀이다. 여태 번역을 볼 때 나는 **한국어 낱말만** 보고 있었다.
//   사전은 「한국어 문장 → 세 나라말」 이라, 그 낱말이 화면 어디에 쓰이는지가 없다.
//   그래서 이런 것들을 틀렸다 — 전부 「자리를 몰라서」 난 흠이다.
//
//     · 「열기」  → 물고기(볼락)인데 일본어로 開く(열다)
//     · 「자리」  → 사람 태울 자리인데 일본어로 桁(자릿수)
//     · 「세우기」 → 임명인데 일본어로 停止(정지)
//     · 「내보내기」→ 회원 제명인데 일본어로 書き出し(파일 내보내기)
//     · 「잔량」  → 남은 기름인데 영어로 range(항속거리)
//     · 「앱 창고」→ 저장소인데 영어로 app store(앱 마켓)
//
//   낱말만 보면 어느 쪽도 맞다. **자리를 봐야 갈린다.**
//   그러니 자리를 붙여서 봐야 한다. 그것을 사람이 기억으로 하면 또 틀린다 — 뽑아낸다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');

// 사전
function dicts(){
  const i = src.indexOf('const I18N = {');
  let d = 0, j = src.indexOf('{', i), k;
  for(k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0){ k++; break; } }
  }
  const g = {};
  (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g);
  return { I: g.I18N, dictEnd: k, dictStart: i };
}
const { I, dictStart, dictEnd } = dicts();

// 사전 바깥만 본다 — 사전 안에서 열쇠를 또 찾으면 자리가 아니라 제 이름을 가리킨다
const body = src.slice(0, dictStart) + '\n'.repeat(0) + src.slice(dictEnd);
const OFF = dictEnd - dictStart;   // 자리 셈 보정용 (안 씀, 참고)

// 줄마다 「이 줄이 어느 함수 안인가」 를 미리 매겨 둔다
const lines = body.split('\n');
const fnAt = new Array(lines.length).fill('');
{
  let cur = '', depth = 0, curDepth = -1;
  for(let i = 0; i < lines.length; i++){
    const ln = lines[i];
    const m = ln.match(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/)
           || ln.match(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\()/);
    if(m && depth <= (curDepth < 0 ? 0 : curDepth)){ cur = m[1]; curDepth = depth; }
    fnAt[i] = cur;
    for(const ch of ln){ if(ch === '{') depth++; else if(ch === '}'){ depth--; if(depth <= curDepth){ /* 함수가 끝났을 수 있다 */ } } }
    if(depth <= 0){ cur = ''; curDepth = -1; depth = Math.max(0, depth); }
  }
}
// 줄 시작 위치
const lineStart = [];
{ let p = 0; for(const ln of lines){ lineStart.push(p); p += ln.length + 1; } }
const lineOf = pos => {
  let lo = 0, hi = lineStart.length - 1;
  while(lo < hi){ const mid = (lo + hi + 1) >> 1; if(lineStart[mid] <= pos) lo = mid; else hi = mid - 1; }
  return lo;
};

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const out = {};
const 열쇠들 = Object.keys(I.en);

for(const key of 열쇠들){
  const 자리 = [];
  // t('키') · tsub('키' · data-t="키" · name:'키' · '키' 가 목록 안에 있는 경우
  const pats = [
    new RegExp("t\\('" + esc(key.replace(/'/g, "\\'").replace(/\n/g, '\\n')) + "'\\)", 'g'),
    new RegExp("tsub\\('" + esc(key.replace(/'/g, "\\'").replace(/\n/g, '\\n')) + "'", 'g'),
    new RegExp('data-t="' + esc(key) + '"', 'g'),
    new RegExp("'" + esc(key.replace(/'/g, "\\'").replace(/\n/g, '\\n')) + "'", 'g')
  ];
  // ★ 갈래 하나에서 찾았다고 그만두지 않는다 — **한 낱말이 여러 화면에서 쓰이는 것**이
  //   바로 위험한 자리라서, 그것을 세려면 다 모아야 한다.
  const 본함수 = new Set();
  for(let pi = 0; pi < pats.length; pi++){
    let m;
    while((m = pats[pi].exec(body))){
      const li = lineOf(m.index);
      const fn = fnAt[li] || '(바깥)';
      if(본함수.has(fn)) continue;
      본함수.add(fn);
      자리.push({ fn, 줄: lines[li].trim().slice(0, 150), 갈래: pi === 3 ? '목록/변수' : '부름' });
      if(자리.length >= 5) break;
    }
    if(자리.length >= 5) break;
  }
  out[key] = 자리;
}

const 못찾음 = 열쇠들.filter(k => !out[k].length);
console.log('열쇠 ' + 열쇠들.length + '개 · 자리 찾음 ' + (열쇠들.length - 못찾음.length) + ' · 못 찾음 ' + 못찾음.length);
fs.writeFileSync('/tmp/ctxmap.json', JSON.stringify(out));
fs.writeFileSync('/tmp/ctxmiss.txt', 못찾음.join('\n'));

// 사람이(그리고 검수하는 쪽이) 읽을 모양으로도 낸다
const rows = 열쇠들.map((k, n) => {
  const c = out[k][0];
  const 여럿 = out[k].length > 1 ? ('  ★자리 ' + out[k].length + '곳') : '';
  return '§' + (n + 1) + 여럿 + '\nKO ' + JSON.stringify(k)
       + '\nEN ' + JSON.stringify(I.en[k])
       + '\nRU ' + JSON.stringify(I.ru[k])
       + '\nJA ' + JSON.stringify(I.ja[k])
       + '\n자리 ' + (out[k].length ? out[k].map(z => z.fn + ' — ' + z.줄).join('\n     ') : '(못 찾음)');
});
fs.writeFileSync('/tmp/ctx.txt', rows.join('\n'));
console.log('/tmp/ctx.txt 에 자리를 붙여 적었습니다');

// ★★★ 위험 목록 — 한 한국어 낱말이 **서로 다른 화면 여러 곳**에서 쓰이는 것.
//   한 가지 번역으로 그 여러 자리가 다 맞는지는 결코 저절로 되지 않는다.
//   「선택」 이 그랬다 — 물품 차림표에서는 「고르기」, 설정 화면에서는 「고르기」 인데
//   사전에는 optional(선택 사항) 로 들어가 있었다. 낱말만 보면 둘 다 그럴듯하다.
const 여러자리 = 열쇠들.filter(k => out[k].length > 1)
  .sort((a, b) => out[b].length - out[a].length);
fs.writeFileSync('/tmp/ctxmulti.txt', 여러자리.map(k =>
  'KO ' + JSON.stringify(k) + '  (' + out[k].length + '곳)'
  + '\n  EN ' + JSON.stringify(I.en[k]) + '\n  RU ' + JSON.stringify(I.ru[k]) + '\n  JA ' + JSON.stringify(I.ja[k])
  + '\n  ' + out[k].map(z => z.fn + ' — ' + z.줄.slice(0, 110)).join('\n  ')).join('\n\n'));
console.log('★ 여러 화면에서 쓰이는 낱말 ' + 여러자리.length + '개 → /tmp/ctxmulti.txt');

// ★ 짧은 낱말일수록 자리에 따라 뜻이 갈린다. 그중 여러 자리에 쓰이는 것이 제일 위험하다.
const 위험 = 여러자리.filter(k => k.length <= 8 && !/\{/.test(k));
fs.writeFileSync('/tmp/ctxrisk.txt', 위험.map(k =>
  'KO ' + JSON.stringify(k) + '  (' + out[k].length + '곳)'
  + '\n  EN ' + JSON.stringify(I.en[k]) + '\n  RU ' + JSON.stringify(I.ru[k]) + '\n  JA ' + JSON.stringify(I.ja[k])
  + '\n  ' + out[k].map(z => z.fn + ' — ' + z.줄.slice(0, 110)).join('\n  ')).join('\n\n'));
console.log('★★ 그중 짧은 낱말(8자 이하) ' + 위험.length + '개 → /tmp/ctxrisk.txt');
