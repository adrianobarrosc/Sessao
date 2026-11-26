// Sessão: funciona sem internet com a última cópia da página, dos dados e das imagens já vistas.
const VERSION = 'sessao-v4';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== 'sessao-img').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const IMG_HOSTS = ['image.tmdb.org', 'books.google.com', 'covers.openlibrary.org', 'media.rawg.io', 'images.igdb.com', 'fonts.gstatic.com', 'fonts.googleapis.com'];

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // página e dados: rede primeiro (para pegar a atualização do dia), cópia salva se estiver sem internet
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
    return;
  }

  // capas, pôsteres e fontes: cópia salva primeiro, rede se ainda não tiver
  if (IMG_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.open('sessao-img').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
  }
});
