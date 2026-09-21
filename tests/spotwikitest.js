// 4.99 — 정박지: 지도가 마리나라고 부르는 곳을 다 싣되, 확인 안 된 것은 밝힌다
//        자리(핀)는 아무나 못 옮긴다 · 책임 범위를 분명히 적는다
//
// ★ 사장님 지적 (2026-09-01)
//   ① "일본 거는 겨우 세 개 들어 있네"
//   ② "여수에 원형 마리나도 있고 이순신 마리나도 있는데 왜 이런 곳들은 전혀 없냐"
//   ③ "지도 어플 같은 데 마리나라고 쳐 가지고 진짜 마리나와 가짜 마리나들 구분한 다음에
//      또 넣을 수는 없나? 그런 것까지는 나중에 유저들이 알아서 쓰도록 해야 되나"
//   ④ "이런 부분들은 싹 다 우리가 책임을 안 지는 방향으로. 이거 항해 어플 아니라고,
//      정확하게 확인하고 가라고 그런 안내문 써 주고, 좌표는 확인 뒤에 옮기는 방식으로.
//      그거는 글 쓰는 사람하고 운영자만 바꿀 수 있도록"
//
// ★ ①②가 왜 났나 — 그물이 거꾸로였다. 손으로 적은 35곳을 들고 OSM 에 「이 이름 있냐」고
//   물었다. 그래서 마리나 13곳 중 3곳만 좌표를 얻었다. 이제 「마리나인 곳을 다 내놔라」로
//   뒤집는다. 대신 확인 안 된 것에는 딱지를 붙인다 — 내가 가르면 그것이 짐작이다.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,260):'')); } };
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) i = s.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}

