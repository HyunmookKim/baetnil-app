// 3.15 — 구성원이 사라지는 문제 · 등급에 따른 화면 숨김
//
// 실제로 일어난 일 (사장님)
//  어머니를 크루로 받았는데 회원 명부에 안 나오고 크루도 0명이었다.
//
// 원인 — 승인 자체는 잘 된다. 브라우저에서 그대로 돌려 확인했다.
//   진짜 문제는 그 뒤다.
//   1) 배 문서를 클라우드에 저장하는 __saveBoat 가 실패해도
//      console.warn 만 하고 조용히 넘어간다. 부르는 쪽은 결과를 보지도 않는다.
//      그래서 "구성원으로 받았습니다" 라고 알려 놓고 클라우드에는 안 올라간다.
//   2) 다음에 mergeCloudBoats() 가 돌면 클라우드의 옛 members 로
//      로컬을 통째로 덮어쓴다. 방금 받은 사람이 사라진다.
//
// 정한 것
//  · 배 문서 저장은 한 곳(saveBoatCloud)으로 모은다. 실패하면 알린다.
//  · 못 올린 배는 기억해 두고(대기), 다시 올린다.
//  · 대기 중인 배는 받아오기가 덮지 않는다. 덮으면 방금 한 일이 사라진다.
//  · 내 배 버튼줄은 등급 권한에 따라 안 보이게 한다.
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
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

