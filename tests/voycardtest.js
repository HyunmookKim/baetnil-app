// 4.99 — 항해일지 화면: 자리마다 칸을 씌운다 (사장님 지적)
//
// ★ 사장님 말씀 (2026-09-02)
//   "중간기록 도착 뭐 이런것들 세부사항들이 칸밖에 있어서 매번 뭐가 뭔지 찾기 어렵다"
//   "중간기록 버튼도 찾기어렵고, 매번 출발 도착 글씨도 존나 작아서 찾기도 어렵다"
//   "전반적으로 인간이 사용하기에 최악의 인터페이스다"
//
// ★ 무엇이 잘못이었나 — 출발·중간기록·도착이 다 같은 굵기의 **줄** 이었다.
//   그 아래 날씨·좌표·사진 단추가 아무 테두리 없이 이어져서, 어느 것이 어느 자리에
//   딸린 것인지 화면이 알려 주지 않았다. 사람이 매번 눈으로 다시 세어야 했다.
//
// ★ 어떻게 고쳤나 — 길찾기(카카오맵·네이버지도)와 배송 조회가 쓰는 모양을 그대로 쓴다.
//   자리마다 칸, 왼쪽에 색 띠와 점, 위에 굵은 제목, 딸린 것은 전부 그 칸 **안**에.
//   색은 이 앱 지도가 이미 쓰는 것 — 출발 초록 · 중간 노랑 · 도착 빨강.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,240):'')); } };
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}
const CSS = re => (src.match(re) || [''])[0];

