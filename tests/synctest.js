// 클라우드 동기화 검증
//
// 여기서 잡으려는 사고들 (2.5 에서 실제로 일어난 것)
//  1) 앱이 클라우드에서 배 목록을 안 받아와서, 다른 기기에서 켜면 새 배가 생기고
//     서로 다른 boats/{id} 를 보게 된다 → 동기화가 통째로 안 된 것처럼 보인다
//  2) '다시 묻지 않음' 표시를 올리기 성공 전에 찍어서, 실패해도 두 번 다시 안 묻는다
//  3) push 조건문에 컬렉션을 하나씩 손으로 나열해서, 빠뜨린 컬렉션은 영영 안 올라간다
//  4) 선주 판정을 옛 방식(members[uid]==='owner')으로 해서 선주가 자기 배를 못 지운다
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);                 // 앱 본체
const mod = src.slice(src.indexOf('<script type="module">'));   // 파이어베이스 모듈

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ─────────────────────────────────────────────────────────
// 1. 클라우드에서 배 목록을 받아오는 길이 있는가
// ─────────────────────────────────────────────────────────
T('모듈에 __myBoats 가 있다', /window\.__myBoats\s*=/.test(mod));
T('__myBoats 가 boats 컬렉션을 조회한다',
  /__myBoats[\s\S]{0,700}?collection\(\s*fdb\s*,\s*'boats'\s*\)/.test(mod));
T('__myBoats 가 내 uid 로 거른다',
  /__myBoats[\s\S]{0,700}?FieldPath\(\s*'members'\s*,\s*uid\s*\)/.test(mod));
