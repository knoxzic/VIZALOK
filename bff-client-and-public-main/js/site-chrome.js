/**
 * Shared marketing chrome helpers (static site — no framework).
 * Sets data-year on [data-year] nodes and mobile nav toggle.
 */
(function () {
  window.BFF = window.BFF || {};

  function initNav() {
    document.querySelectorAll(".nav-toggle").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
        const nav = btn.closest(".site-nav");
        if (nav) nav.classList.toggle("is-open", !expanded);
      });
    });
  }

  function setYear() {
    document.querySelectorAll("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  /** Prefill contact form from ?interest= / ?product= */
  function prefillContactFromQuery() {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const params = new URLSearchParams(location.search);
    const interest = params.get("interest") || params.get("product");
    const interestEl = document.getElementById("contact-interest");
    if (interest && interestEl) {
      interestEl.value = interest.replace(/_/g, " ");
    }
    const desc = document.getElementById("business-desc") || document.getElementById("contact-message");
    if (interest && desc && !desc.value) {
      desc.value = "Interested in: " + interest.replace(/_/g, " ");
    }
  }

  function injectBrandPhone() {
    var brand = (window.BFF && BFF.config && BFF.config.brand) || {};
    var tel = brand.phone || "+18558884233";
    var vanity = brand.phoneVanity || "1-855-888-4BFF";
    var display = brand.phoneDisplay || "1-855-888-4233";

    document.querySelectorAll(".site-nav__cta").forEach(function (cta) {
      if (cta.querySelector("[data-bff-phone]")) return;
      var a = document.createElement("a");
      a.href = "tel:" + tel;
      a.className = "nav-phone";
      a.setAttribute("data-bff-phone", "");
      a.setAttribute("aria-label", "Call " + display);
      a.textContent = vanity;
      cta.insertBefore(a, cta.firstChild);
    });

    document.querySelectorAll(".site-nav__links").forEach(function (links) {
      if (links.querySelector("[data-bff-phone]")) return;
      var li = document.createElement("li");
      li.className = "is-phone";
      var a = document.createElement("a");
      a.href = "tel:" + tel;
      a.setAttribute("data-bff-phone", "");
      a.textContent = display;
      li.appendChild(a);
      links.appendChild(li);
    });
  }

  BFF.chrome = {
    init: function () {
      initNav();
      setYear();
      prefillContactFromQuery();
      injectBrandPhone();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", BFF.chrome.init);
  } else {
    BFF.chrome.init();
  }
})();
