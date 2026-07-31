/**
 * Supabase browser client (CDN or bundler).
 * Requires @supabase/supabase-js — load via ESM import map or npm.
 */
(function () {
  window.BFF = window.BFF || {};

  let _client = null;

  function getConfig() {
    const cfg = (BFF.config && BFF.config.supabase) || {};
    return {
      url: cfg.url || "",
      anonKey: cfg.anonKey || "",
      enabled: Boolean(cfg.enabled && cfg.url && cfg.anonKey),
    };
  }

  /**
   * Returns a Supabase client, or null if not configured.
   * @returns {import('@supabase/supabase-js').SupabaseClient | null}
   */
  function getSupabaseClient() {
    const { url, anonKey, enabled } = getConfig();
    if (!enabled) return null;

    if (_client) return _client;

    const createClient =
      (window.supabase && window.supabase.createClient) ||
      (window.supabaseJs && window.supabaseJs.createClient);

    if (!createClient) {
      console.warn(
        "[BFF] Supabase SDK not loaded. Include @supabase/supabase-js (CDN or bundle) before client.js"
      );
      return null;
    }

    _client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
    return _client;
  }

  function isSupabaseReady() {
    return Boolean(getConfig().enabled && getSupabaseClient());
  }

  BFF.supabase = {
    getClient: getSupabaseClient,
    isReady: isSupabaseReady,
    getConfig,
  };
})();
