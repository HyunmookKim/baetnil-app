// 3.40 — 보기 전용이 '배 설정·명부' 에는 안 걸려 있었다 / 배 목록 가는 길이 안 보였다
//
// 무슨 일이 있었나
//  · 보기 전용으로 두고 기본정보에 들어가면 이름·홈포트 칸은 잠겨 있는데,
//    바로 아래 [신청 받기 닫기] 와 [영업 배로] 는 그냥 눌리고 바로 바뀌었다.
//    등급설정·회비·내보내기도 마찬가지였다.
//    사람은 자물쇠를 걸어 뒀다고 믿고 있는데 절반만 걸려 있었다.
//  · 배를 더 등록하는 버튼은 '배 목록' 화면에만 있었고,
//    거기로 가는 길은 화면 맨 위 작은 회색 글씨 하나뿐이었다. 버튼처럼 보이지 않았다.
//
// ★ 그래서 이 검사는 두 가지를 본다
//   1. 자물쇠를 버튼이 아니라 '함수 안' 에서 건다 — 버튼에만 걸면 다음 버튼에서 또 빠뜨린다
//   2. 배 목록으로 가는 길이 눈에 보이는 자리에 있다
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

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 되묻기를 실제로 돌려 본다
{
  const g = grab(js, 'guardEdit') || '';
  T('한 줄로 잠금을 되묻는 곳이 있다', g.length > 0);
  let F = null, err = '';
  try{
    F = new Function('unlocked', 'needEdit', g + '\n return guardEdit;');
  }catch(e){ err = e.message; }
  T('되묻기를 돌렸다' + (err ? ' — ' + err : ''), !!F);
  if(F){
    let asked = null, ran = 0;
    const 열린상태 = F(true, (w,f)=>{ asked = w; f(); });
    T('편집 중이면 묻지 않고 그냥 한다', 열린상태('무엇', ()=>ran++) === false && asked === null);
    asked = null; ran = 0;
    const 잠긴상태 = F(false, (w,f)=>{ asked = w; f(); });
    const r = 잠긴상태('신청 받기를 바꿉니다.', ()=>ran++);
    T('보기 전용이면 되묻는다 — ' + asked, r === true && asked === '신청 받기를 바꿉니다.');
    // ★ 되묻고 나서 그 일을 다시 해 줘야 한다. 안 그러면 두 번 눌러야 한다.
    T('되묻고 풀렸으면 그 일을 이어서 한다', ran === 1);
  } else fail += 3;

  const n = grab(js, 'needEdit') || '';
  T('되묻기가 잠금을 실제로 푼다', /toggleLock\(\)/.test(n));
  T('거절하면 아무 일도 안 한다', /if\(!await ask\([\s\S]{0,200}?\) return;/.test(n));
}

// ── 2. ★ 배 설정·명부·등급을 바꾸는 곳은 전부 잠금을 본다
{
  const MUST = [
    ['toggleOpenJoin', '신청 받기'],
    ['setBizUI',       '영업 배 전환'],
    ['setPubUI',       '공개 설정'],
    ['editMember',     '등급 바꾸기'],
    ['removeMemberUI', '내보내기'],
    ['editRoster',     '회비 설정'],
    ['askPay',         '회비 납부 기록'],
    ['addRankUI',      '등급 만들기'],
    ['renameRankUI',   '등급 이름'],
    ['setPermUI',      '권한 바꾸기'],
    ['delRankUI',      '등급 지우기'],
    ['approveJoin',    '가입 승인'],
    ['askDelBoat',     '배 지우기'],
    ['editIntro',      '배 소개 고치기'],
    ['addIntro',       '배 소개 넣기'],
    ['moveIntro',      '배 소개 차례'],
    ['delIntro',       '배 소개 지우기']
  ];
  MUST.forEach(([f, what])=>{
    const b = grab(js, f) || '';
    T(what + ' 이(가) 잠금을 본다 — ' + f, /guardEdit\(/.test(b));
  });
  // ★ 되묻고 나서 자기를 다시 부르지 않으면 한 번 더 눌러야 한다
  MUST.forEach(([f, what])=>{
    const b = grab(js, f) || '';
    T(what + ' 은 되묻고 이어서 한다', new RegExp('guardEdit\\([^\\n]*' + f).test(b));
  });
  // 권한 확인보다 앞이나 뒤나 상관없지만, 실제로 바꾸기 전이어야 한다
  const t = grab(js, 'toggleOpenJoin') || '';
  T('신청 받기는 바꾸기 전에 되묻는다',
    t.indexOf('guardEdit(') >= 0 && t.indexOf('guardEdit(') < t.indexOf('b.openJoin ='));
  const z = grab(js, 'setBizUI') || '';
  T('영업 배는 확인 창보다 먼저 되묻는다',
    z.indexOf('guardEdit(') >= 0 && z.indexOf('guardEdit(') < z.indexOf('ask('));
}

// ── 3. 새로 만든 곳이 또 빠지지 않게 — 남은 것을 이름으로 찍어 준다
{
  const re = /(?:async )?function ([A-Za-z0-9_]+)\(/g;
  let m; const fns = [];
  while((m = re.exec(js))){
    const i = m.index; let d = 0, j = js.indexOf('{', i);
    for(; j < js.length; j++){ if(js[j] === '{') d++; else if(js[j] === '}'){ d--; if(!d){ j++; break; } } }
    fns.push([m[1], js.slice(i, j)]);
  }
  // 명부·등급·공개설정을 실제로 저장하는 함수들
  const WRITES = /saveBoatMembers\(|setPubUI\(|pushPublic\(/;
  const GUARD  = /guardEdit\(|unlocked|needEdit\(/;
  // 아래는 잠금이 필요 없거나 이미 다른 자물쇠가 걸린 것들
  // saveIntro 는 저장 심부름꾼이고, 부르는 쪽(editIntro·addIntro·…)에 자물쇠가 있다.
  // writePost 는 게시판 글쓰기다 — 있던 것을 실수로 고치는 일이 아니라 새로 쓰는 일이라
  // 보기 전용으로 막지 않는다.
  // initStorage 는 앱을 열 때 도는 뒷정리다 (옛 회비 금액 지우기). 사람이 고치는 일이 아니라
  // 잠금과 상관없고, 클라우드에 올리는 쪽은 can(b,'dues','write') 로 따로 막아 두었다.
  // pubRefresh 는 이미 저장된 것을 밖 사본으로 다시 굽는 심부름꾼이다 (4.70).
  // 사람이 무엇을 고치는 함수가 아니라 자물쇠가 필요 없다 —
  // 고치는 쪽(mrField·howPubToggle·voyLvSet)에 이미 자물쇠가 있다.
  // ★ 오히려 여기에 자물쇠를 걸면 안 된다. 잠근 뒤에도 앞서 고친 것이 밖으로 나가야 한다.
  const OK = ['saveBoatMembers','pushPublic','setPubUI','openPublish','createBoat',
              'pickRank','joinByCode','mergeCloudBoats','buildPublic',
              'saveIntro','writePost','initStorage','pubRefresh'];
  const left = fns.filter(([n,b]) => WRITES.test(b) && !GUARD.test(b) && OK.indexOf(n) < 0)
                  .map(x=>x[0]);
  T('잠금이 안 걸린 명부·공개설정 함수가 없다 — 남은 것: ' + (left.join(', ') || '없음'),
    left.length === 0);
}

// ── 4. ★ 배 목록으로 가는 길이 눈에 보인다
{
  const h = grab(js, 'boatHead') || '';
  T('내 배 탭줄이 있다', h.length > 0);
  // 지금까지 유일한 길은 화면 맨 위 작은 회색 글씨였다
  T('탭줄에 배 목록으로 가는 버튼이 있다', /openFleet\(\)/.test(h));
  T('그 버튼이 눌러야 하는 자리로 보인다', /배 목록/.test(h) && /▾/.test(h));
  T('그 버튼은 색이 다르다', /fleetc/.test(h));
  T('색이 실제로 정의돼 있다', /\.bsubs \.tab\.fleetc\{/.test(src));

  // 기본정보 화면 아래에도 바로 등록할 수 있다 — 사람들이 여기서 찾는다
  const ob = grab(js, 'openBoat') || '';
  // ★ 3.85 부터 사전을 거친다 — `+ ${esc(t('배 등록하기'))}` 모양이다
  T('기본정보 아래에 배 등록하기가 있다', /\+ \$\{esc\(t\('배 등록하기'\)\)\}/.test(ob));
  T('그 버튼도 잠기면 되묻는다', /needEdit\('배를 한 척 더 등록합니다\.', addBoat\)/.test(ob));
  T('참여 코드로 신청도 같이 있다', /joinByCode/.test(ob));

  // 배 목록 화면 자체
  const f = grab(js, 'openFleet') || '';
  T('배 목록에 등록 버튼이 있다', /\+ 배 등록하기/.test(f));
  // ★ 감추면 기능이 사라진 줄 안다 — 눌렀을 때 되묻는다
  T('삭제 버튼을 잠겼다고 감추지 않는다', !/unlocked && canDelBoat/.test(f));

  // 맨 윗줄도 눌리는 자리처럼 보인다
  const a = grab(js, 'applyBoatName') || '';
  T('맨 윗줄에 눌림 표시가 늘 붙는다', /' ▾'/.test(a) && !/boats\.length > 1 \? ' ▾'/.test(a));
  T('배가 없으면 등록하라고 적는다', /배 등록하기/.test(a));
  T('맨 윗줄을 누르면 배 목록이 열린다', /id="boatSub" onclick="openFleet\(\)"/.test(src));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
