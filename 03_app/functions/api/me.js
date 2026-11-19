// GET /api/me: the name you logged in with (shown in the sidebar)
export function onRequestGet({ data }) {
  return Response.json({ name: data.who?.name || null });
}
