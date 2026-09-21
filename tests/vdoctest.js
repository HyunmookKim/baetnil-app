// 서류 만료일 — 넘기면 배를 못 띄운다
//
// ★ 왜 이 검사가 있나 (4.52)
//   선박검사증서가 만료되면 배를 띄울 수 없다. 보험이 끊기면 사고 나고 안다.
//   조종면허 갱신을 놓치면 무면허가 된다. 조명탄·소화기는 유효기간이 지나면
//   안전장비가 아니다. 전부 「몇 년에 한 번」이라 사람이 반드시 잊는다.
//   일본은 정기검사가 6년, 중간검사가 3년째다 — 더 잊는다.
//   그래서 앱이 대신 기억해야 한다.
const fs = require('fs');
const SRC = process.argv[2] || 'work.html';
const src = fs.readFileSync(SRC, 'utf8');

function grab(name){
  let i = src.indexOf('function ' + name + '(');
  if(i < 0) i = src.indexOf('async function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(!d){ j++; break; } }
  }
  return src.slice(i, j);
}
const num = n => { const m = src.match(new RegExp('const ' + n + '\\s*=\\s*(-?[\\d.]+)')); return m ? Number(m[1]) : null; };

let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };

// ── ① 서류 종류가 있다
const KINDS = (src.match(/const VDOC_KINDS = \[[\s\S]*?\];/) || [''])[0];
T('★ 서류 종류 목록이 있다 (VDOC_KINDS)', KINDS.length > 0);
if(KINDS){
  T('★ 선박검사증서가 들어 있다', /선박검사/.test(KINDS), KINDS.slice(0,200));
  T('보험이 들어 있다', /보험/.test(KINDS));
  T('조종면허가 들어 있다', /면허/.test(KINDS));
  T('안전장비 유효기간도 챙긴다 (조명탄·소화기)', /안전장비|조명탄|소화기/.test(KINDS));
}

const BEF = num('VDOC_BEFORE');
T('★ 며칠 전부터 알릴지 기본값이 있다 (VDOC_BEFORE)', BEF !== null && BEF >= 30, BEF);
T('★ 기본값이 넉넉하다 — 선박검사는 며칠 만에 못 받는다 (60일 이상)', BEF >= 60, BEF);

// ── ② 판정
const DUE = grab('vdocDue');
T('★ 만료일을 판정하는 곳이 있다 (vdocDue)', !!DUE);
if(DUE && BEF){
  const F = new Function('D', 'NOW', `
    const VDOC_BEFORE = ${BEF};
    const fmtDate = d => { const p=n=>String(n).padStart(2,'0');
      return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
    ${DUE}
    return vdocDue(D, NOW);
  `);
  const now = new Date('2026-08-28T09:00:00');
  const at = n => { const d = new Date(now); d.setDate(d.getDate() + n); 
    const p=x=>String(x).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };

  T('만료일이 없으면 아무 말도 안 한다', F({}, now).k === 'none', F({}, now));
  T('엉뚱한 글자는 만료일로 안 본다', F({expiry:'언젠가'}, now).k === 'none', F({expiry:'언젠가'}, now));
  T('★ 한참 남은 것은 조용하다', F({expiry:at(400)}, now).k === 'ok', F({expiry:at(400)}, now));
  T('★★ 곧 만료면 알려 준다', F({expiry:at(30)}, now).k === 'soon', F({expiry:at(30)}, now));
  T('★★ 지났으면 지났다고 한다', F({expiry:at(-3)}, now).k === 'late', F({expiry:at(-3)}, now));
  T('오늘이 만료일이면 아직 지난 것은 아니다', F({expiry:at(0)}, now).k === 'soon', F({expiry:at(0)}, now));
  T('★ 며칠 남았는지 센다', F({expiry:at(30)}, now).days === 30, F({expiry:at(30)}, now));
  T('★ 지난 날은 음수로 센다', F({expiry:at(-3)}, now).days === -3, F({expiry:at(-3)}, now));
  // 서류마다 따로 정할 수 있어야 한다 — 검사증은 90일, 소화기는 30일이면 된다
  T('★★ 서류마다 며칠 전부터 알릴지 따로 정할 수 있다',
    F({expiry:at(20), before:10}, now).k === 'ok' && F({expiry:at(5), before:10}, now).k === 'soon',
    [F({expiry:at(20), before:10}, now), F({expiry:at(5), before:10}, now)]);
}

