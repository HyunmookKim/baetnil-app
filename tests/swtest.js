// 서비스워커(sw.js) 검증
//
// 실제로 일어난 일: 앱은 2.11 이 돌고 있는데 저장된 파일은 2.12 였다.
// 새 버전을 올려도 옛 index.html 이 그대로 실행돼 고친 것이 하나도 안 보인다.
//
// 원인 두 가지
//  1) install 에서 addAll 로 받아오면 브라우저의 옛 사본(HTTP 캐시)을 그대로 담는다.
//     → 이름만 새 버전인 캐시 안에 옛 index.html 이 들어간다.
//  2) fetch 가 캐시 우선이라, 한 번 담긴 index.html 은 영영 새로 안 받는다.
const fs = require('fs');
const sw = fs.readFileSync(process.argv[3] || 'sw.js', 'utf8');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 버전이 맞는가
{
  const a = (js.match(/const APP_VER = '([^']+)'/) || [])[1];
  const b = (sw.match(/const CACHE = 'baetnil-([^']+)'/) || [])[1];
  T('앱 버전과 저장분 이름이 같다 (앱 ' + a + ' / 저장분 ' + b + ')', !!a && a === b);
}

// ── 2. 받아올 때 브라우저의 옛 사본을 쓰지 않는다
T('설치할 때 새로 받아온다 (옛 사본 안 씀)',
  /cache\s*:\s*'reload'/.test(sw));
T('addAll 로 통째로 받지 않는다 — 한 개라도 실패하면 전부 실패한다',
  !/\.addAll\(/.test(sw));

// ── 3. 화면 파일은 인터넷이 있으면 새것을 먼저 받는다
T('index.html 은 인터넷 우선으로 받는다', /networkFirst|netFirst/.test(sw));
// ★★★ 5.14 — 켤 때마다 통째로 받지 않는다. 「바뀌었나요?」 만 묻는다(304).
{
  const nf = (sw.match(/async function networkFirst\(req\)\{[\s\S]*?\n\}/) || [''])[0];
  T('★★★ 켤 때 화면 파일은 「바뀌었나요?」 만 묻는다 (cache:no-cache — 안 바뀌었으면 304)',
    /cache\s*:\s*'no-cache'/.test(nf) && !/cache\s*:\s*'reload'/.test(nf));
}
{
  const nf = grab(sw, 'networkFirst') || grab(sw, 'netFirst') || '';
  T('받아온 새것을 저장분에 넣는다', /caches\.open|\.put\(/.test(nf));
  T('인터넷이 없으면 저장분으로 버틴다', /catch/.test(nf) && /caches\.match/.test(nf));
}
T('화면 이동(navigate)도 인터넷 우선', /request\.mode\s*===\s*'navigate'|isDoc|navigate/.test(sw));

// ── 4. 그 밖의 파일은 저장분 우선 (배 위에서 인터넷이 없다)
T('아이콘 같은 것은 저장분 우선', /caches\.match\(/.test(sw));
T('지도 타일은 앱 버전을 올려도 지우지 않는다', /TILES/.test(sw) && /k!==TILES/.test(sw));
T('날씨·파이어베이스 같은 외부 요청은 건드리지 않는다',
  /u\.origin !== self\.location\.origin/.test(sw));

// ── 5. 앱이 스스로 알아차린다
T('앱이 저장분 버전을 확인한다', /caches\.keys\(\)/.test(js));
{
  const pv = grab(js, 'paintVer') || '';
  T('어긋나면 사람이 볼 수 있게 알린다', /새로고침|새로 받/.test(pv));
}
T('어긋나면 화면 위에 띠로 알린다', !!grab(js, 'verBanner'));
{
  const vb = grab(js, 'verBanner') || '';
  T('띠에서 바로 새로 받을 수 있다', /forceReload/.test(vb));
}
T('새로 받기는 저장분을 지우고 서비스워커도 푼다',
  /caches\.delete|caches\.keys/.test(grab(js, 'forceReload') || '')
  && /unregister/.test(grab(js, 'forceReload') || ''));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
