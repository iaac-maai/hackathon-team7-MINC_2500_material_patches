// GET /api/boards: every mood board with its item count and up to 3 cover images
// POST /api/boards {name}: make a new board
export async function onRequestGet({ env }) {
  const { results: boards } = await env.DB.prepare(
    `SELECT b.id, b.name, b.created_at, COUNT(i.item_id) AS count
     FROM boards b LEFT JOIN board_items i ON i.board_id = b.id
     GROUP BY b.id ORDER BY b.created_at DESC`,
  ).all();
  const { results: covers } = await env.DB.prepare(
    `SELECT board_id, thumb_url FROM board_items ORDER BY added_at DESC`,
  ).all();
  for (const b of boards) {
    b.covers = covers.filter((c) => c.board_id === b.id).slice(0, 3).map((c) => c.thumb_url);
  }
  return Response.json(boards);
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim().slice(0, 60);
  if (!name) return Response.json({ error: "Give the board a name." }, { status: 400 });
  const board = { id: crypto.randomUUID(), name, created_at: new Date().toISOString(), count: 0, covers: [] };
  await env.DB.prepare("INSERT INTO boards (id, name, created_at) VALUES (?, ?, ?)")
    .bind(board.id, board.name, board.created_at).run();
  return Response.json(board, { status: 201 });
}
