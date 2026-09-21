// A3 — 「형식을 바꿨으면 반드시 올린다」 를 한 곳에서 강제하는지 본다
//
// ★ 왜 이 검사가 있나
//   4.135 사고: 받아온 옛 줄을 폰에서 고쳐 놓고 클라우드에 안 올렸다.
//   다음 받아오기에 고침이 통째로 지워지고, 고치는 문은 「이미 됐다」며 다시 안 손댄다.
//   그때는 체크리스트·적재표 두 군데만 손으로 막았다.
//   형식을 또 바꾸면 또 빠뜨린다 — 그래서 고치는 문을 한 줄에 모으고, 여기서 못 박는다.
//
// ★ 이 검사가 실패하는 가장 흔한 까닭
//   새 고침 문(xxxRepair())을 만들어 놓고 FORMAT_FIXERS 에 안 적었다.
//   → 적으십시오. 손으로 saveLocal()·pushWanted 를 챙기지 마십시오.
const fs = require('fs');
const APP = process.argv[2] || 'work.html';
const h = fs.readFileSync(APP, 'utf8');
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : (fail++, console.log('★ 실패:', n)); };

function fn(name){
  let i = h.indexOf('async function ' + name + '(');
  if(i < 0) i = h.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, st = false;
  for(let j = i; j < h.length; j++){
    const c = h[j];
    if(c === '{'){ d++; st = true; }
    else if(c === '}'){ d--; if(st && d === 0) return h.slice(i, j + 1); }
  }
  return h.slice(i);
}

// ── 1. 문이 있다
const reg = (h.match(/const FORMAT_FIXERS = \[[\s\S]*?\];/) || [''])[0];
t('FORMAT_FIXERS 목록이 있다', !!reg);
const gate = fn('runFormatFixers');
t('runFormatFixers() 가 있다', !!gate);

// ── 2. 문이 제 할 일을 한다
t('목록을 하나씩 돌린다', /FORMAT_FIXERS\.forEach/.test(gate));
t('하나라도 고쳤으면 저장한다', /saveLocal\(\)/.test(gate));
t('하나라도 고쳤으면 올린다',  /pushWanted = true/.test(gate));
t('저장과 올리기가 같은 자리에 있다 — 하나만 하면 4.135 가 또 난다',
  /\{\s*saveLocal\(\);\s*pushWanted = true;\s*\}/.test(gate));
t('한 문이 터져도 나머지를 돌린다', /catch\s*\(e\)/.test(gate) && /forEach/.test(gate));
t('터진 것을 조용히 넘기지 않는다', /showErr\(/.test(gate));

// ── 3. 받아오기는 오직 이 문만 부른다
// ★ loadBoatData 는 너무 커서 괄호로 잘라내면 틀리기 쉽다.
//   받아오기가 끝나는 자리(pullDone)부터 올리는 자리까지만 본다.
const i1 = h.indexOf('pullDone = true;');
const i2 = h.indexOf('if(pushWanted){ pushWanted = false; schedulePush(); }', i1 > 0 ? i1 : 0);
const load = (i1 > 0 && i2 > i1) ? h.slice(i1, i2) : '';
t('받아오기가 끝나는 자리를 찾았다', !!load);
t('받아온 뒤 runFormatFixers() 를 부른다', /runFormatFixers\(\)/.test(load));
t('받아오기가 고침 문을 직접 부르지 않는다',
  !/\bckRepair\s*\(/.test(load) && !/\bitemRepair\s*\(/.test(load));

// ── 4. ★ 강제 — 인자 없는 고침 문은 모두 목록에 적혀 있어야 한다
//    (gearRepair(id) 처럼 인자를 받는 것은 형식 고침이 아니라 그냥 조회다)
const fixers = [...h.matchAll(/\n(?:async )?function ([A-Za-z0-9_]*Repair)\(\s*\)/g)].map(m => m[1]);
t('고침 문을 하나라도 찾았다', fixers.length > 0);
fixers.forEach(name => {
  t('FORMAT_FIXERS 에 적혀 있다 — ' + name,
    new RegExp("name:\\s*'" + name + "'").test(reg) && new RegExp("\\b" + name + "\\(\\)").test(reg));
});
// 목록에 적힌 것이 실제로 있는 함수인가 (이름만 적고 함수는 안 만든 경우)
[...reg.matchAll(/name:\s*'([A-Za-z0-9_]+)'/g)].map(m => m[1]).forEach(name => {
  t('적힌 문이 실제로 있다 — ' + name, !!fn(name));
});

// ── 5. 고침 문은 「고쳤나」를 참·거짓으로 돌려준다 (안 돌려주면 올릴 때를 모른다)
fixers.forEach(name => {
  const b = fn(name);
  t('고쳤는지 알려 준다 — ' + name, /return\s+[^;]*;/.test(b));
});

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail ? 1 : 0);
