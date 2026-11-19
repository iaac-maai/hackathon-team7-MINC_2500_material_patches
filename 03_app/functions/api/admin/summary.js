// GET /api/admin/summary?hours=168&user=<name> : everything the admin dashboard shows (the middleware checks the admin cookie)
const ACTIONS = ["upload", "similar", "save", "unsave", "board_create", "board_rename", "board_delete"];

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const hours = Math.max(1, Math.min(Number(url.searchParams.get("hours")) || 168, 24 * 90));
  const user = url.searchParams.get("user") || null;
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const userSql = user ? " AND user_name = ?" : "";
  const args = (...a) => (user ? [...a, user] : a);
  const inList = ACTIONS.map(() => "?").join(",");

  const [totals, people, daily, recent, materials, live] = await env.DB.batch([
    env.DB.prepare(
      `SELECT COUNT(DISTINCT CASE WHEN type != 'login_failed' THEN user_name END) AS people,
              SUM(type = 'login') AS logins, SUM(type = 'login_failed') AS failed_logins,
              SUM(type LIKE 'view:%') AS views, SUM(type = 'upload') AS uploads, SUM(type = 'similar') AS similar,
              SUM(type = 'save') AS saves, COUNT(*) AS events
       FROM events WHERE ts >= ?${userSql}`).bind(...args(since)),
    env.DB.prepare(
      `SELECT user_name AS name, MIN(ts) AS first_seen, MAX(ts) AS last_seen,
              SUM(type = 'login') AS logins, SUM(type LIKE 'view:%') AS views, SUM(type = 'upload') AS uploads,
              SUM(type = 'similar') AS similar, SUM(type = 'save') AS saves, SUM(type = 'login_failed') AS failed,
              COUNT(DISTINCT session_id) AS sessions,
              (SELECT device FROM events e2 WHERE e2.user_name = e.user_name ORDER BY ts DESC LIMIT 1) AS device,
              (SELECT COALESCE(city || ', ', '') || COALESCE(country, '') FROM events e3
                 WHERE e3.user_name = e.user_name ORDER BY ts DESC LIMIT 1) AS place
       FROM events e WHERE ts >= ? GROUP BY user_name ORDER BY last_seen DESC`).bind(since),
    env.DB.prepare(
      `SELECT substr(ts, 1, 10) AS day, COUNT(*) AS events, SUM(type IN (${inList})) AS actions,
              SUM(type LIKE 'view:%') AS views, COUNT(DISTINCT user_name) AS people
       FROM events WHERE ts >= ?${userSql} GROUP BY day ORDER BY day`).bind(...ACTIONS, ...args(
      new Date(Math.min(Date.now() - hours * 3600e3, Date.now() - 13 * 86400e3)).toISOString().slice(0, 10))),
    env.DB.prepare(
      `SELECT id, ts, user_name, session_id, type, path, detail_json, status, country, city, device
       FROM events WHERE ts >= ?${userSql} ORDER BY ts DESC LIMIT 300`).bind(...args(since)),
    env.DB.prepare(
      `SELECT json_extract(detail_json, '$.material') AS material, COUNT(*) AS n
       FROM events WHERE ts >= ? AND type = 'upload'${userSql} GROUP BY material ORDER BY n DESC LIMIT 13`).bind(...args(since)),
    env.DB.prepare(
      `SELECT COUNT(DISTINCT user_name) AS now FROM events WHERE ts >= ? AND type != 'login_failed'`)
      .bind(new Date(Date.now() - 15 * 60e3).toISOString()),
  ]);
  const { results: boards } = await env.DB.prepare("SELECT id, name FROM boards").all();

  return Response.json({
    hours, user, since, generated_at: new Date().toISOString(), today: today.toISOString(),
    totals: totals.results[0], active_now: live.results[0].now,
    people: people.results, daily: daily.results, materials: materials.results,
    recent: recent.results.map((r) => ({ ...r, detail: JSON.parse(r.detail_json || "{}"), detail_json: undefined })),
    boards: Object.fromEntries(boards.map((b) => [b.id, b.name])),
  }, { headers: { "Cache-Control": "no-store" } });
}
