// 서버 함수(알림 보내기) 검사 — 폰 없이 코드만 보고 잡을 수 있는 것
//
// ★ 왜 따로 두나
//   앱 검사(notitest)는 index.html 을 본다. 이건 서버 함수(index.js)를 본다.
//   둘이 어긋나면 아무것도 안 온다 — 채널 이름 한 글자만 달라도 조용히 기본 채널로 간다.
const fs = require('fs');
// ★ 첫 인자는 앱 파일이다 (runall.sh 가 그렇게 준다). 서버 함수는 두 번째.
//   차례를 바꿔 뒀다가 runall 에서만 실패해 한참 헤맸다.
const APP = process.argv[2] || 'work.html';
const SRV = process.argv[3] || 'fn/functions/index.js';
if(!fs.existsSync(SRV)){ console.log('★ 서버 함수 파일이 없습니다:', SRV); process.exit(1); }
const s = fs.readFileSync(SRV, 'utf8');
const h = fs.readFileSync(APP, 'utf8');
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : (fail++, console.log('★ 실패:', n)); };
function fn(name, src){
  const src2 = src || s;
  let i = src2.indexOf('async function ' + name + '(');
  if(i < 0) i = src2.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, st = false;
  for(let j = i; j < src2.length; j++){
    const c = src2[j];
    if(c === '{'){ d++; st = true; }
    else if(c === '}'){ d--; if(st && d === 0) return src2.slice(i, j + 1); }
  }
  return src2.slice(i);
}

// ── 1. 문법
t('서버 함수가 문법상 읽힌다', (()=>{ try{ new Function(s); return true; }catch(e){ return false; } })());

// ── 2. 전부터 있던 것을 안 지웠다
['trText','tr','mailIn'].forEach(n=>
  t('옛 함수를 그대로 둔다 — ' + n, new RegExp('exports\\.' + n + ' =').test(s)));

// ── 3. 새 함수
['pushTalkComment','pushSpotComment','pushSeriesNew','pushNewsDaily'].forEach(n=>
  t('새 함수가 있다 — ' + n, new RegExp('exports\\.' + n + ' =').test(s)));
t('이름이 겹치지 않는다', (()=>{
  const m = s.match(/^exports\.(\w+) =/gm) || [];
  return new Set(m).size === m.length; })());
t('리전이 서울로 맞춰져 있다', /const RG = 'asia-northeast3'/.test(s));

// ── 4. ★ 보내는 문이 하나다
t('보내는 문이 하나다', (()=>{
  // 여러 곳에서 보내면 한 군데는 「껐다」를 안 본다. 그러면 껐다는 사람에게 간다.
  return (s.match(/sendEachForMulticast/g)||[]).length === 1 && !!fn('sendTo'); })());
t('꺼 둔 사람에게 안 보낸다', /p\.on !== true\) return 0;/.test(fn('sendTo')));
t('종류별로 꺼 둔 것도 본다', /if \(need && p\[need\] !== true\) return 0;/.test(fn('sendTo')));
t('토큰이 없으면 안 보낸다', /if \(!toks\.length\) return 0;/.test(fn('sendTo')));
t('밤이면 안 보낸다', /if \(quietNow\(p\)\) return 0;/.test(fn('sendTo')));

// ── 5. ★ 밤 판정은 받는 사람 시각으로
t('받는 사람 시간대로 밤을 본다', /timeZone: tz/.test(fn('quietNow')));
t('시간대를 모르면 참지 않는다', /catch \(e\) \{ return false; \}/.test(fn('quietNow')));
t('자정을 넘는 구간을 따로 본다', /f0 < t0 \? \(now >= f0 && now < t0\) : \(now >= f0 \|\| now < t0\)/.test(fn('quietNow')));

// ── 6. 죽은 토큰
t('죽은 토큰을 그 자리에서 뺀다',
  /arrayRemove\(\.\.\.dead\)/.test(fn('sendTo')) && /not-registered/.test(fn('sendTo')));

// ── 7. 나에게 안 울린다
t('내 글에 내가 단 댓글로는 안 울린다',
  /String\(post\.by\) === String\(cmt\.by\)\) return;/.test(fn('onComment')));
t('내가 올린 연재로 나에게 안 울린다', /continue;/.test(fn('pushSeriesNew') || s));

// ── 8. 사람을 찾는 방법
t('구독자를 훑지 않고 골라 읽는다', /array-contains/.test(s));
t('한 번에 읽는 수에 한계를 둔다', /\.limit\(2000\)/.test(s));
t('묶지 않은 연재는 보내지 않는다', /if \(!name\) return;/.test(s));

// ── 9. 소식은 하루 한 번, 어디까지 보냈는지 적어 둔다
t('아침에 한 번 돈다', /schedule: '0 8 \* \* \*'/.test(s) && /timeZone: 'Asia\/Seoul'/.test(s));
t('어디까지 보냈는지 적어 둔다', /config'\)\.doc\('pushnews'\)/.test(s) && /since/.test(s));
t('처음이면 하루치만 본다', /Date\.now\(\) - 864e5/.test(s));
t('새 소식이 없으면 아무에게도 안 보낸다', /새 소식 없음/.test(s));

// ── 10. ★ 앱과 서버가 같은 말을 쓰는가 (여기가 어긋나면 조용히 안 온다)
t('채널 이름이 앱과 같다', (()=>{
  const a = (s.match(/channelId: '([^']+)'/) || [])[1];
  const b = (h.match(/const NEWS_CH  = '([^']+)'/) || [])[1];
  return !!a && a === b; })());
t('앱이 서버에 적는 칸과 서버가 보는 칸이 같다', (()=>{
  const body = fn('fcmBody', h);
  const need = ['on','myComment','series','krCats','wwCats','quiet','from','to','tz'];
  return need.every(k => new RegExp('\\b' + k + ':').test(body))
      && /p\.on !== true/.test(fn('sendTo'))
      && /'myComment'/.test(s)
      && /'series', 'array-contains'/.test(s)
      && /'krCats'/.test(s) && /'wwCats'/.test(s); })());
t('앱이 쓰는 방과 서버가 읽는 방이 같다',
  /collection\('push'\)/.test(s) && /doc\(fdb, 'push', uid\)/.test(h));
t('규칙에 그 방이 열려 있다', (()=>{
  if(!fs.existsSync('firestore_rules.txt')) return false;
  const r = fs.readFileSync('firestore_rules.txt','utf8');
  return /match \/push\/\{uid\}/.test(r)
      && /allow list:   if false;/.test(r);       // 훑으면 온 사람 토큰이 다 나온다
})());

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail ? 1 : 0);
