const OFFLINE = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TransitIQ</title><body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f7fb;color:#12151c;font-family:ui-monospace,monospace"><main style="max-width:24rem;padding:1.5rem"><h1 style="font-size:1.5rem">TransitIQ is offline</h1><p>Open the app again when the phone has a connection.</p></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(request).catch(() => {
      if (request.mode === "navigate") {
        return new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return new Response("", { status: 503 });
    })
  );
});
