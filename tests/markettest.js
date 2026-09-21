// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 3.20 — 중고 장터
//
// ★ 여기는 돈이 오간다. 사기가 가장 많이 생기는 자리다.
//   그래서 기능보다 먼저 이 셋을 못 박는다.
//
//   1) 고지 — 전자상거래법상 중개자는 '자신이 거래의 당사자가 아니라는 사실' 을
//      미리 알려야 한다. 이건 의무다. 안 하면 과태료·시정명령 대상이고,
//      분쟁이 생기면 책임 소재가 흐려진다.
//      다만 고지했다고 완전 면책되는 것은 아니다 — 실제로 신고를 처리했는지를 본다.
//      (변호사 검토는 따로 받아야 한다. 이 하네스는 '빠뜨리지 않았는지' 만 본다)
//   2) 안전거래 안내 — 선입금이 사기의 거의 전부다. 눈에 띄는 자리에 있어야 한다.
//   3) 신고와 자동 숨김 — 고지만 하고 방치하면 그것이 책임이 된다.
//
// 배 물건의 특성도 담는다 — 엔진 시간, 연식, 시운전 여부는
// 값을 가르는 결정적 정보인데 일반 중고 앱에는 없는 칸이다.
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

// ── 1. ★ 고지 — 빠뜨리면 안 되는 것
{
  const f = grab(js, 'marketNotice') || '';
  T('고지 문구가 한 곳에 있다', f.length > 0);
  T('거래의 당사자가 아니라고 밝힌다', /당사자가 아/.test(f));
  T('책임이 파는 사람과 사는 사람에게 있다고 밝힌다',
    /판매자|파는 사람/.test(f) && /구매자|사는 사람/.test(f));
  T('앱 이름을 넣어 누가 중개자인지 분명히 한다', /뱃일/.test(f));
  // ★ 목록에도, 물건 하나하나에도 보여야 한다. 한 군데만 있으면 못 본다.
  T('목록 화면에 고지가 있다', /marketNotice\(/.test(((grab(js, 'renderMarket')||'') + (grab(js, 'marketRowsHtml')||''))));
  T('물건 화면에도 고지가 있다', /marketNotice\(/.test(grab(js, 'openItem') || ''));
  // 처음 들어올 때 한 번은 눈으로 읽게 한다
  T('처음 들어오면 한 번 안내한다', !!grab(js, 'marketFirstNotice'));
  const fn2 = grab(js, 'marketFirstNotice') || '';
  T('읽었다는 것을 기억한다', /localStorage|bt_market/.test(fn2));
}

// ── 2. ★ 안전거래 안내 — 선입금이 사기의 거의 전부다
{
  const f = grab(js, 'marketSafety') || '';
  T('안전거래 안내가 한 곳에 있다', f.length > 0);
  T('선입금을 조심하라고 한다', /선입금|먼저 보내|입금부터/.test(f));
  T('직접 보고 사라고 한다', /직접 보|만나서|시운전|눈으로/.test(f));
  T('물건 화면에 안내가 붙는다', /marketSafety\(/.test(grab(js, 'openItem') || ''));
}

// ── 3. 무엇을 파나 — 배 물건의 특성
{
  const k = (js.match(/const MARKET_CATS = \[[\s\S]*?\];/) || [''])[0];
  T('품목 목록이 있다', k.length > 0);
  ['boat','engine','sail','elec','safety','fish','etc'].forEach(v=>
    T('품목에 ' + v + ' 가 있다', new RegExp("v:'" + v + "'").test(k)));
  const s2 = (js.match(/const MARKET_STATES = \[[\s\S]*?\];/) || [''])[0];
  T('판매 상태가 있다', s2.length > 0);
  ['sale','hold','done'].forEach(v=>
    T('상태에 ' + v + ' 가 있다', new RegExp("v:'" + v + "'").test(s2)));
  const w = grab(js, 'itemForm') || '';
  // ★ 배 물건은 연식·사용시간이 값을 가른다. 일반 중고 앱에는 없는 칸이다.
  T('연식을 적을 수 있다', /연식/.test(w));
  T('사용 시간을 적을 수 있다', /사용 시간|엔진 시간|시간/.test(w));
  T('가격을 적을 수 있다', /가격/.test(w));
  T('무료 나눔·가격 제안도 고를 수 있다', /무료 나눔/.test(w) && /제안/.test(w));
}

// ── 4. 가격을 사람이 읽게 보여 준다
{
  const f = grab(js, 'priceText') || '';
  T('가격을 보여 주는 곳이 있다', f.length > 0);
  let out = null, err = '';
  if(f){
    try{
      // ★ 4.102 — 값에 붙는 화폐 단위는 **적은 사람의 나라** 것을 쓴다 (사장님이 정하신 것 14).
      //   priceText 가 curOf 를 지나므로 검사에서도 그 문을 함께 넣어 준다.
      const cur = grab(js, 'curOf') || "function curOf(){ return '원'; }";
      const fn = new Function("const t = s => s;\n" + cur + '\n' + f + '\n return priceText;')();
      out = { 없음: fn({}), 무료: fn({ price:0, free:true }),
              제안: fn({ offer:true }), 값: fn({ price:1200000 }) };
    }catch(e){ err = e.message; }
  }
  T('가격 계산을 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('무료 나눔은 그렇게 적는다 — ' + out.무료, /무료/.test(out.무료));
    T('가격 제안은 그렇게 적는다 — ' + out.제안, /제안/.test(out.제안));
    T('큰 숫자는 읽기 쉽게 끊는다 — ' + out.값, /1,200,000|120만/.test(out.값));
    T('값이 없으면 빈말을 안 한다 — ' + out.없음, out.없음 !== '0원');
  } else fail += 4;
}

// ── 5. 고치고 지우는 건 올린 사람과 운영자
{
  const c = grab(js, 'canDelItem') || '';
  T('지울 수 있는지 보는 곳이 있다', c.length > 0);
  T('올린 본인은 지울 수 있다', /meUid\(\)/.test(c) && /\.by/.test(c));
  T('운영자도 지울 수 있다', /isAdmin\(/.test(c));
  T('막힌 사람은 못 올린다', /myBan/.test(grab(js, 'writeItem') || ''));
  T('팔렸다고 표시할 수 있다', !!grab(js, 'setItemState'));
  T('상태 바꾸기도 올린 사람만', /canDelItem\(|canEditItem\(/.test(grab(js, 'setItemState') || ''));
}

// ── 6. 신고와 자동 숨김
{
  const r = grab(js, 'reportItem') || '';
  T('신고할 수 있다', r.length > 0);
  T('신고 사유를 고른다', /REPORT_REASONS/.test(r));
  T('한 사람이 두 번 신고하지 못한다', /이미 신고하신/.test(r));
  T('자동 숨김 기준값이 있다', /const MARKET_HIDE_AT/.test(js));
  T('신고가 쌓이면 숨긴다', /MARKET_HIDE_AT/.test(r) && /hidden/.test(r));
  T('숨은 물건은 목록에서 빠진다',
    /\.filter\(m => !m\.hidden/.test(((grab(js, 'renderMarket')||'') + (grab(js, 'marketRowsHtml')||''))));
  T('운영자에게는 숨은 물건도 보인다',
    /!m\.hidden \|\| isAdmin\(/.test(((grab(js, 'renderMarket')||'') + (grab(js, 'marketRowsHtml')||''))));
  // 운영자가 사기 계정을 곧바로 볼 수 있어야 한다
  T('물건에서 올린 사람으로 갈 수 있다 (운영자)',
    /isAdmin\(\)[\s\S]{0,200}?openPerson\(/.test(grab(js, 'openItem') || ''));
}

// ── 7. 찾기와 거르기
{
  const f = grab(js, 'itemMatch') || '';
  T('제목·설명으로 찾는다', /toLowerCase\(\)/.test(f));
  T('품목으로 거를 수 있다', /marketCat/.test(((grab(js, 'renderMarket')||'') + (grab(js, 'marketRowsHtml')||''))));
  T('판 물건은 뒤로 보낸다', /done/.test(((grab(js, 'renderMarket')||'') + (grab(js, 'marketRowsHtml')||''))));
}

// ── 8. 커뮤니티 안에 자리를 잡는다
{
  T('커뮤니티 하위에 장터가 있다', /market\s*:\s*(t\()?'중고 장터'/.test(js));
  T('장터가 그릴 자리가 있다', /id="marketWrap"/.test(src));
  T('화면을 그릴 때 장터도 그린다', /renderMarket\(/.test(grab(js, 'renderCurrent') || ''));
}

// ── 9. 클라우드
{
  T('장터를 주고받는 곳이 있다', /window\.__market = \{/.test(mod));
  ['list','put','edit','del'].forEach(k=>
    T('__market 에 ' + k + ' 이 있다',
      new RegExp('async ' + k + '\\(').test(mod.slice(mod.indexOf('window.__market')))));
}

// ── 10. ★ 규칙 — 진짜 방어선
if(rules){
  const g = seg('market');
  T('장터 규칙이 있다', g.length > 0);
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
  T('신고는 자기 것만 남긴다', /reports/.test(one('update')));
} else { console.log('★ 실패: 규칙 파일을 읽지 못했습니다 (7건)'); fail += 7; }

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
