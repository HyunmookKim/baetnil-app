// 뱃일 — help@baetnil.com 으로 온 편지를 고객센터에 넣는다
//
// ★ 왜 이렇게 하나
//   파이어스토어 규칙은 support 방에 「로그인한 사람이 자기 uid 로, done 은 false 로」
//   쓰게 열려 있다. 그래서 이 Worker 가 '메일 넣기 전용 계정' 으로 로그인해서 쓴다.
//   서버 함수를 새로 올리지 않아도 되고, 규칙도 한 줄 안 고친다.
//
// ★ 그 계정은 운영자가 아니다
//   admins 문서가 없으므로 isStaff() 가 아니다. 남의 접수를 훑지도, 배를 건드리지도 못한다.
//   할 수 있는 것은 자기 이름으로 글 하나 넣는 것뿐이다.
//
// ★ 지메일로도 한 통 넘긴다
//   여기가 잘못돼도 편지 자체는 안 잃는다. 넣기가 실패해도 넘기기는 한다.

const PROJECT = 'baetnil';
const API_KEY = 'AIzaSyA8a-zLqfxE-CBVPsZnnKXHcYumHQfiSeo';  // 웹 열쇠 — 공개돼도 되는 값
const MAX = 20000;   // 한 통에서 담아 둘 최대 길이 (문서 1MB 벽에 걸리면 통째로 잃는다)

export default {
  async email(message, env, ctx) {
    // ── 1) 먼저 지메일로 넘긴다. 아래가 잘못돼도 편지는 남는다.
    let forwarded = false;
    try {
      if (env.FORWARD_TO) { await message.forward(env.FORWARD_TO); forwarded = true; }
    } catch (e) {
      console.log('forward failed: ' + (e && e.message));
    }

    // ── 2) 원본을 읽어 보낸 사람·제목·본문을 가른다
    let raw = '';
    try {
      raw = await new Response(message.raw).text();
    } catch (e) {
      console.log('read failed: ' + (e && e.message));
    }

    const from    = String(message.from || '').slice(0, 200);
    const subject = decodeHeader(headerOf(raw, 'subject') || '').slice(0, 300);
    const name    = decodeHeader(nameOf(headerOf(raw, 'from') || '')).slice(0, 100);
    let   text    = plainBody(raw).trim();

    if (!text && !subject) { console.log('empty mail'); return; }
    if (text.length > MAX) text = text.slice(0, MAX) + '\n\n…(줄임)';

    // ── 3) 고객센터에 넣는다
    try {
      const tok = await signIn(env.BOT_EMAIL, env.BOT_PASSWORD);
      await addSupport(tok.idToken, tok.localId, { from, name, subject, text });
    } catch (e) {
      // 넣기가 안 돼도 편지는 이미 넘어갔다. 여기서 던지면 보낸 사람에게 반송된다.
      console.log('support add failed: ' + (e && e.message) + ' / forwarded=' + forwarded);
    }
  }
};

// ── 로그인 (이메일·비밀번호)
async function signIn(email, password) {
  const r = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + API_KEY,
    { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }) });
  const j = await r.json();
  if (!r.ok || !j.idToken) throw new Error('signIn ' + r.status + ' ' + JSON.stringify(j).slice(0, 200));
  return j;
}

// ── 고객센터 방에 한 줄 넣기
// 규칙이 요구하는 것: by 가 내 uid, done 이 false
async function addSupport(idToken, uid, m) {
  const id = 'mail-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  const S = v => ({ stringValue: String(v == null ? '' : v) });
  const body = {
    fields: {
      id:     S(id),
      kind:   S('mail'),
      text:   S((m.subject ? m.subject + '\n\n' : '') + m.text),
      byName: S(m.name || m.from || '(이름 없음)'),
      email:  S(m.from),
      info:   S('메일로 옴'),
      by:     S(uid),
      ts:     S(new Date().toISOString()),
      done:   { booleanValue: false }
    }
  };
  const url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT
            + '/databases/(default)/documents/support?documentId=' + id;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + idToken },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error('firestore ' + r.status + ' ' + (await r.text()).slice(0, 300));
}

