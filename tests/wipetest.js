// 3.47 — 계정 지우기 (탈퇴)
//
// 왜
//  · 약관에는 '이용자는 언제든 탈퇴할 수 있습니다' 라고 적어 두고 앱에 그 버튼이 없었다.
//    말과 앱이 다른 것부터가 문제다.
//  · 플레이스토어·앱스토어 둘 다 '앱 안에서 계정을 지울 수 있을 것' 을 요구한다.
//    없으면 심사를 통과하지 못한다.
//
// ★ 되돌릴 수 없는 일이다. 이 검사가 지키는 것 셋
//  1. 무엇이 사라지는지 먼저 보여 준다 — 모르고 누르면 안 된다
//  2. 정해진 글자를 그대로 적어야 지운다 — 확인 창 한 번으로는 잘못 눌린다
//  3. 계정을 못 지웠으면 기기 자료도 지우지 않는다 — 사람만 붕 뜬다
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
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(e){}

let pass = 0, fail = 0;
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 길이 있나
{
  T('계정 화면에 지우는 자리가 있다', /onclick="openWipe\(\)"/.test(js));
  const oa = grab(js, 'openAccount') || '';
  // ★ 지우는 줄은 wipeLink() 로 빠졌다. 그 줄이 if(me) 갈래 안에만 있어야 한다
  //   (로그인 안 한 사람 화면에 지우는 단추가 나오면 안 된다).
  const wl = grab(js, 'wipeLink') || '';
  const iMe = oa.indexOf('if(me)'), iWl = oa.indexOf('wipeLink()'), iEl = oa.indexOf('} else {');
  T('로그인한 사람에게만 보인다',
    /onclick="openWipe\(\)"/.test(wl) && iMe >= 0 && iWl > iMe && iEl > iWl
    && oa.slice(iEl).indexOf('wipeLink()') < 0);
  const w = grab(js, 'openWipe') || '';
  T('지우기 화면이 있다', w.length > 0);
  T('로그인 안 했으면 막는다', /로그인한 상태에서만/.test(w));
}

// ── 2. ★ 무엇이 사라지는지 먼저 보여 준다
{
  const w = grab(js, 'openWipe') || '';
  T('내 배가 몇 척인지 말한다', /myOwnBoats\(\)/.test(w) && /척/.test(w));
  T('배 기록이 사라진다고 말한다', /물품·정비·수리/.test(w));
  T('커뮤니티 글이 몇 개인지 센다', /minePosts\(false\)/.test(w));
  T('기기 기록도 지운다고 말한다', /기기에 저장된 기록/.test(w));
  // ★ 되돌릴 수 없다는 말이 없으면 아무도 조심하지 않는다
  T('되돌릴 수 없다고 말한다', /되돌릴 수 없습니다/.test(w));
  T('백업을 먼저 받게 한다', /backupData\(\)/.test(w));
  // ★ 남의 배에 얹혀 있는 경우 — 그 배는 안 지워진다. 그걸 말해 줘야 한다.
  T('남의 배는 안 지워진다고 말한다', /guestBoats\(\)/.test(w) && /지워지지 않습니다/.test(w));
  T('남의 댓글도 함께 사라진다고 말한다', /남의 댓글/.test(w));
  // 숫자 세기가 늦어도 화면은 먼저 떠야 한다
  T('세는 동안 화면이 먼저 뜬다', w.indexOf('showPanel(P)') < w.indexOf('minePosts(false)'));
  T('못 세도 화면이 안 무너진다', /셀 수 없음/.test(w));

  const mo = grab(js, 'myOwnBoats') || '', gb = grab(js, 'guestBoats') || '';
  T('내 배와 남의 배를 가른다', mo.length > 0 && gb.length > 0);
  // ★ 선주가 아닌 배를 내 것으로 세면, 지우려다 남의 배를 건드린다
  T('선주인 배만 내 것으로 센다', /canDelBoat\(b\)/.test(mo));
  T('선주가 아닌 배는 남의 배로 센다', /!canDelBoat\(b\)/.test(gb));
  let F = null;
  try{ F = new Function('boats','canDelBoat', mo + '\n' + gb + '\n return { myOwnBoats, guestBoats };'); }catch(e){}
  T('가르기를 돌렸다', !!F);
  if(F){
    const list = [{ id:1, name:'내배', own:true }, { id:2, name:'남배', own:false }];
    const r = F(list, b => !!b.own);
    T('내 배만 골라낸다 — ' + r.myOwnBoats().map(b=>b.name).join(','),
      r.myOwnBoats().length === 1 && r.myOwnBoats()[0].name === '내배');
    T('남의 배만 골라낸다', r.guestBoats().length === 1 && r.guestBoats()[0].name === '남배');
    const none = F(null, ()=>true);
    T('배가 없어도 안 무너진다', none.myOwnBoats().length === 0);
  } else fail += 3;
}

