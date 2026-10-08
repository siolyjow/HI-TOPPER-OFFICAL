/* Expand an embedded game to its natural document height so the site page owns scrolling. */
(() => {
  'use strict';

  const frame = document.querySelector('iframe[data-lab-frame="true"]');
  if (!frame) return;

  const section = frame.closest('[data-slug]');
  const slug = section ? String(section.dataset.slug || '') : '';
  const MIN_HEIGHT = 180;
  const FALLBACK_HEIGHT = 560;
  let resizeObserver = null;
  let mutationObserver = null;
  let frameWindow = null;
  let observedDocument = null;
  let frameResizeHandler = null;
  let viewportResizeHandler = null;
  let viewportScrollHandler = null;
  let frameSourceObserver = null;
  let readyPollTimer = null;
  let readyPollDeadline = 0;
  let watchedDocument = null;
  const styledDocuments = new WeakSet();
  const resizeTimers = new Set();
  let scheduled = false;

  frame.setAttribute('scrolling', 'no');
  frame.dataset.layoutReady = 'false';
  frame.style.height = `${FALLBACK_HEIGHT}px`;

  function embeddedStyle() {
    const gameOverrides = {
      'ni-gyu': '.app, .screen { height:auto !important; min-height:0 !important; }',
      kacho: '.app-shell { height:auto !important; min-height:0 !important; }',
    }[slug] || '';

    return `
      html, body {
        height: auto !important;
        min-height: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      body {
        position: relative !important;
        overflow-x: hidden !important;
        overflow-y: hidden !important;
      }
      body > main,
      body > .app,
      body > .app-shell,
      body > .wrap {
        min-width: 0 !important;
        max-width: 100% !important;
        box-sizing: border-box !important;
      }
      ${gameOverrides}
      a[href="/lab/"][target="_top"] {
        position: absolute !important;
      }
    `;
  }

  function naturalHeight(doc) {
    const body = doc.body;
    if (!body) return FALLBACK_HEIGHT;
    const view = doc.defaultView;
    const bodyRect = body.getBoundingClientRect();
    // Measure visible descendants which contribute to normal document layout,
    // while respecting each ancestor's vertical clipping box. Fixed
    // animation layers are deliberately excluded because they fill the iframe
    // viewport and must not create a height feedback loop.
    let height = Math.max(body.offsetHeight, bodyRect.height);
    const styleCache = new WeakMap();
    const styleOf = (element) => {
      let style = styleCache.get(element);
      if (!style) {
        style = view.getComputedStyle(element);
        styleCache.set(element, style);
      }
      return style;
    };
    const elements = body.querySelectorAll('*');
    for (const element of elements) {
      let ancestor = element;
      let fixed = false;
      let clipBottom = Number.POSITIVE_INFINITY;
      while (ancestor && ancestor !== body) {
        const style = styleOf(ancestor);
        if (style.display === 'none' || style.visibility === 'hidden') {
          fixed = true;
          break;
        }
        if (style.position === 'fixed') {
          fixed = true;
          break;
        }
        if (style.overflowY === 'hidden' || style.overflowY === 'clip') {
          clipBottom = Math.min(clipBottom, ancestor.getBoundingClientRect().bottom - bodyRect.top);
        }
        ancestor = ancestor.parentElement;
      }
      if (fixed) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width || rect.height) {
        height = Math.max(height, Math.min(rect.bottom - bodyRect.top, clipBottom));
      }
    }
    return Math.max(MIN_HEIGHT, Math.ceil(height));
  }

  function resize() {
    scheduled = false;
    if (!frameWindow || !frame.contentDocument || frame.contentDocument !== observedDocument) return;
    const height = naturalHeight(frame.contentDocument);
    const value = `${height}px`;
    if (frame.style.height !== value) frame.style.height = value;
    frame.dataset.layoutReady = 'true';
  }

  function scheduleResize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(resize));
  }

  function scheduleResizeAfter(delay) {
    const timer = setTimeout(() => {
      resizeTimers.delete(timer);
      scheduleResize();
    }, delay);
    resizeTimers.add(timer);
  }

  function clearReadyPolling() {
    if (readyPollTimer !== null) {
      clearInterval(readyPollTimer);
      readyPollTimer = null;
    }
    readyPollDeadline = 0;
    watchedDocument = null;
  }

  function clearResizeTimers() {
    for (const timer of resizeTimers) clearTimeout(timer);
    resizeTimers.clear();
  }

  function stopFrameLifecycle({ stopAudio = true, preservePolling = false } = {}) {
    if (!preservePolling) clearReadyPolling();
    clearResizeTimers();
    scheduled = false;
    resizeObserver?.disconnect();
    mutationObserver?.disconnect();
    resizeObserver = null;
    mutationObserver = null;
    if (frameWindow) {
      if (frameResizeHandler) frameWindow.removeEventListener('resize', frameResizeHandler);
      if (frameWindow.visualViewport && viewportResizeHandler) {
        frameWindow.visualViewport.removeEventListener('resize', viewportResizeHandler);
        if (viewportScrollHandler) frameWindow.visualViewport.removeEventListener('scroll', viewportScrollHandler);
      }
      if (stopAudio) {
        try { frameWindow.LabGameLifecycle?.stopAudio?.(); } catch {}
      }
    }
    frameResizeHandler = null;
    viewportResizeHandler = null;
    viewportScrollHandler = null;
    frameWindow = null;
    observedDocument = null;
  }

  function sourceDocument() {
    let doc;
    try {
      doc = frame.contentDocument;
      const url = String(doc?.URL || '');
      if (!doc || !doc.documentElement || !url || url.startsWith('about:blank')) return null;
      return doc;
    } catch {
      return null;
    }
  }

  function applyStyle(doc) {
    if (!doc?.documentElement) return;
    let style = doc.getElementById('lab-embedded-layout');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'lab-embedded-layout';
      (doc.head || doc.documentElement).appendChild(style);
    }
    if (!styledDocuments.has(doc) || !style.textContent) {
      style.textContent = embeddedStyle();
      styledDocuments.add(doc);
    }
  }

  function install(documentNode = sourceDocument()) {
    let doc;
    try {
      doc = documentNode || sourceDocument();
      const nextWindow = frame.contentWindow;
      if (!doc || !nextWindow) return;
      applyStyle(doc);
      if (!doc.body || !['interactive', 'complete'].includes(doc.readyState)) return;
      if (doc !== observedDocument || nextWindow !== frameWindow) {
        stopFrameLifecycle({ stopAudio: false, preservePolling: true });
      }
      frameWindow = nextWindow;
      observedDocument = doc;
      if (resizeObserver && mutationObserver) {
        return;
      }
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(doc.body);
      if (doc.documentElement) resizeObserver.observe(doc.documentElement);
      mutationObserver = new MutationObserver(scheduleResize);
      mutationObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
      frameResizeHandler = scheduleResize;
      frameWindow.addEventListener('resize', frameResizeHandler, { passive: true });
      if (frameWindow.visualViewport) {
        viewportResizeHandler = scheduleResize;
        viewportScrollHandler = scheduleResize;
        frameWindow.visualViewport.addEventListener('resize', viewportResizeHandler, { passive: true });
        frameWindow.visualViewport.addEventListener('scroll', viewportScrollHandler, { passive: true });
      }
      for (const image of doc.images) {
        if (!image.complete) image.addEventListener('load', scheduleResize, { once: true });
      }
      if (doc.fonts?.ready) doc.fonts.ready.then(scheduleResize).catch(() => {});
      scheduleResize();
      scheduleResizeAfter(160);
      scheduleResizeAfter(600);
    } catch {
      // A future cross-origin runtime should remain usable with the fallback height.
    }
  }

  function resetForSource() {
    stopFrameLifecycle();
    frame.dataset.layoutReady = 'false';
    frame.style.height = `${FALLBACK_HEIGHT}px`;
  }

  function watchRuntimeDocument() {
    clearReadyPolling();
    if (!frame.getAttribute('src')) return;
    const deadline = Date.now() + 15000;
    readyPollDeadline = deadline;
    const poll = () => {
      const doc = sourceDocument();
      if (doc) {
        if (doc !== watchedDocument) {
          watchedDocument = doc;
          frame.dataset.layoutReady = 'false';
        }
        applyStyle(doc);
        if (doc.body && ['interactive', 'complete'].includes(doc.readyState)) {
          install(doc);
        }
      }
      if (Date.now() >= readyPollDeadline) clearReadyPolling();
    };
    poll();
    if (readyPollDeadline) readyPollTimer = setInterval(poll, 60);
  }

  frameSourceObserver = new MutationObserver(() => {
    resetForSource();
    watchRuntimeDocument();
  });
  frameSourceObserver.observe(frame, { attributes: true, attributeFilter: ['src'] });

  frame.addEventListener('load', () => {
    watchRuntimeDocument();
    install();
  });
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('orientationchange', scheduleResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      try { frameWindow?.LabGameLifecycle?.stopAudio?.(); } catch {}
    } else {
      watchRuntimeDocument();
      install();
      scheduleResize();
    }
  });
  window.addEventListener('pagehide', () => {
    stopFrameLifecycle();
    frameSourceObserver?.disconnect();
  });
  window.addEventListener('pageshow', () => {
    frameSourceObserver?.observe(frame, { attributes: true, attributeFilter: ['src'] });
    watchRuntimeDocument();
    install();
    scheduleResize();
  });
})();
