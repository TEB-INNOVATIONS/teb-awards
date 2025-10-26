 AOS.init({ duration: 1200 });

    function startExperience() {
      document.getElementById("welcomeDialog").style.display = "none";
      const music = document.getElementById("bgMusic");
      music.play();
      setupMusicReactive();
    }

    function setupMusicReactive() {
      const music = document.getElementById("bgMusic");
      const glow = document.getElementById("musicGlow");

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaElementSource(music);
      const analyser = ctx.createAnalyser();

      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyser.fftSize = 128;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      function animate() {
        requestAnimationFrame(animate);
        analyser.getByteFrequencyData(dataArray);
        let avg = dataArray.reduce((a, b) => a + b) / bufferLength;
        glow.style.background = `radial-gradient(circle at center, rgba(255,50,50,${avg/350}), transparent 70%)`;
      }
      animate();
    }

    // Image modal
    const items = document.querySelectorAll(".timeline-item img");
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImg");

    items.forEach(img => {
      img.addEventListener("click", e => {
        modal.style.display = "flex";
        modalImg.src = e.target.src;
      });
    });

    function closeModal() {
      modal.style.display = "none";
    }

    /* Scroll-driven timeline progress: grows the center line as user scrolls through the timeline */
    (function() {
      const progress = document.getElementById('timelineProgress');
      const timeline = document.querySelector('.timeline');
      if (!timeline || !progress) return;

      function updateTimelineProgress() {
        const rect = timeline.getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        // top of timeline relative to the document
        const timelineTop = rect.top + window.scrollY;
        const viewportBottom = window.scrollY + viewportHeight;
        // how many pixels of the timeline are visible from its top
        let visible = Math.max(0, Math.min(rect.height, viewportBottom - timelineTop));
        const p = rect.height > 0 ? (visible / rect.height) : 0;
        progress.style.height = (p * 100) + '%';
      }

      window.addEventListener('scroll', updateTimelineProgress, { passive: true });
      window.addEventListener('resize', updateTimelineProgress);
      window.addEventListener('load', () => { updateTimelineProgress(); setTimeout(updateTimelineProgress, 300); });
      // update after AOS finishes revealing elements
      if (window.AOS && typeof AOS.refresh === 'function') {
        AOS.refresh();
        setTimeout(updateTimelineProgress, 500);
      }

      // initial call
      updateTimelineProgress();
    })();

    /* Advanced preloader logic: smooth progress, rotating/fading quotes, skip support */
    (function() {
      const preloader = document.getElementById('preloader');
      const percentEl = document.getElementById('preloaderPercent');
      const fillEl = document.getElementById('preloaderFill');
      const quoteEl = document.getElementById('preloaderQuote');
      const skipBtn = document.getElementById('preloaderSkip');

      const quotes = [
        "Good things take time — hang tight!",
        "Every image tells a story — thanks for your patience.",
        "Almost there: greatness is being prepared.",
        "Patience + Persistence = Progress",
        "A moment of waiting for a lifetime of experience."
      ];

      let quoteIdx = 0;
      let quoteTimeout = null;
      let rotInterval = null;

      function fadeToQuote(text) {
        if (!quoteEl) return;
        quoteEl.style.opacity = '0';
        clearTimeout(quoteTimeout);
        quoteTimeout = setTimeout(() => {
          quoteEl.textContent = text;
          quoteEl.style.opacity = '1';
        }, 300);
      }

      function startQuotes() {
        fadeToQuote(quotes[quoteIdx]);
        rotInterval = setInterval(() => {
          quoteIdx = (quoteIdx + 1) % quotes.length;
          fadeToQuote(quotes[quoteIdx]);
        }, 3800);
      }

      // smooth progress animation towards target percent
      let targetPercent = 0;
      let displayedPercent = 0;
      let rafId = null;

      function animate() {
        displayedPercent += (targetPercent - displayedPercent) * 0.18; // easing
        if (Math.abs(displayedPercent - targetPercent) < 0.3) displayedPercent = targetPercent;
        const pct = Math.round(displayedPercent);
        if (percentEl) percentEl.textContent = pct + '%';
        if (fillEl) fillEl.style.width = pct + '%';
        if (displayedPercent < 100) {
          rafId = requestAnimationFrame(animate);
        }
      }

      function setTarget(p) {
        targetPercent = Math.max(0, Math.min(100, p));
        if (!rafId) {
          rafId = requestAnimationFrame(animate);
        }
      }

      function hidePreloader() {
        if (!preloader) return;
        preloader.style.opacity = '0';
        preloader.style.visibility = 'hidden';
        setTimeout(() => { preloader.style.display = 'none'; }, 600);
        if (rotInterval) clearInterval(rotInterval);
        if (quoteTimeout) clearTimeout(quoteTimeout);
        if (rafId) cancelAnimationFrame(rafId);
      }

      if (!preloader) return;

      // gather images to wait for (only timeline images to be faster) — change to document.images to wait all
      const imgs = Array.from(document.querySelectorAll('.timeline img'));
      const srcs = [...new Set(imgs.map(i => i.src).filter(Boolean))];
      let total = srcs.length;

      // show at least briefly
      setTarget(2);
      startQuotes();

      if (total === 0) {
        // no timeline images — quick hide
        setTarget(100);
        setTimeout(hidePreloader, 400);
        return;
      }

      let loaded = 0;
      const maxWait = 20000; // 20s fallback
      const timeout = setTimeout(() => {
        setTarget(100);
        setTimeout(hidePreloader, 600);
      }, maxWait);

      // listen to each image
      srcs.forEach(src => {
        const img = new Image();
        img.onload = img.onerror = function() {
          loaded++;
          const p = (loaded / total) * 100;
          setTarget(p);
          if (loaded >= total) {
            clearTimeout(timeout);
            setTarget(100);
            setTimeout(hidePreloader, 500);
          }
        };
        img.src = src;
      });

      // skip button behavior
      if (skipBtn) {
        skipBtn.addEventListener('click', () => {
          clearTimeout(timeout);
          setTarget(100);
          setTimeout(hidePreloader, 250);
        });
      }

      // ensure preloader hides if user interacts (for accessibility)
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          setTarget(100);
          setTimeout(hidePreloader, 200);
        }
      });
    })();

    /* Feedback modal behavior: show after 2 minutes, submit to Google Sheet via AJAX, support remind/close */
    (function(){
      const FEEDBACK_KEY = 'teb_feedback_submitted';
      const REMIND_KEY = 'teb_feedback_remind_at';
      const delay = 5 * 1000; // 30 seconds
      const feedbackModal = document.getElementById('feedbackModal');
      const form = document.getElementById('submit-form');
      const fbRemind = document.getElementById('fbRemind');
      const fbClose = document.getElementById('fbClose');

      function showModal() {
        if (!feedbackModal) return;
        feedbackModal.style.display = 'flex';
        feedbackModal.setAttribute('aria-hidden','false');
      }
      function hideModal() {
        if (!feedbackModal) return;
        feedbackModal.style.display = 'none';
        feedbackModal.setAttribute('aria-hidden','true');
      }

      // decide whether to show modal
      function shouldShow() {
        try {
          if (localStorage.getItem(FEEDBACK_KEY) === 'true') return false;
          const remind = localStorage.getItem(REMIND_KEY);
          if (remind) {
            const ts = parseInt(remind,10)||0;
            if (Date.now() < ts) return false;
          }
          return true;
        } catch(e) { return true; }
      }

      // schedule showing
      setTimeout(() => {
        if (shouldShow()) showModal();
      }, delay);

      // close handlers
      if (fbClose) fbClose.addEventListener('click', hideModal);
      if (fbRemind) fbRemind.addEventListener('click', () => {
        // remind in 1 hour
        try { localStorage.setItem(REMIND_KEY, (Date.now() + (60*60*1000)).toString()); } catch(e){}
        hideModal();
      });

      // form submission via provided Google Apps Script URL
      if (form) {
        $(form).submit((e)=>{
          e.preventDefault();
          const name = document.getElementById('fbName').value.trim();
          const phone = document.getElementById('fbPhone').value.trim();
          const feedback = document.getElementById('fbFeedback').value.trim();
          if (!name || !phone || !feedback) {
            alert('Please fill Name, Phone and Feedback. Email is optional.');
            return;
          }

          // disable submit to avoid duplicate sends
          const submitBtn = $(form).find('button[type="submit"]');
          submitBtn.prop('disabled', true).text('Submitting...');

          $.ajax({
            // Correct Apps Script URL (ensure your Apps Script is deployed as a web app and allows anonymous access)
            url: "https://script.google.com/macros/s/AKfycbx0L3RqoacrtT-RD7Yy3tNDuinXd11fQfbpMcTT_uIgqSD21KjqEMTB737aGorvOFoP/exec",
            data: $(form).serialize(),
            method: "post",
            timeout: 20000,
            success: function (response){
              try { localStorage.setItem(FEEDBACK_KEY, 'true'); } catch(e){}
              try { console.log('Feedback submit response:', response); } catch(e){}
              alert("Thank you — your feedback has been submitted.");
              hideModal();
            },
            error: function (err){
              console.error('Feedback submit error:', err);
              alert("Submission failed — please try again later. (Check console for details)");
            },
            complete: function() {
              submitBtn.prop('disabled', false).text('Submit');
            }
          });
        });
      }
    })();