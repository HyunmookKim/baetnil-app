// 사전을 안 거치고 화면으로 나가는 한국어가 다시 생기지 않게 막는다.
//
// ★ 왜 이 검사가 있나
//   langsweep·misskey 는 '화면을 열어 보고' 남은 한국어를 찾는다. 그래서
//   GPS 콜백·로그인 오류·클라우드 실패처럼 검사가 한 번도 안 밟는 자리는 영영 안 걸린다.
//   그렇게 76곳이 살아남아 있었다 — 그중 18개가 로그인 화면이었다.
//   외국 사람이 앱을 켜서 제일 먼저 만나는 화면인데.
//
//   여기서는 화면을 여는 대신 글자 하나하나를 읽어서, 화면으로 바로 나가는
//   자리(innerHTML·textContent·new Error)에 한국어가 그대로 있는지 본다.
const fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');

// ── 사전·약관 덩이는 본디 한국어다. 건너뛴다.
const skip = [];
for(const m of ['const I18N = {', 'const LEGAL_DOCS = {', 'const LEGAL_DOCS_EN = {', 'const LEGAL_DOCS_RU = {']){
  const i = src.indexOf(m);
  if(i >= 0) skip.push([i, src.indexOf('\n};', i) + 3]);
}
const inSkip = i => skip.some(([a,b]) => i >= a && i < b);

// ── 글자만 뽑는다 (주석·정규식은 건너뛴다, 템플릿의 ${…} 는 코드라 지운다)
const KOR = /[가-힣]/;
const found = [];
for(let i = 0; i < src.length; ){
  const c = src[i];
  if(c === '/' && src[i+1] === '/'){ const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
  if(c === '/' && src[i+1] === '*'){ const j = src.indexOf('*/', i); i = j < 0 ? src.length : j+2; continue; }
  if(c === "'" || c === '"' || c === '`'){
    const q = c; let j = i+1, buf = '';
    while(j < src.length){
      const d = src[j];
      if(d === '\\'){ j += 2; continue; }
      if(q === '`' && d === '$' && src[j+1] === '{'){
        let k = j+2, dep = 1;
        while(k < src.length && dep){ if(src[k]==='{') dep++; else if(src[k]==='}') dep--; k++; }
        j = k; continue;                       // ${…} 안은 코드다
      }
      if(d === q) break;
      if(d === '\n' && q !== '`') break;
      buf += d; j++;
    }
    if(KOR.test(buf) && !inSkip(i)) found.push({ i, txt: buf });
    i = j + 1; continue;
  }
  i++;
}

// ── 사전을 거치는 것은 뺀다
const WRAP = /(?:\b(?:t|tsub|errSay|tt)\s*\(\s*|data-t\w*\s*=\s*)$/;
// 스스로 옮기는 자리 — 부르는 쪽은 한국어 원문을 준다 (setSync 처럼)
const SINK = /(?:setSync|setHeadTitle|needEdit|guardEdit|acMsg|say)\s*\(\s*$/;
// 화면으로 바로 나가는 자리
const OUT  = /(?:innerHTML|textContent|innerText)\s*=\s*$|new Error\s*\(\s*$/;

// ★ 템플릿 한 덩이 안에 onclick="needEdit('…')" 처럼 스스로 옮기는 부름이 들어 있을 수 있다.
//   덩이 앞만 보면 그것까지 흠으로 잡힌다. 덩이 안의 한국어 토막마다 그 앞을 다시 본다.
// ★ '날씨 지점을 추가합니다.' 는 낱말 셋이지만 한 덩이다.
//   낱말마다 따로 보면 둘째·셋째 앞에는 t( 가 없어 늘 흠으로 잡힌다.
//   사이에 낀 빈칸·문장부호·숫자·로마자는 같은 덩이로 묶는다.
const korRuns = str => {
  const GLUE = /[\s.,·…()\[\]{}!?~\-—:;'"%0-9A-Za-z]/;
  const out = [];
  let i = 0;
  while(i < str.length){
    if(!/[가-힣]/.test(str[i])){ i++; continue; }
    out.push(i);                                  // 덩이 시작
    let j = i;
    while(j < str.length){
      if(/[가-힣]/.test(str[j])){ j++; continue; }
      // 뒤에 또 한글이 나오면 사이엣것은 이음이다
      let k = j;
      while(k < str.length && GLUE.test(str[k])) k++;
      if(k < str.length && /[가-힣]/.test(str[k])){ j = k; continue; }
      break;
    }
    i = j;
  }
  return out;
};
const bad = [];
for(const f of found){
  const head = src.slice(Math.max(0, f.i - 60), f.i);
  if(WRAP.test(head) || SINK.test(head)) continue;
  if(!OUT.test(head)) continue;
  // 덩이 안의 한국어가 모두 사전을 거치면 흠이 아니다
  const runs = korRuns(f.txt);
  // 덩이 '안' 에서는 따옴표가 글자로 남아 있다 (onclick="needEdit('…") — 그것까지 봐 준다
  const WRAP_IN = /(?:\b(?:t|tsub|errSay|tt)\s*\(\s*['"]?|data-t\w*\s*=\s*['"]?)$/;
  const SINK_IN = /(?:setSync|setHeadTitle|needEdit|guardEdit|acMsg|say)\s*\(\s*['"]?$/;
  const covered = runs.every(k => {
    const h = f.txt.slice(Math.max(0, k - 50), k);
    return WRAP_IN.test(h) || SINK_IN.test(h);
  });
  if(covered && runs.length) continue;
  bad.push({ line: src.slice(0, f.i).split('\n').length, txt: f.txt.replace(/\n/g,'\\n').slice(0, 70) });
}

let pass = 0, fail = 0;
const T=(n,c)=>{ if(c){pass++;console.log('통과: '+n);} else {fail++;console.log('★ 실패: '+n);} };

bad.forEach(b => console.log('★ 사전을 안 거침  ' + b.line + '  ' + b.txt));
T('화면으로 바로 나가는 한국어가 없다 — ' + bad.length + '곳', bad.length === 0);

// ── 입구가 스스로 옮기는지 (이 셋이 풀리면 수십 개가 함께 샌다)
function grab(name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){ if(src[j]==='{') d++; else if(src[j]==='}'){ d--; if(!d){ j++; break; } } }
  return src.slice(i, j);
}
T('setSync 가 스스로 옮긴다', /el\.textContent = t\(msg\)/.test(grab('setSync')));
T('acMsg 가 스스로 옮긴다', /esc\(t\(one\)\)/.test(grab('acMsg')));
T('acMsg 매개변수가 t 를 가리지 않는다', /function acMsg\(msg\)/.test(src));
T('배 등록 GPS 안내가 사전을 거친다', /const say = msg => \{[^}]*t\(msg\)/.test(src));
T('banNotice 가 스스로 옮긴다', /t\('글쓰기가 막혀 있습니다\.'\)/.test(grab('banNotice')));
T('권한 안내를 부르는 쪽이 옮긴다', !/if\(why\)\{ tell\(why\); return; \}/.test(src));

console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
process.exit(fail ? 1 : 0);
