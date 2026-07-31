/**
 * Basic Supabase auth helpers for Best Face Forward.
 * Uses NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY via config.js
 */
(function () {
  window.BFF = window.BFF || {};

  function client() {
    if (!BFF.supabase || !BFF.supabase.getClient) return null;
    return BFF.supabase.getClient();
  }

  async function getSession() {
    const sb = client();
    if (!sb) return { data: { session: null }, error: null, offline: true };
    return sb.auth.getSession();
  }

  async function getUser() {
    const { data, error, offline } = await getSession();
    if (offline) return { user: null, offline: true };
    if (error) return { user: null, error };
    return { user: data.session ? data.session.user : null, error: null };
  }

  async function signUp({ email, password, metadata }) {
    const sb = client();
    if (!sb) {
      return {
        data: null,
        error: { message: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      };
    }
    return sb.auth.signUp({
      email: String(email || "").trim(),
      password: String(password || ""),
      options: { data: metadata || {} },
    });
  }

  async function signIn({ email, password }) {
    const sb = client();
    if (!sb) {
      return {
        data: null,
        error: { message: "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY." },
      };
    }
    return sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
  }

  async function signOut() {
    const sb = client();
    if (!sb) return { error: null };
    return sb.auth.signOut();
  }

  async function resetPassword(email) {
    const sb = client();
    if (!sb) {
      return {
        data: null,
        error: { message: "Supabase is not configured." },
      };
    }
    return sb.auth.resetPasswordForEmail(String(email || "").trim(), {
      redirectTo: window.location.origin + "/pages/auth.html",
    });
  }

  function onAuthStateChange(callback) {
    const sb = client();
    if (!sb) return { data: { subscription: { unsubscribe: function () {} } } };
    return sb.auth.onAuthStateChange(callback);
  }

  BFF.auth = {
    getSession,
    getUser,
    signUp,
    signIn,
    signOut,
    resetPassword,
    onAuthStateChange,
  };
})();
