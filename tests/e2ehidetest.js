// 5.27 — 자동검사 계정이 올린 글·물건·정박지는 다른 사람 목록에 안 나온다
// 사장님 말씀: 「자동검사글은 언제 지울래」 → 「그래 1 2 다해라」
// 쓰는 법: node e2ehidetest.js ../www/index.html
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || '../www/index.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, x) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n + (x ? ' — ' + x : '')); } };
const i = src.indexOf('const E2E_RE ='), j = src.indexOf('async function pageList(');
T('자동검사 표를 다는 문이 있다', i > 0 && j > i);
const blk = src.slice(i, j);
const mk = email => new Function('fauth', blk + '\nreturn { amE2E, e2eMark, e2eHide };')({ currentUser: email ? { email } : null });
const rows = [{ id:1, title:'사람 글' }, { id:2, title:'[자동검사] 지워질 글 x', e2e:true }, { id:3, title:'또 사람 글', e2e:false }];
const 사람 = mk('someone@gmail.com'), 손님 = mk(null), 검사 = mk('e2e-mugx1-a@baetnil.com'), 검사B = mk('E2E-abc9-b@baetnil.com');
T('사람 계정에는 자동검사 글이 안 보인다', JSON.stringify(사람.e2eHide(rows).map(x => x.id)) === '[1,3]');
T('로그인 안 한 사람에게도 안 보인다', JSON.stringify(손님.e2eHide(rows).map(x => x.id)) === '[1,3]');
T('검사 계정끼리는 보인다 (신고·차단 검사)', 검사.e2eHide(rows).length === 3 && 검사B.e2eHide(rows).length === 3);
T('검사 계정이 올리면 표가 달린다', 검사.e2eMark({ id:9 }).e2e === true);
T('사람이 올리면 표가 안 달린다', 사람.e2eMark({ id:9 }).e2e === undefined);
T('비슷한 이메일은 검사 계정이 아니다', !mk('e2e-x-a@gmail.com').amE2E() && !mk('xe2e-mugx1-a@baetnil.com').amE2E() && !mk('e2e-mugx1-c@baetnil.com').amE2E());
T('검사 러너가 쓰는 이메일 꼴과 맞다', /em:'e2e-'\+r\+'-a@baetnil\.com'/.test(fs.readFileSync(__dirname + '/e2e_runner.js', 'utf8')));
// 쓰는 자리 · 받는 자리
T('목록(pageList)이 거른다', /rows: e2eHide\(snap\.docs\.map/.test(src));
T('글판·정박지·장터 찾기가 거른다', (src.match(/return e2eHide\(snap\.docs\.map\(d => Object\.assign\(\{ id:d\.id \}, d\.data\(\)\)\)\);/g) || []).length === 3);
T('글 올리기가 표를 단다', /async add\(body\)\{\n\s+e2eMark\(body\);\n\s+await setDoc\(doc\(fdb, 'community'/.test(src));
T('정박지 올리기가 표를 단다', /async put\(body\)\{\n\s+e2eMark\(body\);\n\s+await setDoc\(doc\(fdb,'spots'/.test(src));
T('장터 올리기가 표를 단다', /async put\(body\)\{ e2eMark\(body\); await setDoc\(doc\(fdb,'market'/.test(src));
console.log(`\n통과 ${pass} · 실패 ${fail}`);
process.exit(fail ? 1 : 0);
