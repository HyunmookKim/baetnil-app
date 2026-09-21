// 부품 사용기 — 광고가 제일 먼저 들어오는 자리 (STEP 5)
//
// ★ 이 검사가 지키는 것 셋
//   ① 사용기가 글판과 섞이지 않는다 (광고를 한 우리 안에 가둔다)
//   ② 광고 글을 막지 않고 「덜 채운 것」 으로 아래로 내린다 — 막으면 진짜 사용기도 막힌다
//   ③ 산 값과 메모와 창고 자리는 사람이 켜지 않는 한 안 나간다
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

// ── ① 저장 칸이 네 목록에 다 들어갔는가 (하나만 빠져도 조용히 사라진다)
['BOAT_DATA','SYNC_COLLS','CO','colls'].forEach(nm => {
  const m = src.match(new RegExp('const ' + nm + ' = \\[[\\s\\S]*?\\];'));
  T('★★ ' + nm + ' 에 reviews 가 있다', !!m && /'reviews'/.test(m[0]), m && m[0].slice(0,200));
});
T('★★ 동기화가 실제로 이 배열을 집는다 (localColl)', /case 'reviews':\s*return reviews;/.test(src));
T('★★ 올릴 때도 실린다 (setRV/delRV)', /setRV/.test(src) && /'set','reviews'/.test(src));
T('★★ 못 올렸으면 기준값을 안 갱신한다', /if\(ok\('reviews'\)\)/.test(src));
T('★★ 백업에 들어간다', /reviews:reviews/.test(src));
T('★★ 복원에서 되살아난다', /Array\.isArray\(data\.reviews\)/.test(src));
T('★ 배를 지우면 같이 지워진다', /'reviews'/.test((src.match(/const BOAT_DATA = \[[\s\S]*?\];/)||[''])[0]));
T('★ 권한은 정비 쪽을 따른다', /reviews:'maint'/.test(src));
// ★ 4.13x — 사람에게 보이는 이름이 「부품 사용기」 → 「제품 리뷰」 로 바뀌었다.
T('★ 사람에게 보일 이름이 있다', /reviews:t\('제품 리뷰'\)/.test(src));

// ── ② 채움 점수 — 광고 글이 아래로 간다
const FULL = grab('rvFull'), PRICE = grab('rvPrice'), STAR = grab('rvStarText');
T('★ 채움 세는 곳이 있다 (rvFull)', !!FULL);
if(FULL){
  const F = new Function(`${FULL} return rvFull;`)();
  const ad   = { stars:5, used:'', text:'정말 좋습니다 강추합니다', bad:'', photos:[] };
  const real = { stars:4, used:'y3', photos:['x'],
                 text:'세 시즌 썼는데 아직 멀쩡하다. 손으로 밀어 넣기 뻑뻑했다.',
                 bad:'정품이라 값이 좀 있다' };
  T('★★ 광고 같은 글은 점수가 낮다', F(ad) <= 2, F(ad));
  T('★★ 진짜 사용기는 점수가 높다', F(real) === 5, F(real));
  T('★★ 아쉬운 점이 점수에 든다 (광고 글에는 없는 칸)',
    F({ ...real, bad:'' }) === 4, F({ ...real, bad:'' }));
  T('★★ 짧은 한 줄은 「써 보니」 로 안 쳐 준다',
    F({ stars:5, used:'y3', text:'좋아요', bad:'', photos:[] }) === 2,
    F({ stars:5, used:'y3', text:'좋아요', bad:'', photos:[] }));
  T('빈 사용기는 0 이다', F({ stars:0, used:'', text:'', bad:'', photos:[] }) === 0);
}
T('★★ 잘 채운 것이 목록 위로 온다', /rvFull\(b\) - rvFull\(a\)/.test(grab('renderReviews')||''));
T('★★ 막지 않고 자리만 내린다 (덜 채웠다고 못 쓰게 하지 않는다)',
  !/rvFull\([^)]*\)\s*<[^&|]*\)\s*\{\s*(tell|return false)/.test(src));

