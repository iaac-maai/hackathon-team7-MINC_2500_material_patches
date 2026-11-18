// Upload: drop a photo of a surface -> the model finds clean swatches first, then similar photos
import { h, api, sidebar, itemCard, fromServer, boardPicker, pretty, ICONS, openFromHash } from "/app.js";

sidebar("upload");
const main = document.getElementById("main");
const params = new URLSearchParams(location.search);
const NO_SWATCHES = ["carpet", "glass", "mirror", "wallpaper"];

const status = h("span", { class: "count", style: "margin-left:0" }, "Checking the model server…");
const fileInput = h("input", { type: "file", accept: "image/jpeg,image/png,image/webp", hidden: true });
const dropInner = h("div", {},
  h("div", { class: "big-icon", html: ICONS.upload }),
  h("b", {}, "Drop a photo here, or click to choose"),
  h("p", {}, "A close-up of one surface works best: a wall, a floor, a facade. You can also paste an image."));
const drop = h("div", { class: "drop", tabindex: 0, role: "button", "aria-label": "Choose a photo",
  onclick: () => fileInput.click(), onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); } } },
  dropInner);
const tips = h("ul", { style: "color:var(--muted);font-size:14px;padding-left:18px;margin:14px 0 0" },
  h("li", {}, "Only the middle of the photo is used, so frame the material in the centre."),
  h("li", {}, "JPEG, PNG or WebP. Big photos are shrunk in your browser before upload."),
  h("li", {}, "The first search after a quiet spell can take up to a minute while the free server wakes up."));
const results = h("section", { "aria-live": "polite" });
const galleries = h("section");

main.append(
  h("header", { class: "page-head" }, h("div", {},
    h("div", { class: "eyebrow" }, "Upload"),
    h("h1", {}, "Find materials like your photo"),
    h("p", {}, "The model compares your photo with 1,280 clean CC0 swatches and 3,900 photos of building materials.")),
    status),
  h("div", { class: "upload-grid" }, h("div", {}, drop, fileInput, tips), results),
  galleries,
);

// Wake the free Render server now, so it is ready when the photo is.
// Keep asking every 5 s (for up to 3 minutes) so the label turns "ready" by itself once it is up.
const wakeStart = Date.now();
async function checkAwake() {
  let awake = false;
  try { awake = (await api("/api/wake")).awake; } catch { /* treat as not awake yet */ }
  const secs = Math.round((Date.now() - wakeStart) / 1000);
  if (awake) { status.textContent = "● Model server ready"; status.style.color = "var(--ok)"; return; }
  status.style.color = "var(--warn)";
  if (secs > 180) { status.textContent = "● Model server not answering. Try reloading in a minute."; return; }
  status.textContent = `● Model server waking up… ${secs}s (usually under a minute)`;
  setTimeout(checkAwake, 5000);
}
checkAwake();

fileInput.addEventListener("change", () => fileInput.files[0] && search(fileInput.files[0]));
drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  const f = [...e.dataTransfer.files].find((f) => f.type.startsWith("image/"));
  if (f) search(f);
});
addEventListener("paste", (e) => {
  const f = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
  if (f) search(f);
});

// Shrink big photos to at most 1600 px (JPEG) before sending: faster, and under the 5 MB limit
async function shrink(file) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Use a JPEG, PNG or WebP photo.");
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 4.5 * 1024 * 1024) return file;
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

function showPreview(src) {
  drop.replaceChildren(h("img", { class: "preview", src, alt: "Your photo" }));
}

async function search(file) {
  let small;
  try { small = await shrink(file); } catch (err) { return showError(err.message); }
  showPreview(URL.createObjectURL(small));
  galleries.replaceChildren();
  results.replaceChildren(h("div", { class: "answer" },
    h("div", { style: "display:flex;gap:12px;align-items:center" }, h("span", { class: "spinner", style: "color:var(--accent)" }),
      h("b", {}, "Looking for matching materials…")),
    h("p", {}, "Usually a second or two; up to a minute if the model server was asleep.")));
  const form = new FormData();
  form.append("image", small);
  try {
    const result = await api("/api/predict", { method: "POST", body: form });
    history.replaceState(null, "", `/upload?search=${result.id}`);
    status.textContent = "● Model server ready";
    status.style.color = "var(--ok)";
    await render(result);
  } catch (err) {
    showError(err.message);
  }
}

function showError(text) {
  galleries.replaceChildren();
  results.replaceChildren(h("div", { class: "notice err" }, text),
    h("button", { class: "btn", style: "margin-top:12px", onclick: () => fileInput.click() }, "Try another photo"));
}

async function render(r) {
  const [swatches, photos] = await Promise.all([Promise.all(r.swatches.map(fromServer)), Promise.all(r.matches.map(fromServer))]);
  const upload = { key: `upload-${r.id}`, source: "upload", id: r.id, material: r.material_guess, thumb: r.image_url,
    name: `Your photo (${pretty(r.material_guess)})` };
  const [first, ...rest] = r.materials;
  const swatchSays = (r.swatch_materials || []).map((m) => pretty(m.name)).join(", ");

  results.replaceChildren(
    h("div", { class: "answer" },
      h("div", { class: "eyebrow" }, "The model thinks this is"),
      h("div", { class: "big" },
        h("span", {}, h("span", {}, pretty(first.name)), h("small", {}, `${Math.round(first.share * 100)}%`)),
        ...rest.map((m) => h("span", { class: "alt" }, "or ", h("span", {}, pretty(m.name)), h("small", {}, `${Math.round(m.share * 100)}%`)))),
      h("p", {}, `Percentages = share of the 5 most similar photos. `, swatchSays && `The closest clean swatches are: ${swatchSays}.`),
      r.is_unusual && h("div", { class: "notice warn" },
        `This photo does not look like a building material (unusual score ${r.unusual_score.toFixed(2)} > ${r.threshold.toFixed(2)}). The matches may not mean much.`),
      !r.is_unusual && r.confidence <= 0.4 && h("div", { class: "notice info" },
        "Not sure: the matches disagree. A closer photo of just the surface usually helps."),
      h("div", { class: "row", style: "display:flex;gap:8px;margin-top:14px;flex-wrap:wrap" },
        h("button", { class: "btn primary", onclick: (e) => boardPicker(e.currentTarget, upload) }, h("span", { html: ICONS.save, style: "display:contents" }), "Save your photo"),
        h("button", { class: "btn", onclick: () => fileInput.click() }, "Search another photo"),
        h("a", { class: "btn", href: `/browse?g=${encodeURIComponent(first.name)}` }, `Browse all ${pretty(first.name)}`))));
  galleries.replaceChildren(
    h("h2", {}, "Clean swatches", h("small", {}, "CC0, free to use · open one for more like it")),
    // replaceChildren would print `false` as text, so the optional note is an empty string when not needed
    NO_SWATCHES.includes(first.name) ? h("p", { style: "color:var(--muted);margin:-6px 0 12px" },
      `The CC0 libraries have no ${first.name} swatches, so these are the closest clean samples of other materials.`) : "",
    h("div", { class: "row-grid" }, ...swatches.map((it) => itemCard(it, { ratio: 1, caption: true }))),
    h("h2", {}, "Similar photos", h("small", {}, "from MINC-2500 · these decide the answer above")),
    h("div", { class: "row-grid" }, ...photos.map((it) => itemCard(it, { ratio: 1, caption: true }))),
  );
}

if (params.get("search")) {
  api(`/api/history?id=${encodeURIComponent(params.get("search"))}`)
    .then((r) => { showPreview(r.image_url); return render(r); })
    .catch((err) => showError(err.message));
}
openFromHash();
