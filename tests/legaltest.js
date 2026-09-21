// 3.26 — 이용약관 · 개인정보처리방침 · 위치정보 · 가입 동의
//
// 왜
//  · 개인정보 보호법 제30조 — 개인정보를 처리하면 처리방침을 공개해야 한다. 의무다.
//    이 앱은 이메일·이름·계정번호·좌표·사진을 받는다. 해당된다.
//  · 만 14세 미만은 법정대리인 동의가 따로 필요하다. 그 절차를 만들지 않으므로 가입을 막는다.
//
// ★ 그리고 이 앱에만 있는 위험 — 날씨·물때·수심을 보여 주고 사람들이 그걸 보고 바다에 나간다.
//   자료는 틀릴 수 있다. 그 한계와 '출항 판단은 사람이 한다' 를 약관에 못 박고,
//   동의 화면에서도 눈에 띄게 말해야 한다. 법 때문이 아니라 사람이 다치기 때문이다.
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
const drawer = src.slice(src.indexOf('<aside id="drawer"'), src.indexOf('</aside>') + 8);

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// 문서를 실제로 만들어 본다 — 글자만 있고 안 만들어지면 소용없다
let DOC = null, DOC_EN = null, DOC_RU = null, K = null, err = '';
let PARTS = null, DOCSRC = null;
try{
  // 한 줄짜리 상수들. [\s\S]*? 로 잡으면 뒤 블록까지 삼켜 버린다.
  // ★ 여러 줄짜리 상수(LEGAL_OWNER)도 있다. 괄호를 세어서 통째로 떼어 온다 —
  //   한 줄만 떼어 오면 문법이 깨지고, 그러면 '문서를 못 만들었다' 로만 보여서 원인을 못 찾는다.
  const one = k => {
    const m = js.match(new RegExp('const ' + k + '\\s*=\\s*'));
    if(!m) return '';
    const at = m.index + m[0].length;
    if(js[at] !== '{' && js[at] !== '['){
      return js.slice(m.index, js.indexOf('\n', at) + 1);
    }
    const open = js[at], close = open === '{' ? '}' : ']';
    let d = 0, j = at;
    for(; j < js.length; j++){ if(js[j] === open) d++; else if(js[j] === close){ d--; if(!d){ j++; break; } } }
    return js.slice(m.index, j) + ';\n';
  };
  const parts = ['LEGAL_VER','LEGAL_DATES','LEGAL_DATE','LEGAL_OWNER','LEGAL_BIZ','LEGAL_LBS'].map(one).join('\n');
  // 3.91 부터 말마다 판이 따로 있다. 한국어(정본)를 본다.
  const docs = ['LEGAL_DOCS','LEGAL_DOCS_EN','LEGAL_DOCS_RU']
    .map(k => (js.match(new RegExp('const ' + k + ' = \\{[\\s\\S]*?\\n\\};')) || [''])[0]).join('\n');
  const fn = new Function('const langNow = () => "ko";\n' + parts + '\n' + docs + '\n'
    + (grab(js,'legalSet')||'') + '\n' + (grab(js,'legalText')||'') + '\n return legalText;')();
  DOC = { terms: fn('terms'), privacy: fn('privacy'), location: fn('location') };
  // 외국어판도 실제로 만들어지는지 함께 본다
  const fnL = new Function('let L = "ko"; const langNow = () => L;\n' + parts + '\n' + docs + '\n'
    + (grab(js,'legalSet')||'') + '\n' + (grab(js,'legalText')||'')
    + '\n return (k, v) => { L = v; return legalText(k); };')();
  DOC_EN = { terms: fnL('terms','en'), privacy: fnL('privacy','en'), location: fnL('location','en') };
  DOC_RU = { terms: fnL('terms','ru'), privacy: fnL('privacy','ru'), location: fnL('location','ru') };
  // 상수 자체도 꺼내 둔다 — 날짜 같은 값을 검사에 글자로 박지 않기 위해서다
  K = new Function(parts + '\n return { LEGAL_VER, LEGAL_DATES, LEGAL_OWNER, LEGAL_BIZ, LEGAL_LBS };')();
  PARTS = parts; DOCSRC = docs;
}catch(e){ err = e.message; }

