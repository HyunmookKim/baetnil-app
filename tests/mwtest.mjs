// 워커 — 첨부 이름 뽑기 · 우리 이름으로 다시 보내기 (사장님 지적)
import fs from 'fs';
let src = fs.readFileSync('/home/claude/mailworker.js', 'utf8');
// cloudflare:email 은 여기 없다. 흉내만 낸다.
src = src.replace(/^import \{ EmailMessage \}.*$/m,
  'class EmailMessage { constructor(f,t,r){ this.from=f; this.to=t; this.raw=r; } }');
src += '\nexport { fileNameOf, attachOf, splitParts, decodeHeader, plainBody, sendOurs, encHeader, b64utf8, headerOf };\n';
fs.writeFileSync('/tmp/mw.mjs', src);
const M = await import('/tmp/mw.mjs');

let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(w).slice(0,300):'')); } };

// ── 관공서에서 온 것과 같은 모양의 편지 (첨부 둘)
const B = '----BOUND1';
const 편지 =
`From: "윤다현" <ydh89@korea.kr>
To: help@baetnil.com
Subject: =?UTF-8?B?7JyE7LmY6riw67CY7ISc67mE7IqkIOyWkeyLnQ==?=
MIME-Version: 1.0
Content-Type: multipart/mixed; boundary="${B}"

--${B}
Content-Type: text/plain; charset="utf-8"
Content-Transfer-Encoding: base64

${Buffer.from('안녕하세요\n양식 첨부하여 송부 드립니다','utf8').toString('base64')}
--${B}
Content-Type: application/haansofthwp; name="=?UTF-8?B?7JaR7IudLmh3cA==?="
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="=?UTF-8?B?7JaR7IudLmh3cA==?="

QUJDREVGRw==
--${B}
Content-Type: application/pdf
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename*=UTF-8''%EB%8D%B0%EC%9D%B4%ED%84%B0%ED%9D%90%EB%A6%84%EB%8F%84.pdf

SEVMTE8=
--${B}
Content-Type: application/octet-stream
Content-Transfer-Encoding: base64
Content-Disposition: attachment; filename="report.pdf"

UkVQT1JU
--${B}--
`.replace(/\n/g, '\r\n');

// ══ 1. 첨부 이름을 뽑는다 ═════════════════════════════════════════
{
  const f = M.attachOf(편지);
  T('★★★ 첨부를 셋 다 찾는다', f.length === 3, f.map(x=>x.name));
  // ★ Content-Type 에 name= 이 없고 filename= 만 있는 것 — 제일 흔한 꼴이다
  T('★★★ 예사 filename="…" 도 읽는다', f[2].name === 'report.pdf', f[2].name);
  T('★★★ 한글 파일 이름(=?UTF-8?B?)을 읽는다', f[0].name === '양식.hwp', f[0].name);
  T('★★★ filename*=UTF-8\'\' 꼴도 읽는다', f[1].name === '데이터흐름도.pdf', f[1].name);
  T('★★ 본문 조각은 첨부로 안 센다', !f.some(x => /text\/plain/.test(x.type)), f.map(x=>x.type));
  T('★★ 첨부 몸통을 그대로 들고 있다', f[0].body.trim() === 'QUJDREVGRw==', f[0].body);
  T('★★ 머리글도 들고 있다 (그대로 옮겨 담으려고)', /Content-Type: application\/pdf/.test(f[1].head), f[1].head);
}

// ══ 2. 첨부 없는 편지에도 안 터진다 ═══════════════════════════════
{
  const 홑 = 'From: a@b.com\r\nSubject: hi\r\nContent-Type: text/plain\r\n\r\n안녕';
  T('★★ 첨부 없으면 빈 목록', M.attachOf(홑).length === 0);
  T('★★ 본문은 그대로 읽는다', M.plainBody(홑).trim() === '안녕', M.plainBody(홑));
}

