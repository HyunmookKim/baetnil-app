// 일본 물때 수집기 (STEP 8)
//
// ★ 이 검사가 지키는 것
//   ① 気象庁 고정폭 자료를 정확히 뜯는가 — 한 칸만 밀려도 조위가 통째로 어긋난다
//   ② 예측 없는 값(9999·999)을 버리는가 — 그걸 0 으로 읽으면 「간조 0cm」 가 된다
//   ③ 못 받은 지점은 지어내지 않고 빼고, 몇 건인지 말하는가
//   ④ 출처를 파일에 박는가 (政府標準利用規約 — 출처를 밝혀야 상업 이용이 된다)
//   ⑤ 지점 좌표가 일본 안이고 겹치지 않는가 — 옮겨 적다 한 자리 틀리면 남의 항 물때가 나온다
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { execFile } = require('child_process');
const arg = (process.argv[2] && !/\.html$/.test(process.argv[2])) ? process.argv[2] : null;
const SRC = arg || '/home/claude/webout/scripts/collect_jp_tide.js';
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,300):''));} };
const src = fs.readFileSync(SRC, 'utf8');

// ── 글로 보는 것
T('★★★ 출처를 파일에 박는다 (政府標準利用規約)', /気象庁/.test(src) && /政府標準利用規約/.test(src));
T('★★ 자료 생김새를 적어 두었다 (다음 사람이 칸을 안 밀리게)',
  /1~72/.test(src) && /73~78/.test(src) && /79~80/.test(src) && /81~108/.test(src) && /109~136/.test(src));
T('★★ 지어내지 않는다고 적어 두었다', /지어내지 않는다/.test(src));

