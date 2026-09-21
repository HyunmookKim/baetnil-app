// ── 글 편집기 (Quill)
//
// ★ 왜 남이 만든 것을 쓰나
//   3.78 까지는 브라우저의 contenteditable 과 execCommand 로 직접 만들었다.
//   굵게·목록까지는 되지만, 커서가 어디 있는지·되돌리기·붙여넣기·한글 조합 중
//   지우기 같은 것이 기기마다 다르게 굴었다. 그것을 다 맞추는 일이 편집기 만들기다.
//   Quill 은 그 일을 십 년 넘게 한 물건이고 BSD-3 라 상업용도 값이 없다.
//
// ★ 남의 서버에서 불러오지 않는다
//   배 위에서는 인터넷이 없다. index.html 안에 통째로 넣어 두면 늘 있다.
//
// ★ 저장하는 모양은 안 바꾼다
//   Quill 은 Delta(JSON) 로 다루지만, 우리는 지금까지 쓰던 덩이(blocks)로 담는다.
//   이미 올라간 글이 그대로 열려야 하고, 옛 판 앱도 body 로 읽고 있기 때문이다.
//   그래서 이 파일은 [덩이 ↔ Delta] 를 옮기는 일만 한다.
//
// ★ 도구줄은 우리 것을 그대로 쓴다
//   Quill 이 주는 도구줄은 영어에 생김새도 다르다. 화면은 지금 쓰던 그대로 두고
//   단추가 Quill 을 부르게만 했다.

const QL = {};          // 'ff3' → Quill 하나

// 글자 한 조각에 서식을 입힌다 (Delta → 안전한 글자)
function qlWrap(text, at){
  let h = esc(String(text == null ? '' : text));
  if(!h) return '';
  at = at || {};
  if(at.bold)      h = '<b>' + h + '</b>';
  if(at.italic)    h = '<i>' + h + '</i>';
  if(at.underline) h = '<u>' + h + '</u>';
  if(at.strike)    h = '<s>' + h + '</s>';
  return h;
}

// 안전한 글자 → Delta 조각들 (<b>·<i>·<u>·<s>·<br> 만 알아본다)
function qlOps(html){
  const out = [];
  const put = (txt, at) => {
    String(txt == null ? '' : txt).split('\n').forEach((piece, i) => {
      if(i) out.push({ insert:'\n' });
      if(piece) out.push(Object.keys(at).length
        ? { insert:piece, attributes:Object.assign({}, at) }
        : { insert:piece });
    });
  };
  const walk = (node, at) => {
    [].slice.call(node.childNodes).forEach(n => {
      if(n.nodeType === 3){ put(String(n.nodeValue).replace(/\u00a0/g, ' '), at); return; }
      if(n.nodeType !== 1) return;
      if(n.tagName === 'BR'){ out.push({ insert:'\n' }); return; }
      const k = RICH_TAGS[n.tagName];
      const at2 = Object.assign({}, at);
      if(k === 'b') at2.bold = true;
      else if(k === 'i') at2.italic = true;
      else if(k === 'u') at2.underline = true;
      else if(k === 's') at2.strike = true;
      walk(n, at2);
    });
  };
  try{ walk(new DOMParser().parseFromString(String(html == null ? '' : html), 'text/html').body, {}); }
  catch(_){ put(html, {}); }
  return out;
}
// 옛 글 (꼬리표가 없고 **별표** 로만 굵게 하던 시절)
function qlOpsPlain(v){
  const out = [];
  String(v == null ? '' : v).split('\n').forEach((ln, i) => {
    if(i) out.push({ insert:'\n' });
    ln.split(/(\*\*[^*\n]+\*\*)/).forEach(seg => {
      if(!seg) return;
      if(/^\*\*[^*\n]+\*\*$/.test(seg)) out.push({ insert:seg.slice(2, -2), attributes:{ bold:true } });
      else out.push({ insert:seg });
    });
  });
  return out;
}

