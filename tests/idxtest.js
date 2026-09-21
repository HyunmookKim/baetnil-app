// 찾아 들어오는 문 다섯 개 · 밖으로 나가면 안 되는 것 (STEP 5)
//
// ★ 이 검사가 지키는 것
//   「임펠러 A-3 좋다」는 나가고 「갤리 서랍3에 있다」는 안 나간다.
//   이 한 줄이 자동차 앱과 배 앱이 갈라지는 자리다. 배는 물건 있는 자리가 곧 배 구조다.
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
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };

// ── ① 나가는 사용기 한 건
const PUB = grab('rvPublic');
T('★ 밖으로 나가는 문이 하나다 (rvPublic)', !!PUB);
if(PUB){
  const env = `
    const t = x => x; const tsub = (x,o) => x;
    const PROD_ALIAS = {};
    const isBoatRv = x => !!(x && x.typ === 'boat');
    const PUB_LEVELS = [{k:'com'},{k:'boat'},{k:'none'}];
    ${(src.match(/const PUB_OUT = \{[\s\S]*?\n\};/)||[''])[0]}
    ${grab('pubPlain')}
    ${grab('pubLvOf')}
    const rvLv = r => pubLvOf(r, 'com');
    ${grab('prodNorm')} ${grab('prodMaker')} ${grab('prodKey')} ${grab('prodTitle')}
    ${grab('rvKey')} ${grab('rvTitle')} ${grab('rvFull')} ${grab('rvPrice')}
    ${PUB}
    return rvPublic;`;
  const F = new Function(env)();
  const R = { id:'v1', sys:'추진', kind:'임펠러', maker:'Jabsco', model:'1210-0001',
    stars:4, again:true, used:'y3', price:'32000', cur:'원', bought:'2024-05-02',
    text:'세 시즌 썼는데 아직 멀쩡하다. 비눗물 조금 발랐다.', bad:'값이 좀 있다',
    note:'갤리 서랍3 맨 아래. 김선장 010-1234-5678',
    photos:[], gearId:'g1', itemId:'77', pubPrice:false, date:'2026-08-01' };
  const o = F(R);
  const js = JSON.stringify(o);

  T('★★ 제품이 나간다 (이게 없으면 아무도 못 만난다)',
    o.maker === 'Jabsco' && o.model === '1210-0001' && !!o.key, o);
  T('★ 별점·또 살까·써 본 기간이 나간다', o.stars === 4 && o.again === true && o.used === 'y3');
  T('★ 써 보니 · 아쉬운 점이 나간다', /멀쩡/.test(o.text) && /값이/.test(o.bad));
  // ★ 4.73 — 메모가 나간다 (사장님이 정하신 것 — 「사람들 보라고 메모 쓰는 건데」).
  //   앱이 임의로 막지 않는다. 무엇을 적을지는 쓰는 사람이 정하고,
  //   앱은 「나간다」 고 화면에서 미리 말한다.
  T('★★★ 메모가 나간다 (남 보라고 쓴 것이다)', ('note' in o) && !!o.note, o.note);
  T('★★★ 어느 장비 것인지 안 나간다 (나가면 장비 공개 스위치를 우회한다)',
    !('gearId' in o) && !/g1/.test(js));
  T('★★★ 어느 부품인지 안 나간다', !('itemId' in o) && !/"77"/.test(js));
  T('★★ 산 값은 안 켰으면 안 나간다', !('price' in o) && !/32000/.test(js), js.slice(0,240));
  T('★★ 산 날짜도 값을 안 켰으면 안 나간다', !('bought' in o) && !/2024-05-02/.test(js));

  const o2 = F({ ...R, pubPrice:true });
  T('★★ 값을 켜면 나간다', o2.price === 32000 && o2.cur === '원');
  T('★★ 켜도 숫자로 다듬어 나간다 (글자가 그대로 새지 않는다)', typeof o2.price === 'number');
  const o3 = F({ ...R, pubPrice:true, price:'50만원쯤' });
  T('★★ 값이 숫자가 아니면 켜도 안 나간다', !('price' in o3), o3);

  T('★ 채움 점수도 함께 나간다 (밖에서 줄 세울 때 쓴다)', typeof o.full === 'number');
  T('빈 것을 넣어도 안 터진다', F(null) === null && !!F({ id:'x' }));
}
// ★ 4.72 — 「비공개」 사용기는 아예 안 담는다. 그 앞을 지나 rvPublic 하나로만 나간다.
T('★★ 공개 자료에 사용기가 이 문으로만 실린다',
  /o\.review = rvRows\(\)\.filter\(r => rvLv\(r\) !== 'none'\)[\s\S]{0,60}?\.map\(r => rvPublic\(r\)\)/.test(src),
  (src.match(/o\.review = [\s\S]{0,140}/)||[''])[0]);
T('★★ 사용기 공개는 따로 켜야 한다', /if\(pubOn\(b,'review'\)\)/.test(src));
T('★ 공개 설정에 사용기 스위치가 있다', /k:'review'/.test(src));
T('★★ 산 값이 따로라는 것을 스위치 설명에 적어 두었다',
  /산 값은 리뷰마다 따로 켤 수 있음/.test(src));

