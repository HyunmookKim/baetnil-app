// 나가는 칸을 표 하나로 (4.74)
//
// ★ 이 검사가 지키는 것
//   기록에 새 칸을 만들었는데 표(PUB_OUT)에 안 적으면 **그 칸 이름을 대며 걸린다.**
//   그래야 「적었는데 밖에는 안 나감」 이 구조적으로 안 생긴다.
//   하루에 다섯 번 났던 사고다 — 제원·메모·연락처·웹 공개단계·내리기.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

const TB = (src.match(/const PUB_OUT = \{[\s\S]*?\n\};/)||[''])[0];
T('★★★ 나가는 칸 표가 있다', !!TB);
T('★★★ 표는 하나뿐이다', (src.match(/const PUB_OUT = \{/g)||[]).length === 1);
const TABLE = new Function('return ' + TB.replace('const PUB_OUT = ','').replace(/;\s*$/,''))();
['voyage','mlog','review'].forEach(k => T('★★ ' + k + ' 갈래가 표에 있다', !!TABLE[k]));

// 한 칸이 두 갈래에 겹쳐 적히면 어느 쪽이 참인지 알 수 없다
Object.keys(TABLE).forEach(ty=>{
  const g = TABLE[ty];
  const all = [].concat(g.plain||[], g.via||[], g.never||[]);
  T('★★ ' + ty + ' 에 겹쳐 적힌 칸이 없다', all.length === new Set(all).size,
    all.filter((x,i)=>all.indexOf(x)!==i));
});

// ★★★ 여기가 핵심 — 기록이 실제로 들고 있는 칸이 표에 다 적혀 있는가
function fieldsOf(fnName){
  const f = grab(src, fnName);
  const m = f.match(/const \w+ = \{id:\s*newId\(\)[\s\S]*?\};/);
  if(!m) return [];
  // 값 안의 콜론(시각 '12:30')에 안 걸리게 — 줄 앞이나 쉼표 뒤의 이름만 본다
  return [...new Set((m[0].match(/[{,]\s*([a-zA-Z][\w]*)\s*:/g)||[])
    .map(x => x.replace(/[\s{,:]/g,'')))];
}
const CASES = [
  ['voyage', ['addVoyage','addPlan']],
];
CASES.forEach(([ty, fns])=>{
  const g = TABLE[ty] || {};
  const known = new Set([].concat(g.plain||[], g.via||[], g.never||[]));
  const seen = [...new Set(fns.flatMap(fieldsOf))];
  if(!seen.length){ T('★ ' + ty + ' 만드는 곳을 찾았다', false, fns); return; }
  const miss = seen.filter(k => !known.has(k));
  T('★★★ ' + ty + ' 의 모든 칸이 표에 적혀 있다 (빠진 것 ' + miss.length + '개)',
    miss.length === 0, miss);
});

// 표를 실제로 쓰는가 — 적어만 놓고 안 쓰면 뜻이 없다
T('★★★ 항해일지가 표를 쓴다', /\.\.\.pubPlain\(v, 'voyage'\)/.test(grab(src,'buildPublic')));
T('★★★ 정비수첩이 표를 쓴다', /\.\.\.pubPlain\(x, 'mlog'\)/.test(grab(src,'mlogPublic')));
T('★★★ 사용기가 표를 쓴다',   /\.\.\.pubPlain\(r, 'review'\)/.test(grab(src,'rvPublic')));
T('★★ 담는 곳은 하나다', (src.match(/function pubPlain\(/g)||[]).length === 1);

// 안 나가야 할 것이 실제로 안 나가는가 — 돌려서 본다
{
  const fn = new Function('PUB_OUT', grab(src,'pubPlain') + '\nreturn pubPlain;')(TABLE);
  const v = { id:'v1', title:'개도 한 바퀴', note:'메모', crew:'김선장 010-1234-5678',
              pub:true, pubLv:'com', posOut:{lat:34.7,lon:127.7}, trkPts:[1,2,3], plan:false };
  const o = fn(v, 'voyage');
  T('★★★ 동승자는 안 나간다', !('crew' in o), o);
  T('★★★ 좌표는 그냥 안 나간다 (문을 지나야 한다)', !('posOut' in o) && !('trkPts' in o));
  T('★★ 적어 둔 것은 나간다', o.title === '개도 한 바퀴' && o.note === '메모');
  T('★ 빈 칸은 안 담는다', !('date' in fn({id:'x', date:''}, 'voyage')));
  T('★ 모르는 갈래를 줘도 안 터진다', JSON.stringify(fn({a:1},'zzz')) === '{}');
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
