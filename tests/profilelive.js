// 내 프로필 · 프로필 수정 · 글쓴이 프로필 (5.20)
// 사장님 지적:
//   「이거 저장하는것도 개좆같이 만들어놔서 저게 뭔저장버튼인지 모르겠다」
//   「다른 커뮤니티들은 게시글같은거 쓰면 그사람 눌러봐서 그사람에 대해서 이것저것 볼수 있는데」
//   「게시글에서 눌러보니까 여기 운영자권한이랑 이것것도 보이네」
// 조사: claude/뱃일-내소개-글쓴이프로필-다른커뮤니티조사.md — Instagram·X·Reddit·네이버 카페·Discord 방식대로
//   · 계정 화면에는 「내 프로필」(남에게 보이는 모습) + [프로필 수정]
//   · 프로필 수정 화면: 위 오른쪽 [완료], 바꾼 채 나가면 확인
//   · 공개 칸은 「공개 범위」, 그 아래에 누가 무엇을 보는지
//   · 글쓴이·댓글 쓴 사람은 누구나 눌러 프로필을 본다. 운영자는 그 안의 [관리] 로 관리 화면에 간다
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const FILE = path.resolve(process.argv[2] || 'work.html');
const ROOT = path.dirname(FILE);
const server = http.createServer((rq,rs)=>{
  const u = rq.url.split('?')[0];
  const f = u === '/' ? FILE : path.join(ROOT, u);
  fs.readFile(f,(e,d)=>{ if(e){rs.writeHead(404);rs.end();return;} rs.writeHead(200); rs.end(d); });
});
let ok=0,bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,260):''));} };
const sleep = ms => new Promise(r=>setTimeout(r,ms));

