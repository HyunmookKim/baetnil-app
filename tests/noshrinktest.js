// 5.53 — 사장님 「앞으론 절대 줄이지마」: 폰·웹으로 내보내는 파일은 원본과 한 글자도 다르면 안 된다.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w ? ' — ' + w : '')); } };
const src = path.join(root, 'www/index.html'), out = path.join(os.tmpdir(), 'noshrink-' + process.pid + '.html');
cp.execFileSync(process.execPath, [path.join(root, 'tools/ship.js'), src, out]);
T('내보낸 화면 파일 = 원본 그대로 (설명 글·빈칸·사전을 빼지 않음)', fs.readFileSync(out).equals(fs.readFileSync(src)));
T('tools/ship.js 가 esbuild(줄이기 도구)를 쓰지 않는다', !/require\(['"]esbuild['"]\)/.test(fs.readFileSync(path.join(root, 'tools/ship.js'), 'utf8')));
const g = fs.readFileSync(path.join(root, 'android/app/build.gradle'), 'utf8');
T('안드로이드 코드 줄이기(R8) 꺼짐', !/minifyEnabled\s+true/.test(g) && !/shrinkResources\s+true/.test(g));
try{ fs.unlinkSync(out); }catch(_){}
console.log('합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
