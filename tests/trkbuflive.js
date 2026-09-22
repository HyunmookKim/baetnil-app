// ══════════════════════════════════════════════════════════════════════
// 5.3 — 자바 쪽에 쌓아 둔 점을 앱이 제대로 가져오는가 (진짜로 돌려 본다)
//
//   ★ 왜 — 사장님 항적이 화면을 끄면 끊긴다. 백업의 점 190개를 세어 보니
//     「우리가 버린 것」이 아니라 「안 들어온 것」이었다. 웹뷰가 얼어서
//     넘겨받을 쪽이 자고 있었다. 그래서 자바가 파일에 쌓고, 깨면 가져온다.
//   ★ 이 검사는 그 「가져오는 문」(trkBufDrain)을 실제로 돌려 본다.
//     가짜 부품(BaetnilTrack)을 물려, 쌓인 점을 주고 제대로 담기는지 본다.
// ══════════════════════════════════════════════════════════════════════
const fs = require('fs');
const SRC = process.argv[2] || '../../work.html';
const src = fs.readFileSync(SRC, 'utf8');
let ok = 0, bad = 0;
const T = (n, c, w) => { if(c){ ok++; console.log('통과: ' + n); }
  else { bad++; console.log('★ 실패: ' + n + (w !== undefined ? ' — ' + JSON.stringify(w).slice(0,200) : '')); } };
const grab = (fn) => {
  const i = src.indexOf('function ' + fn + '(');
  if(i < 0) return '';
  let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); }
  }
  return '';
};
const grabAsync = (fn) => {
  const i = src.indexOf('async function ' + fn + '(');
  if(i < 0) return '';
  let d = 0;
  for(let k = src.indexOf('{', i); k < src.length; k++){
    if(src[k] === '{') d++;
    else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); }
  }
  return '';
};

