// ★★★ 5.10 — 서비스워커가 자료 파일을 끝없이 쌓고, 404 까지 담아 두던 것
//   앱은 tide.json?v=지금시각 처럼 매번 다른 주소로 자료를 부른다. 서비스워커가 그것을 저장분 우선으로
//   받아 담으니, 부를 때마다 같은 자료가 한 벌씩 더 쌓였다 (tide.json 3MB). 그리고 없는 파일의 404 도
//   담아 두어, 나중에 파일을 올려도 그 기기에서는 영영 404 가 나왔다 (hc-eot20.txt 에서 실제로 겪음).
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || 'work.html';
const SW = path.join(path.dirname(path.resolve(SRC)), 'sw.js');
const s = fs.existsSync(SW) ? fs.readFileSync(SW, 'utf8') : fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
let ok = 0, bad = 0;
const T = (n, c) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n); } };
T('★★★ ?v= 를 붙인 자료 파일은 서비스워커가 건드리지 않는다', /if\(u\.searchParams\.has\('v'\)\)\{ return; \}/.test(s));
T('★★★ 성한 응답(res.ok)만 담는다 — 404 를 담지 않는다', /if\(res && res\.ok\)\{\s*const copy = res\.clone\(\);\s*caches\.open\(CACHE\)/.test(s));
T('★★ 앞 판이 담아 둔 ?v= 자료와 오류 응답을 치운다', /uu\.searchParams\.has\('v'\)\) return c\.delete\(r\)/.test(s) && /if\(res && !res\.ok\) return c\.delete\(r\)/.test(s));
T('★ 화면 파일은 여전히 인터넷 우선', /if\(isDoc\)\{ e\.respondWith\(networkFirst\(e\.request\)\); return; \}/.test(s));
T('★ 지도 타일은 여전히 저장분 우선', /TILE_HOSTS\.includes\(u\.hostname\)/.test(s));
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
