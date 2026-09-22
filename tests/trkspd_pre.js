// 5.10 — trkTooFast 가 쓰는 값과 함수 (속도 한도를 없애고 칩 속도로 판단하게 바꿈)
//   하네스마다 trkTooFast 를 떼어 가므로, 그 옆에 같이 붙일 것을 한 곳에서 만든다.
module.exports = function(src){
  const c = k => { const m = src.match(new RegExp('const ' + k + '\\s*=\\s*([\\d.]+)')); return m ? m[1] : 'undefined'; };
  const g = name => { const i = src.indexOf('function ' + name + '('); if(i < 0) return '';
    let d = 0, j = src.indexOf('{', i); for(; j < src.length; j++){ if(src[j] === '{') d++; else if(src[j] === '}'){ d--; if(!d) break; } }
    return src.slice(i, j + 1); };
  return `const TRK_SPD_X=${c('TRK_SPD_X')}, TRK_SPD_PAD=${c('TRK_SPD_PAD')}, TRK_SPD_GAP=${c('TRK_SPD_GAP')}, TRK_SPD_WIN=${c('TRK_SPD_WIN')};\n` +
         g('trkSpd') + '\n' + g('trkOldMaxKt') + '\n';
};
