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
  var MODE = (function(){
    try{
      var u = navigator.userAgent || '';
      if(/iPad/.test(u) || (/Macintosh/.test(u) && (navigator.maxTouchPoints || 0) > 1)) return 'quick';
      if(Math.min(screen.width, screen.height) <= 400) return 'quick';   // 아이폰 16e·17(390~402)은 작은 쪽
    }catch(_){}
    return 'full';
  })();
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
  function log(m){ console.log(TAG + m); }
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
  async function shot(name){ log('SHOT ' + name); await sleep(2500); }
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
  async function emailLogin(acc, isNew){
    openAccount(); await sleep(400);
    setv('acEm', acc.em); setv('acPw', acc.pw);
    doEmail(!!isNew);
    await agreeIfAsked();
    await until(function(){ return window.__user && window.__user.email === acc.em; }, 30000,
      '로그인 상태 (acMsg: ' + txt('#acMsg') + ')');
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
    openAccount(); await sleep(600); await shot('03-login');
    if(!$('.lgbtn.lg-a')) throw new Error('애플 단추 없음');
    if(!$('.lgbtn.lg-g')) throw new Error('구글 단추 없음');
    if(!$('#acEm') || !$('#acPw')) throw new Error('이메일 칸 없음');
    if(!/비밀번호 찾기/.test(txt('#mrPanel'))) throw new Error('비밀번호 찾기 없음');
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
    openBoatSetup(); await sleep(800); await shot('07-boat-setup');
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
  step('항해 — 입항하면 항적이 멈추고 남는가', async function(){
    openMR('voyage', S.voy); await sleep(400);
    arriveNow();
    await until(function(){ return !(typeof trkNow !== 'undefined' && trkNow && trkNow.vid); }, 20000, '항적 멈춤');
    var v = getMR('voyage', S.voy);
    await until(function(){ return v && v.trk && v.trk.length >= 2; }, 10000, '항해에 항적 저장');
    await shot('15-voyage-done');
  });
  step('승선 이력 종이', async function(){
    crewCvExport(); await sleep(1500); await shot('16-crewcv');
    if(!$('#mrPanel .paperfr') && !(typeof tellIsOpen === 'function' && tellIsOpen())) throw new Error('종이도 안내도 안 뜸');
  });
  step('날씨·물때 — 여수', async function(){
    wxCur = { id:'e2e1', name:'여수', lat:34.7404, lon:127.7449 }; wxData = null;
    switchTab('home'); setHomeSub('weather');
    await until(function(){ return wxData && /물때|만조|간조/.test(txt('#weatherList')); }, 30000, '여수 물때');
    await shot('17-wx-yeosu');
  });
  step('날씨·물때 — 도쿄', async function(){
    wxCur = { id:'e2e2', name:'東京', lat:35.62, lon:139.77 }; wxData = null; setHomeSub('weather');
    await until(function(){ return wxData && wxData.key === (wxCur.lat+','+wxCur.lon) && /만조|간조/.test(txt('#weatherList')); }, 40000, '도쿄 물때');
    // ★ 6.0 — 1회째는 1000km 떨어진 한국 관측소 물때를 보고도 통과했다. 가까운 일본 관측소인지 본다.
    var sp = nearestTideSpot();
    if(!sp || !(sp.dist <= 150)) throw new Error('도쿄 물때가 먼 관측소 것 (' + (sp ? sp.name + ' ' + Math.round(sp.dist) + 'km' : '없음') + ')');
    log('INFO 도쿄 물때 관측소: ' + sp.name + ' ' + Math.round(sp.dist) + 'km');
    await shot('18-wx-tokyo');
  });
  step('날씨·물때 — 블라디보스토크(EOT20)', async function(){
    wxCur = { id:'e2e3', name:'Владивосток', lat:43.11, lon:131.88 }; wxData = null; setHomeSub('weather');
    await until(function(){ return wxData && wxData.key === (wxCur.lat+','+wxCur.lon) && /EOT20/.test(txt('#weatherList')); }, 40000, 'EOT20 표시');
    await shot('19-wx-vlad');
  });
  step('다리 통과높이', async function(){
    wxCur = { id:'e2e1', name:'여수', lat:34.7404, lon:127.7449 }; wxData = null; setHomeSub('weather');
    await until(function(){ return wxData; }, 30000);
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
    await until(function(){ var p = talkList.find(function(x){ return String(x.id) === S.post; }); return p && Number(p.cmtN) > 0; }, 20000, '댓글');
  });
  step('장터 — 물건 올리기(사진 포함)', async function(){
    unlock(); setComSub('market'); await sleep(600);
    writeItem(); await sleep(500);
    setv('mkTitle', '[자동검사] 물건 ' + S.run);
    try{ itemSet('free', true); }catch(_){}
    marketDraft.photos = [dot()];
    await itemSave();
    await until(function(){ return /자동검사/.test(txt('#mrPanel') + txt('body')); }, 20000, '장터');
    await shot('24-market');
  });
  step('장터·정박지 사진 붙이기 함수(고친 것)', async function(){
    var out = await resizePhotos([dot()]);
    if(!Array.isArray(out) || !out.length) throw new Error('resizePhotos 가 사진을 안 돌려줌');
  });
  step('정박지 올리기', async function(){
    unlock(); setComSub('spots'); await sleep(600);
    writeSpot(); await sleep(600);
    spotPickCtx.draft = spotPickCtx.draft || {};
    spotPickCtx.draft.lat = 34.73; spotPickCtx.draft.lon = 127.74;
    try{ spotForm(); }catch(_){}
    await sleep(500);
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
      window.trkPush = function(pos){ try{ if(pos) pos.simulated = false; }catch(_){} return _tp.apply(this, arguments); };
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