// ── ③ 오늘 화면에 나올 것 고르기
const SOON = grab('vdocSoon');
T('★ 곧 만료되는 서류를 골라내는 곳이 있다 (vdocSoon)', !!SOON);
if(SOON && DUE && BEF){
  const F2 = new Function('LIST', 'NOW', `
    const VDOC_BEFORE = ${BEF};
    const fmtDate = d => { const p=n=>String(n).padStart(2,'0');
      return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
    ${DUE}
    ${SOON}
    return vdocSoon(LIST, NOW);
  `);
  const now = new Date('2026-08-28T09:00:00');
  const at = n => { const d = new Date(now); d.setDate(d.getDate() + n);
    const p=x=>String(x).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
  const list = [
    { id:'a', title:'선박검사증서', expiry: at(-10) },
    { id:'b', title:'보험',        expiry: at(20) },
    { id:'c', title:'면허',        expiry: at(900) },
    { id:'d', title:'그냥 사진',   },
  ];
  const r = F2(list, now);
  T('★★ 지난 것과 곧 만료될 것만 고른다', r.length === 2, r.map(x=>x.id));
  T('★ 지난 것이 먼저 온다', r[0] && r[0].id === 'a', r.map(x=>x.id));
  T('만료일이 없는 것은 안 낀다', !r.some(x=>x.id==='d'), r.map(x=>x.id));
  T('★ 판정을 같이 들려 준다', !!(r[0] && r[0].due && r[0].due.k === 'late'), r[0]);
}

// ── ④ 알람 — 정비와 같은 길로 나간다
const PLAN = grab('vdocAlarmPlan');
T('★ 서류 알람을 짜는 곳이 있다 (vdocAlarmPlan)', !!PLAN);
T('★★ 서류 알람이 실제로 걸리는 길에 들어가 있다 (maintAlarmSync)',
  /vdocAlarmPlan\s*\(/.test(grab('maintAlarmSync') || ''), (grab('maintAlarmSync')||'').slice(0,300));

// ── ⑤ 화면
T('★ 문서 자세히보기에 만료일 칸이 있다', /mrField\('expiry'/.test(src));
T('★ 문서 자세히보기에 서류 종류 칸이 있다', /mrField\('dkind'/.test(src));
T('★★ 오늘 화면에 「곧 만료되는 서류」 카드가 있다', /곧 만료되는 서류/.test(src));
T('★ 문서 목록에서도 남은 날이 보인다', /vdocDue\(/.test(src.slice(src.indexOf('function renderContacts'))));

// ── ⑥ 옛 자료가 안 깨진다
T('★ 만료일 없는 옛 문서도 그대로 열린다 (필수 칸이 아니다)',
  !/expiry.*required|필수/.test((grab('addVdoc')||'')), grab('addVdoc'));

// ── ⑦ 문서는 「찍어서 올리는 것」이다 (4.67, 사장님 지적)
//   보험증서·선박검사증·면허는 종이를 사진으로 남기는 것이지 글로 적는 것이 아니다.
//   그런데 「+ 추가」 를 누르면 빈 기록을 만들고 제목 칸부터 들이밀고 있었다.
{
  const AV = grab('addVdoc') || '';
  T('★★ 문서를 더하면 사진기가 바로 열린다', /getElementById\('mrCam'\)[\s\S]{0,40}\.click\(\)/.test(AV), AV.slice(0,400));
  // 사람이 누른 그 순간 안에서 열어야 폰이 안 막는다. 늦추면 조용히 아무 일도 안 일어난다.
  T('★★ 한 박자 늦추지 않는다 (setTimeout·rAF 뒤로 미루면 폰이 막는다)',
    !/(setTimeout|requestAnimationFrame)[\s\S]{0,80}mrCam/.test(AV), AV.slice(0,400));
  // 연락처는 사진이 아니다 — 거기까지 사진기를 띄우면 안 된다.
  T('★ 연락처를 더할 때는 사진기가 안 열린다', !/mrCam/.test(grab('addContact') || ''));
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
