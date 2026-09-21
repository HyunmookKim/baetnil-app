// 표가 만들어지는가 · 붙여넣은 표가 살아남는가 (4.113)
//
// ★ 왜 이 검사가 있나 — 사장님이 잡아 주셨다. 2026-09-08
//   「야 심각한 문제가 있다. 표가 안 만들어지네」
//   러시아 요트 기사(ChatGPT·DeepSeek·GigaChat 을 견준 표)를 글판에 붙여넣으셨는데,
//   표가 통째로 풀려서 「46/50 · 22/50 · 23/50 · 10/10 …」 하고 숫자만 줄줄이 늘어섰다.
//   어느 숫자가 어느 칸인지 알 수 없으니 **읽을 수 없는 글**이 됐다.
//   그 위에 도구줄에 표 단추가 없어서 **표를 만들 길 자체가 없었다.**
//
// ★ 왜 그랬나
//   편집기(Quill)에 「받을 서식」 을 여섯 가지로 못 박아 두었고 표는 그 목록에 없었다.
//   붙여넣기를 가르는 자리(pasteParts)도 </tr> 를 줄바꿈으로 바꾸고 꼬리표를 다 벗겼다.
//   그때는 그게 맞았다 — 남의 표가 화면을 망가뜨리지 않게 막은 것이다.
//   이제는 **우리 것으로 받아서** 우리 모양으로 그린다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 300) : '')); } };
function grab(name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}

// ── ① 표를 다루는 문이 다 있는가
// ★★★ 4.118 — 따로 창을 띄우던 방식(tblOpen/tblClose/tblGrab/tblDraw/tblSave…)을 걷어내고
//   칸을 누르면 **그 자리에서** 고치게 바꿨다 (사장님 지적: 「워드패드는 표 그릴 때 창이 나오냐?」).
//   그래서 보아야 할 문이 달라졌다 — 창을 여닫는 문이 아니라, 제자리에서 고치는 문이다.
const 문 = ['tblNorm','tblHtml','tblText','tblFromText','tblFromNode','tblPack',
            'qlTableInit','richTable',
            'tblBarHtml','tblRead','tblSync','tblDo','tblWire',
            'tblFocusOn','tblCaret','tblCellAt','tblPos','tblMakeCell','tblFidOf'];
문.forEach(f => T('①-' + f + ' 있다', !!grab(f)));

// ── ② 순수한 셈만 실제로 돌려 본다 (DOM 이 필요 없는 것들)
const 셈 = {};
try{
  const 밑 = `
    const esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    const richText = h => String(h == null ? '' : h).replace(/<br\\s*\\/?>/gi,'\\n')
      .replace(/<[^>]*>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>')
      .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
    const richSafe = h => String(h == null ? '' : h);
  `;
  const 몸 = ['TBL_MAX_COL','TBL_MAX_ROW','TBL_SEP'].map(k => {
    const i = src.indexOf('const ' + k + ' =');
    return i < 0 ? '' : src.slice(i, src.indexOf('\n', i));
  }).join('\n') + '\n'
    + ['tblNorm','tblHtml','tblText','tblFromText'].map(grab).join('\n');
  new Function('OUT', 밑 + 몸 + ';OUT.tblNorm=tblNorm;OUT.tblHtml=tblHtml;OUT.tblText=tblText;OUT.tblFromText=tblFromText;')(셈);
}catch(e){ console.log('★ 셈을 못 세웠다: ' + e.message); }
T('②-0 표 셈을 꺼내 돌릴 수 있다', !!셈.tblNorm);

