// 공개 단계 — 세 단어(공개·일부 공개·비공개)와 그 뜻이 실제로 맞는가
// ★ 4.72. 사장님이 「단어를 네 멋대로 짓지 말고 다른 앱을 확인하라」 하신 것을 못 박는다.
//   유튜브가 같은 세 갈래에 쓰는 말이다 (Google 고객센터 157177).
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w?' — '+w:''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

// ── 1. 표는 하나뿐이고, 세 단어다
const tb = (src.match(/const PUB_LEVELS = \[[\s\S]*?\n\];/)||[''])[0];
T('공개 단계 표가 있다', !!tb);
T('표는 하나뿐이다', (src.match(/const PUB_LEVELS = \[/g)||[]).length === 1);
T('세 갈래다', (tb.match(/\{ k:/g)||[]).length === 3);
T("단어가 '공개' 다",       /name:'공개'/.test(tb));
T("단어가 '일부 공개' 다",  /name:'일부 공개'/.test(tb));
T("단어가 '비공개' 다",     /name:'비공개'/.test(tb));

// ★ 지어낸 말이 되살아나지 않게 못 박는다
["'커뮤니티에 올라갑니다'", "'내 배에 들어온 사람만'", "'나만 봅니다'"].forEach(w =>
  T('지어낸 말 ' + w + ' 가 표에 없다', tb.indexOf(w) < 0));

// ── 2. 열쇠말은 그대로여야 한다 — 바꾸면 이미 저장된 단계가 날아간다
['com','boat','none'].forEach(k =>
  T("열쇠말 '" + k + "' 가 그대로 있다", tb.indexOf("k:'" + k + "'") >= 0));

// ── 3. 세 갈래가 같은 문을 쓴다
T('항해일지가 같은 줄을 쓴다', /pubLvRow\('voyage'/.test(src));
T('정비수첩이 같은 줄을 쓴다', /pubLvRow\('mlog'/.test(src));
T('리뷰가 같은 줄을 쓴다',     /pubLvRow\('review'/.test(src));
T('공개 줄을 만드는 곳은 하나다', (src.match(/function pubLvRow\(/g)||[]).length === 1);
T('단계를 바꾸는 곳도 하나다',    (src.match(/function pubLvSet\(/g)||[]).length === 1);
T('단계를 바꾸면 밖 사본을 다시 만든다', /pubRefresh\(\);/.test(grab(src,'pubLvSet')));
T('단계를 바꾸면 클라우드에도 올린다',   /schedulePush\(\)/.test(grab(src,'pubLvSet')));
T('잠겨 있으면 못 바꾼다', /if\(!it \|\| !unlocked\) return;/.test(grab(src,'pubLvSet')));

// 게시물 설정은 위에 — 리뷰 화면 첫 줄이 공개 줄이다
const rb = grab(src,'rvBody');
T('리뷰도 공개 줄이 맨 위다',
  rb.indexOf("pubLvRow('review'") >= 0 && rb.indexOf("pubLvRow('review'") < rb.indexOf("t('제조사')"));

// ── 4. 밖으로 내보낼 때 단계를 싣는다
const mp = grab(src,'mlogPublic'), rp = grab(src,'rvPublic'), bp = grab(src,'buildPublic');
T('정비수첩은 「비공개」 만 안 나간다', /mlogLv\(x\) === 'none'/.test(mp));
T('정비수첩이 단계를 싣는다', /lv: mlogLv\(x\)/.test(mp));
T('리뷰가 단계를 싣는다',     /lv: rvLv\(r\)/.test(rp));
T('「비공개」 리뷰는 사본에 아예 안 담긴다', /rvLv\(r\) !== 'none'/.test(bp));
T('「비공개」 항해는 사본에 아예 안 담긴다', /voyLv\(v\) !== 'none'/.test(bp));
T('항해가 단계를 싣는다', /lv: voyLv\(v\)/.test(bp));

// ── 5. 커뮤니티 목록은 「공개」 만 싣는다
const er = grab(src,'expRows');
T('목록이 항해를 단계로 거른다', (er.match(/\(o\.r\.lv \|\| 'com'\) === 'com'/g)||[]).length >= 1);
T('목록이 정비수첩·리뷰도 단계로 거른다', (er.match(/\(o\.r\.lv \|\| 'com'\) === 'com'/g)||[]).length === 3);

// ── 6. 실제로 돌려 본다 — 옛 기록이 판을 올렸다고 달라지면 안 된다
{
  const fn = src.match(/function pubLvOf\([\s\S]*?\n\}/)[0];
  const lv = new Function('PUB_LEVELS', fn +
    "; return { pubLvOf, voy:it=>pubLvOf(it,'com'), mlog:it=>pubLvOf(it,'none'), rv:it=>pubLvOf(it,'com') };")
    (JSON.parse(JSON.stringify([{k:'com'},{k:'boat'},{k:'none'}])));
  T('옛 항해(아무것도 안 정함)는 그대로 공개', lv.voy({}) === 'com');
  T('옛 항해(pub:false)는 비공개',            lv.voy({pub:false}) === 'none');
  T('옛 정비수첩(안 켬)은 비공개',            lv.mlog({}) === 'none');
  T('옛 정비수첩(켬)은 공개',                 lv.mlog({pub:true}) === 'com');
  T('옛 리뷰는 그대로 공개',                  lv.rv({}) === 'com');
  T('4.70 에 정해 둔 「boat」 가 살아 있다',   lv.voy({pubLv:'boat'}) === 'boat');
  T('정한 단계가 옛 pub 보다 세다',           lv.voy({pubLv:'none', pub:true}) === 'none');
  T('모르는 글자는 옛 방식으로 떨어진다',     lv.voy({pubLv:'zzz'}) === 'com');
}

// ── 7. 네 나라말이 다 있어야 한다 — 하나라도 비면 그 화면만 한국어로 남는다
{
  const need = ['일부 공개','비공개','공개',
    '남의 배 목록에 실립니다. 아무나 찾아봅니다.',
    '목록에는 안 실립니다. 내 배를 찾아 들어온 사람은 봅니다. 가입도 필요 없습니다.',
    '밖으로 안 나갑니다. 배 안에서는 등급대로 보입니다.',
    '공개해도 메모와 산 값은 나가지 않습니다. 절차·사진·난이도·걸린 시간·든 돈만 나갑니다.'];
  ['en','ru','ja'].forEach(L=>{
    const i = src.indexOf('\n  ' + L + ': {');
    const j = src.indexOf('\n  },', i);
    const dict = i > 0 ? src.slice(i, j) : '';
    T(L + ' 사전을 찾았다', !!dict);
    need.slice(0,6).forEach(k =>
      T(L + " 에 「" + k.slice(0,14) + "」 가 있다", dict.indexOf("'" + k + "'") >= 0));
  });
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
