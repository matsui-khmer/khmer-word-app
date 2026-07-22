// PWAオフラインキャッシュ用 Service Worker
// データや画面を更新したら CACHE_NAME のバージョン番号を上げること

const CACHE_NAME = "kw-app-v30";
const APP_SHELL = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/version.js",
  "./js/utils.js",
  "./js/sound.js",
  "./js/word-audio.js",
  "./js/storage.js",
  "./js/profile-switcher.js",
  "./js/tutorial.js",
  "./js/srs.js",
  "./js/quiz-engine.js",
  "./js/gamification.js",
  "./js/app.js",
  "./js/screens/home.js",
  "./js/screens/quiz.js",
  "./js/screens/result.js",
  "./js/screens/wordlist.js",
  "./js/screens/grammar.js",
  "./js/screens/achievements.js",
  "./js/screens/shop.js",
  "./data/words.js",
  "./data/grammar.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
