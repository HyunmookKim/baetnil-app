// 체크리스트 목록 기능 검증
// base.html(수정 전)에서는 함수 자체가 없으므로 '기능 없음'으로 표시된다.
const fs = require('fs');

function grab(src, name){
  const i = src.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = src.indexOf('{', i);
  for(; j < src.length; j++){
    if(src[j] === '{') d++;
    else if(src[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return src.slice(i, j);
}
function grabConst(src, name){
  const i = src.indexOf('const ' + name + ' = [');
  if(i < 0) return null;
  const j = src.indexOf('\n];', i) + 3;
  return src.slice(i, j);
}

const src = fs.readFileSync('work.html', 'utf8');
const store = {};
const results = [];
function chk(name, cond, detail){
  results.push((cond ? '통과  ' : '실패  ') + name + (detail ? '  → ' + detail : ''));
  return cond;
}

// ---- 공통 환경 ----
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k,v) => { store[k] = String(v); },
};
globalThis.currentBoatId = 'boatA';
globalThis.unlocked = true;
globalThis.mrTrash = [];
globalThis.saveMR = () => {};
globalThis.sysSave = () => {};
globalThis.updateTrashTab = () => {};
globalThis.document = { getElementById: () => null };
globalThis.esc = s => String(s);
globalThis.fmtDate = d => { const p=n=>String(n).padStart(2,'0'); return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };
globalThis.today = () => fmtDate(new Date());
let seq = 0;
globalThis.newId = () => 'new' + (++seq);
globalThis.deepCopy = o => (o===null||typeof o!=='object') ? o : JSON.parse(JSON.stringify(o));

// eval 안의 const 는 밖으로 나오지 않으므로 globalThis 에 직접 붙인다
eval(grabConst(src, 'CHECK_DEFAULTS').replace('const CHECK_DEFAULTS =', 'globalThis.CHECK_DEFAULTS ='));
for(const f of ['ckLists','ckPeriod','ckStateKey','getCheckState','setCheckState','ckDone','ckSetDone',
                'ensureCheckLists','ckItems','ckOrphans','ckSelKey','ckCurId','selectCheckList',
                'toggleCheck','resetCheck','addCheckList','renameCheckList','delCheckList',
                'addCheckItem','moveCheckItem','delCheckItem','ckAskCycle','cycleCheckList','editCheckItem']){
  const code = grab(src, f);
  if(!code) throw new Error('함수 없음: ' + f);
  eval(code); globalThis[f] = eval(f);
}
globalThis.ckCur = null;
// 입력 화면 대신 미리 정한 답으로 바로 '확인' 을 누른 것처럼 흉내낸다
globalThis.formAnswer = {};
globalThis.formSaid = null;
globalThis.openForm = o => {
  globalThis.formSaid = o;
  const v = {};
  (o.fields||[]).forEach(f=>{ v[f.key] = (f.key in globalThis.formAnswer)
    ? globalThis.formAnswer[f.key] : (f.value||''); });
  if(o.onOk) o.onOk(v);
};
globalThis.renderCheck = () => {};   // 화면 그리기는 검증 대상이 아니다

// ============ 1. 기존 사용자 데이터 마이그레이션 ============
// 쓰던 항목 11개 + 직접 추가한 항목 1개가 하나도 사라지면 안 된다.
checkt = [
  {id:'c01', label:'기상·풍속·파고 확인'},
  {id:'c05', label:'빌지 상태·펌프 작동'},
  {id:'myown', label:'내가 직접 넣은 항목', url:'https://example.com'},
];
const before = checkt.map(c=>c.id).sort();
ensureCheckLists();
const afterItems = checkt.filter(c=>c.typ!=='list').map(c=>c.id);
chk('마이그레이션: 쓰던 항목이 전부 살아있다',
    before.every(id => afterItems.includes(id)),
    '이전 ' + before.length + '개 → 이후 ' + afterItems.length + '개');
chk('마이그레이션: 쓰던 항목이 출항 전 목록에 들어간다',
    ckItems('kl1').map(c=>c.id).join(',') === 'c01,c05,myown',
    ckItems('kl1').map(c=>c.id).join(','));
chk('마이그레이션: 기본 항목이 중복 추가되지 않는다',
    ckItems('kl1').length === 3, '출항 전 항목 ' + ckItems('kl1').length + '개');
chk('마이그레이션: 목록 3개가 생긴다',
    ckLists().length === 3, ckLists().map(l=>l.name).join(' / '));
chk('마이그레이션: 링크가 보존된다',
    (checkt.find(c=>c.id==='myown')||{}).url === 'https://example.com');
chk('마이그레이션은 한 번만 실행된다',
    ensureCheckLists() === false);

// ============ 2. 새 사용자 (빈 상태) ============
checkt = [];
ensureCheckLists();
chk('새 배: 목록 3개 + 항목 25개',
    ckLists().length === 3 && checkt.filter(c=>c.typ!=='list').length === 25,
    '목록 ' + ckLists().length + ' / 항목 ' + checkt.filter(c=>c.typ!=='list').length);
chk('새 배: 목록별 항목 수 (11 / 8 / 6)',
    ckItems('kl1').length===11 && ckItems('kl2').length===8 && ckItems('kl3').length===6,
    [ckItems('kl1').length, ckItems('kl2').length, ckItems('kl3').length].join(' / '));

// ============ 3. 체크 상태가 목록별로 따로 논다 ============
ckCur = 'kl1'; toggleCheck('c01');
chk('출항 전 체크가 기록된다', ckDone('kl1','d').includes('c01'));
chk('입항 후는 영향받지 않는다', ckDone('kl2','d').length === 0);
ckCur = 'kl2'; toggleCheck('c21');
chk('두 목록의 체크가 각각 유지된다',
    ckDone('kl1','d').includes('c01') && ckDone('kl2','d').includes('c21'));

// ============ 4. 주기가 지나면 저절로 풀린다 ============
ckSetDone('kl1','d',['c01']);
store[ckStateKey()] = JSON.stringify({ kl1: { p:'d2000-01-01', ids:['c01'] } });
chk('날짜가 바뀌면 초기화된다', ckDone('kl1','d').length === 0);
store[ckStateKey()] = JSON.stringify({ kl3: { p:'w2000-01-03', ids:['c31'] } });
chk('주가 바뀌면 초기화된다', ckDone('kl3','w').length === 0);
ckSetDone('kl3','n',['c31']);
store[ckStateKey()] = JSON.stringify({ kl3: { p:'fix', ids:['c31'] } });
chk('수동 주기는 저절로 안 풀린다', ckDone('kl3','n').includes('c31'));

// ============ 5. 체크 상태가 배마다 따로 논다 ============
currentBoatId = 'boatA'; ckSetDone('kl1','d',['c01']);
currentBoatId = 'boatB';
chk('다른 배의 체크가 넘어오지 않는다', ckDone('kl1','d').length === 0);
currentBoatId = 'boatA';
chk('원래 배로 돌아오면 체크가 남아있다', ckDone('kl1','d').includes('c01'));

// ============ 6. 목록 추가 / 이름변경 / 삭제 ============
globalThis.formAnswer = { name:'주 1회 엔진 점검', cycle:'w' };
addCheckList();
const added = ckLists().find(l=>l.name==='주 1회 엔진 점검');
chk('목록 추가', !!added && added.cycle === 'w', added ? added.cycle : '없음');
chk('목록 추가 후 그 목록이 선택된다', ckCurId() === String(added.id));

globalThis.formAnswer = { name:'엔진 주간점검', cycle:'w' };
renameCheckList(added.id);
chk('목록 이름 변경', ckLists().find(l=>String(l.id)===String(added.id)).name === '엔진 주간점검');

// 항목을 넣고 목록째 삭제 → 항목도 같이 휴지통으로
globalThis.formAnswer = { label:'임펠러 확인', url:'' };
addCheckItem();
chk('항목이 현재 목록에 추가된다', ckItems(added.id).length === 1);
globalThis.confirm = () => true;
globalThis.alert = () => {};
globalThis.tell = (x)=>globalThis.alert(x);
globalThis.ask = (x)=>Promise.resolve(globalThis.confirm ? globalThis.confirm(x) : true);
mrTrash = [];
delCheckList(added.id);
chk('목록 삭제 시 목록+항목이 함께 휴지통으로',
    mrTrash.length === 2 && ckLists().length === 3,
    '휴지통 ' + mrTrash.length + '건 / 남은 목록 ' + ckLists().length);
chk('삭제된 목록의 항목이 checkt 에서도 빠진다',
    !checkt.some(c=>c.label==='임펠러 확인'));

// ============ 7. 마지막 목록은 못 지운다 ============
let alerted = '';
globalThis.alert = m => { alerted = m; };
checkt = [{id:'only', typ:'list', name:'하나뿐', cycle:'d'}];
delCheckList('only');
chk('마지막 목록 삭제는 막힌다',
    ckLists().length === 1 && alerted.includes('마지막'), alerted);

// ============ 8. 미아 항목은 사라지지 않는다 ============
checkt = [
  {id:'kl1', typ:'list', name:'출항 전', cycle:'d'},
  {id:'a1', list:'kl1', label:'살아있는 항목'},
  {id:'a2', list:'없어진목록', label:'갈 곳 잃은 항목'},
];
chk('미아 항목이 미분류로 잡힌다',
    ckOrphans().length === 1 && ckOrphans()[0].id === 'a2');
chk('미아 항목이 정상 목록에 섞이지 않는다', ckItems('kl1').length === 1);

// ============ 9. 항목 옮기기 ============
checkt = deepCopy(CHECK_DEFAULTS);
globalThis.formAnswer = { list:'kl2' };
moveCheckItem('c01');
chk('항목을 다른 목록으로 옮긴다',
    ckItems('kl2').some(c=>c.id==='c01') && !ckItems('kl1').some(c=>c.id==='c01'));
// 목록을 고르는 방식이라 잘못된 번호를 찍을 일이 없다.
// 대신 고를 수 있는 목록이 실제 목록과 맞는지 본다.
globalThis.formAnswer = {};
moveCheckItem('c02');
const opts = (formSaid.fields[0].options||[]).map(o=>String(o.v));
chk('옮길 목록만 고를 수 있다',
    opts.length === ckLists().length && opts.every(v=>ckLists().some(l=>String(l.id)===v)),
    opts.join(','));
chk('지금 있는 목록이 처음에 골라져 있다', formSaid.fields[0].value === 'kl1');

// ============ 10. undefined 가 섞이지 않는다 (Firestore 저장 실패 방지) ============
checkt = deepCopy(CHECK_DEFAULTS);
const hasUndef = checkt.some(c => Object.values(c).some(v => v === undefined));
chk('기본값에 undefined 가 없다', !hasUndef);

console.log(results.join('\n'));
const failed = results.filter(r=>r.startsWith('실패')).length;
console.log('\n합계: ' + (results.length - failed) + '개 통과 / ' + failed + '개 실패');
process.exit(failed ? 1 : 0);
