/* 뱃일 — 아이폰 시뮬레이터 전체 기능 자동 검사 (6.0)
 *
 * ★ 스토어에 나가는 앱에는 들어가지 않는다. 깃허브 맥 기계가 시뮬레이터용 빌드를 만들 때만
 *   ios/App/App/public/index.html 에 이 파일을 끼워 넣고, 애플에 올리는 빌드 전에는 다시 뺀다
 *   (ios-release.yml 의 「검사 파일이 섞이지 않았는가」 단계가 확인한다).
 *
 * 하는 일 — 앱 화면 안에서 앱의 함수와 단추를 차례로 눌러 본다.
 *   [baetnil-e2e] OK <이름>         통과
 *   [baetnil-e2e] FAIL <이름> — 까닭  실패
 *   [baetnil-e2e] SHOT <이름>       깃허브 맥이 이 줄을 보고 화면 사진을 찍는다
 *   [baetnil-e2e] BG <초>           깃허브 맥이 앱을 뒤로 보냈다가 <초> 뒤에 다시 연다
 *   [baetnil-e2e] NATIVE <이름>     깃허브 맥이 6초 뒤 사진을 찍고 앱을 껐다 다시 켠다(네이티브 창 닫기)
 *   [baetnil-e2e] DONE <통과>/<전체>
 * 앱이 스스로 다시 켜지는 단계(첫 설정·언어 바꾸기·계정 삭제)가 있어서, 어디까지 했는지는
 * localStorage 'e2e_state' 에 남기고 다시 켜지면 이어서 한다.
 */
