// 뱃일 — 글 번역
//
// ★ 왜 앱이 아니라 여기서 부르나
//   번역은 열쇠가 있어야 쓴다. 뱃일은 index.html 하나가 사람들 폰으로 통째로 내려가므로
//   거기에 열쇠를 적으면 누구나 열어 보고 가져다 쓴다. 요금은 앱 주인 앞으로 달린다.
//   그래서 열쇠는 여기에만 둔다. 앱은 '이 글을 이 말로 옮겨 줘' 라고 부탁만 한다.
//
// ★ 열쇠를 따로 만들지 않는다
//   이 함수는 프로젝트 자격으로 돌기 때문에 번역 API 를 그냥 부를 수 있다.
//   열쇠 파일을 만들어 두면 그것이 또 새어 나갈 자리가 된다.
//
// ★ 한 번 옮긴 것은 그 글 밑에 담아 둔다 (…/tr/{말})
//   같은 글을 다음 사람이 볼 때는 번역을 다시 부르지 않는다 — 그만큼 돈이 안 든다.
//   담는 것도 여기서 한다. 앱에는 쓰기 권한을 주지 않는다.

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const crypto = require('crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { Translate } = require('@google-cloud/translate').v2;

initializeApp();

// ★ 번역기를 올려 둘 때 바로 만들지 않는다.
//   new Translate() 는 자격을 찾느라 파일을 읽고 바깥에 물어보기도 한다.
//   그 일이 '올리기' 때 코드를 읽어 보는 10초 안에 안 끝나면
//   「User code failed to load … Timeout after 10000」 으로 올리기가 통째로 막힌다.
//   처음 쓸 때 만들면 올릴 때는 아무 일도 안 한다.
let _tx = null;
const tx = () => (_tx || (_tx = new Translate()));

// ★ 옮길 수 있는 곳과 칸을 여기 적힌 것으로만 못 박는다.
//   앱이 보내는 대로 아무 글이나 옮겨 주면, 남이 긴 글을 계속 밀어 넣어
//   요금을 태울 수 있다. 여기 없는 곳은 아예 안 받는다.
//
// ★ 여기 적힌 곳은 모두 '로그인한 사람이면 누구나 읽는' 곳이다.
//   이 함수는 관리자 자격으로 돌아 규칙을 거치지 않는다. 그래서 남의 배 안(boats)
//   같은 곳을 여기 적으면 번역을 통해 통째로 새어 나간다. boatPublic 은
//   둘러보기에 내놓은 공개 사본이라 새어 나갈 것이 없다.
//
//   text     — 글자 칸을 그대로 옮긴다
//   blocks   — 덩이 배열(글·사진 섞임)에서 글자만 뽑아 옮긴다. 사진은 건드리지 않는다.
//   comments — 글 밑에 달린 댓글도 함께 옮긴다 (댓글이 있는 곳만)
// ★★★ 2026-08-31 — 사장님이 정하신 것: **보이는 모든 글자는 보는 사람 말로 나온다.**
//   빠진 칸이 하나라도 있으면 그 줄만 남의 말로 남는다. 사람은 그것을 고장으로 본다.
//   여기서 칸을 빠뜨리는 것은 「값을 아끼는 것」 이 아니라 **덜 만든 것**이다.
//   ★ 안 옮기는 것은 딱 하나 — 제조사·모델(Beneteau · Yanmar). 나라마다 같은 이름이라
//     옮기면 오히려 못 알아본다. 이건 내 편의가 아니라 그 글자의 성질이다.
const OK = {
  community:  { text: ['title', 'body'], comments: true },  // 커뮤니티 글판
  spots:      { text: ['name', 'note'],  comments: true },  // 정박지
  market:     { text: ['title', 'note'] },                  // 중고 장터
  // 연재 — sname 은 묶음 이름이다. 이것이 빠져서 목록 머리글만 한국어로 남았다.
  series:     { text: ['title', 'body', 'sname'] },
  // 배 공개 사본 — 소개 + 그 배가 내놓은 기록들
  // ★ 4.70 — 정비수첩·항해일지·리뷰가 빠져 있었다. 앱에서 일본어로 바꿔도
  //   그 글들만 한국어로 남았다 (사장님 지적).
  //   ★ 이것들은 따로 선 문서가 아니라 배 문서 '안의 배열' 이라 「어느 글의 어느 칸」 으로 못 가리켰다.
  //     그래서 배 하나를 통째로 한 번에 옮기고 그 안에서 골라 쓰게 한다 —
  //     기록마다 따로 부르는 것보다 부르는 횟수도 값도 적게 든다.
  boatPublic: { // 배 이름과 매어 둔 곳. 이것이 빠져서 목록에 배 이름만 남의 말로 남았다.
                text: ['name', 'port'],
                blocks: ['intro'],
                list: { mlog:   ['title', 'note', 'used'],
                        voyage: ['title', 'note', 'from', 'to'],
                        review: ['title', 'text', 'bad', 'note', 'used'] },
                // 정비수첩의 절차 한 줄 한 줄. 이것이 없으면 옮겨도 읽을 것이 없다.
                steps: { mlog: 'how' } }
};

// 배열 안의 글을 옮길 때 한 배에서 옮길 수 있는 최대 글자.
// ★ 배 하나에 기록이 수백 건일 수 있다. 한도가 없으면 한 번에 큰 값이 나간다.
const LIST_TOTAL = 12000;
const LIST_ONE   = 1200;


// 앱이 고를 수 있는 말
const LANGS = ['en', 'ru', 'ja', 'zh', 'ko'];

// 한 칸에서 옮길 수 있는 길이. 넘으면 잘라서 보낸다.
// ★ 이것이 없으면 글 하나로 요금이 크게 나갈 수 있다.
const MAX = 4000;

// ── 글자 옮기기 (trText) 한도
// ★ 뉴스는 파이어스토어에 없다. 밖에서 받아 온 글이라 '어느 글의 어느 칸' 으로 못 가리킨다.
//   그래서 글자를 그대로 받아 옮긴다. 대신 아무 글이나 받으면 요금이 새므로 한도를 둔다.
//   같은 글은 통째로 해시를 떠서 한 번만 옮긴다 — 뉴스는 모두가 같은 것을 보므로
//   첫 사람이 부르면 그 뒤로는 값이 안 든다.
const TXT_ONE   = 600;     // 한 도막
const TXT_N     = 60;      // 몇 도막까지
const TXT_TOTAL = 6000;    // 한 번에 모두 합쳐
// ★ 사람마다 하루 한도. 이것이 없으면 한 사람이 긴 글을 계속 밀어 넣어 요금을 태울 수 있다.
//   ★★★ 2026-08-31 — 8000 자였다. 그건 「사람이 번역 단추를 누를 때」 를 어림한 값이다.
//     이제 사람이 안 누르고 저절로 옮긴다. 뉴스 한 화면이 8000 자를 넘으므로
//     그 값이면 첫 화면에서 하루치를 다 쓰고, 그 뒤로는 정박지도 배 이름도 다 막힌다.
//     실제로 그렇게 됐다 (사장님 폰에서 아무것도 안 옮겨졌다).
//   ★ 그런데 그냥 올리면 요금이 는다. 그래서 **담는 방식을 바꾸고** 올린다 —
//     아래 「도막 하나씩 담는다」 를 보라. 같은 글자는 세상에 한 번만 옮긴다.
//     그러면 하루 한도는 「새로 나온 글자」 에만 걸리므로 넉넉히 둬도 된다.
//
//   ★ 어림이 아니라 실제로 센 값이다 (2026-08-31, baetnil.com 의 자료를 그대로 셈):
//       한국 소식  7일치 65건 · 2,379자  → 하루 9건 · 약 330자
//       해외 소식  24건(제목+요약) · 4,818자 → 하루 약 690자
//       앱에 든 정박지 152곳 · 약 6,000자  (한 번 옮기면 끝. 날마다 늘지 않는다)
//     즉 **처음 한 번**에 약 1만4천 자, 그 뒤로는 **하루 약 1,000자**다.
//     8,000 이면 첫날 절반도 못 하고 막힌다 — 실제로 그래서 아무것도 안 옮겨졌다.
//     60,000 은 첫날 몫을 넉넉히 덮고, 그 뒤로는 두 달치 여유다.
//   ★ 요금으로 보면 — 온 자료를 한 말로 다 옮겨도 1만5천 자다.
//     네 말(영·러·일·중) 다 해도 6만 자, 백만 자당 20달러 기준으로 **1.2달러**.
//     날마다 드는 것은 네 말 합쳐 하루 4,000자 — 한 달에 2~3달러다.
//     ★ 이것이 가능한 까닭은 도막마다 담기 때문이다. 백 명이 봐도 한 번만 문다.
const DAY_CAP   = 60000;

// 댓글 — 한 번 부를 때 여기까지만 옮긴다.
// ★ 댓글은 글보다 수가 많고 계속 는다. 한도가 없으면 댓글 삼백 개짜리 글 하나로
//   요금이 크게 나간다. 넘은 것은 원문 그대로 둔다 — 아예 못 보는 것보다 낫다.
const CMT_ONE   = 1000;   // 댓글 하나
const CMT_TOTAL = 8000;   // 한 번에 모두 합쳐
const CMT_N     = 200;    // 몇 개까지 들여다보나

// 꼬리표를 뗀 알맹이 글자
function plain(h) {
  return String(h == null ? '' : h)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// 덩이 배열에서 글자만 뽑는다.
// ★ 앱의 blocksText 와 같은 모양으로 뽑아야 한다 — 앱이 옮겨 온 글자를
//   빈 줄로 갈라 덩이에 도로 끼우기 때문이다. 여기서 모양이 어긋나면
//   글이 사진과 엇갈려 붙는다. 사진·영상은 세지 않는다 (양쪽 다).
function blocksText(v) {
  return (Array.isArray(v) ? v : [])
    .filter(b => b && b.t !== 'photo' && b.t !== 'video')
    .map(b => (b.t === 'list'
      ? ((b.items || []).map(i => '· ' + plain(i)).join('\n'))
      : plain(b.v))
      // 덩이 안의 빈 줄은 없앤다 — 덩이를 가르는 빈 줄과 헷갈리면 안 된다 (앱과 같다)
      .replace(/\n{2,}/g, '\n'))
    .join('\n\n').trim();
}

// 오늘 이 사람이 얼마나 남았나 본다 (아직 적지는 않는다).
// ★ tr 은 얼마를 쓸지 미리 알 수 없다 — 옮겨 봐야 안다.
//   그래서 '남은 양' 을 먼저 받아 그 안에서만 옮기고, 끝나고 쓴 만큼 적는다.
async function spendLeft(db, uid) {
  const day = new Date().toISOString().slice(0, 10);
  const ref = db.doc('trquota/' + uid);
  const snap = await ref.get();
  const cur = snap.exists ? (snap.data() || {}) : {};
  const used = (cur.day === day ? Number(cur.n) || 0 : 0);
  return { ref: ref, day: day, used: used, left: Math.max(0, DAY_CAP - used) };
}
async function spendAdd(q, n) {
  if (!(n > 0)) return;
  await q.ref.set({ day: q.day, n: q.used + n, ts: new Date().toISOString() });
}
// 얼마를 쓸지 미리 아는 경우 (trText) — 넘으면 아예 시작하지 않는다.
async function spend(db, uid, n) {
  const q = await spendLeft(db, uid);
  if (n > q.left) {
    throw new HttpsError('resource-exhausted', '오늘 옮길 수 있는 양을 다 썼습니다. 내일 다시 해 주세요.');
  }
  await spendAdd(q, n);
}

// ── 글자를 그대로 받아 옮긴다 (뉴스처럼 파이어스토어에 없는 글)
//
// ★★★ 2026-08-31 — 담는 방식을 「묶음째」 에서 「도막 하나씩」 으로 바꿨다.
//
//   여태는 보낸 글자 **묶음 전체**를 해시로 떠서 담았다(trtext/{묶음해시}).
//   그래서 한 도막만 달라져도 다른 묶음이 되어 **전부 다시 옮겼다.**
//   목록은 글이 하나만 올라와도 묶음이 달라진다. 즉 거의 늘 새로 옮겼다 —
//   「같은 글은 한 번만 옮긴다」 고 적어 놓고 실제로는 안 그랬다.
//
//   이제 **도막 하나마다** 담는다(trtext/{말+글자 해시}).
//   · 같은 문구는 세상에 딱 한 번만 옮긴다. 백 명이 봐도 한 번이다.
//   · 목록에 새 글이 하나 늘어도 그 하나만 옮긴다.
//   · 하루 한도에는 **새로 옮긴 글자만** 센다. 담긴 것을 읽는 것은 값이 안 든다.
//   담는 곳은 규칙에서 앱이 못 읽고 못 쓰게 막아 두었다 — 함수만 손댄다.
exports.trText = onCall(
  { region: 'asia-northeast3', maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' },
  async (req) => {
    if (!req.auth || !req.auth.uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const d = req.data || {};
    const lang = String(d.lang || '');
    if (LANGS.indexOf(lang) < 0) throw new HttpsError('invalid-argument', '모르는 말입니다');

    let texts = Array.isArray(d.texts) ? d.texts : [];
    if (!texts.length)     throw new HttpsError('invalid-argument', '옮길 글이 없습니다');
    if (texts.length > TXT_N) throw new HttpsError('invalid-argument', '한 번에 너무 많습니다');
    texts = texts.map(x => String(x == null ? '' : x).slice(0, TXT_ONE));
    let total = 0;
    for (const x of texts) total += x.length;
    if (total > TXT_TOTAL) throw new HttpsError('invalid-argument', '한 번에 너무 깁니다');

    const db = getFirestore();
    // ★ 말과 글자를 함께 해시한다. 말이 다르면 다른 결과다.
    const keyOf = v => crypto.createHash('sha256')
      .update(lang + '\u0000' + v).digest('hex').slice(0, 40);

    // ── ① 이미 담아 둔 것부터 꺼낸다 (값이 안 든다)
    //   ★ 한 번에 몰아 읽는다. 도막마다 따로 읽으면 60 번을 오간다.
    const keys = texts.map(keyOf);
    const uniq = [...new Set(keys)];
    const done = {};                        // 해시 → 옮긴 글
    for (let i = 0; i < uniq.length; i += 30) {
      const part = uniq.slice(i, i + 30);
      const snaps = await db.getAll(...part.map(k => db.doc('trtext/' + k)));
      snaps.forEach(sn => { if (sn.exists) done[sn.id] = String((sn.data() || {}).v || ''); });
    }

    // ── ② 없는 것만 옮긴다. 하루 한도도 그만큼만 센다.
    const need = [];
    texts.forEach((v, i) => {
      if (!v.trim()) return;
      if (done[keys[i]] != null) return;
      if (need.indexOf(v) < 0) need.push(v);
    });
    let fresh = 0;
    for (const v of need) fresh += v.length;
    if (fresh > 0) await spend(db, req.auth.uid, fresh);

    let missed = 0;
    for (const v of need) {
      try {
        const [got] = await tx().translate(v, { to: lang, format: 'text' });
        done[keyOf(v)] = got;
        // ★ 담는다. 실패한 것은 안 담는다 — 담으면 영영 원문만 나온다.
        await db.doc('trtext/' + keyOf(v))
          .set({ v: got, lang: lang, ts: new Date().toISOString() });
      } catch (e) {
        console.error('translate text failed', e && e.message);
        missed++;                           // 한 도막이 실패해도 나머지는 준다
      }
    }

    // ── ③ 보낸 차례 그대로 돌려준다. 못 옮긴 것은 원문 그대로.
    const out = texts.map((v, i) => (done[keys[i]] != null ? done[keys[i]] : v));
    // ★ missed 를 같이 준다. 앱은 이것을 보고 「옮겼다」 고 말할지 정한다 —
    //   못 옮겼는데 「자동 번역된 글입니다」 라고 띄우는 것이 제일 나쁘다.
    return { out: out, lang: lang, n: fresh, missed: missed, ts: new Date().toISOString() };
  }
);

exports.tr = onCall(
  { region: 'asia-northeast3', maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' },
  async (req) => {
    // 로그인한 사람만
    if (!req.auth || !req.auth.uid) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다');
    }
    const d = req.data || {};
    const coll = String(d.coll || '');
    const id   = String(d.id || '');
    const lang = String(d.lang || '');

    const spec = OK[coll];
    if (!spec)                        throw new HttpsError('invalid-argument', '옮길 수 없는 곳입니다');
    if (!id || id.length > 80 || id.indexOf('/') >= 0)
                                      throw new HttpsError('invalid-argument', '글 번호가 이상합니다');
    if (LANGS.indexOf(lang) < 0)      throw new HttpsError('invalid-argument', '모르는 말입니다');

    const db = getFirestore();
    const cache = db.doc(coll + '/' + id + '/tr/' + lang);

    // 이미 옮겨 둔 것이 있으면 그것을 쓴다 (번역을 다시 부르지 않는다).
    // ★ 다만 댓글은 그 뒤에도 계속 달린다. 담아 둔 것에 없는 댓글만 더 옮기고
    //   나머지는 그대로 쓴다 — 새 댓글 하나 때문에 글을 통째로 다시 옮기지 않는다.
    const had = await cache.get();
    const kept = had.exists ? (had.data() || {}) : null;

    const snap = await db.doc(coll + '/' + id).get();
    if (!snap.exists) throw new HttpsError('not-found', '글이 없습니다');
    const src = snap.data() || {};

    // 옮겨야 할 댓글 모으기 (글 밖의 방 + 옛 글 안에 배열로 든 것)
    let cmts = [];
    if (spec.comments) {
      try {
        const cs = await db.collection(coll + '/' + id + '/comments').limit(CMT_N).get();
        cs.forEach(d => cmts.push({ id: d.id, text: String((d.data() || {}).text || '') }));
      } catch (e) { console.error('comments read failed', coll, id, e && e.message); }
      (Array.isArray(src.comments) ? src.comments : []).forEach(c => {
        if (c && c.id) cmts.push({ id: String(c.id), text: String(c.text || '') });
      });
      cmts = cmts.filter(c => c.text.trim());
    }
    const doneC = (kept && kept.c) || {};
    const need = cmts.filter(c => doneC[c.id] == null);

    // 옮길 것을 한 줄짜리 글자로 모아 둔다 (칸 이름 → 글자)
    // ★ 예전에는 담아 둔 것이 있으면 글은 통째로 건너뛰었다.
    //   그래서 한도가 차서 못 옮긴 칸이 '옮겨 둔 것' 으로 굳어, 다음 날에도 원문만 나왔다.
    //   댓글처럼 '담아 둔 것에 없는 칸' 만 고른다 — 실패한 칸은 다음에 다시 온다.
    const want = {};
    (spec.text || []).forEach(f => {
      if (kept && kept[f] != null) return;
      want[f] = String(src[f] == null ? '' : src[f]);
    });
    (spec.blocks || []).forEach(f => {
      if (kept && kept[f] != null) return;
      want[f] = blocksText(src[f]);
    });
    const wantN = Object.keys(want).filter(f => want[f].trim()).length;

    // 글도 댓글도 배열도 새로 옮길 것이 없으면 담아 둔 것을 그대로 준다 (값이 안 든다)
    const listNeed = (() => {
      if (!spec.list && !spec.steps) return false;
      const L = (kept && kept.L) || {};
      for (const arr of Object.keys(spec.list || {})) {
        const rows = Array.isArray(src[arr]) ? src[arr] : [];
        for (const r of rows) {
          if (!r || !r.id) continue;
          const cur = (L[arr] || {})[String(r.id)] || {};
          for (const f of spec.list[arr])
            if (cur[f] == null && String(r[f] || '').trim()) return true;
          const sk = (spec.steps || {})[arr];
          if (sk && Array.isArray(r[sk]))
            for (let i = 0; i < r[sk].length; i++)
              if (cur['h' + i] == null && String((r[sk][i] || {}).v || '').trim()) return true;
        }
      }
      return false;
    })();
    if (kept && !need.length && !wantN && !listNeed) return kept;

    // ★ 하루 한도 — 여기가 통째로 빠져 있었다.
    //   trText(뉴스)만 세고 있어서, 글·댓글 번역은 한 사람이 얼마든지 부를 수 있었다.
    //   얼마를 쓸지는 옮겨 봐야 아니까, 남은 양을 받아 그 안에서만 옮긴다.
    const q = await spendLeft(db, req.auth.uid);
    if (q.left <= 0) {
      throw new HttpsError('resource-exhausted', '오늘 옮길 수 있는 양을 다 썼습니다. 내일 다시 해 주세요.');
    }

    const out = Object.assign({}, kept || {});
    let used = 0;
    for (const f of Object.keys(want)) {
      const v = want[f].slice(0, MAX);
      if (!v.trim()) continue;
      if (used >= q.left) break;          // 남은 양을 다 썼다 — 못 옮긴 칸은 다음에 다시 온다
      try {
        const [got] = await tx().translate(v, { to: lang, format: 'text' });
        out[f] = got;
        used += v.length;
      } catch (e) {
        // 한 칸이 실패해도 나머지는 준다. 아무것도 못 주는 것보다 낫다.
        console.error('translate failed', coll, id, f, e && e.message);
      }
    }
    // 댓글 — 아직 안 옮긴 것만
    if (need.length) {
      const c = Object.assign({}, doneC);
      let cUsed = 0;
      for (const one of need) {
        if (cUsed >= CMT_TOTAL) break;              // 한도를 넘은 것은 원문 그대로 둔다
        if (used + cUsed >= q.left) break;          // 하루 한도도 마찬가지 — 다음에 다시 온다
        const v = one.text.slice(0, CMT_ONE);
        try {
          const [got] = await tx().translate(v, { to: lang, format: 'text' });
          c[one.id] = got;
          cUsed += v.length;
        } catch (e) {
          console.error('translate comment failed', coll, id, one.id, e && e.message);
        }
      }
      if (Object.keys(c).length) out.c = c;
      used += cUsed;
    }

    // ── 배열 안의 글 (정비수첩·항해일지·리뷰). 4.70
    //   ★ 이미 옮겨 둔 것은 건드리지 않는다. 새로 생긴 기록만 옮긴다.
    if (spec.list || spec.steps) {
      const L = Object.assign({}, (kept && kept.L) || {});
      let lUsed = 0;
      const room = () => (lUsed < LIST_TOTAL) && (used + lUsed < q.left);
      for (const arr of Object.keys(spec.list || {})) {
        const rows = Array.isArray(src[arr]) ? src[arr] : [];
        L[arr] = Object.assign({}, L[arr] || {});
        for (const r of rows) {
          if (!r || !r.id) continue;
          const rid = String(r.id);
          const cur = Object.assign({}, L[arr][rid] || {});
          for (const f of spec.list[arr]) {
            if (cur[f] != null) continue;                 // 이미 옮겨 둔 칸
            const v = String(r[f] == null ? '' : r[f]).slice(0, LIST_ONE);
            if (!v.trim()) continue;
            if (!room()) break;
            try {
              const [got] = await tx().translate(v, { to: lang, format: 'text' });
              cur[f] = got; lUsed += v.length;
            } catch (e) { console.error('translate list failed', coll, id, arr, rid, f, e && e.message); }
          }
          // 절차 — 한 줄씩. h0 · h1 … 로 담는다 (사진은 안 건드린다)
          const stepKey = (spec.steps || {})[arr];
          if (stepKey && Array.isArray(r[stepKey])) {
            for (let i = 0; i < r[stepKey].length; i++) {
              const fk = 'h' + i;
              if (cur[fk] != null) continue;
              const v = String((r[stepKey][i] || {}).v || '').slice(0, LIST_ONE);
              if (!v.trim()) continue;
              if (!room()) break;
              try {
                const [got] = await tx().translate(v, { to: lang, format: 'text' });
                cur[fk] = got; lUsed += v.length;
              } catch (e) { console.error('translate step failed', coll, id, arr, rid, i, e && e.message); }
            }
          }
          if (Object.keys(cur).length) L[arr][rid] = cur;
        }
      }
      if (Object.keys(L).length) out.L = L;
      used += lUsed;
    }


    if (!Object.keys(out).length) throw new HttpsError('internal', '옮기지 못했습니다');

    await spendAdd(q, used);                        // 오늘 쓴 양에 더한다

    out.lang = lang;
    out.n = (Number(kept && kept.n) || 0) + used;   // 얼마나 썼는지 (요금을 가늠할 때 본다)
    out.ts = new Date().toISOString();
    await cache.set(out);
    return out;
  }
);


// ═══════════════════════════════════════════════════════════════
// 고객센터로 들어오는 메일 (help@baetnil.com)
//
// ★ 왜 서버가 받아야 하나
//   파이어스토어 규칙은 support 방에 「로그인한 사람이 자기 uid 로만」 쓰게 열려 있다.
//   메일에는 uid 가 없다. 밖에서는 못 넣는다.
//   이 함수는 관리자 자격으로 돌아 규칙을 안 거치므로 여기서만 넣을 수 있다.
//
// ★ 왜 토큰을 맞춰 보나
//   주소만 알면 아무나 부를 수 있는 문이다. 그대로 두면 남이 고객센터에
//   아무 글이나 밀어 넣는다. 클라우드플레어 Worker 와 이 문만 아는 글자를 맞춰 본다.
//
// ★ 메일을 뜯는 일은 여기서 안 한다
//   Worker 가 보낸 사람·제목·본문을 이미 갈라서 보낸다. 여기서 또 뜯으면
//   부품(mailparser)을 새로 깔아야 하고, 그것이 올리기를 10초 안에 못 끝내
//   통째로 막는 사고를 낸다(위 tx() 주석과 같은 까닭).
const MAIL_TOKEN = 'MeTzOAyO3k2aEClj76M7VXtgxiIJOyP6DARiuYnwPhs';

// 한 통에서 받아 둘 최대 길이. 넘치면 자른다 — 문서 1MB 벽에 걸리면 통째로 잃는다.
const MAIL_MAX = 20000;

exports.mailIn = onRequest(
  { region: 'asia-northeast3', maxInstances: 5, timeoutSeconds: 30, memory: '256MiB', cors: false },
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).send('POST only'); return; }
    if (req.get('x-baetnil-token') !== MAIL_TOKEN) { res.status(403).send('no'); return; }

    const b = req.body || {};
    const from    = String(b.from    || '').slice(0, 200).trim();
    const name    = String(b.name    || '').slice(0, 100).trim();
    const subject = String(b.subject || '').slice(0, 300).trim();
    let   text    = String(b.text    || '').trim();

    // ★ 본문이 비어도 버리지 않는다. 제목만 있는 메일도 있고,
    //   못 읽었다고 조용히 사라지면 그게 사고다.
    if (!text && !subject) { res.status(400).send('empty'); return; }
    if (text.length > MAIL_MAX) text = text.slice(0, MAIL_MAX) + '\n\n…(줄임)';

    const id = 'mail-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
    try {
      await getFirestore().collection('support').doc(id).set({
        id,
        kind: 'mail',
        text: (subject ? subject + '\n\n' : '') + text,
        byName: name || from || '(이름 없음)',
        email: from,
        info: '메일로 옴',
        ts: new Date().toISOString(),
        done: false
      });
    } catch (e) {
      console.error('mailIn save failed', e && e.message);
      res.status(500).send('save failed');
      return;
    }
    res.status(200).send('ok');
  }
);

// ═══════════════════════════════════════════════════════════════
// 알림 보내기 (푸시)
//
// ★ 왜 서버가 하나
//   댓글·새 글은 남의 폰에서 일어난 일이다. 내 폰은 그 일을 알 방법이 없다.
//   그래서 「누가 무엇을 받겠다고 했는가」를 서버가 들고 있다가(push/{uid}) 보낸다.
//   정비 기한처럼 내 폰이 이미 아는 일은 서버를 안 쓴다 — 폰이 스스로 건다.
//
// ★ 안 보내는 조건을 한 곳(sendTo)에 모은다
//   받는 사람마다 「껐나 · 밤인가 · 토큰이 있나」를 따로 따지면 한 군데는 틀린다.
//   그러면 껐다는 사람에게 알림이 가고, 그건 되돌릴 수 없다.
//
// ★ 죽은 토큰은 지운다
//   앱을 지운 폰의 토큰이 남아 있으면 보낼 때마다 실패가 쌓인다.
//   보내다가 「없는 토큰」이라고 하면 그 자리에서 뺀다.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getMessaging } = require('firebase-admin/messaging');
const { FieldValue } = require('firebase-admin/firestore');   // 죽은 토큰을 뺄 때 쓴다

const RG = 'asia-northeast3';
const PUSH_OPT = { region: RG, maxInstances: 10, timeoutSeconds: 60, memory: '256MiB' };

// 밤인가 — 받는 사람이 사는 곳 시각으로 본다.
// ★ 서버는 UTC 로 돈다. 서버 시각으로 따지면 한국 사람은 낮에 참고 새벽에 받는다.
function quietNow(p) {
  if (!p || !p.quiet) return false;
  const tz = String(p.tz || 'Asia/Seoul');
  let hh = 0, mi = 0;
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    hh = Number((f.find(x => x.type === 'hour') || {}).value) || 0;
    mi = Number((f.find(x => x.type === 'minute') || {}).value) || 0;
  } catch (e) { return false; }          // 시간대를 모르면 참지 않는다 — 안 보내는 쪽이 더 나쁘다
  const mm = v => { const a = String(v || '').split(':'); return (Number(a[0]) || 0) * 60 + (Number(a[1]) || 0); };
  const now = hh * 60 + mi, f0 = mm(p.from || '22:00'), t0 = mm(p.to || '06:00');
  if (f0 === t0) return false;
  return f0 < t0 ? (now >= f0 && now < t0) : (now >= f0 || now < t0);
}

