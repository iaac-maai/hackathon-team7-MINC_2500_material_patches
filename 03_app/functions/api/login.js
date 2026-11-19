// POST /api/login with form fields "name" and "password": sets the login cookie and the signed name cookie
import { authToken } from "../_middleware.js";
import { cleanName, logEvent, whoCookie } from "../../lib/activity.js";

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const password = form.get("password") || "";
  const name = cleanName(form.get("name"));

  if (!name) return Response.redirect(new URL("/login?noname=1", request.url), 302);
  if (!env.APP_PASSWORD || password !== env.APP_PASSWORD) {
    await logEvent(env, request, { name }, "login_failed", {}, 302); // the typed name only, never the password
    return Response.redirect(new URL("/login?wrong=1", request.url), 302);
  }

  const token = await authToken(env.APP_PASSWORD);
  const who = await whoCookie(env, name);
  await logEvent(env, request, { name, sid: who.sid }, "login", {}, 302);
  // Secure: only sent over https (always the case online; locally the app runs on http://localhost)
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  // HttpOnly: page scripts can't read it; SameSite=Strict: not sent by other sites; 7 days
  const flags = `Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${secure}`;
  const headers = new Headers({ Location: "/" });
  headers.append("Set-Cookie", `auth=${token}; ${flags}`);
  headers.append("Set-Cookie", `who=${who.value}; ${flags}`);
  return new Response(null, { status: 302, headers });
}
