// POST /api/logout: forgets the login cookie and the name cookie (the middleware logs the logout)
export async function onRequestPost() {
  const headers = new Headers({ Location: "/login" });
  headers.append("Set-Cookie", "auth=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
  headers.append("Set-Cookie", "who=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0");
  return new Response(null, { status: 302, headers });
}
