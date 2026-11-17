// POST /api/predict with a form field "image" (a file):
// 1. send it to the model server, 2. store the image in R2, 3. store the result in D1, 4. answer the page.
import { ASLEEP, callModel, toBase64 } from "../../lib/model.js";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function onRequestPost({ request, env }) {
  const form = await request.formData();
  const file = form.get("image");
  if (!file || typeof file === "string") {
    return Response.json({ error: "Send an image file in the field 'image'." }, { status: 400 });
  }
  if (file.type && !TYPES.includes(file.type)) {
    return Response.json({ error: "Use a JPEG, PNG or WebP photo." }, { status: 415 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "Image too large (max 5 MB)." }, { status: 413 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());

  // 1. Ask the model
  let result;
  try {
    result = await callModel(env, "predict", [toBase64(bytes)]);
  } catch (err) {
    if (err.modelError) {
      return Response.json({ error: "The model could not read this image. Try another photo." }, { status: 422 });
    }
    return Response.json({ error: ASLEEP, detail: String(err) }, { status: 503 });
  }

  // 2. Store the image in R2 under a random name
  const id = crypto.randomUUID();
  const imageKey = `uploads/${id}`;
  await env.BUCKET.put(imageKey, bytes, { httpMetadata: { contentType: file.type || "image/jpeg" } });

  // 3. Store one row in D1. The "?" placeholders keep user input out of the SQL text
  const createdAt = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO searches (id, created_at, image_key, file_name, material_guess, confidence, materials_json,
                           unusual_score, is_unusual, result_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, createdAt, imageKey, (file.name || "").slice(0, 200) || null, result.material_guess, result.confidence,
      JSON.stringify(result.materials), result.unusual_score, result.is_unusual ? 1 : 0, JSON.stringify(result))
    .run();

  // 4. Answer the page
  return Response.json({ id, created_at: createdAt, image_url: `/api/images/${id}`, ...result });
}
