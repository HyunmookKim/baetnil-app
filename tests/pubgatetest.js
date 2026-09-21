// 「켰는데 왜 안 나오냐」 — 조용한 실패 막기 (4.68)
//
// ★ 왜 (2026-08-29, 사장님 백업으로 확인)
//   사장님이 정비수첩을 쓰고 그 기록의 공개를 켜셨다. 그런데 남의 배에는 안 나왔다.
//   까닭은 스위치가 둘이기 때문이다 —
//     ① 기록 하나하나의 공개  (사장님이 켠 것)
//     ② 배 전체의 「정비 기록」 공개  (꺼져 있었다)
//   백업의 배 설정은 pub:{port,spec,intro,phone,board,voyage} 였다. maint 도 review 도 없다.
//   그런데 앱은 아무 말도 안 했다. **조용한 실패**다 — 이 앱에서 가장 크게 혼난 흠이다.
//
// ★ 이 검사가 지키는 것
//   ① 배 쪽이 꺼져 있으면 화면이 그렇다고 말한다
//   ② 말만 하고 끝내지 않는다 — 그 자리에서 켤 수 있다 (설정을 찾아가라 하면 아무도 안 간다)
//   ③ 켜져 있을 때는 아무 말도 안 한다 (쓸데없는 경고는 진짜 경고를 가린다)
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };

