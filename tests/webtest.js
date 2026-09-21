// sitemap 굽기 + 옛 사본 걷어내기 (STEP 7)
//
// ★ 페이지는 여기서 안 만든다. worker.js 가 볼 때 만든다 (workertest.mjs 가 본다).
//   이 검사가 지키는 것 —
//   ① 새 자료를 읽지 않는다 (boatPublic 말고는 손대지 않는다)
//   ② 열쇠(secrets)를 안 쓴다
//   ③ 사이트맵에 「공개」 아닌 것이 안 실린다 · 감춘 배가 안 실린다
//   ④ 옛 사본(m·v·r·ja·en)을 실제로 걷어낸다
//   ⑤ 페이지 만드는 코드가 여기 없다 (사본이 둘이면 반드시 어긋난다)
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

const arg = (process.argv[2] && !/\.html$/.test(process.argv[2])) ? process.argv[2] : null;
const SRC = arg || '/home/claude/webout/scripts/build_web.js';
const YML = process.argv[3] || '/home/claude/webout/.github/workflows/web.yml';
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };

const src = fs.readFileSync(SRC, 'utf8');
T('★★★ boatPublic 말고 다른 칸을 안 읽는다 (새 구멍이 안 생긴다)',
  (src.match(/documents\/(\w+)/g) || []).every(x => x === 'documents/boatPublic'),
  (src.match(/documents\/(\w+)/g) || []));
T('★★ 열쇠(secrets)를 안 쓴다', !/secrets\./.test(src) && !/GOOGLE_APPLICATION/.test(src));
// ★ 지켜야 할 것은 「어떤 HTML 도 안 만든다」 가 아니라 **기록 페이지를 굽지 않는다** 이다.
//   기록은 사람이 내린 그 순간부터 안 보여야 하므로 볼 때 만들어야 한다 — 워커 하나가 만든다.
//   ★ 대문 말판·약관은 사정이 다르다. 사람이 내리는 것이 아니라 앱을 고쳐야 바뀐다.
//     구워 두지 않으면 웹과 앱의 약관이 갈린다 (실제로 1.2 와 1.6 으로 갈려 있었다).
T('★★★ 기록 페이지를 만들지 않는다 (만드는 곳은 worker.js 하나다)',
  !/function mlogPage|function voyPage|function rvPage/.test(src));
