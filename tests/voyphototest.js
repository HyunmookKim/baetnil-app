// 4.95 — 항해일지 사진이 자리마다 붙는다 (출발 · 중간 기록 · 도착)
//
// ★ 왜 이 검사가 있나
//   여태 사진은 화면 맨 아래 한 곳(it.photos)에만 붙었다.
//   어디서 찍은 것인지가 안 남아 「그냥 사진 몇 장」 이 되었다. (사장님 지적)
//
// ★ 여기서 지키는 것
//   ① 자리는 넷이지만 문은 하나다 (vphAt / vphSet) — 자리마다 따로 만들면 한 곳이 빠진다
//   ② 넣기·빼기가 다른 자리를 안 건드린다
//   ③ 옛 자료(사진 칸이 아예 없는 항해)를 열어도 안 터진다
//   ④ ★ 지울 때 창고 사진이 남지 않는다 (photoUrlsOf 가 자리 사진까지 걷는다)
//   ⑤ ★ 폰에 챙겨 둘 때도 자리 사진을 센다 (boatPhotoUrls)
//   ⑥ ★ 공개용에 자리 사진이 나가되, 한 항해가 통째로 무거워지지 않는다
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
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };

const need = ['vphAt','vphSet','voyPhotoUrls','vphBox','photoUrlsOf','boatPhotoUrls'];
const miss = need.filter(f => !grab(js, f));
if(miss.length){
  console.log('★ 함수가 없습니다: ' + miss.join(', '));
  console.log('\n합계: 0개 통과 / ' + miss.length + '개 실패');
  process.exit(1);
}
const F = new Function('unlocked','esc','t','tsub','voyage','maint','repair','items','vdocs','posts','dgImgs',
  (js.match(/const VPH_MAX = [^\n]*\n/) || [''])[0]
  + (js.match(/const vphLogId = [^\n]*\n/) || [''])[0]
  + need.map(n => grab(js, n)).join('\n')
  + '\n return { vphAt, vphSet, voyPhotoUrls, vphBox, photoUrlsOf, boatPhotoUrls, VPH_MAX };');

const mk = () => ({ id:'v1', date:'2026-08-10',
  photos:['A1','A2'], phOut:['O1'], phIn:['I1','I2'],
  logs:[{ id:'g1', time:'09:20', text:'돌고래', photos:['L1','L2'] },
        { id:'g2', time:'11:05', text:'바람' }] });
const api = (un, voy) => F(un, x=>String(x), x=>x, (k,v)=>k, voy||[], [], [], [], [], [], null);

