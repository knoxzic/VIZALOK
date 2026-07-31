/**
 * Device lease gate — online RPC + offline signed cache.
 *
 * Flow:
 *  ONLINE  → issue_device_lease() → store signed payload + expiry → refresh timer (12h)
 *  OFFLINE → read local lease → ALLOW if NOW < expiry else LOCK
 */
(function () {
  window.BFF = window.BFF || {};

  const cfg = () => (BFF.config && BFF.config.DEVICE_LEASE) || {};
  const storageKey = () => cfg().storageKey || "bff_device_lease_v1";
  const refreshMs = () => {
    const h = (cfg().refreshHours != null ? cfg().refreshHours : 12) * 3600 * 1000;
    return Math.max(h, 60 * 1000);
  };

  let _timer = null;
  let _lastStatus = { allowed: true, mode: "unknown", reason: "" };

  function isOnline() {
    return typeof navigator !== "undefined" ? navigator.onLine !== false : true;
  }

  function readLease() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeLease(payload) {
    localStorage.setItem(storageKey(), JSON.stringify(payload));
  }

  function clearLease() {
    localStorage.removeItem(storageKey());
  }

  function leaseValid(lease) {
    if (!lease || !lease.expires_at) return false;
    const exp = Date.parse(lease.expires_at);
    if (Number.isNaN(exp)) return false;
    return Date.now() < exp;
  }

  function client() {
    if (BFF.supabase && typeof BFF.supabase.getClient === "function") {
      return BFF.supabase.getClient();
    }
    return null;
  }

  function deviceFingerprint() {
    // Stable-enough browser fingerprint for lease binding (not crypto-hard)
    const parts = [
      navigator.userAgent || "",
      navigator.language || "",
      screen.width + "x" + screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    ];
    let h = 0;
    const s = parts.join("|");
    for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    return "web_" + (h >>> 0).toString(16);
  }

  /**
   * Call Supabase RPC issue_device_lease.
   * Expected return shape:
   *   { lease_id, expires_at, signature, product_keys?, profile_id? }
   */
  async function issueFromServer() {
    const sb = client();
    if (!sb) throw new Error("Supabase client unavailable");

    const { data: userData } = await sb.auth.getUser();
    const user = userData && userData.user;
    if (!user) throw new Error("Not signed in");

    const device_id = deviceFingerprint();
    const { data, error } = await sb.rpc("issue_device_lease", {
      p_device_id: device_id,
      p_device_label: "web",
    });

    if (error) throw new Error(error.message || "issue_device_lease failed");

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || !row.expires_at) {
      throw new Error("Invalid lease payload from server");
    }

    const payload = {
      lease_id: row.lease_id || row.id,
      profile_id: row.profile_id || user.id,
      device_id,
      expires_at: row.expires_at,
      signature: row.signature || row.signed_payload || "",
      product_keys: row.product_keys || [],
      issued_at: new Date().toISOString(),
      source: "rpc",
    };
    writeLease(payload);
    return payload;
  }

  /**
   * Online: refresh lease. Offline: validate cache only.
   * @returns {{ allowed:boolean, mode:string, reason:string, lease?:object }}
   */
  async function evaluate() {
    if (cfg().enabled === false) {
      _lastStatus = { allowed: true, mode: "disabled", reason: "lease gate off" };
      return _lastStatus;
    }

    if (isOnline()) {
      try {
        const lease = await issueFromServer();
        _lastStatus = {
          allowed: leaseValid(lease),
          mode: "online",
          reason: leaseValid(lease) ? "fresh lease" : "server lease already expired",
          lease,
        };
        return _lastStatus;
      } catch (e) {
        // Fall back to cache if RPC not deployed yet or network blip mid-session
        const cached = readLease();
        if (leaseValid(cached)) {
          _lastStatus = {
            allowed: true,
            mode: "online-cache",
            reason: "RPC failed; using valid cached lease — " + (e.message || ""),
            lease: cached,
          };
          return _lastStatus;
        }
        // If never leased and RPC missing, allow (pre-launch) unless strict
        if (cfg().strict === true) {
          _lastStatus = {
            allowed: false,
            mode: "online-fail",
            reason: e.message || "Could not issue lease",
          };
          return _lastStatus;
        }
        _lastStatus = {
          allowed: true,
          mode: "online-open",
          reason: "Lease RPC not ready — open access until schema applied",
        };
        return _lastStatus;
      }
    }

    // OFFLINE
    const cached = readLease();
    if (leaseValid(cached)) {
      _lastStatus = {
        allowed: true,
        mode: "offline",
        reason: "cached lease valid until " + cached.expires_at,
        lease: cached,
      };
      return _lastStatus;
    }
    _lastStatus = {
      allowed: false,
      mode: "offline-locked",
      reason: cfg().lockMessage || "Access locked. Connect to renew your license.",
      lease: cached,
    };
    return _lastStatus;
  }

  function scheduleRefresh() {
    if (_timer) clearInterval(_timer);
    if (cfg().enabled === false) return;
    _timer = setInterval(function () {
      if (isOnline()) {
        evaluate().catch(function () {});
      }
    }, refreshMs());
  }

  function showLockOverlay(message) {
    if (document.getElementById("bff-lease-lock")) return;
    const el = document.createElement("div");
    el.id = "bff-lease-lock";
    el.setAttribute("role", "alertdialog");
    el.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(8,28,22,0.92);display:grid;place-items:center;padding:1.5rem;color:#fff;font-family:system-ui,sans-serif";
    el.innerHTML =
      '<div style="max-width:420px;text-align:center">' +
      '<p style="letter-spacing:0.14em;text-transform:uppercase;font-size:0.7rem;opacity:0.75">License</p>' +
      '<h2 style="margin:0.5rem 0 0.75rem;font-size:1.35rem">Access locked</h2>' +
      '<p style="opacity:0.9;line-height:1.5;margin-bottom:1.25rem">' +
      String(message || cfg().lockMessage || "Connect to the internet to renew your license lease.") +
      "</p>" +
      '<button type="button" id="bff-lease-retry" style="padding:0.75rem 1.25rem;border:0;border-radius:999px;background:linear-gradient(135deg,#0a5c45,#127a5a);color:#fff;font-weight:600;cursor:pointer">Retry connection</button>' +
      "</div>";
    document.body.appendChild(el);
    document.getElementById("bff-lease-retry").onclick = function () {
      el.remove();
      gate({ hard: true });
    };
  }

  /**
   * Run gate. For desktop-style apps set options.hard = true to lock UI.
   */
  async function gate(options) {
    const opts = options || {};
    const status = await evaluate();
    scheduleRefresh();
    if (!status.allowed && opts.hard) {
      showLockOverlay(status.reason);
    }
    window.dispatchEvent(new CustomEvent("bff:lease", { detail: status }));
    return status;
  }

  // Network transitions
  if (typeof window !== "undefined") {
    window.addEventListener("online", function () {
      evaluate().then(function (s) {
        if (s.allowed) {
          const lock = document.getElementById("bff-lease-lock");
          if (lock) lock.remove();
        }
      });
    });
    window.addEventListener("offline", function () {
      const s = {
        allowed: leaseValid(readLease()),
        mode: "offline",
        reason: "",
        lease: readLease(),
      };
      if (!s.allowed && cfg().enabled !== false) {
        s.reason = cfg().lockMessage;
        showLockOverlay(s.reason);
      }
      _lastStatus = s;
      window.dispatchEvent(new CustomEvent("bff:lease", { detail: s }));
    });
  }

  BFF.deviceLease = {
    evaluate,
    gate,
    readLease,
    clearLease,
    issueFromServer,
    isOnline,
    getStatus: function () {
      return _lastStatus;
    },
    scheduleRefresh,
  };
})();