// ── 글자 검사
T('자바 부품을 잡는 문이 있다 (trkP)', !!grab('trkP'));
T('켜는 문이 있다 (trkBufStart)', !!grabAsync('trkBufStart'));
T('내리는 문이 있다 (trkBufStop)', !!grabAsync('trkBufStop'));
T('가져오는 문이 있다 (trkBufDrain)', !!grabAsync('trkBufDrain'));
T('★★★ 기록을 켤 때 자바 쪽도 켠다', /await trkBufStart\(\)/.test(grabAsync('trkAttach')));
T('★★★ 켤 때 죽어 있던 동안 쌓인 것을 먼저 가져온다', /await trkBufDrain\(\)/.test(grabAsync('trkAttach')));
T('★★★ 1분 감시에서도 가져온다', /trkBufDrain\(\)/.test(grab('trkWatchStart')));
T('★★★ 앱을 다시 볼 때 곧바로 가져온다', /trkBufDrain\(\)/.test(grab('appVisible')));
{
  const st = grabAsync('trkStop');
  T('★★★ 입항 때 남은 것을 마저 가져온다', /trkBufDrain\(\)/.test(st));
  T('★★★ 입항 때 자바 서비스를 내린다', /trkBufStop\(\)/.test(st));
  T('★★★ 비우는 것이 trkNow 를 비우기 **전**이다 (순서가 뒤바뀌면 마지막 몇 분을 잃는다)',
    st.indexOf('trkBufDrain') < st.indexOf('trkNow = null'));
}
{
  const dr = grabAsync('trkBufDrain');
  // ★ 5.4 — 이제 trkPush 를 거치지 않는다. 지나간 점을 뒤에 붙이면 50m 문과 속도 문이
  //   시간을 거슬러 걸려 버려지기 때문이다. 대신 **같은 거르개**를 여기서 직접 건다.
  T('★ 가져온 점에도 기지국 거르개를 건다 (TRK_GPS_ACC)', /TRK_GPS_ACC/.test(dr));
  T('★ 가져온 점에도 흐림 거르개를 건다 (TRK_ACC)', /TRK_ACC/.test(dr));
  T('★ 가져온 점에도 50m 문을 건다 (TRK_DIST)', /TRK_DIST/.test(dr));
  T('★ 가져온 점에도 속도 문을 건다 (trkTooFast)', /trkTooFast\(/.test(dr));
  T('★★★ 시각으로 세운 뒤에 문을 건다 (sort 가 있다)', /\.sort\(/.test(dr));
  T('★★★ 5.3 의 「마지막 점보다 앞선 것은 버린다」 가 사라졌다',
    !/if\(Number\(q\.t\) <= lastT\) continue;/.test(dr));
  T('★ 자바가 준 수와 담은 수를 항해에 남긴다', /bufGot/.test(dr) && /bufAdd/.test(dr));
}

// ── 진짜로 돌려 본다
{
  const body = [
    'const TRK_DIST=50, TRK_ACC=60, TRK_GPS_ACC=30, TRK_MAXKT=20, TRK_LOST=6, TRK_MAX=4000, TRK_FLUSH=20, TRK_Q=5, TRK_STILL_MS=0.3;',
    'let trkKal=null, trkNow=null, trkDraining=false;',
    'function hav(a,b,c,d){const R=6371,t=x=>x*Math.PI/180;const dLat=t(c-a),dLon=t(d-b);' +
      'const q=Math.sin(dLat/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}',
    'function trkSkip(){ trkNow.skip=(Number(trkNow.skip)||0)+1; }',
    'function trkKeep(){}  function trkFlush(){}  function trkLive(){}  function trkSimplify(a){return a;}',
    'function trkBufMark(){}',
    require('./trkspd_pre.js')(src), grab('trkSmooth'), grab('trkSmoothReset'), grab('trkTooFast'), grab('trkPush'),
    grab('trkP'), grabAsync('trkBufDrain'),
    'return { set(v){trkNow=v;}, get(){return trkNow;}, trkBufDrain, trkSmoothReset };'
  ].join('\n');
  let api = null, err = '';
  const win = { Capacitor: { Plugins: {} } };
  try { api = new Function('window', body)(win); } catch(e){ err = e.message; }
  T('가져오는 문이 그대로 돌아간다' + (err ? ' — ' + err : ''), !!api);

  if(api){
    const base = Date.parse('2026-09-17T05:00:00Z');
    const mk = (min, la, lo, ac) => ({ t: base + min*60000, la, lo, ac, sp: 3, br: 200 });
    // 부품이 쌓아 둔 것처럼 — 일부러 뒤섞어서 준다
    const 쌓인것 = [ mk(9, 34.7300, 127.6700, 5), mk(3, 34.7360, 127.6760, 4),
                     mk(6, 34.7330, 127.6730, 6), mk(1, 34.7380, 127.6780, 5) ];
    win.Capacitor.Plugins.BaetnilTrack = { drain: async () => ({ pts: 쌓인것.slice(), bad: 0 }) };

    api.set({ vid:'v1', pts:[{ la:34.73900, lo:127.67900, t:new Date(base).toISOString() }] });
    api.trkSmoothReset();
    api.trkBufDrain().then(n => {
      const pts = api.get().pts;
      T('★★★ 쌓인 점을 담았다 — ' + n + '개', n === 4, { n, pts: pts.length });
      const ts = pts.map(p => Date.parse(p.t));
      T('★★★ 시각 차례로 담긴다 (섞여 들어와도)', ts.every((x,i) => i===0 || x > ts[i-1]), ts);

      // 똑같은 시각의 점을 또 주면 두 번 담기지 않는다
      win.Capacitor.Plugins.BaetnilTrack = { drain: async () => ({ pts: [ mk(3, 34.7360, 127.6760, 4) ], bad: 0 }) };
      return api.trkBufDrain();
    }).then(n2 => {
      T('★★★ 같은 시각의 점은 두 번 담기지 않는다', n2 === 0, { n2 });

      // 흐린 점은 그대로 걸러진다
      win.Capacitor.Plugins.BaetnilTrack = { drain: async () => ({ pts: [
        { t: base + 20*60000, la: 34.7200, lo: 127.6600, ac: 900, sp: 3, br: 200 } ], bad: 0 }) };
      return api.trkBufDrain();
    }).then(n3 => {
      T('★★★ 가져온 점도 흐리면 버린다 (거르개가 그대로 걸린다)', n3 === 0, { n3 });

      // ══════════════════════════════════════════════════════════
      // ★★★ 5.4 — **이 검사가 없어서 5.3 의 치명적인 버그를 놓쳤다.**
      //   앱이 깨어나는 순간 위치 부품이 「지금 여기」 점을 먼저 하나 밀어 넣는다.
      //   그 **뒤에** 자바에 쌓인 지나간 점들을 가져온다.
      //   5.3 은 「마지막 점보다 앞선 것은 버린다」 로 그것을 **전부** 버렸다.
      //   9/20 제노아 시험 항해가 그 모양이었다 — 170분에 12점.
      // ══════════════════════════════════════════════════════════
      api.set({ vid:'v2', pts:[{ la:34.7390, lo:127.6790, t:new Date(base + 60*60000).toISOString() }] });
      api.trkSmoothReset();
      win.Capacitor.Plugins.BaetnilTrack = { drain: async () => ({ pts: [
        mk(20, 34.7300, 127.6700, 5), mk(30, 34.7320, 127.6720, 4),
        mk(40, 34.7340, 127.6740, 6), mk(50, 34.7360, 127.6760, 5) ], bad: 0 }) };
      return api.trkBufDrain();
    }).then(nBack => {
      const pts = api.get().pts;
      const ts  = pts.map(p => Date.parse(p.t));
      T('★★★ 깨어난 뒤 「지금 여기」 점이 먼저 들어와 있어도, 쌓인 지나간 점을 담는다 — ' + nBack + '개',
        nBack === 4, { nBack, pts: pts.length });
      T('★★★ 담긴 뒤 시각 차례가 맞다 (지나간 점이 앞에 끼워진다)',
        pts.length === 5 && ts.every((x,i) => i===0 || x > ts[i-1]), ts);
      T('★★★ 먼저 들어와 있던 「지금 여기」 점이 사라지지 않았다',
        ts[ts.length-1] === base + 60*60000, ts[ts.length-1]);

      // 부품이 없으면 조용히 0
      win.Capacitor.Plugins.BaetnilTrack = null;
      return api.trkBufDrain();
    }).then(n4 => {
      T('★ 자바 부품이 없는 기기(웹)에서는 조용히 넘어간다', n4 === 0, { n4 });
      console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
      process.exit(bad ? 1 : 0);
    }).catch(e => {
      T('돌려 보다 터졌다 — ' + e.message, false);
      console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
      process.exit(1);
    });
  } else {
    console.log('\n합계: ' + ok + '개 통과 / ' + bad + '개 실패');
    process.exit(1);
  }
}
