// ══════════════════════════════════════════════════════════════════════
// 5.0 — 사람에게 붙는 것은 계정마다 따로 담는다
//
//   4.137 에서 「한 기기를 둘이 쓰면 앞사람 이름이 내 이름이 되던」 것을 고쳤는데,
//   그때는 **이름 한 칸만** 고쳤다. 뿌리는 그대로였다 —
//   숨긴 사람 · 숨긴 배 · 추천 · 약관 동의 · 첫걸음 · 위치 기록 이 전부
//   기기 한 칸에 담겨 있었다. 특히 **약관 동의**는 동의한 적 없는 사람을
//   동의한 것으로 만든다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c) => { if (c) { ok++; console.log('통과: ' + n); }
                      else { bad++; console.log('★ 실패: ' + n); } };
const grab = (s, fn) => { const i = s.indexOf('function ' + fn + '('); return i < 0 ? '' : s.slice(i, i + 2000); };

T('문이 있다 — pKey', /function pKey\(k\)\{/.test(src));
T('읽는 문 · 쓰는 문 · 지우는 문', /function pGet\(k\)\{/.test(src) && /function pSet\(k, v\)\{/.test(src) && /function pDel\(k\)\{/.test(src));
T('로그인했으면 계정 uid 를 뒤에 붙인다', /return u \? \(k \+ '_' \+ u\) : k;/.test(src));

// ── 옮기기: 옛 기기 칸을 이 계정으로 옮기고 **옛 칸은 지운다**
const mg = grab(src, 'pMigrate');
T('옮기는 문이 있다', mg.length > 0);
T('옛 칸을 이 계정 칸으로 옮긴다', /setItem\(k \+ '_' \+ u, 옛\)/.test(mg));
T('★★★ 옮긴 뒤 옛 칸을 지운다 (안 지우면 다음 사람이 물려받는다)',
  /localStorage\.removeItem\(k\)/.test(mg));
T('이미 이 계정 칸이 있으면 덮지 않는다', /localStorage\.getItem\(k \+ '_' \+ u\) == null/.test(mg));

// ── 나갈 때 치우기
const wp = grab(src, 'pWipeDevice');
T('나갈 때 치우는 문이 있다', wp.length > 0);
T('알림 표(bt_pushtok)도 같이 지운다', /bt_pushtok/.test(wp));

// ── 어디서 부르나
T('로그인하면 다른 것을 읽기 전에 옮긴다',
  /me = u;\n\s*\/\/[^\n]*\n\s*try\{ if\(u\) pMigrate\(\); \}catch\(_\)\{\}/.test(src));
T('로그아웃하면 치운다', /try\{ pWipeDevice\(\); \}catch\(_\)\{\}/.test(src));

// ── 사람에게 붙는 칸이 전부 그 문을 지나는가
const MUST = ['bt_likes','bt_hidden','bt_hideby','bt_hidenm','bt_agree','bt_loclog',
              'bt_start','bt_cvdone','bt_startmark','bt_startend','bt_crewmark',
              'bt_cvoff','bt_market_ok','bt_talkreg'];
MUST.forEach(k => {
  const 옛 = new RegExp("localStorage\\.(get|set|remove)Item\\(\\s*'" + k + "'").test(src);
  const 새 = new RegExp("p(Get|Set|Del)\\('" + k + "'").test(src);
  T("'" + k + "' 이 계정 문을 지난다", 새 && !옛);
});
T('목록에도 다 들어 있다',
  MUST.every(k => new RegExp("'" + k + "'").test((src.match(/const PERSONAL_KEYS = \[[\s\S]*?\];/) || [''])[0])));

// ── 배 자료를 담는 칸은 건드리면 안 된다 (아직 못 올린 배가 날아간다)
T('★ 아직 못 올린 배 표(bt_boatdirty)는 안 지운다',
  !/PERSONAL_KEYS[\s\S]{0,400}bt_boatdirty/.test(src));
T('★ 넣어 둔 배(bt_stash)도 안 지운다',
  !/PERSONAL_KEYS[\s\S]{0,400}bt_stash/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
