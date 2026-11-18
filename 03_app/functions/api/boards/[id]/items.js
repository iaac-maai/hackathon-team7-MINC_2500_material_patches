// POST /api/boards/<id>/items {source, item_id, material, thumb_url, label}: save an item to the board
// DELETE /api/boards/<id>/items?source=..&item_id=..: take it off again
const SOURCES = ["photo", "swatch", "upload"];

export async function onRequestPost({ params, request, env }) {
  const b = await request.json().catch(() => ({}));
  const source = String(b.source || "");
  const itemId = String(b.item_id ?? "");
  const thumb = String(b.thumb_url || "");
  // Only our own pictures: Hugging Face (gallery) or this app's uploads
  const okThumb = thumb.startsWith("https://huggingface.co/") || /^\/api\/images\/[0-9a-f-]{36}$/.test(thumb);
  if (!SOURCES.includes(source) || !itemId || !okThumb) {
    return Response.json({ error: "Need source, item_id and thumb_url." }, { status: 400 });
  }
  const board = await env.DB.prepare("SELECT id FROM boards WHERE id = ?").bind(params.id).first();
  if (!board) return Response.json({ error: "No such board" }, { status: 404 });
  await env.DB.prepare(
    `INSERT OR IGNORE INTO board_items (board_id, source, item_id, material, thumb_url, label, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(params.id, source, itemId.slice(0, 64), String(b.material || "").slice(0, 40), thumb,
    String(b.label || "").slice(0, 120), new Date().toISOString()).run();
  return Response.json({ saved: true }, { status: 201 });
}

export async function onRequestDelete({ params, request, env }) {
  const url = new URL(request.url);
  await env.DB.prepare("DELETE FROM board_items WHERE board_id = ? AND source = ? AND item_id = ?")
    .bind(params.id, url.searchParams.get("source"), url.searchParams.get("item_id")).run();
  return Response.json({ removed: true });
}
