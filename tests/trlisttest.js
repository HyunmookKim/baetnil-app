// 목록도 자동으로 옮기는가 (4.79, 사장님 지적)
//
// ★ 사장님이 일본어로 켜 두셨는데 글판 목록의 제목이 한국어로 남아 있었다.
//   여태는 글을 '열었을 때' 만 옮겼다 (trBar 가 trAuto 를 불렀다).
//   그런데 사람은 목록에서 먼저 본다 — 제목이 남의 말이면 뭘 열지도 못 고른다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,220):''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

T('★★★ 목록을 줄 세우는 문이 있다', /function trListAuto\(/.test(src));
T('★★★ 목록 한 줄이 옮긴 글자를 쓴다', /function trRow\(/.test(src));

// ── 세 목록이 다 걸려 있나
[['community','글판'],['spots','정박지'],['market','중고 장터']].forEach(([c, 이름])=>{
  T('★★★ ' + 이름 + ' 목록이 줄을 세운다', new RegExp("trListAuto\\('" + c + "'").test(src));
  T('★★★ ' + 이름 + ' 목록 제목이 옮긴 것을 쓴다', new RegExp("trRow\\('" + c + "'").test(src));
});

// ── 돈이 새지 않는가
{
  const f = grab(src, 'trListAuto');
  T('★★★ 앞쪽 몇 줄만 부른다 (화면 밖까지 다 부르면 헛돈이다)', /slice\(0, TR_LIST_MAX\)/.test(f), f.slice(0,200));
  const m = src.match(/const TR_LIST_MAX = (\d+)/);
  const v = m ? Number(m[1]) : 0;
  T('★★★ 그 수가 실제로 적다 (지금 ' + v + '줄)', v > 0 && v <= 30, v);
  T('★★★ 이미 옮긴 것은 다시 안 부른다', /TR_GOT\[key \+ ':' \+ langNow\(\)\]/.test(f));
  T('★★★ 「원어로 보기」 를 누른 글은 그대로 둔다', /TR_SKIP\[key\]/.test(f));
}
// ★ 앱에 든 정박지·나라 꾸러미는 서버에 글이 없다. 부르면 값만 들고 못 받는다.
T('★★★ 앱에 든 정박지는 안 부른다 (서버에 글이 없다)',
  /trListAuto\('spots', rows\.filter\(s => !s\.seed\)/.test(src));

// ── 목록을 보고 있는데 글이 저 혼자 열리면 안 된다
{
  const f = grab(src, 'trRepaint');
  T('★★★ 열려 있는 글만 다시 연다 (글판)',
    /String\(talkOpenId \|\| ''\) === String\(id\)/.test(f), f.slice(0,300));
  T('★★★ 열려 있는 글만 다시 연다 (장터)', /String\(marketOpenId \|\| ''\) === String\(id\)/.test(f));
  T('★★★ 열려 있는 글만 다시 연다 (정박지)', /String\(spotOpenId \|\| ''\) === String\(id\)/.test(f));
  T('★★ 안 열려 있으면 목록만 다시 그린다', /renderTalk\(\)/.test(f) && /renderSpots\(\)/.test(f) && /renderMarket\(\)/.test(f));
}

// ── 실제로 돌려 본다
{
  const env = `
    let langCur = 'ja';
    const langNow = () => langCur;
    const TR_ON = {}, TR_GOT = {}, TR_BUSY = {}, TR_SKIP = {};
    ${(src.match(/const TR_LIST_MAX = [^;]+;/)||['const TR_LIST_MAX = 0;'])[0]}
    ${grab(src,'trKey')}
    ${grab(src,'trPick')}
    ${grab(src,'trView')}
    ${grab(src,'trRow')}
    let 부른것 = [];
    const trAuto = (coll, id, s) => { 부른것.push(id); };
    ${grab(src,'trListAuto')}
    return { trListAuto, trRow, 부른것:()=>부른것, 비우기:()=>{부른것=[];},
             TR_GOT, TR_ON, TR_SKIP, TR_LIST_MAX };`;
  const F = new Function(env)();
  const 줄 = [];
  for(let i = 0; i < 40; i++) 줄.push({ id:'p'+i, title:'로프 스토퍼 어디서 사나요' });

  F.trListAuto('community', 줄, r => r.title);
  T('★★★ 앞쪽만 실제로 부른다 (' + F.부른것().length + '개 / 40줄)',
    F.부른것().length === F.TR_LIST_MAX, F.부른것().length);

  F.비우기();
  F.TR_GOT['community:p0:ja'] = { title:'ロープストッパーはどこで買えますか' };
  F.trListAuto('community', 줄, r => r.title);
  T('★★★ 이미 옮긴 줄은 다시 안 부른다', F.부른것().indexOf('p0') < 0, F.부른것().slice(0,4));
  T('★★★ 옮긴 것이 있으면 목록에 그것이 나온다',
    F.trRow('community','p0','title','로프 스토퍼 어디서 사나요') === 'ロープストッパーはどこで買えますか',
    F.trRow('community','p0','title','원문'));
  T('★★★ 옮긴 것이 없으면 원문이 나온다 (제목 없는 줄이 생기면 안 된다)',
    F.trRow('community','p9','title','로프 스토퍼 어디서 사나요') === '로프 스토퍼 어디서 사나요');

  F.비우기();
  F.TR_SKIP['community:p1'] = true;
  F.trListAuto('community', 줄, r => r.title);
  T('★★★ 「원어로 보기」 를 누른 줄은 안 부른다', F.부른것().indexOf('p1') < 0);

  F.비우기();
  F.trListAuto('community', [{ id:'x1', title:'' }], r => r.title);
  T('★★ 빈 제목은 안 부른다 (옮길 글자가 없다)', F.부른것().length === 0);
}
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
