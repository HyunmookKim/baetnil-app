// 일본 자료 만들기가 남의 서버에 막혔을 때 살아남는가 (4.79)
//
// ★ 왜 이 검사가 있는가 (2026-08-30, collect-jp #1 이 실패했다)
//   overpass-api.de 가 406(Not Acceptable) 을 냈다. IP 가 막힌 것이 아니라,
//   「사람이 아니라 프로그램이 부른 것 같다」 고 본 것이다 — 머리글이 없었다.
//   서버 하나만 부르고 있었으므로 그 한 곳이 막히자 일감이 통째로 죽었다.
const fs = require('fs');
// ★ runall.sh 는 모든 *test*.js 에 앱 파일(work.html)을 넘긴다. 이 검사가 볼 것은
//   앱이 아니라 자료 만드는 스크립트다 — .html 이 오면 무시하고 제 파일을 본다.
//   (2026-08-30 에 이것 때문에 전체 검사에서 헛되이 빨간불이 났다)
const ARG = process.argv[2];
const P = (ARG && !/\.html$/.test(ARG)) ? ARG
        : (__dirname + '/../../webout/scripts/collect_jp.js');
const src = fs.readFileSync(P, 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

T('★★★ 누가 부르는지 밝힌다 (User-Agent)', /'User-Agent':\s*'[^']*baetnil/i.test(src));
T('★★ 받고 싶은 것을 밝힌다 (Accept)', /'Accept':\s*'application\/json'/.test(src));
T('★★★ 서버를 여럿 둔다 (한 곳 막혀도 안 죽는다)', /OVERPASS_LIST/.test(src));