// 덩이 → Delta (편집기에 넣을 것)
function blocksToDelta(blocks){
  const ops = [];
  const push = list => list.forEach(o => ops.push(o));
  const endLine = attr => ops.push(attr ? { insert:'\n', attributes:attr } : { insert:'\n' });
  (blocks || []).forEach(x => {
    if(!x) return;
    if(x.t === 'photo'){ ops.push({ insert:{ image:String(x.v || '') } }); endLine(null); return; }
    if(x.t === 'list'){
      const a = { list: x.ord ? 'ordered' : 'bullet' };
      (x.items || []).forEach(it => { push(qlOps(it)); endLine(a); });
      return;
    }
    if(x.t === 'head'){ push(x.h ? qlOps(x.v) : qlOpsPlain(x.v)); endLine({ header:4 }); return; }
    push(x.h ? qlOps(x.v) : qlOpsPlain(x.v));
    endLine(null);
  });
  if(!ops.length) ops.push({ insert:'\n' });
  return { ops };
}

// Delta → 덩이 (저장할 것). 보이는 순서 그대로 담는다.
// ★ 줄 속성(소제목·목록)은 그 줄을 끝내는 '\n' 에 붙어 있다. Delta 의 약속이다.
function deltaToBlocks(delta){
  const ops = (delta && delta.ops) || [];
  const lines = [];
  let runs = [];
  ops.forEach(op => {
    const ins = op.insert;
    if(ins && typeof ins === 'object'){
      if(ins.image) runs.push({ img:String(ins.image) });
      return;
    }
    const at = op.attributes || {};
    const txt = String(ins == null ? '' : ins);
    let start = 0;
    for(let i = 0; i < txt.length; i++){
      if(txt[i] !== '\n') continue;
      const seg = txt.slice(start, i);
      if(seg) runs.push({ t:seg, at });
      lines.push({ runs, attr:at });
      runs = []; start = i + 1;
    }
    const tail = txt.slice(start);
    if(tail) runs.push({ t:tail, at });
  });
  if(runs.length) lines.push({ runs, attr:{} });

  const out = [];
  let buf = [];
  const flush = () => {
    const v = buf.join('<br>').replace(/^(<br>)+/, '').replace(/(<br>)+$/, '');
    buf = [];
    if(richText(v).trim()) out.push({ t:'text', h:1, v });
  };
  lines.forEach(L => {
    const imgs = L.runs.filter(r => r.img);
    const html = L.runs.filter(r => !r.img).map(r => qlWrap(r.t, r.at)).join('');
    if(imgs.length){
      // 사진과 글이 한 줄에 섞였으면 글을 먼저 닫고 사진을 따로 놓는다
      if(richText(html).trim()) buf.push(html);
      flush();
      imgs.forEach(r => out.push({ t:'photo', v:r.img }));
      return;
    }
    if(L.attr && L.attr.list){
      flush();
      const ord = L.attr.list === 'ordered' ? 1 : 0;
      const last = out[out.length - 1];
      if(!richText(html).trim()) return;
      if(last && last.t === 'list' && last.ord === ord) last.items.push(html);
      else out.push({ t:'list', ord, items:[html] });
      return;
    }
    if(L.attr && L.attr.header){
      flush();
      const v = html.replace(/<br>/g, ' ').replace(/\s+/g, ' ').trim();
      if(richText(v).trim()) out.push({ t:'head', h:1, v });
      return;
    }
    buf.push(html);
  });
  flush();
  return out;
}

// 편집기가 들고 있는 것을 덩이로 바꾼다 (저장할 때 부른다)
function qlRead(fid){
  const q = QL[fid];
  if(q) return deltaToBlocks(q.getContents());
  // Quill 이 없어 맨 글자로 쓴 경우 — 글을 잃지는 않는다
  const el = document.getElementById(fid);
  const v = el ? String(el.innerText || el.textContent || '') : '';
  return v.trim() ? [{ t:'text', v }] : [];
}

