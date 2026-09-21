// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 3.24 — 정박지 수심을 저조위 기준으로 환산
//
// ★ 먼저 못 박는다: 지도 핀만으로는 수심을 알 수 없다.
//   앱에는 해도 수심·측심 자료가 없다. 좌표에서 바닥 깊이가 나오는 곳이 없다.
//   여기서 숫자를 지어내면 그 값을 믿고 들어간 배가 얹힌다.
//
// 대신 진짜로 되는 것이 있다.
//   수심계가 보여 주는 값은 '지금 물 높이 기준' 이다.
//   만조에 4.2m 나왔다고 대 놓으면 저조에 1.1m 가 된다.
//   국립해양조사원 조위는 약최저저조위(해도 기준면)에서 잰 높이이므로
//
//        저조위 기준 = 잰 수심 − 그 시각 조위
//
//   핀을 찍었으니 앱이 할 수 있는 일은 이것이다 —
//   그 자리에서 가장 가까운 조위 관측소를 알아서 잡고, 잰 시각 조위를 빼 준다.
//   사람이 넣어야 하는 것은 '잰 값' 하나뿐이다.
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 어느 자리에서든 가장 가까운 관측소를 잡는다
{
  const f = grab(js, 'nearestTideSpotAt') || '';
  T('아무 좌표로나 관측소를 찾는 곳이 있다', f.length > 0);
  // ★ 전에는 '지금 보는 날씨 위치' 로만 찾을 수 있었다. 핀 자리를 물을 길이 없었다.
  T('그 곳이 wxCur 에 매이지 않는다', f.length > 0 && !/wxCur/.test(f));
  T('거리로 고른다', /hav\(/.test(f));
  T('거리도 함께 돌려준다', /dist/.test(f));
  // 옛 함수는 새 함수를 부르는 껍데기여야 한다 — 두 벌이 되면 한쪽만 고쳐진다
  const n = grab(js, 'nearestTideSpot') || '';
  T('옛 nearestTideSpot 은 새 곳을 부른다', /nearestTideSpotAt\(/.test(n));
  T('관측소 고르는 셈이 한 벌만 남았다', !/tideCache\.spots\.forEach/.test(n));

  let out = null, err = '';
  try{
    const hav = grab(js, 'hav') || '';
    const tas = grab(js, 'tideAllSpots') || '';
    // ★ 4.68 — 나라별 물때가 붙으면서 관측소를 모으는 문이 tideAllSpots 하나로 바뀌었다.
    //   흉내 내지 않고 그 진짜 문을 태운다. 흉내 내면 문이 바뀌어도 검사가 모른다.
    const fn = new Function('tideCache', 'tidePackSpots', 'SPOT_PACKS',
      hav + '\n' + tas + '\n' + f + '\n return nearestTideSpotAt;')({
      spots: [
        { id:'yeosu', name:'여수', lat:34.747, lon:127.765, days:[] },
        { id:'busan', name:'부산', lat:35.096, lon:129.035, days:[] },
        { id:'incheon', name:'인천', lat:37.451, lon:126.592, days:[] }
      ]
    }, {}, []);
    out = { 여수앞: fn(34.70, 127.80), 부산앞: fn(35.10, 129.10), 없음: fn(null, null) };
  }catch(e){ err = e.message; }
  T('관측소 찾기를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('여수 앞바다는 여수를 잡는다 — ' + (out.여수앞||{}).name, (out.여수앞||{}).id === 'yeosu');
    T('부산 앞바다는 부산을 잡는다 — ' + (out.부산앞||{}).name, (out.부산앞||{}).id === 'busan');
    T('거리를 km 로 돌려준다', (out.여수앞||{}).dist > 0 && (out.여수앞||{}).dist < 30);
    T('좌표가 없으면 빈손으로 돌려준다', out.없음 === null);
  } else fail += 4;
}

// ── 2. 관측소의 만조·간조를 점으로 편다 (한 곳에서만)
{
  const f = grab(js, 'tidePtsOf') || '';
  T('만조·간조를 점으로 펴는 곳이 있다', f.length > 0);
  T('만조도 간조도 함께 편다', /\.h\b/.test(f) && /\.l\b/.test(f));
  T('cm 를 m 로 바꾼다', /\/ ?100/.test(f));
  T('시간순으로 정렬한다', /sort\(/.test(f));
  const a = grab(js, 'allTidePts') || '';
  T('타임라인도 같은 곳을 쓴다', /tidePtsOf\(/.test(a));
  T('점 펴는 셈이 한 벌만 남았다', !/day\.h\|\|\[\]/.test(a.replace(/\s/g,'')));

  let out = null, err = '';
  try{
    // tidePtsOf 가 만조·간조를 가르는 도우미 tideHiLo 를 부른다 — 함께 떼어 와야 돌아간다
    const hl = grab(js, 'tideHiLo') || '';
    const fn = new Function(hl + '\n' + f + '\n return tidePtsOf;')();
    out = fn({ days:[{ d:'2026-08-12',
      h:[{t:'10:01', v:291},{t:'22:35', v:335}],
      l:[{t:'04:08', v:88},{t:'15:59', v:56}] }] });
  }catch(e){ err = e.message; }
  T('점 펴기를 실제로 돌렸다' + (err ? ' — ' + err : ''), Array.isArray(out));
  if(Array.isArray(out)){
    T('네 점이 나왔다 — ' + out.length, out.length === 4);
    T('시간순이다', out.every((p,i)=> i===0 || p.t >= out[i-1].t));
    T('첫 점은 04:08 의 0.88m', Math.abs(out[0].v - 0.88) < 1e-9);
    T('m 단위다 (cm 가 아니다)', out.every(p=>p.v < 10));
  } else fail += 4;
}

// ── 3. ★ 저조위 기준으로 바꾸는 셈
{
  const f = grab(js, 'lowTideDepth') || '';
  T('환산하는 곳이 있다', f.length > 0);
  let fn = null, err = '';
  try{ fn = new Function(f + '\n return lowTideDepth;')(); }catch(e){ err = e.message; }
  T('환산을 실제로 돌렸다' + (err ? ' — ' + err : ''), !!fn);
  if(fn){
    // 만조에 4.2m 를 쟀고 그때 조위가 3.1m 였다 → 저조위 기준 1.1m
    T('4.2m 를 조위 3.1m 때 쟀으면 1.1m — ' + fn(4.2, 3.1), Math.abs(fn(4.2, 3.1) - 1.1) < 0.05);
    // ★ 뺄셈 방향이 뒤집히면 만조 때 잰 값이 더 깊어진다. 그러면 배가 얹힌다.
    T('환산값은 잰 값보다 얕다', fn(4.2, 3.1) < 4.2);
    T('조위가 0이면 그대로 — ' + fn(3.0, 0), Math.abs(fn(3.0, 0) - 3.0) < 1e-9);
    T('소수 한 자리로 끊는다 — ' + fn(4.23, 3.11), String(fn(4.23, 3.11)).replace(/^-?\d+\.?/,'').length <= 1);
    T('숫자가 아니면 빈손 — ' + fn('', 3.1), fn('', 3.1) === null);
    T('조위를 모르면 빈손', fn(4.2, null) === null);
  } else fail += 6;
}

// ── 4. 핀 자리의 그 시각 조위
{
  const f = grab(js, 'tideAtPlace') || '';
  T('핀 자리 조위를 묻는 곳이 있다', f.length > 0);
  T('그 자리에서 관측소를 잡는다', /nearestTideSpotAt\(/.test(f));
  T('그 관측소의 점을 편다', /tidePtsOf\(/.test(f));
  T('그 시각 값을 보간한다', /tideAt\(/.test(f));
  T('어느 관측소인지 함께 돌려준다', /spot/.test(f));

  let out = null, err = '';
  try{
    const hav = grab(js, 'hav') || '';
    const nsa = grab(js, 'nearestTideSpotAt') || '';
    const tpo = grab(js, 'tidePtsOf') || '';
    const thl = grab(js, 'tideHiLo') || '';   // tidePtsOf 가 쓰는 도우미
    const ta  = grab(js, 'tideAt') || '';
    const cache = { spots:[{ id:'yeosu', name:'여수', lat:34.747, lon:127.765,
      days:[{ d:'2026-08-12',
        h:[{t:'10:00', v:300}], l:[{t:'04:00', v:100},{t:'16:00', v:100}] }] }] };
    const tas = grab(js, 'tideAllSpots') || '';
    // ★ 5.2 — tideAtPlace 는 관 물때표가 없을 때 조화상수(hcTidePts)로 내려간다.
    //   여기서는 관 물때표가 이기는지 보는 자리라, 조화상수는 빈손 노릇만 하게 둔다.
    const fn = new Function('tideCache', 'tidePackSpots', 'SPOT_PACKS', 'hcTidePts',
      hav+'\n'+tas+'\n'+nsa+'\n'+tpo+'\n'+thl+'\n'+ta+'\n'+f+'\n return tideAtPlace;')(cache, {}, [], () => null);
    const mk = h => { const d=new Date('2026-08-12T00:00:00+09:00'); d.setHours(h,0,0,0); return d.getTime(); };
    out = { 만조: fn(34.70, 127.80, mk(10)), 간조: fn(34.70, 127.80, mk(4)),
            중간: fn(34.70, 127.80, mk(7)), 밖: fn(34.70, 127.80, mk(23)) };
  }catch(e){ err = e.message; }
  T('핀 자리 조위를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('만조 때는 3.0m — ' + JSON.stringify(out.만조 && out.만조.v), out.만조 && Math.abs(out.만조.v - 3.0) < 0.02);
    T('간조 때는 1.0m — ' + JSON.stringify(out.간조 && out.간조.v), out.간조 && Math.abs(out.간조.v - 1.0) < 0.02);
    // ★ 사이 시각은 보간해야 한다. 가장 가까운 극값을 그대로 쓰면 1m 가 틀린다.
    T('사이 시각은 그 사이 값이다 — ' + (out.중간 && out.중간.v.toFixed(2)),
      out.중간 && out.중간.v > 1.05 && out.중간 && out.중간.v < 2.95);
    T('어느 관측소인지 알려 준다 — ' + (out.만조 && out.만조.spot.name), out.만조 && out.만조.spot.name === '여수');
    // ★ 자료 기간 밖이면 지어내지 말고 빈손이어야 한다
    T('자료가 없는 시각은 지어내지 않는다', out.밖 === null);
  } else fail += 5;
}

// ── 5. 화면 — 눌러서 고른다
{
  const f = grab(js, 'spotDepthCalc') || '';
  T('환산 화면이 있다', f.length > 0);
  T('폼에서 그 화면으로 가는 버튼이 있다', /spotDepthCalc\(/.test(grab(js, 'spotForm') || ''));
  // ★ 배 위에서 숫자를 타이핑하게 하지 않는다. 눌러서 맞춘다.
  T('수심을 눌러서 올리고 내린다', /spotDepthAdj\(/.test(f));
  T('시각도 눌러서 옮긴다', /spotDepthTime\(/.test(f));
  T('지금으로 되돌리는 버튼이 있다', /지금/.test(f));
  T('그 시각 조위를 보여 준다', /조위/.test(f));
  T('어느 관측소인지 보여 준다', /spot\.name|\.spot\b/.test(f));
  T('환산 결과를 보여 준다', /lowTideDepth\(|저조위/.test(f));
  T('물때 자료를 먼저 받아 둔다', /loadTide\(/.test(f));
  // ★ 자료가 없으면 정직하게 말한다. 빈 숫자를 넣으면 안 된다.
  T('자료가 없으면 그렇게 말한다', /환산할 수 없|자료가 없/.test(f));

  const a = grab(js, 'spotDepthAdj') || '';
  T('수심 조절이 있다', a.length > 0);
  T('수심은 0 아래로 안 내려간다', /Math\.max\(0/.test(a));
  const t2 = grab(js, 'spotDepthTime') || '';
  T('시각 조절이 있다', t2.length > 0);
  // 앞날 물때를 재 놓을 수는 없다 — 잰 시각은 지금보다 뒤일 수 없다
  T('잰 시각이 앞날로 가지 않는다', /Math\.min\(/.test(t2) && /now|Date\.now/.test(t2));

  const ap = grab(js, 'spotDepthApply') || '';
  T('환산값을 넣는 곳이 있다', ap.length > 0);
  T('넣으면 저조위 기준이 켜진다', /lowTide ?= ?true/.test(ap));
  T('무엇으로 환산했는지 남긴다', /depthFrom/.test(ap));
  T('넣고 나면 폼으로 돌아간다', /spotForm\(/.test(ap));
}

// ── 6. 환산한 값은 근거가 남는다
{
  const f = grab(js, 'spotDepthText') || '';
  T('수심 글이 있다', f.length > 0);
  T('환산한 것은 그렇게 밝힌다', /depthFrom/.test(f));
  let fn = null, err = '';
  try{ fn = new Function(f + '\n return spotDepthText;')(); }catch(e){ err = e.message; }
  T('수심 글을 실제로 돌렸다' + (err ? ' — ' + err : ''), !!fn);
  if(fn){
    const auto = fn({ depth:'1.1', lowTide:true,
      depthFrom:{ raw:4.2, tide:3.1, spot:'여수', ts:'2026-08-12T10:00:00+09:00' } });
    T('환산값은 저조위 기준이라고 적는다 — ' + auto, /저조위/.test(auto));
    T('잰 값이 얼마였는지 남는다 — ' + auto, /4\.2/.test(auto));
    T('손으로 켠 것도 저조위 기준으로 적는다', /저조위/.test(fn({ depth:'2', lowTide:true })));
    // ★ 기준을 모르는 값을 저조위인 척하면 안 된다
    T('기준 모르는 값은 그렇게 밝힌다', /미상|확인/.test(fn({ depth:'2' })));
    T('수심이 없으면 아무 말 안 한다', fn({}) === '');
  } else fail += 5;
}

// ── 7. 저장할 때 근거가 함께 올라간다
{
  const s2 = grab(js, 'spotSave') || '';
  T('올릴 때 환산 근거도 넣는다', /depthFrom/.test(s2));
  const k = grab(js, 'spotKeep') || '';
  T('칩을 눌러도 적던 수심이 안 사라진다', /spDepth/.test(k));
  // ★ 손으로 수심을 고쳐 놓고 옛 환산 근거를 그대로 두면
  //   '4.2m 에서 뺐습니다' 라는 거짓말이 다른 숫자에 붙어 다닌다.
  let A = null, B = null, err = '';
  try{
    const run = (depth, from, typed) => {
      const ctx = { draft: { depth, depthFrom: from } };
      const els = { spDepth: { value: typed } };
      new Function('spotPickCtx','document', k + '\n return spotKeep;')(
        ctx, { getElementById: id => els[id] || null })();
      return ctx.draft;
    };
    A = run('1.1', { raw:4.2, tide:3.1, out:'1.1' }, '3.5');   // 손으로 고쳤다
    B = run('1.1', { raw:4.2, tide:3.1, out:'1.1' }, '1.1');   // 그대로 두었다
  }catch(e){ err = e.message; }
  T('수심 챙기기를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!A && !!B);
  if(A && B){
    T('손으로 고치면 옛 환산 근거를 버린다 — ' + JSON.stringify(A.depthFrom), !A.depthFrom);
    T('그대로면 근거를 지키다', !!B.depthFrom);
  } else fail += 2;
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
