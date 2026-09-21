// 3.9 — 최고 운영자 · 사람 명부 · 사람 막기 · 배 조치
//
// 정한 것
//  · 최고 운영자(owner)는 앱으로 절대 못 건드린다. 권한 조정도 해임도 안 된다.
//    콘솔에서 owner 표시를 옮겨야만 바뀐다 (나중에 앱이 팔릴 때).
//  · 사람 명부는 운영자만 본다.
//  · 글판 글쓴이를 눌러 그 사람 화면으로 갈 수 있다 — 운영자에게만.
//  · 권한 항목: 글 지우기 / 배 감추기·지우기 / 사람 막기 / 운영자 임명
//
// ★ 화면에서 감추는 것은 보안이 아니다. 콘솔에서 함수를 부를 수 있다.
//   진짜 방어선은 규칙이다. 그래서 여기서도 규칙을 더 세게 본다.
//   특히 '최고 운영자는 못 건드린다' 는 규칙에서 막혀야 진짜다.
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
const seg = k => (rules.match(new RegExp('match /' + k + '/\\{[a-zA-Z]+\\}[\\s\\S]*?\\n    \\}')) || [''])[0];
// 주석을 걷어낸 뒤 allow 줄만 뽑는다 (주석에 적은 말에 헛통과하면 안 된다)
const allows = seg2 => seg2.split('\n').map(l=>l.replace(/\/\/.*$/, '')).join('\n')
  .split(/allow /).slice(1).map(x => x.split(';')[0]);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 최고 운영자 — 앱 쪽
{
  T('최고 운영자인지 보는 곳이 한 군데다', !!grab(js, 'isOwnerAdmin'));
  const io = grab(js, 'isOwnerAdmin') || '';
  T('owner 표시로 판단한다', /owner/.test(io));
  // ★ 계정을 코드에 박으면 앱을 다시 내려야 바꿀 수 있다. 문서의 owner 표시로 해야 한다.
  const hard = (js.match(/'[A-Za-z0-9_-]{24,40}'/g) || [])
    .filter(x => /[a-z]/.test(x) && /[A-Z]/.test(x) && /[0-9]/.test(x));
  T('최고 운영자 계정을 코드에 박지 않는다 — 찾은 것: ' + (hard.slice(0,2).join(', ') || '없음'),
    hard.length === 0);

  // ★ 검사를 함수마다 베껴 두면 한 군데만 고치고 나머지를 빠뜨린다.
  //   한 곳(adminGuard)에 모으고, 손대는 함수가 전부 그것을 쓰는지 이름까지 찍어서 본다.
  const g = grab(js, 'adminGuard') || '';
  T('최고 운영자 보호가 검사 안에 있다', /isOwnerAdmin\(/.test(g));
  T('왜 못 하는지 알려준다', /최고 운영자/.test(g));
  const touch = ['adminSetPerm','adminRemove','adminAdd','personPerm','personAppoint','personRemove']
    .filter(fn => grab(js, fn));
  T('운영자 문서를 손대는 함수를 찾았다', touch.length >= 3);
  T('손대는 함수가 전부 그 검사를 쓴다 — 안 쓰는 것: '
    + (touch.filter(fn => !/adminGuard\(/.test(grab(js, fn) || '')).join(', ') || '없음'),
    touch.length >= 3 && touch.every(fn => /adminGuard\(/.test(grab(js, fn) || '')));
}

// ── 2. 최고 운영자 — ★ 진짜 방어선 (규칙)
if(rules){
  const a = seg('admins');
  T('운영자 문서 규칙이 있다', a.length > 0);
  const up = allows(a).filter(x=>/^update/.test(x)).join(' ');
  const de = allows(a).filter(x=>/^delete/.test(x)).join(' ');
  const cr = allows(a).filter(x=>/^create/.test(x)).join(' ');
  T('최고 운영자 문서는 고치지 못한다 (규칙)',
    /resource\.data\.get\('owner', ?false\) ?!= ?true/.test(up));
  T('최고 운영자 문서는 지우지 못한다 (규칙)',
    /resource\.data\.get\('owner', ?false\) ?!= ?true/.test(de));
  T('앱으로는 최고 운영자를 새로 만들지 못한다 (규칙)',
    /request\.resource\.data\.get\('owner', ?false\) ?!= ?true/.test(cr));
  T('고치면서 몰래 최고 운영자가 되지 못한다 (규칙)',
    /request\.resource\.data\.get\('owner', ?false\) ?!= ?true/.test(up));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (5건)'); fail += 5; }

// ── 2-2. 첫 운영자 세우기 — ★ 여기가 제일 위험하다
//   운영자 문서를 만들려면 임명 권한이 필요한데 맨 처음엔 아무도 운영자가 아니다.
//   그래서 딱 한 사람만 자기 문서를 스스로 세우게 연다. 그 구멍이 좁아야 한다.
{
  const co = grab(js, 'claimOwner') || '';
  T('첫 운영자 세우기를 시도하는 곳이 있다', co.length > 0);
  T('운영자 문서가 없을 때만 시도한다', /if\(!adminMe\) adminMe = await claimOwner\(\)/.test(grab(js,'loadAdmin')||''));
  // ★ 'adminClaimTried 글자가 있다' 로는 부족하다. 표시만 하고 안 돌아서면 매번 두드린다.
  T('한 번만 시도한다 (매번 두드리지 않는다)',
    /if\(adminClaimTried\) return null;[\s\S]{0,40}?adminClaimTried = true;/.test(co));
  T('거절당해도 조용히 넘어간다', /catch\(e\)\s*\{\s*return null/.test(co));
  // ★ 앱이 누가 주인인지 알면 안 된다. 그 판단은 규칙이 한다.
  // ★ 고객센터 주소는 공개하라고 있는 것이다 (SUPPORT_MAIL).
  //   문제는 그 주소로 앱이 '이 사람이 주인이다' 를 판단하는 것이다.
  //   그 판단은 규칙만 한다. 앱이 하면 브라우저에서 고쳐서 뚫린다.
  const mails = [...js.matchAll(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g)].map(m=>m[0]);
  const lines = js.split('\n').filter(l=>/[\w.+-]+@[\w.-]+\.[a-z]{2,}/.test(l));
  //
  // ★ 아래 두 자리는 **사람의 주소가 아니다** — 코드를 열어 확인했다.
  //   ① @privaterelay.appleid.com — 애플이 메일을 감춘 사람에게 내주는 가림 주소의
  //      **도메인**이다. myName() 이 「이 도메인이면 이름으로 쓰지 않는다」 고 가려내려고
  //      적어 둔 글자이고, 앞에 붙은 xxxx 는 주석에 쓴 자리표다 (실제 주소가 아니다).
  //   ② example.com — RFC 2606 이 예시용으로 못 박아 둔 도메인이다.
  //      로그인 칸(acEm) placeholder 로만 쓴다. 갈 데가 없는 주소다.
  //   그래서 이 두 도메인**만** 봐 준다. 다른 주소가 하나라도 박히면 그대로 실패한다.
  const 봐줄도메인 = /@(privaterelay\.appleid\.com|example\.com)$/;
  const 새는가 = l => [...l.matchAll(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/g)]
    .some(m => !봐줄도메인.test(m[0]));
  T('앱에 박힌 메일 주소는 고객센터 주소뿐이다 — ' + mails.join(','),
    // ★ LEGAL_OWNER 는 여러 줄짜리 덩이라 email: 줄에 이름이 안 붙는다.
    //   주소를 '적어 둔 것' 은 괜찮다. 막아야 할 것은 그 주소로 주인을 따지는 것이고,
    //   그건 바로 아래 검사가 본다.
    lines.every(l=>/SUPPORT_MAIL|LEGAL_OWNER/.test(l) || /placeholder=/.test(l)
                || /^\s*email\s*:/.test(l) || !새는가(l)));
  T('그 주소로 주인인지를 따지지 않는다',
    !/(email|Email)\s*===?\s*['"][\w.+-]+@/.test(js) && !/SUPPORT_MAIL\s*===?/.test(js));
}
if(rules){
  const a = seg('admins');
  const cr = allows(a).filter(x=>/^create/.test(x)).join(' ');
  const up = allows(a).filter(x=>/^update/.test(x)).join(' ');
  const de = allows(a).filter(x=>/^delete/.test(x)).join(' ');
  T('주인이 누구인지 규칙이 정한다', /function isFounder\(/.test(rules));
  T('주인은 이메일로 가린다', /request\.auth\.token[\s\S]{0,60}?email[\s\S]{0,80}?@/.test(rules));
  T('주인도 남의 문서는 못 만든다',
    /isFounder\(\) && request\.auth\.uid == uid/.test(cr));
  T('주인도 남의 문서는 못 고친다',
    /isFounder\(\) && request\.auth\.uid == uid/.test(up));
  T('주인이라고 남을 지우지는 못한다 (해임은 임명 권한으로만)',
    !/isFounder/.test(de) && /adminCan\('admin'\)/.test(de));
  T('주인 아닌 사람이 스스로 세우는 길은 없다',
    /adminCan\('admin'\)/.test(cr));
  // 주인 말고는 최고 운영자 표시를 못 붙인다
  T('주인 말고는 최고 운영자가 못 된다 (만들 때)',
    /request\.resource\.data\.get\('owner', ?false\) ?!= ?true/.test(cr));
  T('주인 말고는 최고 운영자가 못 된다 (고칠 때)',
    /request\.resource\.data\.get\('owner', ?false\) ?!= ?true/.test(up));
} else fail += 8;

// ── 3. 권한 항목 넷
{
  const m = js.match(/const ADMIN_PERMS = \[[\s\S]*?\];/);
  T('권한 항목 목록이 있다', !!m);
  if(m){
    ['postDel','boatMod','userBan','admin'].forEach(k=>
      T('권한에 ' + k + ' 가 있다', new RegExp("k *: *'" + k + "'").test(m[0])));
  } else fail += 4;
}

// ── 4. 사람 명부 — 운영자만 본다
{
  T('로그인하면 명부에 이름을 남긴다', /users/.test(mod) && /__people/.test(mod));
  T('명부를 받아오는 곳이 있다', /__people/.test(js));
  T('사람 목록 화면이 있다', !!grab(js, 'adminPeople') || /adminTab *=== *'people'/.test(grab(js,'openAdmin')||''));
  const f = grab(js, 'personFilter') || grab(js, 'adminPeopleRows') || '';
  // ★ 3.78 부터 명부에 이메일을 담지 않는다 (최소 처리).
  //   이름 또는 계정 번호로 찾는다. 이메일이 다시 들어오면 여기서 잡는다.
  T('이름이나 계정 번호로 찾을 수 있다',
    /toLowerCase\(\)/.test(f) && /uid/.test(f));
  T('명부 찾기에 이메일이 다시 들어오지 않았다', !/email/.test(f), f.slice(0, 160));
}
if(rules){
  const u = seg('users');
  T('명부 규칙이 있다', u.length > 0);
  T('명부를 통째로 훑는 건 운영자만 (규칙)',
    /^list[\s\S]{0,120}?(isAdmin|isStaff)\(\)/.test(allows(u).filter(x=>/^list/.test(x)).join(' ')));
  T('남의 이름을 대신 쓰지 못한다 (규칙)',
    allows(u).filter(x=>/^(write|create|update)/.test(x))
      .every(x => /request\.auth\.uid ?== ?uid/.test(x)));
  T('자기 것은 읽는다 (규칙)',
    /request\.auth\.uid ?== ?uid/.test(allows(u).filter(x=>/^(get|read)/.test(x)).join(' ')));
} else fail += 4;

// ── 5. 사람 화면 — 눌러서 들어간다
{
  const op = grab(js, 'openPerson') || '';
  T('사람 화면이 있다', op.length > 0);
  // ★ 연재자도 못 연다 — 연재 권한은 운영자 권한이 아니다
  T('운영자가 아니면 열리지 않는다', /if\(!isAdmin\(\) \|\| amSeriesOnly\(\)\)/.test(op));
  T('그 자리에서 권한을 켜고 끌 수 있다', /personPerm\(/.test(op));
  T('아직 운영자가 아니면 켜는 순간 세운다', /personAppoint\(/.test(grab(js, 'personPerm') || ''));
  T('그 자리에서 막거나 풀 수 있다', /personBan\(/.test(op) && /personUnban\(/.test(op));
  // 글판에서 글쓴이를 누른다 — 운영자에게만 눌리게
  const rt = grab(js, 'renderTalk') || '';
  const ot = grab(js, 'openTalk') || '';
  T('글 목록·글 화면에서 글쓴이를 누를 수 있다',
    /openPerson\(/.test(rt) || /openPerson\(/.test(ot));
  T('운영자가 아니면 누를 것이 아예 없다',
    /isAdmin\(\)[\s\S]{0,200}?openPerson\(/.test(rt + ot));
}

// ── 6. 사람 막기
{
  const pb = grab(js, 'personBan') || '';
  const bg = grab(js, 'banGuard') || '';
  T('막기 함수가 있다', pb.length > 0);
  T('막기 전 검사가 한 곳에 모여 있다', bg.length > 0);
  T('막기는 권한을 본다', /isAdmin\('userBan'\)/.test(bg));
  T('최고 운영자는 막지 못한다', /isOwnerAdmin\(/.test(bg));
  T('막기가 그 검사를 쓰고 막는다',
    /banGuard\(/.test(pb) && /if\(why\)\{ tell\(t\(why\)\); return; \}/.test(pb));
  T('막힌 사람은 글을 못 쓴다', /banned|myBan/.test(grab(js, 'writeTalk') || ''));
}
if(rules){
  const b = seg('bans');
  T('막기 규칙이 있다', b.length > 0);
  T('막는 건 권한 있는 운영자만 (규칙)',
    allows(b).filter(x=>/^(write|create|update|delete)/.test(x)).length > 0
    && allows(b).filter(x=>/^(write|create|update|delete)/.test(x))
        .every(x => /adminCan\('userBan'\)/.test(x)));
  // ★ 여기서 한 번 샜다. create 부터 400자를 훑으면 아래 update 의 !banned() 에 걸려
  //   create 가 뚫려도 통과해 버린다. 허용 줄을 하나씩 떼어 그 줄 안에서만 본다.
  const cm = allows(seg('community'));
  const cCreate = cm.filter(x=>/^create/.test(x)).join(' ');
  const cUpdate = cm.filter(x=>/^update/.test(x)).join(' ');
  T('막기를 판정하는 곳이 규칙에 있다', /function banned\(/.test(rules));
  T('막힌 사람은 글을 못 올린다 (규칙)', /!banned\(\)/.test(cCreate));
  T('막힌 사람은 댓글·수정도 못 한다 (규칙)', /!banned\(\)/.test(cUpdate));
} else fail += 4;

// ── 7. 배 조치
{
  const ab = grab(js, 'adminBoats') || '';
  T('배 목록 화면이 있다', ab.length > 0);
  T('배 감추기가 있다', !!grab(js, 'adminBoatHide'));
  T('배 지우기가 있다', !!grab(js, 'adminBoatDel'));
  ['adminBoatHide','adminBoatDel'].forEach(fn=>
    T(fn + ' 이 권한을 다시 확인한다', /isAdmin\('boatMod'\)/.test(grab(js, fn) || '')));
  T('지우기는 되돌릴 수 없다고 알린다', /되돌릴 수 없/.test(grab(js, 'adminBoatDel') || ''));
  // 감춘 배는 둘러보기에서 빠진다 — 'adminHidden' 글자만 보면 헛통과한다. 실제로 거르는지 본다
  T('감춘 배는 둘러보기에서 빠진다',
    /filter\([\s\S]{0,80}?!\w+\.adminHidden/.test(((grab(js, 'openExplore')||'') + (grab(js, 'exploreRowsHtml')||''))));
  T('운영자에게는 감춘 배도 보인다',
    /!\w+\.adminHidden \|\| isAdmin\(/.test(((grab(js, 'openExplore')||'') + (grab(js, 'exploreRowsHtml')||''))));
}
if(rules){
  const bp = seg('boatPublic');
  T('배 공개 자료 규칙이 있다', bp.length > 0);
  T('운영자가 배를 감출 수 있다 (규칙)',
    /allow (create, ?update|update)[\s\S]{0,200}?adminCan\('boatMod'\)/.test(bp));
  T('운영자가 배 공개 자료를 지울 수 있다 (규칙)',
    /allow delete:[\s\S]{0,200}?adminCan\('boatMod'\)/.test(bp));
  // 배 안의 물품·정비 기록까지 지우게 열어 주면 안 된다
  T('운영자라도 배 안의 기록에는 손대지 못한다 (규칙)',
    !/adminCan\('boatMod'\)/.test(seg('boats')) && !/isAdmin\(\)/.test(seg('boats')));
} else fail += 4;

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