const BOX = grab('pubGateBox'), ON = grab('pubGateOn');
T('★★ 말해 주는 문이 있다 (pubGateBox)', !!BOX);
T('★★ 그 자리에서 켜는 문이 있다 (pubGateOn)', !!ON);
// ★ 4.70 — 켜는 일은 setPubUI 한 문에서만 한다. 저장·클라우드·권한이 전부 거기 있다.
//   여기서 setPub 을 직접 부르면 그 셋을 빠뜨린다 (실제로 빠뜨렸다).
T('★★★ 켜는 문이 setPubUI 하나를 지난다', !!ON && /setPubUI\s*\(/.test(ON), ON);

if(BOX){
  const F = (pub) => new Function('B','PUB_KEYS','unlocked', `
    const curBoat = () => B;
    function pubOn(b,k){ return !!((b && b.pub) || {})[k]; }
    const t = s => s;
    const esc = s => String(s);
    const jsq = s => String(s);
    const tsub = (s,o) => String(s).replace(/\\{(\\w+)\\}/g, (m,k)=> (o && o[k] != null) ? o[k] : m);
    ${BOX}
    return pubGateBox;`)({ pub: pub }, [
      { k:'maint', name:'정비 기록 · 정비수첩' },
      { k:'review', name:'제품 리뷰 · 배 리뷰' }
    ], true);

  // 사장님 백업 그대로 — maint 도 review 도 없다
  const 사장님 = { port:true, spec:true, intro:true, phone:true, board:true, voyage:true };
  const off = F(사장님)('maint');
  T('★★★ 배 쪽이 꺼져 있으면 말해 준다', /꺼져 있어 아직 안 올라갑니다/.test(off), off.slice(0,140));
  T('★★★ 그 자리에 켜는 단추가 있다', /pubGateOn\('maint'\)/.test(off), off.slice(0,240));
  T('★★ 어느 스위치인지 이름을 대 준다', /정비 기록/.test(off), off.slice(0,140));
  const rv = F(사장님)('review');
  T('★★★ 리뷰도 똑같이 말해 준다', /꺼져 있어/.test(rv) && /pubGateOn\('review'\)/.test(rv), rv.slice(0,200));

  // 켜져 있으면 조용해야 한다 — 쓸데없는 경고는 진짜 경고를 가린다
  T('★★ 켜져 있으면 아무 말도 안 한다', F({ maint:true })('maint') === '', F({ maint:true })('maint'));
  // 배가 없으면 (아직 등록 안 함) 겁주지 않는다
  const NB = new Function('BOX', `
    const curBoat = () => null; const unlocked = true; const PUB_KEYS = [];
    function pubOn(){ return false; }
    const t=s=>s, esc=s=>String(s), jsq=s=>String(s), tsub=s=>s;
    ${BOX}
    return pubGateBox('maint');`)();
  T('★ 배가 없으면 아무 말도 안 한다', NB === '', NB);
}

// ── 실제로 화면에 붙어 있나. 함수만 있고 안 부르면 아무 소용이 없다.
{
  // ★ 4.70 — 공개 줄이 정비 절차 맨 아래에서 화면 맨 위(howPubRow)로 올라갔다.
  const HP = grab('howPubRow') || '';
  T('★★★ 정비수첩 공개 줄이 있다 (howPubRow)', !!HP);
  // ★ 4.72 — 공개 줄은 셋이 같은 문(pubLvRow)을 쓴다. 관문은 그 안에 있다.
  T('★★★ 정비수첩 화면에서 부른다', /pubLvRow\('mlog', it, 'maint'/.test(HP), HP.slice(-400));
  const PLR = grab('pubLvRow') || '';
  T('★ 켠 것만 말해 준다 (안 켠 기록에까지 경고를 띄우지 않는다)',
    /k !== 'none' && !bOn \? pubGateBox\(gateKey\)/.test(PLR), PLR.slice(-500));
  T('★★ 배 쪽이 꺼져 있어도 단계는 고를 수 있다 (줄이 통째로 사라지지 않는다)',
    /PUB_LEVELS\.map/.test(PLR) && !/if\(.*!pubOn.*\) return pubGateBox/.test(PLR), PLR.slice(0,400));
  // ★★ 게시물 설정은 위에 모인다 — 항해일지·정비수첩이 같은 자리를 쓴다 (사장님 지적)
  const MB = grab('mlogBody') || '';
  T('★★★ 공개 줄이 화면 위쪽에 있다 (정비 절차 맨 아래가 아니다)',
    /howPubRow\(it\)/.test(MB) && MB.indexOf('howPubRow') < MB.indexOf('howBlock'), MB.slice(0,300));
  T('★★ 옛 자리(정비 절차 맨 아래)에는 안 남아 있다',
    !/howPubToggle/.test(grab('howBlock') || ''));
  const RB = grab('rvBody') || '';
  T('★★★ 사용기 화면에서 부른다', /pubLvRow\('review', it, 'review'/.test(RB), RB.slice(-300));
}

// ── 밖으로 내보내는 곳이 배 쪽 스위치를 실제로 본다 (여기가 진짜 관문이다)
{
  const BP = grab('buildPublic') || '';
  T('★★ 정비수첩은 배 쪽 「정비」 스위치를 지나야 나간다',
    /pubOn\(b,'maint'\)/.test(BP) && /o\.mlog\s*=/.test(BP));
  T('★★ 리뷰는 배 쪽 「리뷰」 스위치를 지나야 나간다',
    /pubOn\(b,'review'\)/.test(BP) && /o\.review\s*=/.test(BP));
}

// ── 4.70 — 켜는 문이 진짜로 저장·업로드까지 하는가
//
// ★ 처음에 내가 setPub 만 부르고 끝냈다. 화면에서는 켜진 것처럼 보이는데
//   기기에 저장도, 클라우드로 올리지도 않아서 **아무 일도 안 일어난다.**
//   사장님이 「여전히 정비수첩에 아무것도 안 올라온다」 고 하셨다.
{
  const ON = grab('pubGateOn') || '';
  T('★★★ 켜는 문이 setPubUI 를 지난다 (저장·클라우드·권한이 다 거기 있다)',
    /setPubUI\s*\(/.test(ON), ON);
  T('★★★ setPub 만 부르고 끝내지 않는다', !/(^|[^U])setPub\s*\(/.test(ON.replace(/setPubUI\s*\(/g,'setPubUI(')), ON);
  const UI = grab('setPubUI') || '';
  T('★★ setPubUI 가 기기에 저장한다', /saveLocal\s*\(/.test(UI));
  T('★★ setPubUI 가 배를 클라우드에 올린다', /saveBoatCloud\s*\(/.test(UI));
  T('★★★ setPubUI 가 공개본을 밀어올린다 (이게 남의 배에 실리는 길이다)',
    /pushPublic\s*\(/.test(UI));
  T('★ 기록을 열어 둔 채로 켜면 그 자리에 있는다', /back === 'stay'/.test(UI), UI.slice(-300));
}

// ── 4.70 — 어느 항해가 올라가는지 한눈에 보이는가 (사장님 지적)
{
  const V = src.slice(src.indexOf("const row = v =>", src.indexOf('function renderVoyage')));
  const row = V.slice(0, 900);
  // ★ 4.70 — 3단계가 되면서 딱지도 셋이다: 공개 · 내 배에서만 · 나만
  // ★ 4.72 — 딱지 말을 따로 적지 않는다. 표에서 가져온다 — 따로 적으면 목록과 기록이 어긋난다.
  T('★★★ 항해 목록이 세 단계를 다 딱지로 단다',
    /pubLvOne\(k\)\.name/.test(row), row.slice(0,500));
  T('★★ 딱지 말을 손으로 따로 적지 않는다',
    !/t\('내 배에서만'\)/.test(row) && !/t\('나만'\)/.test(row), row.slice(0,500));
  T('★★ 딱지를 단계에서 가져온다 (두 곳에서 재지 않는다)', /voyLv\(v\)/.test(row), row.slice(0,500));
  // 한쪽만 달면 「딱지 없는 줄」 이 공개인지 안 정한 것인지 알 수 없다
  T('★★ 배 쪽 항해일지가 꺼져 있으면 딱지를 안 단다 (어차피 아무것도 안 나간다)',
    /pubOn\(curBoat\(\),'voyage'\)/.test(row), row.slice(0,400));

  const seg = grab('pubLvRow') || '';
  // ★ 4.70 — 사장님이 정하신 3단계. 두 단추를 나란히 두지 않고 고르기 하나로 둔다.
  T('★★★ 기록 안에서 3단계를 고르게 한다',
    /PUB_LEVELS\.map/.test(seg) && /pubLvSet\(/.test(seg), seg.slice(0,600));
  T('★★ 고른 단계가 무슨 뜻인지 한 줄로 적어 준다', /one\.sub/.test(seg), seg.slice(0,700));
  T('★★ 배 쪽이 꺼져 있으면 줄이 사라지지 않고 까닭을 말한다',
    /pubGateBox\(gateKey\)/.test(seg) && /PUB_LEVELS\.map/.test(seg), seg.slice(-400));
  T('★★ 항해일지도 같은 문을 쓴다', /pubLvRow\('voyage', it, 'voyage'\)/.test(src));
}

// ── 4.70 — 3단계가 실제로 갈라지는가 (사장님이 정하신 것)
{
  const L = (src.match(/const PUB_LEVELS = \[[\s\S]*?\n\];/) || [''])[0];
  T('★★★ 단계가 셋이다', (L.match(/\bk:'/g) || []).length === 3, L.slice(0,200));
  ['com','boat','none'].forEach(k=>T('★★ ' + k + ' 단계가 있다', L.indexOf("k:'" + k + "'") >= 0));
  const F = grab('pubLvOf') + '\n' + grab('voyLv');
  T('★★★ 옛 항해는 지금 보이던 대로 그대로 보인다 (pub===false 면 비공개, 아니면 공개)',
    /pub === false/.test(F) && /'none'/.test(F) && /'com'/.test(F), F);
  const fn = new Function('PUB_LEVELS', F + '\nreturn voyLv;')(
    [{k:'com'},{k:'boat'},{k:'none'}]);
  T('★★ 옛 자료 — 공개였던 것', fn({}) === 'com');
  T('★★ 옛 자료 — 감췄던 것', fn({pub:false}) === 'none');
  T('★★ 새 자료 — 고른 단계를 따른다', fn({pubLv:'boat'}) === 'boat');
  T('★ 모르는 값이 들어와도 안 깨진다', fn({pubLv:'zzz'}) === 'com');

  // ★★★ 밖으로 내보낼 때 「나만」 만 빠지고, 단계가 함께 나간다
  const BP = grab('buildPublic') || '';
  T('★★★ 「나만」 은 밖으로 안 나간다', /voyLv\(v\) !== 'none'/.test(BP), BP.slice(BP.indexOf('o.voyage'), BP.indexOf('o.voyage')+400));
  T('★★★ 단계를 함께 내보낸다 (목록에 실을지 밖에서 가른다)', /lv: voyLv\(v\)/.test(BP));
  // 남의 배 목록은 커뮤니티 단계만
  const EX = grab('expRows') || '';
  T('★★★ 남의 배 목록에는 커뮤니티 단계만 실린다',
    /\(o\.r\.lv \|\| 'com'\) === 'com'/.test(EX), EX.slice(0,400));
}

// ★★★ A16 — 「조용한 실패를 막는 문」 이 정작 조용히 죽지 않는가
//   여기서 터지면 「왜 안 올라가는지」 안내가 통째로 사라진다.
//   화면은 그대로 두되(빈 글자), 오류는 반드시 남겨야 한다.
T('★★★ pubGateBox 가 터지면 조용히 넘기지 않는다', /catch\s*\(\s*e\s*\)/.test(BOX) && /showErr\(/.test(BOX), BOX.slice(-400));
T('★ 그래도 화면은 안 깨진다 (빈 글자를 돌려준다)', /return '';/.test(BOX));
T('★ 어느 칸에서 터졌는지 적는다', /pubGateBox\('/.test(BOX) || /'pubGateBox\('/.test(BOX));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
