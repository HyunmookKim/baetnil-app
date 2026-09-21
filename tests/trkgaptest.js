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
T('①-2 ★★ 시간 문이 있다 (TRK_GAP_S)', num('TRK_GAP_S') !== null);
T('①-3 ★★ 거리 문이 있다 (TRK_GAP_M)', num('TRK_GAP_M') !== null);
T('①-4 ★★★ 그리는 셈이 끊긴 데를 표시한다', /brk: 앞 \? trkGap\(앞, p\) : false/.test(grab('trkLine')), grab('trkLine'));
T('①-5 ★★★ 끊긴 데서 선을 **잇지 않는다** (L 이 아니라 M)',
  /\(i && !p\.brk\) \? 'L' : 'M'/.test(src));
T('①-6 ★★ 끊긴 데를 흐린 점선으로 남긴다 (여기서 놓쳤다는 것이 보여야 한다)',
  /stroke-dasharray/.test(src) && /끊긴데/.test(src));

// ── ★★★ 지우지 않는다. 4.116 에서 만들었다 버린 셈이 되살아나면 안 된다.
T('①-7 ★★★ 항적을 지우는 「구간 걷어내기」 가 없다 (진짜 항적 열세 점을 지웠다)',
  !/function trkDropLoops\s*\(/.test(src) && !/function trkLoopEnd\s*\(/.test(src));

// ── ② 셈을 꺼내 실제로 돌린다
let F = null;
try{
  F = new Function(`${grab('hav')}
    const TRK_GAP_S = ${num('TRK_GAP_S')}, TRK_GAP_M = ${num('TRK_GAP_M')};
    ${grab('trkGap')}
    return trkGap;`)();
}catch(e){ console.log('★ 셈을 못 세웠다: ' + e.message); }
T('②-0 셈을 꺼내 돌릴 수 있다', !!F);

const LA0 = 34.7386, LO0 = 127.6789;
const P = (n, e, sec) => ({ la: LA0 + n / 111000, lo: LO0 + e / (111000 * 0.823),
                            t: new Date(Date.parse('2026-09-09T05:29:10Z') + sec * 1000).toISOString() });
if(F){
  // ★ 사장님 9/9 항적의 마지막 걸음 그대로 — 40분 · 639m
  T('②-1 ★★★ 40분 비고 639m 떨어진 걸음은 끊긴 데다',
    F(P(-300, -260, 2868), P(5, 3, 5278)) === true);
  // 짧게 비었으면 잇는다 — 진짜 항해다
  T('②-2 ★★★ 3분 비고 330m 간 걸음은 안 끊는다 (진짜로 배가 간 것이다)',
    F(P(0, 0, 0), P(-300, -260, 205)) === false);
  // 오래 비었어도 제자리면 잇는다 — 정박 중이라 안 움직인 것뿐이다
  T('②-3 ★★★ 한 시간 비었어도 30m 안 움직였으면 안 끊는다 (정박 중이다)',
    F(P(0, 0, 0), P(20, 15, 3600)) === false);
  // 멀리 갔어도 시간이 짧으면 잇는다 (그건 튄 점 거르개가 볼 일이다)
  T('②-4 ★ 1분 만에 500m 간 것은 여기서 안 끊는다 (튄 점 거르개가 본다)',
    F(P(0, 0, 0), P(400, 300, 60)) === false);
  T('②-5 시각이 없으면 안 끊는다', F({ la:LA0, lo:LO0 }, { la:LA0+0.01, lo:LO0 }) === false);
  T('②-6 빈 것을 줘도 안 터진다', F(null, null) === false);
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
  ['기록이 {n}곳에서 끊겼습니다 — 그 사이는 점선입니다.',
   '점선은 위치를 마지막으로 받은 곳과 다시 받은 곳을 이은 선입니다.',
   '{m}분'].forEach(w => {
    ['en','ru','ja'].forEach(L => {
      T('②-말 ' + L + ' 「' + w.slice(0, 12) + '…」 이 사전에 있다',
        !!I[L][w] && !/[가-힣]/.test(I[L][w]), I[L][w]);
    });
  });
}

// ── ③ 사장님 항적 다섯 벌 (있으면 그대로 돌려 본다)
{
  const BK = '/root/.claude/uploads/b2d0b648-0154-505a-aa4d-c7a93c03288c/e47cedda-baetnilbackup20260909.json';
  if(F && fs.existsSync(BK)){
    const d = JSON.parse(fs.readFileSync(BK, 'utf8'));
    const 본것 = (d.voyage || []).filter(v => (v.trk || []).length > 1);
    const 센것 = 본것.map(v => {
      let n = 0; const p = v.trk;
      for(let i = 1; i < p.length; i++) if(F(p[i-1], p[i])) n++;
      return { date: v.date, 점: p.length, 끊김: n };
    });
    T('③-1 ★★★ 9/9 항적에서 끊긴 데를 한 곳 찾는다 (사장님이 보신 그 선이다)',
      (센것.find(x => x.date === '2026-09-09') || {}).끊김 === 1, JSON.stringify(센것));
    T('③-2 ★★ 8/28 항적(137점, 촘촘함)은 한 곳도 안 끊는다',
      (센것.find(x => x.date === '2026-08-28') || {}).끊김 === 0, JSON.stringify(센것));
    T('③-3 ★★ 야간 항해 두 벌에서도 끊긴 데를 찾는다',
      (센것.find(x => x.date === '2026-09-02') || {}).끊김 > 0
      && (센것.find(x => x.date === '2026-09-03') || {}).끊김 > 0, JSON.stringify(센것));
    console.log('   (사장님 자료) ' + JSON.stringify(센것));
  } else {
    console.log('   (사장님 백업 파일이 없어 ③은 건너뜁니다)');
  }
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
