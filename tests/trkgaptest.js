// 기록이 끊긴 데는 선을 잇지 않는가 (4.116)
//
// ★★★ 사장님 지적 (2026-09-09) — 「지금도 지피에스 오류가 있네」
//   9/9 항적이 마리나에서 남서쪽으로 뻗었다 그대로 돌아오는 모양이었다.
//
// ★★★ 처음에 나는 「잇달아 튄 점」 이라고 짐작하고 그것을 걷어내는 셈을 만들었다.
//   사장님이 백업 파일을 주셔서 **실제 점을 세어 보니 틀린 짐작이었다.**
//     · 9/9 항적은 다섯 점. 가운데 둘은 정확도 4m·5m 에 3.1노트·6.8노트 —
//       진짜로 배가 나간 자국이다.
//     · 만들어 둔 셈을 사장님 자료에 돌려 보니
//         9/09 5점 → 2점 · 9/02 28점 → 25점 · 9/03 35점 → 28점
//       **진짜 항적 열세 점을 지웠다.** 짐작으로 만든 문이 자료를 지울 뻔했다.
//   그래서 그 셈을 통째로 버리고, 진짜 원인을 고쳤다.
//
// ★ 진짜 원인 — **기록이 중간에 끊긴다.**
//     9/09  5점 /  48분 — 40분 동안 한 점도 안 들어옴 (639m)
//     9/02 28점 / 185분 — 5분 넘게 빈 데 열한 곳
//     9/03 35점 / 113분 — 여섯 곳
//   정확도는 중앙값 4~9m 로 멀쩡하다. 흐린 게 아니라 **안 들어온다.**
//   그 빈 데를 곧은 선으로 이으면 「배가 그리로 곧장 갔다」 는 거짓 선이 된다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 200) : '')); } };
function grab(name){
  const a = src.indexOf('function ' + name + '(');
  if(a < 0) return '';
  let d = 0, j = src.indexOf('{', a);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(a, j);
}
const num = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*([0-9.]+)')); return m ? +m[1] : null; };

// ── ① 문이 있는가
T('①-1 ★★ 끊긴 데를 가리는 셈이 있다 (trkGap)', !!grab('trkGap'));
// ★★★★ 5.37 — 끊김 판단은 OsmAnd 그대로 (사장님: 「무조건 다른 어플 따라서 … 티끌만한거라도 정하지 마라」)
//   OsmAnd SavingTrackHelper.collectDBTracks: 앞 점과 6분 이상 벌어졌고 그 간격이 바로 앞 간격의 10배 이상이면 새 구간.
//   거리는 보지 않는다. (예전 5분·200m 는 다른 앱 확인 없이 정한 숫자였다)
T('①-2 ★★ 6분 문 (OsmAnd)', num('TRK_OSM_SEG_MS') === 360000, num('TRK_OSM_SEG_MS'));
T('①-3 ★★ 10배 문 (OsmAnd)', num('TRK_OSM_SEG_X') === 10, num('TRK_OSM_SEG_X'));
T('①-3-나 ★★★ 예전 5분·200m 문이 없다', num('TRK_GAP_S') === null && num('TRK_GAP_M') === null);
T('①-4 ★★★ 그리는 셈이 끊긴 데를 표시한다 (앞앞 점까지 넘긴다)', /brk: 앞 \? trkGap\(앞, p, 앞앞\) : false/.test(grab('trkLine')), grab('trkLine'));
T('①-5 ★★★ 끊긴 데서 선을 **잇지 않는다** (L 이 아니라 M)',
  /\(i && !p\.brk\) \? 'L' : 'M'/.test(src));
T('①-6 ★★ 끊긴 데를 흐린 점선으로 남긴다 (여기서 놓쳤다는 것이 보여야 한다)',
  /stroke-dasharray/.test(src) && /끊긴데/.test(src));
