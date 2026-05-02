export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // MarkMate still works normally if the browser blocks service workers.
    });
  });
}
