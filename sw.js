// Arsenal Greater Masaka Shine — Service Worker
// Background push notifications via Firebase RTDB polling
const CACHE = "agms-v1";
const FIREBASE_URL = "https://arsenal-masaka-default-rtdb.firebaseio.com";

self.addEventListener("install", e => { self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(clients.claim()); });

// Cache essential files
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request).then(cached => {
        const fresh = fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    )
  );
});

// ── Background notification polling ───────────────────────
let lastChatTs = Date.now();
let lastPostTs = Date.now();
let lastLiveTs = Date.now();
let pollTimer = null;

function showNotif(title, body, tag) {
  self.registration.showNotification("⚽ " + title, {
    body,
    icon: "/arsenal-greater-masaka-shine/preview.jpg",
    badge: "/arsenal-greater-masaka-shine/preview.jpg",
    tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: self.location.origin + "/arsenal-greater-masaka-shine/" }
  });
}

async function pollFirebase() {
  try {
    // Check latest chat message
    const chatRes = await fetch(FIREBASE_URL + "/agms_chat.json?orderBy=\"ts\"&limitToLast=1");
    if (chatRes.ok) {
      const data = await chatRes.json();
      if (data) {
        const msg = Object.values(data)[0];
        if (msg && msg.ts > lastChatTs) {
          lastChatTs = msg.ts;
          showNotif("New message from " + (msg.senderName || "Someone"), msg.text || "Sent a photo 📷", "chat-" + msg.ts);
        }
      }
    }
  } catch (e) {}

  try {
    // Check latest community post
    const postRes = await fetch(FIREBASE_URL + "/agms_community.json?orderBy=\"createdAt\"&limitToLast=1");
    if (postRes.ok) {
      const data = await postRes.json();
      if (data) {
        const post = Object.values(data)[0];
        if (post && post.createdAt > lastPostTs) {
          lastPostTs = post.createdAt;
          showNotif((post.authorName || "Someone") + " posted", post.content ? post.content.slice(0, 80) : "New post on AGMS", "post-" + post.createdAt);
        }
      }
    }
  } catch (e) {}

  try {
    // Check if someone went live
    const liveRes = await fetch(FIREBASE_URL + "/agms_broadcast/active.json");
    if (liveRes.ok) {
      const data = await liveRes.json();
      if (data && data.startedAt > lastLiveTs) {
        lastLiveTs = data.startedAt;
        showNotif(data.name + " is LIVE now! 🔴", data.title || "Watch now on Arsenal Greater Masaka Shine", "live-" + data.startedAt);
      }
    }
  } catch (e) {}
}

// Start polling every 30 seconds when page is in background
self.addEventListener("message", e => {
  if (e.data === "START_POLL") {
    if (pollTimer) return;
    lastChatTs = Date.now();
    lastPostTs = Date.now();
    lastLiveTs = Date.now();
    pollTimer = setInterval(pollFirebase, 30000);
  }
  if (e.data === "STOP_POLL") {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }
});

// When notification is tapped, open the site
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.location.origin;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
      const match = cs.find(c => c.url.includes("arsenal-greater-masaka-shine"));
      if (match) return match.focus();
      return clients.openWindow(url);
    })
  );
});