(function(){
  'use strict';
  var TAG = '[baetnil-e2e] ';
  // full · quick — 아이패드와 작은 아이폰(SE)은 계정을 만들지 않고 화면만 훑는다
  // ★ 5.10 — 사장님: 작은 아이폰·아이패드도 기능 전체를 누른다. 모든 기기 full.
  var MODE_OLD = (function(){
    try{
      var u = navigator.userAgent || '';
      if(/iPad/.test(u) || (/Macintosh/.test(u) && (navigator.maxTouchPoints || 0) > 1)) return 'quick';
      if(Math.min(screen.width, screen.height) <= 400) return 'quick';   // 아이폰 16e·17(390~402)은 작은 쪽
    }catch(_){}
    return 'full';
  })();
  var MODE = 'full';
  var KEY = 'e2e_state';
  function load(){ try{ return JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(_){ return null; } }
  function keep(s){ try{ localStorage.setItem(KEY, JSON.stringify(s)); }catch(_){} }
  var S = load();
  if(!S){
    var r = Date.now().toString(36);
    S = { i:0, ok:0, fail:0, run:r,
          a:{ em:'e2e-'+r+'-a@baetnil.com', pw:'E2e!'+r+'Aa9' },
          b:{ em:'e2e-'+r+'-b@baetnil.com', pw:'E2e!'+r+'Bb9' } };
    keep(S);
    console.log(TAG + 'ACCOUNTS ' + S.a.em + ' ' + S.b.em + ' mode=' + MODE);
  }
  // ★ 6.0 — 앱의 console.log 는 파일로 돌리면 한참 모였다가 한꺼번에 나온다(2회째: 사진이 전부 마지막 화면).
  //   그래서 같은 줄을 앱 안 Documents/e2e_cmd.txt 에도 적는다. 깃허브 맥은 이 파일을 곧바로 읽는다.
  var FS = null; try{ FS = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem; }catch(_){}
  // ★ 5.15 — 안드로이드 에뮬레이터에서도 돈다. 안드로이드는 깃허브 기계가 logcat 으로 줄을 읽고,
  //   사진 답(e2e_ack.txt)은 못 준다(앱 문서 폴더를 밖에서 못 씀) — 그래서 사진은 기다리지 않고 3초만 쉰다.
  var PLAT = 'web'; try{ PLAT = window.Capacitor.getPlatform(); }catch(_){}
  var fq = Promise.resolve();
  function fileLog(line){
    if(!FS) return;
    fq = fq.then(function(){
      return FS.appendFile({ path:'e2e_cmd.txt', directory:'DOCUMENTS', data: line + '\n', encoding:'utf8' })
        .catch(function(){ return FS.writeFile({ path:'e2e_cmd.txt', directory:'DOCUMENTS', data: line + '\n', encoding:'utf8' }); });
    }).catch(function(){});
  }
  function log(m){ console.log(TAG + m); fileLog(TAG + m); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
  async function until(fn, ms, what){
    var t0 = Date.now();
    while(Date.now() - t0 < (ms || 15000)){
      try{ var v = fn(); if(v) return v; }catch(_){}
      await sleep(250);
    }
    throw new Error('기다려도 안 됨: ' + (what || fn.toString().slice(0, 80)));
  }
  function $(q){ return document.querySelector(q); }
  function txt(q){ var e = $(q); return e ? (e.innerText || e.textContent || '') : ''; }
  function setv(id, v){
    var e = document.getElementById(id);
    if(!e) throw new Error('#' + id + ' 칸이 없음');
    e.value = v; e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true}));
  }
  // 사진을 찍었다는 답(Documents/e2e_ack.txt)이 올 때까지 화면을 그대로 둔다
  async function shot(name){
    log('SHOT ' + name);
    if(!FS || PLAT === 'android'){ await sleep(PLAT === 'android' ? 3000 : 2500); return; }
    var t0 = Date.now();
    while(Date.now() - t0 < 20000){
      try{
        var r = await FS.readFile({ path:'e2e_ack.txt', directory:'DOCUMENTS', encoding:'utf8' });
        if(String(r && r.data || '').trim() === name) return;
      }catch(_){}
      await sleep(300);
    }
    console.log(TAG + 'INFO 사진 답 없음 ' + name);
  }
  // 앱의 확인 창(ask)이 뜨면 「확인」 쪽으로 답한다
  var autoYes = true;
  setInterval(function(){
    try{ if(autoYes && typeof tellIsOpen === 'function' && tellIsOpen()) tellDone(true); }catch(_){}
  }, 400);
  window.confirm = function(){ return true; };
  window.alert = function(m){ log('alert: ' + m); };
  // 앱 화면이 앱 밖(구글 페이지 등)으로 넘어가는지 지켜본다 — 동생분이 본 고장
  var HOME = location.origin;
  window.addEventListener('beforeunload', function(){ log('UNLOAD ' + location.href); });
  // 오류 자국을 모은다
  var ERRS = [];
  var _ce = console.error;
  console.error = function(){ try{ ERRS.push([].slice.call(arguments).join(' ')); }catch(_){} return _ce.apply(console, arguments); };
  function errsSince(n){ return ERRS.slice(n).filter(function(x){ return /baetnil-err/.test(x); }); }

  // 작은 사진(빨간 점) — 사진 붙이기 검사에 쓴다
  function dot(){
    var c = document.createElement('canvas'); c.width = 64; c.height = 48;
    var g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0,0,64,48); g.fillStyle = '#fff'; g.fillText('E2E', 18, 28);
    return c.toDataURL('image/jpeg', 0.8);
  }
  async function agreeIfAsked(){
    await sleep(600);
    if($('#mrPanel .agchk')){ agreeAll(); doAgree(); await sleep(800); }
  }
  // ★ 5.15 — 회원가입은 따로 된 화면: 「회원가입」 → 약관 동의 → 이메일·비밀번호·비밀번호 확인 → 가입하기.
  //   사람이 누르는 순서 그대로 누른다 (단추를 글자로 찾아 누른다).
  function tapBtn(label){
    // ★ 화면 언어가 영어일 때도 찾는다 (18회째 — 영어로 바꾼 뒤 「로그인」 을 못 찾아 테스트 계정이 안 지워졌다)
    var tr = (typeof t === 'function') ? t(label) : label;
    var b = [].slice.call(document.querySelectorAll('#mrPanel button')).find(function(x){ var s = x.textContent.trim(); return s === label || s === tr; });
    if(!b) throw new Error('「' + label + '」 단추 없음 — 화면: ' + txt('#mrPanel').slice(0, 80));
    b.click();
  }
  async function emailLogin(acc, isNew){
    openAccount(); await sleep(400);
    if(isNew){
      tapBtn('회원가입');
      await agreeIfAsked();
      await until(function(){ return !!$('#suPw2'); }, 10000, '동의 뒤 회원가입 화면 (화면: ' + txt('#mrPanel').slice(0, 60) + ')');
      setv('suEm', acc.em); setv('suPw', acc.pw); setv('suPw2', acc.pw);
      tapBtn('가입하기');
    } else {
      setv('acEm', acc.em); setv('acPw', acc.pw);
      tapBtn('로그인');
      await agreeIfAsked();
    }
    await until(function(){ return window.__user && window.__user.email === acc.em; }, 30000,
      '로그인 상태 (acMsg: ' + txt('#acMsg') + ' / suMsg: ' + txt('#suMsg') + ' / 칸 밑: ' + txt('#mrPanel .ferr.on') + ')');
  }
  async function signOut(){
    if(!window.__user) return;
    await doSignOut();
    await until(function(){ return !window.__user; }, 15000, '로그아웃');
  }
  function unlock(){ try{ if(!unlocked){ unlocked = true; if(typeof applyLock === 'function') applyLock(); } }catch(_){} }
  function newest(arr, pred){ var a = (arr || []).filter(pred || function(){ return true; }); return a[a.length - 1]; }

  // ─────────────────────────────── 단계들 ───────────────────────────────
  var STEPS = [];
  function step(name, fn, opt){ STEPS.push({ name:name, fn:fn, opt:opt || {} }); }

  step('부팅 — 파이어베이스 붙기', async function(){
    await until(function(){ return /붙었습니다/.test(String(window.__boot || '')) && window.__auth; }, 60000, '__boot=' + window.__boot);
  });
  step('첫 설정 화면', async function(){
    if(typeof setupDone === 'function' && setupDone()) return;
    if(typeof openSetup === 'function' && !$('#mrPanel.open')) openSetup();
    await sleep(800); await shot('01-first-setup');
    setupPick('lang', 'ko'); setupPick('cc', 'kr');
    S.i++; keep(S);                    // 다시 켜진 뒤 다음 단계로
    log('OK 첫 설정 화면'); S.ok++; keep(S);
    setupSave();                       // 앱이 스스로 다시 켜진다
    await sleep(60000);
  }, { reloads:true });
  step('환영 화면 넘기기', async function(){
    await sleep(1500);
    if($('#mrPanel.open') && /이메일로 시작하기/.test(txt('#mrPanel'))){ await shot('02-welcome'); skipWelcome(); }
  });
  step('로그인 화면 — 단추가 다 있는가', async function(){
    await signOut();
    // 앱이 막 켜졌을 때 첫 화면(환영)이 늦게 떠서 로그인 화면을 덮을 수 있다(5회째 아이패드) — 로그인 칸이 보일 때까지 다시 연다
    await until(function(){ if(!$('#acEm')) openAccount(); return !!$('#acEm'); }, 15000, '로그인 화면');
    await sleep(600); await shot('03-login');
    if(!$('.lgbtn.lg-a')) throw new Error('애플 단추 없음');
    if(!$('.lgbtn.lg-g')) throw new Error('구글 단추 없음');
    if(!$('#acEm') || !$('#acPw')) throw new Error('이메일 칸 없음');
    if(!/비밀번호 찾기/.test(txt('#mrPanel'))) throw new Error('비밀번호 찾기 없음');
    if(!/회원가입/.test(txt('#mrPanel'))) throw new Error('회원가입 단추 없음');
    if($('#suPw2')) throw new Error('로그인 화면에 비밀번호 확인 칸이 있음');
  });
  // ★ 5.15 — 키보드가 입력칸을 가리는가 (안드로이드 15 이상에서 여러 앱이 겪는 문제 — Capacitor #8166).
  //   안드로이드에서는 깃허브 기계가 칸을 손가락처럼 눌러 키보드를 띄운다(TAP). 아이폰 시뮬레이터는 누를 길이 없어 사진만.
  // ★ 5.15 — 키보드가 입력칸을 가리는가 (안드로이드 15 이상 — Capacitor #8166).
  //   안드로이드에서는 깃허브 기계가 칸을 손가락처럼 눌러 키보드를 띄운다(TAP).
  //   3회째: 키보드가 떴는데 웹뷰가 안 줄었다(보이는 높이 915/924) → 5.15 에서 MainActivity 가 키보드만큼 웹뷰를 줄인다.
  //   이제는 「키보드가 뜨면 보이는 높이가 준다」 와 「누른 칸이 키보드 위에 있다」 둘 다 본다. 로그인 비밀번호 칸(아래쪽)도 본다.
  async function kbdCheck(id, shotName){
    var el = $('#' + id);
    if(!el) throw new Error('#' + id + ' 칸 없음');
    el.scrollIntoView({ block:'end' }); await sleep(600);
    var r = el.getBoundingClientRect();
    var h0 = window.innerHeight;
    log('TAP ' + Math.round(r.left + r.width / 2) + ' ' + Math.round(r.top + r.height / 2) + ' ' + (window.devicePixelRatio || 1) + ' ' + window.innerWidth + ' ' + window.innerHeight);
    // ★ 에뮬레이터는 키보드를 처음 띄울 때 몇 초 걸린다(5회째: 4초에 재니 아직 안 줄었고, 사진에서는 줄어 있었다) — 12초까지 기다린다
    function hNow(){ var v = window.visualViewport ? window.visualViewport.height : window.innerHeight; return Math.min(v, window.innerHeight); }
    await sleep(1500);
    var t0 = Date.now();
    while(Date.now() - t0 < 12000 && hNow() > h0 - 100) await sleep(300);
    await sleep(600);
    var h1 = hNow();
    var r2 = el.getBoundingClientRect();
    log('INFO 키보드(' + id + ') — 눌린 칸=' + (document.activeElement && document.activeElement.id) + ' 보이는 높이=' + Math.round(h1) + '/' + h0 + ' 칸 아래끝=' + Math.round(r2.bottom));
    await shot(shotName);
    if(!document.activeElement || document.activeElement.id !== id) throw new Error(id + ' 칸을 눌렀는데 입력칸이 안 잡힘');
    if(h1 > h0 - 100) throw new Error('키보드가 떴는데 화면이 안 줄었음 (보이는 높이 ' + Math.round(h1) + '/' + h0 + ') — 아래쪽 칸이 키보드에 가려짐');
    if(r2.bottom > h1 + 2) throw new Error('키보드가 ' + id + ' 칸을 가림 (칸 아래끝 ' + Math.round(r2.bottom) + ' > 보이는 높이 ' + Math.round(h1) + ')');
    try{ el.blur(); }catch(_){}
    await sleep(1200);
  }
  step('회원가입·로그인 화면 — 키보드가 칸을 가리지 않는가', async function(){
    openAccount(); await sleep(400);
    tapBtn('회원가입');
    await agreeIfAsked();
    await until(function(){ return !!$('#suPw2'); }, 10000, '회원가입 화면');
    await sleep(600); await shot('03b-signup');
    if(PLAT !== 'android'){ openAccount(); return; }
    await kbdCheck('suPw2', '03c-signup-keyboard');
    openAccount(); await sleep(600);
    await kbdCheck('acPw', '03d-login-keyboard');
    openAccount();
  });
  step('메일로 회원가입 (A)', async function(){
    await emailLogin(S.a, true);
    if(location.origin !== HOME) throw new Error('앱 밖으로 넘어감: ' + location.href);
    S.a.uid = window.__user.uid; keep(S);
    await shot('04-signed-up');
  });
  step('로그아웃', async function(){ await signOut(); openAccount(); await sleep(500); await shot('05-signed-out'); });
  step('비밀번호 찾기 메일', async function(){
    openAccount(); await sleep(300); setv('acEm', S.a.em);
    doPwReset();
    await until(function(){ return /보냈습니다/.test(txt('#acMsg')); }, 20000, '재설정 메일 (acMsg: ' + txt('#acMsg') + ')');
  });
  step('다시 로그인 (A)', async function(){ await emailLogin(S.a, false); await shot('06-signed-in'); });
  step('배 등록', async function(){
    unlock();
    // 로그인 뒤 앱이 계정 화면을 늦게 다시 열 수 있다(8회째) — 배 등록 칸이 보일 때까지 다시 연다
    await sleep(1500);
    // ★ 11회째 아이패드 — 배 등록 칸이 한 번 보인 뒤에 계정 화면이 늦게 다시 덮었다.
    //   그래서 칸이 2초 동안 그대로 있을 때까지 다시 연다. 값을 넣기 직전에도 한 번 더 본다.
    var steady = 0;
    await until(function(){
      if(!$('#nbName')){ steady = 0; openBoatSetup(); return false; }
      return ++steady >= 8;   // 0.25초마다 보니 8번 = 2초
    }, 30000, '배 등록 화면');
    await sleep(500); await shot('07-boat-setup');
    if(!$('#nbName')){ openBoatSetup(); await until(function(){ return !!$('#nbName'); }, 10000, '배 등록 화면(다시)'); }
    setv('nbName', '자동검사배');
    try{ mapS.pick = { lat:34.7404, lon:127.7449 }; }catch(_){}
    createBoat();
    await until(function(){ return boats.some(function(b){ return b.name === '자동검사배'; }) && currentBoatId; }, 15000, '배 목록');
    S.boat = String(currentBoatId); keep(S);
  });
  step('배 이름 고치기', async function(){
    boatField('name', '자동검사배2');
    await until(function(){ return curBoat().name === '자동검사배2'; }, 5000);
  });
  step('적재표 — 칸 만들기', async function(){
    unlock(); switchTab('boat'); setBoatSubTab('stow'); await sleep(800);
    try{ if(typeof lkLocked !== 'undefined' && lkLocked) toggleLkLock(); }catch(_){}
    var l = lkAdd({ x:8, y:30, w:18, h:14 }, '선실', '검사칸');
    if(!l) throw new Error('칸이 안 만들어짐 (lkCanEdit=' + (typeof lkCanEdit === 'function' && lkCanEdit()) + ')');
    S.locker = l.id; keep(S);
    await shot('08-stow');
  });
  step('적재표 — 물품 넣기(사진 포함)', async function(){
    openLocker(S.locker); await sleep(600);
    setv('fName', '검사물품'); setv('fQty', '2');
    formPhotos.push(dot()); if(typeof renderPhotoPreview === 'function') renderPhotoPreview();
    addItem();
    var it = await until(function(){ return items.find(function(x){ return x.name === '검사물품'; }); }, 30000, '물품');
    S.item = it.id; keep(S);
    await until(function(){ var x = items.find(function(y){ return y.id === S.item; }); return x && x.photos && x.photos.length; }, 30000, '사진 붙음');
    await shot('09-item');
  });
  step('적재표 — 물품 지우기·되살리기', async function(){
    deleteItem(S.item);
    await until(function(){ return !items.some(function(x){ return x.id === S.item; }); }, 5000, '지워짐');
    restoreItem(S.item);
    await until(function(){ return items.some(function(x){ return x.id === S.item; }); }, 5000, '되살아남');
  });
  step('장비 넣기', async function(){
    unlock(); switchTab('boat'); setBoatSubTab('gear'); setGearSub('gear'); await sleep(500);
    var n = maint.length; addGear();
    await until(function(){ return maint.length > n; }, 5000);
    mrField('name', '검사엔진'); mrSaveClose(); await shot('10-gear');
  });
  step('정비수첩 쓰기', async function(){
    unlock(); goMaint('mlog'); await sleep(400);
    var n = maint.length; addMlog({ title:'엔진오일 교체(자동검사)' });
    await until(function(){ return maint.length > n; }, 5000);
    mrSaveClose(); await shot('11-mlog');
  });
  step('수리 적기', async function(){
    unlock(); goMaint('repair'); await sleep(400);
    try{ if(typeof repairView !== 'undefined' && repairView === 'map') mrToggleView('repair'); }catch(_){}
    var n = (repair || []).length; repairAdd();
    await until(function(){ return (repair || []).length > n; }, 5000);
    mrSaveClose();
  });
  step('연료 적기', async function(){
    unlock(); goMaint('fuel'); await sleep(400);
    var n = fuel.length; addFuel();
    await until(function(){ return fuel.length > n; }, 5000);
    mrField('liters', '30'); mrSaveClose(); await shot('12-fuel');
  });
  step('도면 열기', async function(){
    switchTab('boat'); setBoatSubTab('stow'); await sleep(500);
    try{ dgPickBuiltin('plan'); }catch(e){ throw new Error('dgPickBuiltin: ' + e.message); }
    await sleep(800); await shot('13-plan');
    try{ var ov = document.getElementById('dgPick'); if(ov) ov.remove(); }catch(_){}
  });
  step('항해 — 기록 시작과 항적', async function(){
    unlock(); goVoyage(); await sleep(500);
    var n = voyage.length; addVoyage();
    await until(function(){ return voyage.length > n; }, 5000);
    S.voy = String(newest(voyage).id); keep(S);
    await until(function(){ return typeof trkNow !== 'undefined' && trkNow && trkNow.vid; }, 30000, '항적 켜짐');
    await until(function(){ return trkNow.pts && trkNow.pts.length >= 3; }, 60000, '점이 쌓임 (지금 ' + ((typeof trkNow!=='undefined'&&trkNow&&trkNow.pts)?trkNow.pts.length:0) + ')');
    S.pts1 = trkNow.pts.length; keep(S);
    await shot('14-track');
  });
  step('항해 — 앱을 뒤로 보냈다가 돌아와도 항적이 이어지는가', async function(){
    var before = (trkNow && trkNow.pts) ? trkNow.pts.length : 0;
    log('BG 30'); await sleep(45000);
    await until(function(){ return trkNow && trkNow.pts && trkNow.pts.length > before + 2; }, 30000,
      '뒤에 있던 동안 점 (전 ' + before + ', 지금 ' + ((trkNow&&trkNow.pts)?trkNow.pts.length:0) + ')');
  });
  // 5.10 — 거짓 위치 거르기: 시뮬레이터 위치는 iOS 가 「소프트웨어가 만든 위치」 로 표시한다.
  //   그 표시를 그대로 두면 앱이 그 점을 버려야 한다(mock 수가 늘고 점은 안 는다).
  step('항해 — 거짓 위치는 버리는가', async function(){
    // ★ 5.15 — 안드로이드 에뮬레이터의 위치(adb emu geo fix)는 「가짜 위치 앱」 표시가 안 붙는 진짜 GPS 로 들어온다.
    //   그래서 이 단계는 안드로이드 에뮬레이터로는 확인할 길이 없다 — 통과로 치지 않고 따로 적는다.
    if(PLAT === 'android'){ log('INFO 거짓 위치 — 안드로이드 에뮬레이터로는 확인 불가 (아이폰 검사로 확인)'); return; }
    var m0 = Number(trkNow.mock) || 0, p0 = trkNow.pts.length;
    window.__e2eKeepMock = true;
    try{ await until(function(){ return (Number(trkNow.mock) || 0) >= m0 + 3; }, 30000, '거짓 위치 버림 (버린 수 ' + ((Number(trkNow.mock)||0) - m0) + ')'); }
    finally{ window.__e2eKeepMock = false; }
    var grew = trkNow.pts.length - p0;
    log('INFO 거짓 위치 버린 수 ' + ((Number(trkNow.mock)||0) - m0) + ' · 그동안 늘어난 점 ' + grew);
    if(grew > 1) throw new Error('거짓 위치인데 점이 ' + grew + '개 늘었음');
  });
  step('항해 — 입항하면 항적이 멈추고 남는가', async function(){
    openMR('voyage', S.voy); await sleep(400);
    arriveNow();
    await until(function(){ return !(typeof trkNow !== 'undefined' && trkNow && trkNow.vid); }, 20000, '항적 멈춤');
    var v = getMR('voyage', S.voy);
    await until(function(){ return v && v.trk && v.trk.length >= 2; }, 10000, '항해에 항적 저장');
    await shot('15-voyage-done');
  });
  step('승선 이력 종이', async function(){
    crewCvExport();
    // ★ 5.15 — 승선 이력은 서버에서 항해를 찾아온 뒤에 뜬다. 에뮬레이터는 1.5초 안에 못 받는다 → 15초까지 기다린다.
    await until(function(){ return $('#mrPanel .paperfr') || (typeof tellIsOpen === 'function' && tellIsOpen()); }, 15000, '종이도 안내도 안 뜸');
    await sleep(600); await shot('16-crewcv');
  });
  // ★ 12회째 작은 아이폰 — 날씨 서버가 한 번 대답을 안 해 「날씨를 불러오지 못했습니다」 가 떴다.
  //   앱은 「다시 시도」 단추를 내주고 있었다(맞는 동작). 검사는 그 단추를 눌러 한 번 더 기다린다.
  async function wxWait(pred, ms, what){
    var t0 = Date.now(), tried = 0;
    while(Date.now() - t0 < ms){
      try{ if(pred()) return true; }catch(_){}
      if(/불러오지 못했습니다|Could not load|Не удалось|読み込めませんでした/.test(txt('#weatherList')) && tried < 3){
        tried++; log('INFO 날씨를 못 받아 다시 시도 ' + tried);
        try{ wxData = null; renderWeather(); }catch(_){}
        await sleep(3000);
      }
      await sleep(250);
    }
    throw new Error('기다려도 안 됨: ' + what);
  }
  step('날씨·물때 — 여수', async function(){
    wxCur = { id:'e2e1', name:'여수', lat:34.7404, lon:127.7449 }; wxData = null;
    switchTab('home'); setHomeSub('weather');
    await wxWait(function(){ return wxData && /물때|만조|간조/.test(txt('#weatherList')); }, 60000, '여수 물때');
    await shot('17-wx-yeosu');
  });
  step('날씨·물때 — 도쿄', async function(){
    wxCur = { id:'e2e2', name:'東京', lat:35.62, lon:139.77 }; wxData = null; setHomeSub('weather');
    await wxWait(function(){ return wxData && wxData.key === (wxCur.lat+','+wxCur.lon) && /만조|간조/.test(txt('#weatherList')); }, 60000, '도쿄 물때');
    // ★ 6.0 — 1회째는 1000km 떨어진 한국 관측소 물때를 보고도 통과했다. 가까운 일본 관측소인지 본다.
    var sp = nearestTideSpot();
    if(!sp || !(sp.dist <= 150)) throw new Error('도쿄 물때가 먼 관측소 것 (' + (sp ? sp.name + ' ' + Math.round(sp.dist) + 'km' : '없음') + ')');
    log('INFO 도쿄 물때 관측소: ' + sp.name + ' ' + Math.round(sp.dist) + 'km');
    await shot('18-wx-tokyo');
  });
  step('날씨·물때 — 블라디보스토크(EOT20)', async function(){
    wxCur = { id:'e2e3', name:'Владивосток', lat:43.11, lon:131.88 }; wxData = null; setHomeSub('weather');
    await wxWait(function(){ return wxData && wxData.key === (wxCur.lat+','+wxCur.lon) && /EOT20/.test(txt('#weatherList')); }, 60000, 'EOT20 표시');
    await shot('19-wx-vlad');
  });
  step('다리 통과높이', async function(){
    wxCur = { id:'e2e1', name:'여수', lat:34.7404, lon:127.7449 }; wxData = null; setHomeSub('weather');
    await wxWait(function(){ return wxData; }, 60000, '여수 날씨(다리 칸)');
    quickClrInput('20'); await sleep(800);
    if(!/통과|배 높이/.test(txt('#weatherList'))) throw new Error('다리 칸 결과 없음');
    await shot('20-bridge');
  });
  step('체크리스트', async function(){
    setHomeSub('check'); await sleep(600);
    var el = $('#checkList [onclick^="toggleCheck("]') || $('[onclick^="toggleCheck("]');
    if(!el) throw new Error('체크 항목 없음');
    el.click(); await sleep(400); await shot('21-check');
  });
  step('달력', async function(){ setHomeSub('cal'); await sleep(800); await shot('22-cal'); });
  step('커뮤니티 — 글쓰기(사진 포함)', async function(){
    unlock(); switchTab('community'); setComSub('talk'); await sleep(800);
    writeTalk(); await sleep(600);
    var o0 = $('#fp0 .fopt'); if(o0) o0.click();
    var o1 = $('#fp1 .fopt'); if(o1) o1.click();
    setv('ff2', '[자동검사] 지워질 글 ' + S.run);
    if(typeof QL !== 'undefined' && QL.ff3){ QL.ff3.setText('자동 검사가 올린 글입니다. 곧 지워집니다.'); }
    try{ richInsert('ff3', [{ t:'photo', v:dot() }]); }catch(_){}
    formOk();
    var po = await until(function(){ return (talkList || []).find(function(x){ return String(x.title || '').indexOf(S.run) >= 0; }); }, 30000, '글 올라감');
    S.post = String(po.id); keep(S);
    await shot('23-post');
  });
  step('커뮤니티 — 댓글', async function(){
    writeTalkComment(S.post); await sleep(500);
    setv('ff0', '자동검사 댓글'); formOk();
    // ★ 13회째 아이패드 — 댓글은 화면에 달렸는데 목록(talkList)의 댓글 수가 아직 안 바뀌어 실패했다.
    //   글 화면에 댓글이 보이면 달린 것이다. 둘 중 하나면 통과로 본다.
    await until(function(){
      var p = (talkList || []).find(function(x){ return String(x.id) === S.post; });
      if(p && Number(p.cmtN) > 0) return true;
      return /자동검사 댓글/.test(txt('#mrPanel')) || /자동검사 댓글/.test(txt('body'));
    }, 30000, '댓글');
  });
  step('장터 — 물건 올리기(사진 포함)', async function(){
    unlock(); setComSub('market'); await sleep(600);
    writeItem(); await sleep(500);
    setv('mkTitle', '[자동검사] 물건 ' + S.run);
    try{ itemSet('free', true); }catch(_){}
    marketDraft.photos = [dot()];
    await itemSave();
    await until(function(){ return /자동검사/.test(txt('#mrPanel') + txt('body')); }, 20000, '장터');
    await sleep(2500);   // ★ 사진 올리기가 끝난 뒤 물건 화면이 늦게 열려 다음 단계 화면을 덮는다(안드로이드 3회째)
    await shot('24-market');
  });
  step('장터·정박지 사진 붙이기 함수(고친 것)', async function(){
    var out = await resizePhotos([dot()]);
    if(!Array.isArray(out) || !out.length) throw new Error('resizePhotos 가 사진을 안 돌려줌');
  });
  step('정박지 올리기', async function(){
    // 장터 글이 열린 채면 글쓰기 화면이 안 뜰 때가 있다(5회째) — 닫고 들어가서, 이름 칸이 보일 때까지 기다린다
    unlock(); try{ closeBoat(); }catch(_){} switchTab('community'); setComSub('spots'); await sleep(800);
    await until(function(){
      if($('#spName')) return true;
      try{ if(typeof closeMR === 'function') closeMR(); }catch(_){}
      try{ writeSpot(); }catch(_){}
      try{ spotPickCtx.draft = spotPickCtx.draft || {}; spotPickCtx.draft.lat = 34.73; spotPickCtx.draft.lon = 127.74; spotForm(); }catch(_){}
      return !!$('#spName');
    }, 15000, '정박지 이름 칸');
    await sleep(300);
    setv('spName', '[자동검사] 정박지 ' + S.run);
    await spotSave();
    await sleep(2000); await shot('25-spot');
  });
  step('다른 배 보기', async function(){ switchTab('others'); await sleep(1500); await shot('26-others'); });
  step('뉴스', async function(){ switchTab('home'); setHomeSub('news'); await sleep(2500); await shot('27-news'); });
  step('백업 파일 저장', async function(){
    var n = ERRS.length;
    await backupData(); await sleep(1500);
    var F = window.Capacitor.Plugins.Filesystem, found = false;
    for(var d of ['DOCUMENTS','DATA']){
      try{ var r = await F.readdir({ path:'Baetnil/backup', directory:d }); if(r && r.files && r.files.length){ found = d; break; } }catch(_){}
    }
    if(!found) throw new Error('백업 파일이 안 생김');
    S.bkdir = found; keep(S);
    if(errsSince(n).length) throw new Error(errsSince(n).join(' / '));
  });
  step('백업 되살리기', async function(){
    var F = window.Capacitor.Plugins.Filesystem;
    var r = await F.readdir({ path:'Baetnil/backup', directory:S.bkdir });
    var nm = (r.files[0].name || r.files[0]);
    var f = await F.readFile({ path:'Baetnil/backup/' + nm, directory:S.bkdir, encoding:'utf8' });
    var json = f.data;
    unlock();
    restoreData({ target:{ files:[ new File([json], 'b.json', { type:'application/json' }) ], value:'' } });
    await sleep(4000);
    if(!items.some(function(x){ return x.name === '검사물품'; })) throw new Error('되살린 뒤 물품이 없음');
  });
  step('설정·약관·알림 화면', async function(){
    openSettings(); await sleep(500); await shot('28-settings');
    openLegal('terms'); await sleep(500); await shot('29-terms');
    openNoti(); await sleep(500); await shot('30-noti');
    if(!window.Capacitor.Plugins.FirebaseMessaging) throw new Error('알림 부품(FirebaseMessaging) 없음');
  });
  step('언어 바꾸기 — 영어', async function(){
    S.i++; keep(S); log('OK 언어 바꾸기 — 영어(누름)'); S.ok++; keep(S);
    setLang('en'); await sleep(60000);
  }, { reloads:true });
  step('영어 화면 확인 후 한국어로', async function(){
    await sleep(1500);
    if(langNow() !== 'en') throw new Error('영어로 안 바뀜');
    await shot('31-english');
    S.i++; keep(S); log('OK 영어 화면 확인 후 한국어로'); S.ok++; keep(S);
    setLang('ko'); await sleep(60000);
  }, { reloads:true });
  step('다른 계정(B) 가입', async function(){
    await sleep(1500);
    await signOut();
    await emailLogin(S.b, true);
    S.b.uid = window.__user.uid; keep(S);
  });
  step('B — 참여 코드로 신청', async function(){
    joinByCode(); await sleep(500);
    setv('ff0', S.boat); setv('ff1', '자동검사 참여 신청'); formOk();
    await sleep(3000); await shot('32-join');
  });
  step('B — A 의 글 신고', async function(){
    switchTab('community'); setComSub('talk'); await sleep(2000);
    var seen = function(){
      var byId = (talkList || []).some(function(x){ return String(x.id) === S.post; });
      if(byId) return true;
      var byT = (talkList || []).find(function(x){ return String(x.title || '').indexOf(S.run) >= 0; });
      if(byT){ log('INFO A 글이 다른 번호로 보임 ' + S.post + ' → ' + byT.id); S.post = String(byT.id); keep(S); return true; }
      return false;
    };
    try{ await until(seen, 10000, 'A 글 보임'); }
    catch(e){
      // 무엇이 보였는지 남기고, 사람이 하듯 목록을 새로 받아 본다
      log('INFO 글판 ' + (talkList || []).length + '개 · 찾는 글 ' + S.post + ' · 앞 3개 ' + (talkList || []).slice(0,3).map(function(x){ return x.id; }).join(','));
      listRefresh('talk');
      await until(seen, 20000, 'A 글 보임 (새로 받은 뒤)');
    }
    reportTalk(S.post); await sleep(500);
    var o = $('#fp0 .fopt'); if(o) o.click();
    formOk();
    await until(function(){ var p = talkList.find(function(x){ return String(x.id) === S.post; }); return p && p.reports && p.reports[S.b.uid]; }, 20000, '신고 들어감');
    await shot('33-report');
  });
  step('B — A 차단', async function(){
    await mutePersonUI(S.a.uid, 'A');
    if(hiddenPeople().indexOf(S.a.uid) < 0) throw new Error('차단 목록에 없음');
    openMuted(); await sleep(500); await shot('34-muted');
  });
  step('B — 계정 삭제', async function(){
    S.i++; keep(S);
    await openWipe(); await sleep(800); await shot('35-wipe');
    askWipe(); await sleep(400); setv('ff0', WIPE_WORD); formOk();
    await sleep(8000);
    log('OK B — 계정 삭제(누름)'); S.ok++; keep(S);
    await sleep(60000);
  }, { reloads:true });
  step('B 가 지워졌는가 — 다시 로그인 안 됨', async function(){
    await sleep(2000);
    if(window.__user) throw new Error('아직 로그인되어 있음');
    openAccount(); await sleep(300); setv('acEm', S.b.em); setv('acPw', S.b.pw); doEmail(false);
    await sleep(6000);
    if(window.__user) throw new Error('지운 계정으로 로그인됨');
  });
  step('A 다시 로그인 · 배 지우기', async function(){
    await emailLogin(S.a, false);
    await until(function(){ return boats.some(function(b){ return String(b.id) === S.boat; }); }, 30000, '클라우드에서 배 받아옴');
    unlock();
    askDelBoat(S.boat); await sleep(1500);
    var b = boats.find(function(x){ return String(x.id) === S.boat; });
    setv('ff0', b ? b.name : '자동검사배2'); formOk();
    await until(function(){ return !boats.some(function(x){ return String(x.id) === S.boat; }); }, 20000, '배 지워짐');
  });
  step('A — 계정 삭제(글·장터·정박지도 함께)', async function(){
    S.i++; keep(S);
    await openWipe(); await sleep(1500);
    askWipe(); await sleep(400); setv('ff0', WIPE_WORD); formOk();
    await sleep(8000);
    log('OK A — 계정 삭제(누름)'); S.ok++; keep(S);
    await sleep(60000);
  }, { reloads:true });
  step('A 가 지워졌는가', async function(){
    await sleep(2000);
    if(window.__user) throw new Error('아직 로그인되어 있음');
  });
  // ── 네이티브 창 — 깃허브 맥이 사진을 찍고 앱을 다시 켠다 ──
  step('애플 로그인 — 아이폰 로그인 창이 뜨는가', async function(){
    openAccount(); await sleep(500);
    if(needAgree()){ openAgree(function(){}); await sleep(300); agreeAll(); doAgree(); await sleep(300); openAccount(); }
    S.i++; keep(S);
    log('NATIVE apple');
    doApple();
    await sleep(60000);
  }, { reloads:true });
  step('구글 로그인 — 아이폰 로그인 창이 뜨는가', async function(){
    await sleep(2000);
    openAccount(); await sleep(500);
    S.i++; keep(S);
    if(needAgree()){ openAgree(function(){}); await sleep(300); agreeAll(); doAgree(); await sleep(300); openAccount(); }
    log('NATIVE google');
    doGoogle();
    await sleep(60000);
  }, { reloads:true });
  step('공유 창', async function(){
    await sleep(2000);
    S.i++; keep(S);
    log('NATIVE share');
    saveFile('baetnil-e2e.txt', 'text/plain', 'e2e');
    await sleep(60000);
  }, { reloads:true });
  step('폰 달력에 넣기 창', async function(){
    await sleep(2000);
    var P = window.Capacitor.Plugins.CapacitorCalendar;
    if(!P) throw new Error('달력 부품 없음');
    S.i++; keep(S);
    log('NATIVE calendar');
    P.createEventWithPrompt({ title:'뱃일 자동검사', isAllDay:true, startDate:Date.now(), endDate:Date.now() + 864e5 });
    await sleep(60000);
  }, { reloads:true });

  if(MODE === 'quick'){
    // 아이패드·작은 아이폰 — 계정은 만들지 않고 화면만 훑는다
    STEPS = STEPS.filter(function(s){ return /부팅|첫 설정|환영|로그인 화면|날씨·물때 — 여수|달력$|뉴스|설정·약관/.test(s.name); });
  }

  // 시스템 권한 창(알림)은 시뮬레이터에서 미리 허락해 둘 수가 없어 화면을 막는다 — 묻는 문만 비켜 둔다.
  // (위치·사진·달력 권한은 깃허브 맥이 simctl privacy 로 미리 허락해 둔다.)
  try{ window.trkAskNoti = async function(){ return 'granted'; }; }catch(_){}
  try{ window.notiAsk = async function(){ return 'granted'; }; }catch(_){}
  // 시뮬레이터가 주는 위치는 iOS 가 「소프트웨어가 만든 위치」 로 표시한다(isSimulatedBySoftware).
  // 앱은 거짓 위치 앱을 막으려고 그런 점을 버린다 — 검사에서만 그 표시를 떼고 넘긴다.
  // (그래서 이 검사는 「거짓 위치 거르기」 자체는 재지 않는다. 보고에 그렇게 적는다.)
  try{
    if(typeof trkPush === 'function'){
      var _tp = trkPush;
      window.trkPush = function(pos){ try{ if(pos && !window.__e2eKeepMock) pos.simulated = false; }catch(_){} return _tp.apply(this, arguments); };
    }
  }catch(_){}
  // 화면이 꺼진 동안 쌓인 점(BaetnilTrack.drain)에도 거짓 위치 표시("mk":1)가 붙는다 — 검사에서만 뗀다
  try{
    var BT = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.BaetnilTrack;
    if(BT && typeof BT.drain === 'function'){
      var _dr = BT.drain.bind(BT);
      BT.drain = function(){ return _dr.apply(null, arguments).then(function(r){
        try{ if(!window.__e2eKeepMock && r && r.pts) r.pts.forEach(function(q){ if(q) delete q.mk; }); }catch(_){}
        return r; }); };
    }
  }catch(_){}

  async function run(){
    await sleep(1500);
    while(S.i < STEPS.length){
      var st = STEPS[S.i];
      var n0 = ERRS.length, i0 = S.i;
      try{
        await st.fn();
        if(S.i !== i0){
          // 다시 켜져야 하는 단계인데 60초가 지나도 안 켜졌다
          log('FAIL ' + st.name + ' — 앱이 다시 켜지지 않음'); S.fail++; keep(S);
          continue;
        }
        var e = errsSince(n0);
        if(e.length) throw new Error('오류 자국: ' + e.join(' / ').slice(0, 300));
        log('OK ' + st.name); S.ok++;
      }catch(err){
        log('FAIL ' + st.name + ' — ' + String((err && err.message) || err).slice(0, 400));
        S.fail++;
        try{ await shot('fail-' + S.i); }catch(_){}
      }
      S.i++; keep(S);
    }
    log('DONE ' + S.ok + '/' + STEPS.length + ' fail=' + S.fail);
  }
  if(document.readyState === 'complete') run(); else window.addEventListener('load', run);
})();
