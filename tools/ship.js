// 뱃일 — 내보내는 화면 파일 만들기
//
// ★★★★ 5.53 (2026-10-14) — 아무것도 줄이지 않는다. 원본(www/index.html)을 한 글자도 안 바꾸고 그대로 내보낸다.
//   사장님: 「앞으론 절대 줄이지마」 · 「진짜 코드줄이기는 진짜 미친짓거리인데」.
//   5.35 ~ 5.52 에는 이 도구가 설명 글·빈칸을 빼고(esbuild) 영·러·일 사전을 따로 떼어 냈다(빠르게 켜지게).
//   그것도 코드 줄이기다 — 다시 넣지 말 것. 예전 내용은 깃허브 기록(5.35 커밋)에 있다.
//   깃허브 빌드 7곳(android-release · android-e2e · android-perf · ios-release · ios-e2e · ios-check · ios-perf)이
//   이 도구를 부르므로 도구 자리는 남겨 두고, 하는 일만 「그대로 복사」로 바꿨다.
//
// ★ 쓰는 법:  node tools/ship.js 원본.html 내보낼.html   (같은 이름이면 아무것도 안 한다)
'use strict';
const fs = require('fs'), path = require('path');
const [, , IN, OUT] = process.argv;
if(!IN || !OUT){ console.error('쓰는 법: node tools/ship.js 원본.html 내보낼.html'); process.exit(1); }
if(path.resolve(IN) !== path.resolve(OUT)) fs.copyFileSync(IN, OUT);
const n = fs.statSync(OUT).size;
console.log('내보낸 파일 = 원본 그대로 (줄이지 않음) · ' + n.toLocaleString() + ' 바이트');