// ── 1. ★ 배 저장이 조용히 실패하지 않는다
{
  const f = grab(js, 'saveBoatCloud') || '';
  T('배를 클라우드에 저장하는 곳이 한 군데다', f.length > 0);
  T('저장 결과를 본다', /then\(|await/.test(f));
  // ★ 'boatDirty 글자가 있다' 로는 부족하다. 실패한 갈래에서 넣는지 본다.
  //   여기서 안 넣으면 못 올린 채로 잊어버리고, 다음 받아오기가 덮어쓴다.
  T('실패하면 대기 목록에 넣는다',
    /\} else \{[\s\S]{0,120}?boatDirty\.add\(/.test(f));
  T('올라가면 대기 목록에서 뺀다',
    /if\(ok\)\{[\s\S]{0,120}?boatDirty\.delete\(/.test(f));
  T('실패하면 사람에게 알린다', /tell\(|setSync\(/.test(f));
  // ★ 흩어 놓으면 또 빠뜨린다. 직접 부르는 곳이 남아 있으면 안 된다.
  // saveBoatCloud 자기 안에서 부르는 것 하나만 남아야 한다
  const bare = (js.replace(f, '').match(/window\.__saveBoat\(/g) || []).length;
  T('그 한 곳 말고는 직접 부르지 않는다 (남은 것 ' + bare + '곳)', bare === 0);
  T('그 한 곳은 직접 부른다', /window\.__saveBoat\(b\)/.test(f));
  const callers = ['approveJoin','removeMember','editMember','assignRank','createBoat'];
  callers.filter(n => grab(js, n)).forEach(n=>{
    const c = grab(js, n) || '';
    if(/__saveBoat|saveBoatCloud/.test(c))
      T(n + ' 이 그 한 곳을 쓴다', /saveBoatCloud\(/.test(c));
  });
}

// ── 2. ★ 못 올린 배는 받아오기가 덮지 않는다
{
  const m = grab(js, 'mergeCloudBoats') || '';
  T('배 합치기가 있다', m.length > 0);
  // ★ 여기가 사람이 사라진 자리다. 대기 중인 배는 건너뛰어야 한다.
  T('대기 중인 배는 덮지 않는다', /boatDirty\.has\(/.test(m));
  T('대신 다시 올린다', /saveBoatCloud\(/.test(m));
  T('대기 목록이 있다', /const boatDirty|let boatDirty/.test(js));
  // 앱을 껐다 켜도 대기가 남아야 한다 — 안 그러면 못 올린 채로 잊는다
  T('대기 목록을 기기에 남긴다', /bt_boatdirty/.test(js));
  T('켤 때 다시 올린다', !!grab(js, 'retryDirtyBoats'));
  const r = grab(js, 'retryDirtyBoats') || '';
  T('다시 올리기가 그 한 곳을 쓴다', /saveBoatCloud\(/.test(r));
}

// ── 3. 구성원을 받으면 결과를 알려 준다
{
  const a = grab(js, 'approveJoin') || '';
  T('가입 승인이 있다', a.length > 0);
  // ★ 클라우드에 안 올라갔는데 '받았습니다' 라고 하면 안 된다. 다음에 사라진다.
  T('올라간 뒤에 받았다고 알린다',
    /saveBoatCloud\([\s\S]{0,300}?then\(|await saveBoatCloud\(/.test(a));
  T('못 올리면 그렇게 알려 준다', /올리지 못|나중에 다시|저장하지 못/.test(a));
}

// ── 4. ★ 등급에 따라 내 배 버튼이 안 보인다
{
  const m = js.match(/const BOAT_TABS2 = \[[\s\S]*?\];/);
  T('내 배 버튼 목록이 있다', !!m);
  if(m){
    // 버튼마다 어떤 권한이 있어야 보이는지 적혀 있어야 한다
    const WANT = { roster:'roster', ranks:'ranks', board:'board',
                   joins:'members', publish:'publish' };
    Object.entries(WANT).forEach(([k, perm])=>
      T(k + ' 은 ' + perm + ' 권한이 있어야 보인다',
        new RegExp("'" + k + "'[\\s\\S]{0,80}?'" + perm + "'").test(m[0])));
    T('할 일은 누구나 본다 (내 할 일)', /'tasks'[\s\S]{0,80}?null/.test(m[0]));
  } else fail += 6;
  const h = grab(js, 'boatHead') || '';
  // ★ 목록을 그대로 그리면 손님에게도 등급 설정이 보인다. 걸러진 목록을 써야 한다.
  T('버튼줄이 걸러진 목록을 쓴다',
    /boatTabsFor\(/.test(h) && !/BOAT_TABS2\.map/.test(h));
  T('거르는 곳이 권한을 본다', /can\(/.test(grab(js, 'boatTabsFor') || ''));
  // ★ 안 보이게만 하면 보안이 아니다. 눌러도 못 하게 화면도 막아야 한다.
  ['openRanks','openJoinReqs','openPublish'].forEach(fn=>{
    const f = grab(js, fn) || '';
    T(fn + ' 이 열 때 권한을 다시 본다', /can\(/.test(f) && /tell\(|return/.test(f));
  });
}

// ── 5. 권한 판단을 실제로 돌려 본다
{
  const f = grab(js, 'boatTabsFor') || '';
  T('보여 줄 버튼을 고르는 곳이 있다', f.length > 0);
  if(f){
    const m = js.match(/const BOAT_TABS2 = \[[\s\S]*?\];/);
    let out = null, err = '';
    try{
      const fn = new Function('can', 'b', m[0] + '\n' + f + '\n return boatTabsFor;');
      // 선주 — 전부 보인다
      const owner = fn(()=>true)( {} ).map(x=>x[0]);
      // 손님 — 아무 권한 없음
      const guest = fn(()=>false)( {} ).map(x=>x[0]);
      // 크루 — 게시판만
      const crew = fn((b,k)=> k === 'board')( {} ).map(x=>x[0]);
      out = { owner, guest, crew };
    }catch(e){ err = e.message; }
    T('버튼 고르기를 돌렸다' + (err ? ' — ' + err : ''), !!out);
    if(out){
      T('선주는 여섯 개 다 본다 — ' + out.owner.join(','), out.owner.length === 6);
      T('손님은 할 일만 본다 — ' + out.guest.join(','),
        out.guest.length === 1 && out.guest[0] === 'tasks');
      T('크루는 게시판과 할 일만 본다 — ' + out.crew.join(','),
        out.crew.length === 2 && out.crew.includes('board') && out.crew.includes('tasks'));
      T('명부 권한이 없으면 명부 버튼이 없다', !out.guest.includes('roster'));
      T('등급 권한이 없으면 등급 설정 버튼이 없다', !out.crew.includes('ranks'));
    } else fail += 5;
  } else fail += 6;
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
