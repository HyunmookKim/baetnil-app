// 번역 — 서버가 뽑는 모양과 앱이 도로 끼우는 모양이 맞물리는가.
//
// ★ 왜 이 검사가 있나
//   서버(fn/functions/index.js)는 덩이 배열에서 글자를 뽑아 빈 줄로 이어 보내고,
//   앱(work.html)은 그것을 빈 줄로 갈라 덩이에 도로 끼운다.
//   두 곳이 따로 있어서 한쪽만 고치면 글이 사진과 한 칸씩 엇갈려 붙는다 —
//   화면은 멀쩡해 보이는데 내용이 뒤섞인다. 그런 탈은 눈으로 못 잡는다.
//   그래서 두 함수를 진짜 파일에서 꺼내 와 맞물려 돌려 본다.
const fs = require('fs'), path = require('path');
const APP = process.argv[2] || 'work.html';
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,200):''));} };

// 파일에서 함수 하나를 통째로 꺼낸다 (중괄호를 세어 끝을 찾는다)
function grab(src, head){
  const i = src.indexOf(head);
  if(i < 0) return null;
  let j = src.indexOf('{', i), d = 0, k = j;
  for(; k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d){ k++; break; } }
  }
  return src.slice(i, k);
}

const fnSrc  = fs.readFileSync(path.join(__dirname, 'fn/functions/index.js'), 'utf8');
const appSrc = fs.readFileSync(path.isAbsolute(APP) ? APP : path.join(__dirname, APP), 'utf8');

const fnPlain  = grab(fnSrc, 'function plain(');
const fnBlocks = grab(fnSrc, 'function blocksText(');
const appTr    = grab(appSrc, 'function trBlocks(');
const appBlk   = grab(appSrc, 'function blocksText(');
const appRich  = grab(appSrc, 'function richText(');

T('서버에서 뽑는 함수를 찾았다', !!fnPlain && !!fnBlocks);
T('앱에서 도로 끼우는 함수를 찾았다', !!appTr);
T('앱에서 저장할 때 뽑는 함수를 찾았다', !!appBlk && !!appRich);
if(bad){ console.log('\n통과 '+ok+' / 실패 '+bad); process.exit(1); }

const mk = (...fns) => new Function(fns.join('\n') + '\nreturn { plain: typeof plain==="function"?plain:null,'
  + ' blocksText: typeof blocksText==="function"?blocksText:null,'
  + ' trBlocks: typeof trBlocks==="function"?trBlocks:null,'
  + ' richText: typeof richText==="function"?richText:null };')();

const SRV = mk(fnPlain, fnBlocks);
const APPF = mk(appRich, appBlk, appTr);

// 사람이 실제로 쓸 법한 소개 — 글·사진·영상·소제목·목록이 섞여 있다
const INTRO = [
  { t:'text',  v:'첫 문단입니다.' },
  { t:'photo', v:'https://x/1.jpg' },
  { t:'head',  h:1, v:'<b>둘째 마디</b>' },
  { t:'video', v:'https://youtu.be/aaa' },
  { t:'list',  items:['하나','둘'] },
  { t:'text',  v:'마지막 문단입니다.' }
];

// 서버가 뽑는다 → 옮긴다(줄 모양은 그대로 둔다) → 앱이 도로 끼운다
const pulled = SRV.blocksText(INTRO);
const pieces = pulled.split(/\n{2,}/);
const moved  = pieces.map((p,i)=> i === 2 ? '· <2a>\n· <2b>' : ('<' + i + '>')).join('\n\n');
const back   = APPF.trBlocks(INTRO, moved);

T('사진·영상은 뽑지 않는다',
  pulled.indexOf('1.jpg') < 0 && pulled.indexOf('youtu') < 0, pulled);
T('꼬리표를 떼고 뽑는다', pulled.indexOf('<b>') < 0 && pulled.indexOf('둘째 마디') >= 0, pulled);
T('글자 덩이 수만큼 조각이 나온다', pieces.length === 4, { pieces });
T('도로 끼운 덩이 수가 원래와 같다', back.length === INTRO.length, { n: back.length });

