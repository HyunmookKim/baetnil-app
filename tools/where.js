// 뱃일 — 오류 신고의 「index.html:줄:칸」(내보낸 파일 기준)을 원본 www/index.html 줄로 바꾼다 (5.35)
// 쓰는 법:  node tools/ship.js www/index.html /tmp/s.html /tmp/s.map.json   (오류 난 판과 같은 원본으로)
//           node tools/where.js /tmp/s.map.json 줄:칸 [줄:칸 …]
'use strict';
const fs = require('fs');
const [, , MAP, ...pos] = process.argv;
if(!MAP || !pos.length){ console.error('쓰는 법: node tools/where.js 대조표.json 줄:칸'); process.exit(1); }
const M = JSON.parse(fs.readFileSync(MAP, 'utf8'));
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function vlq(str){
  const out = []; let v = 0, sh = 0;
  for(const ch of str){
    let d = B64.indexOf(ch); const more = d & 32; d &= 31;
    v += d << sh;
    if(more) sh += 5; else { out.push(v & 1 ? -(v >> 1) : v >> 1); v = 0; sh = 0; }
  }
  return out;
}
// 줄마다 [만든 칸, 원본 줄, 원본 칸] 목록
const lines = []; { let sl = 0, sc = 0;
  M.map.mappings.split(';').forEach(L => { const segs = []; let gc = 0;
    if(L) L.split(',').forEach(sg => { const d = vlq(sg); gc += d[0]; if(d.length >= 4){ sl += d[2]; sc += d[3]; segs.push([gc, sl, sc]); } });
    lines.push(segs); }); }
for(const p of pos){
  const [l, c] = p.split(':').map(Number);
  // 내보낸 파일 줄·칸 → 본체 script 안 줄·칸 (0부터)
  let gl = l - M.ship.line, gc = (c || 0) - (gl === 0 ? M.ship.col : 0);
  if(l === undefined || gl < 0 || gl >= lines.length){ console.log(p + ' → 본체 코드 밖입니다 (머리 쪽 작은 칸이거나 다른 파일)'); continue; }
  const segs = lines[gl]; let hit = null;
  for(const s of segs){ if(s[0] <= gc) hit = s; else break; }
  if(!hit){ console.log(p + ' → 찾지 못했습니다'); continue; }
  const ol = hit[1] + M.orig.line;     // 원본 html 줄 (1부터)
  console.log(p + ' → 원본 www/index.html ' + ol + '째 줄 (판 ' + M.ver + ')');
}