// ── ③ 산 값은 숫자만
if(PRICE){
  const P = new Function(`${PRICE} return rvPrice;`)();
  T('★★ 「50만원쯤」 은 안 받는다', P('50만원쯤') === null);
  T('★ 쉼표는 받아 준다', P('1,250,000') === 1250000);
  T('★ 앞뒤 빈칸도 받아 준다', P('  32000 ') === 32000);
  T('빈 칸은 없는 것', P('') === null && P(null) === null);
  T('음수는 안 받는다', P('-100') === null);
}
const SP = grab('rvSetPrice');
T('★ 값 넣는 문이 하나다 (rvSetPrice)', !!SP);
T('★★ 글자를 넣으면 말해 주고 안 담는다', /숫자만 넣어 주세요/.test(SP||''), (SP||'').slice(0,300));
T('★★ 담을 때는 다듬은 숫자로 담는다 (보이는 것과 담긴 것이 같다)',
  /it\.price = raw \? String\(rvPrice\(raw\)\)/.test(SP||''), (SP||'').slice(0,400));

// ── ④ 별점
if(STAR){
  const S = new Function(`const RV_STARS = 5; ${STAR} return rvStarText;`)();
  T('★ 별 다섯이 다 찬다', S(5) === '★★★★★');
  T('★ 셋이면 셋만 찬다', S(3) === '★★★☆☆');
  T('넘겨도 다섯을 안 넘는다', S(9) === '★★★★★');
  T('빈 것도 안 터진다', S(null) === '☆☆☆☆☆' && S(0) === '☆☆☆☆☆');
}

// ── ⑤ 장비에서 바로 쓰기 — 다시 치게 하면 안 쓴다
const AFG = grab('addReviewForGear');
T('★ 장비에서 바로 쓰는 곳이 있다 (addReviewForGear)', !!AFG);
if(AFG){
  T('★★ 제조사·모델을 물려받는다 (다시 치면 열쇠가 어긋나 딴 칸이 된다)',
    /maker:g\.maker/.test(AFG) && /model:g\.model/.test(AFG), AFG);
  T('★ 종류·계통도 물려받는다', /kind:g\.kind/.test(AFG) && /sys:g\.sys/.test(AFG));
  T('★ 어느 장비 것인지 남긴다', /gearId:String\(g\.id\)/.test(AFG));
}
// ★ 이름만 「이 장비의 리뷰」 로 바뀌었다. 모아 오는 문(rvForGear)은 그대로다.
T('★ 장비 카드에 사용기가 모인다',
  /hung\('이 장비의 리뷰', rvForGear\(it\.id\)/.test(src));
T('★ 그 장비 것만 골라 온다 (rvForGear)',
  /function rvForGear\(id\)\{ return rvRows\(\)\.filter\(r => String\(r\.gearId \|\| ''\) === String\(id\)\); \}/.test(src));
T('★ 장비 카드에서 사용기를 쓸 수 있다', /addReviewForGear\(/.test(src));

// ── ⑥ 화면
T('★ 배 탭 장비 화면에 두 갈래가 있다', /id="gearTabG"/.test(src) && /id="gearTabR"/.test(src));
T('★★ 그리는 곳이 하나다 (두 곳에서 그리면 단추와 화면이 어긋난다)', !!grab('renderGearWrap'));
T('★★ 탭을 옮기면 그 한 곳을 부른다', /boatSubTab==='gear'\)\s*renderGearWrap\(\)/.test(src));
T('★ 고치면 화면이 다시 그려진다', /kind==='gear' \|\| kind==='review'\)\s*renderGearWrap\(\)/.test(src));
T('★ 창 제목이 있다', /review:t\('제품 리뷰'\)/.test(src));
T('★ 사진을 붙일 수 있다', /kind==='review'/.test((src.match(/const hasPhotos = [^\n]*/)||[''])[0]));
T('★ 휴지통에서 되살아난다', /e\.kind==='review'\) reviews\.push/.test(src));
T('★ 기록 찾기에 등록돼 있다', /review:\(\)=>reviews/.test(src));

// ── ⑦ 없을 때 안내
const RR = grab('renderReviews');
T('★ 하나도 없을 때 왜 쓰는지 말해 준다', /emptybox/.test(RR||''));
T('★★ 보기 전용에서도 첫 사용기 단추가 사라지지 않는다', /needEdit\(/.test(RR||''));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
