// 읽지 않고 기계가 잡아내는 번역 흠 (4.115)
//
// ★★★ 왜 이 검사가 있나 — 사장님 지적, 2026-09-08
//   「지금 반복해서 찐빠가 나는 이유가 니가 일하는 방식이 틀렸을 수도 있으니」
//
//   읽어서 찾는 방법은 **반드시 놓친다.** 3천 줄을 사람(이나 나)이 읽으면
//   앞쪽은 꼼꼼하고 뒤쪽은 느슨해진다. 실제로 검수를 여섯 갈래로 돌렸더니
//   같은 글을 보고도 갈래마다 다른 것을 찾았다. 읽기만으로는 0 에 못 간다.
//
// ★ 그래서 **읽지 않고 세어서** 잡는 길을 따로 둔다.
//   아래 것들은 뜻을 몰라도 잡힌다. 사람이 지치지 않는 자리다.
const fs = require('fs'), path = require('path');
const SRC = process.argv[2] || path.join(__dirname, '..', '..', 'work.html');
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? '\n   ' + String(w).slice(0, 420) : '')); } };
function dicts(){
  const i = src.indexOf('const I18N = {');
  let d = 0, j = src.indexOf('{', i), k;
  for(k = j; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(d === 0){ k++; break; } }
  }
  const g = {};
  (new Function('g', src.slice(i, k).replace('const I18N =', 'g.I18N =') + ';'))(g);
  return g.I18N;
}
const I = dicts();
const KEYS = Object.keys(I.en);
const LANGS = ['en','ru','ja'];

// ── ① 자리표를 잃거나 지어내지 않았는가
{
  const ph = s => (String(s).match(/\{[a-zA-Z][\w]*\}/g) || []).filter(x => x !== '{josa}').sort().join(',');
  for(const L of LANGS){
    const 걸린것 = KEYS.filter(k => ph(k) !== ph(I[L][k]));
    T('①-' + L + ' ★★★ 자리표를 잃거나 지어낸 곳이 없다 (' + 걸린것.length + '곳)',
      걸린것.length === 0, 걸린것.slice(0, 5).map(k => k.slice(0,30) + ' → ' + I[L][k]).join(' | '));
  }
}

// ── ② 꼬리표(<b> 따위)가 짝이 맞는가
{
  const tags = s => (String(s).match(/<\/?[a-z]+>/gi) || []).map(x => x.toLowerCase()).sort().join(',');
  for(const L of LANGS){
    const 걸린것 = KEYS.filter(k => tags(k) !== tags(I[L][k]));
    T('②-' + L + ' ★★★ 꼬리표가 원문과 똑같다 (' + 걸린것.length + '곳)',
      걸린것.length === 0, 걸린것.slice(0, 4).map(k => k.slice(0,30) + ' → ' + I[L][k]).join(' | '));
  }
}

// ── ③ 줄바꿈 수가 같은가 — 한 줄이 통째로 빠지면 여기서 걸린다
{
  const nl = s => (String(s).match(/\n/g) || []).length;
  for(const L of LANGS){
    const 걸린것 = KEYS.filter(k => nl(k) !== nl(I[L][k]));
    T('③-' + L + ' ★★★ 줄 수가 원문과 같다 (' + 걸린것.length + '곳)',
      걸린것.length === 0, 걸린것.slice(0, 4).map(k => JSON.stringify(k).slice(0,40) + ' → ' + JSON.stringify(I[L][k]).slice(0,60)).join(' | '));
  }
}

