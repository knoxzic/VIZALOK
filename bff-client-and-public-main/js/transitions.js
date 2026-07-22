/**
 * Inter-page transition: veil covers → navigate → page-enter on load
 */
(function () {
  const REDUCED =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Enter animation on every content page
  if (!document.body.classList.contains("welcome-page")) {
    document.body.classList.add("page-enter");
  }

  function assetBase() {
    const path = location.pathname.replace(/\\/g, "/");
    if (path.includes("/portals/") || path.includes("/pages/")) return "../assets/";
    return "assets/";
  }

  function ensureOverlay() {
    let el = document.getElementById("page-transition");
    if (el) return el;
    el = document.createElement("div");
    el.id = "page-transition";
    el.className = "page-transition";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="page-transition__veil"></div>
      <div class="page-transition__mark">
        <img src="${assetBase()}icon-welcome.jpeg" alt="" width="64" height="64" />
        <span>Best Face Forward</span>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function sameOriginNav(href) {
    try {
      const url = new URL(href, location.href);
      return url.origin === location.origin;
    } catch {
      return false;
    }
  }

  function shouldTransition(a) {
    if (!a || a.target === "_blank" || a.hasAttribute("download")) return false;
    if (a.getAttribute("href")?.startsWith("#")) return false;
    if (a.getAttribute("href")?.startsWith("mailto:")) return false;
    if (a.getAttribute("href")?.startsWith("tel:")) return false;
    if (a.dataset.noTransition != null) return false;
    if (!sameOriginNav(a.href)) return false;
    // Skip if same page hash only
    const url = new URL(a.href, location.href);
    if (url.pathname === location.pathname && url.hash) return false;
    return true;
  }

  function go(href) {
    if (REDUCED) {
      location.href = href;
      return;
    }
    const overlay = ensureOverlay();
    overlay.classList.add("is-active", "is-covering");
    setTimeout(function () {
      location.href = href;
    }, 520);
  }

  document.addEventListener(
    "click",
    function (e) {
      const a = e.target.closest("a[href]");
      if (!a || !shouldTransition(a)) return;
      // Allow modified clicks
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();

      // Welcome special exit
      if (document.body.classList.contains("welcome-page")) {
        const welcome = document.querySelector(".welcome");
        if (welcome) welcome.classList.add("welcome--exit");
      }
      go(a.href);
    },
    true
  );

  // Expose for welcome Enter button if needed
  window.BFF = window.BFF || {};
  window.BFF.transitionTo = go;
})();
