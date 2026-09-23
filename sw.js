const CACHE='pufflog-v11';

const PUFFLOG_FIX=`
<style id="pufflog-direct-nav-fix">
.appNav{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:0!important;width:100%!important;left:0!important;right:0!important;align-items:stretch!important}
.appNav button{min-width:0!important;width:100%!important;max-width:none!important;white-space:nowrap!important;font-size:16px!important;padding:10px 2px!important;box-sizing:border-box!important}
.appNav button span{font-size:28px!important;line-height:1!important;display:block;margin-bottom:4px}
@media(max-width:420px){.appNav button{font-size:16px!important;padding-left:1px!important;padding-right:1px!important}.appNav button span{font-size:26px!important}}
.bottom{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:7px!important;justify-content:stretch!important;align-items:stretch!important}
.bottom .appNav{display:contents!important}.bottom>button,.bottom .appNav>button{min-width:0!important;max-width:none!important;width:100%!important;flex-shrink:1!important}
#pufflogUploadInput{display:none!important}
/* Uploaded posts are allowed only on Home and Profile. */
body.pufflog-posts-hidden #pufflogHomePosts,
body.pufflog-posts-hidden #pufflogHomePosts *{display:none!important}
body.pufflog-posts-hidden .phpCard{display:none!important}
body.pufflog-posts-hidden [data-pufflog-post]{display:none!important}
</style>`;

const PUFFLOG_FIX_JS=`
<script id="pufflog-direct-nav-fix-js">
(function(){
  if(window.__pufflogDirectNavFixV4)return;window.__pufflogDirectNavFixV4=true;

  function removeLiteralArtifacts(){
    try{
      const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
      const remove=[];let n;
      while(n=walker.nextNode()){
        const t=(n.nodeValue||'').trim();
        if(!t)continue;
        if(/^(?:(?:\\n|\\r|n\\/n|\\/n|n|\\\\n|\\\\r)){1,}$/.test(t)||/^(?:\\\\n|\\\\r|\\n|\\r|n\\/n|\\/n|n)+$/.test(t))remove.push(n);
      }
      remove.forEach(x=>x.parentNode&&x.parentNode.removeChild(x));
    }catch(e){}
  }

  function currentPage(){
    const profile=document.getElementById('instagramProfilePage');
    if(profile && (profile.classList.contains('show') || getComputedStyle(profile).display!=='none'))return 'profile';
    const active=document.querySelector('.appNav button.active[data-page],button[data-page][aria-current="page"]');
    if(active?.dataset.page)return active.dataset.page;
    const selectors=[
      ['dms',['#dmsPage','.dmsPage','[data-page-view="dms"]']],
      ['search',['#searchPage','.searchPage','[data-page-view="search"]']],
      ['game',['#gamePage','.gamePage','[data-page-view="game"]']],
      ['stats',['#statsPage','.statsPage','[data-page-view="stats"]']]
    ];
    for(const [name,ids] of selectors){
      for(const id of ids){
        const el=document.querySelector(id);
        if(el && (el.classList.contains('activePage')||el.classList.contains('show')||getComputedStyle(el).display!=='none'))return name;
      }
    }
    return 'home';
  }

  function setPostVisibility(){
    const page=currentPage();
    const allowed=page==='home'||page==='profile';
    document.body.classList.toggle('pufflog-posts-hidden',!allowed);

    const root=document.getElementById('pufflogHomePosts');
    if(root){
      if(allowed){root.classList.add('pufflog-home-visible');root.removeAttribute('aria-hidden');root.style.removeProperty('display');}
      else{root.classList.remove('pufflog-home-visible');root.setAttribute('aria-hidden','true');root.style.setProperty('display','none','important');}
    }

    document.querySelectorAll('.phpCard,[data-pufflog-post]').forEach(card=>{
      const inHome=!!card.closest('#pufflogHomePosts');
      const inProfile=!!card.closest('#instagramProfilePage');
      const show=allowed && (page==='home' ? inHome : inProfile);
      card.style.setProperty('display',show?'':'none','important');
      if(show)card.removeAttribute('aria-hidden');else card.setAttribute('aria-hidden','true');
    });
  }

  function repair(){removeLiteralArtifacts();setPostVisibility();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',repair,{once:true});else repair();
  document.addEventListener('click',e=>{if(e.target.closest?.('button[data-page],.appNav button'))setTimeout(repair,0)},true);
  window.addEventListener('load',()=>{repair();setTimeout(repair,100);setTimeout(repair,500);setTimeout(repair,1200);setTimeout(repair,2500)});
  new MutationObserver(()=>repair()).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','aria-current','style','hidden']});
})();
</script>`;

function cleanHTML(text){
  let out=text;
  // Remove legacy post scanners/visibility patches by element id before the page runs them.
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
