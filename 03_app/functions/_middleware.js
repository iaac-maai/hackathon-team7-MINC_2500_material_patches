// Runs before EVERY request: the password gate, the admin gate, and the activity log.
// A visitor without the right cookies only gets the login pages and the login APIs.
import { adminToken, cookie, logEvent, readWho, sha256 } from "../lib/activity.js";

// Pages serves login.html at /login (it drops the .html)
const PUBLIC_PATHS = ["/login", "/login.html", "/api/login", "/admin-login", "/admin-login.html", "/api/admin/login",
  "/style.css", "/favicon.svg"];
const ADMIN_PATHS = ["/admin", "/admin.html", "/admin.js", "/admin.css"];
const PAGES = { "/": "home", "/index.html": "home", "/browse": "browse", "/browse.html": "browse", "/upload": "upload",
  "/upload.html": "upload", "/boards": "boards", "/boards.html": "boards", "/history": "history", "/history.html": "history" };

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  if (PUBLIC_PATHS.includes(path)) return next();

  // ---- the admin dashboard: its own password (ADMIN_PASSWORD), separate from the team password
  const isAdminArea = ADMIN_PATHS.includes(path) || path.startsWith("/api/admin/");
  const isAdmin = !!env.ADMIN_PASSWORD && cookie(request, "adm") === (await adminToken(env));
  if (isAdminArea) {
    if (isAdmin) return next();
    if (path.startsWith("/api/")) return Response.json({ error: "Admin login needed" }, { status: 401 });
    return Response.redirect(new URL("/admin-login", url), 302);
  }
  // the admin may see uploaded photos in the activity feed without the team login
  if (isAdmin && path.startsWith("/api/images/")) return next();

  // ---- the app: team password cookie + signed name cookie
  const token = cookie(request, "auth");
  const who = await readWho(request, env);
  if (!(token && env.APP_PASSWORD && token === (await authToken(env.APP_PASSWORD)) && who)) {
    if (path.startsWith("/api/")) return Response.json({ error: "Not logged in" }, { status: 401 });
    return Response.redirect(new URL("/login", url), 302);
  }
  context.data.who = who; // the functions can read who is asking

  // Keep a copy of the request body for the actions whose details we log (the function reads the original)
  const isBoardWrite = path.startsWith("/api/boards") && request.method !== "GET";
  const bodyCopy = isBoardWrite && ["POST", "PATCH"].includes(request.method) ? request.clone() : null;

  const response = await next(); // logged in: serve the page or run the API function
  context.waitUntil(record(env, request, who, path, response.clone(), bodyCopy).catch(() => {}));
  return response;
}

// Turn a request into one activity row (or none, for pictures, scripts and background calls)
async function record(env, request, who, path, response, bodyCopy) {
  const m = request.method, st = response.status;
  const url = new URL(request.url);
  if (m === "GET" && PAGES[path]) {
    const detail = {};
    if (path.startsWith("/boards") && url.searchParams.get("id")) detail.board_id = url.searchParams.get("id");
    if (url.searchParams.get("search")) detail.search_id = url.searchParams.get("search");
    if (url.searchParams.get("g")) detail.filter = url.searchParams.get("g");
    return logEvent(env, request, who, `view:${PAGES[path]}`, detail, st);
  }
  if (path === "/api/predict" && m === "POST") {
    const r = await response.json().catch(() => ({}));
    return logEvent(env, request, who, st === 200 ? "upload" : "upload_failed",
      st === 200 ? { search_id: r.id, material: r.material_guess, confidence: r.confidence, unusual: !!r.is_unusual }
        : { error: r.error }, st);
  }
  if (path === "/api/similar" && m === "GET") {
    return logEvent(env, request, who, "similar",
      { source: url.searchParams.get("source"), item_id: url.searchParams.get("id") }, st);
  }
  if (path === "/api/logout" && m === "POST") return logEvent(env, request, who, "logout", {}, st);
  if (path.startsWith("/api/boards") && m !== "GET") {
    const parts = path.split("/").filter(Boolean); // api, boards, <id>, items
    const body = bodyCopy ? await bodyCopy.json().catch(() => ({})) : {};
    const boardId = parts[2] || null;
    if (parts.length === 2 && m === "POST") {
      const r = await response.json().catch(() => ({}));
      return logEvent(env, request, who, "board_create", { board_id: r.id, name: body.name }, st);
    }
    if (parts[3] === "items" && m === "POST") {
      return logEvent(env, request, who, "save", { board_id: boardId, source: body.source, item_id: body.item_id,
        material: body.material, label: body.label, thumb_url: body.thumb_url }, st);
    }
    if (parts[3] === "items" && m === "DELETE") {
      return logEvent(env, request, who, "unsave", { board_id: boardId, source: url.searchParams.get("source"),
        item_id: url.searchParams.get("item_id") }, st);
    }
    if (m === "PATCH") return logEvent(env, request, who, "board_rename", { board_id: boardId, name: body.name }, st);
    if (m === "DELETE") return logEvent(env, request, who, "board_delete", { board_id: boardId }, st);
  }
}

// The cookie stores a hash of the password, never the password itself
export async function authToken(password) {
  return sha256(`hackathon:${password}`);
}
