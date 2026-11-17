// POST /api/logout: forgets the login cookie
export async function onRequestPost({ request }) {
  return new Response(null, {
    status: 302,
    headers: { Location: "/login", "Set-Cookie": "auth=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0" },
  });
}