// ★ 5.46 — 알림 글은 받는 사람의 앱 말로 (앱이 push/{uid}.lang 에 적어 둔다: ko·en·ru·ja).
//   말은 앱 사전과 같게 — 「내 글에 댓글」=Comments on my posts, 「{d} 출항 예정입니다.」=Departing on {d}. 등.
const PUSH_LANGS = ['ko', 'en', 'ru', 'ja'];
const PT = {
  myPost: { ko:'내 글',            en:'My post',                   ru:'Моя запись',                 ja:'自分の投稿' },
  myRec:  { ko:'내 기록',          en:'My entry',                  ru:'Моя запись',                 ja:'自分の記録' },
  part:   { ko:'{n}편 · ',         en:'Part {n} · ',               ru:'Часть {n} · ',               ja:'第{n}回・' },
  news:   { ko:'오늘의 소식 {n}건', en:'News in your topics: {n}',  ru:'Новости по моим темам: {n}', ja:'関心分野のニュース {n}件' },
  boat:   { ko:'배',               en:'Boat',                      ru:'Судно',                      ja:'船' },
  planT:  { ko:'{b} — 출항 예정',   en:'{b} — upcoming departure',  ru:'{b} — запланирован выход',   ja:'{b} — 出港予定' },
  planB:  { ko:'{d} 출항 예정입니다.', en:'Departing on {d}.',      ru:'Выход запланирован на {d}.', ja:'{d}に出港予定です。' },
  planB0: { ko:'출항 예정입니다.',  en:'Departure planned.',        ru:'Выход запланирован.',        ja:'出港予定です。' }
};
// 소식 분야 이름 — 앱 사전 「분야@@뉴스」 와 같다 (분야 열쇠는 한국어로 저장된다)
const NEWS_CAT = {
  '안전':   { en:'Safety',      ru:'Безопасность',     ja:'安全' },
  '규정':   { en:'Regulations', ru:'Правила',          ja:'法令' },
  '산업':   { en:'Industry',    ru:'Индустрия',        ja:'業界' },
  '항만':   { en:'Ports',       ru:'Порты',            ja:'港湾' },
  '기상':   { en:'Weather',     ru:'Погода',           ja:'気象' },
  '레이스': { en:'Racing',      ru:'Регаты',           ja:'レース' },
  '항해술': { en:'Seamanship',  ru:'Морская практика', ja:'シーマンシップ' },
  '장비':   { en:'Equipment',   ru:'Оборудование',     ja:'装備' },
  '사고':   { en:'Accidents',   ru:'Происшествия',     ja:'事故' },
  '기타':   { en:'Other',       ru:'Другое',           ja:'その他' }
};
function pushLang(p) { const L = String((p && p.lang) || 'ko'); return PUSH_LANGS.indexOf(L) >= 0 ? L : 'ko'; }
function pt(key, L, vars) {
  let s = (PT[key] && (PT[key][L] || PT[key].ko)) || '';
  Object.keys(vars || {}).forEach(k => { s = s.split('{' + k + '}').join(String(vars[k])); });
  return s;
}
function newsCatName(c, L) { return (L !== 'ko' && NEWS_CAT[c] && NEWS_CAT[c][L]) || c; }

