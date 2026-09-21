// 배 공개 설정 검증 — 위험한 항목은 켜도 안 나간다
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
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

globalThis.window = { __user:{ uid:'u1', name:'현묵' } };
globalThis.alerts = [];
globalThis.alert = m => globalThis.alerts.push(m);
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
globalThis.saveLocal = ()=>{};
globalThis.newId = (()=>{ let n=0; return ()=>'q'+(++n); })();
globalThis.today = () => '2026-08-10';
globalThis.BOAT_TYPES = { sail:'세일링 요트', power:'모터보트·요트', fishing:'낚시·유어선', other:'기타' };
globalThis.items = []; globalThis.maint = []; globalThis.voyage = []; globalThis.posts = [];
globalThis.lockers = [];
{ const m = src.match(/const PERMS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PERMS','globalThis.PERMS')); }
{ const m = src.match(/const PERM_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const PERM_LEVELS','globalThis.PERM_LEVELS')); }
{ const m = src.match(/const PERM_ORDER = [^;]+;/); if(m) eval(m[0].replace('const PERM_ORDER','globalThis.PERM_ORDER')); }
{ const m = src.match(/const RANK_SEED = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const RANK_SEED','globalThis.RANK_SEED')); }
{ const m = src.match(/const PUB_KEYS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PUB_KEYS','globalThis.PUB_KEYS')); }
{ const m = src.match(/const TRK_HIDE = \[[^\]]*\];/); if(m) eval(m[0].replace('const TRK_HIDE','globalThis.TRK_HIDE')); }
{ const m = src.match(/const PUB_LEVELS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PUB_LEVELS','globalThis.PUB_LEVELS')); }
{ const m = src.match(/const PUB_OUT = \{[\s\S]*?\n\};/); if(m) eval(m[0].replace('const PUB_OUT','globalThis.PUB_OUT')); }
globalThis.VOY_LEVELS = globalThis.PUB_LEVELS;

{ const m = src.match(/const TRK_HIDE_DEF = [^;]+;/); if(m) eval(m[0].replace('const TRK_HIDE_DEF','globalThis.TRK_HIDE_DEF')); }

const need = ['mkPerms','seedRanks','rankList','rankOf','myRank','myPos','permOf','can',
              'pubOn','isPublic','buildPublic','setPub',
              'pubLvOf','voyLv','mlogLv','rvLv','specLv',
              'pubPlain','wxPublic',                          // 4.74 — 나가는 칸 표
              'howSteps','howPublic',   // 4.54 — 정비 절차
              'maintRows',              // 4.56 — 장비 대장
              'posLv','seaName','posPublic','trkPublicLogArea','legPublic',   // 4.55 — 위치 공개 세 단계

              // 항적 가리개 — 스텁이 아니라 진짜를 떼어 온다. 가짜로 두면 가리개가 검사되지 않는다.
              'trkHideNm','nmBetween','trkAnchors','trkInHide','trkPublicLine','trkPublicLogPos'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
{ const m = src.match(/const POS_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const POS_LEVELS','globalThis.POS_LEVELS')); }
{ const m = src.match(/const POS_DEF\s*=\s*'[^']*';/);            if(m) eval(m[0].replace('const POS_DEF','globalThis.POS_DEF')); }
globalThis.isGear = x => !!(x && x.typ === 'gear');   // 4.56
globalThis.isMlog = x => !!(x && x.typ === 'log');   // 4.63 — 정비수첩
globalThis.mlogRows = () => [];
globalThis.mlogPublic = () => null;
globalThis.regionOfPoint = () => '전남';
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const setup = ()=>{
  const b = { id:'b1', name:'현묵호', type:'sail', port:'여수 원형마리나',
    maker:'Beneteau', model:'First 45f5', year:1991, loa:13.7, beam:4.2, draft:2.4,
    phone:'010-1234-5678',
    members:{}, memberNames:{}, roster:{}, pub:{} };
  seedRanks(b);
  const L = rankList(b);
  b.members = { u1:L[0].id, u2:L[3].id };
  b.memberNames = { u1:'현묵', u2:'박크루' };
  b.roster = { u2:{ duesAmount:50000, duesCycle:'m', duesFrom:'2026-01-01',
                    awayTo:'2026-09-01', awayNote:'출장', memo:'개인 메모' } };
  lockers = [{ id:'L1', zone:'갤리', label:'싱크대 아래', x:1,y:1,w:5,h:5 }];
  items  = [{ id:'i1', name:'구명조끼', lockerId:'L1', qty:6, note:'개인 메모' }];
  maint  = [{ id:'m1', grp:'엔진', name:'엔진오일 교체', months:6, lastDate:'2026-07-01',
              note:'정비소 김씨 010-9999', history:[] }];
  voyage = [{ id:'v1', date:'2026-07-20', title:'거문도 왕복', note:'날씨 좋았음',
              track:[[34.0,127.3]], lat:34.02, lon:127.31, port:'거문도항' }];
  posts  = [{ id:'p1', kind:'free', title:'공개 글', body:'x', pub:true, ts:'2026-08-01' },
            { id:'p2', kind:'free', title:'비공개 글', body:'y', ts:'2026-08-02' }];
  globalThis.curBoat = () => b;
  globalThis.alerts = [];
  return b;
};

// 스위치 목록
T('공개 항목이 여러 가지', Array.isArray(PUB_KEYS) && PUB_KEYS.length>=6);
T('항목마다 이름이 있다', PUB_KEYS.every(k=>k.k && k.name));
T('물품 위치를 켜는 스위치는 없다', !PUB_KEYS.some(k=>/위치|locker/.test(k.k)));

// 기본은 전부 꺼짐
let b = setup();
T('처음에는 아무것도 공개 안 함', isPublic(b)===false);
T('꺼진 항목은 꺼져 있다', pubOn(b,'port')===false);

// 켜기
b = setup();
setPub(b, 'port', true);
T('항목을 켠다', pubOn(b,'port')===true);
T('하나라도 켜면 공개 상태', isPublic(b)===true);
T('모르는 항목은 안 켜진다', setPub(b,'없는항목',true)===null);

// 이름과 선종은 항상 함께
b = setup();
setPub(b, 'port', true);
let pubd = buildPublic(b);
T('배 이름이 나간다', pubd.name==='현묵호');
T('선종이 함께 나간다', pubd.type==='sail');
T('홈포트가 나간다', pubd.port==='여수 원형마리나');
T('안 켠 제원은 안 나간다', !pubd.maker && !pubd.loa);

// 항해일지 — 좌표는 절대 안 나간다
b = setup();
setPub(b,'voyage',true);
pubd = buildPublic(b);
T('항해일지가 나간다', (pubd.voyage||[]).length===1);
T('항로 제목과 날짜는 나간다', pubd.voyage[0].title==='거문도 왕복' && pubd.voyage[0].date==='2026-07-20');
T('좌표는 안 나간다', !JSON.stringify(pubd.voyage).match(/34\.0|127\.3/));
T('정박지 이름도 안 나간다', !JSON.stringify(pubd.voyage).includes('거문도항'));

// ── 항적 보이기 (4.35)
//
// ★ 기본은 꺼짐. 켜야만 나가고, 켜도 배가 매인 위치 둘레는 잘려 나간다.
//   여기가 뚫리면 「빈 배가 어디 있는지」가 통째로 새어 나간다.
const TRKV = () => ({
  id:'v9', date:'2026-08-01', title:'시험',
  posOut:{ lat:34.7400, lon:127.7400 },      // 계류 자리
  posIn: { lat:34.7400, lon:127.7400 },
  // 항구 → 바다 → 항구. 가운데 두 점만 멀리 있다.
  trk:[ {la:34.7400,lo:127.7400,t:'2026-08-01T08:00:00Z'},
        {la:34.7420,lo:127.7420,t:'2026-08-01T08:10:00Z'},   // 0.16해리쯤
        {la:34.9000,lo:127.9000,t:'2026-08-01T10:00:00Z'},   // 멀다
        {la:34.9500,lo:127.9500,t:'2026-08-01T11:00:00Z'},   // 멀다
        {la:34.7400,lo:127.7400,t:'2026-08-01T14:00:00Z'} ],
  logs:[ { id:'g1', time:'08:05', kind:'출항', text:'나감',
           pos:{ lat:34.7401, lon:127.7401 } },              // 계류 자리 바로 옆
         { id:'g2', time:'10:00', kind:'기록', text:'바다',
           pos:{ lat:34.9000, lon:127.9000 } } ]             // 멀다
});
b = setup(); voyage = [TRKV()]; setPub(b,'voyage',true);
pubd = buildPublic(b);
T('★ 안 켜면 항적이 아예 안 나간다', pubd.voyage[0].trk === null);
T('★ 안 켜면 중간 기록 자리도 안 나간다', !pubd.voyage[0].logs.some(g=>g.pos));
T('★ 안 켜면 계류 좌표가 어디에도 없다', !JSON.stringify(pubd.voyage).includes('34.74'));

b = setup(); voyage = [Object.assign(TRKV(), { pubTrk:true })]; setPub(b,'voyage',true);
pubd = buildPublic(b);
T('켜면 항적이 나간다', Array.isArray(pubd.voyage[0].trk) && pubd.voyage[0].trk.length >= 2);
T('★ 켜도 계류 자리는 안 나간다', !JSON.stringify(pubd.voyage[0].trk).includes('34.74'));
T('★ 계류 자리 옆 중간 기록도 안 나간다', (()=>{
  const g = pubd.voyage[0].logs.find(x=>x.time==='08:05');
  return g && !g.pos; })());
T('멀리 있는 중간 기록은 나간다', (()=>{
  const g = pubd.voyage[0].logs.find(x=>x.time==='10:00');
  return g && g.pos && Math.abs(g.pos.lat - 34.9) < 0.001; })());
T('가운데 항적은 그대로 나간다',
  pubd.voyage[0].trk.some(p=>Math.abs(p.lat-34.9) < 0.001));

// 가리개를 넓히면 더 잘려 나간다
b = setup(); b.trkHide = 2; voyage = [Object.assign(TRKV(), { pubTrk:true })]; setPub(b,'voyage',true);
const wide = buildPublic(b).voyage[0].trk || [];
b = setup(); b.trkHide = 0.5; voyage = [Object.assign(TRKV(), { pubTrk:true })]; setPub(b,'voyage',true);
const narrow = buildPublic(b).voyage[0].trk || [];
T('가리개를 넓히면 덜 나간다', wide.length <= narrow.length);
T('★ 넓히든 좁히든 계류 자리는 안 나간다',
  !JSON.stringify(wide).includes('34.74') && !JSON.stringify(narrow).includes('34.74'));

// 가리개를 꺼도 「켠 항해」만 나간다
b = setup(); b.trkHide = 0; voyage = [TRKV()]; setPub(b,'voyage',true);
T('★ 가리개를 꺼도 안 켠 항해는 안 나간다', buildPublic(b).voyage[0].trk === null);

// 점이 몇 안 되면 아예 안 내보낸다 (선도 안 그려지는데 좌표만 새어 나간다)
b = setup();
voyage = [{ id:'v8', date:'2026-08-02', pubTrk:true,
            posOut:{lat:34.74,lon:127.74}, posIn:{lat:34.74,lon:127.74},
            trk:[{la:34.7401,lo:127.7401},{la:34.7402,lo:127.7402}] }];
setPub(b,'voyage',true);
T('★ 다 가려지면 아무것도 안 내보낸다', buildPublic(b).voyage[0].trk === null);

// 좌표 자릿수 — 소수 넷째 자리까지만 (11m 쯤). 그보다 잘게 내보낼 까닭이 없다
b = setup(); voyage = [Object.assign(TRKV(), { pubTrk:true })]; setPub(b,'voyage',true);
T('좌표를 필요 이상으로 잘게 안 내보낸다',
  (buildPublic(b).voyage[0].trk||[]).every(p=>{
    const d = String(p.lat).split('.')[1] || '';
    return d.length <= 4; }));

// ★ 계류 자리를 「출발로 적은 곳」으로만 아는 경우 — 항적은 멀리서 시작한다
//   (기록을 늦게 켜면 이렇게 된다). 그래도 가려져야 한다.
b = setup();
voyage = [{ id:'v7', date:'2026-08-03', pubTrk:true,
            posOut:{ lat:34.7400, lon:127.7400 },
            trk:[ {la:34.7405,lo:127.7405}, {la:34.7410,lo:127.7410},
                  {la:34.9000,lo:127.9000}, {la:34.9500,lo:127.9500} ] }];
setPub(b,'voyage',true);
T('★ 출발로 적은 자리만 알아도 가린다',
  !JSON.stringify(buildPublic(b).voyage[0].trk).includes('34.74'));

// ★ 좌표를 필요 이상으로 잘게 내보내면 계류 자리를 되짚을 실마리가 된다
b = setup();
voyage = [{ id:'v6', date:'2026-08-04', pubTrk:true,
            posOut:{ lat:34.7400, lon:127.7400 },
            // ★ 항적의 처음·끝도 가리개 자리다 (대개 거기가 계류 자리다).
            //   그래서 가운데 점이 남을 만큼 길어야 한다.
            trk:[ {la:34.9000,lo:127.9000},
                  {la:34.95012345678,lo:127.95012345678},
                  {la:35.00012345678,lo:128.00012345678},
                  {la:35.0500,lo:128.0500} ] }];
setPub(b,'voyage',true);
T('★ 좌표를 소수 넷째 자리까지만 내보낸다', (()=>{
  const line = buildPublic(b).voyage[0].trk || [];
  if(line.length < 2) return false;
  return line.every(p=>
    (String(p.lat).split('.')[1]||'').length <= 4 &&
    (String(p.lon).split('.')[1]||'').length <= 4); })());

// ★ 가는 길에 제 마리나 앞을 다시 지나는 경우
//   항적의 처음·끝은 딴 데인데 가운데가 계류 자리를 스친다.
//   이때는 「출발로 적은 자리」만이 그것을 가려 준다.
b = setup();
voyage = [{ id:'v5', date:'2026-08-05', pubTrk:true,
            posOut:{ lat:34.7400, lon:127.7400 },          // 계류 자리
            trk:[ {la:34.9000,lo:127.9000},
                  {la:34.8500,lo:127.8500},
                  {la:34.7401,lo:127.7401},                 // 제 마리나 앞을 스친다
                  {la:34.8000,lo:127.8000},
                  {la:34.9500,lo:127.9500} ] }];
setPub(b,'voyage',true);
T('★ 되돌아오며 스친 계류 자리도 가린다',
  !JSON.stringify(buildPublic(b).voyage[0].trk).includes('34.74'));

// 거리 셈이 맞는가 (가리개 전체가 여기에 달려 있다)
T('거리 셈 — 같은 자리는 0', nmBetween({lat:34.74,lon:127.74},{lat:34.74,lon:127.74}) === 0);
T('거리 셈 — 위도 1분은 1해리쯤', (()=>{
  const d = nmBetween({lat:34.00,lon:127.00},{lat:34.0166667,lon:127.00});
  return d > 0.95 && d < 1.05; })());
T('거리 셈 — 없는 점은 무한대', nmBetween(null,{lat:1,lon:1}) === Infinity);

// 물품 — 어느 칸인지 안 나간다
b = setup();
setPub(b,'gear',true);
pubd = buildPublic(b);
T('장비 이름이 나간다', (pubd.gear||[]).some(g=>g.name==='구명조끼'));
T('어느 칸인지는 안 나간다', !JSON.stringify(pubd.gear).includes('L1')
  && !JSON.stringify(pubd.gear).includes('싱크대'));
T('물품 메모도 안 나간다', !JSON.stringify(pubd.gear).includes('개인 메모'));

// 정비 — 항목과 날짜만
b = setup();
setPub(b,'maint',true);
pubd = buildPublic(b);
T('정비 항목이 나간다', (pubd.maint||[]).some(m=>m.name==='엔진오일 교체'));
T('정비 메모(연락처)는 안 나간다', !JSON.stringify(pubd.maint).includes('010-9999'));

// 명부 — 이름과 등급만
b = setup();
setPub(b,'roster',true);
pubd = buildPublic(b);
T('구성원 이름이 나간다', (pubd.roster||[]).some(r=>r.name==='박크루'));
T('등급이 나간다', (pubd.roster||[]).every(r=>r.rank));
T('회비는 안 나간다', !JSON.stringify(pubd.roster).includes('50000'));
T('부재는 안 나간다', !JSON.stringify(pubd.roster).includes('출장'));
T('개인 메모는 안 나간다', !JSON.stringify(pubd.roster).includes('개인 메모'));
T('uid 는 안 나간다', !JSON.stringify(pubd.roster).includes('u2'));

// 게시판 — 공개 표시한 글만
b = setup();
setPub(b,'board',true);
pubd = buildPublic(b);
T('공개 글만 나간다', (pubd.posts||[]).length===1 && pubd.posts[0].title==='공개 글');

// 연락처
b = setup();
setPub(b,'port',true);
T('안 켜면 연락처가 안 나간다', !buildPublic(b).phone);
setPub(b,'phone',true);
T('켜면 연락처가 나간다', buildPublic(b).phone==='010-1234-5678');

// 영업 표시
b = setup();
setPub(b,'port',true);
T('기본은 영업이 아니다', buildPublic(b).biz!==true);
setPub(b,'biz',true);
T('영업으로 표시된다', buildPublic(b).biz===true);

// 전부 끄면 아무것도 안 나간다
b = setup();
T('전부 꺼져 있으면 공개 자료가 없다', buildPublic(b)===null);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
