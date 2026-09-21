// 규칙에 '남의 것을 만질 수 있는 구멍' 이 다시 생기지 않는지 지킨다.
// ★ 파이어스토어 흉내내기(에뮬레이터)는 이 컨테이너에서 못 받는다 (dl.google.com 막힘).
//   그래서 규칙 글을 읽어서 '있어야 할 잠금' 이 그대로 있는지 본다.
//   흉내내기를 쓸 수 있게 되면 실제로 써 보는 검사로 바꾸는 편이 낫다.
const fs = require('fs');
// runall.sh 규칙에 맞춘다 — 첫 인자는 앱, 둘째가 규칙 파일
const RULES = process.argv[3] || 'firestore_rules.txt';
let src = fs.readFileSync(RULES, 'utf8');

// 주석 지우개 — ★ 따옴표 안의 // 는 건드리면 안 된다.
//   matches('https?://.*') 의 // 를 주석으로 먹어서 헛 실패한 적이 있다.
function strip(s){
  let out = '', i = 0, q = null;
  while(i < s.length){
    const c = s[i];
    if(q){ out += c; if(c === '\\'){ out += s[i+1] || ''; i += 2; continue; }
           if(c === q) q = null; i++; continue; }
    if(c === '"' || c === "'"){ q = c; out += c; i++; continue; }
    if(c === '/' && s[i+1] === '/'){ while(i < s.length && s[i] !== '\n') i++; continue; }
    out += c; i++;
  }
  return out;
}
const R = strip(src).replace(/\s+/g, ' ');

let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };

// 한 덩이 잘라 오기
function block(head){
  const i = R.indexOf(head);
  if(i < 0) return '';
  // ★ 경로 안의 {uid} 를 덩이 시작으로 잡으면 안 된다 — 머리글 뒤부터 찾는다
  let d = 0, j = R.indexOf('{', i + head.length);
  if(j < 0) return '';
  for(let k = j; k < R.length; k++){
    if(R[k] === '{') d++;
    else if(R[k] === '}'){ d--; if(!d) return R.slice(j, k + 1); }
  }
  return '';
}

// ── ① 연재자는 운영자가 아니다
{
  T('연재자를 갈라내는 isStaff 가 있다', /function isStaff\(\)/.test(R));
  const st = block('function isStaff()');
  ['postDel','boatMod','userBan','admin'].forEach(k=>
    T('isStaff 가 ' + k + ' 을 본다', st.indexOf("'" + k + "'") >= 0));
  T('isStaff 는 series 를 운영자로 치지 않는다', st.indexOf("'series'") < 0, st.slice(0,120));

  // 남의 사연·이메일·기능잠금은 isAdmin 이 아니라 isStaff 로 막아야 한다
  const must = [
    ['match /support/{sId}', '고객센터'],
    ['match /users/{uid}',   '사람 명부'],
    ['match /config/{docId}','앱 설정']
  ];
  must.forEach(([head, name])=>{
    const b = block(head);
    T(name + ' 은 연재자에게 안 열린다 (isAdmin 을 안 쓴다)',
      b.length > 0 && !/[^t]isAdmin\(\)/.test(b), b.slice(0, 150));
    T(name + ' 이 isStaff 로 막혀 있다', /isStaff\(\)/.test(b), b.slice(0, 150));
  });
}

// ── ② 신고 갈래로 다른 칸을 못 바꾼다
{
  [['match /spots/{spotId}','정박지'],
   ['match /market/{itemId}','장터'],
   ['match /community/{postId}','글판']].forEach(([head, name])=>{
    const b = block(head);
    // 신고 갈래 = reports 를 하나 늘리는 조건이 들어 있는 덩이
    const has = /affectedKeys\(\) \.?hasOnly\(\['reports', ?'reportN', ?'hidden'\]\)/.test(b)
             || /affectedKeys\(\)\s*\.hasOnly\(\['reports','reportN','hidden'\]\)/.test(b.replace(/ /g,''))
             || b.replace(/ /g,'').indexOf("affectedKeys().hasOnly(['reports','reportN','hidden'])") >= 0;
    T(name + ' 신고는 reports·reportN·hidden 만 바꾼다', has,
      has ? '' : '신고 갈래에 hasOnly 잠금이 없습니다');
    // 신고 조건 자체도 그대로 있어야 한다
    T(name + ' 신고는 한 번만 할 수 있다',
      b.indexOf('!resource.data.get(\'reports\', {}).keys().hasAny([request.auth.uid])') >= 0);
    T(name + ' 은 신고가 쌓여야 숨긴다', b.indexOf(">= 3") >= 0);
  });
}

// ── ③ 옛 글의 댓글 배열을 통째로 지우지 못한다
{
  const b = block('match /community/{postId}');
  const flat = b.replace(/ /g, '');
  T('옛 댓글 배열은 줄어들지 못한다',
    flat.indexOf("get('comments',[]).size()>=resource.data.get('comments',[]).size()") >= 0);
}

// ── ④ 남의 도면 번호에 그림을 못 끼운다
{
  const b = block('match /dglibimg/{dgId}');
  const create = b.slice(b.indexOf('allow create'), b.indexOf('allow update'));
  T('도면 그림은 자기 도면에만 올린다',
    /owner == request\.auth\.uid/.test(create), create.slice(0, 140));
}

// ── ⑤ 원래 있던 잠금이 사라지지 않았는지
{
  T('맨 아래는 전부 막는다',
    R.indexOf('match /{document=**} { allow read, write: if false; }') >= 0);
  const ad = block('match /admins/{uid}');
  T('최고 운영자는 앱으로 못 건드린다',
    (ad.match(/get\('owner', false\) != true/g) || []).length >= 3, ad.slice(0, 80));
  T('스스로 임명 권한을 끄지 못한다',
    ad.indexOf("request.auth.uid != uid") >= 0);
  const bo = block('match /boats/{boatId}');
  T('배를 만들 때 자기를 선주로만 넣을 수 있다',
    bo.indexOf('members.keys().size() == 1') >= 0);
  T('등급·구성원은 그 권한이 있어야 바꾼다',
    bo.indexOf("allowed(boatId, 'ranks', 'write')") >= 0
    && bo.indexOf("allowed(boatId, 'members', 'write')") >= 0);
  const se = block('match /series/{sid}');
  T('남의 연재는 못 고친다',
    se.indexOf('resource.data.by == request.auth.uid') >= 0);
  const rp = block('match /reports/{reportId}');
  T('신고함은 아무도 못 읽는다', rp.indexOf('allow read, update, delete: if false;') >= 0);
}

console.log('합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
