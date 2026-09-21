// 나라별 정박지 꾸러미 (STEP 8)
//
// ★ 이 검사가 지키는 것
//   ① 자료가 아직 없어도 앱이 멀쩡하다 (없는 나라는 그냥 안 나올 뿐)
//   ② 한국에서만 타는 사람은 일본 자료를 안 받는다
//   ③ 한 번 받으면 인터넷이 끊겨도 보인다 (한국 것과 같아진다)
//   ④ 사람이 채운 것이 관 자료를 덮는다 — 순서가 뒤집히면 남의 손질이 사라진다
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

const PK_ALL = (src.match(/const SPOT_PACKS = \[[\s\S]*?\n\];/) || [''])[0];
// ★★★ 4.99 — 꾸러미가 둘이 됐다 (일본 + 한국 마리나).
//   여태 이 검사는 「꾸러미 = 일본」 이라고 믿고 통째로 봤다. 그러면 한국 꾸러미를
//   더한 것을 「일본 테두리가 깨졌다」 고 한다. 일본 몫만 떼어 본다.
const PK = (PK_ALL.match(/\{ k:'jp'[\s\S]*?\n  \}/) || [''])[0];
const SPOT_PACKS_FIX = { boxes:[[30.0,129.2,46.0,146.5],[24.0,122.0,30.0,131.5]] };
T('★ 나라별 꾸러미 목록이 있다', !!PK);
T('★ 일본 자리가 잡혀 있다', /k:'jp'/.test(PK) && /spots-jp\.json/.test(PK), PK);
T('★★ 테두리가 일본을 덮는다 (오키나와 24°N ~ 홋카이도 46°N)',
  /boxes:\[ \[30\.0, 129\.2, 46\.0, 146\.5\]/.test(PK) && /\[24\.0, 122\.0, 30\.0, 131\.5\]/.test(PK), PK);
T('★★★ 네모를 둘로 쪼갰다 (하나로는 부산이 일본 안에 들어간다)',
  (PK.match(/\[\d+\.\d+, \d+\.\d+, \d+\.\d+, \d+\.\d+\]/g)||[]).length === 2, PK);
T('★ 말이 일본어면 어디에 있든 받는다', /lang:'ja'/.test(PK));
T('★★ 출처를 화면에 적을 자리가 있다 (남의 자료를 쓰면 밝혀야 한다)', /from:/.test(PK));

// ── 테두리
const IN = grab('spotPackIn'), FOR = grab('spotPacksFor');
if(IN && FOR){
  const F = new Function(`${PK_ALL} const langNow = () => 'ko'; ${IN} ${FOR}
    return { spotPackIn, spotPacksFor };`)();
  const jp = SPOT_PACKS_FIX;
  T('★★ 도쿄만은 일본이다', F.spotPackIn(jp, 35.45, 139.75));
  T('★★ 오키나와도 일본이다', F.spotPackIn(jp, 26.2, 127.7));
  // ★ 4.99 — 이제 한국 꾸러미도 있다. 「몇 개냐」 가 아니라 「일본 것이 끼었느냐」 로 본다.
  const jp있나 = (...a3) => F.spotPacksFor(...a3).some(pk => pk.k === 'jp');
  T('★★★ 여수에서 일본 꾸러미를 안 받는다',
    jp있나(34.74, 127.73) === false, F.spotPacksFor(34.74, 127.73).map(x=>x.k));
  T('★ 부산도 아니다', jp있나(35.10, 129.04) === false);
  T('★ 쓰시마(129.3°E)는 받는다', jp있나(34.4, 129.3) === true);
  T('★★ 말이 일본어면 자리를 몰라도 받는다', jp있나(34.74, 127.73, 'ja') === true);
  T('자리를 모르면(한국어) 일본 것을 안 받는다',
    jp있나(null, null) === false && jp있나(undefined, 130) === false);
  T('숫자가 아닌 것이 와도 안 터진다', jp있나(NaN, NaN) === false);
  // ★★★ 한국 꾸러미는 반대로 — 한국 사람이 늘 받아야 한다 (원형·이순신 마리나가 여기 있다)
  const kr있나 = (...a3) => F.spotPacksFor(...a3).some(pk => pk.k === 'kr');
  T('★★★ 한국말을 쓰면 어디에 있든 한국 마리나를 받는다', kr있나(34.74, 127.73) === true);
  T('★★★ 여수 앞바다도 한국 테두리 안이다', kr있나(34.74, 127.73, 'ja') === true);
  T('★★ 도쿄에서 일본말을 쓰면 한국 것은 안 받는다', kr있나(35.45, 139.75, 'ja') === false);
}

// ── 없어도 안 터진다
const GET = grab('spotPackGet');
T('★ 받아 오는 곳이 있다 (spotPackGet)', !!GET);
T('★★★ 파일이 없으면(404) 조용히 넘어간다', /if\(!r\.ok\) return;/.test(GET||''), (GET||'').slice(0,400));
T('★★ 모양이 안 맞으면 안 담는다', /!Array\.isArray\(j\.rows\)\) return/.test(GET||''));
T('★★ 앱을 켤 때 한 번만 받는다', /spotPackTried\[pk\.k\]/.test(GET||''));
// ★★★ 5.00 — 기기에 남겨 둔 것이 있다고 **받아오기를 건너뛰면 안 된다.**
//   그러면 한 번 받아 본 기기는 그 뒤로 새 자료를 영영 못 받는다.
//   사장님이 「앱에는 일본 정박지가 브라우저보다 적게 나온다」 고 하신 것이 이것이었다.
T('★★★ 남겨 둔 것이 있어도 새로 받아 본다 (안 그러면 자료가 영영 안 바뀐다)',
  !/if\(!pk \|\| spotPackRows\[pk\.k\]/.test(GET||''), (GET||'').slice(0,400));
T('★★★ 받으면 갈아 끼운다', /spotPackRows\[pk\.k\] = j\.rows/.test(GET||''), (GET||'').slice(0,600));
T('★★ 갈아 끼우면 화면을 다시 그린다', /renderSpots\(\)/.test(GET||''), (GET||'').slice(0,600));
T('★★ 못 받으면 남겨 둔 것을 그대로 쓴다 (바다에서 인터넷이 없다)',
  /catch\(_\)\{\s*\}/.test(GET||'') || /catch\(_\)\{\}/.test(GET||''), (GET||'').slice(-200));
T('★★★ 기기에 남겨 둔다 (배 위에서 인터넷이 끊겨도 보인다)',
  /localStorage\.setItem\(SPOT_PACK_KEY/.test(GET||''));
T('★ 담아 둔 것을 다시 꺼낸다', /localStorage\.getItem\(SPOT_PACK_KEY/.test(grab('spotPackLoadLocal')||''));
T('★★ 받아 오면 화면을 다시 그린다 (안 그러면 빈 화면인 채로 있다)',
  /curScreen\(\) === 'spots'\) renderSpots\(\)/.test(GET||''));
T('★ 정박지 화면을 열 때 부른다', /spotPackSync\(\)/.test(grab('renderSpots')||''));

// ══════════════════════════════════════════════════════════════
// 정박지 자료는 늘 받는다 · 물때는 갈 때만 받는다 (4.80)
//
// ★ 사장님 지적: 여수에 계신데 일본 정박지가 영영 안 보였다. 나라 띠도 안 떴다.
//   「일본에 있거나 일본어를 쓸 때만 받는다」 는 문을 내가 걸어 놨기 때문이다.
//   여수에 있어도 일본 갈 계획은 세운다 — 오히려 가기 전에 봐야 하는 자료다.
//   spots-jp.json 은 20KB 라 아낄 것도 없었다.
{
  const f = grab('spotPackSync') || '';
  T('★★★ 정박지 자료는 자리를 안 따지고 늘 받는다',
    /SPOT_PACKS\.forEach\(pk => \{ spotPackGet\(pk\); \}\)/.test(f)
    && !/spotPacksFor/.test(f), f);
  T('★★ 기기에 남은 것부터 꺼낸다 (인터넷 없어도 보인다)', /spotPackLoadLocal\(\)/.test(f));
}
// ★ 물때는 다르다. tide-jp.json 은 325KB 고, 거기 갔을 때 보는 것이다.
//   이 문까지 열면 안 갈 사람이 325KB 를 받는다.
{
  const f = grab('tidePackSync') || '';
  T('★★★ 물때는 갈 때만 받는다 (325KB — 문을 열면 안 된다)',
    /spotPacksFor\(p && p\.lat, p && p\.lon\)/.test(f), f);
}
T('★★ 기다리지 않는다 (우리나라 자료는 이미 있으니 화면은 바로 떠야 한다)',
  !/await spotPackSync/.test(src), (src.match(/await spotPackSync[^\n]*/)||[''])[0]);

// ── 겹칠 때 누가 이기나
const ALL = grab('spotsAll');
T('★ 모으는 곳이 하나다 (spotsAll)', !!ALL);
if(ALL){
  // ★ 4.99 — spotsAll 이 이름·거리로 겹치는 꾸러미 줄을 하나 더 걸러낸다.
  //   그 문(spotSameAs)까지 같이 넣어야 여기서 돌려 볼 수 있다.
  const SAME = grab('spotSameAs');
  const 반경 = (src.match(/const SPOT_SAME_M = \d+;/) || [''])[0];
  const KEY  = (src.match(/const spotNameKey = [^;]+;/) || [''])[0];
  T('★★★ 겹침을 가리는 문이 있다', !!SAME && !!반경 && !!KEY);
  const F = new Function(`
    let spotList = [], SPOT_SEED = [], PACK = [];
    const seedSpotRow = x => ({ id:x.i, name:x.n, seed:true });
    const spotPackAll = () => PACK;
    const hav = () => 9999;                 // 자리는 다 멀다고 본다 — 여기서는 이름만 본다
    ${반경} ${KEY} ${SAME}
    ${ALL}
    return { set:(a,b,c)=>{ spotList=a; SPOT_SEED=b; PACK=c; }, spotsAll };`)();
  F.set([{ id:'gov_f1', name:'내가 채운 다대포항' }],
        [{ i:'gov_f1', n:'다대포항' }, { i:'gov_f2', n:'천성항' }],
        [{ id:'jp_1', name:'横浜' }, { id:'gov_f2', name:'겹치는 것' }]);
  const r = F.spotsAll();
  T('★★★ 사람이 채운 것이 관 자료를 덮는다',
    r.filter(x=>x.id==='gov_f1').length === 1 && r.find(x=>x.id==='gov_f1').name === '내가 채운 다대포항',
    r.filter(x=>x.id==='gov_f1'));
  T('★★★ 나라 자료가 관 자료를 못 덮는다 (id 가 겹치면 관 자료가 이긴다)',
    r.filter(x=>x.id==='gov_f2').length === 1 && r.find(x=>x.id==='gov_f2').name === '천성항',
    r.filter(x=>x.id==='gov_f2'));
  T('★★ 안 겹치는 나라 자료는 그대로 실린다', r.some(x=>x.id==='jp_1'));
  T('★ 전부 셋이다 (겹친 것이 늘지 않았다)', r.length === 3, r.map(x=>x.id));
  // ★★★ 4.99 — id 가 달라도 이름이 같으면 뺀다 (지도 자료는 gov_ 가 아니라 osm_ 이다)
  F.set([], [{ i:'gov_m6', n:'여수엑스포 마리나' }],
            [{ id:'osm_node1', name:'여수엑스포마리나' }, { id:'osm_node2', name:'원형 마리나' }]);
  const r2 = F.spotsAll();
  T('★★★ 이름이 같으면 지도 자료를 안 싣는다 (관 자료가 이긴다)',
    !r2.some(x=>x.id==='osm_node1'), r2.map(x=>x.id));
  T('★★★ 앱에 없던 마리나는 실린다 (원형 마리나가 여기로 들어온다)',
    r2.some(x=>x.id==='osm_node2'), r2.map(x=>x.id));
}
T('★ 나라 자료도 관 자료와 같은 모양으로 바꾼다', /seedSpotRow\(x\)/.test(grab('spotPackAll')||''));
T('★★ 출처를 그 줄에 적어 둔다', /row\.byName = pk\.from \|\| pk\.name/.test(grab('spotPackAll')||''));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
