// 파일 내보내기 검사 — 앱에서도 진짜로 받아지는가
//
// ★ 왜 만들었나
//   웹에서는 <a download> 로 잘 받아졌다. 앱에서는 눌러도 아무 일이 없었다.
//   웹뷰에는 받은 파일을 넘길 곳이 없기 때문이다. 아무 말도 안 하고 조용히 아무 일이 없었다 —
//   가장 나쁜 종류의 실패다.
const fs = require('fs');
const SRC = process.argv[2] || 'work.html';
const h = fs.readFileSync(SRC, 'utf8');
let pass = 0, fail = 0;
const t = (n, ok) => { ok ? pass++ : (fail++, console.log('★ 실패:', n)); };
function fn(name){
  let i = h.indexOf('async function ' + name + '(');
  if(i < 0) i = h.indexOf('function ' + name + '(');
  if(i < 0) return '';
  let d = 0, st = false;
  for(let j = i; j < h.length; j++){
    const c = h[j];
    if(c === '{'){ d++; st = true; }
    else if(c === '}'){ d--; if(st && d === 0) return h.slice(i, j + 1); }
  }
  return h.slice(i);
}

// ── 1. 문 하나
t('내보내는 문이 하나다', !!fn('saveFile'));
t('a.download 를 쓰는 곳이 그 문 하나뿐이다',
  (h.match(/\.download = /g) || []).length === 1 && /\.download = name;/.test(fn('saveFile')));
// 5.0: 내보내기가 saveHere(폰 안 「뱃일」 칸에 넣기) → saveFile(브라우저 받기) 로 두 겹이 되었다.
//      백업은 여전히 그 한 줄기를 지나야 한다.
t('백업이 그 문을 지난다', /await saveHere\('backup', name, 'application\/json'/.test(fn('backupData')));
t('그 줄기가 결국 내보내는 문 하나로 모인다', /await saveFile\(name, mime, text\)/.test(fn('saveHere')));

// ── 2. 앱과 웹을 갈라 본다
t('앱인지 먼저 본다', /if\(!isNative\(\) \|\| !F\)/.test(fn('saveFile')));
t('앱에서는 파일 부품으로 쓴다', /F\.writeFile\(/.test(fn('saveFile')));
t('쓴 자리를 물어본다', /F\.getUri\(/.test(fn('saveFile')));
t('어디에 넣을지 사람에게 묻는다', /S\.share\(\{ title: name, files: \[u\.uri\] \}\)/.test(fn('saveFile')));
// ★ 안드로이드 11부터 앱이 다운로드 폴더에 마음대로 못 쓴다. 잠깐 두는 자리에 쓴다.
t('잠깐 두는 자리에 쓴다', /directory: 'CACHE'/.test(fn('saveFile')));
t('막힌 자리에 쓰려 하지 않는다', !/EXTERNAL_STORAGE/.test(fn('saveFile')));

// ── 3. 한글이 든 파일도 안 깨진다
t('한글을 담을 수 있게 바꾼다', !!fn('b64of') && /TextEncoder/.test(fn('b64of')));
t('큰 파일에서도 안 터진다', /0x8000/.test(fn('b64of')));
t('백업 파일 이름은 ASCII 다', /baetnil-backup-/.test(fn('backupData')));

// ── 4. ★ 조용한 실패를 만들지 않는다
t('안 되면 까닭을 돌려준다', /return String\(\(e && e\.message\) \|\| e\)/.test(fn('saveFile')));
// 5.0: 말해 주는 일은 saveHereTell 이 맡는다. 백업은 그 문을 반드시 거쳐야 한다.
t('안 되면 사람에게 말한다', /tell\(t\('파일로 저장하지 못했습니다.'\)/.test(fn('saveHereTell')));
t('백업이 그 말해 주는 문을 거친다', /saveHereTell\(await saveHere\(/.test(fn('backupData')));
t('까닭도 함께 보여 준다', /r\.why/.test(fn('saveHereTell')));
t('사람이 그만둔 것은 잘못으로 치지 않는다', /cancel\|dismiss/.test(fn('saveFile')));
t('공유 부품이 없어도 길이 있다', /directory: 'DOCUMENTS'/.test(fn('saveFile')));

// ── 5. 말
// 5.0: 조사를 앞말에 붙였다 — 「{p} 에 넣었습니다.」 → 「{p}에 넣었습니다.」
["파일로 저장하지 못했습니다.", "{p}에 넣었습니다."].forEach(k=>{
  const re = new RegExp("'" + k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + "':'[^']+'", 'g');
  t('세 나라 말 — ' + k, (h.match(re)||[]).length >= 2);
});

// ── 6. 이름 겹침
['saveFile','b64of','capPlug'].forEach(n=>{
  const c = (h.match(new RegExp('function ' + n + '\\(', 'g')) || []).length;
  t('이름이 겹치지 않는다 — ' + n, c === 1);
});

console.log(`\n${pass}/${pass+fail} 통과`);
process.exit(fail ? 1 : 0);
