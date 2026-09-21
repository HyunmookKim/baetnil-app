// 4.99 — 정박지 판(고친 이야기)과 되돌리기 · 다녀온 이야기 사진
//
// ★ 사장님 지적 (2026-09-01)
//   ① "사진 같은 거는 두 가지 종류로 하자. 그냥 다녀와 가지고 재밌었다,
//      뭐 이런 리뷰 형식으로도 사진을 달 수 있게 하고,
//      진짜로 진지하게 이 지역에 대한 분석에 대한 사진은 본문에 넣게 하고"
//   ② "나무 위키가 판이 있어 가지고 몇 판 몇 판 이래서 과거에 썼던 내용들은
//      저장해 놓는 걸로 알거든. 필요에 따라서 판을 되돌릴 수 있고… 여기서는 안 되나"
//
// ★ ②가 왜 중요한가 — 나무위키의 힘은 「아무나 고친다」가 아니라
//   **「고친 것을 되돌린다」** 다. 되돌릴 길이 없으면 문을 열 수 없다.
//   4.99 에서 글을 아무나 고치게 열었으니, 되돌릴 길이 **반드시** 같이 있어야 한다.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,260):'')); } };
function grab(s, name){
  let i = s.indexOf('function ' + name + '(');
  if(i < 0) i = s.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}

