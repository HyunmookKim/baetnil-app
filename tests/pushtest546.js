// 5.46 — 푸시 알림 글이 받는 사람 말로 나가는지 (서버 함수를 가짜 Firestore·FCM 으로 실제로 돌려 본다)
const Module = require('module'); const path = require('path');
const FILE = path.resolve(process.argv[2] && /functions/.test(process.argv[2]) ? process.argv[2] : path.join(__dirname, 'fn', 'functions', 'index.js'));
const sent = []; let DB = {};
const upd = [];
const docRef = (coll, id) => ({ id, async get(){ const v = (DB[coll] || {})[id]; return { exists: !!v, data: () => v, id }; },
  async update(o){ upd.push([coll, id, o]); Object.assign((DB[coll] || {})[id] || {}, o); }, async set(){}, ref: null });
const fake = {
  'firebase-functions/v2/https': { onCall: (o, f) => f || o, onRequest: (o, f) => f || o, HttpsError: Error },
  'firebase-functions/v2/firestore': { onDocumentCreated: (o, f) => f, onDocumentWritten: (o, f) => f },
  'firebase-functions/v2/scheduler': { onSchedule: (o, f) => f },
  'firebase-functions/params': { defineSecret: () => ({ value: () => '' }), defineString: () => ({ value: () => '' }) },
  'firebase-functions': { setGlobalOptions(){}, logger: console },
  'firebase-functions/v2': { setGlobalOptions(){} },
  'firebase-admin/app': { initializeApp(){} },
  'firebase-admin/firestore': { getFirestore: () => ({ collection: c => ({ doc: id => docRef(c, id),
      where(){ return this; }, limit(){ return this; },
      async get(){ const ids = Object.keys(DB[c] || {}); return { size: ids.length, docs: ids.map(id => ({ id, data: () => DB[c][id], ref: docRef(c, id) })) }; } }) }),
    FieldValue: { arrayRemove: () => 0, serverTimestamp: () => 0, increment: () => 0 } },
  'firebase-admin/messaging': { getMessaging: () => ({ async sendEachForMulticast(m){ sent.push(m); return { responses: m.tokens.map(() => ({ success: true })) }; } }) },
  '@google-cloud/translate': { v2: { Translate: function(){} } }
};
const orig = Module._load;
Module._load = function(req, parent, isMain){ if(fake[req]) return fake[req]; return orig.apply(this, arguments); };
const ex = require(FILE);
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + ' — ' + JSON.stringify(w)); } };
(async () => {
  for(const L of ['ko','en','ru','ja', undefined]){
    DB = { push: { owner: { on:true, myComment:true, boatPlan:true, tokens:['t1'], lang:L } },
           community: { p1: { by:'owner', title:'' } } };
    sent.length = 0;
    await ex.pushTalkComment({ params:{ postId:'p1' }, data:{ data: () => ({ by:'x', byName:'Kim', text:'hi' }) } });
    const want = { ko:'내 글', en:'My post', ru:'Моя запись', ja:'自分の投稿', undefined:'내 글' }[String(L)];
    T('댓글 알림 제목 (' + L + ') = ' + (sent[0] && sent[0].notification.title), sent[0] && sent[0].notification.title === want, sent[0]);
    // 출항 예정
    sent.length = 0;
    const after = { exists:true, id:'v1', data: () => ({ now:'n1', who:['owner'], by:'me', boatName:'', date:'2026-10-09', timeOut:'08:00', what:'' }), ref:{ async update(){} } };
    await ex.pushPlanNow({ data:{ after } });
    const m = sent[0] && sent[0].notification;
    const wt = { ko:['배 — 출항 예정','2026-10-09 08:00 출항 예정입니다.'], en:['Boat — upcoming departure','Departing on 2026-10-09 08:00.'],
                 ru:['Судно — запланирован выход','Выход запланирован на 2026-10-09 08:00.'], ja:['船 — 出港予定','2026-10-09 08:00に出港予定です。'] }[L || 'ko'];
    T('출항 예정 알림 (' + L + ') = ' + JSON.stringify(m), m && m.title === wt[0] && m.body === wt[1], m);
  }
  // 소식 묶음 — 그 사람 아침 8시에, 그 사람 말 기준의 「내 소식/세계 소식」 으로
  {
    const h = new Date().getUTCHours(); let o = (8 - h + 24) % 24; if(o > 14) o -= 24;      // UTC+o 가 지금 아침 8시
    const tz8 = o === 0 ? 'Etc/GMT' : 'Etc/GMT' + (o > 0 ? '-' : '+') + Math.abs(o);
    let o2 = (o + 6) % 24; if(o2 > 14) o2 -= 24; const tzNot = o2 === 0 ? 'Etc/GMT' : 'Etc/GMT' + (o2 > 0 ? '-' : '+') + Math.abs(o2);
    const now = new Date().toISOString(), old = new Date(Date.now() - 3 * 864e5).toISOString();
    global.fetch = async u => ({ ok: true, json: async () => /kr\.json/.test(u)
      ? { gov: [ { cat:'안전', date: now }, { cat:'규정', date: now }, { cat:'안전', date: old } ] }
      : { items: [ { cat:'레이스', lang:'en', date: now }, { cat:'산업', lang:'ru', date: now }, { cat:'안전', lang:'ja', date: now } ] } });
    const base = { on:true, tokens:['t'], krCats:['안전','산업','레이스'], wwCats:['레이스','산업'] };
    DB = { push: { ko: Object.assign({ lang:'ko', tz: tz8 }, base), ru: Object.assign({ lang:'ru', tz: tz8 }, base),
                   ja: Object.assign({ lang:'ja', tz: tz8 }, base), late: Object.assign({ lang:'en', tz: tzNot }, base) } };
    sent.length = 0; upd.length = 0;
    await ex.pushNewsDaily();
    const by = {}; sent.forEach(m => { by[m.tokens[0] + (by[m.tokens[0]+'#'] = (by[m.tokens[0]+'#']||0)+1)] = m.notification; });
    const ns = sent.map(m => m.notification);
    // ko: 내 소식(관 자료) 안전 1 + 세계 레이스 1·산업 1 = 3 / ru: 내 소식(러시아어 기사) 산업 1 + 세계 레이스 1·(일본어 안전은 wwCats 에 없음) = 2 / ja: 내 소식 안전 1 + 세계 레이스·산업 2 = 3
    T('소식 — 아침 8시인 세 사람에게만 (8시가 아닌 사람은 안 보냄): ' + ns.length + '건', ns.length === 3, ns);
    T('소식 — 한국어: 「오늘의 소식 3건」', ns.some(n => n.title === '오늘의 소식 3건' && /안전/.test(n.body)), ns);
    T('소식 — 러시아어: 「Новости по моим темам: 2」 · 분야도 러시아어', ns.some(n => n.title === 'Новости по моим темам: 2' && /Индустрия/.test(n.body) && /Регаты/.test(n.body)), ns);
    T('소식 — 일본어: 「関心分野のニュース 3件」 · 分野は日本語', ns.some(n => n.title === '関心分野のニュース 3件' && /安全/.test(n.body)), ns);
    T('소식 — 보낸 사람은 오늘 날짜를 적어 다시 안 보냄', upd.filter(u => u[2].newsDay).length === 3);
    sent.length = 0; await ex.pushNewsDaily();
    T('소식 — 같은 날 다시 돌아도 안 보냄', sent.length === 0, sent.length);
  }
  // 한국어로 된 것이 외국어 알림에 남지 않는다 — 소스 정적 확인
  const src = require('fs').readFileSync(FILE, 'utf8');
  T('알림 글을 한국어로 박아 보내는 곳이 없다', !/sendTo\([^)]*'[^']*[가-힣]/.test(src) && !/\|\| '내 글'|'오늘의 소식 '|' — 출항 예정'/.test(src));
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패'); process.exit(bad ? 1 : 0);
})().catch(e => { console.log('★ 실패: 검사 자체 오류 — ' + e.stack); process.exit(1); });
