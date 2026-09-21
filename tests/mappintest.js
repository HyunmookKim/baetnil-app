// 4.99 — 지도 위의 것들이 손가락을 받는가 · 선은 항적일 때만 긋는가
//
// ★ 사장님 지적 (2026-09-01)
//   ① "말이나 항목 지도에서 누르면 아예 안 눌러지네"
//   ② "말이나 마리나 사이에 선들은 왜 연결된 거냐. 이거 선들은 불필요한 거 같은데"
//
// ★ ①이 왜 사고인가 — 겹침층(.mol)은 pointer-events:none 이다. 지도를 끌 때
//   층이 손가락을 가로채면 안 되기 때문이다. 그래서 그 위에 얹는 것은 저마다
//   auto 로 되살려야 한다. 깃발은 되살렸는데 핀은 4.76 에 넣으면서 빠뜨렸다.
//   정박지 핀이 스무 날 넘게 보이기만 하고 한 번도 안 눌렸다.
//
// ★ ②가 왜 사고인가 — 속초 마리나와 히로시마 마리나가 선으로 이어졌다.
//   아무 상관 없는 자리인데 배가 그리로 간 것처럼 보인다. 화면이 거짓말을 했다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(w).slice(0,240):'')); } };
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}

// ══ 1. 겹침층 위의 것은 저마다 손가락을 되살려야 한다 ═══════════════
{
  const 층 = /\.mapbox \.mtl,\.mapbox \.mol\{[^}]*\}/.exec(src);
  T('겹침층 규칙이 있다', !!층);
  T('★★★ 겹침층은 손가락을 안 받는다 (끄는 것이 먼저다)',
    층 && /pointer-events:none/.test(층[0]), 층 && 층[0]);

  const 핀 = /(^|\n)\.mpin\{[\s\S]*?\}/.exec(src);
  T('핀 규칙이 있다', !!핀);
  T('★★★ 핀은 손가락을 받는다 (이것이 4.76 부터 빠져 있었다)',
    핀 && /pointer-events:auto/.test(핀[0]), 핀 && 핀[0]);

  const 깃 = /\.mapbox \.mflag\{[\s\S]*?\}/.exec(src);
  T('★★ 깃발도 여전히 손가락을 받는다', 깃 && /pointer-events:auto/.test(깃[0]), 깃 && 깃[0]);

  // ★ 눌러야 하는 것과 안 눌러도 되는 것을 갈라 둔다.
  //   점·이름표는 안 눌린다 — 핀 위에 겹쳐 있어서 손가락을 가로채면 핀이 또 안 눌린다.
  const 점 = /\.mapbox \.mdot\{[\s\S]*?\}/.exec(src);
  T('★★★ 점은 손가락을 안 받는다 (핀을 가리면 안 된다)',
    점 && /pointer-events:none/.test(점[0]), 점 && 점[0]);
  // ★★★ 5.00 — 이름표는 이제 **눌린다** (사장님 지적: 핀이 여전히 안 눌린다)
  //   핀은 26px 인데 이름은 그 몇 배다. 사람은 작은 동그라미보다 이름을 누른다.
  //   대신 열쇠(data-key)가 붙은 이름표만 받는다 — 항해 점 이름표는 그대로 안 받는다.
  const 이름 = /\.mapbox \.mlbl\{[\s\S]*?\}/.exec(src);
  T('★★ 이름표는 기본으로는 손가락을 안 받는다', 이름 && /pointer-events:none/.test(이름[0]), 이름 && 이름[0]);
  T('★★★ 열쇠가 붙은 이름표는 손가락을 받는다',
    /\.mapbox \.mlbl\[data-key\]\{pointer-events:auto\}/.test(src));
}