// ── 1. 세 문서가 실제로 만들어진다
{
  T('약관 글을 만드는 곳이 있다', !!grab(js, 'legalText'));
  T('세 문서를 실제로 만들었다' + (err ? ' — ' + err : ''), !!DOC);
  if(DOC){
    T('이용약관이 비어 있지 않다 — ' + DOC.terms.length + '자', DOC.terms.length > 1500);
    T('개인정보처리방침이 비어 있지 않다 — ' + DOC.privacy.length + '자', DOC.privacy.length > 1500);
    T('위치정보 약관이 비어 있지 않다 — ' + DOC.location.length + '자', DOC.location.length > 500);
    // ★ 채울 자리가 그대로 남아 있으면 '{OWNER}' 가 화면에 나온다
    ['terms','privacy','location'].forEach(k=>
      T(k + ' 에 안 채운 자리가 없다', !/\{[A-Z]+\}/.test(DOC[k])));
    // ★ 주소를 글자로 박아 두면 회사 메일로 바꿀 때마다 검사가 깨진다.
    //   보아야 할 것은 'LEGAL_OWNER 에 적은 그 주소가 실제로 문서에 나오는가' 이다.
    //   그리고 개인 메일이 약관에 새어 나가면 안 된다 — 그걸 새로 막는다.
    const OWNER_MAIL = ((js.match(/const LEGAL_OWNER = \{[\s\S]*?email:\s*'([^']+)'/) || [])[1]) || '';
    T('이름과 연락처가 실제로 들어갔다',
      !!OWNER_MAIL && DOC.privacy.includes(OWNER_MAIL) && !/undefined/.test(DOC.privacy));
    T('약관에 개인 메일이 새어 나가지 않는다', !/gmail\.com/.test(DOC.privacy));
  } else fail += 6;
}

// ── 2. ★ 개인정보처리방침 — 법이 요구하는 것이 다 있나
if(DOC){
  const p = DOC.privacy;
  const need = [
    ['수집 항목',        /이메일/.test(p) && /이름/.test(p)],
    ['수집 방법',        /어떻게 모으나|수집 방법/.test(p)],
    ['이용 목적',        /왜 쓰나|이용 목적/.test(p)],
    ['보유 기간',        /얼마나 갖고|보유/.test(p)],
    ['제3자 제공',       /남에게 주나|제3자/.test(p)],
    ['처리 위탁',        /맡겨서|위탁/.test(p) && /Google/.test(p)],
    ['파기',            /없애나|파기/.test(p)],
    ['정보주체 권리',    /이용자의 권리|열람|정정/.test(p)],
    ['만 14세 미만',     /14세/.test(p)],
    ['안전성 확보조치',  /안전하게|암호화|HTTPS/.test(p)],
    ['보호책임자 성명',  /보호책임자/.test(p)],
    ['권익 침해 구제',   /침해신고센터|분쟁조정/.test(p)],
    ['변경 고지',        /바뀔 때|변경/.test(p)],
    ['시행일',          /부터 적용/.test(p)]
  ];
  need.forEach(([n,ok])=> T('방침에 ' + n + ' 이 있다', ok));
  // ★ 자료가 어디 있는지 안 적으면 국외 이전인지 알 수 없다
  T('자료가 어느 나라에 있는지 적는다', /서울|대한민국/.test(p));
  T('안 모으는 것도 밝힌다 (주민번호·카드번호)', /주민등록번호/.test(p) && /모으지 않/.test(p));
} else fail += 16;

// ── 3. ★ 이용약관 — 이 앱에서 사람이 다칠 수 있는 곳
if(DOC){
  const t = DOC.terms;
  T('약관에 출항 판단 조항이 있다', /출항/.test(t));
  T('날씨·물때가 참고 자료임을 밝힌다', /참고 자료/.test(t));
  T('수심 정보의 한계를 밝힌다', /수심/.test(t) && /해도/.test(t));
  T('판단과 책임이 이용자에게 있다고 적는다', /판단과 책임/.test(t));
  T('해도·기상청 대신 쓰지 말라고 한다', /대신 사용하지/.test(t));
  // 중고 장터 — 전자상거래법상 중개자 고지
  T('장터에서 거래 당사자가 아님을 밝힌다', /당사자가 아/.test(t));
  T('선입금하지 말라고 적는다', /먼저 돈을 보내/.test(t));
  T('만 14세 미만 가입을 막는다고 적는다', /14세 미만은 가입할 수 없/.test(t));
  T('금지 행위를 적는다', /사칭|욕설/.test(t));
  T('유료로 바뀔 때를 미리 적어 둔다', /유료/.test(t));
  T('이미 무료인 것을 몰래 유료로 안 바꾼다고 적는다', /예고 없이 유료로 바꾸지 않/.test(t));
  T('서비스를 끝낼 때 미리 알린다고 적는다', /30일 전/.test(t));
  // ★ 면책을 과하게 적으면 약관규제법에서 무효가 된다. 한계를 스스로 밝힌다.
  // ★ '고의·중과실' 이라는 글자가 어딘가 한 번 있다는 것으로는 부족하다.
  //   면책 문장 하나하나가 한정어를 달고 있어야 한다.
  //   무제한 면책 조항은 약관규제법 제7조로 무효가 되고, 그러면 오히려 전부 뒤집힌다.
  const 면책 = [...t.matchAll(/책임지지 않/g)].map(m =>
    t.slice(Math.max(0, m.index - 90), m.index));
  T('면책 문장이 ' + 면책.length + '개, 모두 고의·중과실 한정이 붙어 있다',
    면책.length > 0 && 면책.every(x => /고의|중대한 과실/.test(x)));
  T('무제한 면책 문구를 쓰지 않는다', !/어떠한 경우에도 책임/.test(t));
  T('소비자에게 불리하게 해석되지 않는다고 적는다', /불리하게 해석되지 않/.test(t));
  T('준거법과 관할이 있다', /대한민국 법/.test(t));
}else fail += 15;

// ── 4. 위치정보
if(DOC){
  const l = DOC.location;
  T('현재 위치는 기기 안에만 둔다고 적는다', /서버로 보내지 않/.test(l));
  T('거절해도 앱을 쓸 수 있다고 적는다', /거절해도/.test(l));
  T('동의를 거둘 수 있다고 적는다', /거둘 수 있/.test(l));
  T('항해 좌표가 밖으로 안 나간다고 적는다', /좌표는 밖으로 나가지 않/.test(l));
} else fail += 4;

// ── 4-2. ★★★ 위치정보법이 **약관에 적으라고 한 것**이 다 있나 (2026-09-04)
//   방송미디어통신위원회 신고 수리(신고번호 12276)와 함께 온 「주요 의무사항」 을 보고 훑었다.
//   법 제19조 제1항은 여섯 가지를 **약관에 명시**하라고 한다. 빠뜨리면 1천만원 이하 과태료다.
if(DOC){
  const l = DOC.location, L = { ko: DOC.location, en: DOC_EN.location, ru: DOC_RU.location };
  // ① 상호·주소·전화번호 그 밖의 연락처 (법 제19조①1)
  T('★★★ 약관에 사업자(상호·사업자번호·주소)가 적혀 있다 — 법 제19조①1',
    /사업자등록번호/.test(l) && /여수/.test(l));
  // ④ 확인자료 보유근거·보유기간 (법 제19조①4)
  T('★★★ 확인자료의 보유근거와 보유기간이 적혀 있다 — 법 제19조①4',
    /제16조/.test(l) && /6개월/.test(l));
  // ④의2 개인위치정보 보유목적·보유기간
  T('★★★ 위치정보의 보유목적과 보유기간이 적혀 있다 — 법 제19조①4의2',
    /이용 목적/.test(l) && /보유 기간/.test(l));
  // ⑤ 제3자 제공 통보에 관한 사항 (시행령 제23조)
  T('★★★ 제3자 제공 통보에 관한 사항이 적혀 있다 — 법 제19조③·시행령 제23조',
    /제19조 제3항/.test(l) && /즉시 알려/.test(l));
  // ★★★ 일시중지 — 안 갖추면 과태료 2천만원. 위치기반사업자에게 걸리는 최고액이다.
  T('★★★ **잠시 멈추기**가 약관에 있다 — 법 제24조② (과태료 2천만원, 최고액)',
    /제24조 제2항/.test(l) && /잠시 멈추/.test(l));
  T('★★★ 그리고 실제로 껐다 켤 수 있는 스위치가 있다',
    /function lgToggleConsent/.test(js) && /locSet\(false\)/.test(js) && /locSet\(true\)/.test(js));
  // 8세 이하 아동등 (법 제26조)
  T('★★★ 8세 이하 아동·피성년후견인·중증장애인을 다루는지 밝힌다 — 법 제26조',
    /제26조/.test(l) && /8세 이하/.test(l));
  // 열람·고지·정정 (법 제24조③)
  T('★★ 열람·고지 요구를 받는다고 적는다 — 법 제24조③', /열람이나 고지/.test(l));
  // 신고번호
  T('★★ 위치기반서비스사업 신고번호가 적혀 있다', /12276/.test(l));
  // 세 말 모두에 같은 사실이 있어야 한다 (한 말만 고치면 다른 말에서 샌다)
  ['en','ru'].forEach(v => {
    T('★★★ ' + v + ' — 잠시 멈추기가 적혀 있다', /24\(2\)/.test(L[v]));
    T('★★★ ' + v + ' — 제3자 제공 통보가 적혀 있다', /19\(3\)/.test(L[v]));
    T('★★★ ' + v + ' — 8세 이하 아동등이 적혀 있다', /Article 26|ст\. 26/.test(L[v]));
    T('★★ ' + v + ' — 신고번호가 적혀 있다', L[v].indexOf('12276') > 0);
  });
  // ★ 없는 화면을 가리키지 않는다 (사장님이 정하신 것 2 — 화면이 거짓말하게 두지 않는다)
  T('★★★ 약관이 없어진 화면(「내 위치정보 이용내역」)을 가리키지 않는다',
    !/내 위치정보 이용내역/.test(l) && !/My location use history/.test(L.en));
} else fail += 17;

// ── 5. 어디서나 볼 수 있어야 한다 (법 제30조 — 상시 공개)
{
  T('약관 화면이 있다', !!grab(js, 'openLegal'));
  // ★ 법이 요구하는 것은 「언제든 볼 수 있을 것」이지 「서랍에 있을 것」이 아니다.
  //   4.43 에서 설정 안으로 옮겼다. 그래서 자리를 못 박지 않고 **닿는가**를 본다.
  {
    const setBody = grab(js, 'openSettings') || '';
    const 서랍에 = /openLegal\(/.test(drawer);
    const 설정에 = /openLegal\(/.test(setBody) && /openSettings\(\)/.test(drawer);
    T('★ 언제든 두 번 안에 닿는다 (법 제30조 — 상시 공개) — ' +
      (서랍에 ? '서랍' : 설정에 ? '서랍 › 설정' : '길 없음'), 서랍에 || 설정에);
    // 두 곳에 두면 한쪽만 고치고 다른 쪽을 잊는다
    T('길이 하나다', !(서랍에 && 설정에));
  }
  const o = grab(js, 'openLegal') || '';
  T('세 문서를 오갈 수 있다', /LEGAL_DOCS/.test(o));
  T('로그인 없이도 볼 수 있다', !/meUid\(|window\.__user/.test(o));
}

// ── 6. ★ 동의 — 로그인 앞에 선다
{
  T('동의 화면이 있다', !!grab(js, 'openAgree') && !!grab(js, 'drawAgree'));
  const d = grab(js, 'drawAgree') || '';
  T('이용약관 동의를 받는다', /terms/.test(d));
  T('개인정보 동의를 받는다', /privacy/.test(d));
  T('만 14세 이상인지 받는다', /14세/.test(d));
  T('위치는 선택으로 받는다', /loc/.test(d) && /선택/.test(d));
  T('필수와 선택을 구분해 보여 준다', /필수/.test(d) && /선택/.test(d));
  T('각 항목의 내용을 열어 볼 수 있다', /openLegal\(/.test(d));
  // ★ 출항 판단 경고는 동의 화면에서도 보여야 한다. 약관 속에만 있으면 아무도 안 읽는다.
  T('출항 판단 경고를 동의 화면에 띄운다', /출항/.test(d) && /참고/.test(d));

  const a = grab(js, 'doAgree') || '';
  T('동의를 마치는 곳이 있다', a.length > 0);
  T('필수 셋이 다 켜져야 넘어간다',
    /agreeChk\.terms && agreeChk\.privacy && agreeChk\.age/.test(a));
  T('동의한 판을 기억한다', /LEGAL_VER/.test(a));
  T('동의한 때도 기억한다', /at:/.test(a) || /toISOString/.test(a));
  T('위치 동의 여부를 따로 기억한다', /loc/.test(a));

  const n = grab(js, 'needAgree') || '';
  T('다시 받아야 하는지 보는 곳이 있다', n.length > 0);
  // ★ 약관을 고쳤는데 옛 동의를 그대로 쓰면 동의가 아니다
  T('판이 올라가면 다시 받는다', /ver !== LEGAL_VER|ver != LEGAL_VER/.test(n));
}

// ── 7. ★ 로그인 앞을 실제로 막는가
{
  ['doGoogle','doEmail'].forEach(f=>{
    const g = grab(js, f) || '';
    T(f + ' 앞에 동의가 선다', /needAgree\(\)/.test(g) && /openAgree\(/.test(g));
    // '부르기만 하고 그냥 진행' 이면 막은 게 아니다
    T(f + ' 은 동의 전에 멈춘다', /if\(needAgree\(\)\)\{[\s\S]*?\n?\s*return;/.test(g));
  });
  // 동의를 마치면 하려던 일을 이어서 한다 — 처음부터 다시 시키면 사람이 떠난다
  const a = grab(js, 'doAgree') || '';
  T('동의 뒤 하려던 일을 이어서 한다', /agreeNext/.test(a));
}

// ── 8. 동의 기록을 클라우드에도 남긴다
{
  const p = grab(js, 'pushAgree') || '';
  T('동의 기록을 클라우드에 남기는 곳이 있다', p.length > 0);
  T('사람 명부에 함께 남긴다', /__people\.mark\(/.test(p));
  const m = mod.slice(mod.indexOf('window.__people'));
  T('명부가 덧붙는 값을 받는다', /async mark\(\s*\w+/.test(m));
  const mk = (m.match(/async mark\([\s\S]*?\n      \},/) || [''])[0];
  T('명부가 그 값을 실제로 적는다', /Object\.assign\(/.test(mk) && /extra/.test(mk));
  T('로그인하면 동의 기록을 올린다', /pushAgree\(/.test(js.replace(grab(js,'pushAgree')||'', '')));
}


// ── 외국어판 (3.91)
// ★ 외국어로 앱을 쓰는 사람에게 한국어 약관만 보여 주면, 약관규제법 제3조의
//   명시·설명 의무를 못 지킨 것이 되어 그 조항을 계약 내용으로 주장하지 못할 수 있다.
{
  T('영어판 세 문서가 만들어진다', !!(DOC_EN && DOC_EN.terms && DOC_EN.privacy && DOC_EN.location));
  T('러시아어판 세 문서가 만들어진다', !!(DOC_RU && DOC_RU.terms && DOC_RU.privacy && DOC_RU.location));
  // ★ 3.92 부터 이름도 그 말로 적는다. 한국어가 한 글자도 남으면 안 된다.
  const noHan = x => !/[가-힣]/.test(String(x || ''));
  T('영어판에 한국어가 한 글자도 없다',
    ['terms','privacy','location'].every(k => noHan(DOC_EN && DOC_EN[k])));
  T('러시아어판에 한국어가 한 글자도 없다',
    ['terms','privacy','location'].every(k => noHan(DOC_RU && DOC_RU[k])));
  // ★ 한국어가 정본이라고 못 박아 두어야 한다. 번역이 어긋나도 한국어를 따른다.
  const KO_WINS_EN = /Korean text is the authoritative version/;
  const KO_WINS_RU = /Оригиналом является корейский текст/;
  T('영어판 세 문서 모두 한국어가 정본이라고 적혀 있다',
    ['terms','privacy','location'].every(k => KO_WINS_EN.test(DOC_EN && DOC_EN[k])));
  T('러시아어판 세 문서 모두 한국어가 정본이라고 적혀 있다',
    ['terms','privacy','location'].every(k => KO_WINS_RU.test(DOC_RU && DOC_RU[k])));
  // 이름·연락처·판 번호는 한 곳에서 온다 — 판마다 어긋나면 안 된다
  const OWNER_MAIL_EN = ((js.match(/const LEGAL_OWNER = \{[\s\S]*?email:\s*'([^']+)'/) || [])[1]) || '';
  T('영어판에 로마자 이름과 연락처가 들어간다',
    !!OWNER_MAIL_EN && String(DOC_EN && DOC_EN.privacy).includes(OWNER_MAIL_EN)
    && /Kim Myung Joon/.test(DOC_EN && DOC_EN.privacy));
  T('러시아어판에 러시아어 이름이 들어간다', /Ким Мёнджун/.test(DOC_RU && DOC_RU.privacy));
  T('한국어판은 한국어 이름 그대로다', /김명준/.test(DOC && DOC.privacy));
  // ★ 이름은 사전에 안 넣는다 — 자동 번역이 사람 이름을 건드리면 안 된다
  T('이름을 사전이 아니라 LEGAL_OWNER 에서 가져온다',
    /LEGAL_OWNER\.names/.test(grab(js, 'legalText') || ''));
  // ★ 날짜를 글자로 박아 두면 약관을 고칠 때마다 검사가 깨진다.
  //   보아야 할 것은 '그 말의 날짜 표기를 썼는가' 이지 특정 날짜가 아니다.
// ★ 약관 글을 못 만들었으면 K 가 null 이다. 그대로 두면 여기서 터져
//   나머지 검사가 통째로 안 돈다. 빈 껍데기를 두고 실패로 내보낸다.
const KD = (K && K.LEGAL_DATES) || { ko:'(못 읽음)', en:'(못 읽음)', ru:'(못 읽음)' };

  T('영어판 시행일이 영어로 적힌다',
    !!(DOC_EN && DOC_EN.terms.indexOf(KD.en) > 0), KD.en);
  T('러시아어판 시행일이 러시아어로 적힌다',
    !!(DOC_RU && DOC_RU.terms.indexOf(KD.ru) > 0), KD.ru);
  T('한국어판 시행일은 한국어 표기다',
    !!(DOC && DOC.terms.indexOf(KD.ko) > 0), KD.ko);
  T('세 판의 날짜 표기가 서로 다르다',
    new Set([KD.ko, KD.en, KD.ru]).size === 3);

  // ── 위치정보 약관이 앱이 실제로 하는 일과 맞는가
  //
  // ★ 왜 이 검사가 있나
  //   약관에 「받은 값은 기기 안에만 저장하며 서버로 보내지 않습니다」 라고 적혀 있었다.
  //   그런데 posHere 로 잡은 GPS 좌표가 voyage 에 들어가고, voyage 는 SYNC_COLLS 에
  //   있어서 파이어스토어로 올라간다. 약관이 거짓말이었다.
  //   그리고 이 문장은 그냥 오타가 아니다 — 위치정보법의 신고 면제 두 갈래 중
  //   하나가 바로 「단말기에서만 쓰고 서버로 전송하지 않는 경우」 다.
  {
    const LOCS = { ko: DOC.location, en: DOC_EN.location, ru: DOC_RU.location };
    const NEVER = {
      ko: '기기 안에만 저장하며 서버로 보내지 않습니다',
      en: 'The value is stored on your device only and is not sent to the server',
      ru: 'Полученное значение хранится только на устройстве и на сервер не передаётся'
    };
    for(const v of ['ko','en','ru']){
      T(v + ' — 좌표가 서버로 안 간다는 통짜 주장이 없다',
        LOCS[v].indexOf(NEVER[v]) < 0);
    }
    // 항해 좌표가 서버에 저장된다는 사실이 적혀 있어야 한다
    T('ko — 항해 좌표가 서버에 저장된다고 적혀 있다', /항해 기록의 일부로 서버에 저장/.test(LOCS.ko));
    T('en — 같은 사실이 적혀 있다', /stored on the\s+server as part of that voyage record/.test(LOCS.en));
    T('ru — 같은 사실이 적혀 있다', /сохраняется\s+на сервере как часть этой записи/.test(LOCS.ru));

    // 위치정보관리책임자 — 신고 사업자의 의무다
    T('ko — 위치정보관리책임자가 적혀 있다', /위치정보관리책임자: /.test(LOCS.ko));
    T('en — 위치정보관리책임자가 적혀 있다', /Location information manager: /.test(LOCS.en));
    T('ru — 위치정보관리책임자가 적혀 있다', /Ответственный за данные о местоположении: /.test(LOCS.ru));
    T('책임자 옆에 연락처가 있다',
      ['ko','en','ru'].every(v => LOCS[v].indexOf(K.LEGAL_OWNER.email) > 0));

    // ★★★ 2026-09-04 — 위치기반서비스사업 **신고를 마쳤다.**
    //   방송미디어통신위원회 신고확인증 · 신고번호 12276 · 전자문서번호 E5D5-38DD-3CAE-F55B
    //   「위치정보의 보호 및 이용 등에 관한 법률」 제9조 제1항에 따른 신고다.
    //   ★ 신고번호는 **약관에 적어야 하는 것**이다. 세 말 모두에 나오는지 여기서 못 박는다.
    T('신고번호 자리가 마련돼 있다', 'LEGAL_LBS' in K);
    T('★★★ 신고번호가 채워져 있다 (2026-09-04 신고 완료)', K.LEGAL_LBS === '12276', K.LEGAL_LBS);
    for(const v of ['ko','en','ru']){
      T('★★★ ' + v + ' — 위치기반 약관에 신고번호 12276 이 나온다',
        LOCS[v].indexOf('12276') > 0, LOCS[v].slice(-160));
      T(v + ' — 빈 줄이 남지 않는다', !/\n\s*\n\s*\n/.test(LOCS[v]));
    }
  }

  // ── 신고번호를 채우면 세 말 모두에 나오는가 (채운 뒤에 검사가 없으면 그때 가서 샌다)
  {
    const NO = '제2026-00호';
    const parts2 = PARTS.replace(/const LEGAL_LBS = [^;]*;/, "const LEGAL_LBS = '" + NO + "';");
    const f2 = new Function('let L = "ko"; const langNow = () => L;\n' + parts2 + '\n' + DOCSRC + '\n'
      + (grab(js,'legalSet')||'') + '\n' + (grab(js,'legalText')||'')
      + '\n return (k, v) => { L = v; return legalText(k); };')();
    T('ko — 신고번호를 채우면 나온다', /위치기반서비스사업 신고번호: 제2026-00호/.test(f2('location','ko')));
    T('en — 신고번호를 채우면 영어로 나온다',
      /Location-based service business filing number: 제2026-00호/.test(f2('location','en')));
    T('ru — 신고번호를 채우면 러시아어로 나온다',
      /Номер уведомления о деятельности LBS: 제2026-00호/.test(f2('location','ru')));
    T('신고번호를 채워도 {자리표}가 남지 않는다',
      ['ko','en','ru'].every(v => !/\{LBS\}|\{BIZ\}/.test(f2('location', v))));
  }
  T('{자리표} 가 남아 있지 않다',
    !/\{(OWNER|EMAIL|DATE|VER|BIZ)\}/.test(String((DOC_EN&&DOC_EN.terms)||'') + String((DOC_RU&&DOC_RU.terms)||'')));
  T('말을 고르는 곳이 있다', !!grab(js, 'legalSet'));
  T('모르는 말이면 한국어로 돌아간다', /return LEGAL_DOCS;/.test(grab(js, 'legalSet') || ''));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
