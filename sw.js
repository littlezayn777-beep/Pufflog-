const CACHE='pufflog-v10';

const PUFFLOG_FIX=`
<style id="pufflog-direct-nav-fix">
.appNav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:0!important;width:100%!important;left:0!important;right:0!important;align-items:stretch!important}
.appNav button{min-width:0!important;width:100%!important;max-width:none!important;white-space:nowrap!important;font-size:16px!important;padding:10px 2px!important;box-sizing:border-box!important}
.appNav button span{font-size:28px!important;line-height:1!important;display:block;margin-bottom:4px}
@media(max-width:420px){.appNav button{font-size:16px!important;padding-left:1px!important;padding-right:1px!important}.appNav button span{font-size:26px!important}}
.bottom{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;justify-content:stretch!important;align-items:stretch!important}
.bottom .appNav{display:contents!important}.bottom>button,.bottom .appNav>button{min-width:0!important;max-width:none!important;width:100%!important;flex-shrink:1!important}
#pufflogUploadInput{display:none!important}
#pufflogHomePosts{display:none!important}
#pufflogHomePosts.pufflog-home-visible{display:block!important}
</style>`;

const PUFFLOG_FIX_JS=`
<script id="pufflog-direct-nav-fix-js">
(function(){
  if(window.__pufflogDirectNavFixV3)return;window.__pufflogDirectNavFixV3=true;

  function removeLiteralArtifacts(){
    try{
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const remove=[];let n;
      while(n=walker.nextNode()){
        const t=(n.nodeValue||'').trim();
        if(!t)continue;
        if(/^(?:(?:\\n|\\r|n\\/n|\\/n|n|\\\\n|\\\\r)){1,}$/.test(t))remove.push(n);
      }
      remove.forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
    }catch(e){}
  }

  function currentPage(){
    const profile=document.getElementById('instagramProfilePage');
    if(profile?.classList.contains('show'))return 'profile';
    const active=document.querySelector('.appNav button.active[data-page]');
    if(active?.dataset.page)return active.dataset.page;
    const pageIds=[['dms','dmsPage'],['search','searchPage'],['game','gamePage'],['stats','statsPage']];
    for(const [name,id] of pageIds){const el=document.getElementById(id);if(el?.classList.contains('activePage'))return name;}
    return 'home';
  }

  function placeAndScopeHomePosts(){
    const root=document.getElementById('pufflogHomePosts');
    if(!root)return;
    const app=document.querySelector('.app');
    if(app&&root.parentElement!==app)app.appendChild(root);
    const page=currentPage();
    const home=page==='home';
    root.classList.toggle('pufflog-home-visible',home);
    root.style.setProperty('display',home?'block':'none','important');
    if(!home)root.setAttribute('aria-hidden','true');else root.removeAttribute('aria-hidden');
  }

  function repair(){removeLiteralArtifacts();placeAndScopeHomePosts();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repair,{once:true});else repair();
  document.addEventListener('click',e=>{const b=e.target.closest?.('button[data-page]');if(b)setTimeout(repair,0)},true);
  window.addEventListener('load',()=>{repair();setTimeout(repair,250);setTimeout(repair,1000);setTimeout(repair,2500)});
  new MutationObserver(()=>repair()).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','aria-current']});
})();
</script>`;

function cleanHTML(text){
  let out=text;
  // The broken feed was caused by legacy scripts that scan every localStorage key and
  // inject media into the DOM. Remove them by element id regardless of surrounding \n markers.
  out=out.replace(/<script\\s+id=["']pufflog-home-posts-js["'][^>]*>[\\s\\S]*?<\\/script>/gi,'');
  out=out.replace(/<script\\s+id=["']pufflog-post-visibility-fix-v1-js["'][^>]*>[\\s\\S]*?<\\/script>/gi,'');
  out=out.replace(/<style\\s+id=["']pufflog-post-visibility-fix-v1["'][^>]*>[\\s\\S]*?<\\/style>/gi,'');
  // Remove stray literal newline markers that were being rendered as visible text.
  out=out.replace(/(?:\\\\n|n\\/n|\\/n)(?=\\s*(?:<|$))/g,'');
  return out;
}

async function transformResponse(response){
  if(!response||!response.ok)return response;
  const text=await response.text();
  const cleaned=cleanHTML(text);
  const injected=cleaned.includes('pufflog-direct-nav-fix-js')?cleaned:cleaned.replace(/<\\/body>/i,PUFFLOG_FIX+PUFFLOG_FIX_JS+'<\\/body>');
  const headers=new Headers(response.headers);headers.set('content-type','text/html; charset=utf-8');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'])));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||event.request.destination!=='document')return;
  event.respondWith(fetch(event.request).then(async response=>{
    const transformed=await transformResponse(response);
    try{const cache=await caches.open(CACHE);await cache.put(event.request,transformed.clone())}catch(e){}
    return transformed;
  }).catch(async()=>{
    const cached=await caches.match(event.request)||await caches.match('./index.html');
    if(cached)return transformResponse(cached);
    return new Response('PUFFLOG is offline.',{status:503,headers:{'content-type':'text/plain'}});
  }));
});
