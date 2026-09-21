// 3.49~3.51 — 첫 화면 · 옛 자료 손보기 · 도움된 순
//
// 왜
//  가. 첫 화면이 빈 껍데기였다 — '날씨 자료를 아직 받지 못했습니다 / 배 등록 / 0 / 11'.
//     광고를 보고 들어온 사람은 30초 안에 '이거 나한테 필요하겠다' 를 느껴야 하는데
//     느낄 거리가 없었다.
//  나. 사진을 창고로 옮긴 것은 '그 뒤에 새로 저장한 것' 뿐이다.
//     이미 올라가 있던 사진은 아직 문서 안에 글자로 들어 있다.
//  다. '도움된 순' 은 그 칸이 없는 문서를 아예 안 내놓는다 —
//     옛 글에 0 을 채워 두지 않으면 옛 글이 통째로 사라진다.
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
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. 첫 화면
{
  const i = grab(js, 'introCard') || '';
  T('처음 온 사람에게 보여 줄 카드가 있다', i.length > 0);
  // ★ 3.52 — 배를 '타는' 사람과 '가진' 사람은 고픈 것이 다르다.
  //   해양레저 하는 사람 대부분은 배 주인이 아니다. 배 주인 이야기만 늘어놓으면
  //   '나랑 상관없네' 하고 나간다.
  const O = (js.match(/const INTRO_OPEN = \[[\s\S]*?\];/) || [''])[0];
  const W = (js.match(/const INTRO_OWN = \[[\s\S]*?\];/) || [''])[0];
  T('배 없이 쓸 수 있는 것이 따로 적혀 있다', O.length > 0);
  T('배가 있어야 쓰는 것도 따로 적혀 있다', W.length > 0);
  const n = (O.match(/\[\s*(t\()?'/g) || []).length;
  T('배 없이 쓸 수 있는 것이 넷 이상 — ' + n + '개', n >= 4);
  // ★ 커뮤니티가 빠져 있으면 배 없는 사람에게 줄 것이 날씨뿐이다
  T('정박지가 들어 있다', /어디에 댈까|정박지/.test(O));
  T('중고 장터가 들어 있다', /중고 장터/.test(O));
  // 5.0 에서 「글판」 → 「게시판」 으로 이름을 바꿨다
  T('게시판이 들어 있다', /게시판/.test(O));
  // ★ 기능 이름을 늘어놓으면 안 읽는다. '무엇이 편해지는가' 여야 한다.
  T('사람 말로 적혀 있다', /지금 나가도 되나|어디 뒀더라|어디에 댈까/.test(O + W));
  T('커뮤니티로 가는 길이 있다', /switchTab\('community'\)/.test(i));
  T('배 등록하는 길도 있다', /openBoatSetup\(\)/.test(i));
  // ★ 같은 일에 이름이 둘이면 헷갈린다
  T('배 등록 단추 이름이 앱 전체에서 하나다',
    !/배 등록하고 시작하기/.test(js) && /배 등록하기/.test(i));
  T('배가 없어도 사용할 수 있다고 말한다', /배가 없어도 바로 사용할 수 있습니다/.test(i));
  // ★ 으뜸 단추는 하나여야 한다 — 둘이면 어디를 눌러야 할지 모른다
  T('으뜸 단추가 하나뿐이다', (i.match(/mrbtn ok/g) || []).length === 1);

  const rh = grab(js, 'renderHome') || '';
  T('배가 없을 때만 내놓는다', /if\(!b\)\{\s*\n?\s*out \+= introCard\(\);/.test(rh.replace(/\r/g,'')));
  // ★ 날씨를 세 갈래로 갈라 말한다
  T('어디 날씨인지 못 정했으면 정하는 길을 준다', /어디 날씨를 볼지 아직 정하지 않았습니다/.test(rh));
  T('정했으면 받는 중이라고 말한다', /날씨를 받는 중입니다/.test(rh));
  T('배 없이도 날씨를 볼 수 있다고 말한다', /배를 등록하지 않아도 날씨와 물때는/.test(rh));
  const g = grab(js, 'homeUseGPS') || '';
  T('현재 위치로 잡는 길이 있다', g.length > 0 && /wxUseGPS\(/.test(g));
  // ★ 켜자마자 위치를 묻지 않는다 — 까닭 모르고 뜨는 창은 대개 거절당한다
  T('앱을 켜자마자 위치를 묻지 않는다', !/\nwxUseGPS\(\);/.test(js));
  // ★ 배가 없으면 출항 전 점검은 열리지도 않는다 — 첫 화면에 0/11 만 띄우면 말이 안 맞는다
  T('배가 없으면 점검 카드를 안 띄운다', /const lists = \(b && typeof ckLists/.test(rh));
  T('으뜸 단추가 하나뿐이다 (배 등록)',
    (rh.match(/mrbtn ok/g) || []).length + (grab(js,'introCard')||'').split('mrbtn ok').length - 1 <= 2);
}

// ── 2. 옛 사진 옮기기
{
  const c = grab(js, 'isInlinePhoto') || '';
  T('문서에 든 사진을 가려내는 곳이 있다', c.length > 0);
  let F = null;
  try{ F = new Function(c + '\n return isInlinePhoto;')(); }catch(e){}
  T('가려내기를 돌렸다', !!F);
  if(F){
    T('data: 는 옛 사진이다', F('data:image/jpeg;base64,AAA') === true);
    T('창고 주소는 아니다', F('https://firebasestorage.googleapis.com/a.jpg') === false);
    T('빈 것도 다룬다', F(null) === false && F(undefined) === false && F('') === false);
  } else fail += 3;

  const cnt = grab(js, 'oldPhotoCount') || '';
  T('몇 장 남았는지 세는 곳이 있다', cnt.length > 0);
  T('배 자료를 다 훑는다', /items/.test(cnt) && /maint/.test(cnt)
    && /vdocs/.test(cnt) && /posts/.test(cnt));
  T('배 소개와 도면도 센다', /intro/.test(cnt) && /dgImgs/.test(cnt));

  const f = grab(js, 'fixOldPhotos') || '';
  T('옮기는 곳이 있다', f.length > 0);
  // ★ 한 번에 몰아 하면 중간에 끊겼을 때 반쪽이 된다
  T('한 번에 몇 장씩만 옮긴다', /OLDFIX_PER_RUN/.test(f) && /const OLDFIX_PER_RUN = \d+/.test(js));
  const per = Number((js.match(/const OLDFIX_PER_RUN = (\d+)/) || [])[1] || 0);
  T('그 수가 알맞다 — ' + per + '장', per >= 2 && per <= 20);
  T('창고를 못 쓰면 안 한다', /if\(!window\.__photos\) return 0/.test(f));
  T('인터넷이 없으면 안 한다', /navigator\.onLine === false/.test(f));
  T('두 번 겹쳐 돌지 않는다', /oldFixBusy/.test(f));
  // ★ 못 올렸는데 그냥 넘어가면 원본을 잃는다
  T('창고에 못 올리면 그대로 둔다', /else break;/.test(f));
  T('바뀐 것이 있을 때만 저장한다', /if\(바뀜\)\{ save\(\); \}/.test(f));

  const d = grab(js, 'fixOldDrawings') || '';
  T('옛 도면도 옮긴다', d.length > 0);
  // ★ 작은 사본을 먼저 만들어야 핀 그림을 계속 만들 수 있다
  T('작은 사본을 먼저 만든다', d.indexOf('dgShrink') < d.indexOf('storePhotos'));
  T('기본 도면은 건드리지 않는다', /dgSeedKeyOf\(k, dgImgs\[k\]\)\) continue/.test(d));

  T('켠 뒤 조용히 한 번씩 손본다', /fixOldQuietly\(\)/.test(js));
  const q = grab(js, 'fixOldQuietly') || '';
  T('도면을 먼저, 사진을 나중에', q.indexOf('fixOldDrawings') < q.indexOf('fixOldPhotos'));
  // ★ 4.137 — 남은 장수를 계정 화면(oldPhotoN)에 보여 주던 것을 일부러 걷었다.
  //   「옛 사진은 사람이 볼 것이 아니라 내가 볼 것」 이라서 고객센터 기기 정보에 붙인다.
  //   그래도 **어딘가에는 반드시 나와야** 옮기다 만 것을 알아챈다.
  T('문의할 때 몇 장 남았는지 딸려 간다',
    /oldPhotoCount\(\)/.test(grab(js, 'supportInfo') || '')
    && /옛사진/.test(grab(js, 'supportInfo') || ''));
}

// ── 3. 옛 글에 숫자 자리 채우기 + 도움된 순
{
  const f = grab(js, 'fixOldLikes') || '';
  T('옛 글에 숫자 자리를 채우는 곳이 있다', f.length > 0);
  // ★ 남의 글은 내가 못 고친다. 규칙이 막는다.
  T('내가 쓴 글만 고친다', /String\(o\.by\) !== String\(me2\)/.test(f));
  T('이미 있는 것은 건드리지 않는다', /typeof o\.likeN === 'number'/.test(f));
  T('세 곳을 다 본다', /talk/.test(f) && /spots/.test(f) && /market/.test(f));
  T('켠 뒤 한 번 돈다', /fixOldLikes\(\)/.test(js.replace(f, '')));

  T('줄 세우기 값이 있다', /let talkSort = 'ts'/.test(js));
  const st = grab(js, 'setTalkSort') || '';
  T('줄 세우기를 바꾸는 곳이 있다', st.length > 0);
  // ★ 줄 세우기가 바뀌면 받아 둔 목록은 못 쓴다
  T('바꾸면 받아 둔 것을 버린다', /listDrop\('talk'\)/.test(st));
  T('모르는 값은 새 글 순으로 본다', /\(v === 'likeN'\) \? 'likeN' : 'ts'/.test(st));

  const rt = grab(js, 'renderTalk') || '';
  T('화면에 고르는 칸이 있다', /setTalkSort\('likeN'\)/.test(rt) && /setTalkSort\('ts'\)/.test(rt));
  T('받아올 때 그 값을 넘긴다', /list\(false, talkSort\)/.test(rt));
  // ★ 남이 쓴 아주 옛 글은 내가 못 고친다 — 안 나올 수 있다고 미리 말해 준다
  T('옛 글이 빠질 수 있다고 알려 준다', /아주 오래된 글은 여기 안 나올 수 있습니다/.test(rt));

  const seg = mod.slice(mod.indexOf('window.__talk'), mod.indexOf('window.__talk') + 600);
  T('모듈이 줄 세우기를 받는다', /async list\(more, ord\)/.test(seg));
  T('모르는 값이 오면 새 글 순', /ord === 'likeN' \? 'likeN' : 'ts'/.test(seg));
  const lm = grab(js, 'listMore') || '';
  T('더 보기도 같은 줄 세우기로 이어받는다', /api\.list\(true, ord\)/.test(lm));
  T('글판 더 보기가 그 값을 넘긴다', /listMore\('talk',\s+window\.__talk, talkSort\)/.test(js));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
