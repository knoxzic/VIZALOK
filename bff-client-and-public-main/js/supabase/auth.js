/**
 * Supabase auth helpers — single sign-in source for BFF + Expense IQ.
 * Email must be confirmed before any gated product continues.
 */
(function () {
  window.BFF = window.BFF || {};

  function client() {
    if (!BFF.supabase || !BFF.supabase.getClient) return null;
    return BFF.supabase.getClient();
  }

  function authBasePath() {
    // Resolve pages/auth.html from site root or nested folders
    const path = window.location.pathname || "";
    if (path.includes("/expense-iq/")) return "../pages/auth.html";
    if (path.includes("/pages/")) return "auth.html";
    if (path.includes("/portals/")) return "../pages/auth.html";
    return "pages/auth.html";
  }

  function isEmailConfirmed(user) {
    if (!user) return false;
    // Supabase sets email_confirmed_at when the user clicks the confirm link
    return Boolean(user.email_confirmed_at || user.confirmed_at);
  }

  async function getSession() {
    const sb = client();
    if (!sb) return { data: { session: null }, error: null, offline: true };
    return sb.auth.getSession();
  }

  async function getUser() {
    const sb = client();
    if (!sb) return { user: null, offline: true, error: null };
    // Prefer getUser() so we revalidate with the server when possible
    try {
      const { data, error } = await sb.auth.getUser();
      if (error) {
        const sess = await sb.auth.getSession();
        const user = sess.data && sess.data.session ? sess.data.session.user : null;
        return { user, error: user ? null : error };
      }
      return { user: data.user || null, error: null };
    } catch (e) {
      return { user: null, error: e };
    }
  }

  async function signUp({ email, password, metadata }) {
    const sb = client();
    if (!sb) {
      return {
        data: null,
        error: {
          message:
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
      };
    }
    const origin = window.location.origin;
    // Static deploy under /bff-client-and-public-main/
    const path = window.location.pathname || "";
    const root = path.includes("/bff-client-and-public-main/")
      ? origin + "/bff-client-and-public-main"
      : origin;
    return sb.auth.signUp({
      email: String(email || "").trim(),
      password: String(password || ""),
      options: {
        data: metadata || {},
        emailRedirectTo: root + "/pages/auth.html?confirmed=1",
      },
    });
  }

  async function signIn({ email, password }) {
    const sb = client();
    if (!sb) {
      return {
        data: null,
        error: {
          message:
            "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
        },
      };
    }
    const result = await sb.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(password || ""),
    });
    if (result.error) return result;

    const user = result.data && result.data.user;
    if (user && !isEmailConfirmed(user)) {
      // Do not leave a usable session for unconfirmed accounts
      await sb.auth.signOut();
      return {
        data: { user: null, session: null },
        error: {
          message:
            "Email not confirmed. Open the confirmation link we sent, then sign in again.",
          code: "email_not_confirmed",
        },
      };
    }
    return result;
  }

  async function signOut() {
    const sb = client();
    if (!sb) return { error: null };
    return sb.auth.signOut();
  }

  async function resendConfirmation(email) {
    const sb = client();
    if (!sb) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }
    const origin = window.location.origin;
    const path = window.location.pathname || "";
    const root = path.includes("/bff-client-and-public-main/")
      ? origin + "/bff-client-and-public-main"
      : origin;
    return sb.auth.resend({
      type: "signup",
      email: String(email || "").trim(),
      options: { emailRedirectTo: root + "/pages/auth.html?confirmed=1" },
    });
  }

  async function resetPassword(email) {
    const sb = client();
    if (!sb) {
      return { data: null, error: { message: "Supabase is not configured." } };
    }
    const origin = window.location.origin;
    const path = window.location.pathname || "";
    const root = path.includes("/bff-client-and-public-main/")
      ? origin + "/bff-client-and-public-main"
      : origin;
    return sb.auth.resetPasswordForEmail(String(email || "").trim(), {
      redirectTo: root + "/pages/auth.html?reset=1",
    });
  }

  function onAuthStateChange(callback) {
    const sb = client();
    if (!sb) return { data: { subscription: { unsubscribe: function () {} } } };
    return sb.auth.onAuthStateChange(callback);
  }

  /**
   * Gate: must be signed in with confirmed email.
   * Redirects to central auth if not.
   * @returns {Promise<{user: object}|null>}
   */
  async function requireConfirmedUser(options) {
    const opts = options || {};
    const next = opts.next || window.location.href;
    const { user, offline, error } = await getUser();

    if (offline) {
      if (opts.allowOffline) return null;
      redirectToAuth(next, "offline");
      return null;
    }

    if (!user) {
      redirectToAuth(next, "login");
      return null;
    }

    if (!isEmailConfirmed(user)) {
      await signOut();
      redirectToAuth(next, "confirm");
      return null;
    }

    return { user };
  }

  function redirectToAuth(next, reason) {
    const base = authBasePath();
    const params = new URLSearchParams();
    if (next) params.set("next", next);
    if (reason) params.set("reason", reason);
    const q = params.toString();
    window.location.href = base + (q ? "?" + q : "");
  }

  BFF.auth = {
    getSession,
    getUser,
    signUp,
    signIn,
    signOut,
    resetPassword,
    resendConfirmation,
    onAuthStateChange,
    isEmailConfirmed,
    requireConfirmedUser,
    redirectToAuth,
    authPath: authBasePath,
  };
})();
