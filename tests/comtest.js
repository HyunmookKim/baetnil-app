// 커뮤니티 글판 검증
//
// 정한 것
//  · 로그인한 사람은 누구나 읽고 쓴다
//  · 신고할 수 있고, 신고가 쌓이면 자동으로 숨는다
//  · 지우기는 글쓴이 본인과 운영자
//  · 운영자는 파이어스토어 admins 문서로 관리한다 (앱을 다시 안 내려도 됨)
//    운영자마다 할 수 있는 일(글 삭제·차단·운영자 임명)을 따로 켠다
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
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 글판이 커뮤니티 안에 있다
// 4.132 말 전수점검에서 「글판」 → 「게시판」 으로 바뀌었다
T('커뮤니티 하위에 게시판이 있다', /talk\s*:\s*(t\()?'게시판'/.test(js));
T('글판이 첫 번째다',
  (js.match(/const COMSUB_TITLES = \{([\s\S]*?)\}/) || ['',''])[1].trim().startsWith('talk'));
T('글판을 그리는 함수가 있다', !!grab(js, 'renderTalk'));

// ── 2. 말머리와 지역
{
  const m = js.match(/const TALK_KINDS = \[[\s\S]*?\];/);
  T('글판 말머리가 있다', !!m);
  if(m){
    const ks = [...m[0].matchAll(/v:'(\w+)'/g)].map(x=>x[1]);
    ['ask','maint','trip','gear','free'].forEach(k=>
      T('말머리에 ' + k + ' 가 있다', ks.includes(k)));
  } else fail += 5;
  T('지역 목록이 있다', /const REGIONS = \[/.test(js));
  T('지역으로 거를 수 있다', /talkRegion/.test(js));
  T('말머리로 거를 수 있다', /talkKind/.test(js));
}

// ── 3. 쓰기 — 같은 편집기를 쓴다
{
  const w = grab(js, 'writeTalk') || '';
  T('글판 글쓰기가 있다', w.length > 0);
  T('글판도 같은 편집기를 쓴다', /type\s*:\s*'rich'/.test(w));
  T('글에 배 이름이 따라붙는다', /boatName/.test(w) || /boatName/.test(grab(js, 'talkBody') || ''));
  // ★ 4.20 부터 로그인 문이 needLogin() 하나로 모였다 (말만 하지 말고 로그인 화면까지 열어 준다).
  T('로그인해야 쓸 수 있다', /needLogin\(|__user|meUid\(\)/.test(w));
}

// ── 4. 신고와 자동 숨김
{
  T('신고 함수가 있다', !!grab(js, 'reportTalk'));
  const r = grab(js, 'reportTalk') || '';
  T('신고 사유를 고른다', /REPORT_REASONS/.test(r));
  T('한 사람이 두 번 신고하지 못한다', /reports\[/.test(r) || /reports\s*&&/.test(r));
  T('자동 숨김 기준값이 있다', /const TALK_HIDE_AT/.test(js));
  T('신고가 쌓이면 숨긴다', /TALK_HIDE_AT/.test(r) && /hidden/.test(r));
  // 'hidden' 글자만 보면 목록의 '숨김' 표시에 걸려 헛통과한다. 실제로 거르는지 본다.
  // ★ 3.89 부터 글 하나를 받는 이름이 po 다 (t 는 사전 함수라 가리면 안 된다)
  T('숨은 글은 목록에서 빠진다',
    /\.filter\(\s*(t|po)\s*=>\s*!\1\.hidden/.test(grab(js, 'renderTalk') || ''));
  T('운영자에게는 숨은 글도 보인다',
    /!(t|po)\.hidden \|\| isAdmin\(/.test(grab(js, 'renderTalk') || ''));
}

// ── 5. 지우기 — 본인과 운영자
{
  T('지울 수 있는지 판단하는 함수가 있다', !!grab(js, 'canDelTalk'));
  const c = grab(js, 'canDelTalk') || '';
  T('글쓴이 본인은 지울 수 있다', /meUid\(\)/.test(c) && /\.by/.test(c));
  T('운영자도 지울 수 있다', /isAdmin\(/.test(c));
}

// ── 6. 운영자 — 파이어스토어로 관리
{
  T('운영자인지 보는 함수가 있다', !!grab(js, 'isAdmin'));
  const a = grab(js, 'isAdmin') || '';
  T('운영자 권한을 항목별로 본다', /perms/.test(a));
  T('운영자 목록을 클라우드에서 받아온다', /__admin/.test(js) && /admins/.test(mod));
  // 파이어베이스 uid 는 28자다. 앱 코드에 그런 문자열이 박혀 있으면 안 된다.
  // (열쇠·설정은 모듈 쪽에 있고 여기 js 는 앱 본체만이다)
  //  (배 참여 코드에 쓰는 알파벳 목록 같은 것은 uid 가 아니다 —
  //   uid 는 대소문자와 숫자가 섞여 있다)
  const hard = (js.match(/'[A-Za-z0-9_-]{24,40}'/g) || [])
    .filter(x => /[a-z]/.test(x) && /[A-Z]/.test(x) && /[0-9]/.test(x));
  T('코드에 계정을 박아 두지 않는다 — 찾은 것: ' + (hard.slice(0,2).join(', ') || '없음'),
    hard.length === 0);
  const m = js.match(/const ADMIN_PERMS = \[[\s\S]*?\];/);
  T('운영자가 할 수 있는 일 목록이 있다', !!m);
  if(m){
    ['postDel','userBan','admin'].forEach(k=>
      T('운영자 권한에 ' + k + ' 가 있다', new RegExp("'" + k + "'").test(m[0])));
  } else fail += 3;
}

// ── 7. 규칙
if(rules){
  T('규칙에 커뮤니티가 있다', /match \/community\//.test(rules));
  // ★ 4.20 — 읽기를 열었다. 처음 온 사람이 안을 못 보고 가입부터 하라면 그냥 나간다.
  //   대신 쓰는 것은 그대로 로그인이다 (바로 아래 줄이 그것을 지킨다).
  T('글은 누구나 읽는다', /match \/community\/\{[\s\S]{0,300}?allow read: if true/.test(rules));
  T('글쓴이만 자기 이름으로 쓴다',
    /match \/community\/\{[\s\S]{0,700}?allow create:[\s\S]{0,200}?request\.auth\.uid/.test(rules));
  T('남의 글은 못 고친다',
    /match \/community\/\{[\s\S]{0,1400}?allow update:/.test(rules));
  // 규칙 덩어리를 먼저 떼어낸다. '몇 글자 안' 으로 보면 규칙이 길어질 때 헛실패한다.
  const comSeg = (rules.match(/match \/community\/\{postId\}[\s\S]*?\n    \}/) || [''])[0];
  T('커뮤니티 규칙 덩어리를 찾았다', comSeg.length > 0);
  T('본인이나 운영자만 지운다',
    /allow delete:[\s\S]{0,300}?(isAdmin|adminCan)/.test(comSeg)
    && /allow delete:[\s\S]{0,300}?resource\.data\.by == request\.auth\.uid/.test(comSeg));
  T('규칙에 운영자 문서가 있다', /match \/admins\//.test(rules));
  // write 한 줄만 보면 create/update/delete 로 쪼갠 뒤 하나가 뚫려도 못 잡는다.
  // get·list 를 뺀 모든 허용 줄이 잠겨 있는지 전부 센다.
  {
    const seg = (rules.match(/match \/admins\/\{uid\}[\s\S]*?\n    \}/) || [''])[0];
    const w = seg.split('\n').map(l=>l.replace(/\/\/.*$/,'')).join('\n')
      .split(/allow /).slice(1).filter(x => !/^(get|list)\b/.test(x));
    T('운영자 문서는 아무나 못 고친다',
      w.length > 0 && w.every(x => /(false|adminCan)/.test(x)));
  }
  T('신고는 자기 것만 남긴다', /reports/.test(rules));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (8건)'); fail += 8; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
