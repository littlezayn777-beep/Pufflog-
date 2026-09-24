/* PUFFLOG backend bridge — UI-safe Supabase integration. */
(() => {
  const ready = (fn) => {
    if (window.PufflogSupabase) fn(window.PufflogSupabase);
    else window.addEventListener('pufflog:supabase-ready', () => fn(window.PufflogSupabase), { once: true });
  };
  const api = {
    client:null,
    async session(){const {data,error}=await this.client.auth.getSession();if(error)throw error;return data.session;},
    async signUp(email,password,username=''){const {data,error}=await this.client.auth.signUp({email,password});if(error)throw error;if(data.user)await this.ensureProfile(data.user,username);return data;},
    async signIn(email,password){const {data,error}=await this.client.auth.signInWithPassword({email,password});if(error)throw error;if(data.user)await this.ensureProfile(data.user);return data;},
    async signOut(){const {error}=await this.client.auth.signOut();if(error)throw error;},
    async ensureProfile(user,username=''){const {data,error}=await this.client.from('profiles').upsert({id:user.id,username:username||user.user_metadata?.username||null,display_name:user.user_metadata?.display_name||null},{onConflict:'id'}).select().single();if(error)throw error;return data;},
    async getProfile(userId){const {data,error}=await this.client.from('profiles').select('*').eq('id',userId).single();if(error)throw error;return data;},
    async updateProfile(userId,patch){const {data,error}=await this.client.from('profiles').update(patch).eq('id',userId).select().single();if(error)throw error;return data;},
    async getPosts(limit=50){const {data,error}=await this.client.from('posts').select('*,profiles(username,display_name,avatar_url)').order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[];},
    async createPost(post){const s=await this.session();if(!s)throw new Error('Please sign in first.');const {data,error}=await this.client.from('posts').insert({...post,user_id:s.user.id}).select().single();if(error)throw error;return data;},
    async deletePost(postId){const {error}=await this.client.from('posts').delete().eq('id',postId);if(error)throw error;},
    async likePost(postId){const s=await this.session();if(!s)throw new Error('Please sign in first.');const {error}=await this.client.from('post_likes').insert({post_id:postId,user_id:s.user.id});if(error&&error.code!=='23505')throw error;},
    async unlikePost(postId){const s=await this.session();if(!s)return;const {error}=await this.client.from('post_likes').delete().eq('post_id',postId).eq('user_id',s.user.id);if(error)throw error;},
    async comment(postId,content){const s=await this.session();if(!s)throw new Error('Please sign in first.');const {data,error}=await this.client.from('comments').insert({post_id:postId,user_id:s.user.id,content}).select().single();if(error)throw error;return data;},
    async follow(userId){const s=await this.session();if(!s)throw new Error('Please sign in first.');const {error}=await this.client.from('follows').insert({follower_id:s.user.id,following_id:userId});if(error&&error.code!=='23505')throw error;},
    async unfollow(userId){const s=await this.session();if(!s)return;const {error}=await this.client.from('follows').delete().eq('follower_id',s.user.id).eq('following_id',userId);if(error)throw error;},
    async sendMessage(receiverId,content){const s=await this.session();if(!s)throw new Error('Please sign in first.');const {data,error}=await this.client.from('messages').insert({sender_id:s.user.id,receiver_id:receiverId,content}).select().single();if(error)throw error;return data;},
    async getConversation(userId){const s=await this.session();if(!s)return [];const {data,error}=await this.client.from('messages').select('*').or(`and(sender_id.eq.${s.user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${s.user.id})`).order('created_at',{ascending:true});if(error)throw error;return data||[];},
    async notifications(){const s=await this.session();if(!s)return [];const {data,error}=await this.client.from('notifications').select('*').eq('user_id',s.user.id).order('created_at',{ascending:false});if(error)throw error;return data||[];},
    async uploadMedia(file,bucket='pufflog-media'){const s=await this.session();if(!s)throw new Error('Please sign in first.');if(!file)throw new Error('Choose an image or video first.');const ext=(file.name||'bin').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g,'')||'bin';const path=`${s.user.id}/${crypto.randomUUID()}.${ext}`;const {error}=await this.client.storage.from(bucket).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false});if(error)throw error;const {data}=this.client.storage.from(bucket).getPublicUrl(path);return {path,url:data.publicUrl};},
    async publishPost({content='',file=null}){const s=await this.session();if(!s)throw new Error('Please sign in first.');let media_url=null,media_type=null;if(file){const media=await this.uploadMedia(file);media_url=media.url;media_type=file.type||null;}const {data,error}=await this.client.from('posts').insert({user_id:s.user.id,content:String(content||'').slice(0,500),media_url,media_type}).select().single();if(error)throw error;return data;}
  };
  ready(client=>{api.client=client;window.PufflogBackend=api;window.dispatchEvent(new CustomEvent('pufflog:backend-ready'));});
})();

