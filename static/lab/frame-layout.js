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
  let scheduled = false;

  frame.setAttribute('scrolling', 'no');
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
        overflow: hidden !important;
      }
      body {
        position: relative !important;
        overflow-x: hidden !important;
        overflow-y: hidden !important;
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
    const bodyRect = body.getBoundingClientRect();
    // scrollHeight can include fixed-position animation particles; measure the
    // natural body box and normal-flow children instead.
    let height = Math.max(body.offsetHeight, bodyRect.height);
    for (const child of body.children) {
      const style = doc.defaultView.getComputedStyle(child);
      if (style.position === 'fixed') continue;
      const rect = child.getBoundingClientRect();
      height = Math.max(height, rect.bottom - bodyRect.top);
    }
    return Math.max(MIN_HEIGHT, Math.ceil(height));
  }

  function resize() {
    scheduled = false;
    if (!frameWindow || !frame.contentDocument) return;
    const height = naturalHeight(frame.contentDocument);
    const value = `${height}px`;
    if (frame.style.height !== value) frame.style.height = value;
  }

  function scheduleResize() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(resize));
  }

  function install() {
    let doc;
    try {
      doc = frame.contentDocument;
      frameWindow = frame.contentWindow;
      if (!doc || !frameWindow || !doc.body) return;
      let style = doc.getElementById('lab-embedded-layout');
      if (!style) {
        style = doc.createElement('style');
        style.id = 'lab-embedded-layout';
        (doc.head || doc.documentElement).appendChild(style);
      }
      style.textContent = embeddedStyle();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(doc.body);
      if (doc.documentElement) resizeObserver.observe(doc.documentElement);
      mutationObserver = new MutationObserver(scheduleResize);
      mutationObserver.observe(doc.body, { childList: true, subtree: true, attributes: true });
      for (const image of doc.images) {
        if (!image.complete) image.addEventListener('load', scheduleResize, { once: true });
      }
      if (doc.fonts?.ready) doc.fonts.ready.then(scheduleResize).catch(() => {});
      scheduleResize();
      setTimeout(scheduleResize, 160);
      setTimeout(scheduleResize, 600);
    } catch {
      // A future cross-origin runtime should remain usable with the fallback height.
    }
  }

  frame.addEventListener('load', install);
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('orientationchange', scheduleResize, { passive: true });
})();
