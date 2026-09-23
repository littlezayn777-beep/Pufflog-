const CACHE = 'pufflog-v5';

const PUFFLOG_FIX = `
<style id="pufflog-direct-nav-fix">
.appNav{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:0!important;width:100%!important;left:0!important;right:0!important}
.appNav button{min-width:0!important;width:100%!important;white-space:nowrap!important}
.appNav button span{font-size:28px!important;line-height:1!important;display:block;margin-bottom:4px}
@media(max-width:420px){.appNav button{font-size:10px!important;padding-left:1px!important;padding-right:1px!important}.appNav button span{font-size:22px!important}}
#pufflogUploadInput{display:none!important}
#pufflogUploadModal{display:none;position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);align-items:flex-end}
#pufflogUploadModal.show{display:flex}
#pufflogUploadCard{width:100%;max-width:760px;margin:0 auto;background:linear-gradient(145deg,#245a2c,#173f20);border:1px solid #6d9c50;border-radius:22px 22px 0 0;padding:18px 15px calc(20px + env(safe-area-inset-bottom));box-shadow:0 -18px 45px rgba(0,0,0,.45)}
#pufflogUploadCard h2{margin:0 0 5px;font-size:20px}#pufflogUploadCard p{margin:0 0 13px;color:#c4d6b6;font-size:12px}
#pufflogUploadCaption{width:100%;box-sizing:border-box;border:1px solid rgba(181,237,88,.3);border-radius:12px;background:rgba(255,255,255,.06);color:#fff;padding:11px;font:inherit;outline:0;margin-bottom:9px}
#pufflogUploadActions{display:flex;gap:8px}#pufflogUploadActions button{flex:1;border-radius:12px;padding:11px;border:1px solid #6d9c50;background:#315c32;color:#fff;font-weight:900}#pufflogUploadActions #pufflogUploadChoose{background:linear-gradient(135deg,#b5ed58,#61d66c);color:#143019;border-color:transparent}
</style>`;

const PUFFLOG_FIX_JS = `
<script id="pufflog-direct-nav-fix-js">
(function(){
  if(window.__pufflogDirectNavFix)return;
  window.__pufflogDirectNavFix=true;

  function removeArtifact(){
    try{
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const remove=[]; let n;
      while(n=walker.nextNode()){
        const t=(n.nodeValue||'').trim();
        if(t==='\\n\\n' || t==='\\\\n\\\\n') remove.push(n);
      }
      remove.forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
    }catch(e){}
  }

  function ensureUploadUI(){
    const nav=document.querySelector('.appNav');
    if(!nav || nav.querySelector('#pufflogUploadNav'))return;
    const buttons=[...nav.querySelectorAll('button[data-page]')];
    const dm=buttons.find(b=>b.dataset.page==='dms');
    const search=buttons.find(b=>b.dataset.page==='search');
    if(!dm || !search)return;
    const b=document.createElement('button');
    b.type='button'; b.id='pufflogUploadNav'; b.setAttribute('aria-label','Upload post');
    b.innerHTML='<span>＋</span>Upload';
    b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();openUpload();});
    nav.insertBefore(b,search);
  }

  function makeUploadModal(){
    if(document.getElementById('pufflogUploadModal'))return;
    const input=document.createElement('input');
    input.type='file'; input.id='pufflogUploadInput'; input.accept='image/*,video/*';
    document.body.appendChild(input);
    const modal=document.createElement('div'); modal.id='pufflogUploadModal';
    modal.innerHTML='<div id="pufflogUploadCard"><h2>Upload Post</h2><p>Choose a photo or video. It will appear in your PUFFLOG Home feed.</p><textarea id="pufflogUploadCaption" rows="3" maxlength="500" placeholder="Write a caption…"></textarea><div id="pufflogUploadActions"><button type="button" id="pufflogUploadCancel">Cancel</button><button type="button" id="pufflogUploadChoose">Choose media</button></div></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click',e=>{if(e.target===modal)closeUpload();});
    document.getElementById('pufflogUploadCancel').onclick=closeUpload;
    document.getElementById('pufflogUploadChoose').onclick=()=>input.click();
    input.addEventListener('change',handleFile);
  }

  function openUpload(){
    makeUploadModal();
    const m=document.getElementById('pufflogUploadModal');
    m.classList.add('show');
    document.getElementById('pufflogUploadCaption')?.focus();
  }
  function closeUpload(){
    document.getElementById('pufflogUploadModal')?.classList.remove('show');
    const i=document.getElementById('pufflogUploadInput'); if(i)i.value='';
  }
  function toastSafe(message){
    try{if(typeof window.toast==='function'){window.toast(message);return}}catch(e){}
    alert(message);
  }
  function handleFile(e){
    const f=e.target.files&&e.target.files[0]; if(!f)return;
    if(f.size>7*1024*1024){toastSafe('Please choose a file under 7 MB.');e.target.value='';return;}
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const key='PUFFLOG_POSTS_V1';
        const posts=JSON.parse(localStorage.getItem(key)||'[]');
        const display=(document.getElementById('name')?.textContent||'pufflog').trim().replace(/^@/,'')||'pufflog';
        posts.push({media:String(reader.result),caption:String(document.getElementById('pufflogUploadCaption')?.value||''),user:'@'+display,created_at:new Date().toISOString()});
        localStorage.setItem(key,JSON.stringify(posts.slice(-20)));
        closeUpload();
        toastSafe('Post uploaded successfully.');
      }catch(err){console.error('PUFFLOG upload:',err);toastSafe('Upload failed. Try a smaller file.');}
    };
    reader.onerror=()=>toastSafe('Could not read that file.');
    reader.readAsDataURL(f);
  }

  function run(){
    removeArtifact(); ensureUploadUI(); makeUploadModal();
    const obs=new MutationObserver(()=>{removeArtifact();ensureUploadUI();});
    obs.observe(document.body,{subtree:true,childList:true});
    setTimeout(()=>{removeArtifact();ensureUploadUI();},500);
    setTimeout(()=>{removeArtifact();ensureUploadUI();},1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
</script>`;

async function transformResponse(response){
  if(!response || !response.ok)return response;
  const text=await response.text();
  if(text.includes('pufflog-direct-nav-fix-js'))return new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers});
  const injected=text.replace(/<\/body>/i,PUFFLOG_FIX+PUFFLOG_FIX_JS+'</body>');
  const headers=new Headers(response.headers);
  headers.set('content-type','text/html; charset=utf-8');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    './','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'
  ])));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method!=='GET' || event.request.destination!=='document')return;
  event.respondWith(
    fetch(event.request).then(async response=>{
      const transformed=await transformResponse(response);
      try{const cache=await caches.open(CACHE);await cache.put(event.request,transformed.clone());}catch(e){}
      return transformed;
    }).catch(async()=>{
      const cached=await caches.match(event.request)||await caches.match('./index.html');
      if(cached)return transformResponse(cached);
      return new Response('PUFFLOG is offline.',{status:503,headers:{'content-type':'text/plain'}});
    })
  );
});
