// Who is logged in, and what they do: shared by the middleware, the login/logout functions and the admin API.
// The team logs in with one shared password plus their name. The name lives in a signed cookie ("who"),
// so it cannot be changed in the browser without logging in again. Every action becomes one row in D1 (events).

export async function sha256(text) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const cookie = (request, name) =>
  (request.headers.get("Cookie") || "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))?.[1];

const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const unb64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

// A clean display name: letters, digits, spaces and a few marks, at most 40 characters
export function cleanName(raw) {
  return String(raw || "").normalize("NFC").replace(/[^\p{L}\p{N} .'_-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

// who cookie = base64(JSON {n: name, s: session id}) + "." + signature (keyed with the app password)
export async function whoCookie(env, name) {
  const sid = crypto.randomUUID().slice(0, 8); // one id per login, so one person's two devices stay apart
  const payload = b64(JSON.stringify({ n: name, s: sid }));
  return { value: `${payload}.${await sha256(`who:${env.APP_PASSWORD}:${payload}`)}`, sid };
}

export async function readWho(request, env) {
  const raw = cookie(request, "who");
  if (!raw || !env.APP_PASSWORD) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || sig !== (await sha256(`who:${env.APP_PASSWORD}:${payload}`))) return null;
  try {
    const { n, s } = JSON.parse(unb64(payload));
    return n ? { name: n, sid: s } : null;
  } catch {
    return null;
  }
}

export const adminToken = (env) => sha256(`admin:${env.ADMIN_PASSWORD}`);

// "Mac · Chrome", "iPhone · Safari", ...: enough to tell devices apart, nothing more
export function device(ua = "") {
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android"
    : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Other";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /curl|python|node/i.test(ua) ? "script" : "other";
  return `${os} · ${br}`;
}

// One row per action. No IP address is stored: only country and city as Cloudflare reports them.
export async function logEvent(env, request, who, type, detail = {}, status = null) {
  if (!env.DB) return;
  const url = new URL(request.url);
  await env.DB.prepare(
    `INSERT INTO events (ts, user_name, session_id, type, path, detail_json, status, country, city, device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(new Date().toISOString(), who?.name || "(unknown)", who?.sid || null, type, url.pathname,
    JSON.stringify(detail).slice(0, 2000), status, request.cf?.country || null, request.cf?.city || null,
    device(request.headers.get("User-Agent") || "")).run().catch(() => {}); // logging never breaks the app
}
