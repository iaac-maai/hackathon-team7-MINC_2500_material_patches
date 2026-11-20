// GET /api/cloud-uploads: the team's last 300 uploads, each with the 5 photos the model found closest,
// so the Home point cloud can place it among them (an upload has no stored 3D point of its own).
export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, material_guess, is_unusual, result_json FROM searches ORDER BY created_at DESC LIMIT 300",
  ).all();
  return Response.json(results.map((r) => {
    let near = [];
    try { near = (JSON.parse(r.result_json).matches || []).map((m) => `${m.source}-${m.id}`); } catch { /* old row */ }
    return { id: r.id, created_at: r.created_at, material: r.material_guess, is_unusual: !!r.is_unusual,
      image_url: `/api/images/${r.id}`, near };
  }), { headers: { "Cache-Control": "private, max-age=30" } });
}
