/* eslint-disable */
// user-selector-helper.js
// 允许用户在页面上手动选择元素（单选/多选），带可视化高亮与超时控制

(function () {
  if (window.__USER_SELECTOR_HELPER_INITIALIZED__) return;
  window.__USER_SELECTOR_HELPER_INITIALIZED__ = true;

  let overlay;
  let highlightBox;
  let tipBar;
  let selected = new Set();
  let selectionType = 'single';
  let highlightMode = 'both';
  let resolvePromise;
  let timeoutId;

  function createUI(promptText = '请点击页面上您想要选择的元素') {
    overlay = document.createElement('div');
    overlay.id = 'chrome-mcp-user-selector-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      right: '0',
      bottom: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
    });

    highlightBox = document.createElement('div');
    highlightBox.id = 'chrome-mcp-user-selector-highlight';
    Object.assign(highlightBox.style, {
      position: 'fixed',
      border: '2px solid #4f46e5',
      background: 'rgba(79,70,229,0.08)',
      boxShadow: '0 0 0 2px rgba(255,255,255,0.8) inset',
      borderRadius: '4px',
      display: 'none',
      zIndex: '2147483647',
      pointerEvents: 'none',
    });

    tipBar = document.createElement('div');
    tipBar.id = 'chrome-mcp-user-selector-tipbar';
    Object.assign(tipBar.style, {
      position: 'fixed',
      left: '50%',
      transform: 'translateX(-50%)',
      top: '10px',
      background: 'rgba(0,0,0,0.75)',
      color: '#fff',
      padding: '6px 10px',
      borderRadius: '6px',
      fontSize: '13px',
      zIndex: '2147483647',
      pointerEvents: 'auto',
    });
    tipBar.textContent =
      promptText +
      (selectionType === 'multiple'
        ? '（按 Enter 确认，Esc 取消，多选：点击元素逐个添加）'
        : '（点击元素确认，Esc 取消）');

    overlay.appendChild(highlightBox);
    document.body.appendChild(overlay);
    document.body.appendChild(tipBar);
  }

  function removeUI() {
    overlay?.remove();
    tipBar?.remove();
    overlay = null;
    tipBar = null;
    highlightBox = null;
  }

  function isValid(el) {
    if (!el || !(el instanceof Element)) return false;
    if (el.id && String(el.id).startsWith('chrome-mcp-')) return false;
    return true;
  }

  function getRect(el) {
    const r = el.getBoundingClientRect();
    return {
      x: r.left,
      y: r.top,
      width: r.width,
      height: r.height,
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      left: r.left,
    };
  }

  function getAccessibleName(el) {
    const labelledby = el.getAttribute('aria-labelledby');
    if (labelledby) {
      const labelElement = document.getElementById(labelledby);
      if (labelElement) return labelElement.textContent?.trim() || '';
    }
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
    if (el.id) {
      const label = document.querySelector(`label[for="${el.id}"]`);
      if (label) return label.textContent?.trim() || '';
    }
    const parentLabel = el.closest('label');
    if (parentLabel) return parentLabel.textContent?.trim() || '';
    return (
      el.getAttribute('placeholder') ||
      el.getAttribute('value') ||
      el.textContent?.trim() ||
      el.getAttribute('title') ||
      ''
    );
  }

  function generateSelector(el) {
    if (!(el instanceof Element)) return '';
    if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
      return `#${CSS.escape(el.id)}`;
    }
    for (const attr of ['data-testid', 'data-cy', 'name']) {
      const v = el.getAttribute(attr);
      if (v) {
        const s = `[${attr}="${CSS.escape(v)}"]`;
        if (document.querySelectorAll(s).length === 1) return s;
      }
    }
    let path = '';
    let cur = el;
    while (cur && cur.nodeType === Node.ELEMENT_NODE && cur.tagName !== 'BODY') {
      let s = cur.tagName.toLowerCase();
      const p = cur.parentElement;
      if (p) {
        const sibs = Array.from(p.children).filter((c) => c.tagName === cur.tagName);
        if (sibs.length > 1) s += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      path = path ? `${s} > ${path}` : s;
      cur = p;
    }
    return path ? `body > ${path}` : 'body';
  }

  function updateHighlight(el) {
    if (!el || !highlightBox) return;
    const r = el.getBoundingClientRect();
    Object.assign(highlightBox.style, {
      left: r.left + 'px',
      top: r.top + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
      display: 'block',
    });
    if (highlightMode === 'border') highlightBox.style.background = 'transparent';
    else if (highlightMode === 'overlay') highlightBox.style.border = 'none';
    else {
      highlightBox.style.border = '2px solid #4f46e5';
      highlightBox.style.background = 'rgba(79,70,229,0.08)';
    }
  }

  function cleanup(result) {
    window.removeEventListener('mousemove', onMove, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('keydown', onKey, true);
    removeUI();
    clearTimeout(timeoutId);
    resolvePromise?.(result);
    selected.clear();
  }

  function onMove(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (isValid(el)) updateHighlight(el);
  }

  function buildInfo(el) {
    const rect = getRect(el);
    const txt = getAccessibleName(el);
    return {
      selector: generateSelector(el),
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      text: (txt || '').slice(0, 100),
      isVisible: true,
      rect,
      coordinates: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    };
  }

  function onClick(e) {
    if (!tipBar) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!isValid(el)) return;
    e.preventDefault();
    e.stopPropagation();
    if (selectionType === 'single') {
      cleanup({ success: true, elements: [buildInfo(el)] });
    } else {
      const key = el;
      if (!selected.has(key)) selected.add(key);
      tipBar.textContent = `已选择 ${selected.size} 个元素。按 Enter 确认，Esc 取消。`;
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      cleanup({ success: false, error: '用户取消选择' });
    } else if (e.key === 'Enter' && selectionType === 'multiple') {
      const arr = Array.from(selected).map(buildInfo);
      cleanup({ success: true, elements: arr });
    }
  }

  async function startUserSelect(options = {}) {
    selectionType = options.selectionType === 'multiple' ? 'multiple' : 'single';
    highlightMode = options.highlightMode || 'both';
    const prompt = options.prompt || '请点击页面上您想要选择的元素';
    const timeout = typeof options.timeout === 'number' ? options.timeout : 30000;
    createUI(prompt);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);

    return new Promise((resolve) => {
      resolvePromise = resolve;
      timeoutId = setTimeout(() => {
        cleanup({ success: false, error: '用户选择超时' });
      }, timeout);
    });
  }

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request.action === 'startUserSelector') {
      startUserSelect(request.options)
        .then(sendResponse)
        .catch((err) => sendResponse({ success: false, error: String(err?.message || err) }));
      return true;
    } else if (request.action === 'chrome_user_selector_ping') {
      sendResponse({ status: 'pong' });
      return false;
    }
  });
})();
