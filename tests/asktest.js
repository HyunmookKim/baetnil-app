// 물어보는 자리 — 브라우저 confirm 을 앱 안의 창으로 옮겼는가
//
// ★ 여기가 위험한 까닭
//   알림(tell)은 던져 놓고 가면 그만이다. 물음(ask)은 답을 기다려야 한다.
//   기다리는 것을 빠뜨리면 「아니오」가 「예」로 읽힌다 — Promise 는 늘 참이기 때문이다.
//   그러면 지우지 말라고 했는데 지워진다. 조용히, 되돌릴 수 없게.
//   그래서 「기다리지 않고 부른 자리가 하나도 없는가」를 여기서 못 박는다.
const fs = require('fs');
function grab(src, name){
  let i = src.indexOf('async function ' + name + '(');
  if(i < 0) i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const q = src.indexOf('!function(t,e){"object"==typeof exports');
const app = q > 0 ? src.slice(0, q) : src;

let pass=0, fail=0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

// ── 1. ★ 기다리지 않고 부른 자리가 없어야 한다
const bare = [];
{
  const lines = app.split('\n');
  const re = /(.{0,24})\bask\(/g;
  let m;
  while((m = re.exec(app))){
    const pre = m[1];
    if(/await\s+$/.test(pre)) continue;         // await ask(...) — 옳다
    if(/function\s+$/.test(pre)) continue;       // function ask(...) — 문 자체
    if(/\.\s*$/.test(pre)) continue;             // x.ask(...) — 남의 것
    const at = app.slice(0, m.index).split('\n').length;
    if(/^\s*(\/\/|\*)/.test(lines[at - 1] || '')) continue;   // 주석에 적어 둔 것
    // ★ 답을 .then 으로 받는 것도 「기다린 것」이다 —
    //   부르는 자리가 많아 sync 로 남겨야 하는 두 곳(lkCanEdit·shCanEdit)이 그렇다.
    let d = 1, k = m.index + m[0].length;
    while(k < app.length && d > 0){
      if(app[k] === '(') d++; else if(app[k] === ')') d--;
      k++;
    }
    if(/^\s*\.then\(/.test(app.slice(k, k + 30))) continue;
    bare.push(at + '행');
  }
}
T('★ 기다리지 않고 물어보는 자리가 없다 — ' + (bare.join(', ') || '없음'), bare.length === 0);

// ── 2. ★ 기다리는 자리가 전부 「기다릴 수 있는」 곳인가
//    노드의 진짜 문법 검사기에 맡긴다. 손으로 짐작하면 한 곳을 빠뜨린다.
{
  const fs2 = require('fs'), cp = require('child_process');
  const blocks = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)]
                   .map(x => x[1]).sort((a,b)=>b.length-a.length);
  fs2.writeFileSync('/tmp/_asktest.js', blocks[0]);
  const r = cp.spawnSync('node', ['--check','/tmp/_asktest.js'], { encoding:'utf8' });
  T('★ 기다리는 자리가 전부 기다릴 수 있는 곳이다',
    r.status === 0, (r.stderr||'').split('\n').slice(0,3).join(' '));
}

// ── 3. 브라우저 창은 정해 둔 자리에만 남는다
const left = [];
{
  const cr = /\bconfirm\(/g;
  let c;
  while((c = cr.exec(app))){
    const at = app.slice(0, c.index).split('\n').length;
    left.push(at);
  }
}
// 남아 있어도 되는 것 두 가지:
//  ① ask 안의 물러설 자리 (창을 못 만들었을 때)
//  ② lkOverlapOk — 답이 끌기 한복판을 거쳐 입력창 검사까지 올라간다.
//     여기를 기다리게 바꾸면 onOk 가 Promise 를 돌려주고, 입력창이
//     「검사 실패」를 참으로 읽어 그냥 닫힌다. 그래서 일부러 남겨 두었다.
const askBody = grab(src,'ask') || '';
const inOvl  = (grab(src,'lkOverlapOk') || '').match(/\bconfirm\(/g) || [];
T('★ 브라우저 창이 한 자리에만 남았다', left.length === inOvl.length && inOvl.length === 1);
T('창을 못 만들면 브라우저 창으로 물러선다', /window\.confirm/.test(askBody));
// 까닭은 함수 바로 위에 적어 둔다 — 다음 사람이 무심코 옮기지 않게
T('★ 남긴 자리에 까닭이 적혀 있다',
  /일부러 남겨 둔 자리[\s\S]{0,600}function lkOverlapOk/.test(src));

// ── 4. 답이 안 새는 자리는 sync 로 남겨 둔다 (부르는 자리가 많다)
for(const [f, n] of [['lkCanEdit',13], ['shCanEdit',5]]){
  const b = grab(src, f) || '';
  T(f + ' 은 그대로 참·거짓을 돌려준다', b.indexOf('async function') < 0);
  T(f + ' 은 기다리지 않는다 (부르는 자리가 ' + n + '곳)', !/await/.test(b));
  T(f + ' 도 앱 안의 창으로 묻는다', /ask\(/.test(b) && !/\bconfirm\(/.test(b));
  T(f + ' 은 답을 나중에 받아 연다', /\.then\(/.test(b));
}

// ── 5. 위치 동의는 줄줄이 기다릴 수 있어야 한다
for(const f of ['locAsk','locMay','geoGet']){
  T(f + ' 이 기다릴 수 있다', (grab(src,f) || '').indexOf('async function') === 0);
}
T('위치를 읽는 문이 답을 기다린다', /await\s+locMay\(/.test(grab(src,'geoGet') || ''));
T('항적 켜기도 답을 기다린다', /await\s+locMay\(/.test(grab(src,'trkStart') || ''));

// ── 6. ★ 물음마다 단추가 무엇을 하는 단추인지 이름에 있어야 한다
//    Material 3: "Avoid using vague terms like Done, OK, or Close."
//    Apple HIG:  "The meaning of 'OK' can be unclear."
//    조사한 한국 앱 12곳도 전부 동사를 쓴다.
T('물음마다 단추 이름을 정할 수 있다', /d\.ok\s*\|\|/.test(askBody));
T('위험한 것은 붉게 물을 수 있다', /d\.warn/.test(askBody));
{
  const bare = [];
  const re = /\bask\(/g;
  let m;
  while((m = re.exec(app))){
    const at = app.slice(0, m.index).split('\n').length;
    const line = app.split('\n')[at - 1] || '';
    if(/^\s*(\/\/|\*)/.test(line)) continue;              // 주석
    if(/function\s+ask\(/.test(app.slice(Math.max(0, m.index - 12), m.index + 5))) continue;
    let d = 1, k = m.index + m[0].length;
    while(k < app.length && d > 0){
      if(app[k] === '(') d++; else if(app[k] === ')') d--;
      k++;
    }
    const arg = app.slice(m.index + m[0].length, k - 1);
    if(!/\bok\s*:/.test(arg)) bare.push(at + '행');
  }
  T('★ 이름 없는 단추로 묻는 자리가 없다 — ' +
    (bare.length ? bare.slice(0, 8).join(', ') + (bare.length > 8 ? ' 외 ' + (bare.length - 8) : '') : '없음'),
    bare.length === 0);
}
// 되돌릴 수 없는 것은 붉게 묻는다
{
  const risky = [];
  const re = /\bask\(/g;
  let m;
  while((m = re.exec(app))){
    let d = 1, k = m.index + m[0].length;
    while(k < app.length && d > 0){
      if(app[k] === '(') d++; else if(app[k] === ')') d--;
      k++;
    }
    const arg = app.slice(m.index + m[0].length, k - 1);
    if(!/되돌릴 수 없|복구할 수 없|모두 사라집니다/.test(arg)) continue;
    if(!/warn\s*:\s*true/.test(arg))
      risky.push(app.slice(0, m.index).split('\n').length + '행');
  }
  T('★ 되돌릴 수 없는 물음은 붉게 묻는다 — ' + (risky.join(', ') || '없음'), risky.length === 0);
}

// ── 6-b. ★ 입력창이 답을 기다린다
//    onOk 안에서 물어볼 수 있게 됐다. 안 기다리면 약속을 「검사 통과」로 읽어
//    입력이 모자란데도 창이 닫힌다 — 조용히 틀리는 쪽이다.
{
  const fo = grab(src, 'formOk') || '';
  T('입력창 확인이 기다릴 수 있다', fo.indexOf('async function') === 0);
  T('★ 입력창이 onOk 의 답을 기다린다', /await\s+o\.onOk\(/.test(fo));
  T('모자라면 창을 안 닫는다', /=== false\) return;/.test(fo));
}

// ── 7. 사전에 낱말이 있다
for(const k of ['확인','닫기'])
  T("'" + k + "' 이 영어·러시아어에 다 있다", (src.split("'" + k + "':").length - 1) >= 2);

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
