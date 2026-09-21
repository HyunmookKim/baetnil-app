// 기본 정박지(관 자료) 검사
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w?' — '+w:''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0,st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

const seed = (src.match(/const SPOT_SEED = \[[\s\S]*?\n\];/)||[''])[0];
T('기본 정박지 자료가 들어 있다', seed.length > 1000);
T('마리나 39곳이 들어 있다', (seed.match(/\{i:'gov_m/g)||[]).length === 39,
  String((seed.match(/\{i:'gov_m/g)||[]).length));
T('국가어항 113곳이 들어 있다', (seed.match(/\{i:'gov_f/g)||[]).length === 113,
  String((seed.match(/\{i:'gov_f/g)||[]).length));
T('어항은 항·부두로 들어간다', (seed.match(/\{i:'gov_f[^}]*k:'port'/g)||[]).length === 113);
T('어항 자료 출처를 적어 뒀다', /해양수산부 어항정보 \(2019-12-31\)/.test(src));
T('좌표가 모두 한국 안이다', (()=>{
  const la = [...seed.matchAll(/la:([\d.]+)/g)].map(m=>+m[1]);
  const lo = [...seed.matchAll(/lo:([\d.]+)/g)].map(m=>+m[1]);
  return la.length === 152 && lo.length === 152
    && la.every(v=>v>=33 && v<=38.7) && lo.every(v=>v>=124.5 && v<=132);
})());
T('이름이 겹치지 않는다', (()=>{
  const ids = [...seed.matchAll(/\{i:'([^']+)'/g)].map(m=>m[1]);
  return new Set(ids).size === ids.length;
})());
T('계획 단계인 곳에 표시가 있다', (seed.match(/p:true/g)||[]).length === 9,
  String((seed.match(/p:true/g)||[]).length));
T('클라우드가 아니라 앱 안에 둔 까닭을 적어 뒀다', /왜 클라우드가 아니라 앱 안에 넣나/.test(src));
T('자료 출처를 적어 뒀다', /해양수산부 마리나 정보 \(2025-01-24\)/.test(src));

T('정박지를 모으는 곳이 한 곳이다', (src.match(/function spotsAll\(/g)||[]).length === 1);
T('사람이 채운 것이 관 자료를 덮는다', /have\.has\(String\(x\.i\)\)/.test(grab(src,'spotsAll')));
T('자세히 보기도 관 자료를 찾는다', /function spotOf\(id\)\{ return spotsAll\(\)/.test(src));
// ★ 3.83 부터 목록은 [앱 안 것 + 서버가 찾아 준 것] 을 합쳐 만든다(spotsForList).
//   그래도 바탕은 spotsAll() 이라야 관 자료 152곳이 함께 나온다.
T('목록이 관 자료를 함께 보여 준다', /const rows = spotsForList\(\)/.test(src));
T('합치는 곳도 관 자료에서 시작한다', /spotsAll\(\)/.test(grab(src,'spotsForList') || ''));
T('서버가 준 것을 겹쳐 넣지 않는다', /have\.has\(String\(x\.id\)\)/.test(grab(src,'spotsForList') || ''));

T('가까운 순으로 놓는다', /const x = spotNm\(a\), y = spotNm\(b\);/.test(src));
T('거리 재는 곳이 한 곳이다', (src.match(/function spotNm\(/g)||[]).length === 1);
T('내 자리를 정하는 곳이 한 곳이다', (src.match(/function herePos\(/g)||[]).length === 1);
T('목록에 몇 마일인지 나온다', /NM' : ''/.test(src));

T('낚시배는 항·부두로 시작한다', /isFishing\(\)\) \? 'port' : ''/.test(grab(src,'spotKindNow')));
T('바꾸면 기억한다', /localStorage\.setItem\('bt_spotkind', v\)/.test(src));
T('거르기를 한 곳에서만 정한다', (src.match(/function spotKindNow\(/g)||[]).length === 1
  && !/s\.kind === spotKind\b/.test(src));

// ★★★ 4.99 — 이제 관 자료뿐 아니라 **사람이 올린 것도** 누구나 고친다 (사장님이 정하신 것).
//   옛 검사는 「관 자료일 때만 열린다」 는 옛 설계를 붙들고 있었다.
T('관 자료는 누구나 채울 수 있다', /return !!meUid\(\);/.test(grab(src,'canEditSpot')));
T('★★★ 사람이 올린 것도 누구나 고친다', !/s\.seed/.test(grab(src,'canEditSpot')), grab(src,'canEditSpot'));
T('관 자료에는 반응·신고를 안 붙인다', /\$\{s\.seed \? '' : `<div class="mrrow" style="gap:8px;padding:12px">/.test(src));
T('채우면 관 자료 표시가 떨어진다', /delete body\.seed; delete body\.plan;/.test(src));
T('계획 단계는 화면에도 표시된다',
  /s\.plan\s*\?\s*`?<span class="chip notice">(\$\{esc\(t\(')?계획/.test(src));

// ── 정박지 댓글
T('정박지에 댓글이 있다', /function writeSpotComment\(/.test(src) && /function spotCmtHtml\(/.test(src));
T('글판 댓글과 같은 방을 쓴다',
  /__cmt\.list\('spots'/.test(src) && /__cmt\.add\('spots'/.test(src) && /__cmt\.del\('spots'/.test(src));
T('남의 댓글은 못 지운다', /mine \|\| isAdmin\('postDel'\)/.test(grab(src,'spotCmtHtml')));
// ★★★ 4.139 (5.0) — 뒤집혔다. 관 자료 자리에도 「다녀온 이야기」를 남긴다.
//   사장님 지적: 「내용 적기가 뭐 이곳에 대한 리뷰나 소감 쓰는 것도 포함이냐?」
//   막을 까닭이 없었다 — 이야기는 자리 문서 밖의 방(spots/{id}/comments)에 들어가고
//   서버 규칙도 자리 문서가 있는지 안 본다. 앱만 막고 있었다.
T('관 자료 자리에도 댓글을 막지 않는다',
  !/if\(s\.seed\)\{ tell\((t\()?'아직 아무도 채우지 않은 자리/.test(src));
T('관 자료 자리도 댓글 칸을 그린다', !/\$\{s\.seed \? '' : spotCmtHtml\(s\)\}/.test(src)
  && /\$\{spotCmtHtml\(s\)\}/.test(src));
T('열 때 댓글을 받아 온다 (seed 여도)',
  /if\(!spotCmts\[String\(id\)\]\) await loadSpotCmts\(id\);/.test(src));
T('목록에 댓글 수가 보인다', /title="(\$\{esc\(t\(')?다녀온 이야기/.test(src));
const rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8');
const spotsBlock = (rules.match(/match \/spots\/\{spotId\} \{[\s\S]*?\n    \}/)||[''])[0];
T('규칙에 정박지 댓글 방이 있다', /match \/comments\/\{cmtId\}/.test(spotsBlock));
T('댓글은 고칠 수 없다', /allow update: if false;/.test(spotsBlock));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