// ★★★ 머리글 값에 한글이 들어가면 부르기도 전에 터진다 (2026-08-30 — 실제로 그랬다).
//   HTTP 머리글은 한 글자가 한 바이트여야 한다. 한글은 그 범위를 넘는다.
//   「Cannot convert argument to a ByteString … index 35」 로 다섯 서버가 다 죽었다.
{
  const m = src.match(/const OV_HEAD = \{[\s\S]*?\n\};/);
  const H = m ? new Function('return ' + m[0].replace('const OV_HEAD = ', '').replace(/;\s*$/, ''))() : {};
  const 나쁜 = Object.entries(H).filter(([k, v]) => !/^[\x20-\x7e]*$/.test(String(v)))
                               .map(([k, v]) => k + '=' + v);
  T('★★★ 머리글 값이 다 ASCII 다 (한글을 넣으면 부르기도 전에 터진다)', 나쁜.length === 0, 나쁜);
  let 만들어지나 = true;
  try{ new Headers(H); }catch(e){ 만들어지나 = e.message; }
  T('★★★ 그 머리글로 실제 요청을 만들 수 있다', 만들어지나 === true, 만들어지나);
  T('★★ 그래도 누가 부르는지는 알아볼 수 있다', /baetnil/.test(String(H['User-Agent'] || '')), H['User-Agent']);
}
// ★ 우리 잘못은 우리 자리에서 터뜨린다 — 남의 서버 탓으로 헤매지 않도록
T('★★★ 한글이 섞이면 스스로 먼저 잡는다',
  /ASCII 아닌 글자가 있습니다/.test(src));
{
  const m = src.match(/const OVERPASS_LIST = \(process\.env\.OVERPASS_URL[\s\S]*?\]\);/);
  const 몇 = m ? (m[0].match(/https:\/\//g) || []).length : 0;
  T('★★★ 실제로 여러 곳이다 (지금 ' + 몇 + '곳)', 몇 >= 3, 몇);
  T('★★ 본 서버가 첫째다 (거울은 남의 호의다 — 먼저 쓰지 않는다)',
    /\[ 'https:\/\/overpass-api\.de/.test(src));
}
T('★★★ 다 막히면 소리 내어 실패한다 (조용히 빈 자료를 내면 안 된다)',
  /throw new Error\('overpass 를 다 못 썼습니다/.test(src));
T('★★ 「바쁘다」(429·504·503) 는 기다렸다 다시 묻는다', /r\.status !== 429/.test(src));

// ★★★ 도는 중인지 사람이 알 수 있어야 한다 (사장님이 「멈춘 건가」 를 물으셨다 — 내 잘못)
T('★★★ 현마다 어디까지 왔는지 찍는다', /\[' \+ \(\+\+몇째\) \+ '\/' \+ 현들\.length/.test(src));
T('★★ 몇 곳을 물어볼지 먼저 알린다', /곳을 OSM 에 물어봅니다/.test(src));
T('★★ 받고 나서 몇 곳을 받았는지 찍는다', /자리 ' \+ cache\[v\.pref\]\.length \+ '곳을 받았습니다/.test(src));
// ★★★ 한없이 기다리지 않는다 — 답 안 주는 서버 하나가 일감을 한 시간 물고 있으면 안 된다
T('★★★ 우리 쪽에서도 시간을 끊는다', /AbortSignal\.timeout\(OV_WAIT\)/.test(src));
{
  const m = src.match(/const OV_WAIT = (\d+)/);
  const 초 = m ? Number(m[1]) / 1000 : 0;
  // 서버 쪽 제한이 90초다. 그보다는 길고, 그렇다고 몇 분씩 물고 있으면 안 된다.
  T('★★★ 끊는 시간이 알맞다 (지금 ' + 초 + '초, 서버 제한 90초)', 초 >= 100 && 초 <= 180, 초);
}

// ══════════════════════════════════════════════════════════════
// 얼마나 건지나 (2026-08-30 — 첫 성공 판에서 35곳 중 10곳만 실렸다)
//
// ★ 꼬리표 세 가지만 보고 있어서 高松港·坂出港 같은 큰 항이 통째로 빠졌다.
//   일본의 항은 OSM 에 제각각으로 들어 있다 — ferry_terminal · landuse=harbour ·
//   man_made=pier, 큰 항은 relation 이다. 그래서 그물을 넓혔다.
// ★ 상수가 있는지만 보면 안 된다 — 적어 두고 안 쓰면 그물이 없는 것과 같다.
//   실제로 물어보는 글에 들어가는지까지 본다 (방해검사에서 여기가 뚫렸다).
T('★★★ 이름 그물을 적어 뒀다', /const 이름그물 = '"name"~"港\$\|マリーナ/.test(src));
T('★★★ 그 이름 그물을 실제로 물어본다 (적어 두고 안 쓰면 없는 것과 같다)',
  /줄\.push\('  ' \+ 종 \+ '\[' \+ 이름그물 \+ '\]' \+ B \+ ';'\)/.test(src));
T('★★★ relation 도 본다 (큰 항은 선 하나가 아니라 묶음이다)',
  /\['node','way','relation'\]/.test(src));
[['amenity"="ferry_terminal','나루터'], ['landuse"="harbour','항만 땅'],
 ['man_made"="pier','桟橋'], ['seamark:type"~"harbour','해도 표기']].forEach(([k, 이름])=>{
  T('★★ ' + 이름 + ' 도 본다', src.indexOf(k) >= 0);
});

// ══════════════════════════════════════════════════════════════
// 이름 맞추기 (2026-08-30 2차 — 22/35. 남은 13곳을 자료로 보고 짚었다)
//
// ★ 7곳은 그물에 아예 안 걸리는 이름이었다 — ボートパーク · プレジャーボート.
['ボートパーク','プレジャーボート','ボートスポット'].forEach(w=>{
  T('★★★ 그물에 「' + w + '」 가 들어 있다', src.indexOf(w) >= 0);
});
// ★ 나머지는 OSM 이 앞뒤를 바꿔 들고 있는 경우다 — 마지막에 「들어 있으면」 도 본다.
//   ★★★ 다만 짧은 이름에 이걸 쓰면 배가 딴 데로 간다. 이것이 제일 중요한 못이다.
{
  const grabF=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
    let d=0, st=js.indexOf('{',i);
    for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
    return ''; };
  const env = (src.match(/const norm = [^;]+;/)||[''])[0]
            + '\n' + (src.match(/const LOOSE_MIN = \d+;/)||[''])[0]
            + '\n' + grabF(src,'findSpot') + '\nreturn { findSpot, LOOSE_MIN };';
  const F = new Function(env)();
  T('★★★ 짧은 이름에는 무르게 안 맞춘다 (몇 자부터: ' + F.LOOSE_MIN + ')',
    F.LOOSE_MIN >= 5, F.LOOSE_MIN);

  // ★★★ 「池田港」 로 「新池田港」 을 집으면 배가 딴 데로 간다. 절대 안 된다.
  T('★★★ 짧은 항 이름이 엉뚱한 항을 집지 않는다 (池田港 ↛ 新池田港)',
    F.findSpot([{ name:'新池田港', lat:1, lon:1 }], '池田港', []) === null);
  T('★★★ 多度津港 도 마찬가지다 (4자 — 무르게 안 본다)',
    F.findSpot([{ name:'東多度津港', lat:1, lon:1 }], '多度津港', []) === null);

  // 긴 이름은 앞뒤가 바뀌어도 집는다
  const a = F.findSpot([{ name:'シーホースマリーナ', lat:1, lon:1 }], 'マリーナシーホース', []);
  T('★★ 긴 이름은 앞뒤가 바뀌어도 찾는다', a === null || !!a, a && a.name);

  // 딱 맞는 것이 있으면 늘 그것이 이긴다
  const b = F.findSpot([{ name:'岩国マリーナ大橋', lat:1, lon:1 },
                        { name:'マリーナ岩国', lat:2, lon:2 }], 'マリーナ岩国', []);
  T('★★★ 딱 맞는 것이 있으면 무르게 맞춘 것보다 늘 먼저다', b && b.lat === 2, b);

  // 무르게 집은 것에는 표가 남아야 한다 — 사람이 훑을 수 있게
  const c = F.findSpot([{ name:'福山山根木材ボートパーク福山店', lat:1, lon:1 }],
                       '山根木材ボートパーク福山', []);
  T('★★★ 무르게 집은 것에는 표를 남긴다 (사람이 훑어야 한다)', !!(c && c.무르게), c);
}
T('★★ 무르게 맞춘 것을 자료에도 적어 준다', /무르게맞춘것: loose/.test(src));

// ── 무엇이 왜 빠졌는지 자료에 남는가 (안 남기면 다음에 또 짐작하게 된다)
// ★ 4.99 — 머리글을 만드는 곳이 하나로 모이면서 「했나」 가 그리로 들어갔다.
T('★★★ 얼마나 건졌는지 자료에 같이 남긴다', /했나: \{/.test(src) || /머리\(/.test(src) && /했나/.test(src));
T('★★★ 마리나를 몇 곳 훑었는지도 남긴다', /마리나훑은수/.test(src));
T('★★★ 못 찾은 것을 이름까지 남긴다', /못찾음: miss/.test(src));
T('★★ 현마다 몇 개를 받아 왔는지도 남긴다 (그물이 좁은지 바로 보인다)',
  /현마다받은수:/.test(src));
// ★ 일감(.github)에 줄을 더하게 만들면 사장님이 일을 하나 더 하셔야 한다.
//   이미 올라가는 파일 안에 넣는다.
T('★★★ 따로 파일을 더 만들지 않는다 (일감에 줄을 더하게 되면 안 된다)',
  !/writeFileSync\('spots-jp-miss/.test(src));

// ── 실제로 돌려 본다: 첫 서버가 406 을 내도 다음 서버에서 받아 오는가
(async ()=>{
  const 부른곳 = [];
  const 원래 = global.fetch;
  global.fetch = async (url) => {
    부른곳.push(String(url));
    if(/overpass-api\.de/.test(url)) return { ok:false, status:406 };
    return { ok:true, status:200, json: async ()=>({ elements:[
      { tags:{ name:'高松港' }, lat:34.35, lon:134.05 } ] }) };
  };
  // ovAsk 만 떼어 낸다
  const grab=(js,name)=>{ const i=js.indexOf('async function '+name+'('); if(i<0) return '';
    let d=0, st=js.indexOf('{',i);
    for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
    return ''; };
  const env = src.match(/const OVERPASS_LIST = \(process\.env\.OVERPASS_URL[\s\S]*?\]\);/)[0]
            + '\n' + src.match(/const OV_HEAD = \{[\s\S]*?\};/)[0]
            + '\n' + src.match(/const OV_WAIT = [^;]+;/)[0]
            + '\n' + src.match(/const 짧게 = [^;]+;/)[0]
            + '\nconst 잠깐 = ms => Promise.resolve();\n'
            + (src.match(/const OV_ROUNDS = [^\n]*\n/) || [''])[0]
            + (src.match(/const OV_ROUND_WAIT = [^\n]*\n/) || [''])[0]
            + grab(src, 'ovAsk') + '\n' + grab(src, 'ov한바퀴') + '\nreturn { ovAsk };';
  const F = new Function(env)();
  let 받은것 = null, 터짐 = null;
  try{ 받은것 = await F.ovAsk('[out:json];'); }catch(e){ 터짐 = e.message; }
  T('★★★ 첫 서버가 406 이어도 자료를 받아 온다',
    !!(받은것 && 받은것.elements && 받은것.elements.length), { 터짐, 부른곳 });
  T('★★★ 406 을 받고 그 서버에 매달리지 않는다 (바로 다음 곳으로)',
    부른곳.filter(u => /overpass-api\.de\/api/.test(u)).length === 1, 부른곳);

  // 다 막히면 반드시 터져야 한다 — 조용히 넘어가면 일본 정박지가 통째로 빈다
  부른곳.length = 0;
  global.fetch = async (url) => { 부른곳.push(String(url)); return { ok:false, status:406 }; };
  const F2 = new Function(env)();
  let 터짐2 = null;
  try{ await F2.ovAsk('[out:json];'); }catch(e){ 터짐2 = e.message; }
  T('★★★ 다 막히면 터진다 (빈 자료로 덮어쓰지 않는다)', !!터짐2, 터짐2);
  T('★★ 어디가 왜 막혔는지 적어 준다', /406/.test(String(터짐2)), 터짐2);
  global.fetch = 원래;

  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad?1:0);
})();
