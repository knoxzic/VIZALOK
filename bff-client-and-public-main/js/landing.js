/**
 * Landing — pinned carousel, particles, scroll reveals, parallax
 */
(function () {
  const reduceMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ——— Carousel ——— */
  function initCarousel() {
    const root = document.getElementById("portal-carousel");
    const track = document.getElementById("portal-track");
    const dotsRoot = document.getElementById("portal-dots");
    const status = document.getElementById("portal-status");
    if (!root || !track || !dotsRoot) return null;

    const slides = Array.from(track.querySelectorAll(".portal-slide"));
    const total = slides.length;
    if (!total) return null;

    let index = 0;
    let animating = false;
    let touchStartX = 0;
    let touchStartY = 0;

    slides.forEach((_, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "portal-carousel__dot" + (i === 0 ? " is-active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-label", "Show portal " + (i + 1) + " of " + total);
      btn.setAttribute("aria-selected", i === 0 ? "true" : "false");
      btn.addEventListener("click", () => goTo(i));
      dotsRoot.appendChild(btn);
    });

    const dots = Array.from(dotsRoot.querySelectorAll(".portal-carousel__dot"));
    const prevBtn = root.querySelector(".portal-carousel__arrow--prev");
    const nextBtn = root.querySelector(".portal-carousel__arrow--next");

    function updateChrome() {
      dots.forEach((d, i) => {
        d.classList.toggle("is-active", i === index);
        d.setAttribute("aria-selected", i === index ? "true" : "false");
      });
      if (status) status.textContent = index + 1 + " / " + total;
      slides.forEach((s, i) => {
        s.setAttribute("aria-hidden", i === index ? "false" : "true");
      });
      root.setAttribute("data-active", String(index));
    }

    function goTo(next, dir) {
      if (animating || next === index) return;
      next = ((next % total) + total) % total;
      let d = dir;
      if (d === undefined) {
        d = next > index ? 1 : -1;
        if (index === 0 && next === total - 1) d = -1;
        if (index === total - 1 && next === 0) d = 1;
      }

      animating = true;
      const current = slides[index];
      const incoming = slides[next];

      current.classList.remove("is-active", "is-enter-from-left", "is-enter-from-right");
      current.classList.add(d > 0 ? "is-exit-left" : "is-exit-right");

      incoming.classList.remove("is-exit-left", "is-exit-right");
      incoming.classList.add(
        "is-active",
        d > 0 ? "is-enter-from-right" : "is-enter-from-left"
      );

      index = next;
      updateChrome();

      window.setTimeout(() => {
        current.classList.remove("is-exit-left", "is-exit-right");
        incoming.classList.remove("is-enter-from-left", "is-enter-from-right");
        animating = false;
      }, 560);
    }

    function next() {
      goTo(index + 1, 1);
    }
    function prev() {
      goTo(index - 1, -1);
    }

    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (nextBtn) nextBtn.addEventListener("click", next);

    root.setAttribute("tabindex", "0");
    root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        next();
      }
    });

    const surface = root.querySelector(".portal-carousel__viewport") || root;
    surface.addEventListener(
      "touchstart",
      (e) => {
        const t = e.changedTouches[0];
        touchStartX = t.clientX;
        touchStartY = t.clientY;
      },
      { passive: true }
    );
    surface.addEventListener(
      "touchend",
      (e) => {
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStartX;
        const dy = t.clientY - touchStartY;
        if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
        if (dx < 0) next();
        else prev();
      },
      { passive: true }
    );

    updateChrome();
    return { goTo, next, prev, getIndex: () => index, total };
  }

  /* ——— Sticky pin state (visual feedback) ——— */
  function initPinObserver() {
    const track = document.querySelector(".pin-section__track");
    const sticky = document.getElementById("pin-sticky");
    const hint = document.getElementById("pin-hint");
    if (!track || !sticky) return;

    const onScroll = () => {
      const rect = track.getBoundingClientRect();
      const vh = window.innerHeight;
      // Pinned while track top has scrolled past 0 and bottom still below viewport
      const pinned = rect.top <= 1 && rect.bottom > vh + 1;
      const entering = rect.top < vh && rect.top > 1;
      const leaving = rect.bottom <= vh && rect.bottom > 0;

      sticky.classList.toggle("is-pinned", pinned);
      sticky.classList.toggle("is-entering", entering);
      sticky.classList.toggle("is-leaving", leaving);
      document.body.classList.toggle("carousel-pinned", pinned);

      if (hint) {
        if (pinned) {
          hint.innerHTML =
            '<span class="pin-dot is-live"></span> Stage pinned — browse services, then scroll to release';
        } else if (entering) {
          hint.innerHTML =
            '<span class="pin-dot"></span> Keep scrolling to pin this stage';
        } else if (leaving || rect.bottom <= 0) {
          hint.innerHTML =
            '<span class="pin-dot"></span> Released — continue exploring below';
        } else {
          hint.innerHTML =
            '<span class="pin-dot"></span> Scroll into this section to pin the showcase';
        }
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
  }

  /* ——— Scroll reveals ——— */
  function initReveals() {
    const blocks = document.querySelectorAll("[data-reveal]");
    if (reduceMotion()) {
      blocks.forEach((b) => {
        b.classList.add("is-inview");
        b.querySelectorAll(".reveal-item").forEach((el) => el.classList.add("is-inview"));
      });
      return;
    }

    if (!("IntersectionObserver" in window)) {
      blocks.forEach((b) => b.classList.add("is-inview"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-inview");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" }
    );

    blocks.forEach((b) => io.observe(b));

    requestAnimationFrame(() => {
      const hero = document.querySelector(".landing-hero");
      if (hero) hero.classList.add("is-inview");
    });
  }

  /* ——— Parallax ——— */
  function initParallax() {
    if (reduceMotion()) return;
    const nodes = document.querySelectorAll("[data-parallax], [data-parallax-slow]");
    if (!nodes.length) return;

    let ticking = false;
    const update = () => {
      const y = window.scrollY;
      nodes.forEach((el) => {
        const factor = parseFloat(
          el.getAttribute("data-parallax") ||
            el.getAttribute("data-parallax-slow") ||
            "0.1"
        );
        el.style.transform = "translate3d(0, " + y * factor + "px, 0)";
      });
      ticking = false;
    };

    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
      },
      { passive: true }
    );
    update();
  }

  /* ——— Nav shrink on scroll ——— */
  function initNavScroll() {
    const nav = document.getElementById("site-nav");
    if (!nav) return;
    const onScroll = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 40);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ——— Floating particles ——— */
  function initParticles() {
    const canvas = document.getElementById("particle-canvas");
    if (!canvas || reduceMotion()) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let particles = [];
    let raf = 0;

    const colors = [
      "rgba(232, 93, 143, 0.55)",
      "rgba(212, 175, 90, 0.5)",
      "rgba(10, 92, 69, 0.4)",
      "rgba(239, 176, 198, 0.45)",
      "rgba(240, 215, 140, 0.4)",
    ];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      const count = Math.min(48, Math.floor((w * h) / 28000));
      particles = Array.from({ length: count }, () => spawn());
    }

    function spawn() {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: 1 + Math.random() * 2.4,
        vx: (Math.random() - 0.5) * 0.28,
        vy: -0.12 - Math.random() * 0.35,
        c: colors[(Math.random() * colors.length) | 0],
        a: 0.25 + Math.random() * 0.55,
      };
    }

    function tick() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10 || p.x < -10 || p.x > w + 10) {
          Object.assign(p, spawn(), { y: h + 8 });
        }
        ctx.beginPath();
        ctx.fillStyle = p.c;
        ctx.globalAlpha = p.a;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }

    resize();
    tick();
    window.addEventListener("resize", resize, { passive: true });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else {
        raf = requestAnimationFrame(tick);
      }
    });
  }

  function boot() {
    initCarousel();
    initPinObserver();
    initReveals();
    initParallax();
    initNavScroll();
    initParticles();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