// ══ 1. 판을 담는 방이 있다 ═════════════════════════════════════════
{
  T('★★★ 판을 담는 길이 있다 (window.__rev)', /window\.__rev = \{/.test(src));
  T('★★ 판은 그 자리 밑에 산다 (spots/{id}/rev)',
    /collection\(fdb, coll, String\(id\), 'rev'\)/.test(src));
  T('★★★ 시간 순으로 꺼낸다 (판 번호가 뒤섞이면 안 된다)',
    /revCol\(coll, id\), orderBy\('ts'\)/.test(src));
  T('★★ 담는 길이 있다', /async add\(coll, id, r\)\{/.test(src));
  T('★★ 지우는 길도 있다 (운영자용)', /async del\(coll, id, rid\)\{/.test(src));
  T('★★★ 고치는 길은 아예 없다 (판은 쌓기만 한다)',
    !/window\.__rev[\s\S]{0,700}async edit\(/.test(src));
}

// ══ 2. 판에 담는 것은 글자뿐이다 ══════════════════════════════════
{
  const F = (src.match(/const REV_FIELDS = \[[\s\S]*?\];/) || [''])[0];
  T('담을 칸을 한 곳에서 정한다', !!F);
  ['name','kind','open','depth','bottom','tideNote','fac','fee','tel','note']
    .forEach(k => T('★★ ' + k + ' 을 담는다', new RegExp("'" + k + "'").test(F)));
  ['lat','lon','photos','thumbs','by','ts','reports','reportN','hidden','likeN','cmtN','region']
    .forEach(k => T('★★★ ' + k + ' 은 안 담는다 (사진·자리는 애초에 아무나 못 바꾼다)',
      !new RegExp("'" + k + "'").test(F)));
  const pick = grab(src, 'revPick');
  T('★★★ 담을 때 그 칸만 골라 담는다', /REV_FIELDS\.forEach/.test(pick), pick);
}

// ══ 3. 무엇이 바뀌었는지 사람 말로 적는다 ═════════════════════════
{
  const L = (src.match(/const REV_LABEL = \{[\s\S]*?\};/) || [''])[0];
  T('칸 이름표가 있다', !!L);
  // ★ 앱에 이미 있는 말만 쓴다 (사장님이 정하신 것 6번)
  // ★ 4.113 — 「막힌 방향」 이었다. 담기는 값은 바람이 **트여 있는** 쪽이라 이름이 거꾸로였다
  //   (spotDir 이 d.open 에 담고, 화면 안내도 「트여 있는 방향을 눌러 주세요」 다).
  ['이름','종류','트인 방향','수심','바닥','물때','시설','요금','연락처','한마디']
    .forEach(w => T('★★ 이름표에 「' + w + '」 가 있다', L.indexOf("'" + w + "'") >= 0));
  const dif = grab(src, 'revDiff');
  T('견주는 문이 있다', !!dif);
  const F = new Function(`
    const t = s => s;
    ${(src.match(/const REV_FIELDS = \[[\s\S]*?\];/)||[''])[0]}
    ${(src.match(/const REV_LABEL = \{[\s\S]*?\};/)||[''])[0]}
    ${dif}
    return revDiff;`)();
  T('★★★ 안 바뀌면 빈 목록이다',
    F({name:'가', depth:'3'}, {name:'가', depth:'3'}).length === 0);
  T('★★★ 바뀐 칸만 집는다', JSON.stringify(F({name:'가', depth:'3'}, {name:'나', depth:'3'})) === '["이름"]');
  T('★★★ 목록(트인 방향)도 견준다',
    JSON.stringify(F({open:['n']}, {open:['n','s']})) === '["트인 방향"]');
  T('★★★ 표(시설)도 견준다', JSON.stringify(F({fac:{water:true}}, {fac:{water:true,fuel:true}})) === '["시설"]');
  T('★★★ 수심 세 칸이 한 이름으로 묶인다 (「수심 · 수심 · 수심」 이 되면 안 된다)',
    JSON.stringify(F({depth:'3',lowTide:false,depthFrom:null},
                     {depth:'4',lowTide:true, depthFrom:{raw:5}})) === '["수심"]');
  T('★★ 없던 값이 생긴 것도 잡는다', F({}, {fee:'1000원'}).length === 1);
  T('★★ null 과 없는 것을 같게 본다 (헛되이 「바뀌었다」 하지 않는다)',
    F({fee:null}, {}).length === 0);
}

// ══ 4. 손질할 때마다 판이 쌓인다 ══════════════════════════════════
{
  const keep = grab(src, 'revKeep');
  T('판을 남기는 문이 있다', !!keep);
  T('문이 하나다', (src.match(/function revKeep\(/g) || []).length === 1);
  T('★★★ 누가·언제를 함께 담는다', /by: meUid\(\)/.test(keep) && /ts: new Date\(\)\.toISOString\(\)/.test(keep), keep);
  T('★★★ 판을 못 남겨도 손질은 살린다 (조용히 삼킨다)',
    /try\{[\s\S]{0,200}window\.__rev\.add[\s\S]{0,140}\}catch\(_\)\{\}/.test(keep), keep);
  const sv = grab(src, 'spotSave') || '';
  T('★★★ 올린 뒤에 판을 남긴다', /await revKeep\(body\.id, body/.test(sv), sv.slice(-700));
  T('★★★ 올리기가 먼저다 (올리기가 실패하면 판도 안 남는다)',
    sv.indexOf('await window.__spots.put(body)') < sv.indexOf('await revKeep('), sv.slice(-700));
}

// ══ 5. 판 목록과 되돌리기 ═════════════════════════════════════════
{
  const op = grab(src, 'openSpotRevs');
  T('판 목록 화면이 있다', !!op);
  T('★★★ 판 번호를 1부터 센다', /n: i \+ 1/.test(op), op.slice(0,900));
  T('★★★ 첫 판은 「바뀐 곳」 이 아니라 「처음 올린 판」 이다',
    /i === 0 \? esc\(t\('처음 올린 판입니다\.'\)\)/.test(op), op);
  T('★★★ 지금 내용과 같은 판에는 「지금 판」 이라고 붙인다', /지금 판/.test(op), op);
  T('★★★ 지금 판에는 되돌리기 단추를 안 낸다 (눌러도 아무 일 없는 단추를 두지 않는다)',
    /같나 \? '' : `<button class="minib" onclick="spotRevBack/.test(op), op);
  T('★★ 판을 펼쳐 내용을 볼 수 있다', /spotRevPeek\(/.test(op));
  T('★★★ 무엇만 되돌아가는지 미리 밝힌다',
    /되돌리는 것은 글자뿐입니다 — 사진과 위치는 그대로 남습니다\./.test(op), op);

  const bk = grab(src, 'spotRevBack');
  T('되돌리는 문이 있다', !!bk);
  // ★ 「ask 가 있다」 만 보면 그 답을 안 보고 지나가는 것을 못 잡는다. 막는지를 본다.
  T('★★★ 되돌리기 전에 묻고, 아니라 하시면 멈춘다',
    /if\(!await ask\(tsub\('\{n\}판으로 되돌릴까요\?'/.test(bk), bk);
  T('★★★ 몇 판으로 가는지 묻는 말에 적는다', /\{n\}판으로 되돌릴까요\?/.test(bk), bk);
  T('★★★ 되돌린 것도 새 판으로 남는다 (나무위키와 같다)',
    /await revKeep\(id, body, tsub\('\{n\}판으로 되돌렸습니다\./.test(bk), bk);
  T('★★★ 있는 문서 위에 글자만 얹는다', /Object\.assign\(\{\}, s, revPick\(r\)\)/.test(bk), bk);
  T('★★★ 잠금·차단을 지난다', /guardEdit\(/.test(bk) && /myBan/.test(bk), bk);
  T('★★ 찾기 조각을 다시 만든다 (이름이 바뀌면 찾기도 따라가야 한다)',
    /body\.kw = kwOf\(/.test(bk), bk);
  T('★★ 관 자료 표시를 떼고 올린다', /delete body\.seed; delete body\.plan;/.test(bk), bk);

  const os = grab(src, 'openSpot') || '';
  T('★★★ 자리 화면에서 판으로 가는 길이 있다', /onclick="openSpotRevs\(/.test(os), os);
  T('★★ 자리를 열 때 판을 미리 받아 둔다', /await loadSpotRevs\(id\)/.test(os), os);
}

// ══ 6. 사진 두 갈래 — 본문과 다녀온 이야기 ═════════════════════════
{
  const wc = grab(src, 'writeSpotComment');
  T('★★★ 다녀온 이야기에 사진 칸이 있다', /key:'photos', type:'photos'/.test(wc), wc);
  T('★★★ 사진만 남겨도 된다 (글자를 꼭 안 적어도 된다)',
    /if\(!v\.text && !shots\.length\)/.test(wc), wc);
  T('★★★ 사진 수를 한 곳에서 정한다', /const CMT_PH_MAX = \d+;/.test(src));
  const 몇 = (src.match(/const CMT_PH_MAX = (\d+);/) || [])[1];
  T('★★ 본문 사진(4장)보다 적게 잡는다 — ' + 몇 + '장', Number(몇) > 0 && Number(몇) < 4);
  T('★★★ 넣을 때 그 수로 자른다', /v\.photos\.slice\(0, CMT_PH_MAX\)/.test(wc), wc);
  T('★★★ 창고에 올린 뒤에 담는다 (문서 안에 사진을 넣지 않는다)',
    /await storePhotos\(shots\)/.test(wc), wc);
  T('★★ 창고가 모자라면 안 남긴다', /storeShortMsg\(st\.dropped/.test(wc), wc);

  const ch = grab(src, 'spotCmtHtml');
  T('★★★ 이야기에 붙은 사진을 보여 준다', /c\.photos : \[\]\)\.slice\(0, CMT_PH_MAX\)/.test(ch), ch);
  T('★★ 글자가 없으면 빈 줄을 안 그린다', /\$\{c\.text \? `<div class="cmtbody">/.test(ch), ch);
  T('★★ 사진도 올릴 수 있다고 알려 준다', /사진도 함께 올리실 수 있습니다\./.test(ch));

  const os = grab(src, 'openSpot') || '';
  T('★★★ 본문 사진에 이름표를 붙였다 (두 갈래를 사람이 갈라 본다)',
    /이 위치 사진/.test(os), os);
  T('★★★ 본문 사진이 무엇인지 적는다',
    /수심 · 바닥 · 접안 위치처럼 위치를 알려 주는 사진/.test(os), os);

  const dc = grab(src, 'delSpotComment');
  T('★★★ 이야기를 지우면 그 사진도 치운다 (창고에 주인 없는 사진을 안 남긴다)',
    /dropPhotos\(사진들\)/.test(dc), dc);
  T('★★★ 지우기 전에 어떤 사진이었는지 챙겨 둔다 (지운 뒤엔 알 길이 없다)',
    dc.indexOf('const 사진들') < dc.indexOf('window.__cmt.del'), dc);
}

// ══ 7. 서버 규칙 ═══════════════════════════════════════════════════
{
  const r = fs.readFileSync(path.join(__dirname, 'firestore_rules.txt'), 'utf8');
  const 정 = r.slice(r.indexOf('match /spots/{spotId}'), r.indexOf('match /spots/{spotId}') + 11000);
  const rev = 정.slice(정.indexOf('match /rev/{revId}'), 정.indexOf('}', 정.indexOf('allow delete', 정.indexOf('match /rev/{revId}'))));
  T('★★★ 판 방이 있다', 정.indexOf('match /rev/{revId}') > 0);
  T('★★★ 누구나 판을 본다 (되돌릴지 판단하려면 봐야 한다)', /allow read: if true;/.test(rev), rev);
  T('★★★ 로그인하고 안 막힌 사람만 판을 남긴다',
    /allow create: if signedIn\(\) && !banned\(\)/.test(rev), rev);
  T('★★★ 남의 이름으로 판을 못 남긴다', /request\.resource\.data\.by == request\.auth\.uid/.test(rev), rev);
  // ★ 「false 가 있다」 만 보면 그 위에 true 한 줄을 더한 것을 못 잡는다.
  //   파이어스토어는 갈래 하나만 통과해도 열린다.
  T('★★★ 판은 아무도 못 고친다 (고칠 수 있으면 역사가 거짓말이 된다)',
    /allow update: if false;/.test(rev)
    && !/allow update: if (?!false;)/.test(rev)
    && !/allow write/.test(rev), rev);
  T('★★★ 판은 운영자만 지운다', /allow delete: if signedIn\(\) && adminCan\('postDel'\);/.test(rev), rev);

  const cmt = 정.slice(정.indexOf('match /comments/{cmtId}'));
  T('★★★ 사진만 있는 이야기도 받는다 (화면에서 되는 것이 서버에서 막히면 안 된다)',
    /text\.size\(\) > 0\s*\n?\s*\|\| request\.resource\.data\.get\('photos', \[\]\)\.size\(\) > 0/.test(cmt), cmt.slice(0,900));
  T('★★★ 사진 수를 서버에서도 못 박는다 (앱을 안 거치고 밀어 넣을 수 있다)',
    /get\('photos', \[\]\)\.size\(\) <= 3/.test(cmt), cmt.slice(0,900));
  T('★★ 썸네일 수도 못 박는다', /get\('thumbs', \[\]\)\.size\(\) <= 3/.test(cmt), cmt.slice(0,900));
  T('★★ 글자 길이는 그대로 지킨다', /text\.size\(\) <= 2000/.test(cmt), cmt.slice(0,900));
}

// ══ 8. 새로 쓴 말이 네 나라 말에 다 있다 ═══════════════════════════
{
  const 새말 = ['{n}판','고친 이야기','이 판으로 되돌리기','지금 판','처음 올린 판입니다.',
    '되돌리는 것은 글자뿐입니다 — 사진과 위치는 그대로 남습니다.','바뀐 곳 — {what}',
    '이 위치 사진','사진도 함께 올리실 수 있습니다.','아직 고친 적이 없습니다.'];
  ['en','ru','ja'].forEach(lg=>{
    const i = src.indexOf('\n  ' + lg + ': {');
    const j = src.indexOf('\n  },', i);
    const d = src.slice(i, j);
    새말.forEach(k=>{
      T(lg + ' 에 「' + k.slice(0,18) + '」 이 있다',
        d.indexOf("'" + k.replace(/'/g, "\\'") + "'") >= 0 || d.indexOf('"' + k + '"') >= 0);
    });
  });
}

console.log('\n통과 ' + pass + ' / 실패 ' + fail);
process.exit(fail ? 1 : 0);
