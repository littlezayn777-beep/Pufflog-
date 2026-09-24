/* PUFFLOG backend bridge — UI-safe Supabase integration. */
(() => {
  const ready = (fn) => {
    if (window.PufflogSupabase) fn(window.PufflogSupabase);
    else window.addEventListener('pufflog:supabase-ready', () => fn(window.PufflogSupabase), { once: true });
  };

  const api = {
    client: null,
    async session() {
      const { data, error } = await this.client.auth.getSession();
      if (error) throw error;
      return data.session;
    },
    async signUp(email, password, username = '') {
      const { data, error } = await this.client.auth.signUp({ email, password });
      if (error) throw error;
      if (data.user) await this.ensureProfile(data.user, username);
      return data;
    },
    async signIn(email, password) {
      const { data, error } = await this.client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.user) await this.ensureProfile(data.user);
      return data;
    },
    async signOut() {
      const { error } = await this.client.auth.signOut();
      if (error) throw error;
    },
    async ensureProfile(user, username = '') {
      const profile = { id: user.id, username: username || user.user_metadata?.username || null, display_name: user.user_metadata?.display_name || null };
      const { data, error } = await this.client.from('profiles').upsert(profile, { onConflict: 'id' }).select().single();
      if (error) throw error;
      return data;
    },
    async getProfile(userId) {
      const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).single();
      if (error) throw error;
      return data;
    },
    async updateProfile(userId, patch) {
      const { data, error } = await this.client.from('profiles').update(patch).eq('id', userId).select().single();
      if (error) throw error;
      return data;
    },
    async getPosts(limit = 50) {
      const { data, error } = await this.client.from('posts').select('*,profiles(username,display_name,avatar_url)').order('created_at', { ascending: false }).limit(limit);
      if (error) throw error;
      return data || [];
    },
    async createPost(post) {
      const session = await this.session();
      if (!session) throw new Error('Please sign in first.');
      const { data, error } = await this.client.from('posts').insert({ ...post, user_id: session.user.id }).select().single();
      if (error) throw error;
      return data;
    },
    async deletePost(postId) {
      const { error } = await this.client.from('posts').delete().eq('id', postId);
      if (error) throw error;
    },
    async likePost(postId) {
      const session = await this.session();
      if (!session) throw new Error('Please sign in first.');
      const { error } = await this.client.from('post_likes').insert({ post_id: postId, user_id: session.user.id });
      if (error && error.code !== '23505') throw error;
    },
    async unlikePost(postId) {
      const session = await this.session();
      if (!session) return;
      const { error } = await this.client.from('post_likes').delete().eq('post_id', postId).eq('user_id', session.user.id);
      if (error) throw error;
    },
    async comment(postId, content) {
      const session = await this.session();
      if (!session) throw new Error('Please sign in first.');
      const { data, error } = await this.client.from('comments').insert({ post_id: postId, user_id: session.user.id, content }).select().single();
      if (error) throw error;
      return data;
    },
    async follow(userId) {
      const session = await this.session();
      if (!session) throw new Error('Please sign in first.');
      const { error } = await this.client.from('follows').insert({ follower_id: session.user.id, following_id: userId });
      if (error && error.code !== '23505') throw error;
    },
    async unfollow(userId) {
      const session = await this.session();
      if (!session) return;
      const { error } = await this.client.from('follows').delete().eq('follower_id', session.user.id).eq('following_id', userId);
      if (error) throw error;
    },
    async sendMessage(receiverId, content) {
      const session = await this.session();
      if (!session) throw new Error('Please sign in first.');
      const { data, error } = await this.client.from('messages').insert({ sender_id: session.user.id, receiver_id: receiverId, content }).select().single();
      if (error) throw error;
      return data;
    },
    async getConversation(userId) {
      const session = await this.session();
      if (!session) return [];
      const { data, error } = await this.client.from('messages').select('*').or(`and(sender_id.eq.${session.user.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${session.user.id})`).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    async notifications() {
      const session = await this.session();
      if (!session) return [];
      const { data, error } = await this.client.from('notifications').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  };

  ready((client) => {
    api.client = client;
    window.PufflogBackend = api;
    window.dispatchEvent(new CustomEvent('pufflog:backend-ready'));
  });
})();