// ── ④ 통째로 안 옮긴 것 — 번역이 원문과 글자 그대로 같다
//   (숫자·단위·이름처럼 안 옮기는 게 맞는 것은 뺀다)
{
  for(const L of LANGS){
    const 걸린것 = KEYS.filter(k => {
      const v = String(I[L][k] == null ? '' : I[L][k]);
      if(v !== k) return false;
      // ★ 옮기지 않는 것이 맞는 것들 — 로마자·숫자·기호·자리표만으로 된 것.
      //   기계 이름(4JH4E)·배 이름(First 45f5)·틀(「{a}MB / {b}MB」)이 여기 든다.
      const 알맹이 = k.replace(/\{[a-zA-Z][\w]*\}/g, '')
                      .replace(/[A-Za-z0-9\s.,:;/%°'"+\-—–·×~()\[\]…→▸›]/g, '');
      if(알맹이 === '') return false;
      return true;
    });
    T('④-' + L + ' ★★★ 옮기지 않고 원문을 그대로 둔 곳이 없다 (' + 걸린것.length + '곳)',
      걸린것.length === 0, 걸린것.slice(0, 6).join(' | '));
  }
}

// ── ⑤ 길이가 터무니없이 다른 것 — 한 도막을 빠뜨렸거나 군말을 붙인 것이다
//   ★ 한국어 대비 일본어는 비슷, 영어·러시아어는 1.3~1.8배가 보통이다.
//     그 밖으로 크게 벗어나는 것만 잡는다. 짧은 이름표는 안 본다(비율이 요동친다).
{
  const 한도 = { en:[0.7, 4.0], ru:[0.7, 4.5], ja:[0.4, 2.2] };
  for(const L of LANGS){
    const 걸린것 = KEYS.filter(k => {
      if(k.length < 25) return false;
      const v = String(I[L][k] == null ? '' : I[L][k]);
      if(!v) return false;
      const r = v.length / k.length;
      return r < 한도[L][0] || r > 한도[L][1];
    });
    // ★ 짧은 이름표는 비율이 요동쳐서 위에서 걸렀다. 다만 **엉뚱한 글을 붙여 넣은 것**은
    //   짧은 이름표에서도 잡혀야 한다 — 이름표 하나가 문단 하나가 될 까닭이 없다.
    const 터무니 = KEYS.filter(k => {
      if(k.length >= 25) return false;
      const v = String(I[L][k] == null ? '' : I[L][k]);
      return v.length > 60 && v.length > k.length * 8;
    });
    T('⑤-' + L + '-이름표 ★★ 짧은 이름표가 문단이 되어 있지 않다 (' + 터무니.length + '곳)',
      터무니.length === 0, 터무니.slice(0, 3).map(k => k + ' → ' + I[L][k].slice(0, 60) + '…').join(' | '));
    T('⑤-' + L + ' ★★ 길이가 터무니없이 다른 곳이 없다 (' + 걸린것.length + '곳)',
      걸린것.length === 0,
      걸린것.slice(0, 4).map(k => '(' + (I[L][k].length / k.length).toFixed(2) + '배) ' + k.slice(0, 34)).join(' | '));
  }
}

// ── ⑥ 자매 낱말이 나란한가
//   ★ 「1자리·2자리·3자리」 처럼 한 줄로 늘어선 것들은 번역도 한 모양이라야 한다.
//     하나만 딴 모양이면 그것이 흠이다. 「1자리」 만 桁(자릿수)였던 것이 이 갈래였다.
{
  const 묶음 = {};
  KEYS.forEach(k => {
    const m = k.match(/^(\d+)(\D.*)$/);       // 숫자로 시작하는 자매 (1자리·2자리…)
    if(m) (묶음['숫자:' + m[2]] = 묶음['숫자:' + m[2]] || []).push(k);
  });
  for(const L of LANGS){
    const 걸린것 = [];
    Object.keys(묶음).forEach(g => {
      const ks = 묶음[g];
      if(ks.length < 3) return;
      // 번역에서 숫자를 뺀 나머지가 다 같아야 한다
      // ★ 「1 place / 2 places」 처럼 수에 따라 어미가 바뀌는 것은 흠이 아니다.
      //   그래서 숫자를 뺀 뒤 **머리 네 글자**만 견준다. 낱말 자체가 다른 것만 잡는다.
      //   (「1자리」 만 桁(자릿수)이고 나머지가 名 이던 것이 이 갈래였다)
      const 머리 = k => String(I[L][k] || '').replace(/\d+/g, '').trim().slice(0, 4);
      const 셈 = {};
      ks.forEach(k => { const b = 머리(k); 셈[b] = (셈[b] || 0) + 1; });
      const 흔한것 = Object.keys(셈).sort((a, b) => 셈[b] - 셈[a])[0];
      ks.forEach(k => { if(머리(k) !== 흔한것 && 셈[머리(k)] === 1)
        걸린것.push(k + ' → ' + I[L][k] + ' (다른 형제는 ' + 흔한것 + '…)'); });
    });
    T('⑥-' + L + ' ★★ 나란한 낱말 중 혼자 딴 모양인 것이 없다 (' + 걸린것.length + '곳)',
      걸린것.length === 0, 걸린것.slice(0, 4).join(' | '));
  }
}

// ── ⑦ 빈 번역
{
  for(const L of LANGS){
    const 걸린것 = KEYS.filter(k => String(I[L][k] == null ? '' : I[L][k]).trim() === '' && k.trim() !== '');
    // ★ 「년」 처럼 그 말에 붙는 말이 없어서 일부러 비운 것이 있다. 몇 개인지만 못 박는다.
    T('⑦-' + L + ' ★★ 일부러 비운 것 말고 빈 번역이 없다 (' + 걸린것.length + '곳)',
      걸린것.length <= 3, 걸린것.join(' | '));
  }
}

// ── ⑧ 사전 열쇠 수가 세 말 다 같은가 (하나라도 빠지면 그 말만 한국어로 나간다)
{
  T('⑧ ★★★ 세 사전의 열쇠 수가 같다',
    Object.keys(I.en).length === Object.keys(I.ru).length
    && Object.keys(I.en).length === Object.keys(I.ja).length,
    Object.keys(I.en).length + ' / ' + Object.keys(I.ru).length + ' / ' + Object.keys(I.ja).length);
  for(const L of ['ru','ja']){
    const 빠진것 = KEYS.filter(k => I[L][k] === undefined);
    T('⑧-' + L + ' ★★★ 영어에 있는 열쇠가 다 있다', 빠진것.length === 0, 빠진것.slice(0, 4).join(' | '));
  }
}

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
