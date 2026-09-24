/* PUFFLOG Supabase data layer. UI is intentionally untouched. */
(() => {
  const SUPABASE_URL = 'https://wmmpqbaghfkgruxzgjvm.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3WMPBKTjhPqLTUC4x48m4Q_jcccIfPE';

  const load = () => {
    if (!window.supabase?.createClient) return;
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    window.PufflogSupabase = client;

    const requireUser = async () => {
      const { data, error } = await client.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new Error('Authentication required');
      return data.user;
    };

    window.PufflogData = {
      currentUser: async () => {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        return data.user;
      },

      profile: async (userId) => {
        const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) throw error;
        return data;
      },

      upsertProfile: async (profile) => {
        const user = await requireUser();
        const { data, error } = await client.from('profiles').upsert({ ...profile, id: user.id }, { onConflict: 'id' }).select().single();
        if (error) throw error;
        return data;
      },

      posts: async (limit = 50) => {
        const { data, error } = await client.from('posts')
          .select('*, profiles(username, display_name, avatar_url)')
          .order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data || [];
      },

      userPosts: async (userId, limit = 50) => {
        const { data, error } = await client.from('posts')
          .select('*, profiles(username, display_name, avatar_url)')
          .eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
        if (error) throw error;
        return data || [];
      },

      createPost: async (content, mediaUrl = null, mediaType = null) => {
        const user = await requireUser();
        const { data, error } = await client.from('posts').insert({
          user_id: user.id, content: content || null, media_url: mediaUrl, media_type: mediaType
        }).select().single();
        if (error) throw error;
        return data;
      },

      uploadMedia: async (file) => {
        const user = await requireUser();
        if (!file) throw new Error('No file selected');
        const safeName = String(file.name || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error } = await client.storage.from('pufflog-media').upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type || undefined
        });
        if (error) throw error;
        const { data } = client.storage.from('pufflog-media').getPublicUrl(path);
        return { path, url: data.publicUrl, type: file.type || '' };
      },

      deletePost: async (postId) => {
        const user = await requireUser();
        const { error } = await client.from('posts').delete().eq('id', postId).eq('user_id', user.id);
        if (error) throw error;
      },

      like: async (postId) => {
        const user = await requireUser();
        const { error } = await client.from('post_likes').upsert({ post_id: postId, user_id: user.id }, { onConflict: 'post_id,user_id' });
        if (error) throw error;
      },

      unlike: async (postId) => {
        const user = await requireUser();
        const { error } = await client.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        if (error) throw error;
      },

      likeState: async (postId) => {
        const user = await client.auth.getUser();
        if (!user.data.user) return false;
        const { data, error } = await client.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', user.data.user.id).maybeSingle();
        if (error) throw error;
        return !!data;
      },

      comments: async (postId) => {
        const { data, error } = await client.from('comments').select('*, profiles(username, display_name, avatar_url)').eq('post_id', postId).order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      },

      addComment: async (postId, content) => {
        const user = await requireUser();
        const { data, error } = await client.from('comments').insert({ post_id: postId, user_id: user.id, content }).select().single();
        if (error) throw error;
        return data;
      },

      follow: async (followingId) => {
        const user = await requireUser();
        if (user.id === followingId) throw new Error('You cannot follow yourself');
        const { error } = await client.from('follows').upsert({ follower_id: user.id, following_id: followingId }, { onConflict: 'follower_id,following_id' });
        if (error) throw error;
      },

      unfollow: async (followingId) => {
        const user = await requireUser();
        const { error } = await client.from('follows').delete().eq('follower_id', user.id).eq('following_id', followingId);
        if (error) throw error;
      },

      isFollowing: async (followingId) => {
        const user = await client.auth.getUser();
        if (!user.data.user) return false;
        const { data, error } = await client.from('follows').select('follower_id').eq('follower_id', user.data.user.id).eq('following_id', followingId).maybeSingle();
        if (error) throw error;
        return !!data;
      },

      messages: async (otherUserId) => {
        const user = await requireUser();
        const { data, error } = await client.from('messages').select('*').or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
        ).order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      },

      sendMessage: async (receiverId, content) => {
        const user = await requireUser();
        const { data, error } = await client.from('messages').insert({ sender_id: user.id, receiver_id: receiverId, content }).select().single();
        if (error) throw error;
        return data;
      },

      notifications: async () => {
        const user = await requireUser();
        const { data, error } = await client.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
      }
    };

    window.dispatchEvent(new CustomEvent('pufflog:supabase-ready'));
  };

  if (window.supabase?.createClient) load();
  else {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
    script.onload = load;
    script.onerror = () => console.warn('PUFFLOG: Supabase client failed to load.');
    document.head.appendChild(script);
  }
})();
