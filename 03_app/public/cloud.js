// Home: the point cloud. Every photo and swatch where model v3 puts it: its 32-number code squashed to 3D (UMAP).
// Colour = the 13 k-means clusters (found without labels), or the true material, or where the two disagree.
// The team's uploads sit among the 5 photos the model found closest to them. Drag to turn, scroll to zoom, click a dot.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { h, api, sidebar, loadCatalog, openPin, openFromHash, label, pretty, materialColour, ICONS } from "/app.js";

sidebar("cloud");
const main = document.getElementById("main");
const params = new URLSearchParams(location.search);
const R = 10;                                   // the cloud fits in a cube of side 2R

// ---- page ------------------------------------------------------------------------------------------
const stage = h("div", { class: "cloud-stage" });
const tip = h("div", { class: "cloud-tip", hidden: true });
const loading = h("div", { class: "cloud-loading" }, h("span", { class: "spinner" }), "Placing 5,180 images…");
const stats = h("p", { class: "cloud-stats" });
const legend = h("div", { class: "legend-list" });
const modeBtns = h("div", { class: "seg", role: "group", "aria-label": "Colour by" });
const showBox = h("div", { class: "cloud-show" });
const panel = h("aside", { class: "cloud-panel" },
  h("h3", {}, "Colour by"), modeBtns, legend,
  h("h3", {}, "Show"), showBox,
  h("p", { class: "cloud-note" }, "UMAP keeps neighbours together, so the directions mean nothing; only closeness does."));

main.append(h("section", { class: "cloud-wrap" },
  h("header", { class: "cloud-head" },
    h("div", { class: "eyebrow" }, "How the model sees"),
    h("h1", {}, "Every material, as the model reads it"),
    h("p", {}, "Each dot is one image. The model turns it into 32 numbers, and images with similar numbers sit close together. ",
      "Drag to turn, scroll to zoom, click a dot to open it."),
    stats,
    h("div", { class: "row" },
      h("a", { class: "btn primary", href: "/upload" }, h("span", { html: ICONS.upload, style: "display:contents" }), "Upload a photo"),
      h("a", { class: "btn", href: "/how" }, h("span", { html: ICONS.how, style: "display:contents" }), "How it works"))),
  stage, tip, loading, panel));

// ---- data ------------------------------------------------------------------------------------------
const [cat, cloud, uploads] = await Promise.all([
  loadCatalog(),
  fetch("/data/cloud.json").then((r) => r.json()),
  api("/api/cloud-uploads").catch(() => []),
]);
const clusters = cloud.clusters.map((cl, n) => ({ ...cl, n: n + 1 }));
const clusterById = new Map(clusters.map((cl) => [cl.id, cl]));

const pts = cat.items.map((it, i) => {
  const [x, y, z, cluster] = cloud.points[i];
  return { it, pos: new THREE.Vector3(x, y, z).multiplyScalar(R / 1000), cluster, material: it.group, kind: it.source };
});
const byKey = new Map(pts.map((p) => [p.it.key, p]));

// An upload has no stored 3D point: put it at the middle of the 5 photos the model found closest, in their usual cluster
for (const u of uploads) {
  const near = u.near.map((k) => byKey.get(k)).filter(Boolean);
  if (!near.length) continue;
  const pos = near.reduce((a, p) => a.add(p.pos), new THREE.Vector3()).divideScalar(near.length);
  const votes = near.map((p) => p.cluster);
  const cluster = votes.sort((a, b) => votes.filter((v) => v === b).length - votes.filter((v) => v === a).length)[0];
  pts.push({ it: { key: `upload-${u.id}`, source: "upload", id: u.id, material: u.material, thumb: u.image_url,
    name: `Team upload (${pretty(u.material)})`, created: u.created_at, unusual: u.is_unusual },
  pos, cluster, material: u.material, kind: "upload" });
}

const photos = pts.filter((p) => p.kind === "photo");
const agree = photos.filter((p) => clusterById.get(p.cluster)?.material === p.material).length;
stats.textContent = `${cat.items.length.toLocaleString()} images · 13 clusters found without labels · ` +
  `${Math.round((100 * agree) / photos.length)}% of photos sit in their own material's cluster` +
  (uploads.length ? ` · ${uploads.length} team upload${uploads.length === 1 ? "" : "s"}` : "");

// ---- three.js scene --------------------------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
stage.append(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
camera.position.set(10, 5.5, 11.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 3;
controls.maxDistance = 60;
controls.enablePan = true;

const n = pts.length;
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pts.flatMap((p) => p.pos.toArray())), 3));
const colAttr = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
const alphaAttr = new THREE.BufferAttribute(new Float32Array(n).fill(1), 1);
const sizeAttr = new THREE.BufferAttribute(new Float32Array(pts.map((p) => (p.kind === "upload" ? 34 : p.kind === "swatch" ? 12 : 11))), 1);
const shapeAttr = new THREE.BufferAttribute(new Float32Array(pts.map((p) => ({ photo: 0, swatch: 1, upload: 2 }[p.kind]))), 1);
geo.setAttribute("color", colAttr);
geo.setAttribute("alpha", alphaAttr);
geo.setAttribute("size", sizeAttr);
geo.setAttribute("shape", shapeAttr);