// ── 1. 문 하나 — 자리 이름으로 꺼낸다
{
  const A = api(true), v = mk();
  T('출발 사진을 꺼낸다', JSON.stringify(A.vphAt(v,'out')) === '["O1"]');
  T('도착 사진을 꺼낸다', JSON.stringify(A.vphAt(v,'in')) === '["I1","I2"]');
  T('이 항해 사진을 꺼낸다', JSON.stringify(A.vphAt(v,'all')) === '["A1","A2"]');
  T('중간 기록 사진을 꺼낸다', JSON.stringify(A.vphAt(v,'log:g1')) === '["L1","L2"]');
  T('사진이 없는 중간 기록은 빈 것', JSON.stringify(A.vphAt(v,'log:g2')) === '[]');
  T('없는 중간 기록도 안 터진다', JSON.stringify(A.vphAt(v,'log:없다')) === '[]');
  T('모르는 자리도 안 터진다', JSON.stringify(A.vphAt(v,'zz')) === '[]');
  T('빈 것을 줘도 안 터진다', JSON.stringify(A.vphAt(null,'out')) === '[]');
}
// ── 2. 옛 자료 — 사진 칸이 아예 없는 항해
{
  const A = api(true), old = { id:'v0', date:'2026-01-01' };
  T('옛 항해도 안 터진다',
    ['out','in','all','log:g1'].every(k => JSON.stringify(A.vphAt(old,k)) === '[]'));
  T('옛 항해에 넣을 수 있다', A.vphSet(old,'out',['X']) === true && old.phOut[0] === 'X');
  T('★ 없던 칸을 미리 만들지 않는다', old.phIn === undefined && old.photos === undefined);
}
// ── 3. 넣기·빼기가 다른 자리를 안 건드린다
{
  const A = api(true), v = mk();
  A.vphSet(v, 'out', ['O1','O2']);
  T('출발에 넣었다', JSON.stringify(v.phOut) === '["O1","O2"]');
  T('★ 도착은 그대로', JSON.stringify(v.phIn) === '["I1","I2"]');
  T('★ 이 항해 사진도 그대로', JSON.stringify(v.photos) === '["A1","A2"]');
  T('★ 중간 기록도 그대로', JSON.stringify(v.logs[0].photos) === '["L1","L2"]');
  // ★ 도착도 같은 확인을 한다 — 자리마다 쓰는 칸이 진짜 다른지 봐야 한다
  A.vphSet(v, 'in', ['I9']);
  T('도착에 넣었다', JSON.stringify(v.phIn) === '["I9"]');
  T('★ 도착에 넣어도 이 항해 사진은 그대로', JSON.stringify(v.photos) === '["A1","A2"]');
  T('★ 도착에 넣어도 출발은 그대로', JSON.stringify(v.phOut) === '["O1","O2"]');
  A.vphSet(v, 'all', ['A9']);
  T('이 항해 사진에 넣었다', JSON.stringify(v.photos) === '["A9"]');
  T('★ 그래도 도착은 그대로', JSON.stringify(v.phIn) === '["I9"]');
  A.vphSet(v, 'log:g2', ['N1']);
  T('사진 없던 중간 기록에도 넣힌다', JSON.stringify(v.logs[1].photos) === '["N1"]');
  T('★ 옆 중간 기록은 그대로', JSON.stringify(v.logs[0].photos) === '["L1","L2"]');
  T('없는 중간 기록에는 안 넣는다', A.vphSet(v,'log:없다',['Z']) === false);
  T('모르는 자리에도 안 넣는다', A.vphSet(v,'zz',['Z']) === false);
}
// ── 4. ★ 한 항해에 달린 사진을 하나도 안 빠뜨리고 걷는다
{
  const A = api(true), v = mk();
  const all = A.voyPhotoUrls(v);
  ['A1','A2','O1','I1','I2','L1','L2'].forEach(u =>
    T('걷은 것에 ' + u + ' 이 있다', all.includes(u), all));
  T('빈 것을 줘도 안 터진다', JSON.stringify(A.voyPhotoUrls(null)) === '[]');
}
// ── 5. ★ 지울 때 창고 사진이 남지 않는다
{
  const A = api(true), v = mk();
  v.photos = ['https://s/A1']; v.phOut = ['https://s/O1']; v.phIn = ['https://s/I1'];
  v.logs[0].photos = ['https://s/L1'];
  const got = A.photoUrlsOf(v);
  ['https://s/A1','https://s/O1','https://s/I1','https://s/L1'].forEach(u =>
    T('지울 때 ' + u.split('/').pop() + ' 도 함께 치운다', got.includes(u), got));
}
// ── 6. ★ 폰에 챙겨 둘 때도 자리 사진을 센다
{
  const v = mk();
  v.photos = ['https://s/A1']; v.phOut = ['https://s/O1']; v.phIn = ['https://s/I1'];
  v.logs[0].photos = ['https://s/L1'];
  const A = api(true, [v]);
  const got = A.boatPhotoUrls();
  ['https://s/A1','https://s/O1','https://s/I1','https://s/L1'].forEach(u =>
    T('챙길 것에 ' + u.split('/').pop() + ' 이 있다', got.includes(u), got));
}
// ── 7. 화면 — 고칠 때는 작게, 아닐 때는 크게
{
  const v = mk();
  const view = api(false).vphBox(v, 'out');
  const edit = api(true).vphBox(v, 'out');
  T('★ 고치는 중이 아니면 크게 (vphbig)', /class="vphbig"/.test(view), view.slice(0,180));
  T('★ 고치는 중에는 작게 (vph1)', /class="vph1"/.test(edit) && !/vphbig/.test(edit), edit.slice(0,180));
  T('★ 고치는 중이 아니면 빼기 단추가 없다', !/vphDel/.test(view), view.slice(0,200));
  T('고치는 중에는 빼기 단추가 있다', /vphDel\('out',0\)/.test(edit));
  T('고치는 중에는 넣는 단추가 있다', /vphPick\('out'/.test(edit));
  T('★ 고치는 중이 아니면 넣는 단추가 없다', !/vphPick/.test(view));
  T('눌러서 크게 볼 수 있다', /vphOpen\('out',0\)/.test(view));
  // 사진이 없을 때
  const none = api(false).vphBox({ id:'x' }, 'out');
  T('★ 사진이 없고 고치는 중도 아니면 아무것도 안 그린다', none === '', none);
  T('사진이 없어도 고치는 중이면 넣는 단추는 있다', /vphPick/.test(api(true).vphBox({id:'x'},'out')));
}
// ── 8. 자리마다 다른 이름을 준다 (한 자리 빼기가 다른 자리를 안 지운다)
{
  const A = api(true), v = mk();
  const a = A.vphBox(v,'out'), b = A.vphBox(v,'in'), c = A.vphBox(v,'log:g1');
  T("출발 칸은 'out' 을 쥔다", /vphDel\('out',/.test(a) && !/vphDel\('in',/.test(a));
  T("도착 칸은 'in' 을 쥔다",  /vphDel\('in',/.test(b));
  T("중간 기록 칸은 'log:g1' 을 쥔다", /vphDel\('log:g1',/.test(c));
}
// ── 9. 화면에 실제로 걸려 있다
{
  const body = js;
  // ★★★ 4.99 — 사진 칸이 legRow **안**으로 들어갔다 (사장님 지적: 「세부사항이 칸밖에 있다」).
  //   옛 검사는 openMR 에서 `legRow(...) + vphBox(...)` 를 찾았다. 그 설계가 물러났다.
  //   이제 볼 것은 「출발·도착 칸 안에 그 자리 사진이 들어 있는가」 다.
  const LR = grab(src, 'legRow') || '';
  T('★ 출발·도착 칸 안에 그 자리 사진이 있다',
    /vphBox\(it, kind === 'out' \? 'out' : 'in'\)/.test(LR), LR);
  T('★★★ 사진이 칸 안에서 닫힌다 (밖으로 새지 않는다)',
    LR.indexOf("vphBox(") < LR.lastIndexOf('`</div>`'), LR.slice(-260));
  T('★ 중간 기록마다 사진 칸이 있다', /vphBox\(it, 'log:' \+ g\.id\)/.test(body));
  T('★ 「이 항해 사진」 이 도착 아래로 왔다', /이 항해 사진[\s\S]{0,240}vphBox\(it, 'all'\)/.test(body));
  // ★ 같은 칸이 둘이면 한쪽만 고치고 다른 쪽을 잊는다
  T('★★★ 맨 아래 사진 칸에서 항해일지가 빠졌다',
    /const hasPhotos = \([^)]*\);/.test(body)
    && !/const hasPhotos = \([^)]*voyage[^)]*\)/.test(body),
    (body.match(/const hasPhotos = \([^)]*\)/) || [''])[0]);
}
{
}
// ── 10. 공개용 — 나가되 무거워지지 않는다
{
  const bp = grab(js, 'buildPublic') || '';
  T('★ 출발 사진이 나간다', /phOut:/.test(bp));
  T('★ 도착 사진이 나간다', /phIn:/.test(bp));
  T('★ 중간 기록 사진이 나간다', /r\.photos = gp/.test(bp));
  T('★★ 중간 기록 사진은 장수를 끊는다 (한 항해가 통째로 무거워지지 않는다)',
    /\(g\.photos \|\| \[\]\)\.slice\(0, \d+\)/.test(bp), (bp.match(/g\.photos[^\n]*/)||[''])[0]);
  T('★★ 출발·도착 사진도 장수를 끊는다',
    /\(v\.phOut \|\| \[\]\)\.slice\(0, \d+\)/.test(bp) && /\(v\.phIn  \|\| \[\]\)\.slice\(0, \d+\)/.test(bp));
  // ★ 밖으로 나가는 칸은 표에 적혀 있어야 한다 (PUB_OUT). 안 적으면 검사가 못 지킨다.
  const tbl = (js.match(/const PUB_OUT = \{[\s\S]*?\n\};/) || [''])[0];
  T('★★★ 나가는 칸이 표에 적혀 있다', /'phOut'/.test(tbl) && /'phIn'/.test(tbl), tbl.slice(0,300));
}

(async () => {
// ── 9-2. ★ 한 자리 장수 한도 — 「적어 뒀나」 가 아니라 **실제로 막는가**를 본다
{
  // 사진을 받는 자리를 진짜 돌려 본다. 파일 고르기·크기 줄이기·창고는 가짜를 끼운다.
  const run = async (있던장수, 준장수) => {
    const v = { id:'v1', phOut: Array.from({length:있던장수}, (_,i)=>'H'+i) };
    const said = [];
    const f = new Function('resizePhoto','storePhotos','getMR','tell','tsub','t','saveMR','openMR',
      'mrOpenType','mrOpenId',
      (js.match(/const VPH_MAX = [^\n]*\n/) || [''])[0]
      + (js.match(/const vphLogId = [^\n]*\n/) || [''])[0]
      + 'let vphSlot = "out";\n'
      + grab(js,'vphAt') + '\n' + grab(js,'vphSet') + '\n' + grab(js,'vphFilePick')
      + '\n return vphFilePick;');
    const fn = f(
      (file, cb) => cb('data:new'),                 // 크기 줄이기 — 그대로 돌려준다
      async a => ({ photos: a, thumbs: a }),        // 창고 — 올린 셈 친다
      () => v, m => said.push(String(m)), (k,val)=>String(k).replace('{n}', val.n), x=>x,
      ()=>{}, ()=>{}, 'voyage', 'v1');
    fn({ target: { files: Array.from({length:준장수}, (_,i)=>({name:'f'+i})), value:'x' } });
    // 창고에 올리는 일이 끝나기를 기다린다 (사진마다 따로 돌아온다)
    for(let k = 0; k < 20; k++) await Promise.resolve();
    return { v, said };
  };
  const ok = await run(0, 2);
  T('★ 한도 안이면 실제로 들어간다 — ' + (ok.v.phOut||[]).length + '장',
    (ok.v.phOut || []).length === 2, ok.said);
  const over = await run(2, 11);
  T('★★★ 한도를 넘기면 한 장도 안 넣는다 — ' + (over.v.phOut||[]).length + '장',
    (over.v.phOut || []).length === 2, over.said);
  T('★★ 막을 때 사람에게 말해 준다 — ' + (over.said[0] || '(아무 말 없음)'),
    over.said.length > 0 && /12/.test(over.said[0] || ''), over.said);
}


// ══ 4.99 — 「이 항해 사진」 은 지도 밑에 있다 (사장님이 정하신 자리) ═══
{
  const b = src.indexOf("function openMR(");
  const seg = src.slice(b, src.indexOf("function closeMR(", b));
  const 지도 = seg.indexOf("mapBox('trkMap'");
  const 사진 = seg.indexOf("vphBox(it, 'all')");
  const 출발 = seg.indexOf("legRow('출발'");
  const 도착 = seg.indexOf("legRow('도착'");
  T('★★★ 이 항해 사진은 지도 **밑**에 있다', 지도 > 0 && 사진 > 지도, [지도, 사진]);
  T('★★★ 출발 칸은 지도 위에 있다', 출발 > 0 && 출발 < 지도, [출발, 지도]);
  T('★★★ 도착 칸도 지도 위에 있다', 도착 > 0 && 도착 < 지도 && 도착 > 출발, [출발, 도착, 지도]);
  // ★ 사진 칸을 부르는 곳은 legRow(1) · logRows(1) · openMR(1) 셋이다.
  //   openMR 에는 「이 항해 사진」 하나만 남아야 한다 — 더 있으면 사진이 두 번 나온다.
  T('★★ openMR 이 부르는 사진 칸은 하나뿐이다 (사본을 안 만든다)',
    (seg.match(/vphBox\(it, '/g) || []).length === 1,
    (seg.match(/vphBox\(it, '[^']*'/g) || []));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
})();
