// 3.25 — 수집기(뱃일 저장소로 옮긴 것) 검사
//
// ★ 수집기와 앱은 다른 곳에서 돈다. 자료 모양이 어긋나도 아무도 안 알려 준다.
//   어긋나면 앱은 조용히 '특보 없음' 을 띄운다 — 그 말을 믿고 나가면 위험하다.
//   그래서 여기서 수집기가 내놓는 모양을 앱이 읽는 모양과 맞춰 본다.
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
const kr = fs.readFileSync(process.argv[2] || 'repo/scripts/collect_kr.js', 'utf8');
const app = fs.readFileSync(process.argv[3] || 'work.html', 'utf8');
const js = app.slice(app.indexOf('<script>') + 8, app.indexOf('</script>', app.indexOf('<script>')));

let pass = 0, fail = 0;
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + n); } else { fail++; console.log('★ 실패: ' + n); } };

// ── 1. 뉴스가 전국이다
{
  const f = (kr.match(/const GOV_FEEDS = \[[\s\S]*?\];/) || [''])[0];
  T('뉴스 피드 목록이 있다', f.length > 0);
  const names = [...f.matchAll(/name:'([^']+)'/g)].map(m=>m[1]);
  // ★ 피드가 하나뿐이면 그쪽이 마르는 날 화면이 며칠씩 그대로다 (실제로 그랬다)
  T('피드가 넷 이상이다 — ' + names.join(','), names.length >= 4);
  T('한 지역에 매이지 않는다', !/여수/.test(f));
  T('낚싯배도 챙긴다', /낚싯배|낚시어선|유어선/.test(f));
  T('사고 소식을 따로 챙긴다', /사고|침몰|전복|좌초/.test(f));
  T('사흘치를 본다 (하루 걸러 봐도 안 빠뜨린다)', /when:3d/.test(f) && !/when:2d/.test(f));
  const mx = (kr.match(/const GOV_MAX = (\d+);/) || [])[1];
  T('고르는 수를 늘렸다 — ' + mx, Number(mx) >= 12);
  // ★ 3.64 부터 앱은 모아 둔 것을 '날짜별로 전부' 보여 준다. 잘라내지 않는다.
  const rn = grab(js, 'renderNews') || '';
  T('앱이 모아 둔 소식을 잘라내지 않는다',
    !/gov\.slice\(0,/.test(rn) && !/내소식\.slice\(0,/.test(rn));
  // ★ 4.84 — 첫 칸이 「내 말로 된 소식」 이 되면서 이름이 gov → 내소식 으로 바뀌었다.
  //   한국어로 켜면 내소식 === gov 다.
  T('날짜별로 묶어 보여 준다', /newsByDay\(내소식/.test(rn), rn.slice(0, 200));
  // ★ 이레치를 쌓아 두는가 — 전에는 돌 때마다 덮어써서 어제 것이 사라졌다
  T('지난번 것을 읽어 함께 담는다', /readFileSync\('kr\.json'/.test(kr));
  T('이레가 지난 것은 버린다', /KEEP_DAYS \* 864e5/.test(kr));
  T('같은 사건은 한 건만 남긴다', /function dedupeEvent/.test(kr) && /sameEvent/.test(kr));
  T('두 글자 조각으로도 견준다 (붙여 쓴 말)', /function gramsOf/.test(kr));
  T('AI 편집자에게도 같은 사건은 하나만 시킨다', /같은 사건은 한 건만 골라라/.test(kr));
  // 날을 넘어 묶으면 어제 목록이 오늘 바뀐다
  T('같은 사건 묶기는 같은 날 안에서만', /같은 날 안에서만/.test(kr));
  // AI 선별이 한 지역 사람만 겨냥하지 않는다
  const p = grab(kr, 'pickGov') || '';
  T('선별 지시가 전국을 본다', /전국/.test(p) && !/여수/.test(p));
}

// ── 2. ★ 특보를 미리 걸러 담지 않는다
{
  // 예전에는 여기서 남해서부만 남겼다 — 다른 해역 사람에겐 언제나 '특보 없음' 이었다
  T('수집기가 한 해역만 걸러 담지 않는다', !/MY_SEA/.test(kr));
  const h = grab(kr, 'collectWxHub') || '';
  T('전 구역을 담는다', /zones/.test(h));
  T('구역마다 종류와 이름을 남긴다', /kind\s*:/.test(h) && /reg\s*:/.test(h));
  // 옛 앱(3.24 이하)도 아직 돌고 있다. 그쪽이 읽는 모양도 함께 남긴다.
  T('옛 앱이 읽는 모양도 남긴다', /active\s*:/.test(h) && /summary\s*:/.test(h));
}

// ── 3. ★ 수집기가 내놓는 모양을 앱이 그대로 읽는가
{
  let out = null, err = '';
  try{
    // 기상청 API허브 응답 흉내 (실제 형식: 주석행 #, 콤마 구분, 끝에 =)
    const txt = [
      '# REG_UP, REG_UP_KO, REG_ID, REG_KO, TM_FC, TM_EF, WRN, LVL, CMD, ED_TM',
      'A, 서울, S1234, 남해서부앞바다, 202608120600, 202608121200, 풍랑, 주의, 발표, =',
      'A, 서울, S1235, 서해중부먼바다, 202608120600, 202608121200, 풍랑, 경보, 발표, =',
      'A, 서울, L0001, 전남내륙, 202608120600, 202608121200, 폭염, 주의, 발표, =',
      'A, 서울, S1236, 동해중부앞바다, 202608120600, 202608121200, 강풍, 주의, 해제, ='
    ].join('\n');
    const rows = new Function(grab(kr, 'parseHub') + '\n return parseHub;')()(txt);
    const marine = rows.filter(r=>r.marine);
    const zones = marine.map(r=>({ kind:r.kind, reg:r.reg, tmEf:r.tmEf||'' }));

    // 앱 쪽으로 그대로 넘긴다
    const sz = (js.match(/const SEA_ZONE = \{[\s\S]*?\};/) || [''])[0];
    const wl = grab(js, 'warnLines') || '';
    const mw = grab(js, 'myWarnings') || '';
    const run = region => new Function('krCache','boatRegion',
      sz + '\n' + wl + '\n' + mw + '\n return myWarnings;')(
      { wx: { src:'KMA', zones } }, () => region)();
    out = { rows, marine, zones, 전남: run('전남'), 경기: run('경기·인천') };
  }catch(e){ err = e.message; }
  T('수집기 → 앱 을 실제로 이어 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('해제된 특보는 담지 않는다 — ' + out.rows.length + '행', out.rows.length === 3);
    // ★ 육상 특보를 해상으로 세면 배와 상관없는 폭염이 특보로 뜬다
    T('육상 특보는 해상으로 세지 않는다 — 해상 ' + out.marine.length,
      out.marine.length === 2 && !out.marine.some(r=>/내륙/.test(r.reg)));
    T('주의 는 주의보로 적는다', out.marine.some(r=>r.kind === '풍랑주의보'));
    T('경보 는 경보로 적는다', out.marine.some(r=>r.kind === '풍랑경보'));
    T('전남 배는 남해서부만 본다 — ' + JSON.stringify(out.전남.active),
      out.전남.active.length === 1 && /남해서부/.test(out.전남.active[0]));
    T('경기 배는 서해중부만 본다 — ' + JSON.stringify(out.경기.active),
      out.경기.active.length === 1 && /서해중부/.test(out.경기.active[0]));
  } else fail += 6;
}

// ── 3-2. ★★★ 글자가 깨진 특보를 「없음」 으로 내보내지 않는다 (2026-09-04, 사장님 지적)
//
//   사장님: 「야 특보 있는데 왜 없다고 하냐」
//   그날 풍랑경보(남해서부동쪽먼바다)가 떠 있었는데 자료의 구역 이름이 깨져 들어와
//   앱이 「전남 해역은 특보 없음」 이라고 했다. 경보가 떠 있는데 없다고 한 것이다.
{
  // ★ 사장님: 「어떻게든 싣게 만들어야지」 — 「안 싣는다」 는 포기다. 읽어 내는 것이 일이다.
  T('★★★ 글자표를 하나씩 다 대 본다', /글자표들/.test(kr) && /euc-kr/.test(kr) && /cp949/.test(kr));
  T('★★★ 한글이 제일 잘 나온 것을 고른다', /한글수\(/.test(kr) && /제일잘읽힌것/.test(kr));
  T('★★★ 그래도 깨졌으면 바이트로 되돌려 다시 읽는다', /Buffer\.from\(txt, 'latin1'\)/.test(kr));
  T('★★★ 끝내 안 되면 **성한 줄만이라도 싣는다** (하나도 안 싣지 않는다)',
    /성한 줄/.test(kr) && /all = 성한/.test(kr));
  T('★★★ 허브가 막혀도 긁어 온 것에서 **구역을 뽑아 담는다**',
    /zonesFromLines/.test(kr) && /zones: marine\.map/.test(kr));

  const 깨 = grab(kr, '깨진수'), 한 = grab(kr, '한글수'), 고 = grab(kr, '제일잘읽힌것');
  if(깨 && 한 && 고){
    const 표 = (kr.match(/const 글자표들 = \[[^\]]*\];/) || [''])[0];
    const F = new Function(표 + '\n' + 깨 + '\n' + 한 + '\n' + 고 + '\nreturn { 깨진수, 한글수, 제일잘읽힌것 };')();
    const 성한 = '남해서부동쪽먼바다';
    T('★★★ 깨진 글을 세는 문이 실제로 센다',
      F.깨진수(성한.replace(/[가-힣]/g, '\uFFFD')) > 0 && F.깨진수(성한) === 0);
    // 진짜 EUC-KR 바이트를 만들어 넣어 본다 — 「남해」 = B3 B2 C7 D8
    const euc = Buffer.from([0xB3, 0xB2, 0xC7, 0xD8]);
    const 고른 = F.제일잘읽힌것(euc, '');
    T('★★★ charset 을 안 알려 줘도 EUC-KR 을 알아본다 — ' + 고른.t,
      고른.t === '남해', 고른);
    // UTF-8 로 온 것은 그대로 UTF-8 로 읽어야 한다 (거꾸로 망가뜨리면 안 된다)
    const u8 = Buffer.from('남해서부동쪽먼바다', 'utf8');
    T('★★★ UTF-8 로 온 것은 그대로 읽는다 — ' + F.제일잘읽힌것(u8, '').t,
      F.제일잘읽힌것(u8, '').t === '남해서부동쪽먼바다');
  } else fail += 3;

  const zf = grab(kr, 'zonesFromLines');
  if(zf){
    const Z = new Function(zf + '\nreturn zonesFromLines;')();
    const z = Z(['풍랑경보: 남해동부안쪽먼바다, 남해서부동쪽먼바다',
                 '강풍주의보: 전라남도(여수, 고흥북부), 부산']);
    T('★★★ 긁어 온 줄에서 해상 구역을 뽑는다',
      z.filter(x=>x.marine).map(x=>x.reg).join('|') === '남해동부안쪽먼바다|남해서부동쪽먼바다', z);
    T('★★★ 「전라남도(여수」 처럼 잘린 것도 「여수」 로 뽑는다',
      z.some(x => x.reg === '여수' && !x.marine), z);
    T('★★ 해상과 육상을 갈라 놓는다',
      z.some(x=>x.marine) && z.some(x=>!x.marine));
  } else fail += 3;

  const ph = grab(kr, 'parseHub');
  if(ph){
    const P = new Function('const strip=s=>String(s||"").trim();\n' + ph + '\nreturn parseHub;')();
    const 성한것 = P('#\nA,B,S001,남해서부동쪽먼바다,,202609041600,풍랑,경보,발표,\n');
    T('★★ 성한 자료는 그대로 읽는다 — ' + JSON.stringify(성한것),
      성한것.length === 1 && 성한것[0].reg === '남해서부동쪽먼바다'
      && 성한것[0].kind === '풍랑경보' && 성한것[0].marine === true);
  } else fail += 1;
}

// ── 4. 워크플로 — 저장소 안에서 스스로 돈다
{
  const y = n => { try{ return fs.readFileSync('repo/.github/workflows/' + n, 'utf8'); }catch(e){ return ''; } };
  ['kr','news','tide'].forEach(n=>{
    const w = y(n + '.yml');
    T(n + ' 일감이 있다', w.length > 0);
    T(n + ' 이 때맞춰 돈다', /schedule:/.test(w) && /cron:/.test(w));
    T(n + ' 을 손으로도 돌릴 수 있다', /workflow_dispatch/.test(w));
    T(n + ' 이 결과를 저장소에 남긴다', /git commit/.test(w) && /git push/.test(w));
  });
  T('kr 이 열쇠 둘을 받는다', /ANTHROPIC_API_KEY/.test(y('kr.yml')) && /KMA_HUB_KEY/.test(y('kr.yml')));
  // ★ news_seen.json 을 함께 커밋 안 하면 다음 회차에 같은 기사가 또 나온다
  T('news 가 본 기사 목록도 함께 남긴다', /news_seen\.json/.test(y('news.yml')));
  T('tide 가 지점 좌표도 함께 남긴다', /tide-spots\.json/.test(y('tide.yml')));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
