/**
 * Supabase public config
 * Prefer NEXT_PUBLIC_* env when available (Next.js / bundlers).
 * Falls back to window.__ENV or BFF.config.supabase for static hosting.
 */
(function () {
  window.BFF = window.BFF || {};

  function readEnv(key) {
    try {
      if (typeof process !== "undefined" && process.env && process.env[key]) {
        return process.env[key];
      }
    } catch (_) {}
    if (window.__ENV && window.__ENV[key]) return window.__ENV[key];
    return "";
  }

  const fromProcess = {
    url: readEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };

  BFF.config = BFF.config || {};
  const existing = BFF.config.supabase || {};

  // Priority: process.env → window.__ENV → existing BFF.config.supabase
  const url =
    fromProcess.url ||
    (window.__ENV && window.__ENV.NEXT_PUBLIC_SUPABASE_URL) ||
    existing.url ||
    "";
  const anonKey =
    fromProcess.anonKey ||
    (window.__ENV && window.__ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    existing.anonKey ||
    "";

  // Dashboard URLs are not API endpoints — normalize project ref if needed
  let apiUrl = url;
  if (apiUrl.includes("supabase.com/dashboard/project/")) {
    const m = apiUrl.match(/project\/([a-z0-9]+)/i);
    if (m) apiUrl = "https://" + m[1] + ".supabase.co";
  }

  BFF.config.supabase = {
    url: apiUrl,
    anonKey: anonKey,
    enabled: Boolean(apiUrl && anonKey && !apiUrl.includes("/dashboard/")),
  };
})();