// ══ 3. 우리 이름으로 지은 편지 ════════════════════════════════════
{
  let 보낸 = null;
  const env = { FORWARD_TO: 'jaha814@gmail.com',
                SEND_MAIL: { send: m => { 보낸 = m; } } };
  const files = M.attachOf(편지);
  await M.sendOurs(env, { from:'ydh89@korea.kr', name:'윤다현',
    subject:'위치기반서비스 양식', text:'안녕하세요\n양식 첨부하여 송부 드립니다',
    files, raw: 편지 });
  T('보냈다', !!보낸);
  const r = 보낸.raw;
  T('★★★ 우리 이름으로 나간다 (남의 도메인이 아니다)',
    /^From: .*<help@baetnil\.com>/m.test(r) && 보낸.from === 'help@baetnil.com', r.slice(0,200));
  T('★★★ 받는 사람이 맞다', 보낸.to === 'jaha814@gmail.com');
  T('★★★ 답장은 원래 보낸 사람에게 간다', /^Reply-To: ydh89@korea\.kr$/m.test(r), r.slice(0,300));
  T('★★★ 제목에 [뱃일] 이 붙고 한글이 안 깨진다',
    /^Subject: =\?UTF-8\?B\?/m.test(r)
    && Buffer.from((r.match(/^Subject: =\?UTF-8\?B\?([^?]*)\?=/m)||[])[1] || '', 'base64')
         .toString('utf8') === '[뱃일] 위치기반서비스 양식',
    (r.match(/^Subject:.*$/m)||[])[0]);
  T('★★ Message-ID 가 우리 도메인이다', /^Message-ID: <[^>]+@baetnil\.com>$/m.test(r));
  T('★★ 날짜가 붙는다', /^Date: /m.test(r));

  // ★★★ 첨부가 그대로 실렸는가 — 이것이 이 고침의 핵심이다
  T('★★★ 첨부 셋이 다 실린다',
    r.indexOf('QUJDREVGRw==') > 0 && r.indexOf('SEVMTE8=') > 0 && r.indexOf('UkVQT1JU') > 0, r.slice(-900));
  T('★★★ 첨부 이름도 그대로 간다',
    /filename="=\?UTF-8\?B\?7JaR7IudLmh3cA==\?="/.test(r)
    && /filename\*=UTF-8''%EB%8D%B0/.test(r), r.slice(-900));
  T('★★★ base64 를 다시 손대지 않는다 (한 번 더 만지면 깨진다)',
    !/QUJDREVGRw%3D%3D|UVVKRFJFVkhSdz09/.test(r));
  T('★★ 본문 안내에 보낸 사람·제목·첨부가 적힌다', (() => {
    const m2 = r.match(/Content-Type: text\/plain; charset="utf-8"\r\nContent-Transfer-Encoding: base64\r\n\r\n([\s\S]*?)\r\n--/);
    const t2 = Buffer.from((m2 ? m2[1] : '').replace(/\r\n/g, ''), 'base64').toString('utf8');
    return /윤다현/.test(t2) && /위치기반서비스 양식/.test(t2) && /양식\.hwp/.test(t2);
  })(), r.slice(0, 900));

  // 구분줄이 제대로 닫히는가 (안 닫으면 지메일이 통째로 못 읽는다)
  const bd = (r.match(/boundary="([^"]+)"/) || [])[1];
  T('★★★ 구분줄이 제대로 닫힌다', !!bd && r.trimEnd().endsWith('--' + bd + '--'), r.slice(-120));
  T('★★ 조각 수가 맞다 (안내 1 + 첨부 3)',
    (r.split('--' + bd).length - 2) === 4, r.split('--' + bd).length);
}

// ══ 4. 첨부 없는 편지도 보내진다 ══════════════════════════════════
{
  let 보낸 = null;
  const env = { FORWARD_TO: 'x@y.com', SEND_MAIL: { send: m => { 보낸 = m; } } };
  await M.sendOurs(env, { from:'a@b.com', name:'', subject:'', text:'', files:[], raw:'' });
  T('★★ 첨부 없이도 보내진다', !!보낸);
  T('★★ 제목이 비어도 자리를 채운다', /제목 없음/.test(
    Buffer.from((보낸.raw.match(/^Subject: =\?UTF-8\?B\?([^?]*)\?=/m)||['',''])[1],'base64').toString('utf8')));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
