// Shared behavior: sticky header, mobile nav, scroll reveals, click-to-load videos, hero video.
(function () {
  const header = document.querySelector(".site-header");
  const hasHero = document.querySelector(".hero, .page-hero");

  // Header turns solid once you scroll past the hero (always solid on pages without one).
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-solid", !hasHero || window.scrollY > 40);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile nav
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      header.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) {
        nav.classList.remove("is-open");
        header.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  // Reveal on scroll
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
        });
      }, { rootMargin: "0px 0px -8% 0px" })
    : null;
  document.querySelectorAll(".reveal").forEach((el) => (io ? io.observe(el) : el.classList.add("is-in")));

  // Click-to-load YouTube (keeps pages fast; nothing loads from YouTube until clicked)
  document.querySelectorAll(".video-thumb[data-yt]").forEach((el) => {
    const id = el.dataset.yt;
    if (!el.querySelector("img")) {
      const img = document.createElement("img");
      img.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      img.alt = el.getAttribute("aria-label") || "";
      img.loading = "lazy";
      el.appendChild(img);
    }
    el.addEventListener("click", (e) => {
      e.preventDefault();
      el.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="${el.getAttribute("aria-label") || "Video"}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      el.classList.add("is-loaded");
    });
  });

  // Hero background video. Swap to a self-hosted MP4 (assets/video/hero.mp4) once AECT supplies footage;
  // until then we use a muted, looping YouTube embed that fades in over the poster photo.
  const heroMedia = document.querySelector(".hero-media[data-yt]");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (heroMedia && !reduce) {
    const id = heroMedia.dataset.yt;
    const start = heroMedia.dataset.start || 0;
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&disablekb=1&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&enablejsapi=1&start=${start}&origin=${encodeURIComponent(location.origin)}`;
    f.title = "AECT machine making compressed earth blocks";
    f.allow = "autoplay; encrypted-media";
    f.tabIndex = -1;
    f.setAttribute("aria-hidden", "true");
    // Only fade the video in once YouTube reports it is actually playing, so a blocked or
    // failed embed never covers the poster photo.
    f.addEventListener("load", () => f.contentWindow.postMessage('{"event":"listening","id":1}', "*"));
    window.addEventListener("message", (e) => {
      if (!/youtube/.test(e.origin)) return;
      try {
        const d = JSON.parse(e.data);
        if (d.info && d.info.playerState === 1) f.classList.add("is-playing");
      } catch (err) {}
    });
    heroMedia.appendChild(f);
  }

  // Year in footer
  document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
})();
