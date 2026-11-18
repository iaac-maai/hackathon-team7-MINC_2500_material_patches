// GET /api/boards/<id>: the board and its items.  PATCH {name}: rename.  DELETE: remove the board.
export async function onRequestGet({ params, env }) {
  const board = await env.DB.prepare("SELECT id, name, created_at FROM boards WHERE id = ?").bind(params.id).first();
  if (!board) return Response.json({ error: "No such board" }, { status: 404 });
  const { results } = await env.DB.prepare(
    "SELECT source, item_id, material, thumb_url, label, added_at FROM board_items WHERE board_id = ? ORDER BY added_at DESC",
  ).bind(params.id).all();
  return Response.json({ ...board, items: results });
}

export async function onRequestPatch({ params, request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return Response.json({ error: "Give the board a name." }, { status: 400 });
  await env.DB.prepare("UPDATE boards SET name = ? WHERE id = ?").bind(name, params.id).run();
  return Response.json({ id: params.id, name });
}

export async function onRequestDelete({ params, env }) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM board_items WHERE board_id = ?").bind(params.id),
    env.DB.prepare("DELETE FROM boards WHERE id = ?").bind(params.id),
  ]);
  return Response.json({ deleted: params.id });
}
