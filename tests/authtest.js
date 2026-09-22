// 구글 로그인 — 앱에서는 바깥 브라우저로 나가면 안 된다.
// ★ 사고
//   앱에서 구글 로그인을 누르면 크롬이 열렸다가 「사이트에 연결할 수 없음」이 떴다.
//   구글이 로그인을 끝내고 원래 있던 주소로 돌려보내는데,
//   앱 화면의 주소는 http://localhost 라 크롬에 그런 데가 없기 때문이다.
//   → 앱에서는 안드로이드가 직접 구글에 물어보고, 받아 온 자격만 파이어베이스에 넘긴다.
const fs = require('fs');
const FILE = process.argv[2] || 'work.html';
const S = fs.readFileSync(FILE, 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+String(w).slice(0,200):''));} };

// ── 1. 부품을 받아 오는가
T('signInWithCredential 을 받아 온다', /signInWithCredential/.test(S));
T('그것을 파이어베이스에서 받아 온다',
  /signInWithCredential[\s\S]{0,400}(?:firebase-auth\.js|firebase\/auth\.js)/.test(S));

// ── 2. google() 을 통째로 떼어 낸다
function grabGoogle(){
  const i = S.indexOf('      async google(){');
  if(i < 0) return '';
  let d = 0, j = S.indexOf('{', i + 20), start = j;
  for(; j < S.length; j++){
    if(S[j] === '{') d++;
    else if(S[j] === '}'){ d--; if(d === 0) break; }
  }
  return S.slice(start + 1, j);
}
const body = grabGoogle();
T('구글 로그인 함수를 찾았다', body.length > 100, body.length);
T('앱인지 아닌지를 본다', /isNative\(\)/.test(body));
T('네이티브 부품을 찾는다', /FirebaseAuthentication/.test(body));
T('웹에서는 옛길(팝업)이 그대로 있다', /signInWithPopup/.test(body) && /signInWithRedirect/.test(body));

// ── 3. 진짜로 돌려 본다 (파이어베이스 없이, 가짜를 물려서)
function run(ctx){
  const fn = new Function('ctx', `
    const { isNative, t, fauth, GoogleAuthProvider, signInWithCredential,
            signInWithPopup, signInWithRedirect, window } = ctx;
    // ★ 6.0 — 네이티브 로그인은 nativeAuthWait 로 감싼다(대답 없이 멈추지 않게). 검사에서는 그대로 넘긴다.
    const nativeAuthWait = (p) => p;
    return async function google(){ ${body} };
  `)(ctx);
  return fn();
}
function base(over){
  const log = [];
  const ctx = {
    log,
    isNative: ()=> !!(over && over.native),
    t: x=>x,
    fauth: {},
    GoogleAuthProvider: function(){ log.push('provider'); },
    signInWithCredential: async()=>{ log.push('credential'); },
    signInWithPopup: async()=>{ log.push('popup'); },
    signInWithRedirect: async()=>{ log.push('redirect'); },
    window: { Capacitor: (over && over.cap) || undefined }
  };
  ctx.GoogleAuthProvider.credential = tok => ({ tok });
  return ctx;
}
const plugin = idToken => ({
  isNativePlatform: ()=>true,
  Plugins: { FirebaseAuthentication: {
    signInWithGoogle: async()=>({ credential: idToken ? { idToken } : {} }) } }
});

// 앱 — 안드로이드가 직접 물어보고, 그 자격을 파이어베이스에 넘긴다
{
  const ctx = base({ native:true, cap: plugin('TOKEN123') });
  let err = null;
  run(ctx).catch(e=>err=e);
  setTimeout(()=>{
    T('앱에서는 자격을 그대로 넘긴다', ctx.log.indexOf('credential') >= 0, ctx.log);
    T('앱에서는 바깥 브라우저를 안 연다',
      ctx.log.indexOf('popup') < 0 && ctx.log.indexOf('redirect') < 0, ctx.log);
    T('앱에서 오류가 안 난다', !err, err && String(err.message));
    step2();
  }, 30);
}

function step2(){
  // 웹 — 예전 그대로
  const ctx = base({ native:false });
  run(ctx).catch(()=>{});
  setTimeout(()=>{
    T('웹에서는 옛길 그대로 팝업을 연다', ctx.log.indexOf('popup') >= 0, ctx.log);
    T('웹에서는 네이티브 부품을 안 부른다', ctx.log.indexOf('credential') < 0, ctx.log);
    step3();
  }, 30);
}

function step3(){
  // 앱인데 자격을 못 받았다 — 조용히 넘어가면 사람은 로그인된 줄 안다
  const ctx = base({ native:true, cap: plugin(null) });
  let err = null;
  run(ctx).catch(e=>err=e);
  setTimeout(()=>{
    T('자격을 못 받으면 조용히 넘어가지 않는다', !!err, err && String(err.message));
    T('그때 바깥 브라우저로도 안 샌다',
      ctx.log.indexOf('popup') < 0 && ctx.log.indexOf('redirect') < 0, ctx.log);
    step4();
  }, 30);
}

function step4(){
  // 앱인데 부품이 안 들어간 판 — 바깥 브라우저로 보내면 아까 그 흰 화면이 또 뜬다
  const ctx = base({ native:true, cap: { isNativePlatform:()=>true, Plugins:{} } });
  let err = null;
  run(ctx).catch(e=>err=e);
  setTimeout(()=>{
    T('부품이 없으면 말해 준다 (흰 화면으로 안 보낸다)', !!err, err && String(err.message));
    T('그때도 바깥 브라우저를 안 연다',
      ctx.log.indexOf('popup') < 0 && ctx.log.indexOf('redirect') < 0, ctx.log);
    T('무엇을 하라고 알려 준다', !!err && /이메일/.test(String(err.message)), err && String(err.message));
    done();
  }, 30);
}

function done(){
  console.log(`\n합계: ${ok}개 통과 / ${bad}개 실패`);
  process.exit(bad?1:0);
}