// ★ 보내는 문은 이것 하나다.
//   title·body 는 글자이거나, 받는 사람 말(L)을 받아 글자를 돌려주는 함수다.
async function sendTo(uid, title, body, data, need) {
  if (!uid) return 0;
  const db = getFirestore();
  const ref = db.collection('push').doc(String(uid));
  let p = null;
  try { const d = await ref.get(); p = d.exists ? d.data() : null; } catch (e) { return 0; }
  if (!p || p.on !== true) return 0;
  if (need && p[need] !== true) return 0;      // 이 종류를 꺼 뒀다
  const toks = Array.isArray(p.tokens) ? p.tokens.filter(Boolean) : [];
  if (!toks.length) return 0;
  if (quietNow(p)) return 0;
  const L = pushLang(p);
  if (typeof title === 'function') title = title(L);
  if (typeof body === 'function') body = body(L);

  const msg = {
    notification: { title: String(title || ''), body: String(body || '') },
    data: Object.assign({}, data || {}),
    android: { priority: 'high', notification: { channelId: 'baetnil-news' } },
    apns: { payload: { aps: { sound: 'default' } } }
  };
  let sent = 0;
  const dead = [];
  const r = await getMessaging().sendEachForMulticast(
    Object.assign({ tokens: toks.slice(0, 400) }, msg)
  );
  r.responses.forEach((x, i) => {
    if (x.success) { sent++; return; }
    const c = x.error && x.error.code ? String(x.error.code) : '';
    if (/registration-token-not-registered|invalid-argument|invalid-registration-token/.test(c)) {
      dead.push(toks[i]);
    }
  });
  if (dead.length) {
    // ★ 죽은 토큰은 그 자리에서 뺀다. 안 빼면 실패가 영영 쌓인다.
    try { await ref.update({ tokens: FieldValue.arrayRemove(...dead) }); } catch (e) {}
  }
  return sent;
}