T('①-7 ★★★ 항적을 지우는 「구간 걷어내기」 가 없다 (진짜 항적 열세 점을 지웠다)',
  !/function trkDropLoops\s*\(/.test(src) && !/function trkLoopEnd\s*\(/.test(src));
T('①-8 ★★★ 끊긴 곳 목록도 같은 문 (앞앞 점)', /trkGap\(a\[i-1\], a\[i\], a\[i-2\]\)/.test(grab('trkGapList')));

let F = null;
try{
  F = new Function(`${grab('hav')}
    const TRK_OSM_SEG_MS = ${num('TRK_OSM_SEG_MS')}, TRK_OSM_SEG_X = ${num('TRK_OSM_SEG_X')};
    ${grab('trkGap')}
    return trkGap;`)();
}catch(e){ console.log('★ 셈을 못 세웠다: ' + e.message); }
T('②-0 셈을 꺼내 돌릴 수 있다', !!F);

const LA0 = 34.7386, LO0 = 127.6789;
const P = (n, e, sec) => ({ la: LA0 + n / 111000, lo: LO0 + e / (111000 * 0.823),
                            t: new Date(Date.parse('2026-10-04T07:48:30Z') + sec * 1000).toISOString() });
if(F){
  T('②-1 ★★★ 5초마다 오다가 40분 빈 데는 끊는다', F(P(0,0,5), P(300,200,2405), P(0,0,0)) === true);
  T('②-2 ★★★ 5초마다 오다가 5분 빈 데는 안 끊는다 (OsmAnd 6분 미만)', F(P(0,0,5), P(300,200,305), P(0,0,0)) === false);
  T('②-3 ★★★ 6분 넘게 비어도 바로 앞 간격이 길었으면(10배 미만) 안 끊는다', F(P(0,0,1200), P(300,200,3000), P(0,0,0)) === false);
  T('②-4 ★★ 제자리여도 6분·10배면 끊는다 (OsmAnd 는 거리를 안 본다)', F(P(0,0,5), P(1,1,605), P(0,0,0)) === true);
  T('②-5 시각이 없으면 안 끊는다', F({ la:LA0, lo:LO0 }, { la:LA0+0.01, lo:LO0 }, { la:LA0, lo:LO0 }) === false);
  T('②-6 빈 것을 줘도 안 터진다', F(null, null) === false);
  T('②-7 첫 걸음(앞 점이 없음)은 OsmAnd 처럼 안 끊는다', F(P(0,0,0), P(300,200,3000)) === false);
  // 10/4 사장님 항해 — 줄여서 저장된 5점. 예전 셈은 3곳이라 했다.
  const 시 = s => ({ t: s });
  const D = [['34.72628','127.67063','2026-10-04T07:48:30.000Z'],['34.73048','127.66866','2026-10-04T08:26:33.000Z'],
             ['34.73051','127.66912','2026-10-04T08:26:58.000Z'],['34.73098','127.66558','2026-10-04T08:56:08.000Z'],
             ['34.73863','127.6789','2026-10-04T09:23:10.000Z']].map(r => ({ la:+r[0], lo:+r[1], t:r[2] }));
  let n = 0; for(let i = 1; i < D.length; i++) if(F(D[i-1], D[i], D[i-2])) n++;
  T('②-8 ★ 10/4 저장된 5점을 OsmAnd 문으로 보면 1곳 (예전 셈 3곳)', n === 1, n);
}

// ── ②-나 사람에게 끊겼다고 알려 주는가
T('②-7 ★★★ 몇 곳에서 끊겼는지 세는 문이 있다 (trkGaps)', !!grab('trkGaps'));
T('②-8 ★★★ 항해 화면이 그것을 밝힌다 (숨기면 사람이 그 선을 지나온 길로 믿는다)',
  /trkGap(s|List)\(it\)/.test(src) && /기록이 \{n\}곳에서 끊겼습니다/.test(src));
// ★★★ 4.124 — 몇 시부터 몇 시까지 끊겼는지도 한 줄씩 적는다.
//   「1곳에서 끊겼습니다」 만으로는 그때 무엇을 하고 있었는지 못 짚는다.
T('②-8-나 ★★★ 언제부터 언제까지 끊겼는지 적는다', !!grab('trkGapList') && !!grab('trkGapText'));
T('②-8-다 ★★ 그 줄을 화면이 실제로 그린다', /trkGapText\(g\)/.test(src));
T('②-8-라 ★★ 끊긴 동안이 몇 분인지 적는다', /\{m\}분/.test(grab('trkGapText') || ''));
{
  const I = (() => {
    const i = src.indexOf('const I18N = {');
    let d = 0, j = src.indexOf('{', i), k;
    for(k = j; k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d){ k++; break; } } }
    const g = {}; (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g); return g.I18N;
  })();
  // ★ 4.124 이후 — 두 번째 줄이 바뀌었다.
  //   전: 「폰이 위치를 한동안 안 준 것입니다…」 (막연한 변명)
  //   후: 몇 시부터 몇 시까지 몇 분인지 한 줄씩 적고, 점선이 무엇인지 밝힌다.
  ['기록이 {n}곳에서 끊겼습니다. 끊긴 구간은 점선으로 표시됩니다.',
   '점선은 마지막으로 수신한 위치와 다시 수신한 위치를 연결한 선입니다.',
   '{m}분'].forEach(w => {
    ['en','ru','ja'].forEach(L => {
      T('②-말 ' + L + ' 「' + w.slice(0, 12) + '…」 이 사전에 있다',
        !!I[L][w] && !/[가-힣]/.test(I[L][w]), I[L][w]);
    });
  });
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
