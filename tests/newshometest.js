// 소식을 「내 말로 된 것」 과 「세계 것」 으로 가르는가 (4.84)
//
// ★★★ 사장님이 정하신 것
//   「지금은 러시아 소식이 외국뉴스탭에 들어가 있잖아.
//     근데 러시아어로 하면 그게 본래 자기들 뉴스탭으로 가야하잖아」
//   「그럼 오히려 자기들이랑 상관없는 한국뉴스나 일본뉴스 번역하는 번역비용도 안들테고」
//
// ★ 맞는 말씀이고, 값도 이쪽이 싸다.
//   제 말로 된 소식은 옮길 것이 아예 없다.
//   남의 말 소식을 첫 칸에 놓고 그걸 옮기는 것이 제일 비싼 구조였다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const CN = require('path').join(__dirname, '../../webout/scripts/collect_news.js');
let col = ''; try{ col = fs.readFileSync(CN, 'utf8'); }catch(_){}
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };
const grab=(js,name)=>{ for(const pre of ['function ','async function ']){
    const i=js.indexOf(pre+name+'('); if(i<0) continue;
    let d=0, st=js.indexOf('{',i);
    for(let j=st;j<js.length;j++){ if(js[j]==='{')d++; else if(js[j]==='}'){d--; if(!d) return js.slice(i,j+1);} } }
  return ''; };

// ── ① 앱이 말로 가르는가
T('★★★ 내 말로 된 소식을 골라낸다',
  /const 내소식 = \(내말 === 'ko'\) \? gov : 온것\.filter\(x => \(x\.lang \|\| 'en'\) === 내말\)/.test(src));
T('★★★ 세계 소식에서는 내 말 것을 뺀다 (두 칸에 겹쳐 나오면 안 된다)',
  /const 세계\s+= \(내말 === 'ko'\) \? 온것 : 온것\.filter\(x => \(x\.lang \|\| 'en'\) !== 내말\)/.test(src));
T('★★★ 첫 칸 이름을 고르는 문이 하나다', /function newsHomeName\(\)/.test(src));
{
  const m = src.match(/const NEWS_HOME = \{[^}]*\}/);
  const H = m ? new Function('return ' + m[0].replace('const NEWS_HOME = ','')) () : {};
  // 4.132 에서 「한국 소식」 → 「대한민국 소식」 으로 이름을 바꿨다
  [['ko','대한민국 소식'],['ja','일본 소식'],['ru','러시아 소식'],['en','영어권 소식']].forEach(([L, n])=>{
    T('★★ ' + L + ' 로 켜면 첫 칸이 「' + n + '」 이다', H[L] === n, H);
  });
}
// ★ 어느 나라 것인지 그대로 적는다 — 「내 나라 소식」 처럼 두루뭉술하면 뭐가 든지 모른다
T('★★ 첫 칸 이름이 두루뭉술하지 않다', !/'내 나라 소식'/.test(src));

// ── ② 실제로 갈리는가
{
  const 온것 = [
    { link:'a', lang:'en', title:'EN one' },
    { link:'b', lang:'ru', title:'RU one' },
    { link:'c', lang:'ja', title:'JA one' },
    { link:'d', title:'no lang' }            // 안 적힌 것은 영어로 본다
  ];
  const 가르기 = (내말, gov) => ({
    내소식: (내말 === 'ko') ? gov : 온것.filter(x => (x.lang || 'en') === 내말),
    세계:   (내말 === 'ko') ? 온것 : 온것.filter(x => (x.lang || 'en') !== 내말)
  });
  const ru = 가르기('ru', []);
  T('★★★ 러시아어로 켜면 러시아 기사가 첫 칸으로 간다',
    ru.내소식.length === 1 && ru.내소식[0].link === 'b', ru.내소식);
  T('★★★ 그때 러시아 기사는 세계 칸에 없다 (겹치지 않는다)',
    !ru.세계.some(x => x.link === 'b'), ru.세계.map(x=>x.link));
  const ja = 가르기('ja', []);
  T('★★★ 일본어로 켜면 일본 기사가 첫 칸으로 간다',
    ja.내소식.length === 1 && ja.내소식[0].link === 'c');
  const ko = 가르기('ko', [{ link:'k', title:'한국 기사' }]);
  T('★★★ 한국어로 켜면 첫 칸은 관 자료 그대로다', ko.내소식.length === 1 && ko.내소식[0].link === 'k');
  T('★★ 한국어일 때는 세계 칸에 온 것이 다 들어간다', ko.세계.length === 4);
  const en = 가르기('en', []);
  T('★★ 말이 안 적힌 기사는 영어로 본다', en.내소식.some(x => x.link === 'd'));
}

// ── ③ 자료를 모으는 쪽 — 일본 출처가 실제로 있는가
if(col){
  T('★★★ 일본어 출처를 넣었다', /bulkhead\.jp\/feed/.test(col));
  T('★★★ 그 출처에 말을 적어 두었다', /bulkhead\.jp\/feed\/',\s*lang:'ja'/.test(col));
  T('★★★ 말마다 몫을 따로 둔다 (합쳐 고르면 영어가 다 이긴다)',
    /const PICK_BY_LANG = \{[^}]*ja:/.test(col));
  T('★★★ 말마다 따로 고른다', /for\(const L of 말들\)/.test(col));
  {
    const m = col.match(/const PICK_BY_LANG = \{([^}]*)\}/);
    const P = m ? new Function('return {' + m[1] + '}')() : {};
    T('★★ 영어·러시아어·일본어 몫이 다 있다',
      P.en > 0 && P.ru > 0 && P.ja > 0, P);
  }
  // ★ 없는 출처를 지어내지 않는다
  T('★★★ 못 쓰는 출처는 왜 못 쓰는지 적어 두었다', /robots\.txt 를 못 읽어/.test(col));
}

// ── ④ 새 말이 네 나라 말에 다 들어갔는가 (하나 빠지면 그 말에서만 한국어로 남는다)
['세계 소식','대한민국 소식','일본 소식','러시아 소식','영어권 소식'].forEach(w=>{
  const n = (src.match(new RegExp("'" + w + "':", 'g')) || []).length;
  T('★★★ 「' + w + '」 이 en·ru·ja 세 사전에 다 있다 (' + n + '개)', n === 3, n);
});
console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad?1:0);
