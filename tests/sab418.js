// 4.18 안전장치 부수기 — 검사가 진짜 잡는지 확인한다.
// ★ 검사가 통과하는 것만으로는 모른다. 지키라는 것을 하나씩 없애 보고
//   그때마다 검사가 빨간불을 켜야 검사가 살아 있는 것이다.
const fs = require('fs'), cp = require('child_process');
const SRC = fs.readFileSync('work.html', 'utf8');
let ok = 0, bad = 0;

const CASES = [
  ['저장할 때 연재 이름을 뺀다',
   "            sname: String(v.sname||'').trim(),\n", '',
   'sgrouptest.js'],
  ['묶는 문을 없앤다 (목록이 옛날처럼 편 번호로만 줄 선다)',
   'return add + seriesGroups(rows).map(g=>', 'return add + [{name:"",items:rows}].map(g=>',
   'sgrouptest.js'],
  ['글 아래 다른 편 목록을 뗀다',
   '\n    ${seriesAlso(x)}`;', '`;',
   'sgrouptest.js'],
  ['저장에서 시간 제한을 벗긴다',
   'const setDoc    = (...a)=> netWait(_setDoc(...a),    NET_SEC);',
   'const setDoc    = _setDoc;',
   'sgrouptest.js'],
  ['사진 올리기에서 시간 제한을 벗긴다',
   'const uploadString   = (...a)=> netWait(_uploadString(...a),   NET_PHOTO);',
   'const uploadString   = _uploadString;',
   'sgrouptest.js'],
  ['못 받아 온 것을 다시 빈 목록으로 적어 둔다',
   "  try{ seriesList = await window.__series.list(); }\n  catch(e){ seriesList = null; return []; }",
   "  try{ seriesList = await window.__series.list(); }catch(e){ seriesList = []; }",
   'serieslive.js'],
  // ★ 연재 쪽만 뗀다 — 글판에도 같은 줄이 있어서 그냥 지우면 두 군데가 걸린다.
  ['연재에서 실패해도 창을 도로 안 연다',
   '          formReopen();          // 쓴 글을 날리지 않는다\n        }\n      })();\n    }\n  });\n}\nfunction delSeries(id){',
   '        }\n      })();\n    }\n  });\n}\nfunction delSeries(id){',
   'serieslive.js'],
  ['묶음 안 차례를 뒤집는다 (3편이 1편보다 위로)',
   'items.sort((a,b)=> (Number(a.no)||0) - (Number(b.no)||0)',
   'items.sort((a,b)=> (Number(b.no)||0) - (Number(a.no)||0)',
   'serieslive.js'],
  ['이름 없는 옛 글을 맨 위로 올린다',
   "    if(!a.name !== !b.name) return a.name ? -1 : 1;   // 이름 없는 묶음은 맨 아래",
   "    if(!a.name !== !b.name) return a.name ? 1 : -1;",
   'serieslive.js'],
  ['다른 연재의 편까지 섞어서 붙인다',
   '  const g = seriesGroups().find(z => z.name === name);\n  const items = (g && g.items) || [];',
   '  const items = (seriesList||[]).slice();',
   'serieslive.js'],
  ['오류에서 자리(파일·줄)를 다시 버린다',
   "window.addEventListener('error', e=>showErr(errWhere(e)));",
   "window.addEventListener('error', e=>showErr(e.message||'x'));",
   'errsendtest.js'],
];

for(const [name, from, to, test] of CASES){
  if(SRC.indexOf(from) < 0){
    console.log('※ 못 부숨(글이 안 맞는다): ' + name); bad++; continue;
  }
  if(SRC.split(from).length - 1 !== 1){
    console.log('※ 못 부숨(여러 군데): ' + name); bad++; continue;
  }
  fs.writeFileSync('work.sab.html', SRC.replace(from, to));
  const r = cp.spawnSync('node', [test, 'work.sab.html'],
                         { encoding:'utf8', env:Object.assign({}, process.env, {TZ:'Asia/Seoul'}) });
  const caught = r.status !== 0;
  if(caught){ ok++; console.log('잡음  ← ' + name + '   (' + test + ')'); }
  else { bad++; console.log('★ 못 잡음 ← ' + name + '   (' + test + ')'); }
}
try{ fs.unlinkSync('work.sab.html'); }catch(_){}
console.log(`\n부순 것 ${CASES.length}개 중 ${ok}개를 검사가 잡았다 / 놓친 것 ${bad}개`);
process.exit(bad ? 1 : 0);
