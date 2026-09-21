// 배 둘러보기 항해일지 · 편집↔보기 다시 그리기 · 정비 글 배 정보
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w?' — '+w:''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

// ── 밖으로 내보내는 항해일지
const bp = grab(src, 'buildPublic');
// ★ 4.74 — 나가는 칸은 이제 표(PUB_OUT) 한 곳에 적혀 있다.
//   buildPublic 안에서 글자를 찾지 않는다 — 표에 적혀 있으면 나간다.
{
  const TB = (src.match(/const PUB_OUT = \{[\s\S]*?\n\};/)||[''])[0];
  const V = (TB.match(/voyage:\s*\{[\s\S]*?\n  \}/)||[''])[0];
  ['timeOut','timeIn','nm','hours','engineH','note']
    .forEach(k => T('공개 자료에 ' + k + ' 가 담긴다 (표에 적혀 있다)', V.includes("'"+k+"'"), V.slice(0,200)));
  ['logs','wxOut','wxIn','fish','photos']
    .forEach(k => T('공개 자료에 ' + k + ' 가 문을 지나 담긴다', V.includes("'"+k+"'") && new RegExp(k + ':').test(bp)));
  T('★★ 표를 실제로 쓴다 (손으로 또 안 적는다)', /\.\.\.pubPlain\(v, 'voyage'\)/.test(bp));
}
T('중간 기록에서 좌표를 떼어 낸다',
  /logs: \(Array\.isArray\(v\.logs\)[\s\S]{0,220}?time:g\.time/.test(bp) && !/pos:/.test(bp));
// ★ 4.55 — 출발·도착 자리가 나갈 수 있게 됐다. 다만 반드시 두 문을 지나야 한다:
//   ① 위치 공개 단계(posPublic) — 「해역까지만」이면 좌표가 아예 안 담긴다
//   ② 계류 자리 가리개(trkInHide) — 출발지는 대개 계류 자리다
//   그래서 「posOut 이라는 글자가 없다」가 아니라 「legPublic 을 지난다」로 본다.
T('★★ 출발·도착 자리가 위치 공개 단계와 계류 가리개를 지난다',
  /posOut:\s*legPublic\(/.test(bp) && /posIn:\s*legPublic\(/.test(bp),
  (bp.match(/posOut:[^\n]*/)||[''])[0]);
T('★★ 날것의 좌표를 그대로 담는 자리가 없다',
  !/posOut:\s*v\.posOut/.test(bp) && !/posIn:\s*v\.posIn/.test(bp) && !/trkPoints/.test(bp));

// ★ 글자로만 보는 검사는 새 칸이 생기면 못 잡는다.
//   3.96 에서 날씨 값 안에 lat·lon 을 넣었다 — 그게 밖으로 새면 항로가 통째로 나간다.
//   그래서 실제로 돌려 보고, 나온 자료 어디에도 좌표가 없는지 통째로 뒤진다.
{
  globalThis.t = x => x;
  globalThis.PUB_KEYS = [{k:'port'},{k:'spec'},{k:'intro'},{k:'phone'},{k:'board'},
                         {k:'voyage'},{k:'maint'},{k:'gear'},{k:'roster'},{k:'biz'}];
  globalThis.BOAT_TYPES = { sail:'세일' };
  globalThis.posts = []; globalThis.maint = []; globalThis.items = [];
  globalThis.rankOf = () => null;
  globalThis.photoBudget = a => ({ kept: a || [] });
  globalThis.catchTotal = () => [];
  const LAT = 34.73893, LON = 127.67897;
  globalThis.voyage = [{
    id:'v1', date:'2026-08-17', pub:true, title:'시험', crew:'아무개',
    timeOut:'13:36', timeIn:'18:04',
    posOut:{ lat:LAT, lon:LON, acc:38 },
    posIn:{ lat:34.74317, lon:127.67888, acc:3 },
    // ★ 3.96 에서 새로 들어간 칸
    wxOut:{ text:'남남서 21kt · 파고 0.4m', at:'2026-08-17 13:36', spot:'', pos:1, lat:LAT, lon:LON },
    wxIn:{ text:'남 16kt', at:'', spot:'개도', pos:0, lat:34.625, lon:127.59 },
    logs:[{ id:'g1', time:'14:22', kind:'세일', text:'', eng:'off',
            pos:{ lat:34.70033, lon:127.66658, acc:4 },
            wx:{ text:'남 18kt', pos:1, lat:34.70033, lon:127.66658 } }]
  }];
  // ★ 항적 가리개도 진짜를 떼어 온다. 가짜로 두면 「좌표가 안 샌다」가 헛통과한다.
  { const m = src.match(/const TRK_HIDE = \[[^\]]*\];/); if(m) eval(m[0].replace('const TRK_HIDE','globalThis.TRK_HIDE')); }
  { const m = src.match(/const TRK_HIDE_DEF = [^;]+;/); if(m) eval(m[0].replace('const TRK_HIDE_DEF','globalThis.TRK_HIDE_DEF')); }
  // 4.55 — 위치 공개 세 단계
  { const m = src.match(/const POS_LEVELS = \[[\s\S]*?\];/); if(m) eval(m[0].replace('const POS_LEVELS','globalThis.POS_LEVELS')); }
  { const m = src.match(/const POS_DEF\s*=\s*'[^']*';/);       if(m) eval(m[0].replace('const POS_DEF','globalThis.POS_DEF')); }
  globalThis.regionOfPoint = () => '전남';
  globalThis.isGear = x => !!(x && x.typ === 'gear');
  globalThis.isMlog = x => !!(x && x.typ === 'log');    // 4.63 — 정비수첩
  globalThis.mlogRows = () => [];
  globalThis.mlogPublic = () => null;
  { const m = src.match(/const PUB_LEVELS = \[[\s\S]*?\n\];/); if(m) eval(m[0].replace('const PUB_LEVELS','globalThis.PUB_LEVELS')); }
{ const m = src.match(/const PUB_OUT = \{[\s\S]*?\n\};/); if(m) eval(m[0].replace('const PUB_OUT','globalThis.PUB_OUT')); }
  globalThis.VOY_LEVELS = globalThis.PUB_LEVELS;

  globalThis.tsub = (m2,o)=>String(m2).replace(/\{(\w+)\}/g,(a2,k)=>(o&&o[k]!=null)?o[k]:a2);
  for(const f of ['pubOn','isPublic','buildPublic',
                  'trkHideNm','nmBetween','trkAnchors','trkInHide','trkPublicLine','trkPublicLogPos',
                  'posLv','seaName','posPublic','legPublic','trkPublicLogArea',
                  'maintRows',
                  'pubLvOf','voyLv','mlogLv','rvLv','specLv','pubPlain','wxPublic'])                                   // 4.70 — 항해 공개 3단계
    eval('globalThis.' + f + ' = ' + grab(src, f));

  const B = { id:'b1', name:'배', type:'sail', members:{},
              pub:{ port:true, spec:true, intro:true, phone:true, board:true,
                    voyage:true, maint:true, gear:true, roster:true } };
  const out = buildPublic(B);
  const dump = JSON.stringify(out);
  T('실제로 내보내 봤다 — 항해일지가 담겼다', !!(out && out.voyage && out.voyage.length));
  // 좌표 숫자가 어떤 모양으로든 들어 있으면 실패다
  const NUMS = ['34.73893','127.67897','34.70033','127.66658','34.74317','127.67888'];
  const leak = NUMS.filter(n => dump.indexOf(n) >= 0);
  T('내보낸 자료 어디에도 좌표 숫자가 없다', leak.length === 0, leak.join(','));
  T('좌표를 담는 이름조차 없다', !/"lat"|"lon"|"pos"|"acc"/.test(dump),
    (dump.match(/"(lat|lon|pos|acc)"/g)||[]).join(','));
  T('날씨는 사람이 읽는 한 줄만 나간다',
    out.voyage[0].wxOut === '남남서 21kt · 파고 0.4m', out.voyage[0].wxOut);
  T('날씨 지점 이름도 안 나간다', dump.indexOf('개도') < 0);
  // ★★★ 4.102 — 날씨는 **내보낸다** (사장님이 정하신 것)
  //   「날씨 같은 거는 공개해줘도 상관없는 거 아니냐? 오히려 공개해줘야지.
  //    그게 사람들이 보기에 재밌는 거 아니냐」
  //   ★ 좌표는 그대로 안 나간다 — 그건 배 주인이 항적 보이기로 켜야 나간다.
  T('중간 기록은 나가되 좌표는 빠진다',
    out.voyage[0].logs.length === 1 && !out.voyage[0].logs[0].pos,
    JSON.stringify(out.voyage[0].logs[0]));
  T('★★★ 중간 기록의 날씨는 나간다 (사장님이 공개하라 하심)',
    !!out.voyage[0].logs[0].wx, JSON.stringify(out.voyage[0].logs[0]));
  T('★★ 날씨는 숫자로 나간다 (보는 사람 나라 말로 다시 지어진다)',
    typeof out.voyage[0].logs[0].wx === 'object'
      || typeof out.voyage[0].logs[0].wx === 'string',
    out.voyage[0].logs[0].wx);
  T('동승자 이름도 안 나간다', dump.indexOf('아무개') < 0);
}
T('동승자 이름은 나가지 않는다', !/crew:/.test(bp));
T('예정 항해는 나가지 않는다', /!v\.plan/.test(bp));
T('최근 것이 먼저 나간다',
  /\.sort\(\(a,c\)=> String\(c\.date\|\|''\)\.localeCompare\(String\(a\.date\|\|''\)\)\)/.test(bp));
T('사진 용량을 지킨다', /photoBudget\(v\.photos \|\| \[\], 300\)/.test(bp));
T('공개 설정 설명이 사실과 맞는다',
  /k:'voyage'[\s\S]{0,90}sub:'기록 내용과 사진/.test(src)
  && !/sub:'날짜와 항로만/.test(src));

// ── 눌러 들어간 화면
const body = grab(src, 'boatPageBody');
// ★★★ 4.102 — 남의 배 항해일지도 **내 화면과 같은 칸**으로 보여 준다 (사장님 지적:
//   「자기가 보는 거는 예쁜 화면에서 잘 나오는데 왜 사람들한테 보여주는 거는 이렇게 조같냐」).
//   그래서 「중간 기록」 이라는 이름표 대신, 기록마다 색 띠가 붙은 제 칸이 생겼다.
['출발','도착','거리','항해 시간','메모','사진'].forEach(k =>
  T("자세히 보기에 '" + k + "' 가 나온다", body.indexOf(k) > 0));
T('★★★ 기록마다 제 칸이 있다 (내 화면과 같은 legc)',
  /class="legc \$\{갈래\}"/.test(body) && /class="legc mid"/.test(body)
  && /끝칸\('out', '출발'/.test(body) && /끝칸\('in', '도착'/.test(body), body.slice(0,300));
T('★★★ 날씨를 그리는 자리가 있다', /날씨줄/.test(body) && /wxText\(/.test(body));
T('★★ 좌표는 **온 것만** 그린다 (화면이 제 마음대로 뚫지 않는다)',
  /자리줄 = q =>/.test(body) && /if\(!q\) return '';/.test(body));
T('목록도 최근 것이 위다',
  /\.sort\(\(a,b\)=>String\(b\.date\|\|''\)\.localeCompare\(String\(a\.date\|\|''\)\)\)/.test(body));
// ★ 4.95 — 사진이 자리마다 붙는다(출발·중간 기록·도착·이 항해 사진).
//   꺼내는 문이 pubVoyPhotoAt 하나로 모였다. 「누르면 크게 열리는가」 를 본다.
T('사진을 크게 볼 수 있다',
  /function pubVoyPhotoAt\(/.test(src) && /onclick="pubVoyPhotoAt\(/.test(body), body.slice(0,200));
T('★ 자리마다 크게 나온다', /class="vphbig"/.test(body));
// ★ 4.102 — 칸을 만드는 자리가 하나(끝칸)로 모여, 사진은 그 칸에 넘겨 준다.
T('★ 출발·중간 기록·도착 사진이 다 걸려 있다',
  /v\.phOut, 'out'/.test(body) && /pvBox\(g\.photos/.test(body) && /v\.phIn, 'in'/.test(body)
  && /pvBox\(사진, 사진열쇠\)/.test(body));

// ── 편집 ↔ 보기 전용
T('바꾸면 그 자리에서 다시 그린다', /repaintNow\(\);\s*\/\/ ★ 지금 보고 있는 화면/.test(src));
T('다시 그리기를 한 곳에서만 정한다',
  (src.match(/function repaintNow\(/g)||[]).length === 1
  && (src.match(/function wrapPainters\(/g)||[]).length === 1);
T('화면 그리는 함수를 목록으로 관리한다', /const PAINTERS = \[/.test(src));
T('주요 화면이 목록에 다 있다',
  ['openMR','openBoat','paintBoatPage','renderVoyage','renderList','openLocker','openTalk','openSpot']
    .every(n => new RegExp("'" + n + "'").test((src.match(/const PAINTERS = \[[\s\S]*?\];/)||[''])[0])));
T('앱이 뜬 뒤에 감싼다', /wrapPainters\(\);\n[\s\S]{0,80}applyLang\(\);/.test(src));

// ── 정비 글에 배 정보
const bl = grab(src, 'boatLine');
T('배 한 줄을 한 곳에서만 만든다', (src.match(/function boatLine\(/g)||[]).length === 1);
T('제조사·모델·연식이 들어간다', /b\.maker/.test(bl) && /b\.model/.test(bl) && /b\.year/.test(bl));
T('엔진이 들어간다', /sp\.engine/.test(bl));
T('배 이름은 안 들어간다', !/b\.name/.test(bl));
T('길이는 피트와 미터를 함께 쓴다',
  /function mToFt\(/.test(src) && /function loaText\(/.test(src)
  && /ft \+ ' \(' \+ v \+ 'm\)'/.test(grab(src,'loaText')));
const rt = grab(src, 'talkRecordText');
T('정비 글에 배 줄이 붙는다', (rt.match(/const bl = boatLine\(\); if\(bl\) L\.push\(bl\);/g)||[]).length === 2);

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
