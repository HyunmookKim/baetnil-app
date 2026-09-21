// 장비 대장 — 정비·수리·부품이 서로를 알게 하는 뼈대 (STEP 4)
//
// ★ 저장을 어디에 두나 — 새 배열을 만들지 않는다.
//   한 배의 기록이 어느 칸에 있는지가 네 곳에 손으로 나열돼 있다(colltest 참고).
//   새 배열을 더하면 스무 곳을 고쳐야 하고, 한 곳만 빠뜨리면 조용히 구멍이 난다.
//   체크리스트(checkt)가 이미 같은 까닭으로 한 배열에 두 종류를 섞어 두었다.
//   그 선례를 따른다 — 장비는 maint 배열에 typ:'gear' 로 들어간다.
//   ★ 이렇게 하면 실수가 「조용히」 나지 않는다. 장비가 정비 목록에 섞여 보이면 바로 눈에 띈다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) i = src.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };

// ── ① 계통 열둘 · 부품 종류
const SYS = (src.match(/const GEAR_SYS = \[[\s\S]*?\];/) || [''])[0];
T('★ 계통 목록이 있다 (GEAR_SYS)', SYS.length > 0);
if(SYS){
  const n = (SYS.match(/'[^']+'/g) || []).length;
  T('★★ 열두 계통이다', n === 12, n);
  ['추진','연료','전기','항해장비','돛·삭구','갑판장비','계류·묘박','배관·위생','선체·의장','조타','주거설비','안전장비']
    .forEach(k => T('계통에 ' + k + ' 가 있다', SYS.indexOf("'" + k + "'") >= 0));
}
const KIND = (src.match(/const GEAR_KINDS = \{[\s\S]*?\n\};/) || [''])[0];
T('★ 계통마다 흔한 부품 종류가 미리 들어 있다 (GEAR_KINDS)', KIND.length > 0);
T('★★ 타이핑이 아니라 고르기다 — 종류가 넉넉히 있다',
  (KIND.match(/'[^']+'/g) || []).length >= 60, (KIND.match(/'[^']+'/g) || []).length);
const MAKERS = (src.match(/const GEAR_MAKERS = \[[\s\S]*?\];/) || [''])[0];
T('★ 흔한 제조사도 미리 들어 있다 (GEAR_MAKERS)', (MAKERS.match(/'[^']+'/g) || []).length >= 30,
  (MAKERS.match(/'[^']+'/g) || []).length);
['Yanmar','Volvo Penta','Raymarine','Lewmar','Racor','Victron'].forEach(m =>
  T('제조사에 ' + m + ' 가 있다', MAKERS.indexOf("'" + m + "'") >= 0));

// ── ② 정비 배열에 섞여 들어간다
const IS = grab('isGear'), MR = grab('maintRows'), GR = grab('gearRows');
T('★ 장비인지 가르는 곳이 있다 (isGear)', !!IS || /const isGear/.test(src));
T('★ 정비만 골라 주는 곳이 있다 (maintRows)', !!MR);
T('★ 장비만 골라 주는 곳이 있다 (gearRows)', !!GR);
if(MR && GR){
  const F = new Function('A', `
    const isGear = x => !!(x && x.typ === 'gear');
    const isMlog = x => !!(x && x.typ === 'log');   // 4.63 — 정비수첩
    const isRetired = g => !!(g && g.retired);      // 4.91 — 교체된 장비
    let maint = A;
    ${MR} ${GR}
    return { m: maintRows(), g: gearRows() };
  `);
  const a = [ { id:'m1', name:'임펠러 교체' },
              { id:'g1', typ:'gear', name:'해수펌프' },
              { id:'m2', name:'아연 교체' } ];
  const r = F(a);
  T('★★ 정비 목록에 장비가 안 섞인다', r.m.length === 2 && !r.m.some(x=>x.typ==='gear'), r.m.map(x=>x.id));
  T('★★ 장비 목록에 정비가 안 섞인다', r.g.length === 1 && r.g[0].id === 'g1', r.g.map(x=>x.id));
  T('빈 것도 안 터진다', F([]).m.length === 0 && F([]).g.length === 0);
}

// ── ③ 장비가 정비 쪽 길로 새면 안 된다
T('★★ 공개 자료에 장비가 안 섞인다', /maintRows\(\)[\s\S]{0,80}howPublic|o\.maint = maintRows\(\)/.test(src),
  (src.match(/o\.maint = [^\n]*/)||[''])[0]);
T('★★ 정비 알람이 장비를 안 센다', /maintRows\(\)/.test(grab('maintAlarmPlan') || ''),
  (grab('maintAlarmPlan')||'').slice(0,300));
T('★★ 오늘 화면의 「곧 해야 할 정비」 가 장비를 안 센다', /maintRows\(\)\s*\.map\(x =>/.test(src) || /\(maintRows\(\)\)/.test(src),
  (src.match(/const soon = [^\n]*/)||[''])[0]);

// ── ④ 장비 한 칸의 모양
const NEW = grab('gearNew');
T('★ 장비를 만드는 곳이 있다 (gearNew)', !!NEW);
if(NEW){
  T('★ 계통·종류·제조사·모델·일련번호·설치일을 담는다',
    ['sys','kind','maker','model','sn','since'].every(k => new RegExp(k + '\\s*:').test(NEW)), NEW.slice(0,300));
  T('★ 도면 핀 자리가 있다 (우리만 되는 것)', /pin\s*:/.test(NEW), NEW.slice(0,300));
  T('★★ 반드시 typ 가 gear 다 (안 그러면 정비 목록에 섞인다)', /typ\s*:\s*'gear'/.test(NEW), NEW.slice(0,200));
}

// ── ⑤ 정비 쪽 길이 전부 문을 지나는가 (하나만 빠져도 장비가 정비 목록에 섞인다)
[['정기점검 요약(maintCounts)','maintCounts'],
 ['정기점검 거르기(maintFilter)','maintFilter'],
 ['계통 채우기(normalizeMaint)','normalizeMaint'],
 ['계통 목록(allGrps)','allGrps']].forEach(([nm, fn]) => {
  const b2 = grab(fn) || '';
  T('★ ' + nm + ' 가 maintRows 를 쓴다',
    !b2 || (/maintRows\(\)/.test(b2) && !/[^A-Za-z]maint\.(forEach|filter|length)/.test(b2)),
    b2.slice(0, 200));
});
T('★ 정비 목록이 비었는지도 정비만 세어 본다',
  /if\(!maintRows\(\)\.length\)\{/.test(src));
T('★ 화면 아래 개수 표시도 정비만 센다',
  /\$\{esc\(t\('정기점검'\)\)\} \$\{maintRows\(\)\.length\}/.test(src));

// ── ⑥ 화면이 실제로 붙었는가 (뼈대만 있고 그리는 곳이 없으면 빈 화면이 뜬다)
T('★ 배 탭에 장비 자리가 있다', /id="gearWrap"/.test(src) && /id="gearList"/.test(src));
T('★ 장비 하위 탭 이름이 있다', /BOATSUB_TITLES[\s\S]{0,120}gear\s*:\s*t\('장비'\)/.test(src));
T('★ 배를 등록해야 열린다 (NEED_BOAT_WRAP)', /'boat:gear'\s*:\s*\['gearWrap'/.test(src));
T('★ 탭을 옮기면 보이고 감춰진다', /show\('gearWrap',\s*t==='boat' && boatSubTab==='gear'\)/.test(src));
T('★★ 탭을 옮기면 실제로 그려진다 (이게 없으면 빈 화면)',
  /boatSubTab==='gear'\)\s*renderGear(Wrap)?\(\)/.test(src));
const RG = grab('renderGear'), AG = grab('addGear');
T('★ 그리는 곳이 있다 (renderGear)', !!RG);
T('★ 넣는 곳이 있다 (addGear)', !!AG);
if(AG){
  T('★★ 잠금 중에는 조용히 안 넣는다', /if\(!unlocked\)\s*return/.test(AG), AG.slice(0,120));
  T('★ 넣고 바로 그 장비를 연다', /openMR\('gear'/.test(AG), AG.slice(0,300));
}
if(RG){
  T('★ 없을 때 안내가 나온다 (빈 화면을 안 준다)', /emptybox/.test(RG));
  T('★★ 보기 전용에서도 「첫 장비」 버튼이 사라지지 않는다 (needEdit 로 안내)',
    /needEdit\(/.test(RG) && !/unlocked\s*\?/.test(RG.split('emptybox')[1]||'').valueOf(), RG.slice(0,400));
  T('★ 계통별로 묶는다', /GEAR_SYS/.test(RG));
  T('★ 계통 접기는 정비와 따로 기억한다 (한쪽을 접어도 다른 쪽이 안 접힌다)',
    /gearFold\(\)/.test(RG) && /bt_gfold_gear/.test(src));
  T('★ 매달린 정비·수리·부품 개수를 보여 준다', /gearCounts\(/.test(RG));
  T('★ 눌러서 연다', /openMR\('gear'/.test(RG));
}

// ── ⑦ 이름이 비어도 목록이 안 무너진다
const NM = grab('gearName'), LB = grab('gearLabel'), SO = grab('gearSysOf');
T('★ 이름 세우는 곳이 있다 (gearName)', !!NM);
if(NM && LB && SO){
  const F = new Function(`
    const GEAR_SYS = ${JSON.stringify(['선체·의장','추진','조타','연료','전기','항해장비','돛·삭구','갑판장비','계류·묘박','배관·위생','주거설비','안전장비'])};
    const t = x => x;
    ${NM} ${LB} ${SO}
    return { gearName, gearLabel, gearSysOf };
  `)();
  T('★★ 이름을 안 쓰면 종류가 대신 선다',
    F.gearLabel({ name:'', kind:'해수펌프', model:'' }) === '해수펌프');
  T('★★ 종류도 없으면 모델이 대신 선다',
    F.gearLabel({ name:'', kind:'', model:'4JH4E' }) === '4JH4E');
  T('★★ 셋 다 없어도 「(이름 없음)」 이지 빈칸이 아니다',
    F.gearLabel({ name:'', kind:'', model:'', maker:'' }) === '(이름 없음)');
  T('공백만 쓴 이름도 빈 것으로 본다', F.gearLabel({ name:'   ', kind:'윈치' }) === '윈치');
  T('★★ 계통을 안 고르면 「기타」 로 모인다', F.gearSysOf({ sys:'' }) === '기타');
  T('★★ 우리가 모르는 계통 이름도 「기타」 로 모인다 (자료가 사라지지 않는다)',
    F.gearSysOf({ sys:'우주선' }) === '기타');
  T('아는 계통은 그대로 둔다', F.gearSysOf({ sys:'추진' }) === '추진');
}

// ── ⑧ 정비·수리를 장비에 매단다
const PK = grab('gearPickRow');
T('★ 장비 고르는 칸이 있다 (gearPickRow)', !!PK);
if(PK){
  // ★ 4.85 에서 뒤집었다. 예전에는 장비가 없으면 이 칸을 숨겼는데,
  //   그래서 장비를 한 번도 안 넣은 배에서는 이 칸이 **영영** 안 보였다.
  //   사장님이 「수리에서 어떤 장비인지 고를 수 있게」 하라고 하셨을 때
  //   그 기능은 이미 있었는데 숨어 있었던 것이다. 이제 늘 보여 주고,
  //   장비가 없으면 그 자리에서 만들 수 있게 한다.
  T('★★ 장비가 없어도 칸을 보여 주고, 그 자리에서 장비를 만들 수 있다',
    /if\(!rows\.length\)/.test(PK) && /gearMakeFor\(/.test(PK), PK.slice(0,300));
  T('★ 보기 전용에서는 고른 장비 이름만 보여 준다', /unlocked/.test(PK) && /mrv/.test(PK));
  T('★ 고른 장비로 바로 건너갈 수 있다', /openMR\('gear'/.test(PK));
}
T('★★ 정기점검 창에 장비 칸이 붙어 있다', /\$\{gearPickRow\(it, 'maint'\)\}/.test(src));
T('★★ 수리 창에 장비 칸이 붙어 있다', /gearPickRow\(it, 'repair'\)/.test(src));

// ── ⑨ 장비 상세
const GB = grab('gearBody');
T('★ 장비 상세가 있다 (gearBody)', !!GB);
if(GB){
  ['이름','계통','종류','제조사','모델','일련번호','설치일','설명서'].forEach(k =>
    T('상세에 ' + k + ' 칸이 있다', GB.indexOf("t('" + k + "')") >= 0));
  T('★★ 종류는 계통에 맞는 것만 고르게 한다', /GEAR_KINDS\[sys\]/.test(GB));
  T('★ 제조사도 고르기다', /GEAR_MAKERS/.test(GB));
  T('★★ 이 장비의 정비·수리·부품이 한자리에 모인다',
    /gearMaint\(/.test(GB) && /gearRepair\(/.test(GB) && /gearParts\(/.test(GB));
  // 장비 쪽에서 지난 기록을 끌어당기는 문이 생기면서 빈 자리 글이 바뀌었다 —
  // 「…여기 모입니다」(기다리라는 말) → 「아직 연결된 기록이 없습니다. 아래에서 찾아 연결하실 수 있습니다.」(할 일을 알려 주는 말)
  T('★ 아무것도 안 매달렸을 때 왜 비었는지 말해 준다',
    /아직 연결된 기록이 없습니다\. 아래에서 찾아 연결하실 수 있습니다\./.test(GB));
}
T('★★ 상세 창이 실제로 이 몸을 쓴다', /if\(kind==='gear'\)\{\s*\n\s*body = gearBody\(it\);/.test(src));
T('★ 창 제목이 「장비」 다', /gear:t\('장비'\)/.test(src));
T('★ 사진을 붙일 수 있다', /hasPhotos = \(kind==='maint'\|\|kind==='gear'/.test(src));
T('★ 도면에 위치를 찍을 수 있다', /pinBtns = \(kind==='maint'\|\|kind==='gear'/.test(src));

const SS = grab('gearSetSys');
T('★ 계통을 바꾸는 곳이 따로 있다 (gearSetSys)', !!SS);
if(SS){
  T('★★ 계통을 바꾸면 안 맞는 종류는 비운다 (전기인데 임펠러가 남으면 못 찾는다)',
    /it\.kind = ''/.test(SS), SS.slice(0,400));
  T('★★ 사람이 직접 쓴 종류는 안 지운다 (우리 목록에 있던 것만 지운다)',
    /known/.test(SS), SS.slice(0,400));
}

// ── ⑩ 갈래가 따로 서 있는가 (여기가 어긋나면 화면이 안 바뀐다)
T('★★ 장비 갈래가 기록 찾기에 등록돼 있다', /gear:\(\)=>maint/.test(src));
T('★★ 장비를 고치면 장비 화면이 다시 그려진다 (정비 목록이 아니라)',
  /if\(kind==='gear'( \|\| kind==='review')?\)\s*renderGear(Wrap)?\(\)/.test(src));
T('★★ 휴지통에서 되살리면 제자리로 돌아간다',
  /e\.kind==='maint' \|\| e\.kind==='gear'/.test(src));
T('★ 휴지통 이름표에 장비가 있다', /gear:t\('장비'\)/.test(src));

// ── ⑪ 도면 — 장비와 정비가 같은 도면에 산다
T('★★ 도면 위 핀이 장비인지 정비인지 가른다 (pinKindOf)', !!grab('pinKindOf'));
T('★★ 장비 핀을 누르면 장비 창이 열린다 (정비 창이 아니라)',
  /pinTap\('\$\{ty\}'/.test(src));
// ★ 4.91 — 사장님 지적으로 그림이 계통마다 갈렸다. 못박힌 ⚙ 하나가 아니다.
T('★★ 장비 핀 그림을 정하는 곳이 있다', /function gearIcon\(/.test(src));
T('★★★ 계통마다 그림이 다르다', /const GEAR_ICON = \{/.test(src));
T('★★★ 고장 난 장비는 그림이 다르다', /if\(gearBroken\(g\)\) return/.test(src));
// ★ 4.85 에서 뒤집혔다 — 장비에 제 도면이 생겼다.
//   예전에는 장비 핀을 정비 도면에 얹어 두고 「장비 화면에는 도면이 없다」 고 적었는데,
//   사장님이 「장비에서 핀 지정을 눌렀는데 아무 상관없는 화면이 나온다」 고 지적하셨다.
//   이제 갈래마다 제 도면 화면이 있고, 그리로 데려가는 문은 pinGoMap 하나다.
T('★★ 갈래마다 제 도면 화면으로 데려가는 문이 하나다 (pinGoMap)', !!grab('pinGoMap'));
T('★★ 장비는 장비 통으로 간다 (정비로 안 튄다)',
  /setBoatSubTab\('gear'\)/.test(grab('pinGoMap') || ''), grab('pinGoMap'));
T('★★★ 「이미 거기 있다」 를 통 이름이 아니라 실제 화면으로 판단한다',
  /curScreen\(\) !== sub/.test(grab('pinGoMap') || ''));
T('★★ 핀 보기도 같은 문을 쓴다 (사본을 만들지 않는다)',
  /pinGoMap\(ty\)/.test(grab('pinShow') || ''));
T('★★ 장비 핀은 상태 색이 아니다 (장비에는 상태가 없다)',
  /if\(isGear\(i\)\) return/.test(grab('pinColor') || ''), grab('pinColor'));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
