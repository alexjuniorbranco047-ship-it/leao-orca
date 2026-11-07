// Leão Orça - service worker (funcionamento sem internet)
const V = "leao-v2";
const EXT = ["cdnjs.cloudflare.com", "www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];
const PRE = ["./", "./index.html", "./legal.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./icon-180.png"];
const PRE_EXT = [
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js",
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js"
];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    await c.addAll(PRE);
    await Promise.all(PRE_EXT.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const r = e.request;
  if (r.method !== "GET") return;
  const u = new URL(r.url);

  // Arquivos do próprio app: abre na hora pelo cache e atualiza em segundo plano
  if (u.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(V);
      const m = await c.match(r, { ignoreSearch: true });
      const rede = fetch(r, { cache: "no-cache" }).then(async res => {
        if (res.ok) {
          const antigo = m && m.headers.get("etag"), novo = res.headers.get("etag");
          await c.put(r, res.clone());
          if (m && antigo && novo && antigo !== novo && (r.mode === "navigate" || u.pathname.endsWith("index.html"))) {
            const cs = await self.clients.matchAll();
            cs.forEach(x => x.postMessage("nova"));
          }
        }
        return res;
      }).catch(() => null);
      if (m) { e.waitUntil(rede); return m; }
      const res = await rede;
      return res || (r.mode === "navigate" ? c.match("./index.html") : Response.error());
    })());
    return;
  }

  // Bibliotecas e fontes: usa o cache e guarda na primeira vez
  if (EXT.includes(u.hostname)) {
    e.respondWith((async () => {
      const m = await caches.match(r);
      if (m) return m;
      try {
        const res = await fetch(r);
        if (res.ok || res.type === "opaque") { const c = await caches.open(V); c.put(r, res.clone()); }
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
  }
  // Demais pedidos (login e banco de dados do Firebase) não passam pelo cache
});
