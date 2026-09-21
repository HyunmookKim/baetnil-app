// 날씨 기준 판정 검증 — 배별로 정한 한계와 지금 날씨를 견준다
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
globalThis.alert = ()=>{};
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
// ★ 경고 글이 이제 사전을 거친다 (영어에서 한국어가 새던 것을 고쳤다)
globalThis.t = x => x;
globalThis.tsub = (k,v) => String(k).replace(/\{(\w+)\}/g, (_,n)=>v[n]);
globalThis.SPEC = {};
globalThis.boatSpec = k => globalThis.SPEC[k] || 0;
globalThis.BT = 'sail';
globalThis.boatType = () => globalThis.BT;

const need = ['wxWarnings','reefStage'];
const missing = need.filter(f => !grab(src, f));
if(missing.length){
  console.log('★ 함수가 없습니다: ' + missing.join(', '));
  console.log('\n합계: 0개 통과 / ' + missing.length + '개 실패');
  process.exit(1);
}
for(const f of need){ eval('globalThis.'+f+' = '+grab(src,f)); }

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };
const reset = ()=>{ globalThis.SPEC = {}; globalThis.BT = 'sail'; };

// 리프 단계
reset();
SPEC = { reef1:16, reef2:22, reef3:28 };
T('약한 바람은 리프 없음', reefStage(10)===0);
T('1단', reefStage(17)===1);
T('경계값도 잡는다', reefStage(16)===1);
T('2단', reefStage(24)===2);
T('3단', reefStage(30)===3);
T('기준이 없으면 판단 안 함', (()=>{ SPEC={}; return reefStage(30)===null; })());
T('3단이 없어도 2단까지는 본다',
  (()=>{ SPEC={reef1:16, reef2:22}; return reefStage(30)===2; })());

// 경고
reset();
SPEC = { maxWind:25, maxGust:30, maxWave:1.5, maxPeriod:5, minVis:2 };
let w = wxWarnings({ wind:30, gust:35, wave:2.0, period:4, vis:1 });
T('풍속 초과를 알린다', w.some(x=>/풍속/.test(x.text)));
T('돌풍 초과를 알린다', w.some(x=>/돌풍/.test(x.text)));
T('파고 초과를 알린다', w.some(x=>/파고/.test(x.text)));
T('짧은 주기를 알린다', w.some(x=>/주기/.test(x.text)));
T('나쁜 시정을 알린다', w.some(x=>/시정/.test(x.text)));
T('경고에 심각도가 있다', w.every(x=>x.level));

w = wxWarnings({ wind:10, gust:12, wave:0.5, period:8, vis:10 });
T('괜찮으면 경고가 없다', w.length===0);

// 기준을 안 넣었으면 판단하지 않는다
reset();
w = wxWarnings({ wind:40, gust:50, wave:5 });
T('기준이 없으면 경고하지 않는다', w.length===0);

// 값이 없으면 그 항목은 건너뛴다
reset();
SPEC = { maxWind:25, maxWave:1.5 };
w = wxWarnings({ wind:30 });
T('없는 값은 건너뛴다', w.length===1 && /풍속/.test(w[0].text));

// 선종에 안 맞는 항목은 안 본다
reset();
BT = 'fishing';
SPEC = { reef1:16 };
T('낚싯배에는 리프 판단을 하지 않는다', reefStage(30)===null);


// ── 기본값 자동 계산
{
  const g = grab(src, 'suggestWxLimits');
  if(!g){ console.log('★ 실패: suggestWxLimits 가 없습니다'); fail++; }
  else {
    eval('globalThis.suggestWxLimits = ' + g);
    // 13.7m 세일링 요트
    let d = suggestWxLimits({ type:'sail', spec:{ loa:13.7 } });
    T('세일링 요트에 한계값이 나온다', d && d.maxWind > 0 && d.maxWave > 0);
    T('리프 단계도 나온다', d.reef1 > 0 && d.reef2 > d.reef1);
    T('돌풍 한계는 풍속보다 높다', d.maxGust > d.maxWind);
    T('2단은 1단보다 세다', d.reef2 > d.reef1 && d.reef3 > d.reef2);

    // 작은 배는 한계가 낮다
    const small = suggestWxLimits({ type:'sail', spec:{ loa:7 } });
    T('작은 배는 한계 풍속이 더 낮다', small.maxWind < d.maxWind);
    T('작은 배는 한계 파고도 더 낮다', small.maxWave < d.maxWave);

    // 낚싯배에는 리프가 없다
    const f = suggestWxLimits({ type:'fishing', spec:{ loa:9 } });
    T('낚싯배에는 리프 값이 없다', !f.reef1);
    T('낚싯배에도 풍속·파고 한계는 있다', f.maxWind > 0 && f.maxWave > 0);

    // 길이를 모르면 선종 기본값으로
    const noLoa = suggestWxLimits({ type:'power', spec:{} });
    T('길이를 몰라도 값이 나온다', noLoa.maxWind > 0);

    T('배가 없으면 null', suggestWxLimits(null)===null);
  }
}
console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
