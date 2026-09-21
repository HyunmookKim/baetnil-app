// 예비품 최소 수량 — 바다에서 예비품이 없으면 그걸로 끝이다
//
// ★ 왜 (4.53)
//   적재표는 수량을 센다. 그런데 기준선이 없다.
//   임펠러가 0개인 것과 3개인 것을 앱이 구분하지 않는다.
//   SeaHub 재고 모듈의 핵심이 「최소 수량 밑으로 떨어지면 알린다」 이고,
//   적재표는 우리가 남보다 앞선 자리라 여기를 더 깊게 파는 편이 낫다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

const NUM = grab('stockNum'), LOW = grab('stockLow');
T('★ 수량을 숫자로 읽는 곳이 있다 (stockNum)', !!NUM);
T('★ 모자란 물품을 골라내는 곳이 있다 (stockLow)', !!LOW);

if(NUM && LOW){
  const F = new Function(`${NUM}\n${LOW}\nreturn { stockNum, stockLow };`)();
  const { stockNum, stockLow } = F;

  // ── 수량 읽기 — 적재표 수량은 글자다. 「2+3」 처럼 합친 것도 들어 있다.
  T('숫자는 숫자로 읽는다', stockNum({qty:'3'}) === 3, stockNum({qty:'3'}));
  T('소수도 읽는다', stockNum({qty:'1.5'}) === 1.5, stockNum({qty:'1.5'}));
  T('★ 0 도 0 으로 읽는다 (없는 것이 제일 중요하다)', stockNum({qty:'0'}) === 0, stockNum({qty:'0'}));
  T('★★ 합쳐서 「2+3」 이 된 것은 숫자가 아니라고 본다 (억지로 맞히지 않는다)',
    stockNum({qty:'2+3'}) === null, stockNum({qty:'2+3'}));
  T('빈 것·글자는 숫자가 아니다',
    stockNum({qty:''}) === null && stockNum({qty:'약간'}) === null && stockNum({}) === null,
    [stockNum({qty:''}), stockNum({qty:'약간'}), stockNum({})]);

  // ── 모자란 것 고르기
  // ★ 일부러 「아예 없는 것」을 뒤에 둔다 — 줄 세우기가 진짜 도는지 보려면 그래야 한다
  const list = [
    { id:'b', name:'연료필터', qty:'1', min:2 },
    { id:'a', name:'임펠러',   qty:'0', min:1 },
    { id:'c', name:'오일',     qty:'5', min:2 },   // 넉넉하다
    { id:'d', name:'로프',     qty:'2' },          // 기준선을 안 정했다
    { id:'e', name:'페인트',   qty:'약간', min:1 },// 숫자가 아니다
    { id:'f', name:'딱맞음',   qty:'2', min:2 },   // 딱 맞으면 모자란 것이 아니다
    { id:'g', name:'영기준',   qty:'0', min:0 },   // 기준선 0 = 안 정한 것이다
  ];
  const r = stockLow(list);
  T('★★ 기준선 밑으로 떨어진 것만 고른다', r.length === 2, r.map(x=>x.id));
  T('★ 아예 없는 것(0개)이 먼저 온다', r[0] && r[0].id === 'a', r.map(x=>x.id));
  T('기준선을 안 정한 물품은 안 낀다', !r.some(x=>x.id==='d'), r.map(x=>x.id));
  T('★ 수량이 글자면 안 낀다 (거짓 경보를 안 낸다)', !r.some(x=>x.id==='e'), r.map(x=>x.id));
  T('★ 딱 맞으면 모자란 것이 아니다', !r.some(x=>x.id==='f'), r.map(x=>x.id));
  T('★★ 기준선을 0 으로 둔 것은 안 정한 것이다 (0개라고 알리지 않는다)',
    !r.some(x=>x.id==='g'), r.map(x=>x.id));
  T('넉넉한 것은 안 낀다', !r.some(x=>x.id==='c'), r.map(x=>x.id));
  T('★ 얼마나 모자란지 같이 준다', r[0] && r[0].short === 1, r[0]);
  T('빈 목록도 안 터진다', stockLow([]).length === 0 && stockLow(null).length === 0);
}

// ── 화면
T('★ 물품 입력 칸에 「적어도」 가 있다', /id="fMin"/.test(src));
T('★ 저장할 때 그 값을 담는다', /getElementById\('fMin'\)/.test(src));
T('★ 고치기로 열면 그 값이 들어가 있다',
  /fMin'\)\.value\s*=/.test(src), (src.match(/fMin'\)\.value[^\n]*/g)||[]).join(' / '));
T('★★ 오늘 화면에 「채워야 할 것」 카드가 있다', /채워야 할 것/.test(src));
T('★ 적재표 목록에서도 모자란 것이 보인다',
  /stockLow\(|stockShort\(/.test(src.slice(src.indexOf('function renderList'))));
// ★ 옛 자료가 안 깨진다 — min 은 없을 수 있다
T('★ 기준선은 필수가 아니다 (옛 물품 357개가 그대로 열린다)',
  !/min\s*:\s*1\s*,/.test(grab('addItem') || ''));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
