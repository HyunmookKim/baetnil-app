// 메일 접수 검사 — 사람이 보는 것만 본다
const fs = require('fs');
const h = fs.readFileSync(process.argv[2] || 'work.html','utf8');
let pass=0, fail=0;
const t=(n,ok)=>{ok?pass++:(fail++,console.log('★ 실패:',n));};

t('앱이 안내하는 문의 주소가 회사 것', /const SUPPORT_MAIL = 'help@baetnil\.com';/.test(h));
t('갈래에 메일이 있다', /\{ v:'mail',\s+name:t\('메일'\)/.test(h));
t('사람이 고르는 갈래에서는 뺐다', /k\.v !== 'series' && k\.v !== 'mail'/.test(h));
t('영어 사전', /'메일로 온 이야기':'Came in by email'/.test(h));
t('러시아어 사전', /'메일로 온 이야기':'Пришло по почте'/.test(h));
t('메일 낱말은 이미 사전에 있다', /'메일':'Email'/.test(h) && /'메일':'Эл\. почта'/.test(h));
t('LANG_TOTAL 이 1998 이상', (()=>{const m=h.match(/LANG_TOTAL = (\d+)/); return m && +m[1] >= 1998;})());
t('갈래 이름이 겹치지 않는다', (h.match(/v:'mail'/g)||[]).length === 1);
// 접수함이 메일 갈래도 그린다 — 갈래 이름을 SUPPORT_KINDS 에서 찾아 쓰므로 저절로 된다
t('접수함이 갈래 이름을 목록에서 찾는다', /SUPPORT_KINDS\.find\(x=>x\.v===s\.kind\)/.test(h));
t('접수함이 보낸 사람 주소를 보여준다', /s\.email\?' · '\+esc\(s\.email\)/.test(h));
const sw = fs.readFileSync('sw.js','utf8');
t('APP_VER 와 CACHE 가 같다',
  h.match(/APP_VER *= *'([^']*)'/)[1] === sw.match(/CACHE *= *'baetnil-([^']*)'/)[1]);
console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail?1:0);
