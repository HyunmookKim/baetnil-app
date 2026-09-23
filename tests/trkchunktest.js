// 5.14 — 항적은 점마다 전체를 다시 쓰지 않는다 (새 점만 덧붙인다 — OsmAnd·OpenTracks·Open GPX Tracker 방식)
//   ① 한 번 저장에 쓰는 글자 수가 항적이 길어져도 늘지 않는다
//   ② 앱이 죽었다 켜져도 점이 하나도 안 빠지고 순서도 같다
//   ③ 솎기·몰아 받기로 점이 바뀌면 전부 다시 써서 맞춘다
//   ④ 옛 판이 남긴 한 덩어리도 읽는다   ⑤ 기록을 끝내면 묶음까지 다 치운다
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x !== undefined ? ' — ' + x : '')); } };
const cut = name => { const i = src.indexOf(name); if(i < 0) return ''; let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } } return ''; };
const need = ['function trkKeepMeta(', 'function trkKeep(', 'function trkLoad('];
T('묶음 저장 함수가 있다', need.every(n => cut(n)) && /const TRK_CHUNK = \d+/.test(src));
if(fail){ console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패'); process.exit(1); }

function 새앱(store){
  let 쓴글자 = 0, 쓴횟수 = 0;
  const ls = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); 쓴글자 += String(v).length; 쓴횟수++; },
               removeItem: k => { delete store[k]; } };
  const env = `
    const TRK_KEY = 'bt_trk'; ${(src.match(/const TRK_CHUNK = \d+;/) || [''])[0]}
    const TRK_PKEY = i => TRK_KEY + 'p' + i;
    let trkNow = null; let trkKept = { n: 0, head: '', last: '', chunks: 0 };
    const trkWatchStart = () => {};
    ${cut('function trkKeepMeta(')}
    ${cut('function trkKeep(')}
    ${cut('function trkLoad(')}
    return { keep: trkKeep, load: trkLoad, set: v => { trkNow = v; }, get: () => trkNow };`;
  const api = new Function('localStorage', env)(ls);
  api.쓴 = () => ({ 글자: 쓴글자, 횟수: 쓴횟수 }); api.초기화 = () => { 쓴글자 = 0; 쓴횟수 = 0; };
  return api;
}
const pt = i => ({ la: +(34.74 + i * 0.00009).toFixed(5), lo: 127.74, t: new Date(Date.UTC(2026, 8, 23) + i * 3200).toISOString(), ac: 8, sp: 3.1 });

// ① 한 번 값이 늘지 않는다
const store = {};
const A = 새앱(store);
A.set({ vid: 'v1', from: new Date().toISOString(), pts: [], id: null, saved: 0 }); A.keep();
const 한번 = [];
for(let i = 0; i < 3000; i++){
  A.get().pts.push(pt(i));
  A.초기화(); A.keep(); 한번.push(A.쓴().글자);
}
const 앞 = 한번.slice(100, 200).reduce((a, b) => a + b, 0) / 100;
const 뒤 = 한번.slice(2900, 3000).reduce((a, b) => a + b, 0) / 100;
T(`★★★ 한 번 저장에 쓰는 글자가 항적 길이와 상관없다 (100점대 ${Math.round(앞)}자 · 2,900점대 ${Math.round(뒤)}자)`, 뒤 < 앞 * 1.5);
T('★ 한 번 저장이 두 묶음을 넘지 않는다 (400점 몫)', Math.max(...한번.slice(10)) < JSON.stringify(Array.from({length: 400}, (_, i) => pt(i))).length + 1000);

// ② 앱이 죽었다 켜져도 그대로
const B = 새앱(store); B.load();
const 되살린 = B.get();
T('★★★ 다시 켜면 점이 하나도 안 빠진다 (3,000)', 되살린 && 되살린.pts.length === 3000, 되살린 && 되살린.pts.length);
T('★★★ 순서와 값이 같다', JSON.stringify(되살린.pts) === JSON.stringify(A.get().pts));
T('항해 번호·시작 시각 같은 머리 정보도 그대로다', 되살린.vid === 'v1' && !!되살린.from && 되살린.v === undefined && 되살린.pn === undefined);
// 다시 켠 뒤에도 덧붙이기로 이어 간다
B.get().pts.push(pt(3000)); B.초기화(); B.keep();
T('다시 켠 뒤에도 마지막 묶음만 쓴다', B.쓴().글자 < 한번[2999] * 2);
const C = 새앱(store); C.load();
T('다시 켠 뒤 덧붙인 점도 남는다 (3,001)', C.get().pts.length === 3001);

// ③ 솎기 — 점이 줄면 전부 다시 쓰고 남는 묶음을 치운다
C.set(Object.assign({}, C.get(), { pts: C.get().pts.filter((_, i) => i % 10 === 0) })); C.keep();
const D = 새앱(store); D.load();
T('★★ 솎은 뒤 다시 켜도 솎은 그대로다 (301)', D.get().pts.length === 301, D.get().pts.length);
T('★ 남는 옛 묶음이 안 남는다', !Object.keys(store).some(k => /^bt_trkp(\d+)$/.test(k) && +k.slice(7) >= 2));
// 몰아 받은 점이 가운데 끼면
const 가운데 = D.get().pts.slice(); 가운데.splice(150, 0, pt(99999)); D.set(Object.assign({}, D.get(), { pts: 가운데 })); D.keep();
const E = 새앱(store); E.load();
T('★★ 가운데 낀 점도 제자리에 남는다', JSON.stringify(E.get().pts) === JSON.stringify(가운데));

// ④ 옛 판 한 덩어리
const 옛 = { bt_trk: JSON.stringify({ vid: 'old', from: 'x', pts: [pt(1), pt(2), pt(3)], id: null }) };
const F = 새앱(옛); F.load();
T('★ 옛 판이 남긴 한 덩어리도 읽는다', F.get() && F.get().pts.length === 3 && F.get().vid === 'old');
F.get().pts.push(pt(4)); F.keep();
const G = 새앱(옛); G.load();
T('옛 덩어리도 다음 저장부터 묶음으로 바뀐다', JSON.parse(옛.bt_trk).v === 2 && G.get().pts.length === 4);

// ⑤ 끝내면 다 치운다
E.set(null); E.keep();
T('★★ 기록을 끝내면 머리·묶음이 다 지워진다', !Object.keys(store).some(k => /^bt_trk/.test(k)), Object.keys(store).join(','));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
