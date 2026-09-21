// ══════════════════════════════════════════════════════════════════════
// 5.0 — 사장님이 쓰시면서 짚어 주신 것들
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok = 0, bad = 0;
const T = (n, c) => { if (c) { ok++; console.log('통과: ' + n); }
                      else { bad++; console.log('★ 실패: ' + n); } };
const grab = (s, fn) => { const i = s.indexOf('function ' + fn + '('); return i < 0 ? '' : s.slice(i, i + 3000); };

// ── 정박지 「내용 채우기」 가 지도부터 나오던 것
//   「야 내용 채우기 하면 뭐 지도 이것만 뜨냐?」
T('자리를 이미 아는 곳이면 위치 찍기를 건너뛴다',
  /const 자리있음 = !!\(s && s\.lat != null && s\.lon != null\);/.test(grab(src, 'writeSpot')));
T('건너뛴 뒤 내용 화면으로 간다',
  /if\(!canMoveSpot\(s\) \|\| 자리있음\) spotForm\(\);/.test(grab(src, 'writeSpot')));
T('자리를 모르는 새 자리만 지도부터',
  /else spotPickPlace\(\);/.test(grab(src, 'writeSpot')));
T('내용 화면에 「← 위치」 로 돌아갈 길이 남아 있다',
  /onclick="spotPickPlace\(\)"/.test(src));

// ── 관 자료 정박지에도 다녀온 이야기
//   「내용 적기가 뭐 이곳에 대한 리뷰나 소감 쓰는 것도 포함이냐?」
T('관 자료여도 댓글을 막지 않는다',
  !/if\(s\.seed\)\{ tell\(t\('아직 아무도 채우지 않은 자리/.test(src));
T('관 자료여도 댓글 칸을 그린다', !/\$\{s\.seed \? '' : spotCmtHtml\(s\)\}/.test(src));
T('관 자료여도 댓글을 받아 온다',
  /if\(!spotCmts\[String\(id\)\]\) await loadSpotCmts\(id\);/.test(src));

// ── 없는 「항상 허용」 을 시키지 않는다 (ACCESS_BACKGROUND_LOCATION 이 없다)
T('안드로이드 안내에서 「항상 허용」 을 뺐다',
  !/권한 › 위치 에 「항상 허용」/.test(src));
T('아이폰 안내의 「항상」 은 그대로 (아이폰에는 실제로 있다)',
  /설정 › 뱃일 › 위치 → 「항상」/.test(src));

// ── 알림이 꺼져 있으면 나가기 전에 말한다
T('알림 허락 결과를 받아 둔다', /const 알림 = await trkAskNoti\(\);/.test(src));
T('거절이면 나가기 전에 말한다', /if\(알림 === 'denied' && !trkIsIOS\(\)\)\{/.test(src));

// ── Open-Meteo 출처 (CC BY 4.0 면허 조건 — 지우면 안 된다)
T('날씨 화면에 Open-Meteo 출처가 있다', /Open-Meteo\.com<\/a> \(CC BY 4\.0\)/.test(src));
T('출처가 링크로 걸려 있다', /href="https:\/\/open-meteo\.com\/"/.test(src));

// ── 말
T('첫 화면은 「배 타는 사람들」', /배 타는 사람들과 나누는 앱입니다/.test(src));
T('「배 하는 사람들」 은 어디에도 없다', !/배 하는 사람들/.test(src));

// ── ★★★ 「모으다」 — 다시 기어들면 여기서 잡는다
//   사장님: 「어떤 한국 사람이 도대체 그런 말을 쓰냐. 어느 누구도 이런 상황에서
//           모으다라는 단어를 안 써」
//   앱이 이미 쓰던 말로 바꿨다 — 정박지는 「올리다」(단추 이름이 「정박지 올리기」),
//   소식은 「수집」(「마지막 수집」·「특보 수집 대기 중」·「아직 수집된 뉴스가 없습니다」).
{
  const 사전열쇠 = [];
  const re = /^    '((?:[^'\\]|\\.)*)'\s*:\s*'/gm;
  let m;
  while ((m = re.exec(src))) 사전열쇠.push(m[1]);
  const 걸린것 = 사전열쇠.filter(k => /모[으아은읍인임일였여을]/.test(k));
  T('화면 말에 「모으다」 계열이 하나도 없다 — ' + 걸린것.length + '곳',
    걸린것.length === 0);
  if (걸린것.length) 걸린것.slice(0, 6).forEach(k => console.log('    ↳ ' + k.slice(0, 80)));
}
T('정박지 한 줄은 「직접 올립니다」',
  /정박지 수심·요금·연락처를 다녀온 사람들이 직접 올립니다/.test(src));
T('소식 빈 화면은 「수집된」', /아직 수집된 소식이 없습니다\./.test(src));
T('소식 안내는 「이 언어로」', /이 언어로 소식을 내는 곳이 아직 적습니다\./.test(src));

// ── ★ 「말」 을 **언어**라는 뜻으로 쓰지 않는다 (사장님 지적: 「이 말로 되니 무슨 뜻이냐?」)
//   앱은 이미 다른 데서 전부 「언어」 를 쓰고 있었다 — 「언어 · Language」·「나중에 언어를 바꾸셔도…」.
//   이 한 줄만 「말」 로 남아 있어서 무슨 뜻인지 안 읽혔다.
//   ※ 「말씀」·「말머리」·「도움말」·「말 그대로」·「단말기」·「정말」·낱말이라는 뜻의 「말」 은 놔둔다.
{
  const cand = new Set();
  let m;
  const r1 = /t(?:sub)?\('((?:[^'\\]|\\.)*)'/g;
  while ((m = r1.exec(src))) cand.add(m[1]);
  const r2 = /data-t="([^"]*)"/g;
  while ((m = r2.exec(src))) cand.add(m[1]);
  const r3 = /^    '((?:[^'\\]|\\.)*)'\s*:\s*'/gm;
  while ((m = r3.exec(src))) cand.add(m[1]);
  const bad = /(이|내|그|제|우리|네 나라|다른|같은|어느|무슨)\s*말(?![씀머]|\s*그대로|기)|말\s*(고르기|바꾸기|고름|선택)/;
  const 걸린것 = [...cand].filter(k => bad.test(k) && !/같은 말은 올릴 수 없습니다/.test(k));
  T('「말」 을 언어라는 뜻으로 쓴 곳이 없다 — ' + 걸린것.length + '곳', 걸린것.length === 0);
  걸린것.slice(0, 5).forEach(k => console.log('    ↳ ' + k.slice(0, 80)));
}
T('언어 고르기는 「언어」 라고 부른다', /'언어 · Language'/.test(src));

['정박지 수심·요금·연락처를 다녀온 사람들이 직접 올립니다',
 '아직 수집된 소식이 없습니다.',
 '아직 수집된 소식이 없어 고를 분야가 없습니다.'].forEach(w => {
  const n = (src.match(new RegExp("'" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':'", 'g')) || []).length;
  T("'" + w.slice(0, 26) + "…' 이 세 나라말에 다 있다 — " + n, n === 3);
});

// ── 새로 들어간 말은 네 나라 것이 다 있어야 한다
['날씨·해상 예보 자료'].forEach(w => {
  const n = (src.match(new RegExp("'" + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + "':'", 'g')) || []).length;
  T("'" + w + "' 이 세 나라말에 다 있다 — " + n, n === 3);
});

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
