// 나라별 물때 꾸러미 (4.68 — 일본)
//
// ★ 왜 이 검사가 있는가
//   물때는 이 앱을 여는 큰 까닭 하나다. 그런데 일본에서 켜면 통째로 비어 있었다.
//   한국 tide.json 은 3MB 라 거기에 일본까지 넣을 수 없어서, 나라 것을 따로 받는다.
//   ★ 나눠 놓으면 「한 곳에서만 안 챙기는」 흠이 반드시 생긴다. 그래서 지점을 모으는
//     문을 하나(tideAllSpots)로 두고, 여기서 그 문만 지킨다.
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

// ── 꾸러미에 물때 파일이 달려 있다
{
  const P = (src.match(/const SPOT_PACKS = \[([\s\S]*?)\n\];/) || ['',''])[1];
  T('★ 나라 꾸러미를 찾았다', !!P);
  T('★★ 일본 꾸러미에 물때 파일이 달려 있다', /tide:'tide-jp\.json'/.test(P), P.slice(0,200));
}

// ── 모으는 문이 하나다
{
  const A = grab('tideAllSpots');
  T('★★ 지점을 모으는 문이 있다 (tideAllSpots)', !!A);
  T('★★ 그 문이 한국 것과 나라 것을 같이 담는다',
    !!A && /tideCache/.test(A) && /tidePackSpots/.test(A), A);
  // ★★★ 가장 가까운 지점을 찾는 곳이 그 문을 안 쓰면, 일본에 있어도 한국 지점이 잡힌다.
  const N = grab('nearestTideSpotAt');
  T('★★★ 가장 가까운 지점을 찾을 때 그 문을 쓴다', !!N && /tideAllSpots\s*\(/.test(N), N);
  T('★★★ 한국 것만 훑던 옛 길이 안 남아 있다', !!N && !/tideCache\.spots/.test(N), N);

  if(A && N){
    // 진짜로 골라 본다 — 여수 앞바다면 한국 지점, 다카마쓰 앞이면 일본 지점이 잡혀야 한다
    const F = new Function('KR','JP', `
      const tideCache = { spots: KR };
      const tidePackSpots = { jp: JP };
      const SPOT_PACKS = [{ k:'jp' }];
      function hav(a,b,c,d){ const R=6371, t=x=>x*Math.PI/180;
        const dLat=t(c-a), dLon=t(d-b);
        const q=Math.sin(dLat/2)**2 + Math.cos(t(a))*Math.cos(t(c))*Math.sin(dLon/2)**2;
        return 2*R*Math.asin(Math.sqrt(q)); }
      ${A}
      ${N}
      return { nearestTideSpotAt, tideAllSpots };`);
    const KR = [{ id:'kr_여수', name:'여수', lat:34.747, lon:127.746, days:[] }];
    const JP = [{ id:'jp_TA',  name:'高松', lat:34.350, lon:134.050, days:[] }];
    const { nearestTideSpotAt, tideAllSpots } = F(KR, JP);
    T('★ 두 자료를 합치면 두 지점이다', tideAllSpots().length === 2);
    T('★★★ 여수 앞에서는 한국 지점이 잡힌다',
      (nearestTideSpotAt(34.75, 127.75) || {}).id === 'kr_여수', nearestTideSpotAt(34.75, 127.75));
    T('★★★ 다카마쓰 앞에서는 일본 지점이 잡힌다',
      (nearestTideSpotAt(34.35, 134.05) || {}).id === 'jp_TA', nearestTideSpotAt(34.35, 134.05));
    // ★ 자료가 하나도 없을 때 터지면 첫 화면이 통째로 죽는다
    const G = new Function(`
      const tideCache = null; const tidePackSpots = {}; const SPOT_PACKS = [];
      function hav(){ return 0; }
      ${A}\n${N}\nreturn nearestTideSpotAt;`)();
    T('★ 자료가 없어도 안 터진다', G(34.7, 127.7) === null);
  }
}

// ── 받아오는 길
{
  const G = grab('tidePackGet'), S = grab('tidePackSync'), L = grab('tidePackLoadLocal');
  T('★ 받아오는 곳이 있다 (tidePackGet)', !!G);
  T('★★ 한 번 받으면 다시 안 받는다', !!G && /tidePackTried/.test(G), G);
  T('★★ 기기에 남겨 둔다 (배 위에서 인터넷이 없다)', !!G && /localStorage\.setItem/.test(G));
  T('★ 남겨 둔 것을 꺼내 쓴다 (tidePackLoadLocal)', !!L && /localStorage\.getItem/.test(L));
  T('★★ 지금 자리·쓰는 말로 어느 나라 것을 받을지 고른다',
    !!S && /spotPacksFor\s*\(/.test(S), S);
  // ★★★ 안 부르면 일본 물때를 영영 안 받는다
  T('★★★ 물때를 읽는 길에서 실제로 부른다',
    /tidePackSync\s*\(\s*\)/.test(grab('loadTide') || ''), grab('loadTide'));
}

// ── 출처 (政府標準利用規約 — 지우면 못 쓴다)
{
  const F = grab('tideFromLine');
  T('★★★ 화면에 출처를 적는 곳이 있다 (tideFromLine)', !!F);
  T('★★ 그 줄이 실제로 날씨 화면에 붙는다', /tideFromLine\s*\(\s*\)/.test(src.replace(F||'','')));
  T('★ 한국 자료일 때는 두 번 안 적는다',
    !!F && /국립해양조사원/.test(F), F);
  T('★★ 어느 자료에서 왔는지 가려내는 곳이 있다 (tideSpotFrom)', !!grab('tideSpotFrom'));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
