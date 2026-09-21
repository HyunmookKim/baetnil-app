const {chromium}=require('playwright'); const fs=require('fs');
const png=n=>'data:image/png;base64,'+fs.readFileSync(n).toString('base64');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p=await b.newPage({ locale:'ko-KR',viewport:{width:1000,height:1000},deviceScaleFactor:2});
  await p.setContent('<!doctype html><meta charset="utf-8">'
   +'<style>body{margin:0;background:#fff;font-family:-apple-system,"Noto Sans KR",sans-serif;color:#111}'
   +'h2{margin:22px 0 6px 40px;font-size:20px}'
   +'.ic{margin:4px 0 14px 40px;display:flex;align-items:center;gap:12px;font-size:13.5px;color:#666}'
   +'.ic img{width:58px;border-radius:14px}'
   +'.row{display:flex;gap:46px;padding:0 40px 30px}'
   +'.c{text-align:center}.c img{width:340px;border:1px solid #ccc;border-radius:10px;display:block}'
   +'b{display:block;margin-top:11px;font-size:16px}</style>'
   +'<h2>같은 화면 — 전 / 후</h2>'
   +'<div class="ic"><img src="'+png('icon-512.png')+'"><span>아이콘의 하늘·해·빛길을 그대로 앱 바탕으로. 배와 물에 비친 배만 뺐습니다.</span></div>'
   +'<div class="row">'
   +'<div class="c"><img src="'+png('r_now.png')+'"><b>전</b></div>'
   +'<div class="c"><img src="'+png('store_3_정비.png')+'"><b>후</b></div>'
   +'</div>');
  await p.waitForTimeout(700);
  await p.screenshot({path:'ui_ba.png',fullPage:true});
  console.log('ui_ba.png'); await b.close();
})();
