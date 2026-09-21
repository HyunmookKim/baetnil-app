// 3.28 — 바뀐 것만 받아오기 (Firestore 읽기 줄이기)
//
// 왜
//  · 지금은 배를 받아올 때마다 열다섯 컬렉션의 문서를 통째로 읽는다.
//    물품만 354개인 배는 한 번에 500번쯤 읽는다.
//  · Firestore 무료 한도는 하루 5만 번. 500으로 나누면 하루 100번.
//    배 스무 척이 하루 세 번씩만 열어도 막힌다. 막히면 다음 날까지 앱이 안 열린다.
//
// 어떻게
//  · 올릴 때 문서마다 _u(올린 시각)를 찍는다. 한 곳(push)에서만 찍는다.
//  · 받아올 때는 _u 가 지난번보다 큰 것만 받는다.
//  · ★ 지운 것은 자국이 안 남는다. 그래서 서버 개수를 함께 세어
//    합친 결과와 개수가 어긋나면 그 컬렉션만 통째로 다시 받는다.
//  · ★ 옛 판 앱이 아직 돌고 있으면 _u 없이 올릴 수 있다. 그러면 못 볼 수 있다.
//    그래서 하루에 한 번은 무조건 통째로 받아 맞춘다.
//  · ★ 로컬 자료가 백업 복원 등으로 바뀌었으면 지난 셈이 못 쓰게 된다.
//    로컬 id 지문을 함께 저장해 두고, 어긋나면 통째로 받는다.
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
// 모듈 안의 push/pull 은 함수 선언이 아니라 객체의 메서드다 (async push(p){ ... }).
// 이름만 보고 잡으면 부르는 자리를 잡아 버리므로 앞 글자까지 본다.
function grabM(s, name){
  const re = new RegExp('(?:^|[\\n{,])\\s*(?:async\\s+)?' + name + '\\s*\\([^)]*\\)\\s*\\{');
  const m = re.exec(s);
  if(!m) return null;
  let d = 0;
  for(let j = m.index + m[0].length - 1; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0) return s.slice(m.index, j + 1); }
  }
  return null;
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const mod = src.slice(src.indexOf('<script type="module">'));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 올릴 때 자국을 남긴다 (한 곳에서만)
{
  const p = grabM(mod, 'push') || '';
  T('올리는 곳이 있다', p.length > 0);
  T('올릴 때 _u 를 찍는다', /_u\s*:/.test(p));
  // ★ 컬렉션마다 따로 찍으면 한 군데는 빠뜨린다. 배치에 넣는 그 자리에서 찍는다.
  T('배치에 넣는 그 한 자리에서 찍는다', /b\.set\(r,[\s\S]{0,120}?_u/.test(p));
  T('한 번 올릴 때 같은 시각을 쓴다', /const \w*[Ss]tamp\w* = /.test(p));
  T('원래 내용을 망가뜨리지 않는다', /Object\.assign\(\{\}/.test(p));
}

// ── 2. 받아올 때 바뀐 것만
{
  T('개수를 세는 기능을 들여온다', /getCountFromServer/.test(mod));
  T('_u 로 거르는 조회가 있다', /where\('_u'/.test(mod));
  const f = grab(mod, 'diffColl') || '';
  T('바뀐 것만 받는 곳이 있다', f.length > 0);
  T('바뀐 것만 받을 때 개수도 함께 센다', /getCountFromServer\(/.test(f));
  // ★ 개수와 조회를 줄줄이 기다리면 열다섯 컬렉션이 서른 번의 왕복이 된다
  T('개수와 조회를 함께 보낸다', /Promise\.all\(/.test(f));
  const g = grab(mod, 'fullColl') || '';
  T('통째로 받는 곳도 있다', g.length > 0);
  T('통째로 받기도 개수를 돌려준다', /n\s*:/.test(g));
  const r = grab(mod, 'rowsOf') || '';
  T('가장 늦은 _u 를 찾는 곳이 있다', r.length > 0);
  // ★ _u 를 앱 자료에 섞으면 화면과 백업에 알 수 없는 값이 들어간다
  T('_u 는 앱으로 넘기기 전에 뗀다', /delete .*_u/.test(r));
  const pl = grabM(mod, 'pull') || '';
  T('받아오기가 지난 셈을 받는다', /pull\(base\)/.test(mod) || /base/.test(pl));
  T('지난 셈이 없으면 통째로 받는다', /fullColl\(/.test(pl));
  T('한 컬렉션만 다시 받는 길이 있다', /pullColl/.test(mod));
  T('열다섯 컬렉션을 나란히 받는다', /Promise\.all\(/.test(pl));
}

// ── 3. 앱이 합친다
{
  const m = grab(js, 'mergeColl') || '';
  T('합치는 곳이 있다', m.length > 0);
  T('통째로 받은 것은 그대로 쓴다', /'full'/.test(m));
  T('바뀐 것은 덮어쓴다', /Map|\[String\(/.test(m));
  let fn = null, err = '';
  try{ fn = new Function(m + '\n return mergeColl;')(); }catch(e){ err = e.message; }
  T('합치기를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!fn);
  if(fn){
    const prev = [{id:'a',v:1},{id:'b',v:1},{id:'c',v:1}];
    const full = fn(prev, { mode:'full', rows:[{id:'x',v:9}] });
    T('통째로 받으면 갈아 끼운다 — ' + JSON.stringify(full), full.length===1 && full[0].id==='x');
    const diff = fn(prev, { mode:'diff', rows:[{id:'b',v:2},{id:'d',v:1}] });
    T('바뀐 것만 받으면 합친다 — ' + diff.length + '개', diff.length === 4);
    T('바뀐 것이 옛것을 덮는다', diff.find(x=>x.id==='b').v === 2);
    T('안 바뀐 것은 그대로 남는다', diff.find(x=>x.id==='a').v === 1);
    T('빈 결과는 옛것을 지우지 않는다', fn(prev, { mode:'diff', rows:[] }).length === 3);
    // ★ 아무것도 안 왔다고 통째로 비우면 배 기록이 사라진다. 실제로 겪은 사고다.
    T('결과가 없으면 손대지 않는다', fn(prev, null).length === 3);
  } else fail += 6;
}

// ── 4. ★ 지운 것을 알아챈다
{
  // 판단은 cloudPull 안에 풀어 두지 않고 따로 모아 둔다 — 그래야 시험할 수 있다
  const c = (grab(js, 'syncReconcile') || '') + (grab(js, 'syncPlan') || '') + (grab(js, 'cloudPull') || '');
  T('합친 개수를 서버 개수와 맞춰 본다', /\.n\b/.test(c) && /length/.test(c));
  T('어긋나면 그 컬렉션을 다시 받는다', /pullColl\(|getFull\(/.test(c));
  // 지문 — 백업 복원 등으로 로컬이 바뀌면 지난 셈을 못 쓴다
  const h = grab(js, 'collHash') || '';
  T('로컬 지문을 만드는 곳이 있다', h.length > 0);
  let hf = null, herr = '';
  try{ hf = new Function(h + '\n return collHash;')(); }catch(e){ herr = e.message; }
  T('지문을 실제로 만들었다' + (herr ? ' — ' + herr : ''), !!hf);
  if(hf){
    T('같은 목록은 같은 지문', hf([{id:'a'},{id:'b'}]) === hf([{id:'b'},{id:'a'}]));
    T('하나 빠지면 다른 지문', hf([{id:'a'},{id:'b'}]) !== hf([{id:'a'}]));
    T('다른 것이 들어와도 다른 지문', hf([{id:'a'},{id:'b'}]) !== hf([{id:'a'},{id:'c'}]));
    T('빈 목록도 다룬다', typeof hf([]) === 'string');
  } else fail += 4;
  T('지문이 어긋나면 지난 셈을 버린다', /collHash\(/.test(c));
  // ★ 판단을 한 곳에 모아 두어야 가짜 클라우드로 돌려 볼 수 있다
  T('셈 고르기가 따로 있다', !!grab(js, 'syncPlan'));
  T('맞춰 보기가 따로 있다', !!grab(js, 'syncReconcile'));
}

// ── 5. ★ 안전장치 — 하루에 한 번은 통째로
{
  const b = grab(js, 'syncBase') || '';
  T('지난 셈을 꺼내는 곳이 있다', b.length > 0);
  T('배마다 따로 둔다', /currentBoatId|boatId/.test(b));
  const c = (grab(js, 'syncPlan') || '') + (grab(js, 'cloudPull') || '');
  T('오래되면 통째로 받는다', /SYNC_FULL_MS/.test(c));
  // ★ 옛 판 앱이 _u 없이 올릴 수 있다. 그걸 영영 못 보면 안 된다.
  const full = (js.match(/const SYNC_FULL_MS = [^\n]*/) || [''])[0];
  T('통째로 받는 주기가 한 곳에 정해져 있다 — ' + full, full.length > 0);
  // ★ 짧으면 안전장치가 본 작업보다 비싸진다 (12시간이면 100명에 하루 10만 번).
  //   길면 옛 판이 _u 없이 올린 것을 늦게 본다. 하루~열흘 사이가 맞다.
  const ms = Number((full.match(/= ([0-9.e]+)/) || [0,'0'])[1]);
  T('주기가 하루보다 길다 (안전장치가 비용이 되지 않게) — ' + (ms/864e5).toFixed(1) + '일', ms > 864e5);
  T('주기가 열흘을 넘지 않는다 (너무 늦게 알면 안 된다)', ms <= 864e5 * 10);
  // 손으로 누르면 언제든 전부 받을 수 있어야 한다 — 그게 사람이 바로잡는 길이다
  const sd = grab(js, 'syncDown') || '';
  T('손으로 받아오면 지난 셈을 버린다', /clearSyncBase\(/.test(sd));
  const s = grab(js, 'saveSyncBase') || '';
  T('새 셈을 저장하는 곳이 있다', s.length > 0);
  T('개수·시각·지문을 함께 저장한다', /n\s*:/.test(s) && /u\s*:/.test(s) && /h\s*:/.test(s));
}

// ── 6. 셈이 어긋날 수 있는 자리에서는 버린다
{
  const k = grab(js, 'clearSyncBase') || '';
  T('지난 셈을 버리는 곳이 있다', k.length > 0);
  // 백업 복원은 로컬을 통째로 갈아 끼운다. 그 뒤 지난 셈은 거짓이다.
  ['restoreData','restoreBackup','doRestore'].forEach(f=>{
    const g = grab(js, f);
    if(g) T(f + ' 뒤에 지난 셈을 버린다', /clearSyncBase\(/.test(g));
  });
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