// 글이 너무 길면 알림 창에서 어차피 잘린다. 여기서 자른다.
const cut = (v, n) => { const s = String(v || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

// ── ① 내 글에 댓글
// 댓글이 붙는 곳은 글판(community)과 정박지(spots) 둘뿐이다.
// ★ 내가 내 글에 단 댓글로는 안 울린다 — 그건 알림이 아니라 성가심이다.
async function onComment(coll, postId, cmt) {
  if (!cmt || !cmt.by) return;
  const db = getFirestore();
  let post = null;
  try { const d = await db.collection(coll).doc(String(postId)).get(); post = d.exists ? d.data() : null; }
  catch (e) { return; }
  if (!post || !post.by) return;
  if (String(post.by) === String(cmt.by)) return;      // 내 글에 내가 단 것

  const where = coll === 'spots' ? (post.name || '') : (post.title || '');
  await sendTo(String(post.by),
    L => cut(where, 40) || pt('myPost', L),
    (cmt.byName ? cmt.byName + ': ' : '') + cut(cmt.text, 80),
    { kind: 'comment', coll: String(coll), id: String(postId) },
    'myComment');
}

// ── 남의 배 게시물(항해일지·정비수첩·리뷰)에 댓글 (4.77)
//
// ★ 이 기록들은 boatPublic/{배번호} 문서 **안의 배열**이라, 댓글이 붙는 문서에는
//   「누구 글인가」 가 없다. 방 이름이 {배번호}_{기록번호} 이므로 거기서 배를 찾아
//   그 배의 주인(owner)에게 보낸다.
// ★ 배 번호에도 '_' 가 들어갈 수 있다. 그래서 **마지막 '_' 를 기준으로** 자른다.
async function onBoatRecComment(recKey, cmt) {
  if (!cmt || !cmt.by) return;
  const key = String(recKey || '');
  const at = key.lastIndexOf('_');
  if (at <= 0) return;
  const boatId = key.slice(0, at), recId = key.slice(at + 1);
  if (!boatId || !recId) return;

  const db = getFirestore();
  let b = null;
  try { const d = await db.collection('boatPublic').doc(boatId).get(); b = d.exists ? d.data() : null; }
  catch (e) { return; }
  if (!b || !b.owner) return;
  if (String(b.owner) === String(cmt.by)) return;      // 내 기록에 내가 단 것

  // 어느 기록인지 제목을 찾아 준다 — 「내 글」 이라고만 오면 무엇인지 모른다
  let title = '';
  for (const arr of ['voyage', 'mlog', 'review']) {
    const hit = (b[arr] || []).find(r => r && String(r.id) === recId);
    if (hit) { title = String(hit.title || '') || (b.name || ''); break; }
  }
  await sendTo(String(b.owner),
    L => cut(title || b.name || '', 40) || pt('myRec', L),
    (cmt.byName ? cmt.byName + ': ' : '') + cut(cmt.text, 80),
    { kind: 'comment', coll: 'bpMeta', id: key, boat: boatId, rec: recId },
    'myComment');
}
exports.pushBoatRecComment = onDocumentCreated(
  Object.assign({ document: 'bpMeta/{recKey}/comments/{cid}' }, PUSH_OPT),
  async (e) => {
    try { await onBoatRecComment(e.params.recKey, e.data && e.data.data()); }
    catch (err) { console.error('pushBoatRecComment', err && err.message); }
  }
);

exports.pushTalkComment = onDocumentCreated(
  Object.assign({ document: 'community/{postId}/comments/{cid}' }, PUSH_OPT),
  async (e) => {
    try { await onComment('community', e.params.postId, e.data && e.data.data()); }
    catch (err) { console.error('pushTalkComment', err && err.message); }
  }
);
exports.pushSpotComment = onDocumentCreated(
  Object.assign({ document: 'spots/{spotId}/comments/{cid}' }, PUSH_OPT),
  async (e) => {
    try { await onComment('spots', e.params.spotId, e.data && e.data.data()); }
    catch (err) { console.error('pushSpotComment', err && err.message); }
  }
);

// ── ② 구독한 연재에 새 글
// ★ 「이 연재를 구독한 사람이 누구인가」를 찾아야 한다.
//   push 방을 통째로 훑으면 사람이 늘수록 읽기가 늘어난다.
//   그래서 series 배열에 이름이 든 방만 골라 읽는다 (array-contains).
exports.pushSeriesNew = onDocumentCreated(
  Object.assign({ document: 'series/{id}' }, PUSH_OPT),
  async (e) => {
    try {
      const x = e.data && e.data.data();
      if (!x) return;
      const name = String(x.sname || '').trim();
      if (!name) return;                                  // 묶지 않은 글은 구독할 것이 없다
      const db = getFirestore();
      const snap = await db.collection('push')
        .where('on', '==', true)
        .where('series', 'array-contains', name)
        .limit(2000).get();
      const title = name;
      const body = L => (x.no ? pt('part', L, { n: x.no }) : '') + cut(x.title, 70);
      let n = 0;
      for (const d of snap.docs) {
        if (String(d.id) === String(x.by || '')) continue;   // 내가 올린 글로 나에게 안 울린다
        n += await sendTo(d.id, title, body, { kind: 'series', id: String(e.params.id) });
      }
      console.log('pushSeriesNew', name, snap.size, '→', n);
    } catch (err) { console.error('pushSeriesNew', err && err.message); }
  }
);

// ── ③ 관심 분야 소식 — 아침에 한 번 묶어서
//
// ★ 왜 하루 한 번인가
//   뉴스는 하루에 수십 건 모인다. 올 때마다 울리면 아무도 안 켜 둔다.
//   사장님과 「아침에 한 번 묶어서」로 정했다.
//
// ★ 뉴스는 파이어스토어에 없다 — 깃허브가 만든 파일이다. 그래서 받아서 본다.
// ★ 어디까지 보냈는지 적어 둔다. 안 적으면 매일 같은 것을 다시 보낸다.
const NEWS_URL = 'https://baetnil.com/app/';

// ★ 5.46 — 받는 사람이 사는 곳 아침 8시에, 그 사람 말 기준으로 묶는다.
//   여태는 서울 아침 8시 한 번이라 모스크바는 새벽 2시였고, 「조용한 시간」 을 켠 사람은 그날 소식을 못 받았다.
//   그래서 한 시간마다 돌고, 그 사람 시간대(tz)로 8시인 사람에게만, 하루 한 번(newsDay) 보낸다.
//   어디까지 보냈는지도 사람마다 적는다(newsSince) — 아침 시각이 사람마다 다르니 하나로는 못 센다.
// ★ 「내 소식 / 세계 소식」 은 앱 뉴스 탭과 같은 기준이다 — 한국어면 내 소식 = 한국 관 자료(kr.json),
//   그 밖의 말이면 내 소식 = 그 말로 된 기사, 세계 소식 = 나머지 (앱 renderNews 와 같다).
//   krCats 는 「내 소식」 칸, wwCats 는 「세계 소식」 칸에서 고른 분야다.
function localParts(tz) {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: String(tz || 'Asia/Seoul'), year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date());
    const g = k => (f.find(x => x.type === k) || {}).value || '';
    return { day: g('year') + '-' + g('month') + '-' + g('day'), hour: Number(g('hour')) % 24 };
  } catch (e) { return null; }
}
function newsSplit(L, gov, items) {
  if (L === 'ko') return { home: gov, world: items };
  return { home: items.filter(x => (x && x.lang || 'en') === L), world: items.filter(x => (x && x.lang || 'en') !== L) };
}
const NEWS_HOUR = 8;

