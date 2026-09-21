// 비 줄 검사 — 사람이 보는 것만 본다
const fs = require('fs');
const h = fs.readFileSync(process.argv[2] || 'work.html','utf8');
let pass=0, fail=0;
function t(name, ok){ if(ok){pass++;} else {fail++; console.log('★ 실패:', name);} }

// 1. 자료를 실제로 쓰는가 (주소 줄 말고도 나와야 한다)
t('precipitation 을 주소 밖에서도 쓴다', (h.match(/precipitation/g)||[]).length >= 2);
// 2. 표에 줄이 들어갔는가
t('표에 비 줄이 있다', /t\('비'\)/.test(h) && /rowRain/.test(h));
// 3. 기온 바로 아래인가
const tempRow = h.indexOf("rowTemp}</div></div>");
const rainRow = h.indexOf("rowRain}</div></div>");
const tideRow = h.indexOf("tideRow}</div></div>");
t('비 줄이 기온 줄 바로 아래', tempRow > 0 && rainRow > tempRow && (rainRow - tempRow) < 220);
t('비 줄이 조위 줄 앞', tideRow > 0 && rainRow < tideRow);
// 4. 안 오면 숫자 대신 가운뎃점
t('0mm 이면 · 을 찍는다', /rn!=null && rn>0\) \? rn\.toFixed\(1\) : '·'/.test(h));
// 5. 색이 네 단계인가
t('비 색 함수가 있다', /function wxRainStyle\(/.test(h));
t('색 단계 4개', (h.match(/function wxRainStyle\(v\)\{[\s\S]*?\n\}/)||[''])[0].split('return').length-1 === 4);
// 6. 사전 — 영어·러시아어 둘 다
t('영어 사전에 비', /'비':'Rain'/.test(h));
t('러시아어 사전에 비', /'비':'Дождь'/.test(h));
// 7. LANG_TOTAL 을 올렸는가
// LANG_TOTAL 은 판마다 오른다. 고정값이 아니라 '비를 넣기 전보다 늘었는가' 를 본다.
t('LANG_TOTAL 이 1997 이상', (()=>{const m=h.match(/LANG_TOTAL = (\d+)/); return m && +m[1] >= 1997;})());
// 8. 이름 겹침 (단일 파일이라 뒤에 선언된 쪽이 이긴다)
t('wxRainStyle 이름이 하나뿐', (h.match(/function wxRainStyle\(/g)||[]).length === 1);
t('rowRain 변수 선언이 하나뿐', (h.match(/rowRain\s*=\s*''/g)||[]).length === 1);
// 9. 판 번호
const sw = fs.readFileSync('sw.js','utf8');
t('APP_VER 와 CACHE 가 같다',
  h.match(/APP_VER *= *'([^']*)'/)[1] === sw.match(/CACHE *= *'baetnil-([^']*)'/)[1]);
console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
