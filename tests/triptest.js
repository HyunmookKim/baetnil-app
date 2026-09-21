// 항해 기록 — 갈래와 위치 공개
//
// ★ 왜 (4.55, STEP 3-B)
//   ① 낚시하는 사람은 항해일지를 다르게 쓴다. 이름을 바꾸는 대신 갈래로 푼다.
//   ② ★ 급소 — 낚시하는 사람은 자리를 안 알려 준다. 그대로 좌표를 붙여 올리게 하면
//      아예 안 올리거나 올렸다가 후회한다.
//      Strava 는 반경으로 가렸다가 뚫렸다 — 원은 여러 개 겹치면 중심이 방정식으로 풀린다.
//      Fishbrain·ANGLERS 는 「이름」으로 가린다. 이름은 평균을 낼 수가 없다.
//      그래서 우리도 좌표를 흐리는 게 아니라 아예 안 보내고 해역 이름을 보낸다.
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

// ── ① 갈래
const KINDS = (src.match(/const TRIP_KINDS = \[[\s\S]*?\];/) || [''])[0];
T('★ 항해 갈래 목록이 있다 (TRIP_KINDS)', KINDS.length > 0);
if(KINDS){
  T('★★ 낚시는 「출조」 다 (낚시인이 쓰는 말)', /출조/.test(KINDS), KINDS);
  T('★ 연안·원거리로 나뉜다', /연안 항해/.test(KINDS) && /원거리 항해/.test(KINDS), KINDS);
  T('★ 회항·시운전도 있다', /회항/.test(KINDS) && /시운전/.test(KINDS), KINDS);
}
const NM10 = grab('tripFar');
T('★ 원거리인지 재는 곳이 있다 (tripFar)', !!NM10);
T('★★ 10해리가 법 기준으로 박혀 있다 (원거리 수상레저활동 신고)',
  /TRIP_FAR_NM\s*=\s*10\b/.test(src), (src.match(/TRIP_FAR_NM\s*=\s*\d+/)||[])[0]);

// ── ② 위치 공개 세 단계
const LV = (src.match(/const POS_LEVELS = \[[\s\S]*?\];/) || [''])[0];
T('★ 위치 공개 단계가 있다 (POS_LEVELS)', LV.length > 0);
T('★★ 세 단계다 — 정확한 위치 / 해역까지만 / 위치 비공개',
  /정확한 위치/.test(LV) && /해역까지만/.test(LV) && /위치 비공개/.test(LV), LV.slice(0,300));
T('★★ 기본은 「해역까지만」 이다 (망설여지면 숨긴다)',
  /POS_DEF\s*=\s*'area'/.test(src), (src.match(/POS_DEF\s*=\s*'[^']*'/)||[])[0]);

const PL = grab('posLv'), PP = grab('posPublic'), SN = grab('seaName');
T('★ 이 항해의 단계를 읽는 곳이 있다 (posLv)', !!PL);
T('★ 해역 이름을 만드는 곳이 있다 (seaName)', !!SN);
T('★ 내보낼 자리를 만드는 곳이 있다 (posPublic)', !!PP);

if(PL && PP && SN){
  const F = new Function('V', 'P', `
    const POS_DEF = 'area';
    ${LV}
    const regionOfPoint = (la, lo) => '전남';
    const t = x => x;
    const tsub = (m,o)=>String(m).replace(/\\{(\\w+)\\}/g,(a,k)=>(o&&o[k]!=null)?o[k]:a);
    ${PL} ${SN} ${PP}
    return posPublic(V, P);
  `);
  const pt = { lat: 34.7218, lon: 127.6634 };
  const r1 = F({ posLv:'exact' }, pt);
  T('★ 「정확한 위치」 면 좌표가 나간다', r1 && r1.lat === 34.7218, r1);
  const r2 = F({ posLv:'area' }, pt);
  T('★★ 「해역까지만」 이면 좌표가 아예 안 나간다',
    r2 && r2.lat === undefined && r2.lon === undefined, r2);
  T('★★ 대신 해역 이름이 나간다 (원으로 뭉개지 않는다)',
    r2 && /전남/.test(String(r2.area || '')), r2);
  const r3 = F({ posLv:'none' }, pt);
  T('★ 「위치 비공개」 면 아무것도 안 나간다', r3 === null, r3);
  const r4 = F({}, pt);
  T('★★ 단계를 안 정한 옛 항해도 기본(해역까지만)으로 막힌다',
    r4 && r4.lat === undefined, r4);
  // ★ 다만 「항적 공개」를 손수 켜 둔 옛 항해는 사람이 정한 것이다. 조용히 뒤집지 않는다.
  const r5 = F({ pubTrk:true }, pt);
  T('★★ 항적 공개를 켜 둔 옛 항해는 그대로 좌표가 나간다 (사람이 정한 것을 안 뒤집는다)',
    r5 && r5.lat === 34.7218, r5);
  const r6 = F({ pubTrk:true, posLv:'area' }, pt);
  T('★ 그래도 단계를 고르면 그것이 이긴다', r6 && r6.lat === undefined, r6);
  T('자리가 없으면 없다고 한다', F({ posLv:'exact' }, null) === null);
}

// ── ③ 한 항해 안에서 제일 엄한 단계를 따른다
const TL = grab('trkPublicLine');
T('★★ 좌표를 안 보내기로 했으면 항적도 안 나간다 (항적이 곧 좌표다)',
  /posLv\s*\(/.test(TL || ''), (TL||'').slice(0,300));
const TP = grab('trkPublicLogPos');
T('★★ 중간 기록 깃발도 같은 문을 지난다', /posLv\s*\(|posPublic\s*\(/.test(TP || ''), (TP||'').slice(0,300));

// ── ④ 화면
T('★ 항해에 갈래 칸이 있다', /mrField\('kind'/.test(src));
T('★★ 위치 공개 단계를 고르는 자리가 있다', /mrField\('posLv'|posLvPick\(/.test(src));
T('★ 원거리면 신고 대상이라고 알려 준다', /원거리 수상레저활동 신고/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
