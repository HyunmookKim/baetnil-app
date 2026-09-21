// 커뮤니티 둘러보기 — 남의 배가 내놓은 기록 세 갈래 (STEP 6)
//
// ★ 이 검사가 지키는 것
//   ① 하위 탭은 다섯을 넘지 않는다 (좁은 폰에서 여섯이면 밀어야만 보인다 — 사장님 지적)
//   ② 갈래를 바꿔도 자료를 다시 안 받는다 (공개 배 하나에 셋이 다 들어 있다)
//   ③ 절차를 안 적은 정비는 목록에 안 나온다 — 한 줄짜리 기록은 남이 볼 까닭이 없다
//   ④ 목록에서 누르면 그 기록 자리로 바로 간다
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

// ── ① 탭 개수 (4.58 그대로 — 옮긴 것은 전부 되돌렸다)
const CS = (src.match(/const COMSUB_TITLES = \{[^\n]*\};/) || [''])[0];
T('★ 커뮤니티 하위 탭 이름이 있다', !!CS);
const nTab = (CS.match(/[a-z]+:t\(/g) || []).length;
T('★★ 하위 탭이 다섯을 안 넘는다', nTab <= 5, nTab);
T('★★ 커뮤니티는 넷 그대로다 — 정박지·장터·배 둘러보기가 제자리다',
  /spots:t\('정박지'\)/.test(CS) && /market:t\('중고 장터'\)/.test(CS)
  && /explore:t\('배 둘러보기'\)/.test(CS), CS);
T('★★ 뉴스만 「오늘」 탭으로 갔다',
  /HOMESUB_TITLES = \{[^\n]*news:t\('뉴스'\)/.test(src) && !/news:t\('뉴스'\)/.test(CS));
// ── 「남의 배」 탭 — 네 갈래
const OS = (src.match(/const OTHERSUB_TITLES = \{[^\n]*\};/) || [''])[0];
T('★ 「남의 배」 갈래 이름이 있다', !!OS);
[['voyage','항해일지'],['maint','정비수첩'],['review','제품리뷰'],['boatrv','배리뷰']].forEach(([k,n])=>
  T('★ 갈래에 ' + n + ' 가 있다', new RegExp(k + ":t\\('" + n + "'\\)").test(OS), OS));
T('★★ 항해일지가 맨 앞이다 (「여수 개도 정박」 검색이 「Yanmar 임펠러」보다 훨씬 많다)',
  OS.indexOf("voyage:") < OS.indexOf("maint:") && OS.indexOf("maint:") < OS.indexOf("review:"), OS);
T('★★★ 제품 리뷰와 배 리뷰를 갈라 놓았다 (민카라 パーツレビュー / クルマレビュー)',
  /const isBoatRv/.test(src) && /wantBoat/.test(src));
T('★ 배 리뷰는 내 배의 제조사·모델·연식을 물려받는다',
  /typ:'boat', maker:\(b && b\.maker\)/.test(src));
T('★★ 밖으로 나갈 때 어느 쪽 리뷰인지 함께 나간다', /typ:  isBoatRv\(r\)/.test(src));

// ── ② 갈래를 바꿔도 다시 안 받는다
const OE = grab('openExplore') || '';
T('★★ 갈래를 바꿔도 자료를 다시 안 받는다 (한 번 받은 것을 나눠 쓴다)',
  (OE.match(/__pub\.list/g) || []).length === 1 && /listFresh\(ck\)/.test(OE), OE.slice(0,400));
T('★ 갈래마다 찾는 말이 다르다', /제품 · 제조사 · 종류로 찾기/.test(OE));
T('★ 「영업」 거르개는 배 갈래에서만 보인다', /kind === 'boat' \?/.test(OE));
T('★★★ 지금 갈래를 두 곳에서 안 가른다 (탭과 내용이 어긋나면 「항해기록 눌렀는데 리뷰가 나온다」)',
  /function expKind\(\)\{ return \(curTab === 'others'\)/.test(src));
T('★★ 기록 세 갈래를 만드는 쪽은 그대로 있다 (붙일 자리만 정해지면 된다)',
  !!grab('expFlat') && !!grab('expRows') && !!grab('expRowsHtml') && !!grab('expOpen'));

// ── ③ 목록 만들기
const FLAT = grab('expFlat'), ROWS = grab('expRows');
T('★ 여러 배 기록을 펴는 곳이 있다 (expFlat)', !!FLAT);
T('★ 갈래별 목록을 만드는 곳이 있다 (expRows)', !!ROWS);
if(FLAT && ROWS){
  const env = `
    const t = x => x; const tsub = (x,o) => x;
    let expSub = 'voyage', expQ = '', curTab = 'others';
    const expKind = () => expSub;
    let EA = [];
    const isAdmin = () => false;
    // ★ 4.81 — 배 이름·매어 둔 곳도 보는 사람 말로 낸다. 여기서는 옮길 것이 없으니
    //   원문을 그대로 돌려주는 자리만 만들어 준다 (찾기가 이 문을 쓴다).
    const boatShowName = b => (b && b.name) || '';
    const boatShowPort = b => (b && b.port) || '';
    Object.defineProperty(globalThis, 'exploreAll', { get: () => EA, configurable:true });
    ${FLAT} ${ROWS}
    return { set:(a,s2,q)=>{ EA=a; expSub=s2; expQ=q||''; }, expRows, expFlat };`;
  const F = new Function(env)();
  const PUB = [
    { id:'b1', name:'여수 SHUNSHINE', port:'여수',
      voyage:[{id:'v1',date:'2026-08-10',title:'개도 한 바퀴'},{id:'v2',date:'2026-07-02',title:''}],
      maint:[{id:'m1',name:'임펠러 교체',grp:'추진',lastDate:'2026-06-01',how:[{v:'가'},{v:'나'},{v:'다'}]},
             {id:'m2',name:'배터리 점검',grp:'전기',lastDate:'2026-05-20'}],
      review:[{id:'r1',title:'Jabsco 1210',maker:'Jabsco',model:'1210',kind:'임펠러',full:4,date:'2026-08-01'}] },
    { id:'b2', name:'통영 바다호', port:'통영', adminHidden:true,
      voyage:[{id:'v9',date:'2026-08-30',title:'감춘 배'}], maint:[], review:[] },
    { id:'b3', name:'부산 갈매기', port:'부산',
      voyage:[{id:'v3',date:'2026-08-15',title:'욕지도'}], maint:[],
      review:[{id:'r2',title:'Racor 500FG',maker:'Racor',model:'500FG',kind:'연료필터',full:5,date:'2026-06-01'}] }
  ];
  F.set(PUB, 'voyage');
  const v = F.expRows();
  T('★★ 여러 배의 항해가 한 목록에 섞여 나온다', v.length === 3, v.map(o=>o.r.id));
  T('★★ 최근 것이 맨 위다', v[0].r.id === 'v3', v.map(o=>o.r.id));
  T('★★★ 운영자가 감춘 배의 기록은 안 나온다', !v.some(o=>o.b.id === 'b2'), v.map(o=>o.b.id));
  T('★ 어느 배 것인지 함께 들고 온다', !!v[0].b.name);

  F.set(PUB, 'maint');
  const m = F.expRows();
  T('★★★ 절차를 안 적은 정비는 안 나온다 (한 줄짜리는 남이 볼 까닭이 없다)',
    m.length === 1 && m[0].r.id === 'm1', m.map(o=>o.r.id));
  T('★ 단계가 많은 것이 위로', m.length === 1);

  F.set(PUB, 'review');
  const r = F.expRows();
  T('★★ 잘 채운 사용기가 위로 (광고 글은 아래로)', r[0].r.id === 'r2', r.map(o=>o.r.id));

  F.set(PUB, 'voyage', '통영');
  T('★★ 찾기가 항구 이름으로도 된다', F.expRows().length === 0, F.expRows().map(o=>o.r.id));
  F.set(PUB, 'voyage', '여수');
  T('★ 찾기가 배 이름·항구로 걸린다', F.expRows().length === 2);
  F.set(PUB, 'review', 'racor');
  T('★ 사용기는 제조사로 찾는다 (대소문자 상관없이)', F.expRows().length === 1);
  F.set([], 'voyage');
  T('빈 목록도 안 터진다', F.expRows().length === 0);
}

// ── ④ 눌러 들어가면 그 자리로
const OP = grab('expOpen'), OBP = grab('openBoatPage');
T('★ 목록에서 여는 곳이 있다 (expOpen)', !!OP);
T('★★ 어느 자리로 갈지 들고 간다', /expJump = \{ sec, id \}/.test(OP||''));
T('★★★ 배 소개부터 보여 주지 않고 그 기록으로 바로 간다 (「알아서 찾아라」 하면 아무도 못 찾는다)',
  /if\(expJump\)/.test(OBP||'') && /boatPageTab = j\.sec/.test(OBP||''), (OBP||'').slice(0,500));
T('★ 항해는 그 항해가 열린다', /j\.sec === 'voyage'\) pubVoyId/.test(OBP||''));
T('★ 정비는 그 절차가 열린다', /j\.sec === 'maint'\)\{/.test(OBP||'') && /pubHowId = String\(j\.id\)/.test(OBP||''));
T('★ 사용기는 그 줄로 굴러간다', /scrollIntoView/.test(OBP||''));
T('★ 한 번 쓰고 버린다 (다음에 배를 열 때 엉뚱한 데로 안 간다)',
  /expJump = null/.test(OBP||''));

// ── ⑤ 남의 배 페이지
// 갈래 이름이 「부품 사용기」 → 「제품 리뷰」 로 바뀌었다 (배 리뷰까지 들어오면서)
T('★ 배 페이지에 제품 리뷰 갈래가 생겼다', /\['review',t\('제품 리뷰'\)\]/.test(src));
T('★★ 정비수첩을 실제로 보여 준다 (전에는 이름과 날짜 한 줄뿐이었다)',
  /pubHowOpen\(/.test(src) && /howstep/.test(grab('pubHowBody')||''));
T('★ 절차가 있는 것만 눌린다', /\$\{n\?` onclick="pubHowOpen/.test(src));
// ★ 4.70 — 옅은 회색 한 줄로 몰아넣던 것을 칸 이름 붙은 줄로 바꿨다 (사장님 지적).
//   「그럼 왜 가격이랑 제품이랑 이런 걸 왜 적냐」 — 적은 것이 보이지 않으면 적을 까닭이 없다.
{
  const H = grab('pubHowBody') || '';
  ['난이도','걸린 시간','든 돈','부품·공구','장비','한 날'].forEach(lbl=>
    T('★★ 공개 정비수첩에 「' + lbl + '」 이 칸 이름을 달고 나온다',
      H.indexOf("'" + lbl + "'") >= 0, lbl));
  T('★★★ 옛 방식(옅은 한 줄)이 안 남아 있다', !/const meta = \[/.test(H), H.slice(0,200));
}
// ★ 4.102 — 탭을 옮기면 열어 둔 절차가 닫히고, **그 걸음이 자국에 남는다**(pubMark).
//   자국을 안 남기면 뒤로 가기가 그 걸음을 건너뛴다 (사장님 지적).
T('★ 갈래를 바꾸면 열어 둔 절차가 닫힌다',
  /boatPageTab = k; pubVoyId = ''; pubHowId = '';[\s\S]{0,80}paintBoatPage\(\)/.test(src));
T('★★ 그 걸음을 자국에 남긴다 (뒤로 가기가 건너뛰지 않게)',
  /paintBoatPage\(\);\s*\n\s*pubMark\(\)/.test(src));
T('★★ 안쪽 제목이 큰 화면에서 안 사라진다 (mrhead 의 b 는 일부러 감춘다)',
  /\.mrsubtit\{/.test(src) && !/class="mrhead"><b>\$\{esc\(pubVoyName/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
