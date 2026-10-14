/* Service worker: deixa o app abrir sem sinal depois da primeira visita. */
const CACHE = 'mtb-shell-v1'
const NAV_TIMEOUT_MS = 3000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function store(request, response) {
  if (response && response.ok) {
    const copy = response.clone()
    caches.open(CACHE).then((c) => c.put(request, copy))
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)
  // Só o próprio site; chamadas ao Supabase passam direto (a fila offline cuida delas)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    // Página: rede primeiro, mas com limite de tempo para não travar em sinal fraco
    event.respondWith(
      Promise.race([
        fetch(req),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NAV_TIMEOUT_MS)),
      ])
        .then((res) => store(new Request(url.origin + '/'), res))
        .catch(() => caches.match(url.origin + '/').then((r) => r || caches.match(req))),
    )
    return
  }

  // Arquivos (JS/CSS com hash no nome): cache primeiro
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => store(req, res))),
  )
})