// 편집기 하나를 세운다. 폼이 화면에 붙은 뒤에 부른다.
function qlMake(fid, blocks, placeholder){
  const host = document.getElementById(fid);
  if(!host) return null;
  if(typeof Quill === 'undefined'){
    // ★ 여기 오면 안 된다 (Quill 은 이 파일 안에 함께 들어 있다).
    //   그래도 글을 못 쓰게 되는 것보다는 맨 글자라도 쓰게 두는 편이 낫다.
    host.setAttribute('contenteditable', 'true');
    host.textContent = blocksText(blocks);
    return null;
  }
  const q = new Quill(host, {
    placeholder: placeholder || '',
    // ★ 받을 서식을 여기 적힌 것으로만 못 박는다. 남의 글을 붙여넣어도
    //   글자색·글꼴·표 같은 것이 딸려 들어오지 않는다.
    formats: ['bold', 'italic', 'underline', 'strike', 'header', 'list', 'image'],
    modules: { toolbar: false, clipboard: { matchVisual: false } }
  });
  QL[fid] = q;
  q.setContents(blocksToDelta(blocks), 'silent');
  // 사진이 골라졌을 때만 [사진 지우기] 를 보여 준다
  q.on('selection-change', () => qlShowDel(fid));
  q.root.addEventListener('paste', e => onRichPaste(e, fid), true);
  return q;
}
function qlKill(){
  Object.keys(QL).forEach(k => { delete QL[k]; });
}
// 지금 고른 것 안에 사진이 있나
function qlPickedImg(fid){
  const q = QL[fid]; if(!q) return false;
  const r = q.getSelection();
  if(!r || !r.length) return false;
  const c = q.getContents(r.index, r.length);
  return ((c && c.ops) || []).some(o => o.insert && o.insert.image);
}
// 고른 사진에 테두리를 둘러 준다 — 무엇이 지워질지 눈에 보여야 한다
function qlMarkImg(fid, img){
  const q = QL[fid]; if(!q) return;
  [].forEach.call(q.root.querySelectorAll('img'), im => im.classList.toggle('sel', im === img));
}
function qlShowDel(fid, img){
  const on = qlPickedImg(fid);
  const b = document.getElementById(fid + '_del');
  if(b) b.style.display = on ? '' : 'none';
  if(!on) qlMarkImg(fid, null);
  else if(img) qlMarkImg(fid, img);
}
function richStatus(id, msg){
  const el = document.getElementById(id + '_st');
  if(el){ el.textContent = msg || ''; el.style.display = msg ? '' : 'none'; }
}

// ── 도구줄 — 워드패드에 있는 것을 그대로 둔다.
// ★ 글자 얼굴(가/A/А)은 사전을 거친다. 나라마다 글자가 다르다.
const RICH_TOOLS = [
  { name:'굵게',     fn:'richCmd',  arg:'bold',      face:'<b>가</b>' },
  { name:'기울임',   fn:'richCmd',  arg:'italic',    face:'<i>가</i>' },
  { name:'밑줄',     fn:'richCmd',  arg:'underline', face:'<u>가</u>' },
  { name:'취소선',   fn:'richCmd',  arg:'strike',    face:'<s>가</s>' },
  { sep:true },
  { name:'소제목',   fn:'richHead' },
  { name:'글머리표', fn:'richList', arg:'bullet',    face:'•' },
  { name:'번호',     fn:'richList', arg:'ordered',   face:'1.' },
  { sep:true }
];
// 고른 글자에 서식을 걸고 뺀다 (다시 누르면 되돌린다)
function richCmd(fid, name){
  const q = QL[fid]; if(!q) return;
  q.focus();
  const now = q.getFormat();
  q.format(name, !now[name], 'user');
}
// 커서가 있는 줄을 목록으로 (다시 누르면 되돌린다)
function richList(fid, kind){
  const q = QL[fid]; if(!q) return;
  q.focus();
  const now = q.getFormat();
  q.format('list', now.list === kind ? false : kind, 'user');
}
// 커서가 있는 줄을 소제목으로. ★ 줄 전체를 바꾼다 — 글자 몇 개만 소제목이 될 일은 없다.
function richHead(fid){
  const q = QL[fid]; if(!q) return;
  q.focus();
  const now = q.getFormat();
  q.format('header', now.header ? false : 4, 'user');
}
// 옛 이름 — 부르는 곳이 남아 있을 수 있다
function richBold(fid){ richCmd(fid, 'bold'); }

