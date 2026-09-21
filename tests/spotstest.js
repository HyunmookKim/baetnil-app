// 3.19 — 정박지 지도
//
// 무엇을 담을지 실제 서비스를 보고 정했다.
//  · 해외 정박지 앱(Navily)이 맨 앞에 두는 것 셋 —
//    수심과 바닥, 어느 바람에 막히는가, 다녀온 사람의 한마디.
//  · 국내 마리나(마리나포털·왕산·김포 등)가 안내하는 것 —
//    수심, 전기·급수·급유, 크레인, 계류료, 연락처.
//  · 우리 바다의 사정 하나 더 — 조수간만 차가 커서
//    '저조위에 바닥이 닿느냐' 가 들어갈 수 있느냐를 가른다.
//
// 정한 것
//  · 자리는 지도에서 찍는다. 위도·경도를 손으로 치게 하지 않는다.
//  · 나머지도 전부 눌러서 고른다 (배 위에서 쓴다).
//  · 올리는 건 누구나, 고치고 지우는 건 올린 사람과 운영자.
//    아무나 고치게 두면 누가 무엇을 바꿨는지 몰라 싸움이 난다.
//  · 신고가 쌓이면 목록에서 내려간다 (글판과 같은 방식).
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);
const mod = src.slice(src.indexOf('<script type="module">'));
let rules = '';
try{ rules = fs.readFileSync(process.argv[3] || 'firestore_rules.txt', 'utf8'); }catch(e){}
const seg = k => (rules.match(new RegExp('match /' + k + '/\\{[a-zA-Z]+\\}[\\s\\S]*?\\n    \\}')) || [''])[0];
const allows = g => g.split('\n').map(l=>l.replace(/\/\/.*$/, '')).join('\n')
  .split(/allow /).slice(1).map(x => x.split(';')[0]);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 커뮤니티 안에 자리를 잡는다
{
  T('커뮤니티 하위에 정박지가 있다', /spots\s*:\s*(t\()?'정박지'/.test(js));
  T('정박지가 그릴 자리가 있다', /id="spotWrap"/.test(src));
  T('탭을 바꾸면 정박지가 나온다', /spotWrap[\s\S]{0,80}?comSub *=== *'spots'/.test(grab(js,'switchTab')||''));
  T('정박지를 그리는 곳이 있다', !!grab(js, 'renderSpots'));
  T('화면을 그릴 때 정박지도 그린다', /renderSpots\(/.test(grab(js, 'renderCurrent') || ''));
}

// ── 2. 무엇을 담나 — 조사해서 정한 항목
{
  const k = (js.match(/const SPOT_KINDS = \[[\s\S]*?\];/) || [''])[0];
  T('정박지 종류가 있다', k.length > 0);
  ['marina','port','break','anchor'].forEach(v=>
    T('종류에 ' + v + ' 가 있다', new RegExp("v:'" + v + "'").test(k)));
  T('여덟 방위가 있다', /const SPOT_DIRS = \[[\s\S]*?'NW'/.test(js));
  T('방위를 우리말로 보여 준다', /const SPOT_DIR_KO/.test(js));
  T('바닥 종류가 있다', /const SPOT_BOTTOM = \[/.test(js));
  const b = (js.match(/const SPOT_BOTTOM = \[[\s\S]*?\];/) || [''])[0];
  ['뻘','모래','자갈','바위'].forEach(x=>
    T('바닥에 ' + x + ' 가 있다', b.includes(x)));
  const f = (js.match(/const SPOT_FAC = \[[\s\S]*?\];/) || [''])[0];
  T('시설 목록이 있다', f.length > 0);
  ['power','water','fuel','toilet','crane'].forEach(x=>
    T('시설에 ' + x + ' 가 있다', new RegExp("k:'" + x + "'").test(f)));
}

// ── 3. ★ 정박지의 핵심 — 어느 바람에 트여 있나
//    Navily 가 맨 앞에 두는 것이고, 배를 대도 되는지를 가른다.
{
  const f = grab(js, 'spotShelterText') || '';
  T('막힘을 사람 말로 바꾸는 곳이 있다', f.length > 0);
  let out = null, err = '';
  if(f){
    try{
      const KO = (js.match(/const SPOT_DIR_KO = \{[\s\S]*?\};/) || [''])[0];
      const fn = new Function(KO + '\n' + f + '\n return spotShelterText;')();
      out = { 없음: fn({ open:[] }),
              하나: fn({ open:['NE'] }),
              둘:   fn({ open:['S','SW'] }),
              사방: fn({ open:['N','NE','E','SE','S','SW','W','NW'] }) };
    }catch(e){ err = e.message; }
  }
  T('막힘 계산을 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('트인 곳이 없으면 아무 말도 안 한다', out.없음 === '');
    T('한 방향은 우리말로 — ' + out.하나, /북동/.test(out.하나) && /트여/.test(out.하나));
    T('여러 방향도 이어 붙인다 — ' + out.둘, /남/.test(out.둘) && /남서/.test(out.둘));
    T('사방이 트이면 위험하다고 말한다 — ' + out.사방, /위험/.test(out.사방));
  } else fail += 4;
}

// ── 4. ★ 우리 바다 — 저조위 수심
{
  const f = grab(js, 'spotDepthText') || '';
  T('수심을 보여 주는 곳이 있다', f.length > 0);
  let out = null, err = '';
  if(f){
    try{
      const fn = new Function(f + '\n return spotDepthText;')();
      out = { 없음: fn({}), 저조: fn({ depth:'2.5', lowTide:true }), 모름: fn({ depth:'2.5' }) };
    }catch(e){ err = e.message; }
  }
  T('수심 계산을 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('수심이 없으면 아무 말도 안 한다', out.없음 === '');
    T('저조위 기준이면 그렇게 적는다 — ' + out.저조, /저조위/.test(out.저조));
    T('기준을 모르면 물때를 확인하라고 한다 — ' + out.모름,
      /물때/.test(out.모름) && !/저조위 기준\)/.test(out.모름));
  } else fail += 3;
  T('저조위 칩이 화면에 있다', /저조위 기준/.test(grab(js, 'spotForm') || ''));
}

// ── 5. ★ 자리는 지도에서 찍는다
{
  const p = grab(js, 'spotPickPlace') || '';
  T('자리 찍는 화면이 있다', p.length > 0);
  T('지도를 눌러 고른다', /mode:'pick'/.test(p));
  T('현재 위치로 잡는 길도 있다', !!grab(js, 'spotUseGPS'));
  // ★ 위도·경도를 타이핑시키면 배 위에서 못 쓴다
  const w = grab(js, 'spotForm') || '';
  T('위도·경도를 손으로 치게 하지 않는다',
    !/label:'위도|>위도</.test(w) && !/label:'경도|>경도</.test(w));
  T('자리를 안 찍으면 다음으로 못 간다', /지도를 탭해서/.test(grab(js, 'spotPlaceNext') || ''));
  T('자리 없이 저장하지 않는다', /위치를 먼저 찍어/.test(grab(js, 'spotSave') || ''));
  T('이름 없이 저장하지 않는다', /이름을 넣어/.test(grab(js, 'spotSave') || ''));
}

// ── 6. ★ 칩을 누르면 적던 글이 날아가면 안 된다
//    화면을 다시 그리므로 그 전에 글자 칸을 챙겨야 한다.
{
  const k = grab(js, 'spotKeep') || '';
  T('적던 내용을 챙기는 곳이 있다', k.length > 0);
  ['spName','spDepth','spTide','spFee','spTel','spNote'].forEach(id=>
    T(id + ' 를 챙긴다', k.includes(id)));
  ['spotSet','spotDir','spotFac'].forEach(fn=>
    T(fn + ' 이 다시 그리기 전에 챙긴다',
      /spotKeep\(\);[\s\S]{0,40}?spotForm\(\)/.test(grab(js, fn) || '')));
}

// ── 7. 고치고 지우는 건 올린 사람과 운영자
{
  const c = grab(js, 'canDelSpot') || '';
  T('지울 수 있는지 보는 곳이 있다', c.length > 0);
  T('올린 본인은 지울 수 있다', /meUid\(\)/.test(c) && /\.by/.test(c));
  T('운영자도 지울 수 있다', /isAdmin\(/.test(c));
  // ★★★ 4.99 — 사장님이 정하신 대로 **글은 아무나 고친다** (나무위키 방식).
  //   옛 검사는 「고치기 = 지우기와 같은 기준」 을 지키고 있었다. 그 설계가 물러났다.
  //   대신 **지우기와 자리와 사진** 이 여전히 좁은지를 본다 — 열린 것은 글뿐이어야 한다.
  T('★★★ 글은 로그인만 하면 고친다', /return !!meUid\(\);/.test(grab(js, 'canEditSpot') || ''),
    grab(js, 'canEditSpot'));
  T('★★★ 지우기는 그대로 임자·운영자만', /canDelSpot\(/.test(grab(js, 'delSpot') || ''));
  T('★★★ 자리(핀)는 아무나 못 옮긴다', /canDelSpot\(|isAdmin\(/.test(grab(js, 'canMoveSpot') || '')
    && /if\(s\.seed\) return false;/.test(grab(js, 'canMoveSpot') || ''), grab(js, 'canMoveSpot'));
  T('★★★ 사진도 임자·운영자만', /canDelSpot\(/.test(grab(js, 'canPhotoSpot') || ''));
  T('고치기 전에 확인한다', /canEditSpot\(/.test(grab(js, 'writeSpot') || ''));
  T('지우기 전에 묻는다', /if\(!await ask\(/.test(grab(js, 'delSpot') || ''));
  T('막힌 사람은 못 올린다', /myBan/.test(grab(js, 'writeSpot') || ''));
}

// ── 8. 신고와 자동 숨김 (글판과 같은 방식)
{
  const r = grab(js, 'reportSpot') || '';
  T('신고할 수 있다', r.length > 0);
  T('신고 사유를 고른다', /REPORT_REASONS/.test(r));
  T('한 사람이 두 번 신고하지 못한다', /이미 신고하신/.test(r));
  T('자동 숨김 기준값이 있다', /const SPOT_HIDE_AT/.test(js));
  T('신고가 쌓이면 숨긴다', /SPOT_HIDE_AT/.test(r) && /hidden/.test(r));
  // 'hidden' 글자만 보면 목록의 '숨김' 칩에 걸려 헛통과한다
  T('숨은 자리는 목록에서 빠진다',
    /\.filter\(s => !s\.hidden/.test(((grab(js, 'renderSpots')||'') + (grab(js, 'spotRowsHtml')||''))));
  T('운영자에게는 숨은 자리도 보인다',
    /!s\.hidden \|\| isAdmin\(/.test(((grab(js, 'renderSpots')||'') + (grab(js, 'spotRowsHtml')||''))));
}

// ── 8-2. 지도에 'undefined' 가 찍히지 않는다
{
  const mp = grab(js, 'mapPaint') || '';
  // ★ 4.76 — 정박지 핀도 이름표를 그린다. 다만 반드시 「있을 때만」 이어야 한다.
  //   막던 것은 esc(p.label) 자체가 아니라 **가리지 않고 그리는 것**이었다.
  //   그리는 줄마다 「있을 때만」 이 붙어 있는지 한 줄씩 본다.
  //   ★ 중간기록 깃발(mflag)은 빼고 본다 — 거기는 이름이 비면 t('기록') 으로 채우게 되어 있다.
  // ★ 4.99 — 이름표 줄이 여러 줄로 늘어났다 (겹침을 피하는 자리잡기가 들어가면서).
  //   줄로도, 세미콜론으로도 못 가른다 — 안에 style="…;…" 이 들어 있다.
  //   그래서 이름표를 찍는 자리마다 **그 앞을 되짚어** 「있을 때만」 이 붙었는지 본다.
  const 자리 = [];
  ['esc(p.label)', 'esc(lab)'].forEach(표 => {
    let at = mp.indexOf(표);
    while(at >= 0){ 자리.push(at); at = mp.indexOf(표, at + 1); }
  });
  const 안가림 = 자리
    .map(at => mp.slice(Math.max(0, at - 420), at).replace(/\s+/g, ' '))
    .filter(앞 => !/mflag|mapFlagTap/.test(앞.slice(-160)))     // 깃발은 늘 그린다 (제 갈래다)
    .filter(앞 => !/if\(lab\)|if\(p\.label\)/.test(앞));
  T('이름표가 없으면 아예 안 그린다', 자리.length > 0 && 안가림.length === 0, 안가림);
  // ★ 4.81 — 이름은 보는 사람 말로 옮긴 것을 넘긴다. 날 이름(s.name)을 넘기면
  //   목록은 옮겨졌는데 지도 핀만 남의 말로 남는다.
  T('정박지 지도에 이름을 넘긴다', /label:spotShowName\(s\)/.test(grab(js, 'openSpot') || ''));
}

// ── 9. 찾기
{
  const f = grab(js, 'spotMatch') || '';
  T('이름·지역으로 찾는다', /toLowerCase\(\)/.test(f) && /name/.test(f) && /region/.test(f));
  T('종류로 거를 수 있다', /spotKind/.test(((grab(js, 'renderSpots')||'') + (grab(js, 'spotRowsHtml')||''))));
}

// ── 10. 클라우드
{
  T('정박지를 주고받는 곳이 있다', /window\.__spots = \{/.test(mod));
  ['list','put','edit','del'].forEach(k=>
    T('__spots 에 ' + k + ' 이 있다', new RegExp('async ' + k + '\\(').test(mod.slice(mod.indexOf('window.__spots')))));
}

// ── 11. ★ 규칙 — 진짜 방어선
if(rules){
  const g = seg('spots');
  T('정박지 규칙이 있다', g.length > 0);
  const A = allows(g);
  const one = k => A.filter(x=>new RegExp('^' + k).test(x)).join(' ');
  T('로그인한 사람은 본다', /signedIn\(\)/.test(one('read') + one('get') + one('list')));
  T('남의 이름으로 못 올린다',
    /request\.resource\.data\.by == request\.auth\.uid/.test(one('create')));
  T('막힌 사람은 못 올린다', /!banned\(\)/.test(one('create')));
  T('처음부터 숨긴 채로 못 올린다',
    /request\.resource\.data\.get\('hidden', ?false\) ?== ?false/.test(one('create')));
  T('올린 본인이나 운영자만 지운다',
    /resource\.data\.by == request\.auth\.uid/.test(one('delete'))
    && /adminCan\('postDel'\)/.test(one('delete')));
  T('남의 것을 함부로 못 고친다', one('update').length > 0);
  T('신고는 자기 것만 남긴다', /reports/.test(one('update')));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (8건)'); fail += 8; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
