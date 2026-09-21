// 일본 정박지 자료 만들기 (STEP 8)
//
// ★ 이 검사가 지키는 것
//   ① 못 찾은 곳은 지어내지 않고 빼고, 몇 건인지 말한다 — 점을 믿고 배를 몰면 사람이 다친다
//   ② 라이선스를 파일에 박아 둔다 (OSM = ODbL · 파생 파일도 ODbL)
//   ③ 「어항에 대도 된다」 로 읽히지 않게 경고를 넣는다 — 일본은 원칙적으로 금지다
//   ④ 나오는 모양이 한국 관 자료와 같다 (앱이 그대로 읽는다)
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { execFile } = require('child_process');
const arg = (process.argv[2] && !/\.html$/.test(process.argv[2])) ? process.argv[2] : null;
const SRC = arg || '/home/claude/webout/scripts/collect_jp.js';
let ok=0, bad=0;
const T=(n,c,w)=>{ if(c){ok++;console.log('통과: '+n);} else {bad++;console.log('★ 실패: '+n+(w!==undefined?' — '+JSON.stringify(w).slice(0,240):''));} };
const src = fs.readFileSync(SRC, 'utf8');

// ── 라이선스와 근거
T('★★★ 「非商用」 자료를 안 쓴다 (국토수치정보 어항·항만은 상업 금지)',
  !/nlftp\.mlit\.go\.jp\/ksj\/gml\/datalist/.test(src) && !/C09-06_GML/.test(src));
T('★★ 왜 못 쓰는지 파일에 적어 두었다 (다음 사람이 또 헤매지 않게)',
  /非商用/.test(src) && /C09/.test(src) && /C02/.test(src));
