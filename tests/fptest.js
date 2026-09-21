// 도면이 없을 때 안내가 뜨는지 검증
const fs = require('fs');
function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

const mkEl = ()=>({ style:{display:'초기값'}, src:undefined, dataset:{}, onerror:null,
  removeAttribute(){ this.src = undefined; },
  classList:{ set:new Set(), add(c){this.set.add(c)}, remove(c){this.set.delete(c)},
              contains(c){return this.set.has(c)} } });
let fp, none, hint;
globalThis.map = mkEl();
globalThis.document = { getElementById: id => (id==='fp' ? fp : id==='fpNone' ? none : id==='hint' ? hint : null) };
globalThis.dgImgs = { plan:null, side:null };

// 소스에서 fpShown 초기값을 그대로 가져온다
{ const m = src.match(/(?:const FP_UNSET[^;]+;\s*)?let fpShown = [^;]+;/);
  if(m) eval(m[0].replace('const FP_UNSET','globalThis.FP_UNSET').replace('let fpShown','globalThis.fpShown')); }
// 3.43 — 적재표 도면은 창고 주소를 쓰고, 못 받으면 작은 사본으로 버틴다
globalThis.dgSmall = { plan:null, side:null };
eval(grab(src,'dgShowSrc')); globalThis.dgShowSrc = dgShowSrc;
eval(grab(src,'dgFallback')); globalThis.dgFallback = dgFallback;
// 3.60 — 안내 줄은 '적재표의 도면 화면' 에서만 뜬다. 그 판단 함수도 같이 가져온다.
eval(grab(src,'hintWanted')); globalThis.hintWanted = hintWanted;
globalThis.curTab = 'boat'; globalThis.boatSubTab = 'stow'; globalThis.view = 'map';
eval(grab(src,'fpNoneSync')); globalThis.fpNoneSync = fpNoneSync;
eval(grab(src,'applyStowDg')); globalThis.applyStowDg = applyStowDg;

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// 1. 첫 화면에 도면이 없으면 안내가 떠야 한다
fp = mkEl(); none = mkEl(); hint = mkEl();
dgImgs = { plan:null, side:null };
applyStowDg();
T('도면 없으면 안내가 보인다', none.style.display === '');
T('도면 없으면 깨진 그림이 안 보인다', fp.style.display === 'none');
T('도면 없음 표시가 붙는다', map.classList.contains('nodg'));
T('도면 없으면 설명 문구도 숨긴다', hint.style.display === 'none');

// ★ 1-1. 적재표가 아닌 화면에서는 도면 안내가 뜨면 안 된다
//    (정기점검 화면에 '칸 클릭 · 청록으로 찬 칸=물건 있음' 이 그대로 떠 있었다)
{
  const keep = [curTab, boatSubTab, view];
  dgImgs = { plan:'data:image/png;base64,AAA', side:null };
  curTab = 'boat'; boatSubTab = 'maint'; fpShown = null; hint.style.display = '';
  applyStowDg();
  T('정기점검 화면에서는 도면 안내가 안 뜬다', hint.style.display === 'none');
  curTab = 'community'; boatSubTab = 'stow'; fpShown = null; hint.style.display = '';
  applyStowDg();
  T('커뮤니티 화면에서도 안 뜬다', hint.style.display === 'none');
  curTab = 'boat'; boatSubTab = 'stow'; view = 'list'; fpShown = null; hint.style.display = '';
  applyStowDg();
  T('목록 보기에서도 안 뜬다', hint.style.display === 'none');
  [curTab, boatSubTab, view] = keep;
  fpShown = null; dgImgs = { plan:null, side:null }; applyStowDg();
}

// 2. 도면이 생기면 안내가 사라진다
dgImgs = { plan:'data:image/png;base64,AAA', side:null };
applyStowDg();
T('도면이 생기면 그림이 보인다', fp.style.display === '' && fp.src === 'data:image/png;base64,AAA');
T('도면이 생기면 안내가 사라진다', none.style.display === 'none');
T('도면 없음 표시가 떨어진다', !map.classList.contains('nodg'));
T('도면이 생기면 설명 문구가 다시 뜬다', hint.style.display === '');

// 3. 도면을 지우면 다시 안내가 뜬다
dgImgs = { plan:null, side:null };
applyStowDg();
T('도면을 지우면 안내가 다시 뜬다', none.style.display === '' && fp.style.display === 'none');

// 4. 같은 그림이면 다시 그리지 않는다 (헛일 방지)
dgImgs = { plan:'data:image/png;base64,BBB', side:null };
applyStowDg();
fp.style.display = '건드리면안됨';
applyStowDg();
T('같은 도면이면 다시 그리지 않는다', fp.style.display === '건드리면안됨');

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
