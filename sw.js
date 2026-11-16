// Service worker: guarda a app para abrir sem rede.
const V = 'carrinho-v6';
const SHELL = ['./', './index.html', './app.js', './store.js', './seed.js', './config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  // dados do Firebase nunca passam pela cache
  if (u.hostname.includes('googleapis.com') && !u.hostname.startsWith('fonts')) return;
  if (u.origin === location.origin) {
    // ficheiros da app: rede primeiro (para apanhar atualizações), cache se não houver rede
    e.respondWith(fetch(e.request, { cache: 'no-cache' }).then(r => { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
  } else if (/gstatic\.com|fonts\.googleapis\.com|cdn\.jsdelivr\.net/.test(u.hostname)) {
    // bibliotecas e letras: cache primeiro
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const c = res.clone(); caches.open(V).then(x => x.put(e.request, c)); return res; })));
  }
});
