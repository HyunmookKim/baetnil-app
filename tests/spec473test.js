// 4.73 — 제원 세 단계 · 연락처 칸 · 메모 공개 · 「정비 기록」 탭 없앰
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };
const grab=(js,name)=>{ const i=js.indexOf('function '+name+'('); if(i<0) return '';
  let d=0, st=js.indexOf('{',i);
  for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} }
  return ''; };

// ── ① 제원 세 단계
const L = (src.match(/const SPEC_LEVELS = \[[\s\S]*?\n\];/)||[''])[0];
T('★★★ 제원 단계가 셋이다', (L.match(/\bk:'/g)||[]).length === 3, L.slice(0,160));
['none','base','full'].forEach(k => T('★★ ' + k + ' 가 있다', L.indexOf("k:'"+k+"'") >= 0));
T('★ 말은 비공개·기본만·세부까지다',
  /name:'비공개'/.test(L) && /name:'기본만'/.test(L) && /name:'세부까지'/.test(L));
T('★★ 재는 곳이 하나다', (src.match(/function specLv\(/g)||[]).length === 1);
{
  const fn = new Function(grab(src,'specLv') + '\nreturn specLv;')();
  T('★★★ 옛 자료 — 켜 두었던 배는 「기본만」 (없던 것이 새로 나가면 안 된다)',
    fn({pub:{spec:true}}) === 'base');
  T('★★ 꺼 두었던 배는 비공개', fn({pub:{spec:false}}) === 'none' && fn({}) === 'none');
  T('★★ 「세부까지」 를 고른 배', fn({pub:{spec:'full'}}) === 'full');
}
{
  const sp = new Function(grab(src,'setPub') + "\nreturn setPub;")();
  const K = [{k:'spec'}];
  globalThis.PUB_KEYS = K;
  const b = {};
  T('★★ full 이라는 글자가 살아서 저장된다', (sp.call(null,b,'spec','full'),b.pub.spec) === 'full');
  T('★ 나머지는 예전처럼 참·거짓', (sp.call(null,b,'spec',true),b.pub.spec) === true);
}
// ── ② 진짜 제원이 나간다
const bp = grab(src,'buildPublic');
T('★★★ b.spec 을 내보낸다 (여태 없는 칸 b.loa 를 보고 있었다)', /const sp = b\.spec \|\| \{\};/.test(bp));
T('★★★ 「세부까지」 일 때만 나머지 칸이 나간다', /if\(specLv\(b\) === 'full'\)/.test(bp));
T('★★ 길이·폭은 spec 에서 가져온다', /o\.loa\s*=\s*sp\.loa/.test(bp) && /o\.beam\s*=\s*sp\.beam/.test(bp));
T('★★ 없는 칸을 더 이상 안 본다', !/b\.loa \|\| ''/.test(bp));
// 화면
T('★★★ 남의 배 제원이 칸 이름·단위와 함께 나온다', /BOAT_SPEC\[kk\]/.test(src));
T('★★ 이름·단위를 따로 적지 않는다 (BOAT_SPEC 에서 가져온다)',
  /Object\.keys\(BOAT_SPEC\)[\s\S]{0,200}?d\.label/.test(src));
T('★★★ 제원 화면 맨 위에 공개 줄이 있다', /body = specPubRow\(\) \+ rows/.test(src));
T('★★ 공개설정 화면도 같은 표를 쓴다', /SPEC_LEVELS\.map/.test(grab(src,'openPublish')));

// ── ③ 연락처 — 켜고 끄는 것이 있으면 적는 곳도 있다
T('★★★ 전화번호를 적는 칸이 있다', /boatField\('phone',this\.value\)/.test(src));
T('★★★ 전화번호가 클라우드에 올라간다 (BOAT_FIELDS)',
  /'phone','trkHide'/.test(src));
T('★★ 기본정보를 고치면 밖 사본도 다시 만든다', /pubRefresh\(\)/.test(grab(src,'boatField')));

// ── ④ 메모 — 남 보라고 쓴 것을 앱이 막지 않는다
// ★ 4.74 — 나가는 칸은 표(PUB_OUT) 한 곳에 적힌다.
{
  const TB = (src.match(/const PUB_OUT = \{[\s\S]*?\n\};/)||[''])[0];
  const M = (TB.match(/mlog:\s*\{[\s\S]*?\n  \}/)||[''])[0];
  const R = (TB.match(/review:\s*\{[\s\S]*?\n  \}/)||[''])[0];
  T('★★★ 정비수첩 메모가 나간다 (표에 적혀 있다)', M.includes("'note'"), M.slice(0,200));
  T('★★★ 사용기 메모도 나간다 (표에 적혀 있다)', R.includes("'note'"), R.slice(0,200));
  T('★★ 표를 실제로 쓴다', /\.\.\.pubPlain\(x, 'mlog'\)/.test(grab(src,'mlogPublic'))
                        && /\.\.\.pubPlain\(r, 'review'\)/.test(grab(src,'rvPublic')));
}
T('★★★ 정기점검 메모도 나간다', /if\(m\.note\) o\.note = m\.note;/.test(grab(src,'howPublic')));

T('★★ 정비수첩 공개 화면이 메모를 보여 준다', /trIn\('mlog', m\.id, 'note', m\.note\)/.test(src));
T('★★ 사용기 공개 화면도 보여 준다', /trIn\('review', r\.id, 'note', r\.note\)/.test(src));
T('★★★ 「메모는 나가지 않음」 이라는 거짓말이 안 남아 있다',
  !/메모는 나가지 않/.test(src), (src.match(/메모는 나가지 않[^']{0,30}/)||[])[0]);
T('★ 대신 조심하라고 말해 준다', /메모에 전화번호처럼 남에게 보이면 안 되는 것은 적지 마세요/.test(src));

// ── ⑤ 남의 배 「정비 기록」 탭
const bs = grab(src,'boatPageSecs');
T('★★★ 「정비 기록」 탭이 없다', !/'maint',t\('정비 기록'\)/.test(bs), bs.slice(-400));
T('★ 정비수첩 탭은 그대로 있다', /'mlog',t\('정비수첩'\)/.test(bs));

// ── ⑥ 사전
['en','ru','ja'].forEach(Lg=>{
  const i = src.indexOf('\n  ' + Lg + ': {'), j = src.indexOf('\n  },', i);
  const dict = i > 0 ? src.slice(i, j) : '';
  ['기본만','세부까지','제원이 밖으로 안 나갑니다.','제조사·모델·연식·길이·폭만 나갑니다.']
    .forEach(k => T(Lg + " 에 「" + k.slice(0,10) + "」 가 있다", dict.indexOf("'" + k + "'") >= 0));
});

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