// ── ② 문 다섯 개
const KEYS = grab('idxKeys'), MINE = grab('idxMine'), FIND = grab('partsFind'),
      DOORS = grab('partsDoors'), MPK = grab('myProdKeys'), MK = grab('myKinds');
['idxKeys','myProdKeys','myKinds','idxMine','partsFind','partsDoors'].forEach((n,i) =>
  T('★ ' + n + ' 가 있다', !!grab(n)));
if(KEYS && MINE && FIND && DOORS && MPK && MK){
  const env = `
    const PROD_ALIAS = {};
    ${grab('prodNorm')} ${grab('prodMaker')} ${grab('prodKey')}
    let GEARS = [];
    const gearRows = () => GEARS;
    ${KEYS} ${MPK} ${MK} ${MINE} ${FIND} ${DOORS}
    return { set:g => { GEARS = g; }, idxKeys, idxMine, partsFind, partsDoors, prodKey };`;
  const F = new Function(env)();
  // 내 배: 얀마 엔진(모델 있음) + 윈치(모델 없음)
  F.set([ { id:'g1', maker:'Yanmar', model:'4JH4E', kind:'엔진', sys:'추진' },
          { id:'g2', maker:'', model:'', kind:'윈치', sys:'갑판장비' } ]);
  const rows = [
    { id:1, maker:'YANMAR', model:'4jh-4e', kind:'엔진',   sys:'추진' },      // 같은 제품
    { id:2, maker:'Lewmar', model:'40ST',   kind:'윈치',   sys:'갑판장비' },  // 같은 종류
    { id:3, maker:'Racor',  model:'500FG',  kind:'연료필터', sys:'연료' },     // 안 겹침
    { id:4, maker:'',       model:'',       kind:'엔진',   sys:'추진' }       // 종류만
  ];
  T('★★★ 적는 법이 달라도 같은 제품 문으로 들어온다',
    F.partsFind(rows, { prod: F.prodKey('Yanmar','4JH4E') }).map(x=>x.id).join() === '1',
    F.partsFind(rows, { prod: F.prodKey('Yanmar','4JH4E') }).map(x=>x.id));
  T('★★ 종류 문 — 모델을 몰라도 걸린다',
    F.partsFind(rows, { kind:'엔진' }).map(x=>x.id).join() === '1,4');
  T('★★ 계통 문 — 초보가 들어오는 문',
    F.partsFind(rows, { sys:'추진' }).map(x=>x.id).join() === '1,4');
  T('★★★ 내 배와 겹치는 문 — 제품이 같으면 걸린다',
    F.partsFind(rows, { mine:true }).some(x => x.id === 1));
  T('★★★ 내 배와 겹치는 문 — 모델을 안 적은 내 장비도 종류로 걸린다 (안 그러면 문이 반쯤 닫힌다)',
    F.partsFind(rows, { mine:true }).some(x => x.id === 2),
    F.partsFind(rows, { mine:true }).map(x=>x.id));
  T('★★ 안 겹치는 것은 안 걸린다', !F.partsFind(rows, { mine:true }).some(x => x.id === 3));
  T('★★ 거르는 조건이 없으면 전부 (빈 화면은 고장으로 보인다)',
    F.partsFind(rows, {}).length === 4 && F.partsFind(rows, null).length === 4);
  T('빈 목록도 안 터진다', F.partsFind(null, { mine:true }).length === 0);

  const d = F.partsDoors(rows);
  T('★ 문마다 몇 건인지 센다', d.all === 4 && d.mine === 3, d);
  T('★ 많이 걸리는 문이 앞에 온다', d.kind[0].n >= d.kind[d.kind.length-1].n, d.kind);
  T('★★ 모델 없는 것은 제품 문을 안 만든다 (빈 칸이 늘어서지 않는다)',
    d.prod.every(x => !!x.k), d.prod);
}

// ── ③ 색인은 저장하지 않는다
T('★★ 색인을 따로 담아 두지 않는다 (담으면 장비를 고쳤을 때 옛것이 남는다)',
  !/localStorage\.setItem\(['"]bt_(idx|index|prodidx)/.test(src));
T('★ 화면에서 문으로 거른다', /partsFind\(rows, rvDoor\)/.test(src));
T('★★ 화면을 떠나면 거르개를 안 남긴다', /let rvDoor = \{ \};/.test(src));
T('★★ 문 이름을 한 줄에 세우고 누른 것만 펼친다 (찾는 길이 찾는 것을 가리면 안 된다)',
  /let rvOpen = ''/.test(src) && /function rvDoorOpen\(/.test(src));
T('★ 「전체」 를 누르면 펼친 것도 접힌다', /if\(!k\) rvOpen = ''/.test(src));
T('★ 값이 많으면 여덟 개까지만 보이고 나머지는 수로 알려 준다', /slice\(0, 8\)/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
