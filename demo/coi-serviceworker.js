/*! Adapted from coi-serviceworker v0.1.7 (MIT) */

let coepCredentialless = false;

if (typeof window === 'undefined') {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

  self.addEventListener('message', (event) => {
    if (!event.data) return;

    if (event.data.type === 'deregister') {
      self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
        for (const client of clients) client.navigate(client.url);
      });
      return;
    }

    if (event.data.type === 'coepCredentialless') {
      coepCredentialless = !!event.data.value;
    }
  });

  self.addEventListener('fetch', (event) => {
    const request = event.request;

    if (!request.url.startsWith('http')) return;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

    const fetchRequest = (coepCredentialless && request.mode === 'no-cors')
      ? new Request(request, { credentials: 'omit' })
      : request;

    event.respondWith(
      fetch(fetchRequest)
        .then((response) => {
          if (response.status === 0 || response.type === 'opaque' || response.type === 'opaqueredirect') {
            return response;
          }

          const headers = new Headers(response.headers);
          headers.set('Cross-Origin-Opener-Policy', 'same-origin');
          headers.set('Cross-Origin-Embedder-Policy', coepCredentialless ? 'credentialless' : 'require-corp');
          if (!coepCredentialless) {
            headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
          }

          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        })
        .catch((error) => {
          console.error('[coi-serviceworker] fetch failed:', error);
          return fetch(fetchRequest);
        }),
    );
  });
} else {
  (() => {
    const reloadedBySelf = window.sessionStorage.getItem('coiReloadedBySelf');
    window.sessionStorage.removeItem('coiReloadedBySelf');
    const coepDegrading = reloadedBySelf === 'coepdegrade';

    const coi = {
      shouldRegister: () => !reloadedBySelf,
      shouldDeregister: () => false,
      coepCredentialless: () => true,
      coepDegrade: () => true,
      doReload: (reason) => {
        console.log('[coi-serviceworker] reloading for COI', { reason });
        window.location.reload();
      },
      quiet: false,
      ...window.coi,
    };

    const navigatorRef = navigator;
    const controlling = navigatorRef.serviceWorker && navigatorRef.serviceWorker.controller;

    if (controlling && !window.crossOriginIsolated) {
      window.sessionStorage.setItem('coiCoepHasFailed', 'true');
    }
    const coepHasFailed = window.sessionStorage.getItem('coiCoepHasFailed');

    if (controlling) {
      const reloadToDegrade = coi.coepDegrade() && !(coepDegrading || window.crossOriginIsolated);
      navigatorRef.serviceWorker.controller.postMessage({
        type: 'coepCredentialless',
        value: (reloadToDegrade || (coepHasFailed && coi.coepDegrade()))
          ? false
          : coi.coepCredentialless(),
      });

      if (reloadToDegrade) {
        !coi.quiet && console.log('[coi-serviceworker] reloading page to degrade COEP');
        window.sessionStorage.setItem('coiReloadedBySelf', 'coepdegrade');
        coi.doReload('coepdegrade');
      }

      if (coi.shouldDeregister()) {
        navigatorRef.serviceWorker.controller.postMessage({ type: 'deregister' });
      }
    }

    if (window.crossOriginIsolated !== false || !coi.shouldRegister()) return;

    if (!window.isSecureContext) {
      !coi.quiet && console.log('[coi-serviceworker] secure context required; not registering');
      return;
    }

    if (!navigatorRef.serviceWorker) {
      !coi.quiet && console.error('[coi-serviceworker] serviceWorker unavailable; cannot enable COI');
      return;
    }

    const currentScript = window.document.currentScript;
    const scriptUrl = currentScript instanceof HTMLScriptElement && currentScript.src
      ? currentScript.src
      : 'coi-serviceworker.js';

    navigatorRef.serviceWorker.register(scriptUrl, { updateViaCache: 'none' }).then(
      (registration) => {
        !coi.quiet && console.log('[coi-serviceworker] registered', {
          scope: registration.scope,
          controlling: !!navigatorRef.serviceWorker.controller,
        });

        registration.addEventListener('updatefound', () => {
          !coi.quiet && console.log('[coi-serviceworker] update found; reloading');
          window.sessionStorage.setItem('coiReloadedBySelf', 'updatefound');
          coi.doReload('updatefound');
        });

        if (registration.active && !navigatorRef.serviceWorker.controller) {
          !coi.quiet && console.log('[coi-serviceworker] active but not controlling; reloading');
          window.sessionStorage.setItem('coiReloadedBySelf', 'notcontrolling');
          coi.doReload('notcontrolling');
        }
      },
      (error) => {
        !coi.quiet && console.error('[coi-serviceworker] registration failed:', error);
      },
    );
  })();
}
