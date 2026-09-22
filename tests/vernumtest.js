// 5.10 — 판 번호는 사장님이 정한다. 5.9 다음은 5.10 (2026-09-22, 제가 혼자 6.0 으로 붙였다가 되돌림)
//   앞자리(5)를 바꾸지 않는다 · sw.js 와 같다 · 잘못 나갔던 6.0 저장분을 「새 판」 으로 보지 않는다
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const swp = [path.join(path.dirname(process.argv[2] || '.'), 'sw.js'), 'sw.js'].find(p => fs.existsSync(p));
const sw = swp ? fs.readFileSync(swp, 'utf8') : '';
let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };
const v = (src.match(/const APP_VER = '([^']+)'/) || [])[1] || '';
T('APP_VER 앞자리는 5 (사장님 허락 없이 안 바꾼다) — 지금 ' + v, /^5\.\d+$/.test(v));
T('APP_VER 이 6.0 이 아니다', v !== '6.0');
T('sw.js CACHE 가 baetnil-' + v, sw.indexOf("const CACHE = 'baetnil-" + v + "'") >= 0);
T('잘못 나갔던 6.0 저장분을 새 판으로 보지 않는다', /const 거둔판 = \['6\.0'\];/.test(src) && /거둔판\.indexOf\(판\(k\)\) < 0 && verCmp/.test(src));
// verCmp 가 5.10 을 5.9 보다 크게 본다
const vc = src.slice(src.indexOf('function verCmp('), src.indexOf('function verBanner('));
const verCmp = new Function(vc + '\nreturn verCmp;')();
T('verCmp: 5.10 > 5.9', verCmp('5.10', '5.9') > 0);
T('verCmp: 5.10 < 6.0', verCmp('5.10', '6.0') < 0);
console.log(`\n${pass} 통과 · ${fail} 실패`);
process.exit(fail ? 1 : 0);