exports.pushNewsDaily = onSchedule(
  { schedule: '0 * * * *', timeZone: 'Asia/Seoul', region: RG, maxInstances: 1,
    timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const db = getFirestore();
    const grab = async (file, pick) => {
      try {
        const r = await fetch(NEWS_URL + file + '?v=' + Date.now());
        if (!r.ok) return [];
        return pick(await r.json()) || [];
      } catch (e) { return []; }
    };
    const gov = await grab('kr.json',   j => j.gov);
    const items = await grab('news.json', j => j.items);
    const day0 = new Date(Date.now() - 864e5).toISOString();
    // 지난 이틀 안에 들어온 분야만 사람을 찾는 데 쓴다 (분야마다 켜 둔 사람만 읽는다)
    const cats = new Set([...gov, ...items].filter(x => x && x.cat && String(x.date || '') > new Date(Date.now() - 2 * 864e5).toISOString())
                                          .map(x => String(x.cat).trim()));
    if (!cats.size) { console.log('pushNewsDaily: 새 소식 없음'); return; }
    const people = new Map();
    for (const c of cats) {
      for (const f of ['krCats', 'wwCats']) {
        const snap = await db.collection('push').where('on', '==', true).where(f, 'array-contains', c).limit(2000).get();
        snap.docs.forEach(d => people.set(d.id, d));
      }
    }
    let sent = 0, due = 0;
    for (const [uid, d] of people) {
      const p = d.data() || {};
      const lp = localParts(p.tz);
      if (!lp || lp.hour !== NEWS_HOUR) continue;          // 그 사람 아침 8시가 아니다
      if (String(p.newsDay || '') === lp.day) continue;    // 오늘 이미 보냈다
      due++;
      const L = pushLang(p);
      const since = String(p.newsSince || '') || day0;      // 처음이면 하루치만
      const sp = newsSplit(L, gov, items);
      const fresh = (rows, want) => rows.filter(x => x && x.cat && String(x.date || '') > since && want.indexOf(String(x.cat).trim()) >= 0);
      const kr = Array.isArray(p.krCats) ? p.krCats : [], ww = Array.isArray(p.wwCats) ? p.wwCats : [];
      const got = [...fresh(sp.home, kr), ...fresh(sp.world, ww)];
      if (got.length) {
        const cs = [...new Set(got.map(x => String(x.cat).trim()))];
        sent += await sendTo(uid, L2 => pt('news', L2, { n: got.length }),
                             L2 => cs.map(c => newsCatName(c, L2)).join(L2 === 'ja' ? '・' : ' · '), { kind: 'news' });
      }
      // 보냈든 새 것이 없었든 오늘 몫은 끝났다 — 다음 묶음은 지금부터 센다
      try { await d.ref.update({ newsDay: lp.day, newsSince: new Date().toISOString() }); } catch (e) {}
    }
    console.log('pushNewsDaily', JSON.stringify({ cats: cats.size, people: people.size, due, sent }));
  }
);

