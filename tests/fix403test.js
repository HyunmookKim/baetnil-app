// 4.03 — 점검에서 남아 있던 자잘한 흠 열두 가지.
// 눈으로 봐야 아는 것은 fix403live.js 에서 본다. 여기서는 글자와 셈만 본다.
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const src = fs.readFileSync(FILE, 'utf8');

function grab(name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
let pass=0, fail=0;
const T=(n,c,w)=>{ if(c){pass++;console.log('통과: '+n);}
  else{fail++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,160):''));} };

// ── ① 정박지 설명 오타
T('소호 마리나 조류 설명 오타(「흐흐고」)가 없다', !/흐흐고/.test(src));
T('제자리 낱말(「흐르고」)로 고쳐졌다', /해안선 방향으로 평행하게 흐르고/.test(src));

// ── ② 백업 파일 이름 — 한글은 옮길 때 깨진다
T('백업 파일 이름이 로마자다', /baetnil-backup-\$\{/.test(src));
T('한글 파일 이름이 남아 있지 않다', !/뱃일백업_/.test(src));

// ── ③ 지도 저작권 — 표기 의무인데 9px 이라 못 읽었다
{
  const m = src.match(/\.mapbox \.mattr\{[^}]*font-size:(\d+)px/);
  T('지도 저작권 글씨가 11px 이상이다', !!m && Number(m[1]) >= 11, m && m[1]+'px');
}

// ── ④ 배 등록 단추 — 나머지 화면은 모두 「저장」 이다
T('배 등록 단추가 「저장」 이다', /onclick="createBoat\(\)">\$\{esc\(t\('저장'\)\)\}/.test(src));

// ── ⑤ 항해일지 목록 제목 — 「04:53 → 04:53」
//   ★ 4.115 에서 이름 짓는 일이 **voyName 한 곳**으로 옮겨졌다 (사장님이 「마지막 항해」 칸이
//     「2026-09-04 →」 로 뜬다고 지적하셨다). 목록 안에만 있던 셈이라 오늘 화면·휴지통이
//     같은 흠을 지니고 있었다. 그래서 여기도 그 문을 본다.
{
  const i = src.indexOf('function voyName(');
  const fn = i < 0 ? '' : src.slice(i, i + 900);
  T('이름 짓는 문이 하나다 (voyName)', !!fn);
  T('제목 고르기에서 시각이 같으면 안 쓴다', /o !== i/.test(fn), fn.slice(0,80));
  T('마지막에는 「제목 없는 항해」 로 떨어진다', /제목 없는 항해/.test(fn));
  T('★ 목록도 그 문을 쓴다', /const vTitle = v => esc\(voyName\(v\)\)/.test(src));
}

// ── ⑥ 오늘 화면에 수리
T('오늘 화면에 「고쳐야 할 곳」 카드가 있다', /고쳐야 할 곳/.test(grab('renderHome')));
T('끝난 수리는 빼고 센다', /status !== 'done'/.test(grab('renderHome')));

// ── ⑦ 「오프라인」 이 거짓말하지 않는다
{
  const fn = src.slice(src.indexOf('window.__cloudFailed'), src.indexOf('window.__cloudFailed') + 900);
  T('기기가 끊겼는지 먼저 본다', /navigator\.onLine === false/.test(fn));
  T('끊긴 게 아니면 「오프라인」 이라 하지 않는다', /클라우드 연결 안 됨/.test(fn));
  T('★ 인터넷이 멀쩡하다고 지어내지 않는다', !/인터넷은 연결되어 있습니다/.test(src));
  T('까닭을 눌러서 볼 수 있게 남긴다', /lastPushErr/.test(fn));
}

// ── ⑧ 홈포트 이름만 넣어도 날씨 지점이 생긴다
{
  const fn = grab('syncPortSpot');
  T('홈포트 이름을 내장 정박지에서 찾는다', /SPOT_SEED\.find/.test(fn));
  T('좌표가 이미 있으면 건드리지 않는다', /b\.lat == null \|\| b\.lon == null/.test(fn));
}

// ── ⑨ 로그인 안 한 사람이 자기 배에서 막히지 않는다
{
  const fn = grab('myRank');
  T('명부가 없으면 선주로 본다', /ownerRank\(b\)/.test(fn));
  T('명부가 있는데 남이면 여전히 막는다', /if\(!me\) return null;/.test(fn));
  // 진짜로 돌려 본다
  const RANKS = { own:{ pos:0, owner:true, name:'선주' }, crew:{ pos:2, perms:{ pub:'view' } } };
  const rankList = b => Object.keys(b.ranks||{}).map(k=>Object.assign({id:k}, b.ranks[k]));
  const ownerRank = b => rankList(b).find(r=>r.owner===true) || null;
  const rankOf = (b,id)=> ((b&&b.ranks)||{})[id] || null;
  const mk = body => new Function('rankList','ownerRank','rankOf','window',
    body + '; return myRank;')(rankList, ownerRank, rankOf, undefined);
  const myRank = mk(fn);
  const solo = { id:'b1', ranks:RANKS };                       // 혼자 쓰는 배
  const shared = { id:'b2', ranks:RANKS, members:{ u9:'own' } };// 남의 배
  T('★ 로그인 안 한 사람도 혼자 쓰는 자기 배에서는 선주다',
    !!myRank(solo) && myRank(solo).owner === true, myRank(solo));
  T('★ 남의 배는 여전히 막힌다', myRank(shared) === null, myRank(shared));
}

// ── ⑩ 저장된 날씨 글이 적을 때 쓰던 말로 굳지 않는다
{
  const fn = grab('wxText');
  T('wxText 가 있다', !!fn);
  T('숫자로 다시 짓는다', /w\.kt != null/.test(fn) && /tsub\('파고 \{n\}m'/.test(fn));
  T('옛 기록은 있는 그대로 사전에 넣는다', /t\(String\(w\.text \|\| ''\)\)/.test(fn));
  T('화면에 쓸 때 wxText 를 거친다', /esc\(wxText\(w\)\)/.test(src));
  // 돌려 본다
  const wxText = new Function('t','tsub','dirName',
    fn + '; return wxText;')(
      x=>'['+x+']',
      (k,v)=>{ let o=k; Object.keys(v).forEach(n=>{o=o.split('{'+n+'}').join(v[n]);}); return '['+o+']'; },
      d=>'DIR'+d);
  const made = wxText({ text:'남서 12kt · 파고 0.8m', dir:225, kt:12, gust:18, wave:0.8, tide:130, temp:24 });
  T('★ 숫자에서 다시 지어진다', /DIR225/.test(made) && /12kt/.test(made) && /0\.8/.test(made), made);
  const old_ = wxText({ text:'받는 중…' });
  T('옛 기록·안내 글은 사전을 거쳐 그대로 나온다', old_ === '[받는 중…]', old_);
}

// ── ⑪ 빛길 줄무늬가 카드 없는 글을 덮지 않는다
{
  const ops = (src.match(/opacity='(0\.\d+)'/g) || []).map(x=>Number(x.match(/0\.\d+/)[0]));
  T('빛길 줄무늬가 0.15 를 안 넘는다 — 가장 진한 것 ' + Math.max(...ops),
    ops.length > 0 && Math.max(...ops) <= 0.15, ops.slice(0,10));
}

// ── ⑫ 매개변수가 t() 를 가리지 않는다
T('mrToggleView 매개변수가 t 가 아니다', /function mrToggleView\(kind\)/.test(src));
{
  // 앱 전체에서 t 를 가리면서 '안에서 t() 를 부르는' 함수를 찾는다.
  // ★ openMyTasks 가 이것 때문에 통째로 터졌다 (const row = t => … 안에서 t('…')).
  //   매개변수 이름이 t 인 것만으로는 흠이 아니다 — 안에서 사전을 부를 때만 터진다.
  //   (지도 라이브러리처럼 이름이 줄어든 코드에도 t 매개변수가 수십 개 있다.)
  const bad = [];
  const re = /function\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g;
  let m;
  while((m = re.exec(src))){
    const ps = m[2].split(',').map(x=>x.trim().split('=')[0].trim());
    if(ps.indexOf('t') < 0) continue;
    const body = grab(m[1]);
    if(/[^\w$.]t\s*\(\s*['"`]/.test(body)) bad.push(m[1]);
  }
  T('t 를 가리면서 사전을 부르는 함수가 없다 — ' + bad.length + '곳', bad.length === 0, bad.join(' '));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
