// 5.10 — trkTooFast 가 쓰는 값과 함수 (속도 한도를 없애고 칩 속도로 판단하게 바꿈)
//   하네스마다 trkTooFast 를 떼어 가므로, 그 옆에 같이 붙일 것을 한 곳에서 만든다.
module.exports = function(src){
  const c = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*([\\d.]+)')); return m ? m[1] : 'undefined'; };
  const g = name => { const i = src.indexOf('function ' + name + '('); if(i < 0) return '';
    let d = 0, j = src.indexOf('{', i); for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) break; } }
    return src.slice(i, j + 1); };
  // ★ 5.12 — trkPush 가 「첫 점은 GPS 가 잡힌 뒤에」 문을 쓰므로 그것도 같이 붙인다
  return `const TRK_SPD_X=${c('TRK_SPD_X')}, TRK_SPD_PAD=${c('TRK_SPD_PAD')}, TRK_SPD_GAP=${c('TRK_SPD_GAP')}, TRK_SPD_WIN=${c('TRK_SPD_WIN')};\n` +
         `const TRK_FIRST_ACC=${c('TRK_FIRST_ACC')}, TRK_FIRST_WAIT=${c('TRK_FIRST_WAIT')};\n` +
         // ★ 5.32 — 기기별 정확도 기준(trkAccJump·trkAccSeen)과 위성 점 판정(trkSatPt)
         `const TRK_ACC_OK=${c('TRK_ACC_OK')}, TRK_ACC_X=${c('TRK_ACC_X')}, TRK_ACC_N=${c('TRK_ACC_N')}, TRK_ACC_MINN=${c('TRK_ACC_MINN')};\n` +
         g('trkSpd') + '\n' + g('trkOldMaxKt') + '\n' + g('trkFirstWait') + '\n' +
         g('trkAccJump') + '\n' + g('trkAccSeen') + '\n' + g('trkSatPt') + '\n' +
         // ★ 5.37 — OsmAnd 문 (5초 간격 · 정확도 50m · 6분/10배 끊김)
         `const TRK_OSM_MS=${c('TRK_OSM_MS')}, TRK_OSM_ACC=${c('TRK_OSM_ACC')}, TRK_OSM_SEG_MS=${c('TRK_OSM_SEG_MS')}, TRK_OSM_SEG_X=${c('TRK_OSM_SEG_X')};\n` +
         g('trkOsmWhy') + '\n' + g('trkCnt') + '\n';
};