const material = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false,
  uniforms: { scale: { value: renderer.getPixelRatio() } },
  vertexShader: `
    attribute vec3 color; attribute float alpha; attribute float size; attribute float shape;
    uniform float scale; varying vec3 vColor; varying float vAlpha; varying float vShape;
    void main() {
      vColor = color; vAlpha = alpha; vShape = shape;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = size * scale * (10.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    varying vec3 vColor; varying float vAlpha; varying float vShape;
    void main() {
      if (vAlpha < 0.01) discard;
      vec2 p = gl_PointCoord - 0.5;
      float a;
      if (vShape < 0.5) {                       // photo: soft round dot
        float r = length(p); if (r > 0.5) discard; a = smoothstep(0.5, 0.36, r);
      } else if (vShape < 1.5) {                // swatch: small square with a dark edge
        float m = max(abs(p.x), abs(p.y)); if (m > 0.42) discard;
        a = 1.0; if (m > 0.34) { gl_FragColor = vec4(vColor * 0.35, vAlpha); return; }
      } else {                                  // upload: white ring around a coloured centre
        float r = length(p); if (r > 0.5) discard;
        if (r > 0.36) { gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * smoothstep(0.5, 0.44, r)); return; }
        if (r > 0.26) discard;
        a = 1.0;
      }
      gl_FragColor = vec4(vColor, vAlpha * a);
    }`,
});
const cloudPoints = new THREE.Points(geo, material);
scene.add(cloudPoints);

// ---- colour modes, legend and filters ----------------------------------------------------------------
const MODES = { cluster: "Clusters", material: "True material", disagree: "Disagreements" };
let mode = params.get("colour") in MODES ? params.get("colour") : "cluster";
const show = { photo: true, swatch: true, upload: true };
let isolate = null;          // a cluster id or material key picked in the legend
let hoverKey = null;         // the legend row under the mouse
let focusKey = null;         // an upload opened from ?focus=

const groupOf = (p) => (mode === "material" ? p.material : p.cluster);
const colourOf = (p) => {
  if (mode === "material") return materialColour(p.material);
  if (mode === "disagree") return materialColour(p.material);
  return materialColour(clusterById.get(p.cluster)?.material);
};
const disagrees = (p) => p.kind !== "swatch" && clusterById.get(p.cluster)?.material !== p.material;

function paint() {
  const c = new THREE.Color();
  pts.forEach((p, i) => {
    c.set(colourOf(p));
    colAttr.setXYZ(i, c.r, c.g, c.b);
    let a = show[p.kind] ? 1 : 0;
    const pick = hoverKey ?? isolate;
    if (a && pick != null && groupOf(p) !== pick) a = 0.07;
    if (a && mode === "disagree" && !disagrees(p)) a = 0.06;
    if (a && focusKey && p.it.key !== focusKey && pick == null) a = Math.min(a, 0.45);
    alphaAttr.setX(i, a);
  });
  colAttr.needsUpdate = true;
  alphaAttr.needsUpdate = true;
}

function legendRows() {
  if (mode === "material") {
    const mats = [...new Set(pts.filter((p) => p.kind !== "upload").map((p) => p.material))]
      .sort((a, b) => cat.groups.findIndex((g) => g.key === a) - cat.groups.findIndex((g) => g.key === b));
    return mats.map((m) => {
      const own = pts.filter((p) => p.material === m && p.kind !== "upload");
      const ph = own.filter((p) => p.kind === "photo").length;
      return { key: m, colour: materialColour(m), name: cat.groupLabel[m] || pretty(m),
        note: [ph && `${ph} photos`, own.length - ph && `${own.length - ph} swatches`].filter(Boolean).join(" · ") };
    });
  }
  return clusters.map((cl) => ({ key: cl.id, colour: materialColour(cl.material), name: `Cluster ${cl.n}`,
    note: mode === "disagree"
      ? `${pts.filter((p) => p.cluster === cl.id && p.kind === "photo" && disagrees(p)).length} photos from other materials`
      : `${Math.round(cl.purity * 100)}% ${pretty(cl.top)} · ${cl.photos} photos, ${cl.swatches} swatches` }));
}

function renderLegend() {
  modeBtns.replaceChildren(...Object.entries(MODES).map(([k, v]) =>
    h("button", { class: k === mode ? "on" : null, "aria-pressed": String(k === mode),
      onclick: () => { mode = k; isolate = null; renderLegend(); paint(); } }, v)));
  const rows = legendRows();
  legend.replaceChildren(
    mode === "disagree" ? h("p", { class: "cloud-note", style: "margin:0 0 6px" },
      "Bright dots are photos that landed in another material's cluster. Their colour is their true material.") : "",
    ...rows.map((r) => h("button", { class: `legend-row${isolate === r.key ? " on" : ""}`,
      onmouseenter: () => { hoverKey = r.key; paint(); }, onmouseleave: () => { hoverKey = null; paint(); },
      onclick: () => { isolate = isolate === r.key ? null : r.key; renderLegend(); paint(); } },
      h("i", { style: `background:${r.colour}` }), h("b", {}, r.name), h("span", {}, r.note))),
    isolate != null ? h("button", { class: "linkish", onclick: () => { isolate = null; renderLegend(); paint(); } }, "Show all") : "");
}

