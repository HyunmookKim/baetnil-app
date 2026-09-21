// 나라별로 가르기 (4.74) · 기준값 표 하나로 · 기준값 화면이 겹치던 것
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

// ── ① 기준값 표는 하나뿐이다 (다리 통과 높이라 어긋나면 배가 부딪힌다)
T('★★★ 기준값 표가 하나다', (src.match(/const HAT_BUILTIN = \[/g)||[]).length === 1);
// ★ 주석에 「HAT_PRESETS 가 있었다」 고 적힌 것은 괜찮다. 코드로 살아 있으면 안 된다.
T('★★★ 옛 사본(HAT_PRESETS)이 코드에 없다',
  !/const HAT_PRESETS/.test(src) && !/HAT_PRESETS\s*[\[\.]/.test(src),
  (src.match(/HAT_PRESETS[^\n]{0,40}/)||[])[0]);
T('★★ 가까운 지역 찾기도 그 표를 쓴다', /HAT_BUILTIN/.test(grab(src,'wxNearestRegion')));
{
  const L = (src.match(/const HAT_BUILTIN = \[[\s\S]*?\n\];/)||[''])[0];
  T('★ 일곱 지역이 다 있다', ['여수','통영','부산','완도','목포','제주','인천'].every(n => L.includes("'"+n+"'")));
  T('★★ 지역마다 나라가 적혀 있다', (L.match(/cc:'kr'/g)||[]).length === 7, L.slice(0,120));
  T('★★ 값이 안 바뀌었다', /'여수', hat:3\.62/.test(L) && /'인천', hat:9\.55/.test(L));
}

// ── ② 나라를 재는 곳은 하나
T('★★★ 나라를 재는 곳이 하나다', (src.match(/function countryOf\(/g)||[]).length === 1);
T('★★ 나라 표도 하나다', (src.match(/const COUNTRIES = \[/g)||[]).length === 1);
{
  const CT = (src.match(/const COUNTRIES = \[[\s\S]*?\n\];/)||[''])[0];
  const fn = new Function('COUNTRIES', grab(src,'inBoxes') + grab(src,'countryOf') + '\nreturn countryOf;')(
    JSON.parse(JSON.stringify([
      { k:'kr', boxes:[[33.0,124.5,38.7,129.6]] },
      { k:'jp', boxes:[[30.0,129.2,46.0,146.5],[24.0,122.0,30.0,131.5]] }
    ])));
  T('★★★ 적혀 있는 나라를 먼저 본다 (좌표로 안 헤맨다)',
    fn({cc:'jp', lat:34.74, lon:127.75}) === 'jp');
  T('★★ 여수는 한국', fn({lat:34.7470, lon:127.7520}) === 'kr');
  T('★★ 후쿠오카는 일본', fn({lat:33.60, lon:130.40}) === 'jp');
  T('★ 오키나와도 일본', fn({lat:26.21, lon:127.68}) === 'jp');
  T('★ 모르는 자리는 빈 값 (전체에만 보인다)', fn({lat:0, lon:0}) === '');
  T('★ 좌표가 없어도 안 터진다', fn({}) === '' && fn(null) === '');
}

// ── ③ 정박지 나라 띠
T('★★★ 정박지에 나라 띠가 붙는다', /\+ spotCcBar\(\)/.test(src));
T('★★ 목록이 나라로 걸러진다', /!spotCc \|\| countryOf\(s\) === spotCc/.test(src));
T('★★★ 나라가 하나뿐이면 띠를 안 띄운다', /if\(cs\.length < 2\)/.test(grab(src,'spotCcBar')));
// ★ 4.99 — 꾸러미 줄이 나라를 c 로도 들고 온다. 마지막 기댓값은 그대로 'kr' 이다.
T('★★ 앱에 든 관 자료는 한국으로 박힌다', /cc: x\.cc \|\| (x\.c \|\| )?'kr'/.test(grab(src,'seedSpotRow')));
T('★★ 꾸러미로 받은 것은 그 꾸러미의 나라로', /if\(pk\.cc\) row\.cc = pk\.cc/.test(grab(src,'spotPackAll')));
T('★ 일본 꾸러미에 나라가 적혀 있다', /k:'jp', cc:'jp'/.test(src));

// ── ④ 기준값 고르기도 나라별
{
  const HP = grab(src,'hatPanel');
  T('★★★ 기준값도 나라별로 묶인다', /countriesIn\(all\)/.test(HP) && /countryOf\(x\) === c\.k/.test(HP), HP.slice(0,200));
  T('★★ 정박지와 같은 문을 쓴다', /countriesIn\(/.test(grab(src,'spotCcBar')) && /countriesIn\(/.test(HP));
  T('★ 나라가 하나면 묶음 이름을 안 붙인다', /cs\.length < 2/.test(HP));
}

// ── ⑤ 기준값 화면이 뒤 화면 위에 겹치던 것
{
  const HP = grab(src,'hatPanel'), HC = grab(src,'hatClose');
  T('★★★ 화면 갈아 끼우는 문으로 연다 (겹치지 않는다)', /screenPush\('hatPanelOv'\)/.test(HP), HP.slice(-300));
  T('★★★ 닫을 때도 그 문으로', /screenPop\('hatPanelOv'\)/.test(HC), HC);
}

// ── ⑥ 사전
['en','ru','ja'].forEach(L=>{
  const i = src.indexOf('\n  ' + L + ': {'), j = src.indexOf('\n  },', i);
  const d = i > 0 ? src.slice(i, j) : '';
  // 4.132 말 전수점검에서 나라 이름이 「한국」 → 「대한민국」 으로 바뀌었다
  ['대한민국','일본','그 밖'].forEach(k =>
    T(L + " 에 「" + k + "」 가 있다", d.indexOf("'" + k + "':") >= 0));
});


// ── ⑦ 일본 기준값은 자료에서 온다 (18번). 손으로 안 적는다.
{
  const HL = grab(src,'hatList');
  T('★★★ 나라 자료에 실려 온 기준값을 얹는다', /tidePackSpots\[pk\.k\]/.test(HL), HL.slice(0,200));
  T('★★★ 값이 없는 지점은 안 싣는다 (없음이 0 으로 읽히면 안 된다)',
    /sp\.hat == null \|\| !\(sp\.hat > 0\)/.test(HL));
  T('★★ 얹은 것에도 나라가 붙는다', /cc: pk\.cc/.test(HL));
  T('★★★ 일본 숫자를 코드에 손으로 안 적었다',
    !/name:'東京'|name:'도쿄'|hat:2\.36/.test(src));
}

// ── ⑧ 출처 표기 (13번) — ODbL 의무
{
  const F = grab(src,'spotFromLine');
  T('★★★ 정박지 화면에 출처 줄이 있다', !!F && /\+ spotFromLine\(\)/.test(src));
  T('★★ 자료 파일의 from 을 그대로 적는다', /pk\.from/.test(F));
  T('★★ 보고 있는 나라 것만 적는다', /spotCc && pk\.cc && pk\.cc !== spotCc/.test(F));
  T('★ 정박지 한 곳을 열어도 적힌다', /fromPk && fromPk\.from/.test(src));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
