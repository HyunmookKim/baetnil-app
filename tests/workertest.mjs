// 볼 때 만드는 페이지 — 내리면 그 자리에서 사라지는가
//
// ★ 이 검사가 지키는 것
//   ① 「공개」 가 아닌 것은 404 다. 빈 페이지를 주지 않는다
//   ② 자료를 바꾸면 **다시 굽지 않아도** 그 다음 요청부터 바뀐다 (사본이 없다)
//   ③ 자료를 못 읽었을 때 「없다」 고 하지 않는다 — 멀쩡한 기록이 사라진 것처럼 된다
//   ④ 페이지를 만드는 곳은 이 파일 하나다
import fs from 'fs';
const SRC = '/home/claude/webout/scripts/worker.js';
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

const src = fs.readFileSync(SRC,'utf8');
T('★★★ 담아 두지 않는다 (담아 두면 내린 것이 그만큼 더 보인다)', /'cache-control': 'no-store'/.test(src));
T('★★★ 「공개」 가 아니면 없는 것과 같다', /if\(!r \|\| !openWeb\(r\)\) return gone/.test(src));
T('★★ 못 읽었을 때는 없다고 하지 않는다 (503)', /}\), 503\);/.test(src));
{
  const bw = fs.readFileSync('/home/claude/webout/scripts/build_web.js','utf8');
  // ★ 지켜야 할 것은 「어떤 HTML 도 안 만든다」 가 아니라
  //   **기록 페이지(m·v·r)를 굽지 않는다** 이다. 기록은 사람이 내린 그 순간부터 안 보여야 하므로
  //   볼 때 만들어야 하고, 그래서 워커 하나만 만든다.
  //   ★ 대문 말판과 약관은 사정이 다르다 — 사람이 내리는 것이 아니라 앱을 고쳐야 바뀐다.
  //     오히려 구워 두지 않으면 웹과 앱의 약관이 갈린다(실제로 1.2 와 1.6 으로 갈려 있었다).
  T('★★★ 기록 페이지를 굽지 않는다 (그것을 만드는 곳은 워커 하나다)',
    !/function mlogPage|function voyPage|function rvPage/.test(bw)
    && !/\/m\/\$\{|\/v\/\$\{|\/r\/\$\{/.test(bw.replace(/add\(`[^`]*`\)/g,'')),
    (bw.match(/function \w*Page\(/g) || []).join(','));
  T('★★ 약관은 앱에서 구워 낸다 (사본이 아니다)',
    /function bakeLegal\(/.test(bw) && /app', 'index\.html'/.test(bw));
  T('★★ 굽는 쪽도 같은 문을 쓴다', /const openWeb =/.test(bw));
}

// ── 진짜로 돌려 본다
const voy = (id,title,lv) => { const f = { id:{stringValue:id}, date:{stringValue:'2026-08-13'},
  title:{stringValue:title}, from:{stringValue:'여수'}, to:{stringValue:'개도'} };
  if(lv) f.lv = {stringValue:lv}; return { mapValue:{ fields:f } }; };
let DATA = null, FAIL = false;
const doc = () => ({ name:'p/boatPublic/b1', fields:{
  id:{stringValue:'b1'}, name:{stringValue:'배'}, voyage:{arrayValue:{values:DATA}} }});

globalThis.fetch = async (u) => {
  if(FAIL) return new Response('', { status:500 });
  const s = String(u && u.url ? u.url : u);
  if(/boatPublic\/b1/.test(s)) return new Response(JSON.stringify(doc()), { status:200 });
  if(/boatPublic\?/.test(s))   return new Response(JSON.stringify({ documents:[doc()] }), { status:200 });
  // 대문은 원본(깃허브 페이지)에서 그대로 가져온다 — 그 흉내
  if(/baetnil\.com\/(index\.html)?$/.test(s))
    return new Response('<html lang="ko">대문</html>',
      { status:200, headers:{ 'content-type':'text/html' } });
  return new Response('', { status:404 });
};
const W = (await import(SRC)).default;
const get = (p, h) => W.fetch(new Request('https://baetnil.com' + p, { headers: h || {} }));

DATA = [voy('v1','첫째'), voy('v2','둘째','boat'), voy('v3','셋째','none')];
{
  const a = await get('/v/b1/v1/');
  T('★ 공개된 항해는 페이지가 나온다', a.status === 200);
  const h = await a.text();
  T('★ 내용이 실려 있다', /첫째/.test(h) && /여수/.test(h));
  T('★ 정본 주소가 있다', /rel="canonical" href="https:\/\/baetnil\.com\/v\/b1\/v1\/"/.test(h));
  T('★★★ 「일부 공개」 는 404 다', (await get('/v/b1/v2/')).status === 404);
  T('★★★ 「비공개」 도 404 다',    (await get('/v/b1/v3/')).status === 404);
  T('★ 없는 배도 404 다',          (await get('/v/zz/v1/')).status === 404);
  T('★ 404 는 색인하지 말라고 한다',
    /name="robots" content="noindex"/.test(await (await get('/v/b1/v2/')).text()));
  const L = await (await get('/v/')).text();
  T('★★ 목록에도 공개된 것만 실린다', /첫째/.test(L) && !/둘째/.test(L) && !/셋째/.test(L));
  const ja = await get('/ja/v/b1/v1/');
  T('★ 일본어 주소가 산다', ja.status === 200);
  const jh = await ja.text();
  T('★ 일본어 페이지다', /<html lang="ja"/.test(jh));
  T('★ 영어 주소도 산다', (await get('/en/v/b1/v1/')).status === 200);
  // ★ 4.94 — 러시아어가 없어서 앞문(대문)과 뒷문(기록)이 서로 다른 말을 쓰고 있었다
  const ru = await get('/ru/v/b1/v1/');
  T('★★ 러시아어 주소도 산다', ru.status === 200);
  const rh = await ru.text();
  T('★★ 러시아어 페이지다', /<html lang="ru"/.test(rh));
  T('★★ 러시아어로 옮겨져 있다', /[Ѐ-ӿ]/.test(rh), rh.slice(rh.indexOf('<body'), rh.indexOf('<body')+300));
  // ★ hreflang 은 넷이 서로를 다 가리켜야 한다. 하나라도 빠지면 구글이 통째로 무시한다.
  ['ko','ja','en','ru'].forEach(x =>
    T('★★ 일본어 판이 hreflang ' + x + ' 을 가리킨다', jh.indexOf('hreflang="' + x + '"') >= 0));
  T('★★ x-default 가 있다', /hreflang="x-default"/.test(jh));
  // ★ 약관은 말마다 파일이 따로다. 러시아 사람에게 한국어 약관을 주면 안 된다.
  T('★★ 러시아어 판이 러시아어 약관을 건다', /terms\.ru\.html/.test(rh),
    (rh.match(/href="[^"]*terms[^"]*"/g) || []).join(' '));
  T('★★ 일본어 판이 일본어 약관을 건다', /terms\.ja\.html/.test(jh),
    (jh.match(/href="[^"]*terms[^"]*"/g) || []).join(' '));
  T('★★ 발치 이름표도 그 말로 나온다', /利用規約/.test(jh) && /Условия/.test(rh),
    (jh.match(/<footer>[\s\S]{0,160}/) || [''])[0]);
  T('★ 한국어 판은 한국어 약관을 건다', /\/terms\.html/.test(h));
}

// ★★★ 여기가 핵심이다 — 자료만 바꾸고 아무것도 다시 굽지 않는다
DATA = [voy('v1','첫째','boat')];
T('★★★ 내리면 그 다음 요청부터 바로 404 (다시 굽지 않는다)', (await get('/v/b1/v1/')).status === 404);
DATA = [voy('v1','첫째','com')];
T('★★★ 다시 올리면 그 다음 요청부터 바로 보인다', (await get('/v/b1/v1/')).status === 200);
DATA = [];
T('★★★ 기록을 지우면 바로 404', (await get('/v/b1/v1/')).status === 404);

DATA = [voy('v1','첫째')]; FAIL = true;
{
  const r = await get('/v/b1/v1/');
  T('★★★ 자료를 못 읽었을 때 「없다」 고 하지 않는다', r.status === 503 && r.status !== 404);
}
FAIL = false;
T('★ 우리 자리가 아닌 주소는 안 건드린다', (await get('/app/')).status === 404);


// ══════════════════════════════════════════════════════════════
// 대문(/) — 그 나라 말판으로 보낸다 (4.94)
{
  const AL = v => ({ 'accept-language': v });

  // ★★★ 로봇은 Accept-Language 를 안 보낸다. 뿌리에 그대로 남아야 한국어로 색인된다.
  const bot = await get('/');
  T('★★★ 머리말이 없으면 안 보낸다 (로봇은 뿌리에 남는다)', bot.status === 200, bot.status);
  T('★★★ 어느 말로 갈릴지 중간 저장소에 알린다',
    /Accept-Language/i.test(bot.headers.get('vary') || ''), bot.headers.get('vary'));

  const ja = await get('/', AL('ja,en-US;q=0.9,en;q=0.8'));
  T('★★ 일본어 브라우저는 /ja/ 로 간다', ja.status === 302 && ja.headers.get('location') === '/ja/',
    ja.status + ' ' + ja.headers.get('location'));
  const ru = await get('/', AL('ru-RU,ru;q=0.9'));
  T('★★ 러시아어 브라우저는 /ru/ 로 간다', ru.status === 302 && ru.headers.get('location') === '/ru/');
  const en = await get('/', AL('en-GB,en;q=0.9'));
  T('★★ 영어 브라우저는 /en/ 으로 간다', en.status === 302 && en.headers.get('location') === '/en/');

  // ★ 한국 사람은 안 보낸다 (뿌리가 한국어판이다)
  const ko = await get('/', AL('ko-KR,ko;q=0.9,en;q=0.8'));
  T('★★★ 한국어 브라우저는 안 보낸다', ko.status === 200, ko.status);

  // ★ 무게(q)를 본다 — 앞에 적혔다고 이기는 것이 아니다
  const q = await get('/', AL('en;q=0.3,ja;q=0.9'));
  T('★★ 무게가 큰 말을 고른다', q.status === 302 && q.headers.get('location') === '/ja/',
    q.headers.get('location'));

  // ★★★ 한 번 고르면 다시 안 보낸다 — 안 그러면 그 말을 못 읽는 사람이 갇힌다
  const stuck = await W.fetch(new Request('https://baetnil.com/', { headers:{
    'accept-language':'ja-JP', 'cookie':'a=1; bt_lang=ko; b=2' } }));
  T('★★★ 한국어를 골라 둔 사람은 안 보낸다 (갇히지 않는다)', stuck.status === 200, stuck.status);
  const chose = await W.fetch(new Request('https://baetnil.com/', { headers:{
    'accept-language':'ko-KR', 'cookie':'bt_lang=ja' } }));
  T('★★ 고른 말이 브라우저 말을 이긴다', chose.status === 302 && chose.headers.get('location') === '/ja/');

  // ★ 모르는 말은 뿌리에 둔다
  const zh = await get('/', AL('zh-CN,zh;q=0.9'));
  T('★ 모르는 말은 안 보낸다', zh.status === 200);

  // ★★★ 기록 페이지는 절대 안 보낸다 — 검색으로 그 주소를 집어 들어온 사람이다
  const rec = await get('/v/b1/v1/', AL('ja-JP'));
  T('★★★ 기록 페이지는 안 보낸다', rec.status === 200);
  const recJa = await get('/ja/v/b1/v1/', AL('ko-KR'));
  T('★★★ 일본어 기록 페이지도 안 보낸다', recJa.status === 200);
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