// ══ 1. 칸이 있고, 세 갈래가 색으로 갈린다 ═════════════════════════
{
  const c = CSS(/\.legc\{[^}]*\}/);
  T('자리 칸 모양이 있다', !!c, c);
  T('★★★ 테두리가 있다 (칸 밖으로 새지 않는다)', /border:1px solid/.test(c), c);
  T('★★★ 왼쪽에 색 띠가 있다', /border-left-width:5px/.test(c), c);
  T('★★ 칸끼리 떨어져 있다', /margin:\d+px/.test(c), c);
  T('★★★ 출발은 초록 (지도의 출발 점과 같은 색)', /\.legc\.out\{border-left-color:#4ade80\}/.test(src));
  T('★★★ 중간기록은 노랑 (지도의 깃발과 같은 색)', /\.legc\.mid\{border-left-color:#ffd24a\}/.test(src));
  T('★★★ 도착은 빨강 (지도의 도착 점과 같은 색)', /\.legc\.in \{border-left-color:#ff5a3c\}/.test(src));
}

// ══ 2. 제목이 크다 (사장님: 「글씨가 작아서 찾기도 어렵다」) ════════
{
  const h = CSS(/\.legh\{[^}]*\}/);
  T('제목 모양이 있다', !!h, h);
  const 크기 = Number((h.match(/font-size:([\d.]+)px/) || [])[1]);
  T('★★★ 제목이 16px 이상이다 — 지금 ' + 크기 + 'px', 크기 >= 16,
    '옛 이름표(.mrlbl)는 11px 이었다. 그것이 「글씨가 작다」 는 지적의 실체다');
  const 옛 = Number((CSS(/\n\.mrlbl\{[^}]*\}/).match(/font-size:([\d.]+)px/) || [])[1]);
  T('★★★ 옛 이름표보다 확실히 크다 (' + 옛 + 'px → ' + 크기 + 'px)', 크기 >= 옛 + 4);
  T('★★ 굵다', /font-weight:800/.test(h), h);
  T('★★ 제목 옆에 색 점이 있다 (지도와 같은 표시)', /\.legh \.ldot\{/.test(src));
}

// ══ 3. 출발·도착이 칸 안에 들어간다 ═══════════════════════════════
{
  const lr = grab(src, 'legRow');
  T('★★★ 출발·도착이 칸으로 감싸진다', /<div class="legc \$\{kind\}">/.test(lr), lr);
  T('★★★ 출발이면 out, 도착이면 in', /const kind = \(placeKey === 'from'\) \? 'out' : 'in'/.test(lr), lr);
  T('★★★ 날씨가 그 칸 안에 있다', lr.indexOf('wxLine(') > lr.indexOf('legc'), lr);
  T('★★★ 좌표가 그 칸 안에 있다', lr.indexOf('posLine(') > lr.indexOf('legc'), lr);
  T('★★★ 사진도 그 칸 안에 있다 (밖에 흘리지 않는다)',
    lr.indexOf('vphBox(') > lr.indexOf('legc') && /\+ `<\/div>`;/.test(lr), lr);
  T('★★★ 칸을 닫는다', /\+ `<\/div>`;\s*\n\}/.test(lr), lr.slice(-200));
  // 밖에서 또 사진을 붙이면 두 번 나온다
  const om = grab(src, 'openMR') || '';
  T('★★★ 칸 밖에서 사진을 또 붙이지 않는다',
    !/legRow\('출발','from','timeOut','wxOut', it\) \+ vphBox/.test(om)
    && !/legRow\('도착','to','timeIn','wxIn', it\) \+ vphBox/.test(om), om.slice(0,400));
}

// ══ 4. 중간 기록도 칸이다 ═════════════════════════════════════════
{
  const lg = grab(src, 'logRows');
  T('★★★ 중간 기록이 칸으로 감싸진다', /<div class="legc mid">/.test(lg), lg);
  T('★★★ 날씨·좌표·사진이 그 칸 안에 있다',
    lg.indexOf('vphBox(') > lg.indexOf('legc mid') && /\+ `<\/div>`;/.test(lg), lg);
}

// ══ 5. 같은 값을 두 번 안 보여 준다 ═══════════════════════════════
{
  const lr = grab(src, 'legRow');
  T('★★★ 고칠 수 있을 때는 제목이 시각을 되풀이하지 않는다',
    /unlocked \? '' : `<span class="lsub">/.test(lr), lr);
  const lg = grab(src, 'logRows');
  T('★★★ 중간 기록도 마찬가지다 (고칠 때는 제목이 값을 안 짊어진다)',
    /const 머리 = unlocked\s*\n?\s*\? `<div class="legh"><span class="ldot"><\/span>\$\{esc\(t\('중간 기록'\)\)\}/.test(lg), lg);
  T('★★★ 볼 때는 제목이 시각·종류를 짊어진다 (고치는 칸이 없으니까)',
    /: `<div class="legh"><span class="ldot"><\/span>\$\{esc\(g\.time \? hm\(g\.time\)/.test(lg), lg);
}

// ══ 6. 고치는 칸을 한 줄에 몰아넣지 않는다 ════════════════════════
{
  const lg = grab(src, 'logRows');
  // 여태 시각·종류·내용·삭제·엔진 다섯 가지가 한 줄에서 접혔다.
  // 그래서 「삭제」 가 엔진 단추 사이에 끼어 있었다 (사장님 화면에서 그랬다).
  T('★★★ 시각과 종류가 한 줄', /<div class="mrrow" style="gap:6px">[\s\S]{0,700}?class="logkind"/.test(lg), lg);
  T('★★★ 내용은 제 줄을 갖는다', /<div class="mrrow">\s*\n?\s*<input class="logtext" style="flex:1"/.test(lg), lg);
  T('★★★ 엔진도 제 줄을 갖는다', /<div class="mrrow"><div class="engsw">/.test(lg), lg);
  T('★★★ 삭제가 고치는 칸 사이에 안 끼어 있다',
    !/class="logtext"[\s\S]{0,300}logDel\([\s\S]{0,300}engsw/.test(lg), lg);
  // ★ 단추 꾸밈(minib edt)과 줄바꿈은 바뀔 수 있다. 「제목 줄(lsub) 안에 삭제가 있는가」 만 본다.
  T('★★★ 삭제는 그 칸 제목 줄에 있다',
    /class="lsub">\s*<button class="minib[^"]*" onclick="logDel\(/.test(lg), lg);
}

// ══ 7. 「+ 중간 기록 추가」 가 눈에 띈다 ════════════════════════════
{
  const a = CSS(/\.legadd\{[^}]*\}/);
  T('더하는 자리 모양이 있다', !!a, a);
  T('★★★ 점선 테두리로 「여기에 더한다」 를 보여 준다', /border:1\.5px dashed/.test(a), a);
  T('★★ 칸만큼 넓다 (작은 단추가 아니다)', /padding:14px/.test(a), a);
  const b = CSS(/\.legadd b\{[^}]*\}/);
  T('★★★ 글씨가 크고 굵다', /font-size:15px/.test(b) && /font-weight:800/.test(b), b);
  const lg = grab(src, 'logRows');
  T('★★★ 눌러서 더한다', /class="legadd" onclick="logAdd\(\)"/.test(lg), lg);
  T('★★★ 출발과 도착 사이에 있다 (openMR 차례)',
    (()=>{ const om = grab(src, 'openMR') || '';
      const a1 = om.indexOf("legRow('출발'"), b1 = om.indexOf('logRows(it)'), c1 = om.indexOf("legRow('도착'");
      return a1 > 0 && a1 < b1 && b1 < c1; })());
  T('★★★ 옛 작은 단추는 없앴다', !/mrbtn big" onclick="logAdd\(\)/.test(lg), lg);
  T('★★ 무엇을 적는 자리인지 함께 알려 준다', /출발과 도착 사이에 있었던 일/.test(lg));
  T('★★ 지도로도 더할 수 있다고 알려 준다', /지도에서 항적 선을 눌러도 됩니다/.test(lg));
  T('★★★ 볼 때(잠금)에는 안 보인다 (누를 수 없는 것을 내밀지 않는다)',
    /const foot = unlocked\s*\n?\s*\? `<div class="legadd"/.test(lg), lg);
}

// ══ 8. 항해 전체 숫자도 제 묶음을 갖는다 ══════════════════════════
{
  const om = grab(src, 'openMR') || '';
  // ★ 거리 줄은 이제 즉시함수 안에서 지어진다 (어디서 잰 값인지 함께 적으려고).
  //   그래서 「바로 붙어 있는 글자」 가 아니라 「이름표 다음에 오는 첫 줄이 거리인가」 를 본다 —
  //   이름표와 거리 사이에 다른 줄이나 다른 묶음 이름표가 끼면 잡힌다.
  const SEC = '<div class="secl">${esc(t(\'이 항해\'))}</div>';
  const iSec = om.indexOf(SEC);
  const iNm  = om.indexOf("t('거리')");
  const iHr  = om.indexOf("durRow('항해 시간'");
  // 거리가 들어앉은 줄의 시작
  const iRow = iNm > 0 ? om.lastIndexOf('<div class="mrrow">', iNm) : -1;
  const 사이 = (iSec >= 0 && iRow > iSec) ? om.slice(iSec + SEC.length, iRow) : 'x<div class="mrrow">';
  T('★★★ 거리·시간 앞에 「이 항해」 묶음 이름표가 있다',
    iSec >= 0 && iRow > iSec && iNm > iRow && iHr > iNm
      && !/class="mrrow"/.test(사이) && !/class="secl"/.test(사이),
    om.slice(Math.max(0, iSec - 40), iNm + 80));
}

// ══ 9. 새로 쓴 말이 네 나라 말에 다 있다 ═══════════════════════════
{
  ['시각 없음','이 항해','지도에서 항적 선을 눌러도 됩니다'].forEach(k=>{
    ['en','ru','ja'].forEach(lg=>{
      const i = src.indexOf('\n  ' + lg + ': {');
      const j = src.indexOf('\n  },', i);
      T(lg + ' 에 「' + k + '」 이 있다', src.slice(i, j).indexOf("'" + k + "'") >= 0);
    });
  });
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
