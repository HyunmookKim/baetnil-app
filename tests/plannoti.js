// 출항 예정 알림 — 예정을 잡은 사람이 고른 구성원에게, 고른 때에 간다
//
// ★ 여기서 틀리면 남의 폰이 울린다. 되돌릴 수 없다.
//   ① 고르지 않은 사람에게 가면 안 된다
//   ② 껐다는 사람에게 가면 안 된다
//   ③ 한 번 보낸 것을 또 보내면 안 된다
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
const srv = fs.readFileSync(process.argv[3] || 'fn/functions/index.js', 'utf8');
const rules = fs.readFileSync('firestore_rules.txt', 'utf8');

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// ── 1. 앱에 문이 있다
for(const f of ['planNotiGet','planNotiSet','planFireAt','planNotiSync','planNotiBox','openPlanWho'])
  T(f + ' 이 있다', !!grab(src, f));
T('언제 알릴지 고를 값이 있다', /const PLAN_BEFORE\s*=\s*\[/.test(src));
T('★ 「안 함」이 고를 수 있는 값에 들어 있다', /const PLAN_BEFORE\s*=\s*\[\s*0\s*,/.test(src));

// ── 2. 받는 사람은 고른 사람뿐이다
const sync = grab(src, 'planNotiSync') || '';
T('★ 고른 사람 목록을 그대로 보낸다', /who/.test(sync));
T('★ 아무도 안 골랐으면 보내지 않는다', /who\.length|!who\.length|length\s*(<|===)\s*1?/.test(sync));
T('보내는 사람이 누구인지 남긴다', /by\s*:/.test(sync));
T('어느 배·어느 항해인지 남긴다', /boatId/.test(sync) && /vid/.test(sync));

// ── 3. 언제 보낼지는 사람이 정한다 (내가 정하지 않는다)
const fire = grab(src, 'planFireAt') || '';
T('★ 출항 시각에서 고른 만큼 앞당긴다', /before/.test(fire) && /36e5|3600|60\s*\*\s*60/.test(fire));
T('지난 시각이면 안 건다', /return\s*''|null/.test(fire));

// ── 4. 받는 쪽 스위치
T('★ 받는 쪽에 끄고 켜는 스위치가 있다', /boatPlan/.test(src));
T('그 스위치가 서버로 간다', /boatPlan/.test(grab(src, 'fcmBody') || ''));
T('기본값이 켜져 있다', /boatPlan:\s*true/.test(grab(src, 'NOTI_DEF') ? '' : src.slice(src.indexOf('const NOTI_DEF'), src.indexOf('const NOTI_DEF') + 700)));

// ── 5. 규칙 — 남의 배 사람에게 못 보낸다
const blk = (()=>{ const i = rules.indexOf('match /planNoti/'); if(i < 0) return '';
  return rules.slice(i, rules.indexOf('}', rules.indexOf('allow delete', i)) + 1); })();
T('★ 규칙에 planNoti 가 있다', blk.length > 40);
T('★ 훑어보기는 아무도 못 한다 (남의 배 예정이 다 보인다)', /allow list:\s*if false/.test(blk));
T('★ 그 배 구성원만 쓸 수 있다', /isMember\(/.test(blk));
T('보낸 사람 이름을 속일 수 없다', /request\.resource\.data\.by == request\.auth\.uid/.test(blk));

// ── 6. 서버 — 보내는 문은 하나뿐이다
T('★ 서버가 예정 알림을 보낸다', /pushPlanNow/.test(srv) && /pushPlanSoon/.test(srv));
T('★ 서버도 같은 문(sendTo)으로 보낸다',
  /sendTo\([^)]*'boatPlan'\)/.test(srv) || /sendTo\([\s\S]{0,200}boatPlan/.test(srv));
T('★ 「지금 알리기」를 두 번 안 보낸다 (막는 조건문이 있다)',
  /if\s*\(String\(p\.sentNow[^)]*\)\s*===\s*now\)\s*return;/.test(srv));
T('★ 「출항 전에」도 두 번 안 보낸다 (막는 조건문이 있다)',
  /if\s*\(String\(p\.sentSoon[^)]*\)\s*===\s*at\)\s*continue;/.test(srv));
T('보낸 뒤에 표시를 남긴다', /sentNow:\s*now/.test(srv) && /sentSoon:\s*at/.test(srv));
T('때가 된 것만 고른다', /fireAt/.test(srv));
T('예정을 잡은 사람 자신에게는 안 보낸다', /by/.test(srv));

// ── 7. 앱과 서버가 같은 말을 쓴다 (한 글자만 달라도 조용히 안 온다)
// 앱이 쓰고 서버가 읽는 칸 — 한 글자만 달라도 조용히 안 온다
for(const k of ['planNoti','fireAt','boatPlan','who','boatName','timeOut'])
  T("'" + k + "' 을 앱과 서버가 똑같이 쓴다", src.indexOf(k) > 0 && srv.indexOf(k) > 0);
// 서버만 쓰는 칸 — 앱이 건드리면 「이미 보냈다」 표시가 지워져 두 번 간다
for(const k of ['sentNow','sentSoon']){
  T("'" + k + "' 은 서버만 쓴다", srv.indexOf(k) > 0 && src.indexOf(k) < 0);
}
{
  const i = src.indexOf('window.__plannoti = {');
  const door = i > 0 ? src.slice(i, i + 800) : '';
  T('★ 앱이 덮어쓰지 않고 겹쳐 쓴다 (보낸 표시가 지워지면 두 번 간다)',
    /merge\s*:\s*true/.test(door));
  T('필요 없어지면 지운다 (남겨 두면 때가 됐을 때 헛것이 간다)', /deleteDoc\(/.test(door));
}

// ── 7-b. 세 갈래로 고른다 — 신청자 · 명부 · 저장해 둔 묶음
for(const f of ['planNotiRide','crewSetList','crewSetSave','crewSetDel','planWhoAdd','planWhoToggle'])
  T(f + ' 이 있다', !!grab(src, f));
T('★ 같이 타기 신청은 글판 댓글로 들어온다 — 그 글을 본다',
  /ridePost/.test(grab(src, 'planNotiRide') || ''));
T('저장해 둔 묶음은 배 문서에 둔다', /crewSets/.test(src));

// ── 7-c. ★★ 묶음에는 uid 가 들어 있다. 밖으로 나가면 안 된다.
{
  const bp = grab(src, 'buildPublic') || '';
  T('★★ 저장해 둔 묶음이 공개 자료로 안 나간다', !/crewSets/.test(bp));
  T('★★ 예정 알림 설정도 공개 자료로 안 나간다', !/pnoti/.test(bp));
}

// ── 7-d. ★ 진짜로 돌려 본다. 정규식만으로는 「값이 맞는가」를 못 잡는다.
{
  globalThis.t = x => x;
  globalThis.tsub = (k, v) => { let o = String(k);
    for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; };
  globalThis.saveMR = () => {};
  globalThis.newId = (()=>{ let n=0; return ()=>'s'+(++n); })();
  let boat = null;
  globalThis.curBoat = () => boat;
  { const m = src.match(/const PLAN_BEFORE\s*=\s*\[[^\]]*\];/);
    if(m) eval(m[0].replace('const PLAN_BEFORE','globalThis.PLAN_BEFORE')); }
  { const m = src.match(/const PLAN_WHO_MAX\s*=\s*[^;]+;/);
    if(m) eval(m[0].replace('const PLAN_WHO_MAX','globalThis.PLAN_WHO_MAX')); }
  for(const f of ['planDepartAt','planNotiGet','planNotiSet','planFireAt','planNotiId',
                  'planBeforeName','crewSetList','crewSetSave','crewSetDel'])
    eval('globalThis.' + f + ' = ' + grab(src, f));

  // 출항 시각 읽기
  const it = { id:'v1', date:'2026-09-03', timeOut:'07:30' };
  const dep = planDepartAt(it);
  T('출항 시각을 읽는다', dep && dep.getHours() === 7 && dep.getMinutes() === 30);
  T('날짜가 없으면 시각도 없다', planDepartAt({ id:'v2', timeOut:'07:30' }) === null);

  // ★ 언제 보낼지 — 고른 만큼 앞당긴다
  const far = { id:'v3', date:'2099-01-01', timeOut:'10:00', pnoti:{ before:3, who:['u2'] } };
  const at = planFireAt(far);
  T('★ 고른 시간만큼 앞당긴다',
    at && Math.abs(new Date(at).getTime() - (planDepartAt(far).getTime() - 3*36e5)) < 1000);
  T('안 함(0)이면 안 건다', planFireAt({ id:'v4', date:'2099-01-01', timeOut:'10:00',
                                      pnoti:{ before:0, who:['u2'] } }) === '');
  T('★ 이미 지난 때는 안 건다', planFireAt({ id:'v5', date:'2020-01-01', timeOut:'10:00',
                                          pnoti:{ before:1, who:['u2'] } }) === '');

  // 고른 사람 읽고 쓰기
  T('처음에는 아무도 안 골라져 있다', planNotiGet({ id:'v6' }).who.length === 0);
  const w = { id:'v7' };
  planNotiSet(w, { who:['u2','u3'] });
  T('고른 사람이 저장된다', planNotiGet(w).who.join(',') === 'u2,u3');

  // 묶음
  boat = { id:'b1', members:{ u1:'r1', u2:'r1' } };
  crewSetSave('주말 크루', ['u2','u3']);
  T('묶음이 저장된다', crewSetList(boat).length === 1 && crewSetList(boat)[0].name === '주말 크루');
  crewSetSave('주말 크루', ['u2']);
  T('★ 같은 이름이면 덮어쓴다 (같은 이름이 둘이면 사람이 헷갈린다)',
    crewSetList(boat).length === 1 && crewSetList(boat)[0].who.join(',') === 'u2');
  crewSetSave('정기 멤버', ['u3','u4']);
  T('묶음을 여럿 둘 수 있다', crewSetList(boat).length === 2);
  const id0 = crewSetList(boat)[0].id;
  T('묶음을 지운다', crewSetDel(id0) === true && crewSetList(boat).length === 1);
  T('없는 묶음을 지우라 하면 아무 일도 없다', crewSetDel('없다') === false);
  T('이름이 비면 저장하지 않는다', crewSetSave('   ', ['u2']) === '' && crewSetList(boat).length === 1);

  // 「며칠 전」 말
  T('0은 「안 함」이다', planBeforeName(0) === '안 함');
  T('24시간은 하루로 읽는다', /1일/.test(planBeforeName(24)));
  T('3시간은 시간으로 읽는다', /3시간/.test(planBeforeName(3)));
}

// ── 7-e. ★★ 내보내는 문을 진짜로 돌려 본다
//    여기가 틀리면 남의 폰이 울린다. 정규식으로는 「누가 빠졌는가」를 못 잡는다.
{
  let putBody = null, dropped = null;
  globalThis.window = globalThis.window || {};
  window.__plannoti = { async save(b){ putBody = b; return b.id; },
                        async drop(id){ dropped = id; } };
  globalThis.meUid = () => 'me';
  globalThis.curBoat = () => ({ id:'b1', name:'현묵호', members:{ me:'r', u2:'r', u3:'r' } });
  eval('globalThis.planNotiSync = ' + grab(src, 'planNotiSync'));

  const mk = (pn) => ({ id:'v9', date:'2099-05-01', timeOut:'08:00', title:'거문도', pnoti:pn });

  (async ()=>{
    // ① 나 자신은 빠진다
    putBody = null;
    await planNotiSync(mk({ who:['me','u2','u3'], before:3, now:'' }));
    T('★★ 예정을 잡은 나 자신에게는 안 보낸다',
      !!putBody && putBody.who.indexOf('me') < 0 && putBody.who.length === 2);
    T('고른 사람은 그대로 들어간다', !!putBody && putBody.who.join(',') === 'u2,u3');
    T('어느 배·어느 항해인지 들어간다',
      !!putBody && putBody.boatId === 'b1' && putBody.vid === 'v9' && putBody.by === 'me');
    T('언제 보낼지가 들어간다', !!putBody && !!putBody.fireAt);

    // ② 아무도 안 골랐으면 아예 안 내보낸다
    putBody = null; dropped = null;
    await planNotiSync(mk({ who:[], before:3, now:'' }));
    T('★★ 아무도 안 골랐으면 내보내지 않는다', putBody === null);
    T('그때는 예약을 지운다', dropped === 'b1_v9');

    // ③ 나만 골랐으면 보낼 사람이 없다
    putBody = null; dropped = null;
    await planNotiSync(mk({ who:['me'], before:3, now:'' }));
    T('★★ 나만 골랐으면 내보내지 않는다', putBody === null && dropped === 'b1_v9');

    // ④ 언제도 안 정했으면 안 내보낸다
    putBody = null; dropped = null;
    await planNotiSync(mk({ who:['u2'], before:0, now:'' }));
    T('★★ 지금도 아니고 예약도 아니면 내보내지 않는다', putBody === null && dropped === 'b1_v9');

    // ⑤ 「지금 알리기」만 눌렀으면 예약 없이도 나간다
    putBody = null;
    await planNotiSync(mk({ who:['u2'], before:0, now:'2026-08-27T00:00:00.000Z' }));
    T('지금 알리기는 예약 없이도 나간다', !!putBody && putBody.fireAt === '' && !!putBody.now);

    console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
    if(fail) process.exit(1);
  })();
}

// ── 8. 사전
for(const k of ['출항 예정 알림','알릴 사람 고르기','우리 배 출항 예정'])
  T("'" + k + "' 이 영어·러시아어에 다 있다", (src.split("'" + k + "':").length - 1) >= 2);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
