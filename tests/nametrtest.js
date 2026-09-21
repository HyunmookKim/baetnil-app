// 4.100 — 이름은 기계로 옮기지 않는다 (사장님 지적)
//
// ★ 무슨 일이 있었나
//   화면에 「미야지마 방문자 버스」·「이에시마 항 방문자 버스」 가 떴다.
//   자료에는 `宮島ビジターバース` `家島港ビジターバース` 로 제대로 들어 있었다.
//   ビジターバース 는 **방문 정박지(visitor berth)** 인데, 기계가 バース(berth) 를 「버스」로 옮겼다.
//   ★ 앱이 없는 곳을 만들어 낸 것이다. 사람은 그 이름을 보고 배를 대러 간다.
//
// ★ 한쪽만의 문제가 아니었다 — 한국 정박지 이름도 일본어·영어·러시아어로 옮겨져 나가고 있었고,
//   **배 이름**까지 옮겨지고 있었다.
//
// ★ 이 앱은 이미 같은 규칙을 갖고 있었다:
//   「배 주인이 쓴 글은 옮기지 않는다. 기계로 옮기면 그 사람이 안 한 말이 그 사람 이름으로 남는다.」
//   지명·배 이름도 똑같다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; } else { bad++;
  console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 300) : '')); } };
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}

// ── 정박지 이름
const nm = grab('spotShowName');
T('정박지 이름을 내는 곳이 있다', !!nm);
T('★★★ 정박지 이름을 기계로 안 옮긴다',
  !!nm && !/trWord\(|trRow\(/.test(nm), nm);
// ★ 4.100 — 「그대로 낸다」 에서 「소리로 옮긴다」 로 바뀌었다 (사장님이 정하신 것 9)
//   한국어로 보면 한글 그대로, 다른 말로 보면 그 나라 글자로 소리를 적는다 (nameFor).
// ★ 4.102 — 일본 이름은 **읽어 주되 원문을 함께** 낸다 (사장님: 「일본 항구들 번역 안 된 건 이유가 머지?」)
//   여기서도 옮기는 것은 **소리뿐**이다. 뜻은 여전히 안 옮긴다.
T('★★★ 우리 글 이름은 소리로 옮긴다 (nameFor 를 지난다)',
  !!nm && /nameFor\(/.test(nm), nm);
T('★★★ 일본 글자 이름은 읽어 주고 **원문을 함께** 낸다',
  !!nm && /읽기 \+ ' \(' \+ 원문 \+ '\)'/.test(nm), nm);
T('★★★ 읽는 법을 모르면 원문 그대로 (지어내지 않는다)',
  !!nm && /return 원문/.test(nm), nm);

// ── 배 이름
const bn = grab('boatShowName');
T('배 이름을 내는 곳이 있다', !!bn);
T('★★★ 배 이름을 기계로 안 옮긴다', !!bn && !/trRow\(|trWord\(/.test(bn), bn);

// ── 홈포트(지명)
const bp = grab('boatShowPort');
T('홈포트를 내는 곳이 있다', !!bp);
T('★★★ 홈포트도 기계로 안 옮긴다', !!bp && !/trRow\(|trWord\(/.test(bp), bp);

// ── 설명(문장)은 그대로 옮긴다 — 이름만 안 옮기는 것이다
const nt = grab('spotShowNote');
T('★★ 설명은 그대로 옮긴다 (막은 것은 이름뿐이다)',
  !!nt && /trWord\(|trRow\(/.test(nt), nt);

// ── 이름을 번역기에 태우지도 않는다 (안 쓰는 것을 돈 내고 옮기지 않는다)
T('★★★ 목록에서 이름을 번역기에 안 태운다',
  !/trWordsAuto\(rows\.filter\(s => s\.seed\)\.flatMap\(s => \[s\.name/.test(src));
T('★★★ 상세에서도 이름을 번역기에 안 태운다',
  !/trWordsAuto\(\[s\.name/.test(src));

// ── 사람이 쓴 글의 제목은 그대로 옮긴다 (그건 문장이고, 옮겼다고 화면에 밝힌다)
T('★★ 글·장터 제목은 그대로 옮긴다',
  /trRow\('community', po\.id, 'title'/.test(src) && /trRow\('market', m\.id, 'title'/.test(src));

console.log(`nametrtest: ${ok} 통과, ${bad} 실패`);
process.exit(bad ? 1 : 0);
