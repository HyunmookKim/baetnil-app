// 같은 함수가 두 번 정의되면 뒤엣것이 앞엣것을 덮어쓴다.
// 문법 검사로는 안 잡히므로 따로 본다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const i = src.indexOf('<script>') + 8, j = src.indexOf('</script>', i);
const js = src.slice(i, j);

const re = /^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm;
const seen = new Map();
let m;
while((m = re.exec(js))){
  seen.set(m[1], (seen.get(m[1]) || 0) + 1);
}
const dups = [...seen].filter(([,n]) => n > 1);

// 최상위 let/const 중복도 본다
const re2 = /^(?:let|const)\s+([A-Za-z_$][\w$]*)\s*=/gm;
const seen2 = new Map();
while((m = re2.exec(js))) seen2.set(m[1], (seen2.get(m[1]) || 0) + 1);
const dups2 = [...seen2].filter(([,n]) => n > 1);

// 화면에서 부르는 함수가 실제로 있는지 본다.
// 코드를 옮기다가 함수를 통째로 지워도 문법 검사로는 안 잡힌다.
const MUST_EXIST = [
  'drawShapes','setLkTool','toggleLkEdit','lkMenu','lkAdd','lkMove','lkResize','lkDelete',
  'lkRename','lkRezone','shAdd','shMove','shResize','shDelete','shSvg','shBox',
  'openForm','closeForm','formOk','formDel','formChip',
  'openDgPick','closeDgPick','chooseDgPick','dgPickBuiltin','dgPickLib','uploadDg',
  'openFleet','openBoatInfo','askDelBoat','delBoatData','boatKeys','canDelBoat',
  'applyStowDg','buildBoxes','refreshBoxes','restoreData','backupData',
  'shCanEdit','lkCanEdit','setDgLock','setLkLock','toggleDgLock','toggleLkLock','paintLockBtns',
  'undoPush','undoRun','redoRun','canUndo','canRedo','undoClear','paintUndoBtns','shOf','shMapOf',
  'setMrTool','toggleMrDraw','mrPct','mrDrawBind','mrMapClick','setMapKind',
  'supportInfo','openSupport','sendSupport','supportMail','adminSupport','supportDone',
  'nearestTideSpotAt','tidePtsOf','tideAtPlace','lowTideDepth',
  'spotDepthCalc','spotDepthAdj','spotDepthTime','spotDepthNow','spotDepthApply','spotDepthCancel',
  'setBizUI',
  'legalText','openLegal','needAgree','openAgree','drawAgree','doAgree','pushAgree','agreeState',
  'collHash','syncBase','saveSyncBase','clearSyncBase','mergeColl','syncPlan','syncReconcile','localColl',
  'listFresh','listSet','listDrop','listRows','listDone','listRefresh','listMore','listFoot',
  'talkMore','marketMore','spotMore',
  'cloudErrText','cloudErrHelp',
  'spotRowsHtml','spotFilter','marketRowsHtml','marketFilter','exploreRowsHtml','exploreFilterUI',
  'makeThumb','toStored','thumbOf','listAll','needEdit',
  'langNow','t','langCoverage','langReady','setLang','openLang','applyLang',
  'featOn','loadFeat','setFeat','comSubList','featClosedHtml','adminFeat','josa','itemOf','catName','stateName','canDelItem','canEditItem','marketNotice','marketSafety','marketFirstNotice','priceText','renderMarket','itemMatch','setMarketCat','backToMarket','openItem','writeItem','itemForm','itemKeep','itemSet','itemPhoto','itemSave','setItemState','delItem','reportItem','spotOf','spotKindName','canDelSpot','canEditSpot','spotShelterText','spotDepthText','renderSpots','spotMatch','setSpotKind','openSpot','backToSpots','writeSpot','spotPickPlace','spotUseGPS','spotPlaceNext','spotForm','spotSet','spotDir','spotFac','spotKeep','spotPhoto','spotSave','regionOfPoint','delSpot','reportSpot','renderCurrent','saveBoatCloud','retryDirtyBoats','saveDirtyList','boatTabsFor','canPush','peopleMerge','joinByCode','exploreFilter','setExploreBiz','wxSpotRows','wxSpotList','wxAddSpot','wxEditSpot','wxSpotPick','wxSpotGPS','wxSpotSave','wxDelSpot','boatRegion','talkPickRecord','talkRecordText','talkRecordBlocks','pinShot','closeRecPick','recPickTake','needWelcome','welcomeSkipped','skipWelcome','openWelcome','closeBoatSetup','needBoatCard','boatNeedGuard','wxNowIdx','wxStamp','ensureWx','reefText','wxWhenText','shStyleOf','shSetStyle','setShStyle','paintShStyles','lkOverlap','lkOverlapOk',
  'formPickSet','addCheckList','renameCheckList','addCheckItem','editCheckItem','moveCheckItem',
  'delCheckList','delCheckItem','selectCheckList','ckLists','ckCurId',
  'doDelBoat','tideInput','wxAddSpot','hatAddOne','hatEditOne','paintVer','openDrawer','closeDrawer',
  'pickRank','removeMemberUI','memberRows','removeMember','ownerCount','seedRanks','migrateRanks','rankOf','ownerRank','myRank','myPos',
  'permOf','can','canTouchRank','canTouchMember','rankList','addRank','editRank','delRank','setPerm','assignRank',
  'rankSummary','openRanks','addRankUI','editRankUI','renameRankUI','setPermUI','delRankUI','mkPerms',
  'rosterOf','setRoster','duesDue','nextDueDate','isAway','rosterAlerts','payDues','dParts','dStr','addDay',
  'openRoster','editRoster','askPay','toggleOpenJoin',
  'taskItem','assignTask','taskOwnerName','openTasksOf','myTasks','taskCount','pickAssignee','openMyTasks',
  'meUid','meName','canNotice','canEditPost','addPost','postOf','editPost','delPost','postList',
  'addComment','delComment','openBoard','writePost','openPost','writeComment','delCommentUI',
  'pubOn','isPublic','setPub','buildPublic','openPublish','setPubUI','pushPublic',
  'openIntro','saveIntro','addIntro','moveIntro','delIntro','openExplore','openBoatPage',
  'hiddenBoats','saveHidden','hideBoat','unhideBoat','isHidden','filterHidden','reportBody',
  'reportBoat','hideBoatUI','openHidden','unhideBoatUI','paintMenuPerms','hhmmToH','sailHours','engineHoursFromLogs','fillSailHours','fillEngineHours','logRows','logAdd','logField','wxWarnings','reefStage','boatWxCard','boatSpec','setBoatSpec','hm','wxAt','paintBoatWx','krCurrentKt','maintCounts','maintFilter','setMaintMode','renderMaintList','suggestWxLimits','applyWxLimits','refillWxLimits','logEngine','measureHeader','cloudSeedCheck','cloudSeedAsked','syncNow','syncTap','pushNow',
  'memberBlock','editMember','saveBoatMembers','joinBoat','openJoinReqs','approveJoin','rejectJoin','copyJoinCode',
  'mergeCloudBoats','seedAskMark','lkShapeOf','lkSetShape','syncUp','syncDown','mrSaveClose','forceReload','lkScale','showPanel','restorePanel','saveSpecNow','verBanner','blocksFromText','renderBlocks','partsToText','postPhotos','blocksToDelta','deltaToBlocks','qlRead','qlMake','onRichPaste','richMark','richInsert','richStatus','richPickPhoto','editIntro','setComSub','paintNewsDot','setHomeSub','setBoatSubTab','renderHome','homeCard','setHeadTitle','boatHead','boatKeepTabs','paintHNav','curScreen','navPush','backToExplore','renderTalk','writeTalk','openTalk','reportTalk','delTalk','canDelTalk','isAdmin','loadAdmin','talkBody','backToTalk','setTalkKind','setTalkRegion','talkPhotos','writeTalkComment','delTalkComment','pasteParts','photoBudget','resizePhoto','resizePhotos','formPhotoAdd','formPhotoDel','formPhotoPick','onFormPaste','renderFormPhotos',
  'paintAdminMenu','copyMyUid','openAdmin','setAdminTab','adminUnhide','adminDel',
  'adminAdd','adminMyUid','adminIsMe',
  'adminGuard','banGuard','boatModGuard','isOwnerAdmin','loadMyBan','banNotice','claimOwner',
  'adminReports','adminBoats','adminBoatHide','adminBoatDel','adminPeople','peopleRowsHtml',
  'paintPeopleRows','personFilter','openPerson','personPerm','personAppoint','personRemove',
  'personBan','personUnban','adminAdmins',
  'newMoonJD','lastNewMoonKST','lunarDay','tideIdx','tideName','tideMark','tideStyle',
  'setTideStyle','tideRow','isFishing','fishOf','fishField','catchAdd','catchN','catchCm',
  'catchDel','catchTotal','catchCount','fishRows','catchBox'
];
const gone = MUST_EXIST.filter(n => !seen.has(n));

