// 3.43 — 도면 두 가지
//
//  가. 기본 도면이 껍데기였다
//   · 세일링 요트 측면도에 마스트도 돛도 없었다. 선체 윤곽 하나뿐이었다.
//     측면도는 마스트·붐·리깅 정비 위치에 핀을 찍으라고 있는 것인데 찍을 데가 없었다.
//   · 모터보트·낚싯배도 조타실도 엔진도 없었다.
//   · 기본 도면은 새로 온 사람이 제일 먼저 고르는 것이다. 껍데기를 내놓으면 안 된다.
//
//  나. 내 배 도면이 파이어스토어 문서 안에 통째로 들어 있었다 (한 장 700KB)
//   ★ 그런데 그냥 창고로 보내면 두 가지가 깨진다
//     1) 배 위에서 인터넷이 없으면 도면이 안 보인다 — 도면은 배 위에서 보는 것이다
//     2) 도면에 핀을 찍어 한 장으로 만드는 일은 캔버스에 그려야 하는데,
//        남의 주소에서 온 그림을 그리면 브라우저가 캔버스를 잠근다 (tainted canvas)
//   그래서 작은 사본(640~760픽셀)을 문서에 남긴다. 그 둘을 이 검사가 지킨다.
const fs = require('fs');
function grab(s, name){
  let i = s.indexOf('async function ' + name + '(');
  if(i < 0) i = s.indexOf('function ' + name + '(');
  if(i < 0) return null;
  let d = 0, j = s.indexOf('{', i);
  for(; j < s.length; j++){
    if(s[j] === '{') d++;
    else if(s[j] === '}'){ d--; if(d === 0){ j++; break; } }
  }
  return s.slice(i, j);
}
const src = fs.readFileSync(process.argv[2] || 'work.html', 'utf8');
const si = src.indexOf('<script>') + 8, sj = src.indexOf('</script>', si);
const js = src.slice(si, sj);

let pass = 0, fail = 0;
const cut = n => { n = String(n); return n.length > 95 ? n.slice(0, 95) + '…' : n; };
const T = (n, c) => { if(c){ pass++; console.log('통과: ' + cut(n)); } else { fail++; console.log('★ 실패: ' + cut(n)); } };

