/* PUFFLOG Supabase client foundation. UI is intentionally untouched. */
(() => {
  const SUPABASE_URL = 'https://wmmpqbaghfkgruxzgjvm.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3WMPBKTjhPqLTUC4x48m4Q_jcccIfPE';

  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    if (!window.supabase?.createClient) return;

    const client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );

    window.PufflogSupabase = client;

    window.PufflogData = {
      async currentUser() {
        const { data, error } = await client.auth.getUser();
        if (error) throw error;
        return data.user;
      },

      async profile(userId) {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (error) throw error;
        return data;
      },

      async posts(limit = 50) {
        const { data, error } = await client
          .from('posts')
          .select('*, profiles(username, display_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      },

      async createPost(content, mediaUrl = null, mediaType = null) {
        const user = await this.currentUser();
        if (!user) throw new Error('Authentication required');

        const { data, error } = await client
          .from('posts')
          .insert({
            user_id: user.id,
            content,
            media_url: mediaUrl,
            media_type: mediaType
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      },

      async messages(otherUserId) {
        const user = await this.currentUser();
        if (!user) return [];

        const { data, error } = await client
          .from('messages')
          .select('*')
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true });
        if (error) throw error;
        return data || [];
      },

      async sendMessage(receiverId, content) {
        const user = await this.currentUser();
        if (!user) throw new Error('Authentication required');

        const { data, error } = await client
          .from('messages')
          .insert({
            sender_id: user.id,
            receiver_id: receiverId,
            content
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    };

    window.dispatchEvent(new CustomEvent('pufflog:supabase-ready'));
  };

  script.onerror = () => console.warn('PUFFLOG: Supabase client failed to load.');
  document.head.appendChild(script);
})();
