// Offline support from the page's side: registers the service worker, starts the one-time background
// download of exercise photos, and reports progress to the Profile page.
const listeners = new Set();
let last = null;

export function initOffline() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.addEventListener("message", e => {
    const m = e.data || {};
    if (m.type === "photos" || m.type === "status") { last = {...last, ...m}; listeners.forEach(fn => fn(last)); }
  });
  navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready).then(reg => {
    const saveData = navigator.connection && navigator.connection.saveData;
    if (navigator.onLine && !saveData) reg.active && reg.active.postMessage({type: "download-photos"});
    reg.active && reg.active.postMessage({type: "status"});
  }).catch(() => {});
}
export function onOfflineStatus(fn) { listeners.add(fn); if (last) fn(last); askStatus(); return () => listeners.delete(fn); }
export function askStatus() { navigator.serviceWorker?.ready.then(r => r.active && r.active.postMessage({type: "status"})).catch(() => {}); }
export function downloadPhotosNow() { navigator.serviceWorker?.ready.then(r => r.active && r.active.postMessage({type: "download-photos"})).catch(() => {}); }
export const offlineSupported = () => "serviceWorker" in navigator;
