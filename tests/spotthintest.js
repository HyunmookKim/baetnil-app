// 4.102 — 지도에 찍는 곳을 자르되 **고르게** 자른다 (사장님이 여러 번 지적하신 것)
//
// ★ 사장님 말씀
//   「내가 반복적으로 지적하는데 왜 일본 지도에서 한 부분만 항구가 추가되냐?」
//
// ★ 자료 잘못이 아니었다. 나가 있는 일본 자료 343곳은 전국에 퍼져 있다.
//   화면이 **여기서 가까운 순으로 300곳**만 찍고 있었다. 여수에서 가까운 순으로 자르면
//   한국 138곳이 먼저 다 들어가고 남은 자리를 규슈·세토가 가져간다.
//   도쿄만·홋카이도는 한 곳도 못 들어온다 — 지도가 거짓말을 한 것이다.
//
// ★ 여기서는 **진짜 나간 자료**로 잰다. 지어낸 보기가 아니다.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || '/home/claude/work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; } else { bad++;
  console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 300) : '')); } };

function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
const F = grab('spotThin');
T('고르게 자르는 함수가 있다', F.length > 0);
T('★★ 지도가 그 함수를 쓴다', /return spotThin\(rows, SPOT_MAP_MAX\)/.test(src));
T('★★★ 가까운 순으로 통째로 자르지 않는다', !/return rows\.slice\(0, SPOT_MAP_MAX\)/.test(src));

let 자르기 = null;
try{ 자르기 = new Function(F + '\nreturn spotThin;')(); }
catch(e){ T('함수가 돈다', false, e.message); }

if(자르기){
  // ── 진짜 자료로 잰다
  const 자리 = [];
  const 받기 = f => { try{
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      (j.rows || []).forEach(x => { if(x.la != null && x.lo != null)
        자리.push({ id:x.i, lat:x.la, lon:x.lo, cc:x.c }); });
      return true;
    }catch(_){ return false; } };
  const D = '/mnt/user-data/uploads/baetnil/baetnil/app/';
  const 있나 = 받기(D + 'spots-kr.json') && 받기(D + 'spots-jp.json');
  if(!있나){ console.log('  (나간 자료 파일이 없어 이 검사는 건너뜁니다)'); }
  else {
    // 사장님 자리(여수)에서 가까운 순 — 앱이 하는 그대로
    const 여수 = { lat:34.7512, lon:127.69284 };
    const 거리 = s => Math.hypot(s.lat - 여수.lat, (s.lon - 여수.lon) * 0.82);
    자리.sort((a,b)=> 거리(a) - 거리(b));

    const 지역 = s => {
      if(s.cc === 'kr') return '한국';
      if(s.lat >= 41) return '홋카이도';
      if(s.lon >= 138.5) return '간토·도카이';
      if(s.lon >= 135) return '긴키';
      return '규슈·세토';
    };
    const 세기 = rows => { const c = {}; rows.forEach(s => { c[지역(s)] = (c[지역(s)]||0)+1; }); return c; };

    const 옛것 = 자리.slice(0, 300);
    const 새것 = 자르기(자리, 300);
    const 옛 = 세기(옛것), 새 = 세기(새것);

    T('★★★ 여태 방식(가까운 순 300)은 간토·도카이를 한 곳도 안 찍었다 — ' + (옛['간토·도카이']||0),
      !옛['간토·도카이'], JSON.stringify(옛));
    T('★★★ 새 방식은 간토·도카이도 찍는다 — ' + (새['간토·도카이']||0),
      (새['간토·도카이']||0) > 0, JSON.stringify(새));
    T('★★★ 새 방식은 홋카이도도 찍는다 — ' + (새['홋카이도']||0),
      (새['홋카이도']||0) > 0, JSON.stringify(새));
    // ★ 한국이 줄어드는 것은 맞다 — 자리를 일본에 나눠 주는 것이다.
    //   다만 절반 넘게는 남아야 한다 (여기가 우리 바다다).
    T('★★ 한국도 절반 넘게 남는다', (새['한국']||0) >= (옛['한국']||1) * 0.5, JSON.stringify(새));
    T('★★ 찍는 수는 그대로 300을 안 넘는다', 새것.length <= 300, 새것.length);
      // ★ 같은 번호가 둘이면 앱에서 한 곳이 다른 곳을 덮어쓴다.
    //   2026-09-04 자료에서 도두·김녕 공공/민간이 그랬고, 수집기를 다시 돌려 고쳤다.
    T('★★★ 자료에 같은 번호가 둘 있지 않다',
      new Set(자리.map(x=>x.id)).size === 자리.length,
      자리.length - new Set(자리.map(x=>x.id)).size);
    T('★★ 뽑은 것에 같은 곳이 두 번 없다', new Set(새것.map(x=>x.id)).size === 새것.length);
    console.log('   여태: ' + JSON.stringify(옛, null, 0));
    console.log('   이제: ' + JSON.stringify(새, null, 0));
  }
  // 적은 자료는 그대로 다 준다
  const 조금 = [{lat:1,lon:1,id:'a'},{lat:2,lon:2,id:'b'}];
  T('★★ 자를 것이 없으면 그대로 다 준다', 자르기(조금, 300).length === 2);
}
console.log('spotthintest: ' + ok + ' 통과, ' + bad + ' 실패');
if(bad) process.exitCode = 1;