// onclick= 으로 부르는 함수가 정의되어 있는지도 본다
const calls = new Set();
let c;
const reC = /onclick="([A-Za-z_$][\w$]*)\(/g;
while((c = reC.exec(src))) calls.add(c[1]);
const missingCalls = [...calls].filter(n => !seen.has(n)
  && !/^(alert|confirm|prompt|history|window|location)$/.test(n));

// 화면 id 가 겹치면 앞의 것만 잡힌다. 엉뚱한 자리가 바뀌는데 오류는 안 난다.
const idRe = /\bid="([A-Za-z_][\w-]*)"/g;
const idCount = new Map();
let im;
while((im = idRe.exec(src))) idCount.set(im[1], (idCount.get(im[1])||0) + 1);
const dupIds = [...idCount].filter(([,n]) => n > 1).map(x=>x[0]);

// 앱에 적힌 버전과 sw.js 캐시 이름이 어긋나면 안 된다.
// 어긋나면 브라우저가 옛 파일을 계속 물고 있으면서 새 버전인 척한다.
let verMsg = '', verBad = false;
{
  const m = src.match(/const APP_VER = '([^']+)'/);
  let sw = null;
  try{ sw = fs.readFileSync(require('path').join(require('path').dirname(process.argv[2]||'work.html'), 'sw.js'), 'utf8'); }
  catch(e){ try{ sw = fs.readFileSync('sw.js','utf8'); }catch(_){} }
  const c = sw && sw.match(/const CACHE = 'baetnil-([^']+)'/);
  if(!m){ verBad = true; verMsg = '앱에 버전(APP_VER)이 없다'; }
  else if(!c){ verBad = true; verMsg = 'sw.js 캐시 이름을 못 읽었다'; }
  else if(m[1] !== c[1]){ verBad = true; verMsg = `앱 ${m[1]} vs sw.js ${c[1]}`; }
  else verMsg = m[1];
}

