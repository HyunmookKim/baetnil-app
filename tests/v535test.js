// 5.35 — 사장님 지적 넷 (2026-10-03)
//   ① 체크리스트: 「목록 제목 수정 못 하게」·「수정하려고 안에 들어가니까 … 다시 똑바로 만들어」
//   ② 갈래 줄: 「아래로 스크롤하니까 버튼 그냥 사라지네 … 다른 것들도 다」
//   ③ 배 연락처: 「여러개 연락처 … 영업용 사무용 기타 … 이메일이랑 기타 소셜」
//   ④ 배 둘러보기 표시: 「배 둘러보기에 나오는지 안 나오는지는 어디서 설정하는 거냐?」
const fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || '../www/index.html');
const src = fs.readFileSync(FILE, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0, 300) : '')); } };
const grab = name => { const i = src.indexOf('function ' + name + '('); if(i < 0) return '';
  let d = 0, st = src.indexOf('{', i);
  for(let j = st; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) return src.slice(i, j + 1); } }
  return ''; };

// ① 체크리스트
T('「무엇을 할까요 → 실행」 두 단계 창이 없다', !/label:'무엇을 할까요'/.test(src));
T('줄의 「수정」 은 곧바로 항목 화면', /function ckRowMenu\(id\)\{ editCheckItem\(id\); \}/.test(src));
T('「목록 수정」 은 곧바로 목록 화면(이름·주기·삭제)', /function ckListMenu\(id\)\{ renameCheckList\(id\); \}/.test(src)
  && /key:'name',\s*label:'목록 이름'/.test(grab('renameCheckList')) && /del: \{ text:'목록 삭제'/.test(grab('renameCheckList')));
{
  const e = grab('editCheckItem');
  T('항목 화면 하나에 이름·링크·담당자·목록·삭제', /key:'label'/.test(e) && /key:'url'/.test(e) && /key:'who'/.test(e) && /key:'list'/.test(e) && /text:'항목 삭제'/.test(e));
  T('담당자는 구성원에게만 (assignTask 를 지난다)', /assignTask\('check', id, v\.who \|\| ''\)/.test(e));
}
T('입력 화면이 넓은 화면에서 왼쪽에 좁게 뜨지 않는다', /#formOv \.formBox\{flex:1 1 auto;width:100%;min-width:0\}/.test(src));

// ② 갈래 줄 (★ 5.37 — 옆으로 밀리는 줄은 .pinbar 껍데기 안에 둔다: 흐림 판이 잘리지 않게. pin537test)
T('붙여 두는 줄 규칙이 있다 (머리줄 밑)', /\.pinbar\{position:sticky;top:var\(--stickyTop,var\(--hdrH,56px\)\);z-index:6\}/.test(src));
for(const [n, re] of [
  ['정비수첩·수리·연료', /<div id="mntBar3" class="pinbar"><\/div>/],
  ['정비수첩 화면', /<div id="mntBar1" class="pinbar"><\/div>/],
  ['연료 화면', /<div id="mntBar4" class="pinbar"><\/div>/],
  ['장비 목록·정기점검·리뷰', /<div class="mrhead pinbar" style="flex-wrap:wrap">\s*<button class="tab on" id="gearTabG"/],
  ['문서·이력·연락처', /`<div class="pinbar"><div class="tfilt" style="align-items:center">` \+ DOC_SUBS/],
  ['체크리스트 목록', /<div class="pinbar ckpin"><div class="ckchips">/],
  ['뉴스 갈래', /`<div class="pinbar"><div class="subrow">`\s*\+ \[\['kr'/],
  ['게시판 말머리', /const kinds = `<div class="pinbar"><div class="tfilt">`/],
  ['정박지 종류', /`<div class="pinbar"><div class="tfilt">`\s*\+ `<button class="tchip\$\{spotKindNow\(\)/],
  ['남의 배 탭(머리줄 둘째 줄)', /<div class="mrhead mrhead2"[^>]*>[\s\S]{0,300}\$\{탭줄\}<\/div>/]
]) T('붙여 두는 줄 — ' + n, re.test(src));

// ③ 연락처
const ctx = new Function('esc', 't', [
  'const CI_KINDS = ' + src.match(/const CI_KINDS = (\[[\s\S]*?\n\]);/)[1] + ';',
  'const CI_LABS = ' + src.match(/const CI_LABS = (\[[\s\S]*?\n\]);/)[1] + ';',
  grab('ciKind'), grab('ciList'), grab('ciLabName'), grab('ciClean'), grab('ciHref'), grab('ciShow'),
  'return { ciList, ciClean, ciHref, ciShow, ciLabName };'].join('\n'))(x => String(x), x => x);
T('옛 한 칸(phone)은 첫 줄로 보인다', JSON.stringify(ctx.ciList({ phone:'010-1234-5678' })) === JSON.stringify([{ t:'tel', v:'010-1234-5678', lab:'' }]));
T('cinfo 가 있으면 그것을 쓴다', ctx.ciList({ phone:'1', cinfo:[{ t:'email', v:'a@b.co' }] })[0].t === 'email');
T('전화 확인', !ctx.ciClean('tel', '010-1234-5678').err && !!ctx.ciClean('tel', '전화해').err);
T('이메일 확인', !ctx.ciClean('email', 'a@b.co').err && !!ctx.ciClean('email', 'ab.co').err);
T('인스타그램 — @아이디·주소 모두 아이디만 남는다', ctx.ciClean('insta', '@baetnil').v === 'baetnil' && ctx.ciClean('insta', 'https://www.instagram.com/baetnil/').v === 'baetnil');
T('홈페이지 — https:// 를 넣는다', ctx.ciClean('web', 'baetnil.com').v === 'https://baetnil.com');
T('카카오톡 — 카카오 주소만', !ctx.ciClean('kakao', 'open.kakao.com/o/gelZBhfg').err && !!ctx.ciClean('kakao', 'naver.com/x').err);
T('누르면: 전화 tel · 메일 mailto · 인스타 주소', ctx.ciHref({ t:'tel', v:'010-1234-5678' }) === 'tel:01012345678'
  && ctx.ciHref({ t:'email', v:'a@b.co' }) === 'mailto:a@b.co' && ctx.ciHref({ t:'insta', v:'baetnil' }) === 'https://www.instagram.com/baetnil/');
T('직접 입력한 용도가 보인다', ctx.ciLabName({ lab:'custom', cl:'예약 문의' }) === '예약 문의' && ctx.ciLabName({ lab:'biz' }) === '영업용');
T('대표 전화는 b.phone 에도 (옛 앱·옛 공개 사본)', /b\.phone = tel \? tel\.v : ''/.test(grab('ciSave')));
T('클라우드에 올라간다 (BOAT_FIELDS cinfo)', /'phone','trkHide',\s*\/\/[^\n]*\n\s*'cinfo',/.test(src));
T('공개는 「연락처」 하나가 정한다 — 켜야 cinfo 가 나간다', /if\(pubOn\(b,'phone'\)\)\{[\s\S]{0,200}o\.cinfo = /.test(grab('buildPublic')));

// ④ 배 둘러보기 표시
const pub = new Function([
  "const PUB_KEYS = [{k:'port'},{k:'spec'},{k:'phone'}];",
  grab('isPublic'), 'return { isPublic };'].join('\n'))();
T('예전 배(listed 없음) — 하나라도 켜져 있으면 표시 (공개 상태가 안 바뀐다)', pub.isPublic({ pub:{ spec:true } }) === true && pub.isPublic({ pub:{} }) === false);
T('끄면 항목이 켜져 있어도 숨김', pub.isPublic({ pub:{ spec:true, listed:false } }) === false);
T('켜면 항목이 없어도 표시 (배 이름·선종)', pub.isPublic({ pub:{ listed:true } }) === true);
T('공개 설정 맨 위에 스위치 하나', /class="permrow pubmaster"/.test(grab('openPublish')) && /setListedUI\(false\)/.test(grab('openPublish')) && /setListedUI\(true\)/.test(grab('openPublish')));
T('계류장 기본정보에도 지금 상태가 보인다', /esc\(t\('배 둘러보기'\)\)\}<\/span>\s*<span class="mrm" style="flex:1">\$\{esc\(isPublic\(b\)/.test(src));
T('영업용을 켜면 표시도 켠다', /b2\.pub\.listed = true/.test(grab('setBizUI')));

// ⑤ 데이터 — 큰 물때·조류·조석 모형은 「바뀌었을 때만 받기」 (사장님: 「이것도 해보고 문제 조금이라도 생기면 빽해라」)
T('바뀌었을 때만 받기 = no-cache (꼬리표로 묻고, 안 바뀌면 본문 안 받음)', /const DATA_REVALIDATE = \{ cache:'no-cache' \};/.test(src));
for(const f of ["'current.json'", "'tide.json'", 'pk.tide', "'hc-eot20.txt'"]){
  const re = new RegExp('fetch\\(DATA_BASE ?\\+ ?' + f.replace(/[.'()]/g, m => '\\' + m) + ', DATA_REVALIDATE\\)');
  T('큰 파일 ' + f + ' — 시각 꼬리 없이 바뀌었을 때만', re.test(src));
}
T('큰 파일 주소에 지금 시각(?v=Date.now)을 안 붙인다', !/(tide|current)\.json\?v=' ?\+ ?Date\.now|hc-eot20\.txt\?v=/.test(src));
T('특보(kr.json)는 지금처럼 매번 새로 (no-store)', /kr\.json[^\n]{0,80}no-store|no-store[^\n]{0,80}kr\.json/.test(src));
{
  const sw = fs.readFileSync(path.join(path.dirname(FILE), 'sw.js'), 'utf8');
  T('서비스워커가 no-cache 요청을 가로채지 않는다 (브라우저가 꼬리표로 묻게)', /e\.request\.cache === 'no-cache'/.test(sw));
  T('서비스워커가 물때·조류·조석 모형 파일을 자기 저장소에 안 담는다', /tide\|current\|tide-\[a-z\]\+\)\\\.json\$\|\\\/hc-eot20\\\.txt\$/.test(sw));
}

console.log('\n' + ok + ' 통과 · ' + bad + ' 실패');
process.exit(bad ? 1 : 0);