T('★★ 약관은 앱에서 구워 낸다 (사본이 아니다)',
  /function bakeLegal\(/.test(src) && /app', 'index\.html'/.test(src));
T('★★ 「공개」 만 싣는 문이 여기에도 있다', /const openWeb =/.test(src));

const yml = fs.readFileSync(YML, 'utf8');
T('★★ 일감에도 비밀값이 없다', !/secrets\./.test(yml), (yml.match(/secrets\.[A-Z_]+/g)||[]));
T('★ 앱(app/)을 안 건드린다', !/['"]app\//.test(src) && !/git add[^\n]*\bapp\b/.test(yml));
// ★ .github 는 원격 도구가 못 쓰는 자리다. 그래서 일감을 고치는 대신
//   「내가 지운 것은 내가 담는다」 로 스크립트 안에서 끝낸다.
//   둘 중 하나로만 담기면 된다 — 일감이 담든, 스크립트가 담든.
// ★★★ 4.94 — 굽기만 하고 걷어낼 것이 없는 날에도 커밋에 담겨야 한다.
//   전에는 `if(gone)` 안에 있어서, 걷어낼 것이 없으면 구운 ru/index.html 이 안 올라갔다.
//   일감의 `git add m v r ja en …` 줄에는 ru 가 없다 (.github 는 못 고치는 자리다).
T('★★★ 담는 일이 「걷어낸 것이 있을 때」 에 갇혀 있지 않다',
  !/if\(gone\)\s*\{[\s\S]{0,400}?execFileSync\('git'/.test(src),
  (src.match(/if\(gone\)[\s\S]{0,120}/) || [''])[0]);
T('★★ 러시아어 자리도 담는다', /LDIRS\.concat/.test(src) && /'ru'/.test(src));
// ★★★ 약관은 뿌리의 낱개 파일이라 폴더 목록에도 일감의 줄에도 안 들어간다.
//   여기 안 담으면 구워 놓고 영영 안 올라간다 (대문 말판에서 이미 겪었다).
T('★★★ 구운 약관도 커밋에 담는다',
  /LEGAL_FILES/.test(src) && /concat\(LEGAL_FILES\)/.test(src),
  (src.match(/LDIRS\.concat[^\n]*/) || [''])[0]);
// ★ 뿌리 대문(index.html)도 이제 구워 낸 것이다. 안 담으면 구워 놓고 안 올라간다.
T('★★★ 구운 한국어 대문도 커밋에 담는다',
  /LEGAL_FILES = \[[^\]]*'index\.html'/.test(src),
  (src.match(/const LEGAL_FILES = [^\n]*/) || [''])[0]);
T('★★ 걷어낸 언어별 자리까지 커밋에 담긴다',
  /git add[^\n]*\bja en\b/.test(yml) || /'add', '-A', '--', d/.test(src),
  (yml.match(/git add[^\n]*/)||[])[0]);
T('★★★ 일감이 폴더를 통째로 비우지 않는다', !/rm -rf/.test(yml));
T('★★ 자료 수집과 커밋이 안 부딪히게 시각을 벌려 두었다', /cron: '30 21/.test(yml), (yml.match(/cron: '[^']+'/)||[])[0]);

// ── 진짜로 돌려 본다 (가짜 Firestore 를 물린다)
const rec = (id, extra) => ({ mapValue:{ fields: Object.assign({ id:{stringValue:id} }, extra||{}) } });
const step = { how:{arrayValue:{values:[{mapValue:{fields:{v:{stringValue:'x'}}}}]}} };
const DOCS = { documents: [
 { name:'x/boatPublic/b1', fields:{
   id:{stringValue:'b1'}, name:{stringValue:'여수 SHUNSHINE'},
   mlog:{arrayValue:{values:[
     rec('l1', step),                                              // 공개 · 단계 있음
     rec('l2', {}),                                                // 단계 없음 → 안 실림
     rec('l3', Object.assign({ lv:{stringValue:'boat'} }, step))    // 일부 공개 → 안 실림
   ]}},
   voyage:{arrayValue:{values:[ rec('v1'), rec('v2', { lv:{stringValue:'none'} }) ]}},
   review:{arrayValue:{values:[ rec('r1') ]}} }},
 { name:'x/boatPublic/b2', fields:{
   id:{stringValue:'b2'}, name:{stringValue:'감춘 배'}, adminHidden:{booleanValue:true},
   voyage:{arrayValue:{values:[ rec('v9') ]}} }}
]};

const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'webt-'));
const read = p2 => { try{ return fs.readFileSync(path.join(TMP, p2), 'utf8'); }catch(_){ return ''; } };
const has  = p2 => fs.existsSync(path.join(TMP, p2));

// 예전에 구워 올려 둔 사본을 흉내 낸다 — 이것이 걷혀야 한다
['m/b1/l1', 'v/b1/v1', 'ja/v/b1/v1', 'en/r/b1/r1'].forEach(d => {
  fs.mkdirSync(path.join(TMP, d), { recursive:true });
  fs.writeFileSync(path.join(TMP, d, 'index.html'), '<html>옛 사본</html>');
});
// ★ 4.94 — 대문(index.html)을 말마다 한 장씩 굽는다. 재료가 있어야 구워진다.
//   구운 판이 제대로 나왔는지는 frontbaketest.js 가 뜯어본다. 여기서는 「굽혔나 · 안 걷혔나」 만 본다.
try{ fs.copyFileSync('/home/claude/site/index.html', path.join(TMP, 'site.html')); }catch(_){}

const srv = http.createServer((q,r)=>{ r.writeHead(200,{'content-type':'application/json'}); r.end(JSON.stringify(DOCS)); });
srv.listen(0, () => {
  const port = srv.address().port;
  const patched = src.replace(
    /https:\/\/firestore\.googleapis\.com\/v1\/projects\/\$\{PROJECT\}\/databases\/\(default\)\/documents\/boatPublic/,
    `http://127.0.0.1:${port}/x`);
  const bw = path.join(TMP, 'bw.js');
  fs.writeFileSync(bw, patched);
  execFile('node', [bw], { cwd: TMP, encoding:'utf8',
      env: Object.assign({}, process.env, { SITE_URL:'https://baetnil.com', OUT_DIR: TMP }) },
    (err, so, se) => { srv.close(); done(String(so||'') + String(se||'')); });
});
function done(out){
  T('★ 굽는다', /구웠습니다/.test(out), out.slice(0,200));
  const sm = read('sitemap.xml');
  T('★ 사이트맵이 나왔다', !!sm);
  T('★ 공개된 것은 다 있다',
    /m\/b1\/l1\//.test(sm) && /v\/b1\/v1\//.test(sm) && /r\/b1\/r1\//.test(sm));
  T('★★★ 「일부 공개」 는 사이트맵에 없다', !/l3/.test(sm));
  T('★★★ 「비공개」 도 없다',              !/v2/.test(sm));
  T('★★ 단계 없는 정비수첩은 없다',        !/l2/.test(sm));
  T('★★★ 감춘 배는 없다',                 !/b2/.test(sm) && !/v9/.test(sm));
  T('★★ 언어별 주소도 다 있다', /\/ja\/v\/b1\/v1\//.test(sm) && /\/en\/v\/b1\/v1\//.test(sm)
    && /\/ru\/v\/b1\/v1\//.test(sm));
  T('★ 목록 주소도 있다', /baetnil\.com\/m\/</.test(sm) && /baetnil\.com\/ja\/v\/</.test(sm));
  // ★ 대문도 사이트맵에 있어야 한다. 없으면 구글이 말판을 못 찾는다.
  T('★★ 대문 네 주소가 사이트맵에 있다',
    ['/', '/ja/', '/en/', '/ru/'].every(u => sm.indexOf('<loc>https://baetnil.com' + u + '</loc>') >= 0),
    (sm.match(/<loc>https:\/\/baetnil\.com\/(ja\/|en\/|ru\/)?<\/loc>/g) || []));

  T('★★★ 옛 사본을 걷어냈다',
    !has('m/b1/l1/index.html') && !has('v/b1/v1/index.html')
    && !has('ja/v/b1/v1/index.html') && !has('en/r/b1/r1/index.html'));
  // ★ 4.78 — m·v·r 은 폴더를 남긴다. 일감의 `git add m v r …` 줄이 폴더가 없으면
  //   「pathspec 'm' did not match any files」 로 죽는다 (build-web #3 이 그렇게 실패했다).
  //   .github 는 내가 못 고치는 자리라, 폴더를 남기고 표식 파일 하나만 둔다.
  // ★ 4.94 — 전에는 ja/ en/ 을 통째로 걷어냈다. 지금 그 자리에는 **대문 말판**이 산다.
  //   걷어내면 일본어 대문이 매일 사라진다. 기록 사본만 걷고 대문은 남겨야 한다.
  T('★★★ 언어별 자리에 대문이 구워졌다',
    has('ja/index.html') && has('en/index.html') && has('ru/index.html'));
  T('★★★ 그 안의 옛 기록 사본은 걷힌다',
    !has('ja/v/b1/v1/index.html') && !has('en/r/b1/r1/index.html') && !has('ja/v'));
  T('★★ 구운 대문이 그 나라 말이다',
    /[ぁ-んァ-ヶ一-龥]/.test(read('ja/index.html')) && /[Ѐ-ӿ]/.test(read('ru/index.html')));
  T('★ 몇 장을 구웠는지 말해 준다', /대문 4장/.test(out), out.slice(0,200));
  T('★★★ 한국어 대문도 채워서 굽는다 (자바스크립트 없이 읽는 기계가 본다)',
    (read('index.html').match(/data-t="[^"]+"[^>]*><\//g) || []).length === 0,
    read('index.html').slice(0,120));
  T('★★★ m·v·r 은 폴더를 남긴다 (일감이 그 이름을 부른다)',
    has('m/.keep') && has('v/.keep') && has('r/.keep'));
  T('★★ 그 안에 옛 페이지는 없다', !has('m/b1/l1/index.html') && !has('v/b1/v1/index.html'));
  T('★ 몇 개를 걷어냈는지 말해 준다', /옛 사본/.test(out), out.slice(0,200));

  const rb = read('robots.txt');
  T('★ 로봇에게 사이트맵을 알려 준다', /Sitemap: https:\/\/baetnil\.com\/sitemap\.xml/.test(rb));
  T('★ 크롤링을 막지 않는다', /Allow: \//.test(rb) && !/Disallow: \/\s*$/m.test(rb));

  try{ fs.rmSync(TMP, { recursive:true, force:true }); }catch(_){}
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad?1:0);
}
