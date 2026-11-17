// GET /api/images/<id>: an uploaded image, read back from R2 (behind the password like everything else)
export async function onRequestGet({ params, env }) {
  if (!/^[0-9a-f-]{36}$/.test(params.id)) return new Response("Not found", { status: 404 });
  const object = await env.BUCKET.get(`uploads/${params.id}`);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(object.body, {
    headers: { "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
      "Cache-Control": "private, max-age=86400" },
  });
}