// ===== 출항 예정 알림 =====
//
// ★ 이것은 남의 폰을 울린다. 잘못 보내면 되돌릴 수 없다.
//   그래서 보내기 전에 네 가지를 본다 — 고른 사람인가 · 껐는가 · 밤인가 · 이미 보냈는가.
//   앞의 셋은 sendTo 가 본다(문 하나). 마지막 하나만 여기서 본다.
//
//   두 갈래다.
//     pushPlanNow  — 앱에서 [지금 알리기] 를 누르면 now 가 새 시각으로 바뀐다. 그때 한 번.
//     pushPlanSoon — 「출항 전에」 로 고른 때(fireAt)가 되면 한 번.
//   보낸 표시를 그대로 되적어 두므로 같은 것이 두 번 가지 않는다.
const { onDocumentWritten } = require('firebase-functions/v2/firestore');

const PLAN_WHO_MAX = 100;

function planWords(p) {
  const what = cut(p.what, 40);
  const when = [String(p.date || ''), String(p.timeOut || '')].filter(Boolean).join(' ');
  return {
    title: L => pt('planT', L, { b: cut(p.boatName, 24) || pt('boat', L) }),
    body:  L => (when ? pt('planB', L, { d: when }) : pt('planB0', L)) + (what ? '\n' + what : '')
  };
}