const counts = { photo: photos.length, swatch: pts.filter((p) => p.kind === "swatch").length, upload: uploads.length };
showBox.replaceChildren(...[["photo", "Photos", "●"], ["swatch", "Swatches", "■"], ["upload", "Team uploads", "◎"]].map(([k, t, sym]) =>
  h("label", {}, h("input", { type: "checkbox", checked: true, onchange: (e) => { show[k] = e.target.checked; paint(); } }),
    h("span", { class: "sym" }, sym), `${t} (${counts[k].toLocaleString()})`)));
renderLegend();
paint();

// ---- hover and click: pick the dot nearest the pointer on screen --------------------------------------
const v = new THREE.Vector3();
function pickAt(x, y) {
  const rect = renderer.domElement.getBoundingClientRect();
  let best = null, bestD = 14 * 14;
  pts.forEach((p, i) => {
    if (alphaAttr.getX(i) < 0.3) return;
    v.copy(p.pos).project(camera);
    if (v.z > 1) return;
    const dx = ((v.x + 1) / 2) * rect.width - (x - rect.left), dy = ((1 - v.y) / 2) * rect.height - (y - rect.top);
    const d = dx * dx + dy * dy - (p.kind === "upload" ? 60 : 0);
    if (d < bestD) { bestD = d; best = p; }
  });
  return best;
}

function showTip(p, x, y) {
  const cl = clusterById.get(p.cluster);
  const rect = stage.getBoundingClientRect();
  tip.replaceChildren(
    h("img", { src: p.it.thumb, alt: "" }),
    h("div", {},
      h("b", {}, p.kind === "upload" ? p.it.name : label(p.it)),
      h("span", {}, `${p.kind === "upload" ? "Model's answer" : "Material"}: ${pretty(p.material)}`),
      h("span", {}, h("i", { style: `background:${materialColour(cl?.material)}` }), `Cluster ${cl?.n ?? "?"}`,
        p.kind !== "swatch" && cl && cl.material !== p.material ? " (another material's cluster)" : ""),
      h("small", {}, p.kind === "upload" ? "Placed among its 5 closest photos · click to open" : "Click to open")));
  tip.hidden = false;
  const left = Math.min(x - rect.left + 16, rect.width - 290);
  tip.style.transform = `translate(${Math.max(8, left)}px, ${Math.max(8, y - rect.top - 20)}px)`;
}

let raf = 0, down = null;
renderer.domElement.addEventListener("pointermove", (e) => {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const p = pickAt(e.clientX, e.clientY);
    renderer.domElement.style.cursor = p ? "pointer" : "grab";
    p ? showTip(p, e.clientX, e.clientY) : (tip.hidden = true);
  });
});
renderer.domElement.addEventListener("pointerleave", () => { tip.hidden = true; });
renderer.domElement.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener("pointerup", (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
  const p = pickAt(e.clientX, e.clientY);
  if (!p) return;
  if (p.kind === "upload") location.href = `/upload?search=${p.it.id}`;
  else openPin(p.it);
});

// ---- size, focus on an upload (?focus=<search id>), render loop ----------------------------------------
function resize() {
  const { width, height } = stage.getBoundingClientRect();
  renderer.setSize(width, height, false);
  material.uniforms.scale.value = renderer.getPixelRatio() * Math.min(1, Math.max(0.45, width / 1100));   // smaller dots on small screens
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
resize();

let fly = null;
const focus = params.get("focus") && pts.find((p) => p.it.key === `upload-${params.get("focus")}`);
if (focus) {
  focusKey = focus.it.key;
  const dir = camera.position.clone().sub(controls.target).normalize();
  fly = { t: 0, fromT: controls.target.clone(), toT: focus.pos.clone(),
    fromC: camera.position.clone(), toC: focus.pos.clone().add(dir.multiplyScalar(9)) };
  paint();
}

const clock = new THREE.Clock();
function frame() {
  const dt = clock.getDelta();
  if (fly && fly.t < 1) {
    fly.t = Math.min(1, fly.t + dt / 1.6);
    const e = 1 - Math.pow(1 - fly.t, 3);
    controls.target.lerpVectors(fly.fromT, fly.toT, e);
    camera.position.lerpVectors(fly.fromC, fly.toC, e);
    if (fly.t === 1) {
      v.copy(focus.pos).project(camera);
      const r = stage.getBoundingClientRect();
      showTip(focus, r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height);
    }
  }
  if (focus) {                                   // the focused upload pulses
    sizeAttr.setX(pts.indexOf(focus), 34 + 10 * Math.sin(performance.now() / 260));
    sizeAttr.needsUpdate = true;
  }
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
loading.remove();
frame();
openFromHash();
