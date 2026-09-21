// 서버 함수의 하루 한도 — 코드를 읽는 것이 아니라 진짜로 돌려 본다.
//
// ★ 왜 이 검사가 있나
//   번역은 부를 때마다 돈이 나간다. 사람마다 하루 한도(DAY_CAP)를 두었는데,
//   세는 곳이 뉴스(trText) 에만 붙어 있고 글·댓글 번역(tr) 에는 통째로 빠져 있었다.
//   그래서 한 사람이 글을 계속 열어 얼마든지 요금을 태울 수 있었다.
//
//   그리고 옮기다 실패한 것을 '옮겨 둔 것' 으로 담아 두고 있었다.
//   그러면 다음 날 한도가 풀려도 그 글은 영영 원문으로만 보인다.
//
//   여기서는 가짜 파이어스토어와 가짜 번역기를 물려서 함수를 실제로 돌린다.
const fs = require('fs');
const a = process.argv[2];
const FN = (!a || /\.html$/.test(a)) ? 'fn/functions/index.js' : a;
const src = fs.readFileSync(FN, 'utf8');

let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };

const num = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*(\\d+)')); return m ? Number(m[1]) : null; };
const DAY_CAP = num('DAY_CAP'), TXT_TOTAL = num('TXT_TOTAL'),
      CMT_TOTAL = num('CMT_TOTAL'), MAX = num('MAX'), CMT_ONE = num('CMT_ONE');

// ── ① 한도끼리 앞뒤가 맞는가
T('하루 한도가 있다 — ' + DAY_CAP, DAY_CAP > 0);
T('★ 뉴스 한 번 분량이 하루 한도보다 작다 (아니면 뉴스 번역이 늘 막힌다) — '
  + TXT_TOTAL + ' ≤ ' + DAY_CAP, TXT_TOTAL <= DAY_CAP, {TXT_TOTAL, DAY_CAP});