// ── 머리글 한 줄 꺼내기 (여러 줄로 접힌 것도 이어 붙인다)
function headerOf(raw, key) {
  const head = raw.split(/\r?\n\r?\n/)[0] || '';
  const lines = head.split(/\r?\n/);
  const k = key.toLowerCase() + ':';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].toLowerCase().startsWith(k)) {
      let v = lines[i].slice(k.length);
      // 다음 줄이 빈칸으로 시작하면 이어진 것이다
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) { v += ' ' + lines[++i].trim(); }
      return v.trim();
    }
  }
  return '';
}

// ── From 에서 이름만 (Hong <a@b.com> → Hong)
function nameOf(v) {
  const m = String(v).match(/^\s*"?([^"<]*?)"?\s*</);
  return m ? m[1].trim() : '';
}

// ── =?UTF-8?B?…?= / =?UTF-8?Q?…?= 를 사람 글자로
function decodeHeader(v) {
  return String(v).replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (all, cs, enc, data) => {
    try {
      let bytes;
      if (enc.toUpperCase() === 'B') {
        const bin = atob(data.replace(/\s/g, ''));
        bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      } else {
        const s = data.replace(/_/g, ' ');
        const out = [];
        for (let i = 0; i < s.length; i++) {
          if (s[i] === '=' && /[0-9A-Fa-f]{2}/.test(s.slice(i + 1, i + 3))) {
            out.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2;
          } else out.push(s.charCodeAt(i));
        }
        bytes = Uint8Array.from(out);
      }
      return new TextDecoder(cs.toLowerCase()).decode(bytes);
    } catch (e) { return all; }
  }).replace(/\?=\s+=\?/g, '');   // 이어 붙은 토막 사이의 빈칸
}

// ── 본문에서 글자만 뽑는다
// text/plain 을 먼저 찾고, 없으면 text/html 에서 태그를 걷어 낸다.
function plainBody(raw) {
  const parts = splitParts(raw);
  const plain = parts.find(p => /text\/plain/i.test(p.type));
  if (plain) return decodeBody(plain);
  const html = parts.find(p => /text\/html/i.test(p.type));
  if (html) return stripTags(decodeBody(html));
  return '';
}

function splitParts(raw) {
  const head = raw.split(/\r?\n\r?\n/)[0] || '';
  const ct = headerOf(raw, 'content-type');
  const bm = ct.match(/boundary="?([^";]+)"?/i);
  if (!bm) {
    // 한 덩이짜리 편지
    const body = raw.slice(head.length).replace(/^\r?\n\r?\n/, '');
    return [{ type: ct || 'text/plain', enc: headerOf(raw, 'content-transfer-encoding'), body }];
  }
  const b = '--' + bm[1];
  return raw.split(b).slice(1, -1).map(seg => {
    const cut = seg.indexOf('\n\n') >= 0 ? seg.indexOf('\n\n') : seg.indexOf('\r\n\r\n');
    const h = seg.slice(0, cut < 0 ? 0 : cut);
    const body = cut < 0 ? '' : seg.slice(cut).replace(/^\s*\r?\n\r?\n?/, '');
    return {
      type: (h.match(/content-type:\s*([^;\r\n]+)/i) || [])[1] || 'text/plain',
      enc:  (h.match(/content-transfer-encoding:\s*([^\r\n]+)/i) || [])[1] || '',
      body
    };
  });
}

function decodeBody(p) {
  const enc = String(p.enc || '').toLowerCase().trim();
  try {
    if (enc === 'base64') {
      const bin = atob(String(p.body).replace(/\s/g, ''));
      return new TextDecoder('utf-8').decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
    }
    if (enc === 'quoted-printable') {
      const s = String(p.body).replace(/=\r?\n/g, '');
      const out = [];
      for (let i = 0; i < s.length; i++) {
        if (s[i] === '=' && /[0-9A-Fa-f]{2}/.test(s.slice(i + 1, i + 3))) {
          out.push(parseInt(s.slice(i + 1, i + 3), 16)); i += 2;
        } else out.push(s.charCodeAt(i));
      }
      return new TextDecoder('utf-8').decode(Uint8Array.from(out));
    }
  } catch (e) { /* 못 읽으면 있는 그대로 */ }
  return String(p.body);
}

function stripTags(h) {
  return String(h)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');
}
