// 5.46 — 검사들이 index.html 에서 함수를 하나씩 꺼내 돌릴 때, 새로 생긴 도우미도 같이 꺼내 전역에 둔다.
//   ① 단위 기호 (numU·UNIT_RU·uSym·decL·nU) — 러시아어 화면 уз·м·см·л, 소수 쉼표
//   ② 기상청 특보 이름 옮기기 (KMA_*·kmaKindName·kmaZoneName)
//   함수 안에서 쓰는 langNow·t·nameSound 는 부를 때 전역에서 찾는다 (검사가 각자 둔 것).
module.exports = function inject546(src){
  const G = globalThis;
  const lift = code => code.replace(/^const (\w+) =/mg, 'globalThis.$1 =')
                           .replace(/^function (\w+)\(/mg, 'globalThis.$1 = function $1(');
  const cut = (a, b) => { const i = src.indexOf(a); if(i < 0) return ''; const j = src.indexOf(b, i); return j < 0 ? '' : src.slice(i, j); };
  if(typeof G.langNow !== 'function') G.langNow = () => 'ko';
  if(typeof G.t !== 'function') G.t = s => s;
  const numU = src.match(/^function numU\(n, u\)\{[^\n]*\n/m);
  if(numU && typeof G.numU !== 'function') (0, eval)(lift(numU[0]));
  const units = cut('const UNIT_RU =', '\n// sp:');
  const nU = src.match(/^function nU\(v, u, sp\)\{[^\n]*\n/m);
  if(units) (0, eval)(lift(units));
  if(nU) (0, eval)(lift(nU[0]));
  const kma = cut('const KMA_KIND = {', '// 같은 종류는 한 줄로 묶는다');
  if(kma) (0, eval)(lift(kma));
};
