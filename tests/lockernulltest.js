// ★ 5.7 — 4.138 에서 올라온 오류: updateHeader ← openLocker (적재표 화면이 없는데 불림)
//   화면이 없을 때 openLocker·resetForm·renderPhotoPreview 가 죽지 않는가 — 실제로 돌려 본다.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const fn = name => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(i, j + 1); } } };
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x ? '\n' + x : '')); } };
const ctx = { document:{ getElementById: () => null }, formPhotos:[], inBox:null, selected:null, editId:null, moveId:null, mergeId:null,
  t: s => s, esc: s => s, setTxt(){}, gearSelSync(){}, getLocker(){ return null; }, getItem(){ return null; },
  lkPath(){ return ''; }, lkZone(){ return ''; }, renderPanelItems(){}, refreshBoxes(){}, called:[] };
vm.createContext(ctx);
for(const n of ['openLocker', 'resetForm', 'renderPhotoPreview', 'updateHeader']) vm.runInContext(fn(n), ctx);
for(const n of ['openLocker', 'resetForm', 'renderPhotoPreview']){
  let err = ''; try{ vm.runInContext(n + "('L1')", ctx); }catch(e){ err = e.message; }
  T('★★ 화면이 없어도 ' + n + ' 가 죽지 않는다', !err, err);
}
T('고른 칸은 기억해 둔다', vm.runInContext('selected', ctx) === 'L1');
console.log(`\n합계: ${pass}개 통과 / ${fail}개 실패`); process.exit(fail ? 1 : 0);
