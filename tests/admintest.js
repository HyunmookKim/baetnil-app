// 운영자 메뉴 검증
//
// 요구: 앱 안에 운영자 메뉴를 두되, 운영자로 임명된 사람에게만 보인다.
//
// ★ 가장 중요한 것
//   화면에서 감추는 것은 보안이 아니다. 메뉴를 안 그려도 브라우저 콘솔에서
//   함수를 부를 수 있다. 진짜 방어선은 파이어스토어 규칙이다.
//   그래서 이 하네스는 '메뉴가 안 보인다' 보다 '규칙이 막는다' 를 더 세게 본다.
//
// 잠김 사고도 막아야 한다 — 마지막 운영자가 자기 권한을 끄면
// 아무도 운영자를 임명할 수 없어 영영 복구가 안 된다.
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
// window.__onAuth 는 화살표 함수라 grab() 이 못 잡는다. 통째로 떼어 온다.
function grabAssign(s, name){
  const i = s.indexOf(name + ' =');
  if(i < 0) return '';
  let d = 0, j = s.indexOf('{', i);
  if(j < 0) return '';
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
const drawer = src.slice(src.indexOf('<aside id="drawer"'), src.indexOf('</aside>') + 8);
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(e){}

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 메뉴는 운영자에게만 (편의)
{
  T('서랍에 운영자 메뉴가 있다', /openAdmin\(\)/.test(drawer));
  T('운영자 메뉴에 id 가 있다', /id="dAdmin"/.test(drawer));
  T('평소에는 숨겨 둔다', /id="dAdmin"[^>]*display:\s*none/.test(drawer));
  T('운영자일 때만 켠다', !!grab(js, 'paintAdminMenu'));
  const pa = grab(js, 'paintAdminMenu') || '';
  T('켜고 끄는 기준이 운영자 여부다', /isAdmin\(\)/.test(pa) && /dAdmin/.test(pa));
  // 4.137·5.0 에서 __onAuth 몸이 길어져 1400자 창 밖으로 loadAdmin() 줄이 밀려났다 — 몸 전체를 본다
  T('로그인하면 운영자인지 확인한다', /loadAdmin\(\)/.test(grab(js, '__onAuth') || grabAssign(js, 'window.__onAuth')));
  T('로그아웃하면 운영자 표시를 지운다', /adminMe\s*=\s*null/.test(js));
}

// ── 2. 화면을 열어도 권한이 없으면 아무것도 못 한다 (콘솔로 불러도)
{
  const oa = grab(js, 'openAdmin') || '';
  T('운영자 화면이 있다', oa.length > 0);
  // ★ 연재자(연재 권한만 있는 사람)도 못 연다 — 사람 명부에 남의 메일이 있다
  T('운영자가 아니면 화면 자체를 안 연다', /if\(!isAdmin\(\) \|\| amSeriesOnly\(\)\)/.test(oa));
  const ah = grab(js, 'adminUnhide') || '';
  T('숨김 풀기가 권한을 확인한다', /isAdmin\('postDel'\)/.test(ah));
  const ad = grab(js, 'adminDel') || '';
  T('글 지우기가 권한을 확인한다', /isAdmin\('postDel'\)/.test(ad));
}

// ── 3. 잠김 방지 · 최고 운영자 보호
//   ★ 검사를 여러 함수에 흩어 놓으면 한 군데만 고치고 나머지를 빠뜨린다.
//     실제로 여러 번 그랬다. 그래서 한 곳(adminGuard)에 모으고,
//     운영자 문서를 손대는 모든 함수가 그것을 부르는지 이름까지 찍어서 본다.
{
  const g = grab(js, 'adminGuard') || '';
  T('손대기 전 검사가 한 곳에 모여 있다', g.length > 0);
  T('권한을 본다', /isAdmin\('admin'\)/.test(g));
  T('누구인지 모르면 막는다', /adminMyUid\(\)/.test(g));
  T('최고 운영자는 못 건드린다', /isOwnerAdmin\(/.test(g));
  T('자기 임명 권한을 스스로 끄지 못한다', /adminIsMe\(/.test(g) && /'admin'/.test(g));
  T('자기 자신을 해임하지 못한다', /'remove'[\s\S]{0,80}?adminIsMe\(/.test(g));
  T('왜 막는지 알려준다', /잠기|복구|아무도/.test(g) && /최고 운영자/.test(g));
  // 검사를 부르기만 하고 결과를 안 쓰면 소용없다 — 막고 돌아서는지까지 본다
  ['adminSetPerm','adminRemove','adminAdd','personPerm','personAppoint','personRemove']
    .filter(fn => grab(js, fn))
    .forEach(fn=>{
      const f = grab(js, fn) || '';
      T(fn + ' 이 그 검사를 쓰고 막는다',
        /adminGuard\(/.test(f) && /if\(why\)\{ tell\(t\(why\)\); return; \}/.test(f));
    });
  T('손대는 함수를 빠뜨리지 않았다',
    ['personPerm','personAppoint','personRemove'].every(fn => !!grab(js, fn)));
  // 내가 누구인지 알아내는 곳
  const my = grab(js, 'adminMyUid') || '', im = grab(js, 'adminIsMe') || '';
  T('내가 누구인지 알아내는 곳이 한 군데다', my.length > 0 && im.length > 0);
  T('모르면 같다고 하지 않는다 (빈 값 통과 금지)', /!!my/.test(im) || /if\(!my\)/.test(im));
}

// ── 4. 신고된 글 관리
{
  const ar = grab(js, 'adminReports') || '';
  T('신고된 글을 모아 보는 곳이 있다', ar.length > 0);
  T('신고가 쌓였거나 숨은 글만 모은다', /reportN/.test(ar) && /hidden/.test(ar));
  T('숨김을 풀 수 있다', !!grab(js, 'adminUnhide') && /adminUnhide\(/.test(ar));
  T('운영자가 글을 지울 수 있다', !!grab(js, 'adminDel') && /adminDel\(/.test(ar));
  T('신고된 글에서 쓴 사람으로 갈 수 있다', /openPerson\(/.test(ar));
}

// ── 5. 사람을 어떻게 더하나 — uid 를 알아야 한다
{
  T('내 계정 번호를 복사할 수 있다', !!grab(js, 'copyMyUid'));
  T('계정 화면에 그 버튼이 있다', /copyMyUid\(\)/.test(grab(js, 'openAccount') || ''));
  const aa = grab(js, 'adminAdd') || '';
  T('계정 번호를 받아 임명한다', /uid/.test(aa));
  T('빈 값으로 임명하지 않는다', /trim\(\)/.test(aa));
  T('이미 운영자인 사람을 또 세우지 않는다', /이미 운영자/.test(aa));
}

// ── 6. ★ 진짜 방어선 — 규칙
if(rules){
  const seg = (rules.match(/match \/admins\/\{uid\}[\s\S]*?\n    \}/) || [''])[0];
  T('운영자 문서 규칙이 있다', seg.length > 0);
  // 'allow write:' 하나만 보면 create/update/delete 로 쪼갠 뒤 하나가 뚫려도 못 잡는다.
  // get 을 뺀 모든 허용 줄이 adminCan('admin') 으로 잠겨 있는지 전부 본다.
  {
    const lines = seg.split('\n').map(l=>l.replace(/\/\/.*$/,''))
      .join('\n').split(/allow /).slice(1)
      .filter(x => !/^(get|list)\b/.test(x));
    T('쓰기 허용 줄이 있다', lines.length > 0);
    T('임명 권한이 있어야 남의 것을 쓴다 — 잠기지 않은 줄: '
      + (lines.filter(x=>!/adminCan\('admin'\)/.test(x)).map(x=>x.split(':')[0]).join(',') || '없음'),
      lines.length > 0 && lines.every(x => /adminCan\('admin'\)/.test(x)));
  }
  T('자기 임명 권한을 스스로 끄지 못한다 (규칙)',
    /allow update:[\s\S]{0,400}?request\.auth\.uid != uid[\s\S]{0,200}?perms[\s\S]{0,80}?'admin'[\s\S]{0,40}?== true/.test(seg));
  T('자기 자신을 지우지 못한다 (규칙)',
    /allow delete:[\s\S]{0,200}?(request\.auth\.uid != uid|uid != request\.auth\.uid)/.test(seg));
  T('아무나 운영자 목록을 훑지 못한다', /allow list:[\s\S]{0,120}?adminCan\('admin'\)/.test(seg));
  T('자기 것은 읽을 수 있다 (자기가 운영자인지 알아야 하니까)',
    /allow get:[\s\S]{0,160}?request\.auth\.uid == uid/.test(seg));

  const com = (rules.match(/match \/community\/\{postId\}[\s\S]*?\n    \}/) || [''])[0];
  T('운영자만 남의 글을 지운다 (규칙)', /allow delete:[\s\S]{0,200}?adminCan\('postDel'\)/.test(com));
  T('숨김 풀기도 운영자만 (규칙)', /adminCan\('postDel'\)/.test(com));
  T('규칙이 admins 문서를 읽어 판단한다', /function adminCan\(/.test(rules));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (9건)'); fail += 9; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
