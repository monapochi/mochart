/**
 * coi-serviceworker.js — Cross-Origin Isolation via Service Worker
 *
 * GitHub Pages cannot set HTTP headers, so SharedArrayBuffer is unavailable
 * by default.  This service worker intercepts all fetches and injects the two
 * headers required for cross-origin isolation:
 *
 *   Cross-Origin-Opener-Policy: same-origin
 *   Cross-Origin-Embedder-Policy: require-corp
 *
 * Usage: include as the FIRST script in <head>:
 *
 *   <script src="coi-serviceworker.js"></script>
 *
 * Based on the MIT-licensed coi-serviceworker project by gzuidhof.
 * Vendored here to ensure reliable offline access.
 *
 * @license MIT
 */

/* ── Registration (runs in the main window context) ── */
if (typeof window !== 'undefined') {
  const RELOAD_COUNT_KEY = '__coi_reload_count__';
  const MAX_RELOADS = 3;

  function getReloadCount() {
    try {
      const raw = sessionStorage.getItem(RELOAD_COUNT_KEY);
      return raw ? Number(raw) || 0 : 0;
    } catch (e) {
      return 0;
    }
  }

  function setReloadCount(value) {
    try {
      sessionStorage.setItem(RELOAD_COUNT_KEY, String(value));
    } catch (e) {
      // ignore
    }
  }

  function clearReloadCount() {
    try {
      sessionStorage.removeItem(RELOAD_COUNT_KEY);
    } catch (e) {
      // ignore
    }
  }

  function tryReload(reason) {
    const count = getReloadCount();
    if (count >= MAX_RELOADS) {
      console.warn('[coi-serviceworker] max reload attempts reached; staying on page', { reason, count });
      return;
    }
    setReloadCount(count + 1);
    console.log('[coi-serviceworker] reloading for COI', { reason, attempt: count + 1, max: MAX_RELOADS });
    window.location.reload();
  }

  if (window.crossOriginIsolated) {
    // Successfully isolated: clear retry state.
    clearReloadCount();
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(window.document.currentScript?.src || 'coi-serviceworker.js')
      .then((reg) => {
        function awaitActivation(sw) {
          sw.addEventListener('statechange', () => {
            if (sw.state === 'activated' || sw.state === 'installed') {
              tryReload('statechange:' + sw.state);
            }
          });
        }

        // If controller appears after first install, retry once more.
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          tryReload('controllerchange');
        });

        if (reg.installing) {
          awaitActivation(reg.installing);
        } else if (reg.waiting) {
          tryReload('waiting');
        } else if (reg.active) {
          // SW already active but page is not yet isolated.
          tryReload('active-not-isolated');
        }
      })
      .catch((err) => {
        console.error('[coi-serviceworker] Registration failed:', err);
      });
  }
}

/* ── Service Worker context ── */
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  // We're running as a service worker.
  self.addEventListener('install', () => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (ev) => {
    ev.waitUntil(self.clients.claim());
  });

  /**
   * Add COOP + COEP headers to every response.
   * Both headers are required for `crossOriginIsolated` to be true,
   * which gates `SharedArrayBuffer` and `Atomics` availability.
   *
   * We skip data: and chrome-extension: URLs; those cannot be cross-origin
   * isolated anyway and intercepting them causes Chrome DevTools errors.
   */
  self.addEventListener('fetch', (ev) => {
    const req = ev.request;

    // Only intercept HTTP(S).
    if (!req.url.startsWith('http')) return;

    ev.respondWith(
      fetch(req)
        .then((resp) => {
          // Don't touch opaque (cross-origin no-cors) responses — we can't
          // modify their headers and they can't carry CORP anyway.
          if (resp.type === 'opaque' || resp.type === 'opaqueredirect') {
            return resp;
          }

          const headers = new Headers(resp.headers);
          headers.set('Cross-Origin-Opener-Policy',   'same-origin');
          headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
          // CORP allows our own-origin assets to be embeddable.
          if (!headers.has('Cross-Origin-Resource-Policy')) {
            headers.set('Cross-Origin-Resource-Policy', 'same-origin');
          }

          return new Response(resp.body, {
            status:     resp.status,
            statusText: resp.statusText,
            headers,
          });
        })
        .catch(() => fetch(req)),
    );
  });
}
