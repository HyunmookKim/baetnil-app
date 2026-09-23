// 연재 권한 검사 — '연재자'가 게시판 열쇠까지 받지 않는지 본다.
// ★ 왜 필요한가: 연재를 맡길 사람에게 'postDel'(글 지우기)을 주면
//   그 사람이 게시판 글을 다 지울 수 있다. 그 실수를 코드로 막아 둔다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8');
let ok = 0, bad = 0;
const T = (name, cond, why) => {
  if (cond) { ok++; console.log('통과: ' + name); }
  else { bad++; console.log('★ 실패: ' + name + (why ? ' — ' + why : '')); }
};

// ── 앱
T("권한 목록에 '연재 글 올리기'가 있다", /\{\s*k:'series'\s*,/.test(src));
T('연재자 판별이 한 곳에만 있다',
  (src.match(/function permOnlySeries\(/g) || []).length === 1);
T("연재 올리기는 isAdmin() 이 아니라 canSeries() 를 본다",
  /const can = canSeries\(\);/.test(src) && !/const can = isAdmin\(\);/.test(src));
T('연재 글쓰기 문턱이 canSeries 다', /if\(!canSeries\(\)\)\{ tell/.test(src));
// ★ canSeries 가 isAdmin() 으로 슬쩍 바뀌면 아무 운영자나 연재를 올린다.
T("canSeries 는 'series' 권한만 본다",
  /function canSeries\(\)\{ return isAdmin\('series'\); \}/.test(src));
T('남의 연재는 못 고친다', /if\(x && !canEditSeries\(x\)\)\{ tell/.test(src));
T('연재 지우기는 canDelSeries 를 본다', /if\(!canDelSeries\(x\)\) return;/.test(src));
T("고치기는 본인만, 지우기는 운영자도",
  /function canEditSeries\(x\)\{[\s\S]{0,220}?String\(x\.by\) === String\(u\)/.test(src)
  && /function canDelSeries\(x\)\{ return canEditSeries\(x\) \|\| isAdmin\('postDel'\); \}/.test(src));
T('연재자에게는 서랍의 운영자 메뉴가 안 보인다',
  /isAdmin\(\) && !amSeriesOnly\(\)/.test(src));
T('연재자는 운영자 화면을 못 연다',
  (src.match(/if\(!isAdmin\(\) \|\| amSeriesOnly\(\)\)/g) || []).length >= 2);
T('이름표를 한 곳(roleChip)에서만 만든다',
  (src.match(/function roleChip\(/g) || []).length === 1
  && !/'<span class="chip whochip">운영자<\/span>' : ''/.test(src));

// ── 규칙
const sr = (rules.match(/match \/series\/\{sid\} \{[\s\S]*?\n    \}/) || [''])[0];
// ★ 'allow create ... ;' 한 문장씩 끊어서 본다.
//   끊지 않으면 create 검사가 저 아래 delete 줄의 postDel 까지 집어삼킨다.
const stmt = k => ((sr.match(new RegExp('allow ' + k + '[\\s\\S]*?;')) || [''])[0]);
T('규칙에 연재 칸이 있다', sr.length > 0);
T("규칙이 series 권한을 본다", /adminCan\('series'\)/.test(sr));
T("규칙에서 postDel 만으로는 못 올린다", !/adminCan\('postDel'\)/.test(stmt('create')));
T('올릴 때 자기 이름으로만 올린다',
  /request\.resource\.data\.by == request\.auth\.uid/.test(stmt('create')));
T('고치기는 올린 본인만',
  /resource\.data\.by == request\.auth\.uid/.test(stmt('update')));
T("지우기는 본인 또는 글 지우기 운영자",
  /adminCan\('postDel'\)/.test(stmt('delete'))
  && /adminCan\('series'\)/.test(stmt('delete')));
T('허락 조건 네 칸을 규칙이 지킨다',
  /function seriesOk\(\)/.test(rules)
  && ['title','author','source','link'].every(k => rules.includes('request.resource.data.' + k)));

// ── 최고 운영자는 모든 권한을 가진다 (권한을 새로 만들어도 막히지 않는다)
T('앱에서 주인은 전부 된다', /if\(adminMe\.owner === true\) return true;/.test(src));
T('규칙에서도 주인은 전부 된다',
  /adminCan\(key\)[\s\S]{0,400}?\.data\.get\('owner', false\) == true/.test(rules));

// ── 연재 두 갈래 — 직접 쓴 글 / 옮긴 글
T('연재 갈래를 한 곳에서만 가른다', (src.match(/function seriesMine\(/g)||[]).length === 1);
T('글 쓸 때 갈래를 먼저 고른다', /key:'mine', label:'글 종류'/.test(src));
T('직접 쓴 글은 매체·링크가 필요 없다', /if\(!mine\)\{[\s\S]{0,400}?매체 이름을 넣어 주세요/.test(src));
T('직접 쓴 글에는 원문 칸이 안 붙는다', /\$\{seriesMine\(x\) \? '' :/.test(src));
T('옮긴 글에는 허락 문구가 붙는다', /저작권자 허락을 받아 옮겼습니다/.test(src));
T('규칙도 갈래를 본다', /request\.resource\.data\.get\('mine', false\) == true/.test(rules));
T("'해외 매체' 안내문을 뺐다", !/해외 요트 매체의 글을 허락받아 옮겨 싣는 자리/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