/* PUFFLOG production sync — connects the existing Upload UI to Supabase without redesigning it. */
(() => {
  const waitForBackend = (fn) => {
    if (window.PufflogBackend?.client) fn(window.PufflogBackend);
    else window.addEventListener('pufflog:backend-ready', () => fn(window.PufflogBackend), { once:true });
  };
  waitForBackend(api => {
    let bound=false;
    const bind=()=>{
      if(bound)return;
      const publish=document.getElementById('pufPublish');
      const fileInput=document.getElementById('pufUploadFile');
      const caption=document.getElementById('pufUploadCaption');
      if(!publish||!fileInput)return false;
      bound=true;
      publish.addEventListener('click', async (event)=>{
        if(publish.dataset.supabaseSync==='1')return;
        publish.dataset.supabaseSync='1';
        event.preventDefault();
        event.stopImmediatePropagation();
        const file=fileInput.files?.[0]||null;
        try{
          const session=await api.session();
          if(!session)throw new Error('Please sign in to publish a cloud post.');
          publish.disabled=true;
          publish.textContent='Posting…';
          await api.publishPost({content:caption?.value||'',file});
          if(typeof window.toast==='function')window.toast('Posted to PUFFLOG');
          document.getElementById('pufflogUploadModal')?.classList.remove('show');
          fileInput.value='';
          if(caption)caption.value='';
          if(typeof window.PUFFLOG_REFRESH_POSTS==='function')window.PUFFLOG_REFRESH_POSTS();
          try{await refreshCloudPosts();}catch(e){}
        }catch(err){
          console.error('PUFFLOG cloud post:',err);
          if(typeof window.toast==='function')window.toast(err?.message||'Could not publish post');
        }finally{
          publish.dataset.supabaseSync='';
          publish.disabled=false;
          publish.textContent='Post';
        }
      },true);
      return true;
    };
    const observer=new MutationObserver(()=>bind());
    observer.observe(document.body,{subtree:true,childList:true});
    bind();

    async function refreshCloudPosts(){
      const root=document.getElementById('pufflogHomePosts');
      if(!root)return;
      const session=await api.session();
      if(!session)return;
      const posts=await api.getPosts(50);
      if(!posts?.length)return;
      root.classList.add('show');
      const safe=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
      root.innerHTML='<div class="phpTitle">Posts</div>'+posts.map(p=>{
        const media=p.media_url?`<img class="phpMedia" src="${safe(p.media_url)}" loading="lazy" alt="Post">`:'';
        const user=safe(p.profiles?.username||'pufflog');
        const text=safe(p.content||'');
        return `<article class="phpCard">${media}<div class="phpBody"><div class="phpUser">@${user}</div>${text?`<div class="phpCaption">${text}</div>`:''}</div></article>`;
      }).join('');
    }
    window.PUFFLOG_CLOUD_POSTS={refresh:refreshCloudPosts};
  });
})();
