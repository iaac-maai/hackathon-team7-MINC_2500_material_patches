// GET /api/similar?source=photo|swatch&id=123&k=12 : the photos and swatches most like one gallery item
import { ASLEEP, callModel } from "../../lib/model.js";

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source");
  const id = Number(url.searchParams.get("id"));
  const k = Math.max(1, Math.min(Number(url.searchParams.get("k")) || 12, 40));
  if (!["photo", "swatch"].includes(source) || !Number.isInteger(id) || id < 0) {
    return Response.json({ error: "Use ?source=photo|swatch&id=<number>" }, { status: 400 });
  }
  try {
    const result = await callModel(env, "similar", [source, id, k]);
    return Response.json(result, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    if (err.modelError) return Response.json({ error: `No ${source} with id ${id}.` }, { status: 404 });
    return Response.json({ error: ASLEEP, detail: String(err) }, { status: 503 });
  }
}
