// 3.24 — 기본 정보에서 영업 배 여부를 바꾼다
//
// 처음 등록할 때와 사정이 바뀐다. 개인 배로 타다가 낚시 손님을 받기도 하고,
// 영업을 접고 개인 배로 돌아가기도 한다.
// 그런데 이 스위치가 '공개 설정' 안쪽에만 있어서, 배를 등록한 뒤에는
// 어디서 바꾸는지 찾기가 어려웠다. 가장 먼저 보이는 기본 정보에 둔다.
//
// ★ 켜면 배 이름과 선종이 밖으로 나간다. 모르고 켜면 안 된다 — 켤 때 알려 준다.
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

// ── 1. 기본 정보에 스위치가 있다
{
  const ob = grab(js, 'openBoat') || '';
  const info = ob.slice(ob.indexOf("boatTab === 'info'"), ob.indexOf('} else {'));
  T('기본 정보 화면이 있다', info.length > 0);
  T('영업 배 줄이 있다', /영업/.test(info));
  T('눌러서 바꾼다', /setBizUI\(/.test(info));
  // ★ 지금 어느 쪽인지 글로 말해 준다. 버튼 색만으로는 모른다.
  T('지금 영업인지 아닌지 글로 말한다', /영업[^<]{0,6}배|개인[^<]{0,6}배/.test(info));
  // 권한 없는 사람에게 버튼을 보이면 눌러 보고 거절만 당한다
  T('공개 권한이 있어야 버튼이 보인다',
    /can\(b, ?'publish', ?'write'\)[\s\S]{0,240}?setBizUI\(/.test(info));
  T('무엇이 달라지는지 알려 준다', /둘러보기|영업 배로 실/.test(info));
}

// ── 2. 바꾸는 곳
{
  const f = grab(js, 'setBizUI') || '';
  T('바꾸는 곳이 있다', f.length > 0);
  T('권한을 스스로 다시 본다', /can\(.*'publish', ?'write'\)/.test(f));
  // ★ 켜면 배 이름과 선종이 밖으로 나간다. 묻지도 않고 내보내면 안 된다.
  // ★ 'confirm 이라는 글자가 있다' 로는 부족하다.
  //   묻기만 하고 답을 안 보면 아니라고 해도 그냥 공개된다.
  T('켤 때는 먼저 묻고, 아니라면 멈춘다',
    /if\(on ?&& ?!await ask\([\s\S]*?\)\) return;/.test(f));
  T('무엇이 나가는지 묻는 말에 적는다', /이름|선종/.test(f));
  // 공개 스위치를 다루는 셈은 한 벌만 있어야 한다
  T('공개 스위치는 원래 있던 곳을 쓴다', /setPub\(|setPubUI\(/.test(f));
  // ★ setPubUI 에 맡겼으면 거기가 실제로 올리는지도 봐야 한다.
  //   '맡겼다' 는 글자만 보면 맡은 쪽이 비어도 통과한다.
  const su = grab(js, 'setPubUI') || '';
  T('맡긴 곳이 화면 안에 남긴다', /saveLocal\(/.test(su));
  T('맡긴 곳이 클라우드에 올린다', /saveBoatCloud\(/.test(su));
  T('맡긴 곳이 공개본도 다시 올린다', /pushPublic\(/.test(su));
  T('맡긴 곳이 권한을 본다', /can\(b,'publish','write'\)/.test(su));
  T('바꾼 곳으로 돌아간다', /back/.test(su));
  T('바꾼 뒤 기본 정보로 돌아온다', /openBoat\('info'\)|'info'/.test(f));
}

// ── 3. 공개 설정 화면도 그대로 있다 (두 곳이 같은 값을 본다)
{
  const p = grab(js, 'openPublish') || '';
  T('공개 설정에도 영업이 남아 있다', /PUB_KEYS/.test(p));
  const k = (js.match(/const PUB_KEYS = \[[\s\S]*?\];/) || [''])[0];
  T('영업이 공개 항목에 있다', /k:'biz'/.test(k));
  // ★ 값을 두 군데에 따로 두면 한쪽만 바뀐다. pub.biz 하나만 본다.
  T('영업 여부는 pub.biz 한 곳에만 있다', !/\bb\.biz\s*=/.test(js));
  const bp = grab(js, 'buildPublic') || '';
  T('밖으로 나가는 값도 pub.biz 를 본다', /biz: ?pubOn\(b, ?'biz'\)/.test(bp));
}

// ── 4. 되돌리기 — 영업을 접을 수 있다
{
  const f = grab(js, 'setBizUI') || '';
  T('끌 때도 같은 버튼으로 끈다', /!on|on ?\? ?[\s\S]{0,120}?:/.test(f) || /setBizUI\(false\)|setBizUI\(!/.test(grab(js,'openBoat')||''));
  // 끌 때는 굳이 안 물어도 된다 — 나가는 것이 줄어드는 쪽이다
  T('끄는 것은 막지 않는다', !/if\(!on\)[\s\S]{0,60}return/.test(f));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