// ── 1. ★ 기본 도면에 있어야 할 것이 있나
{
  const blk = js.slice(js.indexOf('const DG_BUILTIN = {'), js.indexOf('\n};', js.indexOf('const DG_BUILTIN = {')));
  // ★ 줄 앞 두 칸으로 자르면 안 된다 — planSvg 줄도 두 칸으로 시작해서 잘려 나간다.
  //   그 열쇠부터 끝까지 두고, 처음 만나는 것을 그 열쇠 것으로 본다.
  const of = k => {
    const i = blk.indexOf('\n  ' + k + ': {');
    if(i < 0) return { plan:'', side:'' };
    const seg = blk.slice(i);
    // 소스 안에서는 따옴표가 \\" 로 escape 되어 있다. 원래 SVG 로 되돌린다.
    const un = t => { try{ return JSON.parse('"' + t + '"'); }catch(e){ return t; } };
    const p = un((seg.match(/planSvg: "([\s\S]*?)",\n/) || ['',''])[1]);
    const s2 = un((seg.match(/sideSvg: "([\s\S]*?)" \},?/) || ['',''])[1]);
    return { plan:p, side:s2, seg };
  };
  // 선 개수로 '무엇이 그려져 있나' 를 잰다. 껍데기 선체는 path 가 두엇뿐이다.
  const paths = t => (String(t).match(/<path|<circle/g) || []).length;
  const tall  = t => { const m = String(t).match(/viewBox="0 0 (\d+) (\d+)"/); return m ? Number(m[2]) / Number(m[1]) : 0; };

  const sail = of('sail'), power = of('power'), fish = of('fishing');
  T('세일링 기본 도면이 있다', sail.side.length > 200 && sail.plan.length > 200);

  // ★ 마스트가 있으려면 그림이 선체보다 훨씬 높아야 한다.
  //   옛 측면도는 1000×420 이었다 — 마스트가 들어갈 자리 자체가 없었다.
  T('세일링 측면도가 마스트가 들어갈 만큼 높다 — 세로/가로 ' + tall(sail.side).toFixed(2),
    tall(sail.side) >= 1.0);
  T('세일링 측면도에 그린 것이 많다 — ' + paths(sail.side) + '개', paths(sail.side) >= 9);
  // 마스트는 위에서 아래까지 내려오는 긴 선이다
  const mast = /d="M\s*\d+\s+1[01]\d\d\s+L\s*\d+\s+\d\d"/.test(sail.side)
            || /L\s*5\d\d\s+70"/.test(sail.side);
  T('세일링 측면도에 마스트가 있다', mast);
  T('세일링 측면도에 돛이 있다 (닫힌 면 두 장)',
    (sail.side.match(/Z"/g) || []).length >= 3);
  T('세일링 측면도에 킬과 러더가 있다', paths(sail.side) >= 9 && /1288|1274/.test(sail.side));
  T('세일링 측면도에 수선이 있다', /stroke-dasharray/.test(sail.side));

  T('모터보트에 조타실이 있다 — ' + paths(power.side) + '개', paths(power.side) >= 8);
  T('모터보트에 엔진 자리가 있다', /stroke-dasharray="7 6"/.test(power.side));
  T('낚싯배에 조타실이 있다 — ' + paths(fish.side) + '개', paths(fish.side) >= 9);
  T('낚싯배에 난간이 있다', (fish.side.match(/M\s*\d+\s+\d+\s+L\s*\d+\s+\d+\s+M/g) || []).length >= 1);

  // 평면도에도 알아볼 것이 있어야 한다 (적재표 배경으로도 쓴다)
  T('세일링 평면도에 캐빈·콕핏이 있다 — ' + paths(sail.plan) + '개', paths(sail.plan) >= 6);
  T('세일링 평면도에 마스트 자리가 있다', /<circle/.test(sail.plan));
  T('모터보트 평면도에도 있다 — ' + paths(power.plan) + '개', paths(power.plan) >= 5);
  T('낚싯배 평면도에도 있다 — ' + paths(fish.plan) + '개', paths(fish.plan) >= 5);
  // 세 벌 다 뱃머리 방향이 같아야 한다 — 섞이면 사람이 헷갈린다
  [['세일링',sail],['모터보트',power],['낚싯배',fish]].forEach(([n,o])=>{
    T(n + ' 평면도에 가운데 선이 있다', /stroke-dasharray="6 7"/.test(o.plan));
  });
}

// ── 2. 도면이 창고로 간다
{
  const ud = grab(js, 'uploadDg') || '';
  T('도면을 창고로 보낸다', /storePhotos\(/.test(ud));
  // ★ 작은 사본은 창고로 보내기 '전' 에 만들어야 한다.
  //   창고에서 온 그림으로는 캔버스가 잠겨 사본을 못 만든다.
  T('작은 사본을 창고로 보내기 전에 만든다',
    ud.indexOf('dgShrink(') >= 0 && ud.indexOf('dgShrink(') < ud.indexOf('storePhotos('));
  T('작은 사본을 남긴다', /dgSmall = \{ \.\.\.dgSmall/.test(ud));
  T('창고에 못 올려도 도면은 남는다', /st\.photos\[0\] \|\| url/.test(ud));

  const sh = grab(js, 'dgShrink') || '';
  T('작은 사본 만드는 곳이 있다', sh.length > 0);
  T('크기가 한 곳에 정해져 있다', /const DG_SMALL_PX = \d+/.test(js) && /const DG_SMALL_KB = \d+/.test(js));
  const px = Number((js.match(/const DG_SMALL_PX = (\d+)/) || [])[1] || 0);
  // 너무 작으면 도면으로 못 쓰고, 너무 크면 문서를 다시 무겁게 만든다
  T('도면으로 알아볼 만한 크기다 — ' + px + '픽셀', px >= 600 && px <= 1000);
  T('캔버스가 잠겨도 안 죽는다', /catch\(e\)\{ cb\(null\); \}/.test(sh));

  // 실제로 돌려 본다
  let F = null, err = '';
  try{
    F = new Function('DG_SMALL_PX','DG_SMALL_KB','Image','document', sh + '\n return dgShrink;');
  }catch(e){ err = e.message; }
  T('작은 사본 만들기를 돌렸다' + (err ? ' — ' + err : ''), !!F);
  if(F){
    const mkImg = (w, h, fail) => class {
      set src(v){ this.naturalWidth = w; this.naturalHeight = h;
                  setTimeout(()=> fail ? this.onerror() : this.onload(), 0); }
    };
    const doc = tainted => ({ createElement: () => ({
      getContext: () => ({ drawImage(){} }),
      toDataURL(){ if(tainted) throw new Error('캔버스가 잠김'); return 'data:image/jpeg;base64,' + 'A'.repeat(1000); }
    }) });
    (async ()=>{
      const ok = await new Promise(r => F(760, 70, mkImg(1600, 1000), doc(false))('x', r));
      T('사본을 만든다', String(ok).startsWith('data:image/jpeg'));
      const bad = await new Promise(r => F(760, 70, mkImg(1600, 1000), doc(true))('x', r));
      T('★ 캔버스가 잠기면 조용히 없다고 한다', bad === null);
      const gone = await new Promise(r => F(760, 70, mkImg(0, 0, true), doc(false))('x', r));
      T('그림을 못 읽어도 안 죽는다', gone === null);

      // ── 3. ★ 핀 그림은 작은 사본으로 만든다
      const ps = grab(js, 'pinShot') || '';
      T('핀 그림이 작은 사본을 먼저 쓴다', ps.indexOf('dgSmall[key]') >= 0
        && ps.indexOf('dgSmall[key]') < ps.indexOf('dgSrc(pin.map)'));
      T('작은 사본이 없으면 원래 도면을 쓴다', /dgSrc\(pin\.map\)/.test(ps));
      T('실패해도 조용히 넘어간다', /resolve\(null\)/.test(ps));

      // ── 4. 저장·불러오기가 짝이 맞는가
      const ar = grab(js, 'dgArr') || '';
      T('창고 주소를 주소로 적는다', /d = \{ id:k, url:v \}/.test(ar));
      T('작은 사본도 함께 적는다', /d\.small = dgSmall\[k\]/.test(ar));
      // ★ 그림째 담은 옛 도면에까지 사본을 더하면 문서가 두 배가 된다
      T('그림째 담은 도면에는 사본을 안 더한다', /!d\.img/.test(ar));
      const fr = grab(js, 'dgFromArr') || '';
      T('주소를 읽는다', /d\.url/.test(fr));
      T('옛 그림도 그대로 읽는다', /d\.img/.test(fr));
      const sf = grab(js, 'dgSmallFromArr') || '';
      T('작은 사본을 읽는 곳이 있다', sf.length > 0);

      // 실제로 넣었다 뺐다 해 본다
      // 4.85 — 도면이 여러 장이 되면서 dgArr 이 dgKeys() 를 쓴다. 그 문도 함께 넣어 준다.
      const DGF = ['dgFixed','dgKeys','dgName','dgNamesFromArr','dgBlank'].map(n => grab(js, n) || '').join('\n');
      const A = new Function('dgImgs','dgSmall','dgRef','dgPub','dgSeedKeyOf',
        'const DG_FIXED=[\'plan\',\'side\']; let dgNames={}; const t=x=>x;\n' + DGF + '\n' + ar + '\n return dgArr;');
      const R = new Function('const DG_FIXED=[\'plan\',\'side\']; let dgNames={}; const t=x=>x;\n'
        + DGF + '\n' + fr + '\n' + sf + '\n' + (grab(js,'dgSeedUrl')||'')
        + '\n return { dgFromArr, dgSmallFromArr };')();
      const out = A({plan:'https://창고/도면.jpg', side:null},
                    {plan:'data:image/jpeg;base64,작은', side:null},
                    {plan:null,side:null}, {plan:false,side:false}, ()=>null)();
      T('넣으면 주소 + 작은 사본 — ' + JSON.stringify(out), out.length === 1
        && out[0].url === 'https://창고/도면.jpg' && out[0].small === 'data:image/jpeg;base64,작은');
      T('빼면 주소가 돌아온다', R.dgFromArr(out).plan === 'https://창고/도면.jpg');
      T('빼면 작은 사본도 돌아온다', R.dgSmallFromArr(out).plan === 'data:image/jpeg;base64,작은');
      // 옛 자료도 그대로
      const oldA = [{ id:'plan', img:'data:image/jpeg;base64,옛것' }];
      T('옛 도면도 그대로 읽는다', R.dgFromArr(oldA).plan === 'data:image/jpeg;base64,옛것');
      T('옛 도면에는 작은 사본이 없다', R.dgSmallFromArr(oldA).plan === null);

      // ── 5. 화면 — 창고에서 못 받으면 작은 사본으로 버틴다
      const show = grab(js, 'dgShowSrc') || '';
      T('화면에 쓸 도면을 고르는 곳이 있다', show.length > 0);
      // ★ 칸 이름(key/k)에 기대지 않는다 — 이름이 바뀌면 검사가 헛통과한다.
      //   보아야 할 것은 「창고 것을 먼저 본다」 는 순서다.
      T('창고 것을 먼저 쓴다', show.indexOf('dgImgs[') >= 0
        && show.indexOf('dgImgs[') < show.indexOf('dgSmall['));
      const fb = grab(js, 'dgFallback') || '';
      T('못 받으면 갈아 끼우는 곳이 있다', fb.length > 0);
      // ★ 갈아 끼운 것도 또 실패하면 무한히 맴돈다
      T('한 번만 갈아 끼운다', /dataset\.fell/.test(fb));
      T('정비 도면이 갈아 끼우기를 건다', /onerror="dgFallback\(this/.test(js));
      T('적재표 도면도 갈아 끼우기를 건다', /fp\.onerror = \(\)=>dgFallback\(fp, 'plan'\)/.test(js));
      T('정비 도면이 작은 사본까지 본다', /const src = dgShowSrc\(k\)/.test(js));
      T('적재표 도면도 작은 사본까지 본다', /const src = dgShowSrc\('plan'\)/.test(js));

      // ── 6. 불러오는 길마다 작은 사본이 따라온다 (하나만 빠져도 핀 그림이 안 나온다)
      const paths = [...js.matchAll(/dgFromArr\(([^)]*)\)/g)].map(m => m[1]);
      const smalls = [...js.matchAll(/dgSmallFromArr\(([^)]*)\)/g)].map(m => m[1]);
      const missing = paths.filter(p => !smalls.includes(p));
      T('도면을 읽는 곳마다 작은 사본도 읽는다 — 빠진 곳: ' + (missing.join(', ') || '없음'),
        missing.length === 0);
      T('도면을 비울 때 작은 사본도 비운다',
        (js.match(/dgSmall\s*=\s*\{\s*plan:\s*null,\s*side:\s*null\s*\}/g) || []).length >= 2);

      console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
      process.exit(fail ? 1 : 0);
    })();
  } else {
    console.log('\n합계: ' + pass + '개 통과 / ' + fail + '개 실패');
    process.exit(1);
  }
}
