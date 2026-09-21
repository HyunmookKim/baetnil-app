// ══════════════════════════════════════════════════════════════════════
// 5.5 — 「그만 보기」 한 권유 카드가 켤 때마다 잠깐 떴다 사라지지 않는가
//
//   ★ 사장님 지적 (2026-09-20)
//     「어플 처음 키거나 웹에서 새로고침 하면 이거 두 개 옛날에 안 나오게 했는데
//      잠깐 떴다가 사라지는데 존나 거슬린다」
//
//   ★ 까닭 — 개인 칸은 pKey() 가 계정 번호를 붙여 담는다(bt_start_<uid>).
//     켤 때 파이어베이스가 「누구인지」를 알려 주기까지 1~2초 걸리고,
//     그 사이 pGet('bt_start') 는 접미사 없는 칸을 읽어 null 을 본다.
//     그래서 카드를 한 번 그렸다가 계정이 정해지면 지운다 — 그것이 깜빡임이다.
//
//   ★ 고침 — 누구인지 정해지기 전에는 **아예 안 그린다**.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SRC = process.argv[2] || '../../work.html';
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };
const grab = (fn) => {
  const i = src.indexOf('function ' + fn + '(');
  if(i < 0) return '';
  let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); }
  }
  return '';
};

T('누구인지 정해졌는가를 묻는 문이 있다 (authReady)', !!grab('authReady'));
T('정해진 순간을 한 번만 잡는 문이 있다 (authSeenNow)', !!grab('authSeenNow'));
T('파이어베이스가 안 떠도 끝내 그린다 (5초 안전장치)',
  /authSeenNow\(\)\)\{[^}]*renderCurrent/.test(src.replace(/\s+/g,'')) || /setTimeout\(\(\)=>\{ if\(authSeenNow\(\)\)/.test(src));

['startCard','crewCard','cvOfferCard'].forEach(fn => {
  const b = grab(fn);
  T(`★★★ ${fn} 은 정해지기 전에 안 그린다`, /if\(!authReady\(\)\) return '';/.test(b), b.slice(0,120));
});

// __onAuth 가 정해진 것을 표시하는가
{
  const i = src.indexOf('window.__onAuth = async u => {');
  let d = 0, body = '';
  if(i >= 0){
    for(let k = src.indexOf('{', i); k < src.length; k++){
      if(src[k] === '{') d++;
      else if(src[k] === '}'){ d--; if(!d){ body = src.slice(i, k + 1); break; } }
    }
  }
  T('★★★ 인증이 정해지면 그 사실을 표시한다', /authSeenNow\(\)/.test(body));
  T('★★★ 로그인 안 한 것이 정해졌을 때도 화면을 다시 그린다',
    /방금정해짐\)\{ try\{ renderCurrent/.test(body.replace(/\s+/g,' ')) || /if\(방금정해짐\)/.test(body));
}

// 진짜로 돌려 본다 — 정해지기 전 / 정해진 뒤
{
  const body = [
    'let authSeen=false;',
    grab('authReady'), grab('authSeenNow'),
    'let me=null;',
    "const PERSONAL=['bt_start'];",
    'function pKey(k){ const u=(me&&me.uid)?String(me.uid):\"\"; return u?(k+\"_\"+u):k; }',
    'const LS={}; function pGet(k){ return LS[pKey(k)]==null?null:LS[pKey(k)]; }',
    'function esc(x){return String(x);} function t(x){return x;} function tsub(x){return x;}',
    'function startState(){ return { 배:true, n:3, 자리:true, 점검:false, 정비:true,' +
      ' 정기N:9, 점검N:8, 점검한N:0, 정비N:1, 항구:"여수" }; }',
    'function introSide(){ return "own"; }',
    grab('startCard'),
    'return { LS, setMe(v){me=v;}, seen:()=>authSeen, now:authSeenNow, startCard };'
  ].join('\n');
  let api = null, err = '';
  try { api = new Function(body)(); } catch(e){ err = e.message; }
  T('돌려 볼 수 있다' + (err ? ' — ' + err : ''), !!api);
  if(api){
    // 「그만 보기」 를 누른 계정 U1
    api.LS['bt_start_U1'] = 'hide';

    // ① 아직 누구인지 모른다 — 그리면 안 된다
    T('★★★ 누구인지 모르는 동안에는 안 그린다 (여기서 깜빡임이 났다)',
      api.startCard() === '', api.startCard().slice(0,80));

    // ② 정해졌다 — 그 계정은 껐으므로 여전히 안 나온다
    api.now(); api.setMe({ uid:'U1' });
    T('★★★ 정해진 뒤, 껐던 계정에는 끝내 안 나온다', api.startCard() === '');

    // ③ 안 끈 계정에는 나온다
    api.setMe({ uid:'U2' });
    T('★ 안 끄신 분께는 제대로 나온다', api.startCard().indexOf('첫걸음') >= 0);
  }
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
