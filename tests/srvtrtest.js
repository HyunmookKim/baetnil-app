// 서버가 글자를 어떻게 담고 어떻게 거절하는가 (2026-08-31)
//
// ★★★ 왜 이 검사가 있는가 — 실제로 아무것도 안 옮겨졌다
//   서버는 한 번에 60도막·6000자까지다. 넘기면 **통째로 거절**한다.
//   앱이 뉴스 한 화면(160도막)을 그대로 보내고 있었다. 매번 거절.
//   게다가 담는 열쇠가 「보낸 묶음 전체의 해시」 라서, 글 하나만 늘어도
//   전부 다시 옮겼다 — 「같은 글은 한 번만」 이라고 적어 놓고 안 그랬다.
//   하루 한도 8,000자는 첫 화면에서 바닥났다.
const fs = require('fs');
const P = (process.argv[2] && !/\.html$/.test(process.argv[2]))
  ? process.argv[2] : (__dirname + '/../../srv-index.js');
const src = fs.readFileSync(P, 'utf8');
// 앱 쪽 값과 맞는지도 본다
let app = '';
try{ app = fs.readFileSync(__dirname + '/../../work.html', 'utf8'); }catch(_){}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };
const num = (s, name) => { const m = s.match(new RegExp('const ' + name + '\\s*=\\s*(\\d+)')); return m ? Number(m[1]) : 0; };

// ── ① 도막 하나씩 담는가 (묶음째 담으면 거의 늘 새로 옮긴다)
T('★★★ 도막 하나마다 열쇠를 만든다',
  /const keyOf = v => crypto\.createHash\('sha256'\)/.test(src));
T('★★★ 묶음 전체를 해시로 뜨지 않는다 (그러면 하나만 달라져도 전부 다시 옮긴다)',
  !/update\(lang \+ '\\u0000' \+ texts\.join/.test(src),
  (src.match(/texts\.join\([^)]*\)/g)||[]));
T('★★★ 담아 둔 것을 먼저 꺼낸다', /db\.getAll\(\.\.\.part\.map/.test(src));
T('★★ 한 번에 몰아 읽는다 (도막마다 오가지 않는다)', /i \+= 30/.test(src));
T('★★★ 없는 것만 옮긴다', /if \(done\[keys\[i\]\] != null\) return;/.test(src));
T('★★★ 옮긴 것을 도막마다 담는다', /db\.doc\('trtext\/' \+ keyOf\(v\)\)[\s\S]{0,80}\.set\(\{ v: got/.test(src));
T('★★★ 실패한 것은 안 담는다 (담으면 영영 원문만 나온다)',
  /catch \(e\) \{[\s\S]{0,160}missed\+\+;/.test(src));

// ── ② 하루 한도는 「새로 옮긴 것」 에만 센다
T('★★★ 담긴 것을 읽는 것은 한도에 안 센다', /if \(fresh > 0\) await spend\(db, req\.auth\.uid, fresh\)/.test(src));
{
  const cap = num(src, 'DAY_CAP');
  // 실제로 센 값: 처음 한 번 약 14,000자, 그 뒤 하루 약 1,000자.
  // 첫날을 못 덮으면 사람은 「아무것도 안 옮겨진다」 를 겪는다 — 실제로 겪었다.
  T('★★★ 하루 한도가 첫날 몫을 덮는다 (지금 ' + cap + '자, 첫날 약 14,000자)',
    cap >= 20000, cap);
}

// ── ③ 앱과 서버의 한도가 같은가 (다르면 앱이 넘겨 보내고 통째로 거절당한다)
if(app){
  const 서버N = num(src, 'TXT_N'), 서버C = num(src, 'TXT_TOTAL');
  const 앱N = num(app, 'TR_SEND_N'), 앱C = num(app, 'TR_SEND_CHARS');
  T('★★★ 앱이 보내는 도막 수가 서버 한도를 안 넘는다 (앱 ' + 앱N + ' ≤ 서버 ' + 서버N + ')',
    앱N > 0 && 서버N > 0 && 앱N <= 서버N, { 앱N, 서버N });
  T('★★★ 앱이 보내는 글자 수가 서버 한도를 안 넘는다 (앱 ' + 앱C + ' ≤ 서버 ' + 서버C + ')',
    앱C > 0 && 서버C > 0 && 앱C <= 서버C, { 앱C, 서버C });
}

// ── ④ 못 옮긴 것이 몇인지 앱에 알려 주는가 (화면이 거짓말하지 않게)
T('★★★ 못 옮긴 수를 같이 돌려준다', /missed: missed/.test(src));
T('★★ 보낸 차례 그대로 돌려준다', /const out = texts\.map\(\(v, i\) =>/.test(src));

// ── ⑤ 옮길 칸이 다 들어 있는가 (하나 빠지면 그 줄만 남의 말로 남는다)
{
  const m = src.match(/const OK = \{[\s\S]*?\n\};/);
  const blk = m ? m[0] : '';
  [['배 이름','name'], ['매어 둔 곳','port'], ['연재 묶음 이름','sname'],
   ['항해일지 출발','from'], ['항해일지 도착','to'], ['정비수첩 메모','note']
  ].forEach(([이름, f]) => T('★★ 옮길 칸에 ' + 이름 + ' 이 있다', blk.indexOf("'" + f + "'") >= 0));
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
