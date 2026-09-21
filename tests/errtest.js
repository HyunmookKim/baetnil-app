// 3.30 — 클라우드 오류를 있는 그대로 말한다
//
// 실제로 겪은 일
//  하루치 무료 사용량을 다 써서 Firestore 가 429 resource-exhausted 로 막았다.
//  그런데 앱은 '오프라인 · 로컬' 이라고 띄웠다. 인터넷은 멀쩡했는데.
//  게다가 그 상태에서 '클라우드에 이 배의 자료가 없습니다. 507건을 올릴까요?' 를 물었다.
//  없는 게 아니라 못 본 것이다. 여기서 '확인' 을 눌렀으면 남의 기기가 올려 둔
//  진짜 자료 위에 이 기기 것을 덮어쓸 뻔했다.
//
// 정한 것
//  · 오류를 종류대로 갈라 사람 말로 말한다. 한 곳에서만 만든다.
//  · 받아오기가 성공하기 전에는 '자료가 없다' 고 묻지 않는다.
//  · 개수 세기(집계 질의)만 막혀도 동기화 전체가 죽지 않는다.
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
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const mod = src.slice(src.indexOf('<script type="module">'));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 오류를 갈라 말한다
{
  const t = grab(js, 'cloudErrText') || '';
  const h = grab(js, 'cloudErrHelp') || '';
  T('짧은 안내를 만드는 곳이 있다', t.length > 0);
  T('자세한 사연을 만드는 곳이 있다', h.length > 0);
  let R = null, err = '';
  try{
    const T2 = new Function(t + '\n return cloudErrText;')();
    const H2 = new Function(h + '\n return cloudErrHelp;')();
    const k = ['resource-exhausted','permission-denied','unauthenticated','unavailable'];
    R = {};
    k.forEach(c => R[c] = { t: T2({ code:c }), h: H2({ code:c }) });
    R['429원문'] = { t: T2({ message:'POST ... 429 (Too Many Requests)' }) };
    R['없음'] = { t: T2(null), h: H2(null) };
  }catch(e){ err = e.message; }
  T('안내를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!R);
  if(R){
    // ★ 이것이 이번에 사람을 헷갈리게 한 바로 그 자리다
    T('한도 초과를 오프라인이라 하지 않는다 — ' + R['resource-exhausted'].t,
      /한도/.test(R['resource-exhausted'].t) && !/오프라인/.test(R['resource-exhausted'].t));
    T('한도 초과는 429 원문으로도 알아본다 — ' + R['429원문'].t, /한도/.test(R['429원문'].t));
    T('한도 초과 사연에 언제 풀리는지 적는다', /풀립니다|초기화|다시/.test(R['resource-exhausted'].h));
    T('한도 초과 사연에 기록은 안전하다고 적는다', /기기에 있는 기록/.test(R['resource-exhausted'].h));
    T('권한 문제는 권한이라고 말한다 — ' + R['permission-denied'].t, /권한/.test(R['permission-denied'].t));
    T('로그인 풀림은 그렇게 말한다 — ' + R['unauthenticated'].t, /로그인/.test(R['unauthenticated'].t));
    T('진짜 오프라인만 오프라인이라 한다 — ' + R['unavailable'].t, /오프라인/.test(R['unavailable'].t));
    T('알 수 없는 것도 무너지지 않는다', typeof R['없음'].t === 'string' && R['없음'].t.length > 0);
    // 눌러서 볼 수 있어야 한다 — 짧은 줄만으로는 뭘 해야 할지 모른다
    ['resource-exhausted','permission-denied','unauthenticated'].forEach(c=>
      T(c + ' 는 눌러서 확인하라고 알려 준다', /눌러서 확인/.test(R[c].t)));
  } else fail += 11;
}

// ── 2. 그 안내를 실제로 쓴다
{
  const i = grab(js, '__initCloud') || js.slice(js.indexOf('window.__initCloud'), js.indexOf('window.__initCloud') + 500);
  T('연결 실패 때 그 안내를 쓴다', /cloudErrText\(/.test(i));
  T('사연도 남겨 둔다', /cloudErrHelp\(/.test(i));
  // ★ '오프라인 · 로컬' 을 글자 그대로 박아 두면 또 거짓말을 한다
  const bad = [...js.matchAll(/setSync\('오프라인 · 로컬'\)/g)].length;
  T('오프라인이라고 못 박은 자리가 하나뿐이다 (진짜 못 붙었을 때) — ' + bad + '곳', bad <= 1);
  const d = grab(js, 'syncDown') || '';
  T('손으로 받아올 때도 그 안내를 쓴다', /cloudErrText\(|cloudErrHelp\(/.test(d));
}

// ── 3. ★ 못 본 것을 없는 것이라 하지 않는다
{
  const c = grab(js, 'cloudSeedCheck') || '';
  T('첫 올리기를 묻는 곳이 있다', c.length > 0);
  T('받아오기가 끝나기 전에는 묻지 않는다', /if\(!pullDone\) return;/.test(c));
  // 물어보는 말 자체는 그대로여야 한다 — 진짜 빈 클라우드에는 물어야 한다
  T('진짜 비어 있을 때는 여전히 묻는다', /ask\(/.test(c) && /자료가 없습니다/.test(c));
}

// ── 4. 개수 세기만 막혀도 동기화는 산다
{
  const d = grab(mod, 'diffColl') || '';
  T('개수 세기 실패를 삼킨다', /getCountFromServer\(col\(name\)\)\.catch\(/.test(d));
  T('그때는 그 칸만 통째로 받는다', /if\(!cnt\) return await fullColl\(name\);/.test(d));
  // ★ 개수를 모른 채 '맞았다' 고 하면 지운 것을 영영 못 본다
  T('개수를 모른 채 넘어가지 않는다', !/n\s*:\s*0/.test(d));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
