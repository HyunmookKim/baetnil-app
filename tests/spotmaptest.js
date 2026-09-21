// 정박지 — 목록으로도 지도로도 (4.76)
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

T('★★★ 목록·지도 전환 띠가 있다', /\+ spotViewBar\(\)/.test(src) && !!grab(src,'spotViewBar'));
T('★★ 고른 것을 기억한다', /localStorage\.setItem\('bt_spotview'/.test(grab(src,'setSpotView')));
T('★★★ 지도일 때 지도 상자를 그린다', /mapBox\('spotsMap'/.test(src));
T('★★ 목록일 때는 줄을 그린다', /spotView === 'map'[\s\S]{0,120}spotRowsHtml\(\)/.test(src));

// 지도에 찍는 것은 목록과 같은 문을 지나야 한다 — 아니면 띠를 걸러도 지도엔 다 나온다
{
  const R = grab(src,'spotMapRows');
  T('★★★ 지도도 나라 띠를 지난다',  /countryOf\(s\) === spotCc/.test(R), R.slice(0,300));
  T('★★★ 지도도 종류 띠를 지난다',  /spotKindNow\(\)/.test(R));
  T('★★★ 지도도 찾기 칸을 지난다',  /spotMatch\(s, spotQ\)/.test(R));
  T('★★ 자리가 없는 곳은 안 찍는다', /s\.lat != null && s\.lon != null/.test(R));
  T('★★★ 찍는 수를 묶어 둔다 (배 위 폰이 멎지 않게)',
    /SPOT_MAP_MAX/.test(R) && /const SPOT_MAP_MAX = \d+/.test(src));
  T('★ 가까운 것부터 찍는다', /spotNm\(a\)/.test(R));
}
// 핀
// ★ 5.00 — onclick 을 떼고 열쇠(data-key)로 바꿨다. 왜인지는 mapBind 에 적어 두었다.
T('★★★ 핀을 누르면 그 자리가 열린다',
  /data-tap="spot" data-key="\$\{esc\(p\.key\)\}"/.test(src) && /mapSpotTap\(맞은것\.key\)/.test(src));
T('★★ 여는 곳은 하나다', (src.match(/function mapSpotTap\(/g)||[]).length === 1);
T('★★ 정박지 핀만 다르게 그린다 (항해 점과 안 섞인다)', /indexOf\('spot:'\) === 0/.test(src));
{
  const F = new Function(grab(src,'mapSpotTap').replace(/mapHot\([^)]*\)/,'0').replace(/openSpot\(id\)/,'globalThis.__opened = id') + '\nreturn mapSpotTap;')();
  F('spot:abc123'); T('★★ 핀 열쇠에서 자리 번호를 뽑는다', globalThis.__opened === 'abc123', globalThis.__opened);
  globalThis.__opened = null; F(''); T('★ 빈 값이면 아무 일도 안 한다', !globalThis.__opened);
}
// 아래 한 줄
{
  const F = grab(src,'spotMapFoot');
  T('★★ 몇 곳을 찍었는지 말해 준다', /곳/.test(F));
  T('★★★ 묶였으면 묶였다고 말한다 (조용히 잘라내지 않는다)', /가까운 \{n\}곳만 찍었습니다/.test(F));
  T('★★ 지도 쪽에도 출처가 붙는다 (ODbL)', /spotFromLine\(\)/.test(F));
}
['en','ru','ja'].forEach(L=>{
  const i = src.indexOf('\n  ' + L + ': {'), j = src.indexOf('\n  },', i);
  const d = i > 0 ? src.slice(i, j) : '';
  ['목록','지도'].forEach(k => T(L + " 에 「" + k + "」 가 있다", d.indexOf("'" + k + "':") >= 0));
});
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
