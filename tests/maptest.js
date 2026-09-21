// 항해일지 지도 검사 — 지도는 하나, 항적 선에 꽂기, 깃발
// 사람이 보는 것과 실제로 도는 길만 본다.
const fs = require('fs');
const SRC = process.argv[2] || 'work.html';
const h = fs.readFileSync(SRC, 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : (fail++, console.log('★ 실패:', n)); };
const has = re => re.test(h);
// ★ 함수 하나만 떼어 낸다. `[\s\S]*?` 로 훑으면 함수 밖까지 잡아 헛통과·헛실패가 난다.
//   실제로 이 검사에서 두 개가 헛걸렸다.
function fn(name){
  const i = h.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, started = false;
  for(let j = i; j < h.length; j++){
    const c = h[j];
    if(c === '{'){ d++; started = true; }
    else if(c === '}'){ d--; if(started && d === 0) return h.slice(i, j + 1); }
  }
  return h.slice(i);
}

// ── 1. 지도는 하나뿐이다 (이것이 이 판의 핵심)
t('지도를 하나 더 만들던 자리가 없다 (pickWrap)', !/id="pickWrap"/.test(h) && !/getElementById\('pickWrap'\)/.test(h));
t('지도를 하나 더 만들던 자리가 없다 (pickMap)', !/mapBox\('pickMap'/.test(h) && !/mapInit\('pickMap'/.test(h));
t('mapBox 를 부르는 곳마다 id 가 다르다', (()=>{
  const ids = [...h.matchAll(/mapBox\('([^']+)'/g)].map(m=>m[1]);
  return ids.length === new Set(ids).size;
})());
t('위치 고르기가 이미 있는 지도를 쓴다', /mapS\.mode = 'pick'/.test(fn('posPick')));
t('위치 고르기가 새 지도를 안 만든다', !/mapInit\(/.test(fn('posPick')));
t('고르기를 그만두면 보기 모드로 돌아간다', /mapS\.mode = 'view'/.test(fn('posPickCancel')));

// ── 2. 지도는 늘 그려진다 (점이 없어도) — 없으면 「지도에서」를 눌러도 그릴 자리가 없다
// ★ 「점이 있을 때만 켠다」로 되돌리면 「지도에서」를 눌러도 그릴 자리가 없어진다.
//   openMR 안에서 mapInit 을 부르는 줄이 무엇에 걸려 있는지를 본다.
t('점이 없어도 지도를 켠다', (()=>{
  const f = fn('openMR'); if(!f) return false;
  const i = f.indexOf("mapInit('trkMap'"); if(i < 0) return false;
  const before = f.slice(Math.max(0, i - 200), i);
  // 바로 앞줄에 pts.length 같은 조건이 붙어 있으면 안 된다
  return !/pts\.length\s*(&&|\?)/.test(before) && !/if\s*\(\s*pts\.length\s*\)/.test(before);
})());
t('지도가 항해일지 화면에 늘 들어간다', /mapBox\('trkMap','44vh'\)/.test(h)
  && !/trkPoints\(it\)\.length[\s\S]{0,80}\?\s*`<div class="mrrow"><span class="mrlbl">\$\{esc\(t\('항적'\)\)\}[\s\S]{0,200}mapBox\('trkMap'/.test(h));

// ── 3. 항적 선을 눌러 기록을 꽂는다
t('선 위 한 점을 찾는 문이 있다', /function trkNearOnLine\(/.test(h));
t('손가락 굵기를 재서 너무 먼 곳은 안 잡는다', /TRK_TAP/.test(h) && /best\.d > TRK_TAP/.test(fn('trkNearOnLine')));
t('두 점이 같은 자리여도 안 터진다', /len2 > 0 \? .*: 0/.test(fn('trkNearOnLine')));
t('시각을 두 점 사이 비율로 잡는다', /ta \+ \(tb - ta\) \* u/.test(fn('trkNearOnLine')));
t('꽂으면 좌표와 시각이 함께 들어간다', (()=>{ const f = fn('logAddAt');
  return !!f && /pos:\{ lat:hit\.lat, lon:hit\.lon/.test(f) && /time: hit\.time/.test(f); })());
t('꽂을 때 GPS 를 다시 안 부른다', !/posHere\(/.test(fn('logAddAt')));
t('보기 모드에서만 선을 눌러 꽂는다', /mapS\.mode === 'view' && mapS\.vid/.test(h));
t('고르는 중에는 선을 눌러도 안 꽂힌다',
  /if\(mapS\.mode === 'pick'\)\{[\s\S]{0,240}?return;\s*\}/.test(h));

// ── 4. 깃발과 목록이 서로 따라간다
t('중간 기록은 깃발로 그린다', /class="mflag/.test(h) && /mapFlagTap\(/.test(h));
t('출발·도착은 깃발이 아니다', /indexOf\('log:'\) === 0/.test(h));
t('깃발을 누르면 목록으로 데려간다', /logFocus\(/.test(fn('mapFlagTap')));
t('목록에서 지도로 가는 단추가 있다', /logShowOnMap\('\$\{g\.id\}'\)/.test(h));
t('위치가 없는 기록에는 그 단추가 없다', /hasPos \? `<div class="posrow"/.test(h));
t('목록 줄에 찾아갈 id 가 있다', /id="log-\$\{g\.id\}"/.test(h));
// ★ 5.00 — 깃발·핀·이름표를 한 가지 표시(data-tap)로 모았다.
//   4.99 까지는 핀마다 onclick 을 매달았는데, 손가락을 붙잡아 두는 동안 브라우저가
//   click 을 지도에 보내는 바람에 그 onclick 이 한 번도 안 불렸다.
t('깃발·핀을 눌렀을 때 지도가 안 움직인다 (탭이 새 기록을 만들지 않는다)',
  /closest\('\[data-tap\]'\)/.test(h) && /맞은것 && 맞은것\.key/.test(h));

// ── 5. 배 위에서 누르는 크기 (사장님 원칙: 38×34 아래로 안 내려간다)
t('지도 확대·축소 단추가 44×44', /\.mzoom button\{width:44px;height:44px/.test(h));
// ★★★ 4.104 — 「저장」이 확대(+) 단추 밑에 깔려서 안 눌리던 것 (사장님 지적)
//   여태는 취소·저장이 .mapbar(위쪽 전체) 안에 있었는데, 오른쪽 위는 .mzoom 자리다.
//   z-index 도 .mzoom 이 높아(6 > 5) 「저장」 위에 「+」 가 얹혀 있었다.
//   구글·카카오·네이버가 「이 위치로」 를 아래에 두는 그 자리로 내렸다.
t('★★★ 누르는 단추는 아래에 있다 (.mapbtm) — 위 오른쪽은 확대 단추 자리다',
  /\.mapbtm\{position:absolute;left:8px;right:60px;bottom:8px/.test(h));
t('★★ 아래 단추가 48px 이상 (장갑 낀 손)', /\.mapbtm button\{[^}]*min-height:48px/.test(h));
t('★★ 위 안내 줄은 글자만 — 손가락을 안 먹는다', /\.mapbar\{[^}]*pointer-events:none/.test(h));
t('★★ 위 안내 줄도 오른쪽 60px 을 비운다', /\.mapbar\{[^}]*padding:8px 60px 8px 8px/.test(h));
t('★★ 단추가 떠 있을 때 출처 표기를 안 가린다', /\.mapbox\.picking \.mattr\{bottom:66px\}/.test(h));

// ── 6. 말 (세 나라 말 다 있어야 한다)
['어디인지 지도를 눌러 주세요','지도에서 항적 선을 누르면 그 자리에 기록이 하나 생깁니다',
 '지도에서 보기','이 기록에는 위치가 없습니다.'].forEach(k=>{
  const en = new RegExp("'" + k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + "':'[^']+'", 'g');
  t('세 나라 말 — ' + k.slice(0,18), (h.match(en)||[]).length >= 2);
});
t('LANG_TOTAL 이 2002 이상', (()=>{const m=h.match(/LANG_TOTAL = (\d+)/); return m && +m[1] >= 2002;})());

// ── 7. 이름이 겹치지 않는다 (단일 파일이라 뒤엣것이 앞엣것을 죽인다)
['trkNearOnLine','logAddAt','mapFlagTap','mapHot','logFocus','logShowOnMap','mapBar'].forEach(n=>{
  t('이름이 하나뿐 — ' + n, (h.match(new RegExp('function ' + n + '\\(', 'g'))||[]).length === 1);
});

// ── 8. 판 번호
t('APP_VER 와 CACHE 가 같다',
  h.match(/APP_VER *= *'([^']*)'/)[1] === sw.match(/CACHE *= *'baetnil-([^']*)'/)[1]);

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail ? 1 : 0);
