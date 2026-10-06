// 5.41 — 일정(scheds)이 기록이 빠지지 않게 모든 자리에 이어져 있는가
// 사장님 (2026-10-06): 「내가 멋대로 추가하고 싶은 거는 아예 추가를 못 하게 되어 있네」 → 「그냥 일정이라고 해라」 · 「완료표시는 없이해라」
// ★ 새 저장 칸은 손으로 나열된 스무 자리를 다 거쳐야 한다. 한 곳만 빠져도 기록이 조용히 사라진다(rvtest 와 같은 꼴로 지킨다).
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2] || path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); } else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + String(w).slice(0, 200) : '')); } };

T('판 5.41', /const APP_VER = '5\.41';/.test(src));
['BOAT_DATA', 'SYNC_COLLS', 'CO'].forEach(nm => {
  const m = src.match(new RegExp('const ' + nm + ' = \\[[\\s\\S]*?\\];'));
  T('★★ ' + nm + ' 에 scheds 가 있다', !!m && /'scheds'/.test(m[0]), m && m[0].slice(0, 200));
});
T('★★ 클라우드에서 배를 지울 때도 지운다 (colls)', /'reviews','scheds','meta'\]/.test(src));
T('★★ 동기화가 이 배열을 집는다 (localColl)', /case 'scheds':\s*return scheds;/.test(src));
T('★★ 받아온다 (pullInto)', /scheds\s*= pullInto\('scheds',\s*r\.scheds\)/.test(src) && /r\.scheds\s*= g\('scheds'\)/.test(src));
T('★★ 받은 자국을 찍는다', /scheds:r\.scheds/.test(src) && /lastCloudSC = snapOf/.test(src));
T('★★ 올린다 (setSC/delSC → scheds)', /\['set','scheds'/.test(src) && /\['del','scheds'/.test(src) && /setSC:'scheds', delSC:'scheds'/.test(src)
  && /setRV, delRV, setSC, delSC\}/.test(src));
T('★★ 못 올렸으면 기준값을 안 갱신한다', /if\(ok\('scheds'\)\)/.test(src));
T('★★ 권한 — 클라우드 규칙의 「위에 없는 컬렉션」 문(배 정보 쓰기)과 같다', /scheds:'boat'/.test(src) && /sched:'boat' \}/.test(src));
T('★ 사람에게 보일 이름이 있다', /scheds:t\('일정'\)/.test(src));
T('★★ 기기에 저장·읽기 (IndexedDB · localStorage)', /idbSet\(bkey\('scheds'\), scheds\)/.test(src) && /scheds  = await get\('scheds', \[\]\)/.test(src)
  && /localStorage\.setItem\('bt_scheds'/.test(src) && /localStorage\.getItem\('bt_scheds'\)/.test(src));
T('★★ 백업에 들어가고 복원된다', /scheds:scheds/.test(src) && /Array\.isArray\(data\.scheds\)\) scheds = data\.scheds/.test(src));
T('★ 휴지통에서 되살아난다', /e\.kind==='sched'\) scheds\.push/.test(src));
T('★ 휴지통 갈래 「달력」', /sched:'cal'/.test(src) && /\{ k:'cal',\s*n:'달력' \}/.test(src));
T('★ 지운 표를 보고 되살리지 않는다 (deadIds)', /scheds:\['sched'\]/.test(src));
T('★ 기록 찾기 (DS)', /sched:\(\)=>scheds/.test(src));
T('★ 새 배는 빈 일정으로 시작한다', /mrTrash=\[\]; scheds=\[\];/.test(src));
// 화면
T('달력 날짜에 「+ 일정」', /calAdd\('sched'\)">\$\{esc\(t\('\+ 일정'\)\)\}/.test(src));
T('일정 창 칸: 제목·날짜·시각·반복', /kind==='sched'\)\{[\s\S]{0,400}tf\('제목','title'[\s\S]{0,80}tf\('날짜','date'[\s\S]{0,80}hmRow\('시각'[\s\S]{0,200}t\('반복'\)/.test(src));
{ const a = src.indexOf("} else if(kind==='sched'){"), z = src.indexOf("} else if(kind==='vdoc'){", a);
  const 몸 = src.slice(a, z).replace(/\/\/[^\n]*/g, "");   // 설명 글은 뺀다
  T('★ 완료 표시가 없다 (사장님 「완료표시는 없이해라」)', a > 0 && z > a && !/완료/.test(몸), 몸.slice(0, 300)); }
T('제목 없이 저장하지 않는다', /kind === 'sched' && !String\(it\.title \|\| ''\)\.trim\(\)\) return \{ key:'title', msg:'제목을 입력해 주세요' \}/.test(src));
T('반복은 구글 캘린더와 같은 다섯 갈래', /SCHED_REP = \[ \{ v:'', n:'반복 안 함' \}, \{ v:'d', n:'매일' \}, \{ v:'w', n:'매주' \},\s*\{ v:'m', n:'매월' \}, \{ v:'y', n:'매년' \} \]/.test(src));
// 사전
const I = src.indexOf('const I18N = {');
const blk = src.slice(I, src.indexOf('\n};', I));
['+ 일정', '일정', '제목을 입력해 주세요'].forEach(w => {
  const n = (blk.match(new RegExp("'" + w.replace(/[+]/g, '\\+') + "':'", 'g')) || []).length;
  T('사전 영·러·일에 「' + w + '」 가 있다', n === 3, n);
});
T('일본어 「일정」 은 「예정」(予定) 과 겹치지 않는다', /'일정':'イベント'/.test(src) && /'예정':'予定'/.test(src));

console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
process.exit(bad ? 1 : 0);
