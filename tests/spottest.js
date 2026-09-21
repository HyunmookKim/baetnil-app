// 3.13 — 날씨 지점 · 표 하이라이트 · 글판 지역 · 정비 글 연동
//
// 실제로 일어난 일 (사장님)
//  1) 날씨 지점은 추가만 되고 이름 수정도 삭제도 안 됐다.
//  2) 지점을 더하려면 위도·경도를 손으로 쳐야 했다.
//     "인간이 위도랑 경도를 그때그때 어떻게 아냐" — 맞는 말이다.
//     앱 안에 이미 지도에서 찍는 화면(홈포트)이 있는데 여기만 안 썼다.
//  3) 머리글은 22시인데 표의 주황 네모는 20시를 가리켰다.
//     표 왼쪽 이름칸(62px)만큼 늘 왼쪽으로 밀려 있었다. 62 ÷ 34 ≈ 두 칸.
//  4) 글판 지역이 늘 '그 밖' 이었다. 배 홈포트에서 잡아 주기로 했는데 안 했다.
//  5) 정비 글을 쓸 때 내 배의 정비·수리 기록을 붙일 수 있게 한다 했는데 없었다.
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

// ── 1. ★ 표 하이라이트가 제자리에 — 실제로 계산해서 본다
{
  T('표 왼쪽 이름칸 폭이 한 곳에 정해져 있다', /const WLBL\s*=\s*\d+/.test(js));
  const rs = grab(js, 'renderWxSel') || '';
  T('하이라이트를 옮기는 곳이 있다', /wxHl|hl\.style\.left/.test(rs));
  // ★ 이름칸 폭을 안 더하면 늘 왼쪽으로 밀린다. 실제로 그랬다.
  T('하이라이트가 이름칸 폭을 더한다', /WLBL \+ col \* COLW|WLBL \+ col\*COLW/.test(rs));
  // 표 전체 폭도 같은 값을 써야 어긋나지 않는다
  T('표 폭도 같은 값을 쓴다', /N \* COLW \+ WLBL|N\*COLW \+ WLBL/.test(js));
  T('62 를 코드 여기저기 박지 않는다', (js.match(/\+ ?62\b/g) || []).length === 0);
  // 값으로 확인
  let got = null, err = '';
  try{
    const m = js.match(/const WLBL\s*=\s*(\d+)/), c = js.match(/const COLW = (\d+)/);
    const fn = new Function('WLBL','COLW','col', 'return WLBL + col * COLW;');
    got = fn(+m[1], +c[1], 22);
  }catch(e){ err = e.message; }
  T('22번째 칸의 자리가 맞는다 (62 + 22×34 = 810) — 나온 값: ' + got, got === 810);
}

