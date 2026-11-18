// GET /api/wake: pokes the model server so a sleeping free Render service starts waking up
export async function onRequestGet({ env }) {
  try {
    const res = await fetch(`${env.MODEL_URL}/gradio_api/info`, { signal: AbortSignal.timeout(8000) });
    return Response.json({ awake: res.ok });
  } catch {
    return Response.json({ awake: false });
  }
}