// ── 3. ★ 글자를 그대로 적어야 지운다
{
  const a = grab(js, 'askWipe') || '';
  T('한 번 더 묻는 곳이 있다', a.length > 0);
  T('글자를 적게 한다', /WIPE_WORD/.test(a) && /openForm\(/.test(a));
  T('그 글자가 한 곳에 정해져 있다', /const WIPE_WORD = '계정을 지웁니다'/.test(js));
  // ★ 4.101 — 적은 글자가 다르면 **그 칸 아래 빨간 한 줄**로 말한다 (창으로 칸을 덮지 않는다)
  T('다르면 지우지 않는다', /글자가 달라서 지우지 않았습니다/.test(a) && /formErr\('word'/.test(a));
  T('맞으면 지운다', /doWipe\(\)/.test(a));
  // ★ 'yes' 나 '삭제' 처럼 손이 먼저 나가는 말이면 안 된다
  const word = (js.match(/const WIPE_WORD = '([^']+)'/) || [])[1] || '';
  T('적어야 하는 말이 짧지 않다 — «' + word + '»', word.length >= 6);
}

// ── 4. 지우는 차례
{
  const d = grab(js, 'doWipe') || '';
  T('지우는 곳이 있다', d.length > 0);
  T('먼저 하는 중이라고 알린다', d.indexOf('wipeSay(') < d.indexOf('delBoatData'));
  T('내 배를 지운다', /delBoatData\(b\.id\)/.test(d) && /__delBoat/.test(d));
  T('커뮤니티 글을 지운다', /minePosts\(true\)/.test(d));
  T('명부 기록을 지운다', /wipeUserDoc\(\)/.test(d));
  T('로그인 계정을 지운다', /removeAuth\(\)/.test(d));
  // ★ 차례가 중요하다 — 계정을 먼저 지우면 그 뒤 클라우드 자료를 못 지운다
  T('클라우드 자료를 계정보다 먼저 지운다',
    d.indexOf('minePosts(true)') < d.indexOf('removeAuth()'));
  T('기기 자료는 맨 나중에 지운다',
    d.indexOf('wipeLocal()') > d.indexOf('removeAuth()'));
  // ★ 계정을 못 지웠는데 기기까지 비우면 사람만 붕 뜬다
  T('다시 로그인이 필요하면 거기서 멈춘다',
    /if\(r === 'relogin'\)/.test(d) && d.indexOf("r === 'relogin'") < d.indexOf('wipeLocal()'));
  T('멈췄을 때 무엇을 하라고 알려 준다', /다시 로그인/.test(d) && /로그아웃/.test(d));
  T('이미 지운 것은 지웠다고 말해 준다', /이미 지웠습니다/.test(d));
  T('끝나면 알려 준다', /계정을 지웠습니다/.test(d));
  T('한 걸음마다 넘어져도 계속 간다', (d.match(/catch\(_\)\{\}/g) || []).length >= 3);

  const wl = grab(js, 'wipeLocal') || '';
  T('기기 자료를 지우는 곳이 있다', wl.length > 0);
  T('앱이 쓰는 것만 지운다', /indexOf\('bt_'\) === 0/.test(wl));
  T('기기 저장고도 지운다', /deleteDatabase\('baetnil'\)/.test(wl));
  // 사진은 내 사진이니 함께 지운다. 지도 타일은 내 것이 아니라 남긴다.
  T('내 사진 저장분도 지운다', /baetnil-photos/.test(wl));
  T('지도 타일은 남긴다', !/baetnil-tiles/.test(wl));
}

// ── 5. 클라우드 창구
{
  T('계정 창구가 있다', /window\.__account = \{/.test(mod));
  const seg = mod.slice(mod.indexOf('window.__account'), mod.indexOf('window.__auth = {'));
  T('세기와 지우기를 한 곳에서 한다', /async minePosts\(del\)/.test(seg));
  T('세 곳을 다 본다', /'community', ?'spots', ?'market'/.test(seg));
  T('내가 올린 것만 본다', /where\('by','==',uid\)/.test(seg));
  T('명부 기록을 지운다', /deleteDoc\(doc\(fdb, 'users', uid\)\)/.test(seg));
  T('로그인 계정을 지운다', /deleteUser\(fauth\.currentUser\)/.test(seg));
  T('오래된 로그인은 알려 준다', /requires-recent-login/.test(seg) && /'relogin'/.test(seg));
  // ★ 들여오는 목록의 차례는 바뀔 수 있다. 「auth 들여오기 묶음 안에 있는가」 를 본다.
  // ★ 5.6 — 들여오기가 받기() 문을 지나게 바뀌었다 (어느 파일이 안 왔는지 남기려고).
  //   둘 다 받는다 — 보는 것은 「auth 묶음 안에 deleteUser 가 있는가」 다.
  const imp = (mod.match(/const \{[^}]*\} =\s*\n?\s*await (?:import|받기\([^,]+,\s*)\s*\(?'[^']*firebase(?:-|\/)auth\.js'\)/) || [''])[0];
  T('deleteUser 를 들여온다', /\bdeleteUser\b/.test(imp));
  // ★ 한 곳이 막혀도 나머지는 지워야 한다
  T('한 곳이 막혀도 넘어간다', /catch\(_\)\{ continue; \}/.test(seg));
}

// ── 6. 규칙이 실제로 지우게 해 주나
if(rules){
  const u = rules.slice(rules.indexOf('match /users/{uid}'), rules.indexOf('match /users/{uid}') + 400);
  T('내 명부 기록을 내가 지울 수 있다',
    /allow delete: if signedIn\(\) && request\.auth\.uid == uid/.test(u));
  const b = rules.slice(rules.indexOf('match /boats/{boatId}'), rules.indexOf('match /boats/{boatId}') + 2200);
  T('내 배는 선주가 지울 수 있다', /allow delete: if isOwner\(boatId\)/.test(b));
  ['community','spots','market'].forEach(n=>{
    // 3.61 에서 댓글·좋아요 방이 붙어 블록이 길어졌다. 넉넉히 잘라 본다.
    const g = rules.slice(rules.indexOf('match /' + n + '/'), rules.indexOf('match /' + n + '/') + 7000);
    T(n + ' 글은 올린 사람이 지울 수 있다',
      /allow delete: if signedIn\(\)[\s\S]{0,120}?resource\.data\.by == request\.auth\.uid/.test(g));
  });
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (5건)'); fail += 5; }

// ── 7. 약관과 앱이 같은 말을 하나
{
  T('약관에 탈퇴할 수 있다고 적혀 있다', /언제든 탈퇴할 수 있습니다/.test(js));
  // ★ 약관에만 있고 앱에 없으면 거짓말이다. 그래서 이 판을 만들었다.
  T('그 말대로 앱에 길이 있다', /function openWipe\(/.test(js));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