if(셈.tblNorm){
  const N = 셈.tblNorm, H = 셈.tblHtml, X = 셈.tblText, F = 셈.tblFromText;
  // 들쭉날쭉한 줄을 반듯하게 맞추는가 — 안 맞추면 표가 아니라 무너진 격자가 된다
  const a = N({ head:1, rows:[['가','나','다'],['1'],['1','2']] });
  T('②-1 ★★ 줄마다 칸 수를 맞춘다', a.rows.every(r => r.length === 3), JSON.stringify(a.rows));
  T('②-2 제목줄 표시가 남는다', a.head === 1);
  // 글자로 들어와도 받는다 (편집기가 돌려주는 모양이 글자다)
  const b = N(JSON.stringify({ head:0, rows:[['ㄱ','ㄴ']] }));
  T('②-3 ★ 글자로 들어온 표도 받는다', b.rows[0][0] === 'ㄱ', JSON.stringify(b));
  // 빈 것도 표 모양은 나와야 한다 — null 을 돌려주면 화면이 깨진다
  T('②-4 ★ 빈 것을 줘도 표 모양이 나온다', N(null).rows.length >= 1 && N(null).rows[0].length >= 1);
  // 한도
  const wide = N({ rows:[ new Array(40).fill('x') ] });
  T('②-5 ★ 칸이 한도를 넘지 않는다', wide.rows[0].length <= 12, wide.rows[0].length);
  const tall = N({ rows: new Array(200).fill(['x']) });
  T('②-6 ★ 줄이 한도를 넘지 않는다', tall.rows.length <= 60, tall.rows.length);

  // 그리기
  const h = H({ head:1, rows:[['이름','값'],['출처','9/10']] });
  T('②-7 ★★ 진짜 <table> 로 그린다', /<table[^>]*>/.test(h) && /<\/table>/.test(h), h.slice(0,80));
  T('②-8 ★★ 제목줄은 <th> 로 그린다', /<th>이름<\/th>/.test(h), h.slice(0,160));
  T('②-9 ★ 나머지는 <td> 로 그린다', /<td>출처<\/td>/.test(h));
  T('②-10 ★★ 넓은 표는 표만 옆으로 밀린다 (화면 몸통이 밀리면 고장으로 보인다)',
    /class="pbtwrap"/.test(h) && /\.pbtwrap\{[^}]*overflow-x:auto/.test(src));
  const h2 = H({ head:0, rows:[['이름','값']] });
  T('②-11 ★ 제목줄이 없으면 <th> 를 안 쓴다', h2.indexOf('<th>') < 0);

  // 글자로 뽑기 — 본문·찾기·번역이 이 모양으로 실려 나간다
  const x = X({ head:1, rows:[['이름','값'],['출처','9/10']] });
  T('②-12 ★★ 칸은 " | " 로, 줄은 줄바꿈으로 잇는다', x === '이름 | 값\n출처 | 9/10', JSON.stringify(x));
  T('②-13 ★★★ 덩이 하나 안에 빈 줄을 만들지 않는다 (빈 줄은 덩이를 가르는 표시다)',
    !/\n\n/.test(X({ rows:[['가','나'],['',''],['다','라']] })));
  T('②-14 ★ 꼬리표를 벗겨서 뽑는다', X({ rows:[['<b>굵게</b>','x']] }).indexOf('<b>') < 0);

  // 번역해 온 것을 도로 표로
  const f = F('Name | Value\nSource | 9/10', { head:1, rows:[['이름','값'],['출처','9/10']] });
  T('②-15 ★★★ 옮겨 온 글자가 표로 돌아온다',
    f.rows.length === 2 && f.rows[0][0] === 'Name' && f.rows[1][1] === '9/10', JSON.stringify(f.rows));
  T('②-16 ★ 제목줄 표시도 따라온다', f.head === 1);
  // 칸이 모자라게 와도 원래 넓이를 지킨다 — 안 지키면 표가 어긋난다
  const f2 = F('Name\nSource | 9/10', { head:0, rows:[['이름','값'],['출처','9/10']] });
  T('②-17 ★★ 칸이 모자라게 와도 넓이를 지킨다',
    f2.rows.every(r => r.length === 2), JSON.stringify(f2.rows));
  // 아무것도 안 왔으면 원래 표를 지킨다 — 빈 표로 갈아 끼우면 글이 사라진 화면이 된다
  const f3 = F('', { head:0, rows:[['이름','값']] });
  T('②-18 ★★★ 옮겨 온 것이 없으면 원래 표를 그대로 둔다', f3.rows[0][0] === '이름', JSON.stringify(f3.rows));
  T('②-19 ★★ 옮겨 온 글자는 escape 한다 (남의 코드가 우리 화면에서 돌면 안 된다)',
    F('<img src=x onerror=alert(1)> | b', { rows:[['a','b']] }).rows[0][0].indexOf('<img') < 0);
}