// ── 편집기 안 사진
// ★ Quill 에서 사진은 글자 한 개다. 그래서 백스페이스로 그냥 지워진다 —
//   3.78 에서 따로 붙였던 백스페이스 처리는 이제 필요 없어 뺐다.
//   눌러서 지우는 길은 그대로 둔다. 손가락으로는 그편이 확실하다.
function richTap(e, fid){
  const q = QL[fid]; if(!q) return;
  const el = e && e.target;
  if(el && el.tagName === 'IMG'){
    try{
      const blot = Quill.find(el);
      if(blot) q.setSelection(q.getIndex(blot), 1, 'user');
    }catch(_){}
    qlShowDel(fid, el);
    return;
  }
  qlShowDel(fid);
}
function richDelImg(fid){
  const q = QL[fid]; if(!q) return;
  if(!qlPickedImg(fid)){ alert(t('지울 사진을 먼저 한 번 눌러 주세요.')); return; }
  const r = q.getSelection();
  q.deleteText(r.index, r.length, 'user');
  qlShowDel(fid);
}

// ── 넣기 (사진 단추 · 기록 넣기 · 붙여넣기가 모두 이 길로 온다)
// 커서 자리(없으면 맨 끝)에 덩이들을 꽂는다.
function richInsert(fid, blocks, at){
  const q = QL[fid]; if(!q) return;
  let i = (at == null) ? ((q.getSelection() || {}).index) : at;
  if(i == null) i = Math.max(0, q.getLength() - 1);
  (blocks || []).forEach(x => {
    if(!x) return;
    if(x.t === 'photo'){
      q.insertEmbed(i, 'image', String(x.v || ''), 'user'); i += 1;
      q.insertText(i, '\n', 'user'); i += 1;
      return;
    }
    const s = (x.h ? richText(x.v) : String(x.v == null ? '' : x.v));
    if(!s) return;
    q.insertText(i, s + '\n', 'user'); i += s.length + 1;
  });
  q.setSelection(i, 0, 'user');
  q.focus();
}
// 사진을 줄이는 동안 커서 자리를 잃지 않게 지금 자리를 적어 둔다
function richMark(fid){
  const q = QL[fid]; if(!q) return null;
  const r = q.getSelection();
  return r ? r.index : Math.max(0, q.getLength() - 1);
}
// 사진 넣기 단추 (붙여넣기가 안 되는 곳에서도 쓸 수 있게)
function richPickPhoto(fid){
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
  inp.onchange = ()=>{
    const fs2 = [].slice.call(inp.files || []);
    if(!fs2.length) return;
    const mark = richMark(fid);
    richStatus(fid, t('사진을 넣는 중…'));
    resizePhotos(fs2, out => {
      richInsert(fid, out.map(u => ({ t:'photo', v:u })), mark);
      richStatus(fid, '');
    });
  };
  inp.click();
}
// 붙여넣기 — 글만이면 Quill 이 알아서 한다. 사진이 섞였을 때만 우리가 받는다.
// ★ 사진은 그냥 두면 원본 그대로 들어가 글 하나가 몇 MB 가 된다. 줄여서 넣어야 한다.
function onRichPaste(e, fid){
  const q = QL[fid]; if(!q) return;
  const cd = e.clipboardData || (typeof window !== 'undefined' && window.clipboardData);
  if(!cd) return;
  const html  = cd.getData('text/html') || '';
  const plain = cd.getData('text/plain') || '';
  const files = [].slice.call(cd.files || []).filter(f => /^image\//.test(f.type || ''));
  const parts = pasteParts(html, plain);
  const photos = parts.filter(x => x.t === 'photo').map(x => x.v).concat(files);
  if(!photos.length) return;                 // 글자만 — Quill 에 맡긴다
  e.preventDefault(); e.stopPropagation();

  const mark = richMark(fid);
  richStatus(fid, t('사진을 넣는 중…'));
  resizePhotos(photos, out => {
    let k = 0;
    const seq = parts.map(x => x.t === 'photo' ? { t:'photo', v: out[k++] } : x)
                     .filter(x => x.t !== 'photo' || x.v);
    while(k < out.length) seq.push({ t:'photo', v: out[k++] });
    richInsert(fid, seq, mark);
    richStatus(fid, '');
  });
}
