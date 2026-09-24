/* PUFFLOG Supabase client bootstrap. Public publishable key only. */
(() => {
  const SUPABASE_URL = 'https://wmmpqbaghfkgruxzgjvm.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_3WMPBKTjhPqLTUC4x48m4Q_jcccIfPE';
  const script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  script.onload = () => {
    if (window.supabase && window.supabase.createClient) {
      window.PufflogSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      window.dispatchEvent(new CustomEvent('pufflog:supabase-ready'));
    }
  };
  script.onerror = () => console.warn('PUFFLOG: Supabase client failed to load.');
  document.head.appendChild(script);
})();