// ── 뜯는 셈을 직접 돌려 본다 (실제 気象庁 자료 한 줄)
{
  const grab = n => { const i = src.indexOf('function ' + n + '('); if(i<0) return null;
    let d=0, j=src.indexOf('{', i);
    for(; j<src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
    return src.slice(i, j); };
  const num3 = src.match(/const num3 = [^\n]*/)[0];
  const F = new Function(`${num3}\n${grab('hhmm')}\n${grab('parseLine')}\nreturn parseLine;`)();

  // 気象庁 2026년 高松(TA) 1월 1일. 136칸.
  const L = " 53 21  4  5 27 6711816620422823422219616513611510611313415617117115612426 1 1TA 950234203217399999999999999 226  216 410699999999999999";
  T('★ 검사에 쓰는 줄이 136칸이다', L.length === 136, L.length);
  T('★ 날짜만 갈아 끼워도 136칸이 지켜진다',
    (L.slice(0,72) + '260829' + L.slice(78)).length === 136);
  const p = F(L);
  T('★★ 날짜를 읽는다', p && p.d === '2026-01-01', p && p.d);
  T('★★ 지점 기호를 읽는다', p && p.stn === 'TA', p && p.stn);
  T('★★★ 만조 둘을 읽는다 (셋째·넷째는 예측 없음이라 버린다)', p && p.h.length === 2, p && p.h);
  T('★★★ 첫 만조가 09:50 · 234cm 다', p && p.h[0].t === '09:50' && p.h[0].v === 234, p && p.h[0]);
  T('★★ 둘째 만조가 20:32 · 173cm 다', p && p.h[1].t === '20:32' && p.h[1].v === 173, p && p.h[1]);
  T('★★★ 간조 둘을 읽는다', p && p.l.length === 2, p && p.l);
  // ★ 시·분이 각각 두 칸이라 "16 4" 는 164 분이 아니라 16시 4분이다. 여기서 한 번 틀렸으면
  //   하루에 두 번 있는 간조 시각이 통째로 어긋난다.
  T('★★★ "16 4" 를 16:04 로 읽는다 (16:40 이 아니다)',
    p && p.l[1] && p.l[1].t === '16:04', p && p.l[1]);
  T('★★ 간조 조위가 2cm · 106cm 다', p && p.l[0].v === 2 && p.l[1].v === 106, p && p.l);
  // ★★★ 999 를 0 으로 읽으면 「간조 0cm」 가 되어 배가 바닥에 닿는다
  T('★★★ 예측 없음(999)을 0 으로 읽지 않는다',
    p && p.h.every(x=>x.v !== 999) && p.l.every(x=>x.v !== 999));
  T('★ 짧은 줄은 버린다', F('짧다') === null);
}

// ── 지점표
{
  const rows = [...src.matchAll(/\['([A-Z0-9]{2})','([^']+)',([\d.]+),([\d.]+)\]/g)]
    .map(m=>({ c:m[1], n:m[2], la:+m[3], lo:+m[4] }));
  T('★ 지점을 100곳 넘게 담았다 (' + rows.length + '곳)', rows.length > 100, rows.length);
  T('★★ 좌표가 다 일본 안이다',
    rows.every(r => r.la > 20 && r.la < 46.5 && r.lo > 122 && r.lo < 154.5),
    rows.filter(r => !(r.la > 20 && r.la < 46.5 && r.lo > 122 && r.lo < 154.5)).slice(0,4));
  const seen = new Map(), dup = [];
  rows.forEach(r=>{ const k = r.la.toFixed(3)+','+r.lo.toFixed(3);
    if(seen.has(k)) dup.push(r.n + ' = ' + seen.get(k)); else seen.set(k, r.n); });
  T('★★ 좌표가 겹치는 지점이 없다 (옮겨 적다 틀린 자리)', dup.length === 0, dup.slice(0,4));
  T('★★ 기호가 겹치지 않는다', new Set(rows.map(r=>r.c)).size === rows.length);
  // 사장님 배가 다니는 쪽 — 세토내해와 규슈가 들어 있어야 한다
  ['高松','広島','神戸','大阪','松山','今治','宇部'].forEach(n=>
    T('★ ' + n + ' 이(가) 있다', rows.some(r=>r.n === n)));
}

// ── 진짜로 돌려 본다 (気象庁 흉내 서버)
const D = new Date(); const pad = n => String(n).padStart(2,'0');
const y2 = pad(D.getFullYear() % 100), mo = pad(D.getMonth()+1), dd = pad(D.getDate());
// 오늘 날짜로 한 줄 만든다 — 「오늘부터 보름만 담는가」 를 보려면 오늘이 있어야 한다.
// ★ 손으로 이어 붙이면 한 칸이 밀린다 (실제로 밀렸다). 진짜 줄의 날짜 자리만 갈아 끼운다.
const BASE_LINE = " 53 21  4  5 27 6711816620422823422219616513611510611313415617117115612426 1 1TA 950234203217399999999999999 226  216 410699999999999999";
const putDate = (l, s6) => l.slice(0,72) + s6 + l.slice(78);
const LINE = putDate(BASE_LINE, y2 + mo + dd);
const OLD  = putDate(BASE_LINE, y2 + '0101');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jpt2-'));
let hits = 0;
const srv = http.createServer((q,r)=>{
  hits++;
  if(/\/TA\.txt$/.test(q.url) || /\/Q8\.txt$/.test(q.url)){
    r.writeHead(200, {'content-type':'text/plain'}); r.end(LINE + '\n' + OLD + '\n');
  } else { r.writeHead(404); r.end(''); }
});
srv.listen(0, () => {
  execFile('node', [SRC], { cwd: TMP, encoding:'utf8', maxBuffer: 1<<24,
      env: Object.assign({}, process.env, { JMA_TIDE_BASE: 'http://127.0.0.1:' + srv.address().port }) },
    (err, so, se) => { srv.close(); done(String(so||'') + String(se||'')); });
});
function done(out){
  let j = null;
  try{ j = JSON.parse(fs.readFileSync(path.join(TMP, 'tide-jp.json'), 'utf8')); }catch(_){}
  T('★ 파일을 만든다', !!j, out.slice(0,200));
  if(j){
    // ★ 흉내 서버는 Q8(広島) 을 물어도 TA(高松) 줄을 돌려준다.
    //   수집기가 지점 기호를 확인하니 그 줄은 버려지고 高松 하나만 남아야 맞다.
    //   ★★★ 이것이 안 걸리면 「広島 물때랍시고 高松 것을 보여 주는」 일이 생긴다.
    T('★★★ 못 받은 지점은 안 싣는다 (물때를 지어내면 배가 바닥에 닿는다)',
      j.spots.length === 1 && j.spots[0].name === '高松', j.spots.map(s=>s.name));
    T('★★★ 남의 지점 기호가 든 줄은 통째로 버린다 (広島 자리에 高松 물때가 박히면 안 된다)',
      !j.spots.some(s=>s.name === '広島'), j.spots.map(s=>s.name));
    T('★★★ 못 받은 것이 몇 건인지 말한다 (조용히 빠지면 아무도 모른다)',
      /못 받음 \d+건/.test(out), out.slice(-300));
    T('★★ 출처가 파일에 있다', /気象庁/.test(j.source));
    T('★★ 한국 물때와 칸 이름이 같다 (앱이 그대로 읽는다)', (()=>{
      const s = j.spots[0];
      return s && 'id' in s && 'name' in s && 'lat' in s && 'lon' in s && Array.isArray(s.days)
          && s.days[0] && 'd' in s.days[0] && 'h' in s.days[0] && 'l' in s.days[0]
          && 'sr' in s.days[0] && 'ss' in s.days[0];
    })(), j.spots[0]);
    T('★★ id 가 한국 것과 안 부딪친다 (jp_ 를 붙인다)',
      j.spots.every(s=>/^jp_/.test(s.id)), j.spots.map(s=>s.id));
    // ★ 오늘부터 보름만 담는다. 1월 1일 줄은 오늘이 1월 1일이 아닌 이상 빠져야 한다
    const today = D.getFullYear()+'-'+mo+'-'+dd;
    T('★★ 오늘 것을 담는다', j.spots[0].days.some(x=>x.d === today), j.spots[0].days.map(x=>x.d));
    T('★★ 보름 밖의 날은 안 담는다',
      (mo+dd === '0101') || !j.spots[0].days.some(x=>x.d === D.getFullYear()+'-01-01'),
      j.spots[0].days.map(x=>x.d));
    T('★ 해뜸·해짐을 채운다 (気象庁 조위표에는 없다 — 앱이 셈한다)',
      /^\d\d:\d\d$/.test(j.spots[0].days[0].sr) && /^\d\d:\d\d$/.test(j.spots[0].days[0].ss),
      j.spots[0].days[0]);
    T('★ 남의 지점 줄이 섞이면 버린다', j.spots.every(s => s.days.every(d => d.h.length || d.l.length)));
  }
  try{ fs.rmSync(TMP, { recursive:true, force:true }); }catch(_){}
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
}
