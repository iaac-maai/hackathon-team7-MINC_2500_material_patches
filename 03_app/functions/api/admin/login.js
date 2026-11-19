// POST /api/admin/login with a form field "password": the admin cookie for /admin (needs the ADMIN_PASSWORD secret)
import { adminToken } from "../../../lib/activity.js";

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  if (!env.ADMIN_PASSWORD || (form.get("password") || "") !== env.ADMIN_PASSWORD) {
    return Response.redirect(new URL("/admin-login?wrong=1", request.url), 302);
  }
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    // 12 hours, HttpOnly, only sent by our own pages
    headers: { Location: "/admin", "Set-Cookie": `adm=${await adminToken(env)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure}` },
  });
}
