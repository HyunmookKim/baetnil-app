// 4.99 — 새 고객센터 글이 오면 앱이 알려 준다
//
// ★ 무슨 일이 있었나 (2026-09-02)
//   관공서(admin@emsit.go.kr)에서 온 위치기반서비스 **보완 요청 두 통**이
//   앱에는 들어왔는데 지메일로는 안 갔다. 그런데 **앱도 아무 말을 안 했다.**
//   운영자 화면을 우연히 열어야만 보였다. 기한이 있는 민원을 그렇게 두면 안 된다.
//
// ★ 지메일은 구글 것이고 넘기기는 클라우드플레어 것이다. 남의 것에 기대면 또 놓친다.
//   앱은 그 두 통을 다 받았다. 그러니 **앱이 알려 주는 것**이 제일 확실하다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
let pass = 0, fail = 0;
const T = (n, c, w) => { if(c){ pass++; console.log('통과: ' + n); }
  else { fail++; console.log('★ 실패: ' + n + (w!==undefined?'\n   '+String(typeof w==='string'?w:JSON.stringify(w)).slice(0,240):'')); } };
function grab(s, name){
  // ★ async 를 먼저 찾는다. 'function x(' 를 먼저 찾으면 'async function x(' 안에서
  //   맞아 버려 async 가 잘려 나간다 — 그러면 안의 await 가 문법 오류가 된다.
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){ if(s[j]==='{') d++; else if(s[j]==='}'){ d--; if(!d){ j++; break; } } }
  return s.slice(i, j);
}

