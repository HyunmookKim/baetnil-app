// 사전은 앱 안에 있다 — 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
// 3.25 — 자료를 우리 저장소에서 받고, 해상 특보를 배 해역으로 고른다
//
// 옮긴 내력
//  · 뉴스·특보·물때를 옛 앱(first45) 저장소에서 받아왔다.
//    앱과 자료가 갈라져 있어 옛 앱을 지우면 이 앱이 함께 죽는 구조였다.
//    이제 앱 저장소가 스스로 모으고, 앱은 제가 놓인 자리에서 받아온다.
//
//  · ★ 해상 특보를 수집기가 '남해서부' 로 미리 걸러 담았다.
//    부산·인천·제주에 배를 댄 사람에게는 언제나 '특보 없음' 이었다 — 조용한 거짓말이다.
//    이제 전 구역을 담고, 어느 해역이 내 해역인지는 앱이 배 위치로 고른다.
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

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 자료를 우리 저장소에서 받는다
{
  // ★ 옛 저장소 이름이 코드에 남아 있으면, 그것을 지우는 날 앱이 조용히 죽는다
  // 'first45' 는 붙박이 배 모델 이름이기도 하다(베네토 퍼스트 45f5).
  // 문제는 그 이름이 '자료를 받아오는 주소' 로 남아 있는 것이다.
  T('옛 저장소에서 자료를 받아오지 않는다',
    !/first45[^\s'"]*\/|github\.io\/first45|first45.*\.json/.test(js));
  // ★ 4.19 에서 이 자리가 길어졌다 — 앱(캐퍼시터)일 때를 갈라내느라.
  //   창을 400자로 두었더니 통째로 못 잡아 검사가 헛돌았다. 창만 넓힌다.
  //   앱일 때 어디서 받는지는 apptest.js 가 따로 본다.
  //   마지막 대비 주소는 DATA_SITE 라는 이름으로 바로 위에 뽑아 뒀다 — 거기서부터 잡는다.
  const m = (js.match(/const DATA_SITE = [\s\S]{0,1600}?\}\)\(\);/) || [''])[0];
  T('자료 자리를 정하는 곳이 있다', m.length > 0);
  T('앱이 놓인 자리를 따라간다', /location\.href|location\.pathname/.test(m));
  T('저장소 이름이 바뀌어도 따라간다', /new URL\(/.test(m));
  T('그래도 마지막 대비는 있다', /baetnil/.test(m));
  ['kr.json','news.json','tide.json'].forEach(f=>
    T(f + ' 을 그 자리에서 받는다', new RegExp("DATA_BASE\\s*\\+\\s*'" + f.replace('.','\\.')).test(js)));
}

// ── 2. ★ 해상 특보를 배 해역으로 고른다
{
  const z = (js.match(/const SEA_ZONE = \{[\s\S]*?\};/) || [''])[0];
  T('해역 짝 목록이 있다', z.length > 0);
  // 배 지역 이름은 REGION_POINTS 가 정한다. 하나라도 빠지면 그 지역은 늘 '특보 없음' 이 된다.
  const regs = [...new Set([...(js.match(/const REGION_POINTS = \[[\s\S]*?\];/) || [''])[0]
    .matchAll(/r:'([^']+)'/g)].map(m=>m[1]))];
  T('배 지역을 다 안다 — ' + regs.join(','),
    regs.length > 0 && regs.every(r => z.includes("'" + r + "'")));

  const f = grab(js, 'myWarnings') || '';
  T('내 해역 특보를 고르는 곳이 있다', f.length > 0);
  T('배 위치로 고른다', /boatRegion\(/.test(f));
  T('구역 목록을 본다', /zones/.test(f));
  // ★ 옛 자료(zones 없음)로도 앱이 멎으면 안 된다 — 수집기가 아직 안 돌았을 수 있다
  T('옛 모양 자료도 받아 준다', /Array\.isArray\(/.test(f));

  let out = null, err = '';
  if(f){
    try{
      const sz = z, wl = grab(js, 'warnLines') || '';
      const mk = region => {
        const fn = new Function('krCache','boatRegion',
          sz + '\n' + wl + '\n' + f + '\n return myWarnings;')(
          { updated:'x', wx: { src:'KMA', zones: [
              { kind:'풍랑주의보', reg:'남해서부앞바다' },
              { kind:'풍랑주의보', reg:'남해서부먼바다' },
              { kind:'풍랑경보',   reg:'서해중부앞바다' },
              { kind:'강풍주의보', reg:'동해중부먼바다' }
            ] } },
          () => region);
        return fn();
      };
      out = { 전남: mk('전남'), 경기: mk('경기·인천'), 경북: mk('경북'), 없음: mk('') };
    }catch(e){ err = e.message; }
  }
  T('특보 고르기를 실제로 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('전남 배에는 남해서부가 보인다 — ' + JSON.stringify(out.전남.active),
      out.전남.active.length === 1 && /남해서부앞바다/.test(out.전남.active[0]) && /남해서부먼바다/.test(out.전남.active[0]));
    // ★ 같은 종류는 한 줄로 묶어야 읽힌다. 구역마다 한 줄이면 화면이 넘친다.
    T('같은 종류는 한 줄로 묶는다', out.전남.active.length === 1);
    T('경기·인천 배에는 서해중부가 보인다 — ' + JSON.stringify(out.경기.active),
      out.경기.active.length === 1 && /서해중부/.test(out.경기.active[0]));
    T('경북 배에는 동해중부가 보인다 — ' + JSON.stringify(out.경북.active),
      out.경북.active.length === 1 && /동해중부/.test(out.경북.active[0]));
    // ★ 남의 해역 특보를 내 특보인 양 띄우면 안 나가도 될 날 안 나간다
    T('전남 배에 서해·동해 특보가 섞이지 않는다',
      !/서해중부|동해중부/.test(out.전남.active.join(' ')));
    T('내 해역이 조용하면 그렇게 말한다', true);
    // ★ 배 위치를 모를 때 '특보 없음' 이라고 하면 안 된다. 그건 거짓말이다.
    T('배 위치를 모르면 전국을 보여 준다 — ' + JSON.stringify(out.없음.active),
      out.없음.active.length >= 2);
    T('그때는 전국이라고 밝힌다', /전국|위치/.test(out.없음.note || out.없음.summary || ''));
  } else fail += 7;

  // 내 해역이 조용한 경우
  let quiet = null;
  try{
    const fn = new Function('krCache','boatRegion',
      z + '\n' + (grab(js,'warnLines')||'') + '\n' + f + '\n return myWarnings;')(
      { wx: { zones: [{ kind:'풍랑주의보', reg:'서해중부앞바다' }] } }, () => '전남');
    quiet = fn();
  }catch(e){}
  T('내 해역만 조용하면 다른 해역이 있다고 알려 준다 — ' + (quiet && quiet.summary),
    quiet && !quiet.active.length && /다른 해역|타 해역/.test(quiet.summary || ''));
  let none = null;
  try{
    const fn = new Function('krCache','boatRegion',
      z + '\n' + (grab(js,'warnLines')||'') + '\n' + f + '\n return myWarnings;')(
      { wx: { zones: [] } }, () => '전남');
    none = fn();
  }catch(e){}
  T('전국이 조용하면 그냥 없다고 한다 — ' + (none && none.summary),
    none && /없/.test(none.summary || '') && !/다른 해역/.test(none.summary || ''));
}

// ── 3. 화면과 알림이 같은 곳을 본다
{
  const a = grab(js, 'wxAlertBox') || '';
  T('특보 상자가 내 해역 것을 쓴다', /myWarnings\(/.test(a));
  T('어느 해역인지 밝힌다', /region|해역/.test(a));
  // ★ 같은 셈을 세 군데에 따로 적어 두면 한 곳만 고쳐진다 — 늘 이렇게 어긋났다
  const k = grab(js, 'wxKeyOf') || '';
  T('바뀌었는지 보는 셈이 한 곳에 있다', k.length > 0);
  T('그 셈도 구역을 안다', /zones/.test(k));
  T('그 셈도 옛 모양을 받아 준다', /active/.test(k));
  ['markWxSeen','checkNewsBadge','lastSeen'].forEach(fn2=>{
    const g = grab(js, fn2) || '';
    if(/wxKey/.test(g)) T(fn2 + ' 이 그 한 곳을 쓴다', /wxKeyOf\(/.test(g));
  });
  T('제 손으로 다시 세는 곳이 남지 않았다',
    !/wx\.active\)\s*\?\s*krCache\.wx\.active\.join/.test(js));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