// ══ 1. 한국 마리나 꾸러미가 있다 ═══════════════════════════════════
{
  const blk = /const SPOT_PACKS = \[[\s\S]*?\n\];/.exec(src);
  T('꾸러미 목록이 있다', !!blk);
  const b = blk ? blk[0] : '';
  T('★★★ 한국 꾸러미가 있다 (원형·이순신 마리나가 여기로 들어온다)',
    /k:'kr'[\s\S]{0,200}file:'spots-kr\.json'/.test(b), b);
  T('★★ 일본 꾸러미는 그대로 있다', /k:'jp'[\s\S]{0,200}file:'spots-jp\.json'/.test(b), b);
  T('★★★ 한국 꾸러미는 물때를 안 받는다 (tide.json 에 이미 다 있다)',
    /k:'kr'[\s\S]{0,220}tide:''/.test(b), b);
  // 물때 받는 곳이 빈 이름에 안 걸려 넘어지는가
  T('★★★ 물때 없는 꾸러미를 물때 쪽이 건너뛴다', /if\(!pk\.tide \|\| tidePackSpots/.test(src));
  T('★★★ 물때 받아 오는 곳도 건너뛴다', /if\(!pk \|\| !pk\.tide \|\| tidePackTried/.test(src));
  T('★★ 한국 테두리가 한반도를 덮는다',
    /k:'kr'[\s\S]{0,320}boxes:\[ \[33\.0, 124\.5, 38\.7, 131\.2\] \]/.test(b), b);
}

// ══ 2. 「확인 안 됨」 을 가리는 문이 하나다 ═════════════════════════
{
  T('가리는 문이 있다', !!grab(src, 'spotUnsure'));
  T('문이 하나다', (src.match(/function spotUnsure\(/g) || []).length === 1);
  const F = new Function('return ' + grab(src, 'spotUnsure'))();
  T('★★★ 관 자료가 확인됐다고 온 것은 딱지가 없다', F({ seed:true, ok:true }) === false);
  T('★★★ 지도만 마리나라고 부르는 곳은 딱지가 붙는다', F({ seed:true, ok:false }) === true);
  T('★★★ 사람이 채운 곳은 딱지가 없다 (문서가 생기면 seed 가 아니다)',
    F({ seed:false, ok:false }) === false);
  T('★★ 없는 것에는 안 붙는다', F(null) === false);

  // seedSpotRow 가 v 를 읽는가 — 값이 없으면 「확인됨」 (앱 안의 152곳)
  const sr = grab(src, 'seedSpotRow');
  T('★★★ v 를 읽어 ok 로 삼는다', /ok: \(x\.v === undefined \|\| x\.v === null\) \? true : \(x\.v === 1\)/.test(sr), sr);
  const mk = new Function(`
    const SPOT_SEED_FROM = 'X';
    ${sr}
    return seedSpotRow;`)();
  T('★★★ 앱 안의 152곳(v 없음)은 확인된 것이다', mk({ i:'gov_m1', n:'가', k:'marina' }).ok === true);
  T('★★★ 지도에서 온 것(v:0)은 확인 안 된 것이다', mk({ i:'osm_1', n:'나', k:'marina', v:0 }).ok === false);
  T('★★★ 관이 낸 것(v:1)은 확인된 것이다', mk({ i:'jp_1', n:'다', k:'port', v:1 }).ok === true);
  T('★★ 나라를 c 로도 받는다', mk({ i:'osm_2', n:'라', c:'jp', v:0 }).cc === 'jp');
}

// ══ 3. 목록·상세에 딱지가 뜬다 ════════════════════════════════════
{
  T('★★★ 목록 줄에 「확인 안 됨」 딱지가 뜬다',
    /spotUnsure\(s\)\?`<span class="chip notice">\$\{esc\(t\('확인 안 됨'\)\)\}/.test(src));
  const op = grab(src, 'openSpot') || '';
  T('★★★ 상세 화면에 왜 확인 안 됐는지 적는다',
    /아직 확인되지 않은 곳입니다\./.test(op) && /지도 자료에 「마리나」로 적혀 있어 실었습니다/.test(op), op.slice(0,200));
  T('★★★ 딱지가 언제 없어지는지 적는다',
    /다녀오신 분이 내용을 채워 주시면 이 표시가 없어집니다\./.test(op));
  T('★★ 눈에 띄는 띠로 낸다 (잔글씨로 숨기지 않는다)',
    /spotUnsure\(s\) \? `<div class="hwarn">/.test(op), op.slice(op.indexOf('spotUnsure'), op.indexOf('spotUnsure')+90));
}

// ══ 4. 책임 범위 — 항해용 앱이 아니라고 분명히 적는다 ══════════════
{
  const d = grab(src, 'spotDisclaimer');
  T('안내문 문이 있다', !!d);
  T('문이 하나다', (src.match(/function spotDisclaimer\(/g) || []).length === 1);
  T('★★★ 「항해용 앱이 아니다」 라고 적는다', /뱃일은 항해용 앱이 아닙니다\./.test(d), d);
  T('★★★ 「틀릴 수 있다」 라고 적는다', /틀릴 수 있습니다/.test(d), d);
  T('★★★ 「공식 해도와 시설에 확인하라」 라고 적는다', /공식 해도와 해당 시설에 확인하고 하십시오/.test(d), d);
  T('★★★ 눈에 띄는 띠다 (맨 아래 잔글씨가 아니다)', /class="hwarn"/.test(d), d);
  T('★★★ 정박지 상세가 이 문을 쓴다', /\$\{spotDisclaimer\(\)\}/.test(grab(src, 'openSpot') || ''));
  T('★★ 옛 잔글씨 안내문은 없앴다 (두 군데서 다르게 적지 않는다)',
    !/실제 항해에는 공식 해도와 VTS 확인이 먼저입니다/.test(grab(src, 'openSpot') || ''));
  // ★ 글자를 변수에 담아 t() 에 넘기면 「지어낸 말 잡기」 검사가 못 본다
  T('★★★ 안내문을 t() 에 글자 그대로 넘긴다 (검사에 잡히는 자리로 둔다)',
    !/t\(SPOT_DISCLAIM/.test(src), d);
}

// ══ 5. 자리(핀)는 아무나 못 옮긴다 ═════════════════════════════════
{
  const cm = grab(src, 'canMoveSpot');
  T('옮길 수 있는지 가리는 문이 있다', !!cm);
  T('문이 하나다', (src.match(/function canMoveSpot\(/g) || []).length === 1);
  const F = uid => new Function('S', `
    const isAdmin = k => S.admin;
    const meUid = () => S.me;
    ${cm}
    return canMoveSpot;`)(uid);
  const 남 = F({ admin:false, me:'u1' });
  T('★★★ 새로 올리는 것은 올리는 사람이 찍는다', 남(null) === true);
  T('★★★ 관 자료는 운영자만 옮긴다 (남이 못 옮긴다)', 남({ seed:true }) === false);
  T('★★★ 내가 올린 것은 내가 옮긴다', 남({ by:'u1' }) === true);
  T('★★★ 남이 올린 것은 못 옮긴다', 남({ by:'u2' }) === false);
  const 운 = F({ admin:true, me:'u9' });
  T('★★★ 운영자는 관 자료도 옮긴다', 운({ seed:true }) === true);
  T('★★ 운영자는 남의 것도 옮긴다', 운({ by:'u2' }) === true);
  const 손 = F({ admin:false, me:null });
  T('★★★ 로그인 안 한 사람은 남의 것을 못 옮긴다 (by 가 빈 값이어도)',
    손({ by:'' }) === false, '빈 by 와 빈 uid 가 같다고 새면 안 된다');

  // 화면이 거짓말하지 않는가 — 못 옮기면 위치 찍기를 아예 안 내민다
  const ws = grab(src, 'writeSpot');
  T('★★★ 못 옮기면 위치 찍기를 건너뛴다', /if\(!canMoveSpot\(s\)[^\n]*\) spotForm\(\);/.test(ws), ws);
  // ★★★ 4.139 — 자리를 **이미 아는 곳**도 위치 찍기를 건너뛴다.
  //   「내용 채우기」 를 눌렀는데 지도가 떠서 맞는 자리를 또 찍으라고 했다 (사장님 지적).
  T('★★★ 자리를 이미 아는 곳도 건너뛴다',
    /const 자리있음 = !!\(s && s\.lat != null && s\.lon != null\);/.test(ws)
    && /\|\| 자리있음\) spotForm\(\);/.test(ws), ws);
  T('★★ 자리를 모르는 새 곳만 자리부터 찍는다', /else spotPickPlace\(\);/.test(ws), ws);
  const sf = grab(src, 'spotForm') || '';
  T('★★★ 못 옮기면 「← 위치」 단추가 없다', /\$\{옮김 \? `<button class="tab" onclick="spotPickPlace\(\)"/.test(sf), sf.slice(0,400));
  T('★★★ 왜 못 옮기는지 적어 준다', /위치\(핀\)는 운영자만 옮깁니다/.test(sf));
  T('★★ 자리 단추를 없앤 자리에 「취소」 가 남는다 (빠져나갈 길이 있다)',
    /onclick="backToSpots\(\)">\$\{esc\(t\('취소'\)\)\}/.test(sf), sf.slice(0,500));

  // ★ 화면에서 감추는 것만으로는 모자라다 — 나가는 값에서 한 번 더 못 박는가
  const sv = grab(src, 'spotSave') || '';
  T('★★★ 못 옮기는 사람이면 원래 자리를 그대로 내보낸다',
    /!canMoveSpot\(옛\)[\s\S]{0,120}\{ lat: 옛\.lat, lon: 옛\.lon \}/.test(sv), sv.slice(0,900));
  T('★★★ 내보내는 줄이 그 값을 쓴다', /lat: 자리\.lat, lon: 자리\.lon/.test(sv), sv);
  T('★★ 지역도 그 값으로 셈한다', /regionOfPoint\(자리\.lat, 자리\.lon\)/.test(sv), sv);
}

// ══ 6. 관 자료 위에 덧댄 것은 「지우기」 가 아니라 「되돌리기」 다 ═════
{
  const os = grab(src, 'spotOverSeed');
  T('덧댐인지 가리는 문이 있다', !!os);
  T('문이 하나다', (src.match(/function spotOverSeed\(/g) || []).length === 1);
  const F = st => new Function('S', `
    const SPOT_SEED = S.seed;
    const SPOT_PACKS = S.packs;
    const spotPackRows = S.rows;
    ${os}
    return spotOverSeed;`)(st);
  const st = { seed:[{i:'gov_m6'}], packs:[{k:'jp'}], rows:{ jp:[{i:'jp_香川_0'}] } };
  const f = F(st);
  T('★★★ 앱 안의 관 자료 위에 덧댄 것을 안다', f({ id:'gov_m6', seed:false }) === true);
  T('★★★ 꾸러미 자료 위에 덧댄 것도 안다', f({ id:'jp_香川_0', seed:false }) === true);
  T('★★★ 사람이 새로 올린 것은 덧댐이 아니다', f({ id:'sp123', seed:false }) === false);
  T('★★ 아직 안 채운 관 자료 자체는 덧댐이 아니다', f({ id:'gov_m6', seed:true }) === false);

  const op = grab(src, 'openSpot') || '';
  // ★ 5.0 — 「관 자료」 를 「공공 자료」 로 고쳤고, 신고·지우기가 [⋯] 차림표(actSet) 안으로 들어갔다.
  T('★★★ 덧댐이면 단추에 「공공 자료로 되돌리기」 라고 적는다',
    /spotOverSeed\(s\) \? '공공 자료로 되돌리기' : '삭제'/.test(op), op.slice(op.indexOf('spotOverSeed')-90, op.indexOf('spotOverSeed')+120));
  const ds = grab(src, 'delSpot') || '';
  T('★★★ 묻는 말도 되돌리기로 적는다 (한쪽만 바꾸면 그것이 거짓말이다)',
    /공공 자료로 되돌릴까요\?/.test(ds), ds);
  T('★★★ 무엇이 없어지고 무엇이 남는지 적는다',
    /공공 자료에 있는 이름과 위치만 남습니다/.test(ds), ds);
  T('★★★ 덧댐에는 「되돌릴 수 없습니다」 라고 안 적는다 (되돌아간다)',
    /덧댐 \? [\s\S]{0,260}: tsub\("'\{name\}' 을 지울까요\?"/.test(ds), ds);
}

// ══ 7. 꾸러미가 앱 안의 관 자료와 겹치면 뺀다 ══════════════════════
{
  const sa = grab(src, 'spotSameAs');
  T('겹침을 가리는 문이 있다', !!sa);
  const key = /const spotNameKey = [^;]+;/.exec(src);
  const 반경 = /const SPOT_SAME_M = (\d+);/.exec(src);
  T('★★ 겹침으로 보는 거리를 한 곳에서 정한다', !!반경, 반경 && 반경[0]);
  T('★★★ 거리를 짧게 잡는다 (넓게 잡으면 있는 곳이 사라진다) — ' + (반경 && 반경[1]) + 'm',
    반경 && Number(반경[1]) <= 300);
  const F = new Function(`
    const hav = (a,b,c,d) => {          // 아주 작은 거리용 근사 (km)
      const R = 6371, r = Math.PI/180;
      const x = (d-b)*r*Math.cos((a+c)/2*r), y = (c-a)*r;
      return Math.sqrt(x*x+y*y)*R;
    };
    ${반경[0]}
    ${key[0]}
    ${sa}
    return { spotSameAs, spotNameKey };`)();
  const 앱 = [{ name:'여수엑스포 마리나', lat:34.75192, lon:127.75171 },
              { name:'소호 마리나',      lat:34.73768, lon:127.65072 }];
  T('★★★ 이름이 같으면 같은 곳으로 본다 (딱지만 다른 것)',
    F.spotSameAs({ name:'여수엑스포마리나', lat:35.9, lon:129.9 }, 앱) === true);
  T('★★★ 「마리나」 를 뗀 이름이 같아도 같은 곳으로 본다',
    F.spotSameAs({ name:'소호', lat:35.9, lon:129.9 }, 앱) === true);
  T('★★★ 100m 안쪽이면 같은 곳으로 본다 (이름이 달라도)',
    F.spotSameAs({ name:'엑스포요트계류장', lat:34.75150, lon:127.75171 }, 앱) === true);
  T('★★★ 1km 떨어진 다른 곳은 안 뺀다 (있는 곳이 사라지면 안 된다)',
    F.spotSameAs({ name:'원형 마리나', lat:34.7610, lon:127.75171 }, 앱) === false);
  T('★★ 자리를 모르는 것은 이름으로만 본다',
    F.spotSameAs({ name:'생판 다른 곳', lat:null, lon:null }, 앱) === false);

  const all = grab(src, 'spotsAll');
  T('★★★ 목록 모으는 곳이 겹침을 걸러낸다', /\.filter\(s => !spotSameAs\(s, 앞\)\)/.test(all), all);
  T('★★★ 사람이 채운 것과 관 자료가 먼저다 (꾸러미가 덮지 않는다)',
    /const 앞 = \(spotList\|\|\[\]\)\.concat\(seed\)/.test(all), all);
}

// ══ 8. 자료 만드는 쪽 — 그물을 뒤집었는가 ═══════════════════════════
{
  const f = path.join(__dirname, '..', '..', 'webout', 'scripts', 'collect_jp.js');
  if(!fs.existsSync(f)) T('자료 만드는 것을 찾았다', false, f);
  else{
    const c = fs.readFileSync(f, 'utf8');
    T('자료 만드는 것을 찾았다', true);
    T('★★★ 「마리나인 곳을 다 내놔라」 로 묻는다', /leisure"="marina"/.test(c));
    T('★★★ 항·부두는 마리나 그물에 안 넣는다 (그건 마리나가 아니다)',
      /const MARINA_TAGS = \[ '"leisure"="marina"', '"seamark:type"="marina"' \];/.test(c));
    T('★★★ 한국 바다도 훑는다', /'kr:남해'[\s\S]{0,200}'kr:제주'/.test(c));
    T('★★★ 일본 바다도 훑는다', /'jp:세토내해'/.test(c));
    // ★ 4.100 — 러시아 극동도 훑는다 (사장님이 시키신 것)
    T('★★★ 러시아 극동도 훑는다', /'ru:연해주'[\s\S]{0,300}'ru:사할린'/.test(c));
    T('★★★ 러시아 꾸러미를 따로 낸다', /spots-ru\.json/.test(c));
    T('★★★ 확인 안 된 것으로 표시해서 싣는다', /v: 0,/.test(c));
    T('★★★ 관이 낸 것은 확인된 것으로 싣는다', /v: 1,/.test(c));
    T('★★★ 이름 없는 것은 안 싣는다', /if\(!name \|\| lat == null \|\| lon == null\) return;/.test(c));
    // ★ 4.102 — 파일을 바로 안 쓰고 「안전하게쓰기」 를 지난다.
    //   남의 서버가 덜 준 날 멀쩡한 자료를 반쯤 빈 것으로 덮어쓰지 않기 위해서다.
    T('★★★ 한국 파일을 따로 만든다', /안전하게쓰기\('spots-kr\.json'/.test(c));
    T('★★★ 일본 파일도 그대로 만든다', /안전하게쓰기\('spots-jp\.json'/.test(c));
    T('★★★ 적게 받은 날 지난 자료를 안 덮어쓴다', /줄어도되는몫/.test(c) && /안 썼습니다/.test(c));
    T('★★★ 새 파일을 스스로 담는다 (.github 를 못 고치니 사장님 일을 안 늘린다)',
      /execFileSync\('git', \['add', '-A', '--', 'spots-kr\.json', 'spots-ru\.json'\]/.test(c));
    T('★★ 한 바다가 막혀도 나머지를 버리지 않는다', /마리나샘\[이름\] = '★ 못 받음: '/.test(c));
    T('★★★ 막힌 것을 조용히 넘기지 않는다 (자료 안에 남긴다)', /마리나훑은수: 마리나샘/.test(c));
    T('★★ 관 자료와 겹친 것을 세어 남긴다', /관자료와겹쳐서뺀것: 겹침/.test(c));
    T('★★ 좌표는 다섯 자리로 자른다 (약 1m)', /Math\.round\(g\.lat \* 1e5\) \/ 1e5/.test(c));
    T('★★★ 출처를 밝힌다 (ODbL 의무다)', /OpenStreetMap contributors \(ODbL\)/.test(c));
  }
}

// ══ 9. 새로 쓴 말이 네 나라 말에 다 있다 ═══════════════════════════
{
  const 새말 = ['확인 안 됨','아직 확인되지 않은 곳입니다.','뱃일은 항해용 앱이 아닙니다.',
    // ★ 5.0 — 「관 자료」 → 「공공 자료」
    '공공 자료로 되돌리기','위치(핀)는 운영자만 옮깁니다. 위치가 틀렸으면 다녀온 이야기로 알려 주세요.',
    "'{name}'을 공공 자료로 되돌릴까요?",
    '채워 넣으신 내용이 없어지고, 공공 자료에 있는 이름과 위치만 남습니다.',
    '실제 항해와 접안은 반드시 공식 해도와 해당 시설에 확인하고 하십시오.'];
  ['en','ru','ja'].forEach(lg=>{
    const i = src.indexOf('\n  ' + lg + ': {');
    const j = src.indexOf('\n  },', i);
    const d = src.slice(i, j);
    새말.forEach(k=>{
      // ★ 열쇠에 작은따옴표가 들어 있으면 사전은 큰따옴표로 감싼다. 둘 다 본다.
      T(lg + ' 에 「' + k.slice(0,20) + '」 이 있다',
        d.indexOf("'" + k.replace(/'/g, "\\'") + "'") >= 0
        || d.indexOf('"' + k + '"') >= 0);
    });
  });
}


// ══ 10. 글은 아무나 고친다 · 사진과 위치는 아니다 (나무위키 방식) ═════
{
  const ce = grab(src, 'canEditSpot');
  T('★★★ 로그인하면 아무나 글을 고친다', /function canEditSpot\(s\)\{ return !!meUid\(\); \}/.test(ce), ce);
  const cp = grab(src, 'canPhotoSpot');
  T('사진을 가리는 문이 있다', !!cp);
  T('문이 하나다', (src.match(/function canPhotoSpot\(/g) || []).length === 1);
  const F = st => new Function('S', `
    const meUid = () => S.me;
    const isAdmin = () => S.admin;
    function canDelSpot(s){
      if(!s) return false;
      const me2 = meUid();
      if(me2 && String(s.by) === String(me2)) return true;
      return isAdmin();
    }
    ${cp}
    return canPhotoSpot;`)(st);
  const 남 = F({ me:'u1', admin:false });
  T('★★★ 남의 사진은 못 건드린다 (지우면 되돌릴 길이 없다)', 남({ by:'u2' }) === false);
  T('★★★ 내 사진은 내가 바꾼다', 남({ by:'u1' }) === true);
  T('★★ 운영자는 바꾼다', F({ me:'u9', admin:true })({ by:'u2' }) === true);
  T('★★ 새로 올릴 때는 넣을 수 있다', 남(null) === true);

  const sf = grab(src, 'spotForm') || '';
  T('★★★ 못 바꾸는 사람에게는 사진 단추를 안 보인다',
    /canPhotoSpot\(spotPickCtx\.id \? spotOf\(spotPickCtx\.id\) : null\)/.test(sf), sf.slice(-600));
  T('★★★ 왜 없는지 적어 준다', /사진은 올린 분과 운영자만 바꿉니다\./.test(sf));
  const sv = grab(src, 'spotSave') || '';
  T('★★★ 나가는 값에서도 남의 사진을 지킨다',
    /if\(옛 && !canPhotoSpot\(옛\)\)\{[\s\S]{0,200}body\.photos = Array\.isArray\(옛\.photos\)/.test(sv), sv);
  T('★★ 임자면 새 사진을 올린다', /else\{[\s\S]{0,160}await storePhotos/.test(sv), sv);
  T('★★ 못 고치는 사람에게 「올린 분과 운영자만」 이라고 안 한다 (이제 아무나 고친다)',
    !/올린 분과 운영자만 고칠 수 있습니다/.test(grab(src, 'writeSpot') || ''));
}

// ══ 11. 서버 규칙 — 글만 열고 자리·사진·임자는 잠근다 ═══════════════
{
  const f = path.join(__dirname, 'firestore_rules.txt');
  const r = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  T('규칙 파일이 있다', !!r);
  const 정 = r.slice(r.indexOf('match /spots/{spotId}'), r.indexOf('match /spots/{spotId}') + 9000);
  T('★★★ 위키 갈래가 있다', /위키 고치기/.test(정));
  const 갈래 = 정.slice(정.indexOf('위키 고치기'), 정.indexOf('위키 고치기') + 2200);
  T('★★★ 손댈 수 있는 칸을 못 박는다 (hasOnly)', /affectedKeys\(\)\s*\n?\s*\.hasOnly\(\['name'/.test(갈래), 갈래.slice(0,400));
  ['lat','lon','photos','thumbs','by','byName','ts','reports','reportN','hidden','likeN','cmtN','region']
    .forEach(k => T('★★★ ' + k + ' 은 위키 고치기로 못 바꾼다',
      !new RegExp("'" + k + "'").test(갈래.slice(갈래.indexOf('hasOnly'), 갈래.indexOf('])', 갈래.indexOf('hasOnly'))))));
  ['name','kind','depth','bottom','fee','tel','note','fac','open','tideNote','kw']
    .forEach(k => T('★★ ' + k + ' 은 고칠 수 있다',
      new RegExp("'" + k + "'").test(갈래.slice(갈래.indexOf('hasOnly'), 갈래.indexOf('])', 갈래.indexOf('hasOnly'))))));
  T('★★★ 임자가 안 바뀌는 것을 따로 못 박는다', /request\.resource\.data\.by == resource\.data\.by/.test(갈래));
  T('★★★ 자리가 안 바뀌는 것을 따로 못 박는다',
    /request\.resource\.data\.lat == resource\.data\.lat/.test(갈래)
    && /request\.resource\.data\.lon == resource\.data\.lon/.test(갈래));
  T('★★ 이름이 비면 못 올린다', /name\.size\(\) > 0/.test(갈래));
  T('★★ 이름이 너무 길면 못 올린다', /name\.size\(\) < 80/.test(갈래));
  T('★★★ 로그인하고 안 막힌 사람만 (윗줄이 그대로다)',
    /allow update: if signedIn\(\) && !banned\(\)/.test(정));
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