const kinds = back.map(b=>b.t).join(',');
T('사진·영상이 제자리에 남는다', kinds === 'text,photo,head,video,list,text', kinds);
T('사진 주소가 안 바뀐다', back[1].v === 'https://x/1.jpg', back[1]);
T('영상 주소가 안 바뀐다', back[3].v === 'https://youtu.be/aaa', back[3]);

// 덩이마다 어떤 조각이 들어갔는지 (목록은 항목을 이어서 본다)
const got = back.filter(b=>b.t!=='photo' && b.t!=='video')
  .map(b => b.t === 'list' ? (b.items||[]).join('+') : b.v);
T('글자가 한 칸도 안 밀린다', got.join('|') === '<0>|<1>|<2a>+<2b>|<3>', got);
T('목록은 목록으로 돌아온다',
  back[4].t === 'list' && (back[4].items||[]).join('+') === '<2a>+<2b>', back[4]);

// 커뮤니티·연재는 저장할 때 앱이 뽑아 둔 body 를 쓴다.
// 서버가 그 body 를 옮겨 보내므로, 앱의 blocksText 와 조각 수가 같아야 한다.
const POST = [
  { t:'text', v:'가나다' },
  { t:'photo', v:'p' },
  { t:'head', h:1, v:'라마' },
  { t:'text', v:'바사' }
];
const appBody = APPF.blocksText(POST);
const appPieces = appBody.split(/\n{2,}/);
T('앱이 저장한 본문 조각 수 = 글자 덩이 수', appPieces.length === 3, appPieces);
const back2 = APPF.trBlocks(POST, appPieces.map((p,i)=>'#'+i).join('\n\n'));
T('저장본을 도로 끼워도 안 밀린다',
  back2.map(b=>b.t==='photo'?'P':b.v).join('|') === '#0|P|#1|#2',
  back2.map(b=>b.t==='photo'?'P':b.v));

// 문단 사이를 한 줄 띄운 글 — 사람이 제일 흔하게 쓰는 모양이다.
// ★ 덩이 안의 빈 줄을 안 없애면 조각이 하나 더 생겨 그 뒤가 통째로 밀린다.
const GAP = [
  { t:'text', h:1, v:'첫 줄<br><br>띄운 줄' },
  { t:'photo', v:'p' },
  { t:'text', v:'끝 줄' }
];
const gapText = APPF.blocksText(GAP);
T('덩이 안에는 빈 줄이 없다', gapText.split(/\n{2,}/).length === 2, gapText);
T('서버도 빈 줄을 없앤다', SRV.blocksText(GAP) === gapText,
  { 서버: SRV.blocksText(GAP), 앱: gapText });
const gapBack = APPF.trBlocks(GAP, gapText.split(/\n{2,}/).map((x,i)=>'@'+i).join('\n\n'));
T('빈 줄이 있어도 안 밀린다',
  gapBack.map(b=>b.t==='photo'?'P':b.v).join('|') === '@0|P|@1',
  gapBack.map(b=>b.t==='photo'?'P':b.v));

// 조각 수가 안 맞을 때 — 억지로 끼우지 않고 통째로 한 덩이로 낸다
const odd = APPF.trBlocks(GAP, 'A\n\nB\n\nC\n\nD');
T('조각 수가 다르면 억지로 안 끼운다',
  odd.length === 2 && odd[0].t === 'text' && odd[0].v.indexOf('A') >= 0 && odd[1].t === 'photo',
  odd);

// 서버가 뽑는 모양과 앱이 뽑는 모양이 같아야 한다 — 목록 앞의 · 까지 같아야 한다.
// ★ 여기가 어긋나면 조각 수는 맞는데 글자만 달라져서 아무 검사에도 안 걸린다.
//   ('영상' 은 게시글에 없으므로 빼고 견준다 — 앱의 blocksText 는 소개용이 아니다)
const BOTH = [
  { t:'text', v:'가나다' },
  { t:'photo', v:'p' },
  { t:'head', h:1, v:'<b>라마</b>' },
  { t:'list', items:['하나','둘'] },
  { t:'text', v:'바사' }
];
T('서버와 앱이 같은 모양으로 뽑는다', SRV.blocksText(BOTH) === APPF.blocksText(BOTH),
  { 서버: SRV.blocksText(BOTH), 앱: APPF.blocksText(BOTH) });

console.log('\n통과 ' + ok + ' / 실패 ' + bad);
process.exit(bad ? 1 : 0);
