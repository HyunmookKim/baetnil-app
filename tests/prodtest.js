// 전 세계 공용 제품 카탈로그 — 열쇠 하나가 수천 명을 모으거나 흩는다 (STEP 5)
//
// ★ 이 검사가 지키는 것
//   「Yanmar 4JH4E」 를 쓰는 사람이 수천 명인데, 적는 법이 조금씩 달라서
//   칸이 수천 개로 갈라지면 이 기능은 있으나 마나다.
//   반대로 과하게 합쳐서 Axiom 과 Axiom+ 가 한 칸이 되는 것은 훨씬 가벼운 잘못이다.
//   그래서 「붙이는 쪽으로 기울되, 뜻이 있는 기호는 남긴다」 를 못 박는다.
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

const ALIAS = (src.match(/const PROD_ALIAS = \{[\s\S]*?\n\};/) || [''])[0];
const NORM = grab('prodNorm'), MK = grab('prodMaker'), KEY = grab('prodKey'),
      TITLE = grab('prodTitle'), CAT = grab('prodCatalog');
T('★ 글자 다듬는 곳이 있다 (prodNorm)', !!NORM);
T('★ 제조사 열쇠가 있다 (prodMaker)', !!MK);
T('★ 제품 열쇠가 있다 (prodKey)', !!KEY);
T('★ 보이는 이름이 따로 있다 (prodTitle)', !!TITLE);
T('★ 카탈로그를 뽑는 곳이 있다 (prodCatalog)', !!CAT);
if(!(NORM && MK && KEY && TITLE)){ console.log('\n합계: '+ok+'개 통과 / '+(bad||1)+'개 실패'); process.exit(1); }

const F = new Function(`${ALIAS} ${NORM} ${MK} ${KEY} ${TITLE}
  return { prodNorm, prodMaker, prodKey, prodTitle };`)();
const K = (a,b) => F.prodKey(a,b);

// ── ① 같은 물건은 반드시 한 칸 (덜 합치면 이 기능이 죽는다)
const same = [
  ['대소문자',        ['Yanmar','4JH4E'], ['YANMAR','4jh4e']],
  ['하이픈',          ['Yanmar','4JH4E'], ['Yanmar','4JH-4E']],
  ['빈칸',            ['Yanmar','4JH4E'], ['Yanmar',' 4JH 4E ']],
  ['점',              ['Racor','500FG'],  ['Racor','500.FG']],
  ['제조사 빈칸',     ['Volvo Penta','MD2020'], ['VolvoPenta','MD 2020']],
  ['전각 글자(일본)', ['Yanmar','4JH4E'], ['Ｙａｎｍａｒ','４ＪＨ４Ｅ']],
  ['악센트',          ['Eberspacher','D4'], ['Eberspächer','D4']],
  ['앞뒤 빈칸',       ['Lewmar','40ST'],  ['  Lewmar  ','40ST  ']],
  ['슬래시',          ['Vetus','BOW95'],  ['Vetus','BOW/95']]
];
same.forEach(([nm,a,b]) => T('★★ 같은 칸이 된다 — ' + nm, K(...a) === K(...b), [K(...a), K(...b)]));
T('★★ 배에서 「볼보」 는 볼보펜타다 (별칭)', K('Volvo','MD2020') === K('Volvo Penta','MD2020'),
  [K('Volvo','MD2020'), K('Volvo Penta','MD2020')]);

// ── ② 다른 물건은 반드시 다른 칸
const diff = [
  ['모델 번호',   ['Raymarine','Axiom 9'],  ['Raymarine','Axiom 12']],
  ['플러스 모델', ['Raymarine','Axiom 9'],  ['Raymarine','Axiom+ 9']],
  ['제조사',      ['Yanmar','4JH4E'],       ['Nanni','4JH4E']],
  ['비슷한 모델', ['Racor','500FG'],        ['Racor','900FG']]
];
diff.forEach(([nm,a,b]) => T('★★ 다른 칸이다 — ' + nm, K(...a) !== K(...b), [K(...a), K(...b)]));

// ── ③ 모델이 없으면 제품이 아니다
T('★★ 모델을 안 적으면 열쇠가 없다 (종류·계통 문은 그대로 열린다)', K('Yanmar','') === '');
T('빈 칸만 쳐도 열쇠가 없다', K('Yanmar','   ') === '');
T('아무것도 안 넣어도 안 터진다', K('','') === '' && K(null, undefined) === '');
T('★ 제조사를 안 적어도 모델로는 모인다', K('','4JH4E') === K(null,'4JH4E') && K('','4JH4E').length > 1,
  K('','4JH4E'));
T('★★ 제조사 없는 것이 제조사 있는 것과 안 섞인다', K('','4JH4E') !== K('Yanmar','4JH4E'));

// ── ④ 한글·일본어도 열쇠가 된다 (일본 진출 대비)
T('★ 한글 제품명도 열쇠가 된다', K('현대','씨호크 300').length > 2, K('현대','씨호크 300'));
T('★★ 한글은 빈칸만 다른 것을 같은 칸으로 본다',
  K('현대','씨호크 300') === K('현대','씨호크300'));
T('★ 일본어 반각·전각 가나가 같은 칸이 된다',
  K('ﾔﾝﾏｰ','4JH4E') === K('ヤンマー','4JH4E'), [K('ﾔﾝﾏｰ','4JH4E'), K('ヤンマー','4JH4E')]);

// ── ⑤ 보이는 이름은 사람이 쓴 그대로
T('★ 보이는 이름은 안 뭉갠다', F.prodTitle('Yanmar','4JH4E') === 'Yanmar 4JH4E');
T('★ 빈칸만 정리한다', F.prodTitle('  Volvo   Penta ','  MD 2020 ') === 'Volvo Penta MD 2020');
T('제조사만 있어도 이름이 선다', F.prodTitle('Yanmar','') === 'Yanmar');
T('모델만 있어도 이름이 선다', F.prodTitle('','4JH4E') === '4JH4E');

// ── ⑥ 카탈로그는 따로 저장하지 않는다 (저장하면 조용히 옛것이 된다)
T('★★ 카탈로그를 그때그때 뽑는다 (장비에서)', /gearRows\(\)/.test(CAT||''), (CAT||'').slice(0,300));
T('★★ 사용기도 같은 칸에 모인다', /review/.test(CAT||''));
T('★ 별점 평균을 낸다', /avg/.test(CAT||''));
T('★★ 같은 제품인데 종류를 다르게 적었으면 많이 쓴 쪽을 따른다', /top\(/.test(CAT||''));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
