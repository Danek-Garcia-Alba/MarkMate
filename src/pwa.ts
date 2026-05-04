export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    const reloadKey = "markmate-sw-refresh-v7";
    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing || sessionStorage.getItem(reloadKey) === "done") return;
      refreshing = true;
      sessionStorage.setItem(reloadKey, "done");
      window.location.reload();
    });

    navigator.serviceWorker
      .register("/sw.js?markmate-pwa-v7", { scope: "/" })
      .then((registration) => {
        const activateFreshWorker = (worker?: ServiceWorker | null) => {
          worker?.postMessage({ type: "SKIP_WAITING" });
        };

        activateFreshWorker(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              activateFreshWorker(worker);
            }
          });
        });

        window.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => {});
          }
        });
      })
      .catch(() => {
        // MarkMate still works normally if the browser blocks service workers.
      });
  });
}
