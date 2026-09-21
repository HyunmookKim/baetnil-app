// 3.22 — 명부에서 등급 바꾸기 · 등급 요약 · 로그인 화면
//
// 브라우저로 세 화면을 눌러 보고 찾은 것
//  1) 회원 명부에서 사람의 등급을 바꿀 길이 아예 없었다.
//     assignRank 함수는 있는데 화면에 버튼이 없다.
//     어머니를 크루에서 정비 담당으로 올리려면 방법이 없었다.
//     내보내기도 마찬가지다.
//  2) 등급 요약이 "없음 5 · 보기 10 · 쓰기 2" 처럼 숫자뿐이라
//     이 등급이 무엇을 할 수 있는 등급인지 알 수 없었다.
//  3) 로그인 화면에서 이메일 가입이 작은 글씨로 묻혀 있었다.
//     gmail 없는 분들이 들어올 유일한 길인데 눈에 안 띄었다.
// 사전은 앱 안에 있다. 검사는 함수만 떼어 돌리므로 그대로 돌려주는 가짜를 쓴다.
globalThis.t = globalThis.t || (x => x);
globalThis.tsub = globalThis.tsub || ((k, v) => { let o = String(k);
  for(const n in v) o = o.split('{'+n+'}').join(String(v[n] == null ? '' : v[n])); return o; });
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

// ── 1. ★ 명부에서 등급을 바꿀 수 있다
{
  const r = grab(js, 'openRoster') || '';
  T('명부 화면이 있다', r.length > 0);
  T('등급 바꾸는 버튼이 있다', /pickRank\(|assignRankUI\(/.test(r));
  T('내보내는 버튼이 있다', /removeMemberUI\(/.test(r));
  // ★ 아무나 바꾸면 안 된다. 구성원 관리 권한이 있어야 버튼이 보인다.
  T('권한이 있어야 그 버튼이 보인다', /can\(b, ?'members', ?'write'\)/.test(r));
  const pr = grab(js, 'pickRank') || '';
  T('등급 고르는 곳이 있다', pr.length > 0);
  T('나보다 낮은 등급만 준다', /myPos\(/.test(pr));
  T('고른 뒤 실제로 등급을 매긴다', /assignRank\(/.test(pr));
  T('바꾼 뒤 클라우드에 올린다', /saveBoatCloud\(/.test(pr));
  const rm = grab(js, 'removeMemberUI') || '';
  T('내보내기 전에 묻는다', /ask\(/.test(rm));
  T('내보낸 뒤 클라우드에 올린다', /saveBoatCloud\(/.test(rm));
  // 안 보이게만 하면 보안이 아니다 — 손대는 곳도 다시 본다
  T('등급 매기기가 스스로 권한을 본다', /canTouchMember\(/.test(grab(js, 'assignRank') || ''));
  T('내보내기가 스스로 권한을 본다', /canTouchMember\(/.test(grab(js, 'removeMember') || ''));
}

// ── 2. ★ 등급 요약이 '무엇을 할 수 있나' 를 말해 준다
{
  const f = grab(js, 'rankSummary') || '';
  T('등급 요약이 있다', f.length > 0);
  let out = null, err = '';
  if(f){
    try{
      const P = (js.match(/const PERMS = \[[\s\S]*?\];/) || [''])[0];
      const O = (js.match(/const PERM_ORDER = \{[\s\S]*?\};/) || [''])[0];
      const po = grab(js, 'permOf') || '';
      const fn = new Function(P + '\n' + O + '\n' + po + '\n' + f + '\n return rankSummary;')();
      out = {
        선주: fn({ owner:true }),
        정비: fn({ perms:{ maint:'write', stow:'write', voyage:'view', board:'view' } }),
        손님: fn({ perms:{ board:'view' } }),
        빈것: fn({ perms:{} })
      };
    }catch(e){ err = e.message; }
  }
  T('등급 요약을 돌렸다' + (err ? ' — ' + err : ''), !!out);
  if(out){
    T('선주는 모든 권한 — ' + out.선주, /모든 권한/.test(out.선주));
    // ★ 숫자만 늘어놓으면 아무도 못 읽는다. 이름이 나와야 한다.
    T('할 수 있는 일을 이름으로 말한다 — ' + out.정비,
      /정비|적재표/.test(out.정비) && /쓰기/.test(out.정비));
    T('숫자만 늘어놓지 않는다', !/^없음 \d+ · 보기 \d+/.test(out.정비));
    T('볼 수만 있는 것도 알려 준다 — ' + out.손님, /보기/.test(out.손님));
    T('아무것도 못 하면 그렇게 말한다 — ' + out.빈것, /없/.test(out.빈것));
    T('너무 길면 줄인다', out.정비.length < 60);
  } else fail += 6;
}

// ── 3. 로그인 화면 — gmail 없는 사람의 길
{
  const w = grab(js, 'openWelcome') || '';
  T('처음 화면이 있다', w.length > 0);
  T('이메일 가입이 큰 버튼이다', /mrbtn big[^`]{0,120}?openAccount\(\)/.test(w));
  T('구글이 없어도 된다고 알려 준다', /구글|Google 계정이 없|아무 이메일/.test(w));
  const a = grab(js, 'openAccount') || '';
  T('계정 화면에 회원가입이 있다', /doEmail\(true\)/.test(a));
  T('회원가입이 무엇인지 알려 준다', /가입|처음/.test(a));
}

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
