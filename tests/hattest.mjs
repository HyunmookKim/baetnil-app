// 최고수면 계산이 맞는가 — 기상청 지점표 한 줄로 확인
import fs from 'fs';
const src = fs.readFileSync('/home/claude/webout/scripts/collect_jp_tide.js','utf8');
const fn = src.match(/async function hatMap\(\)[\s\S]*?\n\}/)[0];
let ok=0,bad=0;
const T=(n,c,w)=>{c?(ok++,console.log('통과: '+n)):(bad++,console.log('★ 실패: '+n+(w===undefined?'':' — '+JSON.stringify(w))))};
// 기상청 표 모양을 그대로 흉내 낸다 (동경·왓카나이·고치)
const row = a => '<tr>' + a.map(x=>`<td>${x}</td>`).join('') + '</tr>';
const html = '<table>'
  + row(['59','TK','東京',"35゜39'","139゜46'",'120.0','5.9','-114.1','47.73','153.73','23.64','181.77','25.07','178.91','19.57','160.28'])
  + row(['1','WN','稚内',"45゜24'","141゜41'",'18.0','-3.8','-21.8','2.18','109.78','1.93','141.52','6.41','17.95','6.23','351.89'])
  + row(['149','KC','高知',"33゜30'","133゜34'",'108.0','12.0','-96.0','49.31','173.42','21.87','197.50','21.77','189.34','16.77','169.69'])
  + row(['x','zz','머리줄','a','b','c','d','e','f','g','h','i','j','k','l','m'])
  + '</table>';
globalThis.fetch = async () => new Response(html, {status:200});
const f = new Function('const ST_URL="x";' + fn + '\nreturn hatMap;')();
const H = await f();
T('★★★ 동경 = (120.0 + 47.73+23.64+25.07+19.57)/100 = 2.36', H.TK === 2.36, H.TK);
T('★★★ 왓카나이 = (18.0 + 2.18+1.93+6.41+6.23)/100 = 0.35', H.WN === 0.35, H.WN);
T('★★★ 고치 = (108.0 + 49.31+21.87+21.77+16.77)/100 = 2.18', H.KC === 2.18, H.KC);
T('★★ 기호가 아닌 줄은 버린다', !('zz' in H) && Object.keys(H).length === 3, Object.keys(H));
T('★★ 우리나라 값과 자릿수가 비슷하다 (여수 3.62 · 부산 1.35)', H.TK > 1 && H.TK < 5);
console.log('\n합계: '+ok+'개 통과 / '+bad+'개 실패');
process.exit(bad?1:0);