// ══ 2. 핀을 누르면 그 자리가 열린다 (지도 빈 곳을 누른 것으로 안 센다) ══
{
  // ★★★ 5.00 — onclick 을 뗐다. 왜인지는 mapBind 의 onpointerup 에 적어 두었다.
  //   손가락을 붙잡아 두는 동안 브라우저가 click 을 지도에 보내고, 게다가 그 사이
  //   층을 새로 그려서 눌린 핀이 사라진다. 그래서 핀에 매단 onclick 은 안 불렸다.
  T('핀에 열쇠를 매단다', /data-tap="spot" data-key="\$\{esc\(p\.key\)\}"/.test(src));
  T('★★ 이름표에도 같은 열쇠를 매단다',
    /<div class="mlbl" data-tap="spot" data-key="\$\{esc\(p\.key\)\}"/.test(src));
  T('★★★ 옛 방식(onclick)으로 돌아가지 않았다', !/onclick="mapSpotTap\(/.test(src));
  const tap = grab(src, 'mapSpotTap');
  T('누르면 그 자리를 여는 문이 있다', !!tap);
  T('★★ spot: 앞머리를 떼고 연다', tap && /replace\(\/\^spot:\/, ''\)/.test(tap), tap);
  T('★★ 그 자리를 실제로 연다', tap && /openSpot\(/.test(tap), tap);
  const bind = src.slice(src.indexOf('el.onpointerup'), src.indexOf('el.onpointercancel'));
  T('★★★ 핀을 누른 것은 「지도 빈 곳」 으로 세지 않는다',
    /closest\('\[data-tap\]'\)/.test(bind), bind.slice(0, 800));
  // ★★★ 다시 그리기 **전에** 손가락 밑을 봐야 한다 — 먼저 그리면 눌린 핀이 사라진다
  T('★★★ 다시 그리기 전에 손가락 밑을 본다',
    bind.indexOf('elementFromPoint') > 0 && bind.indexOf('elementFromPoint') < bind.indexOf('mapPaint();'),
    bind.slice(0, 800));
  T('★★★ 여는 곳은 여기 하나다', /mapSpotTap\(맞은것\.key\)/.test(bind), bind.slice(0, 900));
}

// ══ 3. 선은 「항적」 이라고 밝힌 지도에서만 긋는다 ══════════════════
{
  const init = grab(src, 'mapInit');
  T('★★★ 지도를 켤 때 항적인지를 받아 둔다', /track: !!\(opt && opt\.track\)/.test(init), init);
  const paint = src.slice(src.indexOf('function mapPaint('), src.indexOf('function mapPaint(') + 6000);
  T('★★★ 항적이 아니면 선을 안 긋는다', /!S\.track \? \[\]/.test(paint), paint.slice(paint.indexOf('const LINE'), paint.indexOf('const LINE')+220));

  // ★ 선을 켜는 지도가 어디인지 세어 둔다 — 새 지도를 만들며 무심코 켜면 여기서 잡힌다
  const 켠곳 = (src.match(/mapInit\([\s\S]{0,180}?track:\s*true/g) || []).length;
  const 전체 = (src.match(/mapInit\(/g) || []).length - 1;   // 함수 선언 한 줄을 뺀다
  T('★★★ 선을 켠 지도는 둘뿐이다 (항해일지·남의 배 항해) — 지금 ' + 켠곳 + '곳', 켠곳 === 2);
  T('지도를 켜는 곳은 ' + 전체 + '군데다 (나머지는 선이 없다)', 전체 >= 8);

  // 정박지 지도는 절대 켜지 않는다
  const sp = grab(src, 'spotMapDraw');
  T('★★★ 정박지 지도는 선을 안 긋는다', sp && !/track/.test(sp), sp);
  const sp1 = grab(src, 'spotOpen') || src.slice(src.indexOf("mapInit('spotMap'") - 200, src.indexOf("mapInit('spotMap'") + 160);
  T('★★ 정박지 한 곳 지도도 선을 안 긋는다', !/mapInit\('spotMap'[^)]*track/.test(src));
}

// ══ 4. 항적 지도는 여전히 선을 긋는다 (고치다가 없애지 않았는가) ═════
{
  T('★★★ 항해일지 지도는 선을 긋는다', /mapInit\('trkMap'[\s\S]{0,160}track:true/.test(src));
  T('★★★ 남의 배 항해 지도도 선을 긋는다', /mapInit\('pubTrkMap'[\s\S]{0,120}track:true/.test(src));
}

// ══ 5. 판 번호 ═════════════════════════════════════════════════════
{
  const sw = fs.readFileSync(require('path').join(__dirname, 'sw.js'), 'utf8');
  const a = /const APP_VER = '([^']+)'/.exec(src), b = /const CACHE = 'baetnil-([^']+)'/.exec(sw);
  T('★★★ 앱 판과 저장고 판이 같다 (' + (a&&a[1]) + ' / ' + (b&&b[1]) + ')', a && b && a[1] === b[1]);
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