T('FieldPath 를 불러온다', /FieldPath/.test(mod.slice(0, mod.indexOf('firebaseConfig'))));
T('앱에 mergeCloudBoats 가 있다', !!grab(js, 'mergeCloudBoats'));
// ★ '앵커에서 1200자 안' 식으로 보면 그 사이에 코드가 늘어나기만 해도 헛실패한다.
//   __onAuth 본문만 괄호를 세어 떼어내고 그 안에서 본다.
function grabArrow(s, head){
  const i = s.indexOf(head);
  if(i < 0) return '';
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const onAuth = grabArrow(js, 'window.__onAuth =');
T('__onAuth 본문을 찾았다', onAuth.length > 0);
T('로그인하면 mergeCloudBoats 를 부른다', /mergeCloudBoats\s*\(/.test(onAuth));

// ─────────────────────────────────────────────────────────
// 2. mergeCloudBoats 의 실제 동작
// ─────────────────────────────────────────────────────────
{
  const fn = grab(js, 'mergeCloudBoats');
  if(!fn){
    console.log('★ 실패: mergeCloudBoats 가 없어 동작 검사를 건너뜀 (6건)');
    fail += 6;
    setTimeout(done, 0);
  } else {
    const mk = (cloudList, localBoats, cur) => {
      const g = {};
      g.boats = localBoats;
      g.currentBoatId = cur;
      g.window = { __myBoats: async () => cloudList, currentBoatId: cur };
      g.savedLocal = false;
      g.dirty = [];        // 3.15 — 아직 못 올린 배
      g.resaved = [];
      g.pulled = false;
      g.switched = null;
      g.notes = [];
      return g;
    };
    const run = async (g) => {
      const ctx = {
        boats: g.boats, currentBoatId: g.currentBoatId, window: g.window,
        sysSave(){ g.savedLocal = true; },
        loadBoatData: async () => {},
        cloudPull: async () => { g.pulled = true; },
        applyBoatName(){}, updateTrashTab(){}, switchTab(){},
        curBoat(){ return ctx.boats.find(b => String(b.id) === String(ctx.currentBoatId)) || null; },
        syncPortSpot(){},
        migrateRanks(){}, seedRanks(){},
        // 새 상수는 하네스에도 넣어야 한다 (실행방법.txt 규칙)
        BOAT_FIELDS: (function(){
          const m = js.match(/const BOAT_FIELDS = \[([\s\S]*?)\];/);
          return m ? [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map(x => x[1]) : [];
        })(),
        setSync(){}, note(m){ g.notes.push(m); },
        // 3.15 — 아직 클라우드에 못 올린 배 목록. 여기 든 배는 덮어쓰지 않는다.
        boatDirty: new Set(g.dirty || []),
        saveBoatCloud: async (b)=>{ (g.resaved = g.resaved || []).push(String(b.id)); return true; },
        saveDirtyList(){},
        alert(m){ g.notes.push(m); }, tell(m){ g.notes.push(m); }, confirm(){ return true; }, ask(){ return Promise.resolve(true); },
      };
      const f = new Function('ctx', 'with(ctx){ return (' + fn + ')(); }');
      await f(ctx);
      g.boats = ctx.boats; g.currentBoatId = ctx.currentBoatId;
      return g;
    };

    const B = (id, name) => ({ id, name, members: { u1: 'r0' }, ranks: {} });

    (async () => {
      // 기기에 없는 클라우드 배를 받아온다
      let g = await run(mk([B('c1', '퍼스트45')], [], null));
      T('클라우드에만 있는 배를 기기 목록에 넣는다',
        g.boats.length === 1 && String(g.boats[0].id) === 'c1');
      T('받아온 배를 현재 배로 잡는다', String(g.currentBoatId) === 'c1');

      // 이미 있는 배는 두 번 넣지 않는다
      g = await run(mk([B('c1', '퍼스트45')], [B('c1', '퍼스트45')], 'c1'));
      T('이미 있는 배를 두 번 넣지 않는다', g.boats.length === 1);

      // ★ 제원·홈포트 같은 칸이 실제로 내려오는가 (2.6 에서 버려지던 것)
      {
        const cloud = Object.assign(B('c1','퍼스트45'), {
          port:'여수 원형마리나', maker:'Beneteau', model:'First 45f5', year:1991,
          spec:{ loa:13.7, beam:4.2, draft:2.1 }, roster:{ u1:{ duesAmount:5 } },
          pub:{ port:true }, intro:[{t:'text',v:'소개'}], openJoin:false });
        const localOld = B('c1','옛 이름');
        const g2 = await run(mk([cloud], [localOld], 'c1'));
        const got = g2.boats[0];
        T('제원(spec)이 내려온다', got.spec && got.spec.loa === 13.7);
        T('홈포트·제조사·모델·연식이 내려온다',
          got.port === '여수 원형마리나' && got.maker === 'Beneteau'
          && got.model === 'First 45f5' && got.year === 1991);
        T('명부·공개설정·소개글도 내려온다',
          !!got.roster && !!got.pub && Array.isArray(got.intro) && got.openJoin === false);
      }

      // 이 기기에서 새로 만든 빈 배가 있고, 클라우드에 진짜 배가 있는 경우
      g = await run(mk([B('c1', '퍼스트45')], [B('L9', '새 배')], 'L9'));
      T('기기에서 만든 배는 지우지 않는다',
        g.boats.some(b => String(b.id) === 'L9'));
      T('클라우드 배로 현재 배를 바꾼다', String(g.currentBoatId) === 'c1');

      // 합친 뒤에는 그 배의 기록을 다시 받아와야 한다
      T('합친 뒤 cloudPull 을 다시 부른다', g.pulled === true);

    // ★ 3.15 — 아직 못 올린 배는 클라우드 것으로 덮으면 안 된다.
    //   실제로 어머니를 크루로 받았는데 다음 받아오기에서 사라졌다.
    {
      const local = { id:'b1', name:'만선호', members:{ own:'r1', mom:'r4' },
                      memberNames:{ own:'현묵', mom:'엄마' }, ranks:{} };
      const cloud = { id:'b1', name:'만선호', members:{ own:'r1' },
                      memberNames:{ own:'현묵' }, ranks:{} };
      const g = mk([cloud], [local], 'b1');
      g.dirty = ['b1'];                      // 아직 못 올린 상태
      const r = await run(g);
      const b = r.boats.find(x=>String(x.id)==='b1');
      T('못 올린 배는 클라우드가 덮지 않는다 (엄마가 남아 있다)',
        !!(b && b.members && b.members.mom));
      T('대신 다시 올린다', (r.resaved || []).includes('b1'));
    }
    // ★ 기기마다 다른 사람을 받았을 때 — 한 사람도 사라지면 안 된다.
    //   폰에서 어머니, 컴퓨터에서 아버지를 받은 상황이다.
    //   덮어쓰기로 하면 나중에 켠 기기의 것만 남는다. 실제로 그렇게 안 보였다.
    {
      const local = { id:'b1', name:'만선호', members:{ own:'r1', dad:'r3' },
                      memberNames:{ own:'현묵', dad:'아버지' }, ranks:{} };
      const cloud = { id:'b1', name:'만선호', members:{ own:'r1', mom:'r4' },
                      memberNames:{ own:'현묵', mom:'엄마' }, ranks:{} };
      const g = mk([cloud], [local], 'b1');
      const r = await run(g);
      const b = r.boats.find(x=>String(x.id)==='b1');
      T('클라우드에만 있던 사람이 내려온다 (엄마)', !!(b && b.members.mom));
      T('이 기기에만 있던 사람이 남는다 (아버지)', !!(b && b.members.dad));
      T('이름도 둘 다 남는다',
        !!(b && b.memberNames.mom === '엄마' && b.memberNames.dad === '아버지'));
    }
    {
      // 못 올린 것이 없으면 평소대로 클라우드 값을 받는다
      const local = { id:'b1', name:'옛 이름', members:{ own:'r1' }, memberNames:{}, ranks:{} };
      const cloud = { id:'b1', name:'새 이름', members:{ own:'r1', mom:'r4' },
                      memberNames:{ mom:'엄마' }, ranks:{} };
      const g = mk([cloud], [local], 'b1');
      const r = await run(g);
      const b = r.boats.find(x=>String(x.id)==='b1');
      T('평소에는 클라우드 값을 받는다', !!(b && b.name === '새 이름' && b.members.mom));
    }
      done();
    })();
  }
}

function done(){
  // ───────────────────────────────────────────────────────
  // 3. '다시 묻지 않음' 은 성공한 뒤에 찍어야 한다
  // ───────────────────────────────────────────────────────
  const seed = grab(js, 'cloudSeedCheck') || '';
  const setPos = seed.indexOf("setItem('bt_seedask'");
  const confPos = seed.indexOf('ask(');
  T('cloudSeedCheck 가 confirm 전에 표시를 찍지 않는다',
    setPos < 0 || (confPos >= 0 && setPos > confPos));
  T('올리기가 성공했을 때만 표시를 찍는다',
    /seedAskMark|markSeedAsked/.test(seed) || /then\([\s\S]{0,120}seedask/.test(seed));
  T('올리기 실패 시 표시를 지운다',
    /removeItem\('bt_seedask'\)/.test(js));
  T('물품이 없어도 다른 기록이 있으면 물어본다',
    !/if\(!\(cloud && unlocked && items\.length &&/.test(seed));

  // ───────────────────────────────────────────────────────
  // 4. push 조건에서 빠진 컬렉션이 없는가
  // ───────────────────────────────────────────────────────
  const push = grab(js, 'pushNow') || '';
  // pushNow 안에서 만들어지는 set 목록을 전부 뽑는다
  const sets = [...push.matchAll(/const \[(set[A-Za-z]+),\s*(del[A-Za-z]+)\]/g)].map(m => [m[1], m[2]]);
  T('pushNow 가 여러 컬렉션의 변화를 계산한다', sets.length >= 15);
  // 보낼 것을 모으는 자리(payload) 든, 손으로 나열한 조건문이든
  // 어느 쪽이든 계산한 컬렉션이 전부 들어 있어야 한다.
  const guard = (push.match(/const payload = \{([\s\S]*?)\};/)
              || push.match(/if\((set[\s\S]*?)\)\{/) || ['', ''])[1];
  const missed = sets.filter(([s, d]) => !guard.includes(s) || !guard.includes(d))
                     .map(([s]) => s);
  T('보내는 목록에서 빠진 컬렉션이 없다 — 빠진 것: ' + (missed.join(', ') || '없음'),
    guard.length > 0 && missed.length === 0);
  // 조건은 목록에서 스스로 세어야 한다. 손으로 나열하면 또 빠뜨린다.
  T('올릴지 말지를 목록에서 스스로 센다',
    /for\s*\(const \w+ in payload\)/.test(push) || /Object\.(keys|values)\(payload\)/.test(push));
  T('cloud.push 가 도형(setSH)을 보낸다', /setSH/.test(push));
  T('cloud.push 가 게시판(setPO)을 보낸다', /setPO/.test(push));
  // 안 올렸는데 '올렸다'고 표시하면 안 된다
  T('올리지 않았으면 기준값을 갱신하지 않는다',
    /pushed|didPush|sent/.test(push));

  // ───────────────────────────────────────────────────────
  // 5. 선주 판정 (배 삭제)
  // ───────────────────────────────────────────────────────
  // members 는 uid → 등급id 지도다. 옛 배(등급 없음)만 역할 문자열을 쓴다.
  // ★ 5.0 — 선주 판정이 boatOwnedBy() 한 곳으로 빠졌다. canDelBoat 는 그것을 부른다.
  //   보아야 할 것은 그대로다: 등급(ranks)의 owner 표시로 가리고,
  //   등급이 있으면 옛 역할 문자열보다 먼저 본다.
  const cdb = grab(js, 'canDelBoat') || '';
  const obb = grab(js, 'boatOwnedBy') || '';
  T('선주 판정이 한 곳에 모여 있다 (boatOwnedBy)', obb.length > 0);
  T('canDelBoat 가 그 한 곳에 맡긴다', /boatOwnedBy\(/.test(cdb));
  T('canDelBoat 가 지금 로그인한 사람으로 묻는다', /__user\.uid/.test(cdb));
  T('canDelBoat 가 등급(ranks)을 본다', /\branks\b/.test(obb));
  T('canDelBoat 가 등급의 owner 표시로 선주를 가린다', /\.owner\s*===\s*true/.test(obb));
  T('등급이 있으면 문자열 역할보다 먼저 본다',
    obb.indexOf('ranks') >= 0 && obb.indexOf('ranks') < obb.lastIndexOf("'owner'"));

  // ★ 글자만 보고 넘기지 않는다 — 떼어 내서 진짜로 돌려 본다.
  {
    let f = null, err = '';
    try{ f = new Function(obb + '\n return boatOwnedBy;')(); }catch(e){ err = e.message; }
    T('선주 판정을 꺼내 돌릴 수 있다' + (err ? ' — ' + err : ''), typeof f === 'function');
    if(typeof f === 'function'){
      const 등급배 = { members:{ u1:'r1', u2:'r2' },
                       ranks:{ r1:{ id:'r1', name:'선주', owner:true }, r2:{ id:'r2', name:'선원' } } };
      T('등급 owner 인 사람은 선주다', f(등급배, 'u1') === true);
      T('등급이 owner 가 아니면 선주가 아니다', f(등급배, 'u2') === false);
      // 옛 배 — 등급이 없을 때만 역할 문자열로 본다
      T('옛 배는 역할 문자열로 본다', f({ members:{ u1:'owner' } }, 'u1') === true);
      T('옛 배에서 owner 가 아니면 아니다', f({ members:{ u1:'admin' } }, 'u1') === false);
      // ★★★ 등급이 있으면 등급이 이긴다 — 문자열 'owner' 를 등급 id 로 쓰더라도
      T('등급이 문자열보다 먼저다',
        f({ members:{ u1:'owner' }, ranks:{ owner:{ id:'owner', name:'손님', owner:false } } }, 'u1') === false);
      T('아직 클라우드에 안 올라간 배는 내 것이다', f({ members:{} }, 'u1') === true);
      T('남의 배는 아니다', f(등급배, 'u9') === false);
    } else fail += 7;
  }

  // ───────────────────────────────────────────────────────
  // 6. 로그인 전에 지나간 pull 을 다시 하는가
  // ───────────────────────────────────────────────────────
  // ★ '앵커에서 1500자 안' 으로 보면 코드가 늘어나기만 해도 헛실패한다.
  //   __onAuth 본문만 떼어 그 안에서 본다.
  T('로그아웃 상태에서 첫 pull 이 실패해도 다시 시도한다',
    /(cloudPull|mergeCloudBoats)/.test(grabArrow(js, 'window.__onAuth =')));

  // ★ 배 문서도 '받아온 뒤에' 올려야 한다.
  //   먼저 올리면 이 기기에 없던 사람을 클라우드에서 지워 버린다.
  //   실제로 컴퓨터에서 로그인할 때마다 어머니가 지워졌다.
  {
    const oa = grabArrow(js, 'window.__onAuth =');
    T('로그인 뒤 배를 올리는 곳이 있다', /saveBoatCloud\(/.test(oa));
    // ★ 자리 번호로 비교하면 함수를 '정의한 자리' 에 속는다. 정의를 떼어내고 본다.
    const defI = oa.indexOf('const pushBoatsAfterPull');
    let def = '';
    if(defI >= 0){
      let d = 0, j = oa.indexOf('{', defI);
      for(; j < oa.length; j++){
        if(oa[j] === '{') d++;
        else if(oa[j] === '}'){ d--; if(d === 0){ j++; break; } }
      }
      def = oa.slice(defI, j);
    }
    T('받아온 뒤에 올리는 함수가 있다', def.length > 0 && /saveBoatCloud\(/.test(def));
    // 그 함수 밖에서 배를 올리는 곳이 있으면 안 된다 (그러면 받아오기보다 먼저 나간다)
    const outside = oa.replace(def, '');
    T('그 함수 밖에서 배를 미리 올리지 않는다',
      !/boats\.forEach\([^)]*saveBoatCloud/.test(outside));
    T('받아오기가 끝난 뒤에만 부른다',
      /mergeCloudBoats\(\)\.then\(\(\)=>\{ pushBoatsAfterPull\(\)/.test(oa));
    T('다시 올리기도 받아온 뒤에 한다',
      /pushBoatsAfterPull[\s\S]{0,300}?retryDirtyBoats\(\)/.test(oa));
  }

  // ───────────────────────────────────────────────────────
  // 7. 규칙에 boats 목록 조회(list) 가 열려 있는가
  // ───────────────────────────────────────────────────────
  try{
    const rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8');
    T('규칙에 boats 목록 조회(list) 가 있다', /allow list:/.test(rules));
    T('목록 조회는 내가 구성원인 배만 준다',
      /allow list:[\s\S]{0,200}?resource\.data[\s\S]{0,120}?members[\s\S]{0,120}?request\.auth\.uid/.test(rules));
  }catch(e){
    console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (2건)');
    fail += 2;
  }

  // ───────────────────────────────────────────────────────
  // 8. 받아오기 전에 올리면 안 된다
  //    기기가 켜지면서 기본 도면·기본 칸을 스스로 깐다(seed). 그 상태에서
  //    받아오기보다 올리기가 먼저 나가면, 다른 기기가 올려 둔 진짜 자료를
  //    이 기기의 기본값으로 덮어쓴다. 컴퓨터에서 켜자마자 벌어지는 일이다.
  // ───────────────────────────────────────────────────────
  // ★ 정규식으로 '함수 이름 뒤 몇 글자'를 보면 옆 함수까지 넘겨본다.
  //   실제로 이 검사가 사보타주를 못 잡았다. 함수 본문만 떼어서 본다.
  T('첫 받아오기 전에는 올리지 않는다',
    /pullDone/.test(grab(js, 'schedulePush') || ''));
  T('받아오기가 끝나면 밀어둔 올리기를 이어서 한다',
    /pullDone\s*=\s*true/.test(js) && /pushWanted|pendingPush/.test(js));
  T('pushNow 도 받아오기 전에는 나가지 않는다',
    /pullDone/.test(grab(js, 'pushNow') || ''));
  T('배를 바꾸면 다시 받아오기 전까지 잠근다',
    /pullDone\s*=\s*false/.test(grab(js, 'switchBoat') || ''));
  T('배를 바꾸면 그 배의 클라우드 자료를 받아온다',
    /cloudPull/.test(grab(js, 'switchBoat') || ''));
  T('mergeCloudBoats 는 저장보다 받아오기를 먼저 한다',
    (function(){
      const f = grab(js, 'mergeCloudBoats') || '';
      const p = f.indexOf('cloudPull'), q = f.lastIndexOf('sysSave');
      return p >= 0 && q >= 0 && p < q;
    })());

  // ───────────────────────────────────────────────────────
  // 9. 잠금 안내는 여는 방법까지 줘야 한다
  //    '잠겨 있습니다' 만 띄우고 어디서 여는지 안 알려주면 갇힌다.
  // ───────────────────────────────────────────────────────
  const lkc = grab(js, 'lkCanEdit') || '';
  const shc = grab(js, 'shCanEdit') || '';
  T('칸 잠금 안내가 그 자리에서 열 수 있게 물어본다',
    /ask\(/.test(lkc) && /setLkLock\(false\)/.test(lkc));
  T('도면 잠금 안내가 그 자리에서 열 수 있게 물어본다',
    /ask\(/.test(shc) && /setDgLock\(false\)/.test(shc));
  T('편집 잠금일 때는 어디서 여는지 알려준다',
    /머리줄|오른쪽 위|편집 중/.test(lkc));

  // ───────────────────────────────────────────────────────
  // 10. 배 문서의 모든 칸이 올라가고 내려와야 한다
  //     2.6 의 mergeCloudBoats 는 name·members·memberNames·ranks 넷만 받아왔다.
  //     제원(spec)·홈포트·제조사·모델·연식·좌표·명부·공개설정·소개글이 전부 버려졌다.
  //     올리는 쪽과 받는 쪽이 같은 목록을 보게 해서 다시는 어긋나지 않게 한다.
  // ───────────────────────────────────────────────────────
  T('배 문서 칸 목록(BOAT_FIELDS)이 한 곳에 있다', /const BOAT_FIELDS\s*=/.test(js));
  {
    const m = js.match(/const BOAT_FIELDS = \[([\s\S]*?)\];/);
    const fields = m ? [...m[1].matchAll(/'([a-zA-Z]+)'/g)].map(x => x[1]) : [];
    const must = ['name','type','port','maker','model','year','lat','lon','code','spec',
                  'members','memberNames','ranks','roster','openJoin','pub','intro'];
    const gone = must.filter(k => !fields.includes(k));
    T('빠진 칸이 없다 — 빠진 것: ' + (gone.join(', ') || '없음'), gone.length === 0);
    T('올리는 쪽이 같은 목록을 쓴다', /__boatFields|BOAT_FIELDS/.test(mod));
    const merge = grab(js, 'mergeCloudBoats') || '';
    T('받는 쪽도 같은 목록을 쓴다', /BOAT_FIELDS/.test(merge));
    T('네 개만 골라 받지 않는다',
      !/if\(cb\.name\) old\.name = cb\.name;/.test(merge));
  }

  // ───────────────────────────────────────────────────────
  // 11. '지금 동기화' 는 올리기와 받아오기로 나눈다
  //     한 버튼이 올리는 건지 받는 건지 알 수 없다는 지적.
  // ───────────────────────────────────────────────────────
  T('올리기(syncUp)가 따로 있다', !!grab(js, 'syncUp'));
  T('받아오기(syncDown)가 따로 있다', !!grab(js, 'syncDown'));
  T('받아오기는 이 기기 기록이 바뀐다고 먼저 알린다',
    /ask\(/.test(grab(js, 'syncDown') || ''));
  T('서랍에 올리기·받아오기가 따로 있다',
    /syncUp\(\)/.test(src) && /syncDown\(\)/.test(src));
  T('뭉뚱그린 [지금 동기화] 버튼은 없앤다',
    !/onclick="closeDrawer\(\);syncNow\(\)"/.test(src));

  // ───────────────────────────────────────────────────────
  // 12. CSV 내보내기 — 데이터 백업과 헷갈린다는 지적으로 뺀다
  // ───────────────────────────────────────────────────────
  T('서랍에 CSV 내보내기가 없다', !/exportCSV\(\)/.test(src));

  
    console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
  process.exit(fail ? 1 : 0);
}