// ★ 보내는 자리는 이 함수 하나뿐이다. 두 군데서 보내면 한 군데가 「껐다」를 안 본다.
async function planSend(p) {
  const who = Array.isArray(p.who) ? p.who.filter(Boolean).slice(0, PLAN_WHO_MAX) : [];
  if (!who.length) return 0;
  const w = planWords(p);
  const data = { kind: 'plan', boatId: String(p.boatId || ''), vid: String(p.vid || '') };
  let sent = 0;
  for (const uid of who) {
    // 예정을 잡은 사람 자신에게는 안 보낸다
    if (String(uid) === String(p.by || '')) continue;
    try { sent += await sendTo(uid, w.title, w.body, data, 'boatPlan'); } catch (e) {}
  }
  return sent;
}

exports.pushPlanNow = onDocumentWritten(
  Object.assign({ document: 'planNoti/{id}' }, PUSH_OPT),
  async (event) => {
    const after = event.data && event.data.after;
    if (!after || !after.exists) return;
    const p = after.data() || {};
    const now = String(p.now || '');
    if (!now) return;
    if (String(p.sentNow || '') === now) return;   // 이미 이 요청으로 보냈다
    const sent = await planSend(p);
    try { await after.ref.update({ sentNow: now }); } catch (e) {}
    console.log('pushPlanNow', JSON.stringify({ id: after.id, who: (p.who || []).length, sent }));
  }
);

exports.pushPlanSoon = onSchedule(
  Object.assign({ schedule: 'every 15 minutes', timeZone: 'Asia/Seoul' }, PUSH_OPT),
  async () => {
    const db = getFirestore();
    const nowIso = new Date().toISOString();
    let snap;
    try {
      snap = await db.collection('planNoti')
        .where('fireAt', '>', '')
        .where('fireAt', '<=', nowIso)
        .limit(300).get();
    } catch (e) { console.log('pushPlanSoon query', String(e)); return; }
    let sent = 0, done = 0;
    for (const d of snap.docs) {
      const p = d.data() || {};
      const at = String(p.fireAt || '');
      if (!at) continue;
      if (String(p.sentSoon || '') === at) continue;   // 이 시각 것은 이미 보냈다
      sent += await planSend(p);
      done++;
      try { await d.ref.update({ sentSoon: at }); } catch (e) {}
    }
    console.log('pushPlanSoon', JSON.stringify({ found: snap.size, done, sent }));
  }
);
