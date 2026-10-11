(() => {
  const FRAME_COUNT = 240;
  const canvas = document.getElementById('animation-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loaderOverlay = document.getElementById('loader-overlay');
  const loaderPercentage = document.getElementById('loader-percentage');
  const loaderBarFill = document.getElementById('loader-bar-fill');
  const loaderText = document.getElementById('loader-text');

  const images = new Array(FRAME_COUNT);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let currentFrameIndex = 0;
  let isAnimating = false;
  let isFirstFrameReady = false;
  let isLoaderDismissed = false;

  // Smoothing configuration (cinematic inertia)
  const LERP_FACTOR = 0.085;

  // Frame URL generator
  function getFrameUrl(index) {
    const frameNum = String(index + 1).padStart(4, '0');
    return `frames/frame_${frameNum}.png`;
  }

  // Set crisp canvas resolution taking devicePixelRatio into account
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    if (canvas.width !== Math.round(displayWidth * dpr) || canvas.height !== Math.round(displayHeight * dpr)) {
      canvas.width = Math.round(displayWidth * dpr);
      canvas.height = Math.round(displayHeight * dpr);
    }

    renderFrame(currentFrameIndex);
  }

  // Draw image with centered "cover" aspect ratio onto canvas
  function drawCover(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth;
    const imgHeight = img.naturalHeight;

    const hRatio = canvasWidth / imgWidth;
    const vRatio = canvasHeight / imgHeight;
    const ratio = Math.max(hRatio, vRatio);

    const renderWidth = Math.round(imgWidth * ratio);
    const renderHeight = Math.round(imgHeight * ratio);
    const offsetX = Math.round((canvasWidth - renderWidth) / 2);
    const offsetY = Math.round((canvasHeight - renderHeight) / 2);

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, offsetX, offsetY, renderWidth, renderHeight);
  }

  // Find closest loaded frame to eliminate any flicker
  function getClosestLoadedFrame(index) {
    if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
      return images[index];
    }
    // Search backward
    for (let i = index - 1; i >= 0; i--) {
      if (images[i] && images[i].complete && images[i].naturalWidth > 0) {
        return images[i];
      }
    }
    // Search forward
    for (let i = index + 1; i < FRAME_COUNT; i++) {
      if (images[i] && images[i].complete && images[i].naturalWidth > 0) {
        return images[i];
      }
    }
    return null;
  }

  // Render a specific frame index
  function renderFrame(index) {
    const img = getClosestLoadedFrame(index);
    if (img) {
      drawCover(img);
    }
  }

  // Continuous animation loop with LERP smoothing
  function animationLoop() {
    const diff = targetProgress - currentProgress;

    if (Math.abs(diff) > 0.0001) {
      currentProgress += diff * LERP_FACTOR;
      isAnimating = true;
    } else {
      currentProgress = targetProgress;
      isAnimating = false;
    }

    const frameIndex = Math.min(
      FRAME_COUNT - 1,
      Math.max(0, Math.round(currentProgress * (FRAME_COUNT - 1)))
    );

    if (frameIndex !== currentFrameIndex) {
      currentFrameIndex = frameIndex;
      renderFrame(currentFrameIndex);
    }

    if (isAnimating) {
      requestAnimationFrame(animationLoop);
    }
  }

  function triggerAnimationLoop() {
    if (!isAnimating) {
      isAnimating = true;
      requestAnimationFrame(animationLoop);
    }
  }

  // Current scroll position across all browsers
  function getScrollPosition() {
    return (
      window.pageYOffset ||
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0
    );
  }

  // Maximum scroll distance of document
  function getMaxScroll() {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.body.clientHeight,
      document.documentElement.clientHeight
    );
    const winHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    return Math.max(1, docHeight - winHeight);
  }

  // Synchronize scroll progress with frame sequence
  function updateScrollProgress() {
    const scrollPos = getScrollPosition();
    const maxScroll = getMaxScroll();
    targetProgress = Math.min(1, Math.max(0, scrollPos / maxScroll));

    triggerAnimationLoop();
  }

  // Dismiss loader gracefully
  function dismissLoader() {
    if (isLoaderDismissed) return;
    isLoaderDismissed = true;
    if (loaderText) loaderText.textContent = 'Ready';
    setTimeout(() => {
      if (loaderOverlay) loaderOverlay.classList.add('is-hidden');
    }, 200);
  }

  // Progressive parallel frame loader
  function preloadAllFrames() {
    // Safety fallback: ensure loader is dismissed within 1.5s
    setTimeout(dismissLoader, 1500);

    // 1. Immediately load frame 0 for instant visual display
    const firstImg = new Image();
    firstImg.src = getFrameUrl(0);
    images[0] = firstImg;

    firstImg.onload = () => {
      isFirstFrameReady = true;
      resizeCanvas();
      renderFrame(0);
    };

    // 2. Concurrently load all frames with worker queue
    const CONCURRENCY = 12;
    let nextIndexToLoad = 0;

    function loadNext() {
      if (nextIndexToLoad >= FRAME_COUNT) return;

      const idx = nextIndexToLoad++;
      const img = new Image();
      img.src = getFrameUrl(idx);
      images[idx] = img;

      const onComplete = () => {
        loadedCount++;
        const percent = Math.floor((loadedCount / FRAME_COUNT) * 100);

        if (loaderPercentage) loaderPercentage.textContent = `${percent}%`;
        if (loaderBarFill) loaderBarFill.style.width = `${percent}%`;

        if (idx === 0 && !isFirstFrameReady) {
          isFirstFrameReady = true;
          resizeCanvas();
        }

        if (Math.abs(idx - currentFrameIndex) <= 1) {
          renderFrame(currentFrameIndex);
        }

        // Dismiss loader early so user can start scrolling immediately
        if (loadedCount >= 10) {
          dismissLoader();
        }

        if (loadedCount >= FRAME_COUNT) {
          dismissLoader();
        } else {
          loadNext();
        }
      };

      img.onload = onComplete;
      img.onerror = () => {
        console.warn(`Failed to load frame ${idx}`);
        onComplete();
      };
    }

    for (let i = 0; i < CONCURRENCY; i++) {
      loadNext();
    }
  }

  // =========================================================================
  // TYPING SUBTITLE EFFECT
  // =========================================================================
  function initTypingEffect() {
    const textElement = document.getElementById('typing-text');
    if (!textElement) return;

    const phrases = [
      'Full-Stack Developer',
      'UI/UX Enthusiast',
      'MERN Stack Specialist',
      'Problem Solver'
    ];
    let phraseIdx = 0;
    let charIdx = phrases[0].length;
    let isDeleting = true;

    function type() {
      const currentPhrase = phrases[phraseIdx];

      if (isDeleting) {
        textElement.textContent = currentPhrase.substring(0, charIdx - 1);
        charIdx--;
      } else {
        textElement.textContent = currentPhrase.substring(0, charIdx + 1);
        charIdx++;
      }

      let speed = isDeleting ? 40 : 80;

      if (!isDeleting && charIdx === currentPhrase.length) {
        speed = 2200; // Pause when word complete
        isDeleting = true;
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % phrases.length;
        speed = 400; // Pause before typing new word
      }

      setTimeout(type, speed);
    }

    setTimeout(type, 2000);
  }

  // =========================================================================
  // NAVBAR SCROLL SPY & INTERACTION
  // =========================================================================
  function initNavScrollSpy() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    window.addEventListener('scroll', () => {
      let currentSectionId = '';
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;

      sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        const sectionHeight = section.offsetHeight;
        if (scrollY >= sectionTop && scrollY < sectionTop + sectionHeight) {
          currentSectionId = section.getAttribute('id');
        }
      });

      if (currentSectionId) {
        navLinks.forEach(link => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${currentSectionId}`) {
            link.classList.add('active');
          }
        });
      }
    }, { passive: true });
  }

  // =========================================================================
  // TESTIMONIAL DOTS INTERACTIVITY
  // =========================================================================
  function initTestimonialDots() {
    const dots = document.querySelectorAll('.testimonial-dots .dot');
    dots.forEach((dot, idx) => {
      dot.addEventListener('click', () => {
        dots.forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
      });
    });
  }

  // =========================================================================
  // CONTACT FORM FEEDBACK
  // =========================================================================
  function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('.btn-submit');
      const originalText = submitBtn.innerHTML;

      submitBtn.innerHTML = 'Sending... ⏳';
      submitBtn.disabled = true;

      setTimeout(() => {
        submitBtn.innerHTML = 'Message Sent! ✓';
        submitBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        form.reset();

        setTimeout(() => {
          submitBtn.innerHTML = originalText;
          submitBtn.style.background = '';
          submitBtn.disabled = false;
        }, 3000);
      }, 1000);
    });
  }

  // =========================================================================
  // MOBILE NAVIGATION TOGGLE
  // =========================================================================
  function initMobileNav() {
    const toggle = document.getElementById('mobile-toggle');
    const menu = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
      menu.classList.toggle('is-open');
    });

    menu.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('is-open');
      });
    });
  }

  // =========================================================================
  // EVENT LISTENERS & INITIALIZATION
  // =========================================================================
  window.addEventListener('scroll', updateScrollProgress, { passive: true });
  document.addEventListener('scroll', updateScrollProgress, { passive: true });
  window.addEventListener('wheel', () => requestAnimationFrame(updateScrollProgress), { passive: true });
  window.addEventListener('touchmove', () => requestAnimationFrame(updateScrollProgress), { passive: true });
  window.addEventListener('resize', resizeCanvas, { passive: true });

  function init() {
    resizeCanvas();
    preloadAllFrames();
    updateScrollProgress();
    initTypingEffect();
    initNavScrollSpy();
    initTestimonialDots();
    initContactForm();
    initMobileNav();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
