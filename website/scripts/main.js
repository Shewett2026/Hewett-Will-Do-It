/* =====================================================
   Hewett Will Do It 2026 -- main.js

   IMPORTANT -- STRING LITERAL ENCODING RULE:
   Any string containing an apostrophe (e.g. "don't", "you're")
   MUST use double-quote delimiters "..." not single-quote '...'.
   AI-assisted editing tools silently replace straight single
   quotes with curly/smart quotes (U+2018/U+2019) which are NOT
   valid JS string delimiters and will crash the entire script.
   Use double quotes for any string with apostrophes to prevent this.
   ===================================================== */
(function () {
  'use strict';

  // =====================================================
  // Carousel
  // Each .carousel element is independent.
  // Card content is stored in .ac-panel-data[hidden]
  // and injected into .carousel-expanded-area on open.
  // =====================================================

  function initCarousel(carousel) {
    var track        = carousel.querySelector('.carousel-track');
    var slides       = Array.from(carousel.querySelectorAll('.carousel-slide'));
    var prevBtn      = carousel.querySelector('.carousel-prev');
    var nextBtn      = carousel.querySelector('.carousel-next');
    var dotsWrap     = carousel.querySelector('.carousel-dots');
    var chipsWrap    = carousel.querySelector('.carousel-chips');
    var expandedArea = carousel.querySelector('.carousel-expanded-area');
    var delay        = parseInt(carousel.dataset.autoplay, 10) || 4000;

    var currentIndex  = 0;
    var activeCardIdx = 0;
    var autoTimer     = null;
    var isPaused      = false;
    var currentlyOpen = null;

    // --- Responsive: how many cards are visible at once ---
    function getVisible() {
      var w = window.innerWidth;
      if (w <= 480) return 1;
      if (w <= 768) return 2;
      return 3;
    }

    function getMaxIndex() {
      return Math.max(0, slides.length - getVisible());
    }

    function setSlideWidths() {
      var pct = (100 / getVisible()) + '%';
      slides.forEach(function (s) {
        s.style.minWidth = pct;
        s.style.flex = '0 0 ' + pct;
      });
    }

    // Center card: middle of 3 on desktop, leftmost on smaller screens
    function getCenterCardIdx() {
      var visible = getVisible();
      if (visible >= 3) return Math.min(currentIndex + 1, slides.length - 1);
      return currentIndex;
    }

    // --- Coverflow scaling ---
    function applyCoverflow() {
      var visible = getVisible();
      slides.forEach(function (slide, i) {
        var item = slide.querySelector('.ac-item');
        if (!item) return;
        var isVisible = i >= currentIndex && i < currentIndex + visible;
        if (!isVisible || visible < 3) {
          item.style.transform = '';
          item.style.opacity = '';
          item.style.zIndex = '';
          item.style.boxShadow = '';
        } else if (i === activeCardIdx) {
          item.style.transform = 'scale(1.06)';
          item.style.opacity = '1';
          item.style.zIndex = '2';
          item.style.boxShadow = '0 8px 32px rgba(11, 31, 58, 0.25)';
        } else {
          item.style.transform = 'scale(0.91)';
          item.style.opacity = '0.82';
          item.style.zIndex = '1';
          item.style.boxShadow = '';
        }
      });
    }

    // --- Navigation ---
    function goTo(index) {
      var max = getMaxIndex();
      currentIndex = Math.max(0, Math.min(index, max));
      activeCardIdx = getCenterCardIdx();
      var pct = (100 / getVisible()) * currentIndex;
      track.style.transform = 'translateX(-' + pct + '%)';
      updateDots();
      updateArrowStates();
      updateChips();
      applyCoverflow();
    }

    function updateArrowStates() {
      if (prevBtn) prevBtn.disabled = (currentIndex === 0);
      if (nextBtn) nextBtn.disabled = (currentIndex >= getMaxIndex());
    }

    // --- Dot indicators ---
    function buildDots() {
      if (!dotsWrap) return;
      dotsWrap.innerHTML = '';
      var max = getMaxIndex();
      for (var i = 0; i <= max; i++) {
        var dot = document.createElement('button');
        dot.className = 'carousel-dot';
        dot.setAttribute('aria-label', 'Go to position ' + (i + 1));
        dot.setAttribute('role', 'listitem');
        (function (idx) {
          dot.addEventListener('click', function () { goTo(idx); });
        }(i));
        dotsWrap.appendChild(dot);
      }
      updateDots();
    }

    function updateDots() {
      if (!dotsWrap) return;
      dotsWrap.querySelectorAll('.carousel-dot').forEach(function (d, i) {
        d.classList.toggle('is-active', i === currentIndex);
      });
    }

    // --- Word bank chips ---
    // Each chip maps to an individual card (0-based).
    // Clicking chip i scrolls the carousel so card i is the center card.
    // Active chip = the chip whose card is currently in the center slot.
    function buildChips() {
      if (!chipsWrap) return;
      chipsWrap.innerHTML = '';
      slides.forEach(function (slide, idx) {
        var titleEl = slide.querySelector('.ac-title');
        if (!titleEl) return;
        var chip = document.createElement('button');
        chip.className = 'carousel-chip';
        chip.textContent = titleEl.textContent;
        chip.setAttribute('aria-label', 'Show: ' + titleEl.textContent);
        chip.setAttribute('role', 'listitem');
        (function (i) {
          chip.addEventListener('click', function () {
            // To put card i in view; the clicked chip is always the active card
            var visible = getVisible();
            var offset = (visible >= 3) ? 1 : 0;
            var scrollPos = Math.max(0, Math.min(i - offset, getMaxIndex()));
            goTo(scrollPos);
            activeCardIdx = i;
            applyCoverflow();
            updateChips();
          });
        }(idx));
        chipsWrap.appendChild(chip);
      });
      updateChips();
    }

    function updateChips() {
      if (!chipsWrap) return;
      chipsWrap.querySelectorAll('.carousel-chip').forEach(function (chip, i) {
        chip.classList.toggle('is-active', i === activeCardIdx);
      });
    }

    // --- Auto-rotation ---
    function startAuto() {
      stopAuto();
      autoTimer = setInterval(function () {
        if (isPaused || currentlyOpen) return;
        var next = currentIndex + 1;
        if (next > getMaxIndex()) next = 0;
        goTo(next);
      }, delay);
    }

    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }

    carousel.addEventListener('mouseenter', function () { isPaused = true; });
    carousel.addEventListener('mouseleave', function () { isPaused = false; });

    // --- Expanded panel ---
    function closeAll() {
      slides.forEach(function (slide) {
        var item = slide.querySelector('.ac-item');
        var hdr  = slide.querySelector('.ac-header');
        if (item) item.classList.remove('is-open');
        if (hdr)  hdr.setAttribute('aria-expanded', 'false');
      });
      if (expandedArea) {
        expandedArea.style.maxHeight = '0';
        setTimeout(function () {
          if (expandedArea.style.maxHeight === '0px') {
            expandedArea.innerHTML = '';
          }
        }, 420);
      }
      currentlyOpen = null;
    }

    function openPanel(slide) {
      var item      = slide.querySelector('.ac-item');
      var hdr       = slide.querySelector('.ac-header');
      var panelData = slide.querySelector('.ac-panel-data');
      if (!panelData || !expandedArea) return;

      item.classList.add('is-open');
      hdr.setAttribute('aria-expanded', 'true');
      currentlyOpen = slide;
      isPaused = true;

      var inner = panelData.querySelector('.ac-panel-inner');
      if (!inner) return;
      expandedArea.innerHTML = '';
      var clone = inner.cloneNode(true);
      expandedArea.appendChild(clone);

      expandedArea.style.maxHeight = '0';
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          expandedArea.style.maxHeight = expandedArea.scrollHeight + 'px';
        });
      });
    }

    slides.forEach(function (slide) {
      var header = slide.querySelector('.ac-header');
      if (!header) return;

      header.addEventListener('click', function () {
        var wasOpen = (currentlyOpen === slide);
        closeAll();
        if (!wasOpen) {
          activeCardIdx = slides.indexOf(slide);
          applyCoverflow();
          updateChips();
          openPanel(slide);
        } else {
          isPaused = false;
        }
      });

      header.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          header.click();
        }
      });
    });

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(currentIndex - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(currentIndex + 1); });

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        setSlideWidths();
        buildDots();
        buildChips();
        goTo(Math.min(currentIndex, getMaxIndex()));
      }, 150);
    });

    setSlideWidths();
    buildDots();
    buildChips();
    goTo(0);
    startAuto();
  }

  document.querySelectorAll('.carousel').forEach(function (c) { initCarousel(c); });

  // =====================================================
  // Section heading fade-up + gold underline animation
  // Triggered when section header scrolls into view.
  // =====================================================

  var acSectionHeaders = document.querySelectorAll('.ac-section-header');

  if ('IntersectionObserver' in window) {
    var headingObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          var heading = entry.target.querySelector('.ac-heading');
          if (heading) { heading.classList.add('underline-ready'); }
          headingObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.25 });

    acSectionHeaders.forEach(function (el) { headingObserver.observe(el); });
  } else {
    acSectionHeaders.forEach(function (el) {
      el.classList.add('is-visible');
      var h = el.querySelector('.ac-heading');
      if (h) h.classList.add('underline-ready');
    });
  }

  // =====================================================
  // Mobile Navigation Toggle
  // =====================================================

  var navToggle = document.getElementById('navToggle');
  var navLinks  = document.getElementById('navLinks');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });

    document.addEventListener('click', function (e) {
      if (!navToggle.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // =====================================================
  // Banner image fallback (get-involved.html)
  // =====================================================

  var bannerImg = document.querySelector('.gi-banner-img');
  if (bannerImg) {
    bannerImg.addEventListener('error', function () {
      bannerImg.style.display = 'none';
    });
  }

  // =====================================================
  // Hero Video — loop first 60 seconds only
  // Removes the `loop` attribute and resets currentTime
  // to 0 when the video reaches the 60-second mark.
  // =====================================================

  var heroVideo = document.querySelector('.hero-bg-video');
  if (heroVideo) {
    heroVideo.addEventListener('timeupdate', function () {
      if (heroVideo.currentTime >= 60) {
        heroVideo.currentTime = 0;
      }
    });
  }

  // =====================================================
  // Footer Logo — enlarge base + hover swap to shield
  // =====================================================

  var footerLogo = document.querySelector('.footer-brand img');
  if (footerLogo) {
    var footerLogoDefault = 'assets/logos/wordmark.png';
    var footerLogoHover   = 'assets/logos/badge-shield.png';
    footerLogo.addEventListener('mouseenter', function () {
      footerLogo.src = footerLogoHover;
    });
    footerLogo.addEventListener('mouseleave', function () {
      footerLogo.src = footerLogoDefault;
    });
  }

  // =====================================================
  // Meet Seth — Work Experience Photo Carousel
  // Always shows one slide; auto-rotates every 5 seconds.
  // Video slide pauses auto-rotation while playing.
  // =====================================================

  var workCarousel = document.getElementById('workCarousel');
  if (workCarousel) {
    var pcTrack     = workCarousel.querySelector('.ms-photo-carousel-track');
    var pcSlides    = Array.from(workCarousel.querySelectorAll('.ms-photo-carousel-slide'));
    var pcPrev      = workCarousel.querySelector('.ms-photo-carousel-prev');
    var pcNext      = workCarousel.querySelector('.ms-photo-carousel-next');
    var pcDots      = workCarousel.querySelector('.ms-photo-carousel-dots');
    var pcVideo     = workCarousel.querySelector('.ms-photo-carousel-video');
    var pcActiveIdx = 0;  // the visually-highlighted center slide
    var pcScrollIdx = 0;  // leftmost visible slide index
    var pcTimer     = null;

    function pcGetVis()      { return window.innerWidth > 600 ? 3 : 1; }
    function pcGetMaxScroll(){ return Math.max(0, pcSlides.length - pcGetVis()); }

    function pcSetWidths() {
      var pct = (100 / pcGetVis()) + '%';
      pcSlides.forEach(function (s) { s.style.flex = '0 0 ' + pct; s.style.minWidth = pct; });
    }

    function pcApplyScale() {
      var vis = pcGetVis();
      pcSlides.forEach(function (slide, i) {
        var inView = i >= pcScrollIdx && i < pcScrollIdx + vis;
        if (!inView || vis < 3) {
          slide.style.transform = '';
          slide.style.opacity   = '';
        } else if (i === pcActiveIdx) {
          slide.style.transform = '';
          slide.style.opacity   = '1';
        } else {
          slide.style.transform = 'scale(0.87)';
          slide.style.opacity   = '0.78';
        }
      });
    }

    function pcUpdateDots() {
      pcDots.querySelectorAll('.ms-photo-carousel-dot').forEach(function (d, i) {
        d.classList.toggle('is-active', i === pcActiveIdx);
      });
    }

    function pcStopAuto() {
      clearInterval(pcTimer);
      pcTimer = null;
    }

    function pcStartAuto() {
      pcStopAuto();
      if (pcVideo && !pcVideo.paused) return;
      pcTimer = setInterval(function () { pcGoTo(pcActiveIdx + 1); }, 5000);
    }

    function pcGoTo(targetActive) {
      if (pcVideo && !pcVideo.paused) { pcVideo.pause(); }
      var count  = pcSlides.length;
      var vis    = pcGetVis();
      var maxScr = pcGetMaxScroll();
      pcActiveIdx = ((targetActive % count) + count) % count;
      var offset  = (vis >= 3) ? 1 : 0;
      pcScrollIdx = Math.max(0, Math.min(pcActiveIdx - offset, maxScr));
      pcTrack.style.transform = 'translateX(-' + ((100 / vis) * pcScrollIdx) + '%)';
      pcApplyScale();
      pcUpdateDots();
    }

    pcSlides.forEach(function (_, i) {
      var dot = document.createElement('button');
      dot.className = 'ms-photo-carousel-dot';
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      (function (n) {
        dot.addEventListener('click', function () { pcGoTo(n); pcStartAuto(); });
      }(i));
      pcDots.appendChild(dot);
    });

    if (pcPrev) pcPrev.addEventListener('click', function () { pcGoTo(pcActiveIdx - 1); pcStartAuto(); });
    if (pcNext) pcNext.addEventListener('click', function () { pcGoTo(pcActiveIdx + 1); pcStartAuto(); });

    if (pcVideo) {
      pcVideo.addEventListener('play',  function () { pcStopAuto(); });
      pcVideo.addEventListener('pause', function () { if (!pcVideo.ended) { pcStartAuto(); } });
      pcVideo.addEventListener('ended', function () { pcStartAuto(); });
    }

    workCarousel.addEventListener('mouseenter', pcStopAuto);
    workCarousel.addEventListener('mouseleave', function () {
      if (!pcVideo || pcVideo.paused) { pcStartAuto(); }
    });

    window.addEventListener('resize', function () {
      pcSetWidths();
      pcScrollIdx = Math.min(pcScrollIdx, pcGetMaxScroll());
      pcTrack.style.transform = 'translateX(-' + ((100 / pcGetVis()) * pcScrollIdx) + '%)';
      pcApplyScale();
    });

    pcSetWidths();
    pcGoTo(0);
    pcStartAuto();
  }

  // =====================================================
  // Meet Seth — Text Scroll Panels
  // Hide the bounce-chevron after 20px of scrolling.
  // =====================================================

  document.querySelectorAll('.text-scroll-panel').forEach(function (panel) {
    var hint = panel.nextElementSibling;
    if (!hint || !hint.classList.contains('scroll-hint')) return;
    panel.addEventListener('scroll', function () {
      if (panel.scrollTop > 20) {
        hint.classList.add('is-hidden');
      }
    }, { passive: true });
  });

  // =====================================================
  // Meet Seth — Animated Section Headings
  // IntersectionObserver re-triggers on each entry.
  // =====================================================

  var msHeadings = document.querySelectorAll('.section-heading');

  if (msHeadings.length && 'IntersectionObserver' in window) {
    var msHeadingObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var heading = entry.target;

        /* --- Animation 1: grow the letter I --- */
        if (heading.querySelector('.grow-letter')) {
          heading.classList.add('animate');
          setTimeout(function () {
            heading.classList.remove('animate');
          }, 1200);
        }

        /* --- Animation 2: draw root paths, then fade out after 3s --- */
        var rootsSvg = heading.querySelector('.roots-svg');
        if (rootsSvg) {
          rootsSvg.classList.remove('fading');
          rootsSvg.classList.add('animate');
          setTimeout(function () {
            rootsSvg.classList.add('fading');
            setTimeout(function () {
              rootsSvg.classList.remove('animate', 'fading');
            }, 850);
          }, 3000);
        }

        /* --- Animation 3: houses rise --- */
        var housesSvg = heading.querySelector('.houses-svg');
        if (housesSvg) {
          housesSvg.classList.add('animate');
          setTimeout(function () {
            housesSvg.classList.remove('animate');
          }, 2500);
        }
      });
    }, { threshold: 0.4 });

    msHeadings.forEach(function (el) { msHeadingObserver.observe(el); });
  }

  // =====================================================
  // Floating Share Button & Modal
  // =====================================================

  var shareBtn      = document.getElementById('shareBtn');
  var shareBackdrop = document.getElementById('shareBackdrop');
  var shareClose    = document.getElementById('shareClose');
  var copyLinkBtn   = document.getElementById('copyLinkBtn');
  var copyLinkLabel = document.getElementById('copyLinkLabel');
  var copyLinkIcon  = document.getElementById('copyLinkIcon');

  if (shareBtn && shareBackdrop) {
    shareBtn.addEventListener('click', function () {
      shareBackdrop.classList.add('is-open');
      shareBtn.setAttribute('aria-expanded', 'true');
    });

    function closeShareModal() {
      shareBackdrop.classList.remove('is-open');
      shareBtn.setAttribute('aria-expanded', 'false');
    }

    if (shareClose) shareClose.addEventListener('click', closeShareModal);

    shareBackdrop.addEventListener('click', function (e) {
      if (e.target === shareBackdrop) closeShareModal();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && shareBackdrop.classList.contains('is-open')) {
        closeShareModal();
      }
    });

    if (copyLinkBtn && copyLinkLabel && copyLinkIcon) {
      copyLinkBtn.addEventListener('click', function () {
        var url = 'https://hewettwilldoit.com';
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(showCopied);
        } else {
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.style.position = 'fixed';
          ta.style.top = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand('copy'); } catch (err) {}
          document.body.removeChild(ta);
          showCopied();
        }
      });

      function showCopied() {
        copyLinkLabel.textContent = '✓ Copied!';
        copyLinkIcon.textContent = '✓';
        setTimeout(function () {
          copyLinkLabel.textContent = 'Copy Link';
          copyLinkIcon.innerHTML = '&#x1F517;';
        }, 2000);
      }
    }
  }

  // =====================================================
  // Hero Signs — click shake
  // Adds .shake to each button on click, removes it when
  // the animation ends so it can be re-triggered.
  // transform-origin is set in CSS so the pivot sits at
  // the post base (hero floor level).
  // =====================================================

  document.querySelectorAll('.highway-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      btn.classList.remove('shake');
      void btn.offsetWidth; // force reflow so animation restarts
      btn.classList.add('shake');
    });
    btn.addEventListener('animationend', function (e) {
      if (e.animationName === 'sign-shake') {
        btn.classList.remove('shake');
      }
    });
  });

  // =====================================================
  // Hero Badge — click spin (Y-axis, 700ms)
  // Spins the wrapper div, not the img, so the existing
  // badge-entrance and badge-glow animations are untouched.
  // =====================================================

  var badgeWrapper = document.querySelector('.hero-badge-spin-wrapper');
  if (badgeWrapper) {
    badgeWrapper.addEventListener('click', function () {
      badgeWrapper.classList.remove('badge-spinning');
      void badgeWrapper.offsetWidth; // force reflow
      badgeWrapper.classList.add('badge-spinning');
    });
    badgeWrapper.addEventListener('animationend', function (e) {
      if (e.animationName === 'badge-click-spin') {
        badgeWrapper.classList.remove('badge-spinning');
      }
    });
  }

  // =====================================================
  // Store Page — Launch Notify Form
  // PLACEHOLDER: logs the submitted email to the console.
  // TODO: Replace console.log with a real backend call or
  //       email-service integration (e.g., Mailchimp, ConvertKit)
  //       before the store goes live.
  // =====================================================

  // =====================================================
  // Credential Sector Scroller — dot indicator sync
  // Updates the active dot as the user swipes between the
  // three sector cards (Private / Nonprofit / Public).
  // No-op on desktop where the dots are hidden via CSS.
  // =====================================================

  var credCols = document.querySelector('.cred-cols');
  var credDots = Array.from(document.querySelectorAll('.cred-sector-dot'));
  if (credCols && credDots.length) {
    credCols.addEventListener('scroll', function () {
      var cardWidth = credCols.querySelector('.cred-col').offsetWidth + 12; // card + gap
      var idx = Math.min(Math.round(credCols.scrollLeft / cardWidth), credDots.length - 1);
      credDots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
    }, { passive: true });
  }

  // =====================================================
  // Philosophy Pillars — tap-to-expand on mobile
  // Desktop uses CSS :hover. This adds a click handler so
  // touch users can tap a pillar to expand its description.
  // Only one pillar stays open at a time.
  // =====================================================

  var philBanners = document.querySelectorAll('.philosophy-banner');
  philBanners.forEach(function (banner) {
    banner.addEventListener('click', function () {
      var wasOpen = banner.classList.contains('is-expanded');
      philBanners.forEach(function (b) { b.classList.remove('is-expanded'); });
      if (!wasOpen) banner.classList.add('is-expanded');
    });
  });

  // =====================================================
  // Music Controls + Vote Widget
  //
  // musicBtn   → toggles the "Choose a Vibe" panel open/closed.
  //              Fully independent of playback state.
  // musicPlayBtn → plays or pauses audio.
  //              EQ bars animate while playing; play icon shows when paused.
  //
  // Track name click → switch track + begin playing.
  // Checkmark click  → cast one vote per browser (localStorage guard).
  // Votes stored server-side via /.netlify/functions/votes.
  //
  // Never call bgMusic.load() before play() — breaks iOS Safari gesture chain.
  // =====================================================

  var bgMusic      = document.getElementById('bgMusic');
  var musicBtn     = document.getElementById('musicBtn');
  var musicPlayBtn = document.getElementById('musicPlayBtn');
  var voteWidget   = document.getElementById('voteWidget');

  var TRACKS = {
    'twang-happy':  { label: 'Breckenridge Mountain Drive', src: 'assets/audio/melodyloops-twang-happy.mp3' },
    'desert-road':  { label: 'Westside Parkway Rhythm',     src: 'assets/audio/melodyloops-desert-road.mp3' },
    'hidden-creek': { label: 'Truxtun Ave Track',           src: 'assets/audio/melodyloops-hidden-creek.mp3' }
  };
  var VOTES_API   = '/.netlify/functions/votes';
  var VOTE_LS_KEY = 'hwdi_vote_cast';

  // ── Panel toggle button (Music) ───────────────────────────────
  if (musicBtn && voteWidget) {
    musicBtn.addEventListener('click', function () {
      var isOpen = voteWidget.classList.toggle('is-open');
      musicBtn.setAttribute('aria-expanded', String(isOpen));
    });
  }

  // ── Play/pause button ─────────────────────────────────────────
  if (bgMusic && musicPlayBtn) {
    bgMusic.volume = 0.42;

    musicPlayBtn.addEventListener('click', function () {
      if (bgMusic.paused) {
        var p = bgMusic.play();
        if (p !== undefined) {
          p.catch(function (err) {
            console.warn('[HWDI] Audio play() blocked:', err.name, '-', err.message);
          });
        }
      } else {
        bgMusic.pause();
      }
    });

    bgMusic.addEventListener('play', function () {
      musicPlayBtn.classList.add('is-playing');
      musicPlayBtn.setAttribute('aria-label', 'Pause background music');
      musicPlayBtn.setAttribute('aria-pressed', 'true');
    });

    bgMusic.addEventListener('pause', function () {
      musicPlayBtn.classList.remove('is-playing');
      musicPlayBtn.setAttribute('aria-label', 'Play background music');
      musicPlayBtn.setAttribute('aria-pressed', 'false');
    });
  }

  // ── Vote Widget ───────────────────────────────────────────────
  if (voteWidget && bgMusic) {
    var trackList    = voteWidget.querySelector('.vote-track-list');
    var votedTrackId = localStorage.getItem(VOTE_LS_KEY);

    var voteMarkActive = function (trackId) {
      voteWidget.querySelectorAll('.vote-track-row').forEach(function (row) {
        row.classList.toggle('is-active', row.getAttribute('data-track') === trackId);
      });
    };

    var voteShowPct = function (votes) {
      var total = Object.keys(TRACKS).reduce(function (s, id) { return s + (votes[id] || 0); }, 0);
      if (trackList) { trackList.classList.add('has-voted'); }
      Object.keys(TRACKS).forEach(function (id) {
        var pct = total > 0 ? Math.round(((votes[id] || 0) / total) * 100) : 0;
        var row = voteWidget.querySelector('.vote-track-row[data-track="' + id + '"]');
        if (!row) return;
        var pctEl = row.querySelector('.vote-pct');
        if (pctEl) { pctEl.textContent = pct + '%'; }
      });
    };

    var voteFetch = function () {
      fetch(VOTES_API, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) { console.warn('[HWDI] GET /votes status:', r.status); return null; }
          return r.json();
        })
        .then(function (v) {
          if (v) {
            console.log('[HWDI] GET /votes response:', JSON.stringify(v));
            voteShowPct(v);
          }
        })
        .catch(function (err) {
          console.warn('[HWDI] GET /votes fetch error:', err);
          voteShowPct({});
        });
    };

    // Track name button: switch track + play (panel stays open)
    voteWidget.querySelectorAll('.vote-track-play').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var trackId = btn.getAttribute('data-track');
        var info = TRACKS[trackId];
        if (!info) return;
        voteMarkActive(trackId);
        bgMusic.pause();
        bgMusic.src = info.src;
        var p = bgMusic.play();
        if (p !== undefined) {
          p.catch(function (err) {
            console.warn('[HWDI] Track switch blocked:', err.name, '-', err.message);
          });
        }
      });
    });

    // Checkmark button: cast first vote, or change vote to a different track.
    // Same-track tap is a no-op. Changing sends previousTrack so the backend
    // can decrement the old track and increment the new one atomically.
    voteWidget.querySelectorAll('.vote-check-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var trackId       = btn.getAttribute('data-track');
        var previousTrack = localStorage.getItem(VOTE_LS_KEY);

        // Tapping the same track already voted for does nothing
        if (previousTrack === trackId) { return; }

        // Immediately update checkmark UI: unhighlight old, highlight new
        if (previousTrack) {
          var prevRow = voteWidget.querySelector('.vote-track-row[data-track="' + previousTrack + '"]');
          if (prevRow) {
            var prevBtn = prevRow.querySelector('.vote-check-btn');
            if (prevBtn) { prevBtn.classList.remove('is-voted'); }
          }
        }
        btn.classList.add('is-voted');

        // Include previousTrack in the POST body when changing an existing vote
        var postBody = { track: trackId };
        if (previousTrack) { postBody.previousTrack = previousTrack; }

        fetch(VOTES_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postBody)
        })
          .then(function (r) {
            if (!r.ok) {
              console.warn('[HWDI] POST /votes status:', r.status);
              localStorage.setItem(VOTE_LS_KEY, trackId);
              voteFetch();
              return null;
            }
            return r.json();
          })
          .then(function (v) {
            if (!v) return;
            console.log('[HWDI] POST /votes response:', JSON.stringify(v));
            localStorage.setItem(VOTE_LS_KEY, trackId);
            voteShowPct(v);
          })
          .catch(function (err) {
            console.warn('[HWDI] POST /votes fetch error:', err);
            localStorage.setItem(VOTE_LS_KEY, trackId);
            voteFetch();
          });
      });
    });

    // On load: restore voted state + fetch current totals if already voted
    if (votedTrackId) {
      var votedRow = voteWidget.querySelector('.vote-track-row[data-track="' + votedTrackId + '"]');
      if (votedRow) {
        var votedCheckBtn = votedRow.querySelector('.vote-check-btn');
        if (votedCheckBtn) { votedCheckBtn.classList.add('is-voted'); }
      }
      voteFetch();
    }

    // Default active track highlight on load
    voteMarkActive('twang-happy');
  }

  var storeNotifyForm    = document.getElementById('storeNotifyForm');
  var storeNotifyInput   = document.getElementById('storeNotifyEmail');
  var storeNotifyConfirm = document.getElementById('storeNotifyConfirm');

  if (storeNotifyForm) {
    storeNotifyForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = storeNotifyInput ? storeNotifyInput.value.trim() : "";
      if (!email) return;

      // PLACEHOLDER — replace with real service call
      console.log("[Store notify] Email submitted:", email);

      if (storeNotifyConfirm) {
        storeNotifyConfirm.textContent = "You’re on the list! We’ll let you know when the store launches.";
      }
      storeNotifyForm.reset();
    });
  }


}());
