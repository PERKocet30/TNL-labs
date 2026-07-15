/* ================================================================
   TNL Labs — frontend API client
   Drop this into your React app (e.g. client/src/lib/api.js).
   Every social action the app needs, talking to the real backend.

   Usage:
     import { api, onFeedEvent } from "./lib/api";
     await api.register({ username, displayName, email, role, password });
     const { posts } = await api.feed("beats");
     await api.like(postId);
     const stop = onFeedEvent((type, data) => { ... }); // live updates
================================================================ */

const BASE = import.meta?.env?.VITE_API_URL || "http://localhost:8787";
const TOKEN_KEY = "tnl-token";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); }

async function req(path, { method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // auth
  async register(payload) {
    const d = await req("/api/auth/register", { method: "POST", body: payload });
    setToken(d.token); return d.user;
  },
  async login(username, password) {
    const d = await req("/api/auth/login", { method: "POST", body: { username, password } });
    setToken(d.token); return d.user;
  },
  async logout() { try { await req("/api/auth/logout", { method: "POST" }); } finally { setToken(null); } },
  me: () => req("/api/me").then((d) => d.user),

  // feed & posts
  feed: (channel) => req("/api/feed" + (channel ? `?channel=${encodeURIComponent(channel)}` : "")).then((d) => d.posts),
  followingFeed: () => req("/api/feed/following").then((d) => d.posts),
  post: (payload) => req("/api/posts", { method: "POST", body: payload }).then((d) => d.post),

  // social actions
  like: (postId) => req(`/api/posts/${postId}/like`, { method: "POST" }).then((d) => d.liked),
  share: (postId, opts = {}) => req(`/api/posts/${postId}/share`, { method: "POST", body: opts }).then((d) => d.post),
  invite: (postId, username) => req(`/api/posts/${postId}/collab`, { method: "POST", body: { username } }),
  acceptCollab: (postId) => req(`/api/posts/${postId}/collab/accept`, { method: "POST" }),

  // graph & profiles
  follow: (username) => req(`/api/users/${username}/follow`, { method: "POST" }).then((d) => d.following),
  profile: (username) => req(`/api/users/${username}`),
  levels: () => req("/api/levels").then((d) => d.levels),
};

/* Live updates via Server-Sent Events. Returns an unsubscribe function.
   Events: "post", "like", "collab-invite", "collab-accepted". */
export function onFeedEvent(handler) {
  const es = new EventSource(BASE + "/api/stream");
  const types = ["post", "like", "collab-invite", "collab-accepted"];
  const listeners = types.map((t) => {
    const fn = (e) => handler(t, JSON.parse(e.data));
    es.addEventListener(t, fn);
    return [t, fn];
  });
  return () => { for (const [t, fn] of listeners) es.removeEventListener(t, fn); es.close(); };
}