// ── ② 함수를 진짜로 꺼내 돌린다
function grabFn(name){
  const i = src.indexOf('async function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
class FakeErr extends Error { constructor(code, msg){ super(msg); this.code = code; } }
// 가짜 파이어스토어 — 문서 하나짜리
function fakeDb(store){
  return { doc: p => ({
    get: async () => ({ exists: store[p] !== undefined, data: () => store[p] }),
    set: async v => { store[p] = v; }
  }) };
}
const HELPERS = [grabFn('spendLeft'), grabFn('spendAdd'), grabFn('spend')].join('\n');
T('spendLeft · spendAdd · spend 셋을 다 꺼냈다',
  /spendLeft/.test(HELPERS) && /spendAdd/.test(HELPERS) && /async function spend\(/.test(HELPERS));

const mk = () => {
  const store = {};
  const fns = new Function('HttpsError', 'DAY_CAP',
    HELPERS + '; return { spendLeft, spendAdd, spend };')(FakeErr, DAY_CAP);
  return { store, ...fns, db: fakeDb(store) };
};

const HAVE = /async function spendLeft\(/.test(src) && /async function spendAdd\(/.test(src);

(async () => {
 if(!HAVE){
   ['처음에는 하루치가 다 남아 있다','쓴 만큼 줄어든다',
    '★ 하루치보다 크면 아예 시작하지 않는다','막을 때 「다 썼다」 라고 알려 준다',
    '막혔으면 쓴 것으로 안 센다','하루치와 딱 같으면 들어간다','그 뒤로는 남은 것이 없다',
    '★ 한 글자도 더 안 받는다','날이 바뀌면 다시 하루치가 생긴다','사람마다 따로 센다']
     .forEach(n => T(n, false, 'spendLeft/spendAdd 가 없어 돌려 볼 수 없다'));
 } else {
  // ㉮ 처음에는 다 남아 있다
  {
    const F = mk();
    const q = await F.spendLeft(F.db, 'u1');
    T('처음에는 하루치가 다 남아 있다', q.left === DAY_CAP && q.used === 0, q);
    await F.spendAdd(q, 500);
    const q2 = await F.spendLeft(F.db, 'u1');
    T('쓴 만큼 줄어든다', q2.used === 500 && q2.left === DAY_CAP - 500, q2);
  }
  // ㉯ 넘으면 막는다
  {
    const F = mk();
    let threw = null;
    try { await F.spend(F.db, 'u1', DAY_CAP + 1); } catch(e){ threw = e; }
    T('★ 하루치보다 크면 아예 시작하지 않는다', !!threw, threw && threw.message);
    T('막을 때 「다 썼다」 라고 알려 준다',
      !!threw && threw.code === 'resource-exhausted', threw && threw.code);
    const q = await F.spendLeft(F.db, 'u1');
    T('막혔으면 쓴 것으로 안 센다', q.used === 0, q);
  }
  // ㉰ 딱 맞는 것은 들어간다
  {
    const F = mk();
    let threw = null;
    try { await F.spend(F.db, 'u1', DAY_CAP); } catch(e){ threw = e; }
    T('하루치와 딱 같으면 들어간다', threw === null, threw && threw.message);
    const q = await F.spendLeft(F.db, 'u1');
    T('그 뒤로는 남은 것이 없다', q.left === 0, q);
    let t2 = null;
    try { await F.spend(F.db, 'u1', 1); } catch(e){ t2 = e; }
    T('★ 한 글자도 더 안 받는다', !!t2, t2 && t2.message);
  }
  // ㉱ 날이 바뀌면 되살아난다
  {
    const F = mk();
    await F.spend(F.db, 'u1', DAY_CAP);
    F.store['trquota/u1'].day = '2000-01-01';       // 어제 것으로 바꾼다
    const q = await F.spendLeft(F.db, 'u1');
    T('날이 바뀌면 다시 하루치가 생긴다', q.left === DAY_CAP && q.used === 0, q);
  }
  // ㉲ 사람마다 따로 센다
  {
    const F = mk();
    await F.spend(F.db, 'u1', DAY_CAP);
    const q = await F.spendLeft(F.db, 'u2');
    T('사람마다 따로 센다', q.left === DAY_CAP, q);
  }

 }
  // ── ③ 글 번역(tr) 이 하루 한도를 세는가 — 코드로 확인
  const tr = (() => {
    const i = src.indexOf("exports.tr = onCall(");
    if(i < 0) return '';
    let d = 0, j = src.indexOf('(', i);
    for(; j < src.length; j++){ if(src[j]==='(') d++; else if(src[j]===')'){ d--; if(!d){ j++; break; } } }
    return src.slice(i, j);
  })();
  T('★ 글 번역도 하루 한도를 본다 (여기가 통째로 빠져 있었다)', /await spendLeft\(/.test(tr));
  T('★ 남은 것이 없으면 막는다', /q\.left <= 0[\s\S]{0,120}resource-exhausted/.test(tr));
  T('★ 남은 양 안에서만 옮긴다 (본문)', /if \(used >= q\.left\) break;/.test(tr));
  T('★ 남은 양 안에서만 옮긴다 (댓글)', /if \(used \+ cUsed >= q\.left\) break;/.test(tr));
  T('★ 끝나고 쓴 만큼 적는다', /await spendAdd\(q, used\)/.test(tr));
  T('담아 둔 것을 먼저 보고, 새로 옮길 것이 없으면 한도를 안 깎는다',
    tr.indexOf('const kept =') < tr.indexOf('await spendLeft(')
    && /if \(kept && !need\.length && !wantN\) return kept;/.test(tr));

  // ── ④ 실패한 것을 '옮겨 둔 것' 으로 굳히지 않는가
  T('★ 담아 둔 것에 없는 칸만 다시 옮긴다 (실패한 칸이 다음에 다시 온다)',
    /if \(kept && kept\[f\] != null\) return;/.test(tr));
  T('예전처럼 「담아 둔 것이 있으면 글은 통째로 건너뛰기」 가 아니다',
    !/const want = \{\};\s*\n\s*if \(!kept\) \{/.test(tr));

  const txt = (() => {
    const i = src.indexOf("exports.trText = onCall(");
    if(i < 0) return '';
    let d = 0, j = src.indexOf('(', i);
    for(; j < src.length; j++){ if(src[j]==='(') d++; else if(src[j]===')'){ d--; if(!d){ j++; break; } } }
    return src.slice(i, j);
  })();
  T('★ 뉴스도 한 도막이라도 실패하면 담아 두지 않는다',
    /missed = true/.test(txt) && /if \(!missed\) await cache\.set\(body\)/.test(txt));

  // ── ⑤ 올릴 때 막히지 않게 — 맨 바깥에서 오래 걸리는 일을 하지 않는다
  //    ★ new Translate() 를 맨 바깥에 두면 자격을 찾느라 시간이 걸려
  //      「User code failed to load … Timeout after 10000」 으로 올리기가 막힌다.
  T('★ 번역기를 맨 바깥에서 바로 만들지 않는다', !/^const tx = new Translate\(\);$/m.test(src));
  T('처음 쓸 때 만든다', /_tx \|\| \(_tx = new Translate\(\)\)/.test(src));
  T('부르는 곳이 모두 tx() 로 바뀌었다',
    !/[^)]\btx\.translate\(/.test(src) && (src.match(/tx\(\)\.translate\(/g) || []).length === 3,
    (src.match(/tx\(\)\.translate\(/g) || []).length);

  console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
})();
