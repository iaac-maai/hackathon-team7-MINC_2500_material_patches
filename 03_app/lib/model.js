// Talking to the model server on Render (Gradio's HTTP API has two steps: start a job, then read its result)

export async function callModel(env, apiName, data) {
  const base = `${env.MODEL_URL}/gradio_api/call/${apiName}`;
  const started = await fetchWithTimeout(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!started.ok) throw new Error(`Model server answered ${started.status}`);
  const { event_id } = await started.json();

  const stream = await fetchWithTimeout(`${base}/${event_id}`);
  const text = await stream.text(); // "event: complete\ndata: [ {...} ]"  or  "event: error\ndata: ..."
  const complete = text.split("event: complete")[1];
  if (!complete) {
    const error = new Error(`No result from the model server: ${text.slice(0, 200)}`);
    error.modelError = text.includes("event: error");
    throw error;
  }
  return JSON.parse(complete.split("data:")[1].trim())[0];
}

export const ASLEEP =
  "The model did not answer. If the model server was asleep it is waking up: try again in a minute.";

async function fetchWithTimeout(url, options = {}, ms = 60000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function toBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}