T('★★ 자리는 OSM 에서 받는다', /overpass/i.test(src));
T('★★★ 파생 파일에 ODbL 을 박는다', /ODbL/.test(src) && /license:/.test(src));
// ★ 4.99 — 머리글을 만드는 곳이 `({ from, license, ... })` 짧은 꼴로 바뀌었다.
//   `from:` 만 찾던 검사는 그것을 「없다」고 한다. 뜻으로 본다 —
//   ① 출처 글귀가 있고 ② 그것이 머리글의 from 으로 들어가는가.
T('★★ 출처를 파일 안에 적는다',
  /OpenStreetMap contributors/.test(src)
  && /(from:|\{ from,|\(from,)/.test(src)
  && /머리\([\s\S]{0,80}OSM_FROM|from: VISITOR_SRC/.test(src));
// ★ 5.00 — 한국 파일에 관 자료(해양수산부)가 같이 들어가서 출처가 두 줄이 되었다.
//   OSM 줄은 그대로 있어야 한다 (ODbL 은 파생 자료에도 붙는다).
T('★★★ 한국 파일에도 출처를 박는다 (ODbL 은 파생 자료에도 붙는다)',
  /머리\(KRGOV_SRC \+ ' · ' \+ OSM_FROM/.test(src) || /머리\(OSM_FROM/.test(src));
T('★★ 관 자료 출처도 같이 박는다', /const KRGOV_SRC = '해양수산부/.test(src));
T('★★ 문서에 없는 창구(국토지리원 주소검색)를 안 쓴다', !/msearch\.gsi\.go\.jp/.test(src));

// ── 실제로 돌려 본다
const EL = { elements:[
 { type:'node', lat:34.3512, lon:134.0466, tags:{ name:'高松港' } },
 { type:'way',  center:{lat:34.2740,lon:133.7520}, tags:{ name:'多度津港' } },
 { type:'node', lat:34.2380, lon:133.6700, tags:{ name:'仁尾港 (Nio Port)' } },
 { type:'node', lat:34.4900, lon:134.1900, tags:{ 'name:ja':'土庄港' } },
 // 4.68 — 세토내해 현이 늘었다
 { type:'node', lat:34.2990, lon:132.3190, tags:{ name:'厳島港' } },          // 宮島 — 다른 이름으로 들어 있다
 { type:'node', lat:34.3560, lon:132.3480, tags:{ name:'広島観音マリーナ', leisure:'marina' } },
 { type:'node', lat:34.6810, lon:134.5300, tags:{ name:'家島港' } },
 { type:'node', lat:34.2530, lon:133.0060, tags:{ name:'宮浦港' } }
]};
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'jpt-'));
// ★ 테두리를 지켜서 답한다. 안 지키면 香川 의 「宮浦港」(直島) 을 물었는데
//   愛媛 의 「宮浦港」(大三島) 을 돌려주게 된다 — 실제로 이 검사가 그걸 잡아냈다.
//   현마다 따로 묻는 까닭이 바로 이것이라, 흉내도 똑같이 내야 한다.
const srv = http.createServer((q,r)=>{
  let body = '';
  q.on('data', c => { body += c; });
  q.on('end', () => {
    const m = decodeURIComponent(body).match(/\(([\d.]+),([\d.]+),([\d.]+),([\d.]+)\)/);
    const box = m ? m.slice(1).map(Number) : null;
    const inBox = e => { if(!box) return true;
      const la = e.lat != null ? e.lat : (e.center && e.center.lat);
      const lo = e.lon != null ? e.lon : (e.center && e.center.lon);
      return la >= box[0] && lo >= box[1] && la <= box[2] && lo <= box[3]; };
    r.writeHead(200,{'content-type':'application/json'});
    r.end(JSON.stringify({ elements: EL.elements.filter(inBox) }));
  });
});
srv.listen(0, () => {
  execFile('node', [SRC], { cwd: TMP, encoding:'utf8',
      // ★ 이 검사는 **일본 수집기**를 본다. 관 자료 자리 물어보기(Nominatim)와
      //   해역 경계 내려받기는 여기서 볼 것이 아니고, 남의 서버라 검사가 두들기면 안 된다.
      //   그래서 둘 다 이 검사의 흉내 서버로 돌린다 — 404 가 나고 「못 찾음」 길로 간다.
      env: Object.assign({}, process.env, {
        OVERPASS_URL: 'http://127.0.0.1:' + srv.address().port + '/x',
        NOMI_URL:     'http://127.0.0.1:' + srv.address().port + '/nomi',
        SEA_BASE_URL: 'http://127.0.0.1:' + srv.address().port + '/sea/',
        NOMI_WAIT:    '0'
      }) },
    (err, so, se) => { srv.close(); done(String(so||'') + String(se||'')); });
});
function done(out){
  let j = null;
  try{ j = JSON.parse(fs.readFileSync(path.join(TMP, 'spots-jp.json'), 'utf8')); }catch(_){}
  T('★ 파일을 만든다', !!j);
  if(j){
    // 香川: 高松港 4 + 多度津 1 + 仁尾 1 + 土庄 1 = 7 (直島 宮浦 는 香川 테두리 안에 없으니 빠진다)
    // 広島: 宮島(厳島港으로 맞음) 1 + 観音マリーナ 1 = 2 · 兵庫 1 · 愛媛 1  → 모두 11
    T('★★★ OSM 에 없는 곳은 안 싣는다 (자리를 지어내지 않는다)',
      j.rows.length === 11 && !j.rows.some(x=>/坂出|池田|内海|坂手|直島|丸亀|女木|男木|廿日市|五日市|柳津|山根木材|ボートパーク広島|坂プレジャー/.test(x.n)),
      j.rows.map(r=>r.n));
    // ★★★ 같은 이름의 항이 다른 현에 있다. 현 테두리로 갈라 묻지 않으면 엉뚱한 자리가 박힌다.
    //   香川 直島의 「宮浦港」 과 愛媛 大三島의 「宮浦港」 이 실제로 그렇다.
    T('★★★ 같은 이름이라도 현 테두리 밖의 자리를 안 가져온다',
      !j.rows.some(x => /宮浦1号浮桟橋/.test(x.n)), j.rows.map(r=>r.n));
    T('★★★ 못 찾은 것을 몇 건인지 말한다 (조용히 빠지면 아무도 모른다)',
      /못 찾음 \d+건/.test(out), out.slice(0,300));
    T('★★ 라이선스가 파일에 있다', j.license === 'ODbL-1.0');
    T('★★ 출처가 파일에 있다', /香川県/.test(j.from) && /OpenStreetMap/.test(j.from));
    const r0 = j.rows[0];
    T('★★ 한국 관 자료와 칸 이름이 같다 (앱이 그대로 읽는다)',
      ['i','n','k','la','lo','r','f','p','t'].every(k => k in r0), Object.keys(r0));
    T('★ 좌표가 숫자다', typeof r0.la === 'number' && typeof r0.lo === 'number');
    T('★ 좌표가 일본 안이다', r0.la > 24 && r0.la < 46 && r0.lo > 122 && r0.lo < 147, [r0.la, r0.lo]);
    T('★★ 이름에 어느 항인지 함께 적는다', /（|\(/.test(r0.n), r0.n);
    T('★★★ 「자리는 대표 좌표」 라고 밝힌다 (그 점을 믿고 대면 안 된다)',
      /대표 좌표/.test(r0.t), r0.t.slice(0,160));
    // 방문 정박지에는 「어항 계류 제한」 을, 상시 보관 시설에는 「전화로 확인」 을 적는다.
    // 줄마다 둘 중 하나는 반드시 있어야 한다 — 아무 말 없이 실리는 자리는 없다.
    T('★★★ 일본에서 어항 계류가 제한된다는 것을 적는다',
      j.rows.filter(x => x.k !== 'marina').every(x => /원칙적으로 제한/.test(x.t)));
    T('★★★ 어느 줄이든 「어떻게 대는 곳인지」 한마디가 붙어 있다',
      j.rows.every(x => /원칙적으로 제한/.test(x.t) || /전화로 확인/.test(x.t)));
    T('★ 요금·주소를 그대로 담는다', /高松市浜ノ町/.test(r0.t) && /요금/.test(r0.t));
    T('★ 괄호 붙은 OSM 이름도 맞춘다', j.rows.some(x => /仁尾港/.test(x.n)));
    T('★ name:ja 만 있는 것도 찾는다', j.rows.some(x => /土庄港/.test(x.n)));

    // ── 4.68 세토내해 현 넷 (사장님 「남은 일 다 해라」)
    //   ★ 이름 후보 — 같은 곳을 OSM 이 다른 이름으로 들고 있다 (宮島港 / 厳島港).
    //     후보를 못 대면 그냥 빠진다. 빠지는 것이 지어내는 것보다 낫지만, 댈 수 있으면 대야 한다.
    {
      const 宮島 = j.rows.find(x => /宮島ビジターバース/.test(x.n));
      T('★★ 이름 후보(alt)로도 찾는다 — 宮島 은 OSM 에 厳島港 으로 있다', !!宮島, j.rows.map(x=>x.n));
      if(宮島){
        T('★★ 宮島 은 방문 정박지라 갈래가 port 다', 宮島.k === 'port', 宮島.k);
        T('★ 요금표가 그대로 들어간다', /1,350엔/.test(宮島.t) && /5,120엔/.test(宮島.t), 宮島.t.slice(0,80));
        T('★ 전화가 들어간다', /0829-44-0430/.test(宮島.t));
      }
      const 마리나 = j.rows.find(x => /広島観音マリーナ/.test(x.n));
      T('★★ 상시 보관 시설은 갈래가 marina 다', !!마리나 && 마리나.k === 'marina', 마리나 && 마리나.k);
      // ★★★ 여기가 제일 중요하다. 이 여덟 곳은 「방문 계류를 받는다」 고 적혀 있지 않다.
      //   방문 정박지처럼 보이게 실으면 사람이 갔다가 못 댄다.
      T('★★★ 상시 보관 시설에는 「전화로 확인」 경고가 붙는다',
        !!마리나 && /전화로 확인/.test(마리나.t), 마리나 && 마리나.t.slice(0,200));
      T('★ 방문 정박지에는 그 경고가 안 붙는다 (헷갈리면 안 된다)',
        !!宮島 && !/전화로 확인/.test(宮島.t));

      T('★★ 兵庫 家島港 이 들어간다', j.rows.some(x => /家島港ビジターバース/.test(x.n)));
      T('★★ 愛媛 みやうら海の駅 가 들어간다', j.rows.some(x => /みやうら海の駅/.test(x.n)));
      const 현 = [...new Set(j.rows.map(x => x.r))].sort();
      T('★ 현이 넷이다 — ' + 현.join(' · '), 현.length === 4, 현);
    }

    // ★★ 岡山·山口 (4.74 에 넣음). 어디서 가져왔는지와 무엇을 못 가져왔는지를
    //   파일에 적어 두지 않으면, 다음 사람이 빈 칸을 아무 값으로나 채운다.
    T('★★ 岡山 을 어디서 가져왔는지 적혀 있다',
      /岡山県 —/.test(src) && /pref\.okayama\.jp/.test(src));
    T('★★ 山口 을 어디서 가져왔는지 적혀 있다',
      /山口県 —/.test(src) && /uminet/.test(src));
    T('★★★ 못 읽은 것을 지어내지 않았다 (요금은 「문의」로 둔다)',
      /지어내지 않는다/.test(src) && /요금은 「문의」/.test(src));
    T('★★★ 자리를 못 찾으면 안 싣는다', /못 찾으면 그냥 안 싣는다/.test(src));
    ['岡山','山口'].forEach(k =>
      T('★★ ' + k + ' 현 테두리가 있다 (이름이 겹쳐도 안 헷갈린다)',
        new RegExp("'" + k + "': \\[").test(src)));
  }
  try{ fs.rmSync(TMP, { recursive:true, force:true }); }catch(_){}
  console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
  process.exit(bad ? 1 : 0);
}