// ── 2. ★ 날씨 지점 — 지도에서 찍는다
{
  const a = grab(js, 'wxAddSpot') || '';
  T('지점 추가가 있다', a.length > 0);
  // ★ 위도·경도를 손으로 치게 하면 안 된다. 배 위에서 알 수가 없다.
  T('위도·경도를 타이핑시키지 않는다',
    !/label:'위도|label:'경도|label: ?'위도|label: ?'경도/.test(a) && !/위도 \(비워도/.test(a));
  T('지도에서 찍어서 고른다', /wxSpotPick\(|mapBox\(/.test(a + (grab(js, 'wxSpotPick') || '')));
  const sp = grab(js, 'wxSpotPick') || '';
  T('지점 고르는 지도 화면이 있다', sp.length > 0);
  T('지도를 눌러 고르는 방식이다', /mode:'pick'/.test(sp));
  T('현재 위치로 잡는 길도 있다', /geolocation|UseGPS/.test(sp + (grab(js, 'wxSpotGPS') || '')));
  T('저장하는 곳이 있다', !!grab(js, 'wxSpotSave'));
  const sv = grab(js, 'wxSpotSave') || '';
  T('이름 없이 저장하지 않는다', /trim\(\)/.test(sv));
  // ★ 화면에서 갈 길이 없으면 만들어 놓으나 마나다. 날씨 화면에 문이 있어야 한다.
  T('날씨 화면에서 지점 관리로 갈 수 있다',
    /wxSpotList\(\)/.test(grab(js, 'renderWeather') || ''));
}

// ── 3. ★ 지점 수정·삭제
{
  T('지점 이름을 고칠 수 있다', !!grab(js, 'wxEditSpot'));
  T('지점을 지울 수 있다', !!grab(js, 'wxDelSpot'));
  const d = grab(js, 'wxDelSpot') || '';
  // ★ 'confirm 글자가 있다' 로는 부족하다. 물어보고 아니면 돌아서야 한다.
  T('지우기 전에 묻고 아니면 그만둔다',
    /if\(!await ask\([\s\S]{0,160}?\)\) return;/.test(d));
  T('지우면 목록에서 빠진다', /wxSpots = wxSpots\.filter\(/.test(d));
  T('보던 지점을 지우면 다른 곳으로 옮긴다', /wxCur/.test(d));
  // 홈포트에서 자동으로 생긴 지점은 지워도 다시 생긴다 — 알려 줘야 한다
  T('홈포트 지점은 따로 알려 준다', /port@|홈포트/.test(d + (grab(js, 'wxSpotRows') || '')));
  // 목록에 수정·삭제 버튼이 실제로 붙는가
  const rows = grab(js, 'wxSpotRows') || grab(js, 'renderWeather') || '';
  T('목록에 고치기·지우기가 붙는다',
    /wxEditSpot\(/.test(rows) && /wxDelSpot\(/.test(rows));
}

// ── 4. 글판 지역이 배 위치에서 자동으로 잡힌다
{
  const f = grab(js, 'boatRegion');
  T('배 위치로 지역을 잡는 곳이 있다', !!f);
  if(f){
    let out = null, err = '';
    try{
      const REG = js.match(/const REGIONS = \[[\s\S]*?\];/)[0];
      const KR = js.match(/const REGION_POINTS = \[[\s\S]*?\];/);
      // ★ 4.97 — 너무 멀면 「아무 데도 아니다」 로 잡는 한계가 생겼다. 같이 떼어 온다.
      const FAR = (js.match(/const REGION_FAR = [^\n]*\n/) || [''])[0];
      const fn = new Function('curBoat', REG + '\n' + (KR ? KR[0] : '') + '\n' + FAR + '\n' + f + '\n return boatRegion;');
      const mk = (lat, lon, port) => fn(() => ({ lat, lon, port }))();   // 함수를 받아서 부른다
      out = {
        여수: mk(34.76, 127.66),      // 전남
        부산: mk(35.10, 129.04),
        인천: mk(37.45, 126.60),      // 경기·인천
        제주: mk(33.51, 126.52),
        없음: fn(() => null)()
      };
    }catch(e){ err = e.message; }
    T('지역 계산을 돌렸다' + (err ? ' — ' + err : ''), !!out);
    if(out){
      T('여수는 전남 — 나온 값: ' + out.여수, out.여수 === '전남');
      T('부산은 부산 — 나온 값: ' + out.부산, out.부산 === '부산');
      T('인천은 경기·인천 — 나온 값: ' + out.인천, out.인천 === '경기·인천');
      T('제주는 제주 — 나온 값: ' + out.제주, out.제주 === '제주');
      T('배가 없으면 빈 값', !out.없음);
      T('나온 값이 모두 지역 목록에 있다',
        ['여수','부산','인천','제주'].every(k => {
          const RE = js.match(/const REGIONS = \[([\s\S]*?)\]/)[1];
          return RE.includes("'" + out[k] + "'");
        }));
    } else fail += 6;
  } else fail += 7;
  const w = grab(js, 'writeTalk') || '';
  T('글쓰기가 그 지역을 기본값으로 쓴다', /boatRegion\(/.test(w));
  // 지난번에 고른 지역이 있으면 그것을 먼저 (사람이 정한 것이 우선)
  T('사람이 고른 지역이 있으면 그것을 먼저 쓴다', /lastReg/.test(w));
}

// ── 5. 정비 글에 내 배 기록을 붙인다
{
  T('붙일 기록을 고르는 곳이 있다', !!grab(js, 'talkPickRecord'));
  const p = grab(js, 'talkPickRecord') || '';
  // ★ 'maint / repair 글자가 있다' 로는 한쪽만 도는 것을 못 잡는다. 둘 다 훑는지 본다.
  T('정기점검 목록을 훑는다', /\bmaint\b[\s\S]{0,60}?forEach\(/.test(p));
  T('수리 목록도 훑는다', /\brepair\b[\s\S]{0,60}?forEach\(/.test(p));
  // 3.19 에서 넣는 일은 recPickTake 로 옮겼다 (폼 위에 폼을 못 열어서)
  T('고른 것을 글에 넣는다', /richInsert\(/.test(grab(js, 'recPickTake') || ''));

  // ★ 3.21 — 글자만 넣으면 아무 의미가 없다.
  //   사진과 도면 위치가 있어야 남이 보고 알아본다.
  const tb = grab(js, 'talkRecordBlocks') || '';
  T('기록을 덩어리로 만드는 곳이 있다', tb.length > 0);
  T('항목에 붙은 사진을 함께 넣는다', /it\.photos/.test(tb) && /t:'photo'/.test(tb));
  T('도면 위치도 그림으로 넣는다', /it\.pin/.test(tb) && /pinShot\(/.test(tb));
  T('넣기가 그 덩어리를 쓴다', /talkRecordBlocks\(/.test(grab(js, 'recPickTake') || ''));
  T('사진 용량을 먼저 본다', /photoBudget\(/.test(grab(js, 'recPickTake') || ''));
  // 도면 그림 만들기
  const ps = grab(js, 'pinShot') || '';
  T('도면에 핀을 찍는 곳이 있다', ps.length > 0);
  T('도면 그림을 가져온다', /dgSrc\(/.test(ps));
  T('핀 자리를 백분율로 계산한다', /pin\.x/.test(ps) && /\/ 100/.test(ps));
  T('도면이 없으면 조용히 넘어간다', /resolve\(null\)/.test(ps));
  // 글에 들어가는 내용
  const tr = grab(js, 'talkRecordText') || '';
  T('메모도 함께 들어간다', /it\.note/.test(tr));
  T('도면 위치를 말로도 적는다', /도면 위치/.test(tr));
  T('사진이 몇 장인지 적는다', /사진 /.test(tr));
  // 고르는 목록에서 미리 보인다
  T('목록에 도면 위치·사진이 있는지 보여 준다',
    /도면 위치/.test(p) && /사진 /.test(p));
  const w = grab(js, 'writeTalk') || '';
  T('정비 말머리일 때 그 버튼이 나온다', /talkPickRecord\(/.test(w));
  // ★ 남의 배 기록이 새면 안 된다 — 내 배 것만 붙인다
  T('내 배 기록만 붙인다', /curBoat\(\)|getMR\(|maint\b/.test(p));
  // ★ 여기서 openForm 을 쓰면 안 된다. 화면에 폼이 하나뿐이라
  //   글쓰기 폼 위에 또 열면 원래 폼이 닫힌다.
  //   실제로 '넣기' 를 누르면 글쓰기 창이 통째로 사라졌다.
  T('글쓰기 폼 위에 폼을 또 열지 않는다', !/openForm\(/.test(p));
  T('겹쳐 뜨는 전용 화면이 있다', /id="recPick"/.test(src));
  T('그 화면이 폼보다 위에 뜬다', /#recPick\{[^}]*z-index:\s*(1[2-9]\d|[2-9]\d\d)/.test(src));
  T('닫는 길이 있다', !!grab(js, 'closeRecPick') && /closeRecPick\(\)/.test(src));
  const tk = grab(js, 'recPickTake') || '';
  T('눌러서 곧바로 넣는다', /richInsert\(/.test(tk));
  T('넣고 나면 그 화면을 닫는다', /closeRecPick\(\)/.test(tk));
  T('어느 칸에 넣을지 기억해 둔다', /recPickTarget/.test(p) && /recPickTarget/.test(tk));
}

// ── 6. 말머리 설명이 헷갈리지 않는다
{
  const m = (js.match(/const TALK_KINDS = \[[\s\S]*?\];/) || [''])[0];
  T('말머리 목록이 있다', m.length > 0);
  // '고치고 손본 이야기' 와 '써 본 물건' 은 경계가 흐리다. 더 또렷하게.
  T('정비와 장비를 갈라 주는 설명이 있다',
    /내 배를 고친|고장·수리|수리한 이야기/.test(m) && /사서 써 본|제품|장비 후기|써 본 물건/.test(m));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
