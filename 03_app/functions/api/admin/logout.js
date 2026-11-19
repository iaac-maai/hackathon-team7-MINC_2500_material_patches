// POST /api/admin/logout: forgets the admin cookie
export function onRequestPost() {
  return new Response(null, {
    status: 302,
    headers: { Location: "/admin-login", "Set-Cookie": "adm=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" },
  });
}