(async ()=>{
  await new Promise(r=>server.listen(0,r));
  const br = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const ctx = await br.newContext({ locale:'ko-KR', viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  await ctx.route(/googleapis|gstatic|firebaseio|firestore|open-meteo/, r=>r.abort());
  await ctx.addInitScript(()=>{ try{ localStorage.setItem('bt_setup','done'); localStorage.setItem('bt_welcome','done'); }catch(_){} });
  const pg = await ctx.newPage();
  const errs=[]; pg.on('pageerror', e=>errs.push(String(e)));
  await pg.goto('http://127.0.0.1:'+server.address().port+'/', { waitUntil:'domcontentloaded' });
  await sleep(1800);
  await pg.evaluate(()=>{
    try{ skipWelcome(); }catch(_){}
    me = { uid:'U1', email:'me@example.com', name:'현묵' }; window.__user = me;
    window.__saved = [];
    window.__profile = {
      one: async (uid) => uid === 'U2' ? { intro:'통영에서 요트 수리합니다.', seas:'통영 · 거제', want:'대마도', lv:'com', boats:[] } : null,
      save: async (p) => { window.__saved.push(JSON.parse(JSON.stringify(p))); }
    };
    profMine = { intro:'여수에서 탑니다.', seas:'여수 · 남해', want:'제주', lv:'com', boats:[] };
    window.__asks = [];
    window.ask = (m, o) => { window.__asks.push(String(m)); return Promise.resolve(window.__askAnswer !== false); };
    window.tell = () => Promise.resolve();
  });
  // 화면 이름(머리줄 제목)은 위 머리줄로 올라가므로 textContent 로 함께 본다
  const panel = () => pg.evaluate(()=>{ const P = document.getElementById('mrPanel'); const h = P.querySelector('.mrhead > b');
    return (h ? '[' + h.textContent.trim() + '] ' : '') + P.innerText; });

  // ── 계정 화면: 「내 프로필」 카드와 [프로필 수정]
  await pg.evaluate(()=>openAccount());
  await sleep(300);
  let tx = await panel();
  T('★ 계정 화면에 「내 프로필」 과 [프로필 수정] 이 있다', /내 프로필/.test(tx) && /프로필 수정/.test(tx), tx.slice(0,300));
  T('★ 계정 화면에 무엇을 저장하는지 모를 [저장] 이 없다 (소개 칸이 여기서 직접 고쳐지지 않는다)',
    await pg.evaluate(()=>!document.getElementById('pfIntro') && ![...document.querySelectorAll('#mrPanel button')].some(b=>b.textContent.trim()==='저장')));
  T('★ 「공개 범위」 아래에 누가 무엇을 보는지 적는다', /공개 범위/.test(tx) && /소개·자주 타는 바다·가고 싶은 곳을 로그인한 회원 누구나 봅니다/.test(tx), tx.slice(0,400));

  // ── 프로필 수정: [취소] [완료]
  await pg.evaluate(()=>openProfEdit());
  await sleep(300);
  const head = await pg.evaluate(()=>[...document.querySelectorAll('#mrPanel .mrhead button')].map(b=>b.textContent.trim()));
  T('★ 프로필 수정 화면 머리줄에 [취소] [완료]', head.join(',') === '취소,완료', head);
  tx = await panel();
  T('수정 화면에 이름·소개·자주 타는 바다·가고 싶은 곳·공개 범위', ['이름','소개','자주 타는 바다','가고 싶은 곳','공개 범위'].every(w=>tx.indexOf(w)>=0), tx.slice(0,300));
  // 안 바꾸고 취소 → 묻지 않고 돌아간다
  await pg.evaluate(()=>{ window.__asks = []; });
  await pg.evaluate(()=>profEditBack()); await sleep(300);
  T('안 바꿨으면 취소할 때 묻지 않는다', await pg.evaluate(()=>window.__asks.length === 0 && /내 프로필/.test(document.getElementById('mrPanel').innerText)));
  // 바꾸고 취소 → 묻고, 「계속 수정」 이면 그대로 남는다
  await pg.evaluate(()=>{ openProfEdit(); document.getElementById('pfIntro').value = '바꾼 소개'; window.__askAnswer = false; });
  await pg.evaluate(()=>profEditBack()); await sleep(300);
  T('★ 바꾸고 나가려 하면 「저장하지 않고 나갈까요?」 를 묻는다', await pg.evaluate(()=>window.__asks.some(m=>/저장하지 않고 나갈까요/.test(m))));
  T('「계속 수정」 이면 수정 화면이 그대로 (쓴 글도 그대로)', await pg.evaluate(()=>!!document.getElementById('pfIntro') && document.getElementById('pfIntro').value === '바꾼 소개'));
  // 뒤로 가기(쓸기·안드로이드 뒤로)도 같은 문
  await pg.evaluate(()=>{ window.__asks = []; window.__askAnswer = false; navDoBack(); }); await sleep(300);
  T('★ 뒤로 가기(쓸기·안드로이드 뒤로)도 바꾼 게 있으면 묻는다', await pg.evaluate(()=>window.__asks.length === 1 && !!document.getElementById('pfIntro')));
  // 나가기 → 계정 화면, 바꾼 것은 안 담긴다
  await pg.evaluate(()=>{ window.__askAnswer = true; profEditBack(); }); await sleep(300);
  T('「나가기」 면 계정 화면으로, 바꾼 것은 안 담긴다', await pg.evaluate(()=>/내 프로필/.test(document.getElementById('mrPanel').innerText) && profMine.intro === '여수에서 탑니다.' && window.__saved.length === 0));
  // 완료 → 저장
  await pg.evaluate(()=>{ openProfEdit(); document.getElementById('pfIntro').value = '여수에서 베네토 퍼스트 45를 탑니다.';
    document.getElementById('pfWant').value = '제주 · 블라디보스토크'; document.getElementById('pfName').value = '김명준'; });
  await pg.evaluate(()=>profSave()); await sleep(400);
  const sv = await pg.evaluate(()=>({ saved: window.__saved, name: myName(), txt: document.getElementById('mrPanel').innerText }));
  T('★ [완료] — 소개가 저장된다', sv.saved.length === 1 && sv.saved[0].intro === '여수에서 베네토 퍼스트 45를 탑니다.' && sv.saved[0].want === '제주 · 블라디보스토크' && !('name' in sv.saved[0]), sv.saved);
  T('★ [완료] — 이름도 함께 저장된다', sv.name === '김명준', sv.name);
  T('★ [완료] 뒤 계정 화면에 바뀐 프로필이 보인다', /베네토 퍼스트 45/.test(sv.txt) && /김명준/.test(sv.txt), sv.txt.slice(0,300));

  // ── 글쓴이 누르기 (운영자 아님)
  await pg.evaluate(()=>{
    closeBoat();
    adminMe = null;
    window.__cmt = { list: async () => [{ id:'c1', by:'U3', byName:'박선장', text:'좋은 정보 감사합니다', ts:'2026-09-28T10:00:00' }] };
    const rows = [{ id:'p1', kind:'free', title:'통영 수리소 추천', body:'어디가 좋을까요', by:'U2', byName:'이수리', ts:'2026-09-28T09:00:00' }];
    talkList = rows;
    window.__talk = Object.assign({}, window.__talk || {}, { list: async () => ({ rows, done:true }) });
    try{ comSub = 'talk'; switchTab('community'); }catch(_){}
  });
  await sleep(500);
  await pg.evaluate(async ()=>{ try{ await renderTalk(); }catch(e){ window.__rtErr = String(e); } });
  await sleep(300);
  const listLink = await pg.evaluate(()=>{ const a = [...document.querySelectorAll('.whoa')].find(e=>e.textContent.trim()==='이수리'); return !!a; });
  T('★ 글 목록에서 운영자가 아니어도 글쓴이 이름을 누를 수 있다', listLink);
  await pg.evaluate(()=>openTalk('p1')); await sleep(500);
  await pg.evaluate(()=>{ const a = [...document.querySelectorAll('#mrPanel .whoa')].find(e=>e.textContent.trim()==='이수리'); a.click(); });
  await sleep(500);
  tx = await panel();
  T('★ 글쓴이를 누르면 그 사람의 프로필 (소개·자주 타는 바다·가고 싶은 곳)', /이수리/.test(tx) && /통영에서 요트 수리합니다/.test(tx) && /통영 · 거제/.test(tx) && /대마도/.test(tx), tx.slice(0,300));
  T('★ 운영자가 아니면 관리 정보(계정 번호·운영자 권한)도 [관리] 도 없다', !/계정 번호|운영자 권한/.test(tx) && !/관리/.test(tx), tx.slice(0,300));
  await pg.evaluate(()=>navDoBack()); await sleep(500);
  tx = await panel();
  T('★ 뒤로 가면 보던 글로 돌아간다', /통영 수리소 추천/.test(tx) && /이수리/.test(tx) && await pg.evaluate(()=>!document.querySelector('#mrPanel [data-profview]')), tx.slice(0,200));
  // 댓글 쓴 사람
  const cm = await pg.evaluate(()=>{ const a = [...document.querySelectorAll('#mrPanel .cmthead .whoa')].find(e=>e.textContent.trim()==='박선장'); if(!a) return false; a.click(); return true; });
  await sleep(500);
  tx = await panel();
  T('★ 댓글 쓴 사람도 눌러 프로필을 본다 (소개가 없으면 없다고 말한다)', cm && /박선장/.test(tx) && /소개가 없거나/.test(tx), tx.slice(0,200));

  // ── 운영자가 누르면: 같은 프로필 + [관리]
  await pg.evaluate(()=>{ adminMe = { uid:'U1', super:true, perms:{} }; openTalk('p1'); });
  await sleep(500);
  await pg.evaluate(()=>{ const a = [...document.querySelectorAll('#mrPanel .whoa')].find(e=>e.textContent.trim()==='이수리'); a.click(); });
  await sleep(500);
  tx = await panel();
  const btns = await pg.evaluate(()=>[...document.querySelectorAll('#mrPanel button')].map(b=>b.textContent.trim()));
  T('★ 운영자도 먼저 보통 프로필을 본다 (관리 정보가 프로필을 대신하지 않는다)', /통영에서 요트 수리합니다/.test(tx) && !/운영자 권한/.test(tx), tx.slice(0,200));
  T('★ 운영자에게는 프로필 안에 [관리] 가 있다', btns.indexOf('관리') >= 0, btns);

  T('오류가 없다', errs.length === 0, errs.slice(0,3));
  await br.close(); server.close();
  console.log(`\n통과 ${ok} · 실패 ${bad}`);
  process.exit(bad ? 1 : 0);
})().catch(e=>{ console.log('★ 실패: 검사가 멈춤 — '+e); process.exit(1); });