let fail = 0;
if(verBad){ fail++; console.log('★ 실패: 버전이 어긋남 — ' + verMsg); }
else console.log('통과: 앱 버전과 sw.js 캐시 이름이 같다 (' + verMsg + ')');

if(dupIds.length){ fail++; console.log('★ 실패: 화면 id 가 겹침 — ' + dupIds.join(', ')); }
else console.log('통과: 화면 id 가 겹치지 않는다');

if(gone.length){ fail++; console.log('★ 실패: 있어야 할 함수가 사라짐 — ' + gone.join(', ')); }
else console.log('통과: 있어야 할 함수가 모두 있다');
if(missingCalls.length){ fail++; console.log('★ 실패: 버튼이 부르는 함수가 없음 — ' + missingCalls.join(', ')); }
else console.log('통과: 버튼이 부르는 함수가 모두 있다');

if(dups.length){ fail++; console.log('★ 실패: 함수가 두 번 정의됨 — ' + dups.map(d=>`${d[0]}(${d[1]}번)`).join(', ')); }
else console.log('통과: 같은 이름의 함수가 겹치지 않는다');
if(dups2.length){ fail++; console.log('★ 실패: 변수가 두 번 선언됨 — ' + dups2.map(d=>`${d[0]}(${d[1]}번)`).join(', ')); }
else console.log('통과: 같은 이름의 변수가 겹치지 않는다');

console.log('\n합계: ' + (6-fail) + '개 통과 / ' + fail + '개 실패');
if(fail) process.exit(1);
