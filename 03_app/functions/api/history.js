// GET /api/history: the 30 most recent searches.  GET /api/history?id=...: one search with its full result.
export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const row = await env.DB.prepare("SELECT * FROM searches WHERE id = ?").bind(id).first();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ id: row.id, created_at: row.created_at, image_url: `/api/images/${row.id}`,
      file_name: row.file_name, ...JSON.parse(row.result_json) });
  }
  const { results } = await env.DB.prepare(
    `SELECT id, created_at, file_name, material_guess, confidence, materials_json, unusual_score, is_unusual
     FROM searches ORDER BY created_at DESC LIMIT 30`,
  ).all();
  return Response.json(results.map((r) => ({ ...r, materials: JSON.parse(r.materials_json || "[]"),
    materials_json: undefined, image_url: `/api/images/${r.id}` })));
}
