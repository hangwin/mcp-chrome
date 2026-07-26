/* eslint-disable */
/**
 * MCP built-in pointer cursor + click pulse.
 * Injected into pages so agent clicks are visible in the live browser
 * (and therefore in screenshots / any recorder that captures the tab).
 */
(function initMcpCursor() {
  if (window.__MCP_CURSOR__ && window.__MCP_CURSOR__.__ready) return;

  const HOST_ID = '__mcp_cursor_host__';
  const CURSOR_SIZE = 28;
  const MOVE_MS = 320;
  const HOLD_MS = 650;
  const HIDE_MS = 1400;

  let host = null;
  let arrow = null;
  let ripple = null;
  let hideTimer = null;
  let last = { x: -1, y: -1 };

  function ensureHost() {
    if (host && host.isConnected) return host;
    host = document.getElementById(HOST_ID);
    if (host) {
      arrow = host.querySelector('[data-mcp-arrow]');
      ripple = host.querySelector('[data-mcp-ripple]');
      return host;
    }

    host = document.createElement('div');
    host.id = HOST_ID;
    host.setAttribute('data-mcp-cursor', '1');
    Object.assign(host.style, {
      position: 'fixed',
      left: '0',
      top: '0',
      width: '0',
      height: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
      overflow: 'visible',
    });

    ripple = document.createElement('div');
    ripple.setAttribute('data-mcp-ripple', '1');
    Object.assign(ripple.style, {
      position: 'fixed',
      width: '12px',
      height: '12px',
      marginLeft: '-6px',
      marginTop: '-6px',
      borderRadius: '50%',
      border: '2px solid rgba(255, 59, 48, 0.95)',
      background: 'rgba(255, 59, 48, 0.22)',
      opacity: '0',
      transform: 'scale(0.4)',
      transition: 'opacity 120ms ease, transform 420ms ease',
      willChange: 'transform, opacity',
    });

    arrow = document.createElement('div');
    arrow.setAttribute('data-mcp-arrow', '1');
    Object.assign(arrow.style, {
      position: 'fixed',
      width: `${CURSOR_SIZE}px`,
      height: `${CURSOR_SIZE}px`,
      opacity: '0',
      transform: 'translate(-2px, -2px) scale(0.92)',
      transition: `left ${MOVE_MS}ms cubic-bezier(.2,.8,.2,1), top ${MOVE_MS}ms cubic-bezier(.2,.8,.2,1), opacity 120ms ease, transform 120ms ease`,
      willChange: 'left, top, opacity, transform',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.45))',
    });
    arrow.innerHTML = `
      <svg width="${CURSOR_SIZE}" height="${CURSOR_SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M4 2.5 L4 18.5 L8.2 14.8 L11.2 22.2 L13.6 21.2 L10.5 13.6 L16.8 13.6 Z"
          fill="#ffffff" stroke="#111827" stroke-width="1.4" stroke-linejoin="round"/>
      </svg>
    `;

    host.appendChild(ripple);
    host.appendChild(arrow);
    (document.documentElement || document.body).appendChild(host);
    return host;
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function scheduleHide(ms) {
    clearHideTimer();
    hideTimer = setTimeout(() => {
      if (!arrow) return;
      arrow.style.opacity = '0';
      arrow.style.transform = 'translate(-2px, -2px) scale(0.92)';
    }, ms);
  }

  function moveTo(x, y, animate) {
    ensureHost();
    const nx = Math.round(x);
    const ny = Math.round(y);
    if (!animate || last.x < 0) {
      arrow.style.transition = 'none';
      arrow.style.left = `${nx}px`;
      arrow.style.top = `${ny}px`;
      // force reflow then restore transition
      void arrow.offsetWidth;
      arrow.style.transition = `left ${MOVE_MS}ms cubic-bezier(.2,.8,.2,1), top ${MOVE_MS}ms cubic-bezier(.2,.8,.2,1), opacity 120ms ease, transform 120ms ease`;
    } else {
      arrow.style.left = `${nx}px`;
      arrow.style.top = `${ny}px`;
    }
    arrow.style.opacity = '1';
    arrow.style.transform = 'translate(-2px, -2px) scale(1)';
    last = { x: nx, y: ny };
  }

  function pulse(x, y) {
    ensureHost();
    ripple.style.left = `${Math.round(x)}px`;
    ripple.style.top = `${Math.round(y)}px`;
    ripple.style.transition = 'none';
    ripple.style.opacity = '0.95';
    ripple.style.transform = 'scale(0.35)';
    void ripple.offsetWidth;
    ripple.style.transition = 'opacity 420ms ease, transform 420ms ease';
    ripple.style.opacity = '0';
    ripple.style.transform = 'scale(2.6)';
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Show cursor, optional move animation, click pulse, then auto-hide.
   */
  async function showClick(x, y, options = {}) {
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return { ok: false, error: 'invalid coordinates' };
    }
    clearHideTimer();
    const animateMove = options.animateMove !== false && last.x >= 0;
    moveTo(x, y, animateMove);
    if (animateMove) await sleep(MOVE_MS);
    else await sleep(40);
    pulse(x, y);
    // brief press feedback
    arrow.style.transform = 'translate(-2px, -2px) scale(0.88)';
    await sleep(70);
    arrow.style.transform = 'translate(-2px, -2px) scale(1)';
    scheduleHide(typeof options.hideAfterMs === 'number' ? options.hideAfterMs : HIDE_MS);
    await sleep(typeof options.holdMs === 'number' ? options.holdMs : HOLD_MS);
    return { ok: true, x, y };
  }

  function hide() {
    clearHideTimer();
    if (arrow) {
      arrow.style.opacity = '0';
    }
    if (ripple) {
      ripple.style.opacity = '0';
    }
  }

  window.__MCP_CURSOR__ = {
    __ready: true,
    showClick,
    moveTo,
    pulse,
    hide,
  };

  // Message bridge for background / other helpers
  try {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (!message || typeof message !== 'object') return false;
      if (message.action === 'mcp_cursor_ping') {
        sendResponse({ status: 'pong' });
        return false;
      }
      if (message.action === 'mcp_cursor_click') {
        showClick(message.x, message.y, message.options || {})
          .then((result) => sendResponse(result))
          .catch((error) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        return true;
      }
      if (message.action === 'mcp_cursor_move') {
        moveTo(message.x, message.y, message.animate !== false);
        sendResponse({ ok: true });
        return false;
      }
      if (message.action === 'mcp_cursor_hide') {
        hide();
        sendResponse({ ok: true });
        return false;
      }
      return false;
    });
  } catch {
    // MAIN world may not have chrome.runtime; callers can use window.__MCP_CURSOR__
  }
})();