// ── ③ 편집기가 표를 받아들이는가
const QM = grab('qlMake');
T('③-1 ★★★ 편집기가 표 서식을 받는다 (여기 없으면 표가 통째로 사라진다)',
  !!QM && /'btable'/.test(QM), (QM || '').match(/formats:[^\n]*/) || '');
T('③-2 ★ 편집기를 세우기 전에 표 blot 을 등록한다',
  !!QM && QM.indexOf('qlTableInit()') < QM.indexOf('new Quill'), (QM || '').match(/[^\n]*qlTableInit[^\n]*/) || '');
const QI = grab('qlTableInit');
T('③-3 ★ 표는 한 줄을 통째로 차지하는 블록이다 (BlockEmbed)',
  !!QI && /blots\/block\/embed/.test(QI));
T('③-4 ★ 표 안에서는 글자를 못 고치게 한다 (편집기 안에 편집기를 두면 커서가 엉킨다)',
  !!QI && /contenteditable', 'false'/.test(QI));
// ★★★ 4.118 — 「누르면 고칠 수 있습니다」 라고 **적어 두는** 대신, 진짜로 그 자리에서 고쳐진다.
//   글로 안내하는 것보다 칸이 바로 써지는 것이 낫다. 그래서 여기서 볼 것이 바뀌었다.
T('③-5 ★★★ 표를 그 자리에서 고친다 (칸이 바로 써진다)',
  !!QI && /tblHtml\(v, null, true\)/.test(QI), (QI || '').match(/[^\n]*innerHTML[^\n]*/) || '');
const TH = grab('tblHtml');
T('③-5-나 ★★★ 고치는 표는 칸마다 글을 쓸 수 있다',
  !!TH && /const ce = edit \? ' contenteditable="true"' : ''/.test(TH));
T('③-5-다 ★★ 읽기만 하는 표는 칸이 안 써진다 (남의 글이 고쳐지면 안 된다)',
  !!TH && /: ''/.test(TH) && /tblHtml\(x, cls, edit\)/.test(TH));
T('③-5-라 ★★ 줄·칸 단추가 표에 붙어 나온다 (어디를 눌러야 하는지 보인다)',
  !!QI && /\+ tblBarHtml\(\)/.test(QI) && !!grab('tblBarHtml'));

// ── ④ 도구줄에 표 단추가 있는가 (없어서 「표가 안 만들어지네」 였다)
const RT = src.slice(src.indexOf('const RICH_TOOLS = ['), src.indexOf('const RICH_TOOLS = [') + 900);
T('④-1 ★★★ 도구줄에 표 단추가 있다', /name:'표',\s*fn:'richTable'/.test(RT), RT.slice(0, 400));
// ★ 4.118 — 창이 뜨지 않는다. 커서 자리에 표가 바로 놓인다.
{
  const RTF = grab('richTable') || '';
  T('④-2 ★ 표 단추를 누르면 커서 자리에 새 표가 놓인다',
    /richInsert\(fid, \[\{ t:'table'/.test(RTF), RTF);
  T('④-3 ★★ 놓자마자 첫 칸에 커서가 간다 (누르고 바로 칠 수 있다)',
    /tblCaret\(last\.querySelector\('td,th'\)\)/.test(RTF), RTF);
}

// ── ⑤ 덩이 ↔ Delta 를 오갈 때 표가 살아남는가
const BD = grab('blocksToDelta');
T('⑤-1 ★★★ 저장된 표를 편집기에 도로 넣는다', !!BD && /btable/.test(BD));
const DB = grab('deltaToBlocks');
T('⑤-2 ★★★ 편집기의 표를 도로 덩이로 담는다', !!DB && /ins\.btable/.test(DB));
T('⑤-3 ★★ 표는 사진과 같이 한 줄을 통째로 차지한다', !!DB && /tbls\.length/.test(DB));
const RI = grab('richInsert');
T('⑤-4 ★★ 넣기가 표도 넣는다', !!RI && /insertEmbed\(i, 'btable'/.test(RI));

// ── ⑥ 붙여넣기가 표를 살리는가 ★ 사장님이 겪으신 바로 그 자리
const PP = grab('pasteParts');
T('⑥-1 ★★★ 붙여넣을 때 표를 먼저 떼어 낸다', !!PP && /<table\\b/.test(PP), (PP||'').slice(0,80));
T('⑥-2 ★★ 못 읽은 표라도 글은 잃지 않는다', !!PP && /else chunk\(m\[0\]\)/.test(PP));
const OP = grab('onRichPaste');
T('⑥-3 ★★★ 표만 딸려 와도 우리가 받는다 (사진이 없다고 그냥 넘기면 표가 사라진다)',
  !!OP && /if\(!photos\.length && !hasTbl\) return;/.test(OP),
  (OP || '').match(/[^\n]*!photos\.length[^\n]*/) || '');
T('⑥-6 ★★ 표만 있으면 사진 줄이기를 거치지 않는다',
  !!OP && /if\(!photos\.length\)\{ richInsert/.test(OP));
const BD2 = grab('blocksToDelta');
T('⑥-7 ★★★ 표 blot 을 못 세운 자리에서는 글자로라도 보여 준다 (편집기가 통째로 안 열리면 안 된다)',
  !!BD2 && /QL_TBL_READY/.test(BD2) && /tblText\(x\)/.test(BD2));
const FN = grab('tblFromNode');
T('⑥-4 ★ colspan 이 있으면 그만큼 칸을 벌린다 (안 벌리면 아래 줄과 어긋난다)',
  !!FN && /colspan/.test(FN));
T('⑥-5 ★ 알맹이가 하나도 없는 표는 받지 않는다 (모양만 잡은 빈 격자)',
  !!FN && /richText\(c\)\.trim/.test(FN));

// ── ⑦ 표가 화면에 나오는가 (읽는 화면·배 소개·본문 뽑기)
T('⑦-1 ★★★ 글 화면이 표를 그린다', /if\(x\.t === 'table'\) return `<div class="postbody">\$\{tblHtml\(x\)\}/.test(src));
T('⑦-2 ★★ 배 소개 화면도 표를 그린다', /if\(x\.t === 'table'\)\s*\n\s*return `<div class="postbody"/.test(src));
T('⑦-3 ★★★ 본문 뽑기가 표를 글자로 담는다', /x\.t === 'table' \? tblText\(x\)/.test(grab('blocksText') || ''));
T('⑦-4 ★ 배 소개 한 줄 뽑기도 표를 담는다', /p\.t === 'table' \? tblText\(p\)/.test(grab('introText') || ''));

// ── ⑧ 번역이 표를 표로 돌려놓는가
const TB = grab('trBlocks');
T('⑧-1 ★★★ 옮긴 글을 표로 돌려놓는다 (안 하면 "이름 | 값" 이 글자로 찍힌다)',
  !!TB && /tblFromText\(v, b\)/.test(TB));

// ── ⑨ ★★★ 표를 고치는 **따로 창이 없다** (4.118 에서 사장님이 없애라고 하신 그 창)
//   창이 다시 들어오면 뒤로 가기·한글 조합 문제가 통째로 되돌아온다.
T('⑨-1 ★★★ 표 창(tblOv)이 없다', !/tblOv/.test(src));
T('⑨-2 ★★★ 표 창을 여닫는 문이 없다', !grab('tblOpen') && !grab('tblClose'));
T('⑨-3 ★★ 덮개 목록에도 표 창이 없다',
  !/OVERLAY_IDS = \[[^\]]*'tblOv'/.test(src));
// 창이 없는 대신, 칸을 누르고 치는 길이 **한 번만** 걸려 있어야 한다
{
  const TW = grab('tblWire') || '';
  T('⑨-4 ★★★ 칸을 누르고 치는 길이 걸려 있다', TW.length > 0);
  T('⑨-5 ★★ 여러 번 걸지 않는다 (편집기가 여럿이어도 한 규칙이다)',
    /if\(TBL_WIRED[\s\S]{0,60}return;/.test(TW) && /TBL_WIRED = true;/.test(TW));
  T('⑨-6 ★★★ 편집기를 세울 때 그 길을 건다', /tblWire\(\);/.test(grab('qlTableInit') || ''));
  T('⑨-7 ★★★ 친 글자가 곧바로 적힌다 (저장 단추가 따로 없다)',
    /addEventListener\('input'[\s\S]{0,120}tblSync\(el\)/.test(TW));
  T('⑨-8 ★★ 붙여넣기는 글자만 받는다 (남의 서식이 들어오면 표가 무너진다)',
    /addEventListener\('paste'/.test(TW) && /text\/plain/.test(TW));
  T('⑨-9 ★★ 엔터는 아래 칸, 탭은 다음 칸 (워드와 같다)',
    /e\.key === 'Enter'/.test(TW) && /e\.key === 'Tab'/.test(TW));
  T('⑨-10 ★★ 단추를 눌러도 칸 커서를 잃지 않는다',
    /\[data-tb\]'\)\) e\.preventDefault\(\)/.test(TW));
}

// ── ⑩ 새 낱말이 세 말에 다 있는가 (한국어로 남으면 일본 사람 화면에 한글이 찍힌다)
// ★ 4.118 — 표에 붙어 나오는 단추 여섯 개가 곧 새말이다 (TBL_BTNS 와 같아야 한다)
const 새말 = ['표','+ 줄','+ 칸','줄 삭제','칸 삭제','제목줄','표 삭제',
              '이 표를 지울까요?','삭제',
              '줄은 {n}개까지 넣을 수 있습니다.','칸은 {n}개까지 넣을 수 있습니다.',
              '줄이 하나뿐이라 지울 수 없습니다.','칸이 하나뿐이라 지울 수 없습니다.'];
function dicts(){
  const i = src.indexOf('const I18N = {');
  let d = 0, j = src.indexOf('{', i), k;
  for(k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0){ k++; break; } }
  }
  const g = {};
  (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g);
  return g.I18N;
}
const I = dicts();
// ★ 단추 이름을 여기에 손으로 적어 두면 앱에서 하나 늘 때 소리 없이 빠진다.
//   앱의 TBL_BTNS 를 읽어, 거기 있는 이름이 위 목록에 다 들어 있는지 본다.
{
  const m = src.match(/const TBL_BTNS = \[[\s\S]*?\];/);
  T('⑩-0 ★★ 표 단추 목록이 한 곳에 있다 (TBL_BTNS)', !!m);
  if(m){
    const 이름 = [...m[0].matchAll(/'[a-z+\-]+',\s*'([^']+)'/g)].map(x => x[1]);
    T('⑩-0-나 ★★ 단추가 여섯 개다 — ' + 이름.join(' · '), 이름.length === 6, 이름);
    const 빠진 = 이름.filter(n => 새말.indexOf(n) < 0);
    T('⑩-0-다 ★★★ 단추 이름이 이 검사에 다 들어 있다', 빠진.length === 0, 빠진.join(' · '));
  }
}
['en','ru','ja'].forEach(L => {
  const 빠진 = 새말.filter(w => !I[L][w]);
  T('⑩-' + L + ' ★★ 표에 쓰는 새 낱말이 다 있다', 빠진.length === 0, 빠진.join(' · '));
  const 한글 = 새말.filter(w => /[가-힣]/.test(String(I[L][w] || '')));
  T('⑩-' + L + '-한글 ★★ 한국어가 남아 있지 않다', 한글.length === 0, 한글.join(' · '));
});
['{n}'].forEach(ph => {
  const 쓰는것 = 새말.filter(w => w.indexOf(ph) >= 0);
  ['en','ru','ja'].forEach(L => {
    const 잃은것 = 쓰는것.filter(w => String(I[L][w] || '').indexOf(ph) < 0);
    T('⑩-' + L + '-' + ph + ' ★★ 자리표를 잃지 않았다', 잃은것.length === 0, 잃은것.join(' · '));
  });
});

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