// ══ 1. 세는 문이 하나다 ═══════════════════════════════════════════
{
  T('세는 문이 있다', !!grab(src, 'supBadgeCheck'));
  T('문이 하나다', (src.match(/function supBadgeCheck\(/g) || []).length === 1);
  T('찍는 문도 하나다', (src.match(/function paintSupDot\(/g) || []).length === 1);
  const c = grab(src, 'supBadgeCheck') || '';
  T('★★★ 아직 확인 안 한 것만 센다', /filter\(x => x && !x\.done\)/.test(c), c);
  T('★★★ 운영자가 아니면 세지 않는다 (남의 접수를 읽을 일이 없다)',
    /!\(typeof isAdmin === 'function' && isAdmin\('support'\)\)/.test(c), c);
  T('★★★ 운영자가 아니면 0 으로 되돌린다 (옛 수가 남으면 안 된다)',
    /supNewN = 0; paintSupDot\(\); return 0;/.test(c), c);
  T('★★★ 못 세면 지어내지 않는다 (있던 수를 그냥 둔다)',
    /catch\(_\)\{ \/\* 못 세면 그냥 둔다/.test(c), c);
}

// ══ 2. 실제로 세어 본다 ═══════════════════════════════════════════
{
  // ★ supBadgeCheck 은 async 다. new Function 으로는 async 몸통을 못 만든다 —
  //   AsyncFunction 생성자를 써야 한다.
  const AsyncFn = Object.getPrototypeOf(async function(){}).constructor;
  const F = st => new AsyncFn('S', `
    let supNewN = 0;
    const window = { __support: S.api };
    const isAdmin = k => S.admin;
    const t = x => x;
    const document = { getElementById: id => S.el[id] || null };
    ${grab(src, 'supBadgeCheck')}
    ${grab(src, 'paintSupDot')}
    ${grab(src, 'supBadgeOn')}
    return { supBadgeCheck, supBadgeOn, now: () => supNewN };`)(st);

  const 줄 = [ { id:'a', done:false }, { id:'b', done:true },
               { id:'c' }, { id:'d', done:false } ];
  const el = { menuDot:{ classList:{ add(){ this.on = true; }, on:false } },
               dAdmin:{ textContent:'' } };
  const 만들기 = st => F(st);
  return 만들기({ admin:true, api:{ list: async () => 줄 }, el }).then(A =>
    A.supBadgeCheck().then(n => {
    T('★★★ 확인 안 한 것 셋을 센다 (done:true 하나는 뺀다)', n === 3, n);
    T('★★★ 삼선 메뉴에 점이 찍힌다', el.menuDot.classList.on === true, el.menuDot.classList);
    T('★★★ 서랍의 「운영자」 에 갯수가 적힌다', el.dAdmin.textContent === '운영자 (3)', el.dAdmin.textContent);

    const el2 = { menuDot:{ classList:{ add(){ this.on = true; }, on:false } }, dAdmin:{ textContent:'' } };
    return 만들기({ admin:false, api:{ list: async () => 줄 }, el: el2 }).then(B =>
    B.supBadgeCheck().then(n2 => {
      T('★★★ 운영자가 아니면 0 이다', n2 === 0, n2);
      T('★★★ 그때는 점도 안 찍는다', el2.menuDot.classList.on === false);
      T('★★ 「운영자」 글자에 갯수도 안 붙는다', el2.dAdmin.textContent === '운영자', el2.dAdmin.textContent);

      const el3 = { menuDot:{ classList:{ add(){ this.on = true; }, on:false } }, dAdmin:{ textContent:'' } };
      return 만들기({ admin:true, api:{ list: async () => [{ id:'x', done:true }] }, el: el3 }).then(C =>
      C.supBadgeCheck().then(n3 => {
        T('★★★ 다 확인했으면 0 이고 점도 안 찍힌다',
          n3 === 0 && el3.menuDot.classList.on === false && el3.dAdmin.textContent === '운영자', [n3, el3.dAdmin.textContent]);

        // 서버가 못 줄 때 — 있던 수를 지어내지 않는다
        const el4 = { menuDot:{ classList:{ add(){ this.on = true; }, on:false } }, dAdmin:{ textContent:'' } };
        return 만들기({ admin:true, api:{ list: async () => { throw new Error('끊김'); } }, el: el4 }).then(D =>
        D.supBadgeCheck().then(n4 => {
          T('★★★ 서버가 끊겨도 안 터진다', n4 === 0, n4);
          끝();
        }));
      }));
    }));
  }));
}

function 끝(){
  // ══ 3. 부르는 자리 ═════════════════════════════════════════════
  T('★★★ 앱을 다시 볼 때마다 센다',
    /checkNewsBadge\(\); \}\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*try\{ supBadgeCheck\(\); \}catch\(_\)\{\}/.test(src)
    || /else \{ checkNewsBadge\(\); \}[\s\S]{0,220}supBadgeCheck\(\)/.test(src), '앱이 앞으로 올 때');
  T('★★★ 운영자가 된 그때도 한 번 센다 (켠 직후에는 로그인이 늦다)',
    /supBadgeCheck\(\)/.test(grab(src, 'paintAdminMenu') || ''), grab(src, 'paintAdminMenu'));
  T('★★★ 「확인함」 을 누르면 갯수가 바로 준다 (화면이 거짓말하지 않는다)',
    /supBadgeCheck\(\)/.test(grab(src, 'supportDone') || ''), grab(src, 'supportDone'));

  // ══ 4. 뉴스 점과 싸우지 않는다 ═════════════════════════════════
  const pn = grab(src, 'paintNewsDot') || '';
  T('★★★ 뉴스가 없어도 고객센터 점은 남는다 (뉴스에 밀려 사라지면 안 된다)',
    /\(on \|\| supBadgeOn\(\)\)/.test(pn), pn);

  // ══ 5. 있는 그대로만 말한다 ════════════════════════════════════
  T('★★ 「운영자」 는 이미 있는 말이다 (새로 안 지었다)',
    src.indexOf("'운영자':") > 0 || src.indexOf('t(\'운영자\')') > 0);

  console.log('\n통과 ' + pass + ' / 실패 ' + fail);
  process.exit(fail ? 1 : 0);
}
