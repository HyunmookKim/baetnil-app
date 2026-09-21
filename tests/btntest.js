// 4.100 — 앱 안의 모든 단추를 훑는다 (사장님 지적)
//
// ★ 사장님 말씀: "버튼 어플에 있는거 좆같은거 확인해라니까 그대로 뒀네"
//   사장님이 정하신 것 1번에 이미 적혀 있다 —
//   「적재표: 줄마다 단추 넷을 늘 띄워 둠 (25줄 = 단추 100개, 크기 26×18)」
//   그때 적재표만 고치고 **다른 화면은 안 봤다.** 체크리스트가 똑같았다.
//
// ★ 이 검사가 지키는 것
//   ① 글자 없는 그림 단추는 **무슨 단추인지 말해 줘야 한다** (aria-label 이나 title)
//      — 화면에도 안 적히고 읽어 주지도 않으면 그건 아무도 못 쓰는 단추다
//   ② 단추 크기는 사장님이 정하신 38px 아래로 안 내려간다
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; } else { bad++;
  console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 600) : '')); } };

// 큰 글 덩이(Quill 같은 남의 코드)는 뺀다
const app = src.slice(0, src.indexOf('!function(t,e){"object"=='));

// 단추 하나하나를 뜯는다
const re = /<button\b([^>]*)>([\s\S]*?)<\/button>/g;
const 벌거벗은 = [];
let m, n = 0;
while((m = re.exec(app))){
  n++;
  const attr = m[1], inner = m[2];
  // 안에 든 글자 (템플릿 자리와 태그를 뺀다)
  const txt = inner.replace(/\$\{[\s\S]*?\}/g, '').replace(/<[^>]*>/g, '').trim();
  if(txt) continue;                                   // 글자가 있으면 됐다
  // 자리(${...})가 있으면 거기서 글자가 나온다.
  // ★ 다만 **그림 하나만 갈아 끼우는 것**은 글자가 아니다 —
  //   ${on?'▲':'▼'} 처럼 자리의 값이 전부 한두 글자짜리 기호면 글자로 안 본다.
  //   값이 표를 뒤지거나 함수를 부르는 것이면 거기서 사람이 읽을 말이 나온다.
  const slots = inner.match(/\$\{[\s\S]*?\}/g) || [];
  if(slots.length){
    const 기호뿐 = slots.every(sl => {
      const lits = sl.match(/'([^']*)'|"([^"]*)"/g) || [];
      const other = sl.slice(2, -1).replace(/'[^']*'|"[^"]*"/g, '')
                      .replace(/[\s?:()!&|+]|===|==|\d/g, '');
      if(other) return false;                 // 표를 뒤지거나 함수를 부른다 → 글자가 나온다
      if(!lits.length) return false;
      return lits.every(l => l.replace(/['"]/g, '').trim().length <= 2);
    });
    if(!기호뿐) continue;
  }
  if(/aria-label\s*=/.test(attr) || /title\s*=/.test(attr)) continue;   // 말해 준다
  const 앞 = app.slice(Math.max(0, m.index - 60), m.index).split('\n').pop();
  벌거벗은.push((앞 + m[0]).replace(/\s+/g, ' ').slice(0, 150));
}
T('단추를 다 세었다', n > 200, n + '개');
T('★★★ 무슨 단추인지 안 알려 주는 그림 단추가 없다',
  벌거벗은.length === 0,
  벌거벗은.length + '개\n   ' + 벌거벗은.slice(0, 40).join('\n   '));

// 크기 — 사장님이 정하신 38px
const 작은 = [];
const css = /\.([\w-]+)[^{}]*\{([^{}]*)\}/g;
let c;
while((c = css.exec(app.slice(0, app.indexOf('</style>'))))){
  const body = c[2];
  if(!/button|minib|chip|iconb/i.test(c[0])) continue;
  const h = /(?:min-)?height:\s*([\d.]+)px/.exec(body);
  const w = /(?:min-)?width:\s*([\d.]+)px/.exec(body);
  if(h && Number(h[1]) < 38 && /button/.test(c[0])) 작은.push(c[0].replace(/\s+/g,' ').slice(0,110));
  if(w && Number(w[1]) < 30 && /button/.test(c[0])) 작은.push(c[0].replace(/\s+/g,' ').slice(0,110));
}
T('★★ 단추가 너무 작지 않다 (38px · 도면 확대 단추는 뺀다)',
  작은.filter(x => !/mapzoom|mrzoom/.test(x)).length === 0,
  작은.length + '개\n   ' + 작은.slice(0, 20).join('\n   '));

console.log(`btntest: ${ok} 통과, ${bad} 실패`);
process.exit(bad ? 1 : 0);
