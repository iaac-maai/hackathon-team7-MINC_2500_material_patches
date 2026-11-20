// Sample ring (was Home until the point cloud): a ring of material samples that keeps turning. Scroll, drag or click to bring one to the front;
// click the front one to open it. Four views: Flat, Tilt, Ring, Gallery. Below: one card per material.
import { h, loadCatalog, sidebar, Masonry, openPin, openFromHash, ratioFor, pretty } from "/app.js";

sidebar("ring");
const main = document.getElementById("main");
const c = await loadCatalog();

// ---- which samples go on the ring: 2 per material group, mixed round-robin ----
const perGroup = c.groups.map((g) => {
  const own = c.items.filter((it) => it.group === g.key);
  const sw = own.filter((it) => it.source === "swatch");
  const ph = own.filter((it) => it.source === "photo");
  return sw.length >= 3 ? [sw[0], ph[0] || sw[1]] : [ph[0], ph[1]];
});
// a phone gets one sample per material, a wide screen two
const items = [...perGroup.map((p) => p[0]), ...(innerWidth < 760 ? [] : perGroup.map((p) => p[1]))].filter(Boolean);
const N = items.length;

// ---- the views: ring geometry for each (lerped smoothly when you switch) --------
const MODES = {
  flat: { tilt: 90, rotZ: 0, rW: 0.32, rH: 0.29, persp: 4000, g: 0, yOff: -0.07 },
  tilt: { tilt: 16, rotZ: 0, rW: 0.33, rH: 1.2, persp: 1500, g: 0, yOff: -0.05 },
  ring: { tilt: 30, rotZ: -27, rW: 0.36, rH: 0.40, persp: 1250, g: 0, yOff: -0.04 },
  gallery: { tilt: 30, rotZ: -27, rW: 0.36, rH: 0.40, persp: 1250, g: 1, yOff: -0.06 },
};
let mode = "ring";
try { mode = MODES[localStorage.getItem("ringMode")] ? localStorage.getItem("ringMode") : "ring"; } catch {}
const cur = { ...MODES[mode] };

// ---- page structure -----------------------------------------------------------
const origin = h("div", { class: "ring-origin" });
const counter = h("span", {});
const caption = h("div", { class: "ring-caption", "aria-live": "polite" });
const pills = h("div", { class: "pills", role: "group", "aria-label": "View" });
const stage = h("div", { class: "stage", "aria-label": "Rotating ring of material samples" },
  h("div", { class: "stage-bar top" },
    h("div", { class: "stage-title" }, "Selected materials",
      h("span", {}, `${c.items.length.toLocaleString("en")} samples · scroll, drag or click`)),
    pills),
  origin, caption,
  h("div", { class: "stage-bar bottom" },
    h("span", { class: "scroll-hint" }, h("i"), "Scroll to explore"), counter));
const wrap = h("section", { class: "ring-wrap" }, stage);

const gridMats = h("div");
const gridOnly = h("div");
main.append(wrap,
  h("h2", { id: "materials" }, "13 materials", h("small", {}, "each with photos and, where they exist, clean swatches")),
  gridMats,
  h("h2", {}, "Only in the swatch library", h("small", {}, "no photos in MINC-2500, CC0 swatches only")),
  gridOnly);

function drawPills() {
  pills.replaceChildren(...Object.keys(MODES).map((m) =>
    h("button", { class: `pill ${m === mode ? "on" : ""}`, "aria-pressed": m === mode ? "true" : "false",
      onclick: () => { mode = m; try { localStorage.setItem("ringMode", m); } catch {} drawPills(); } },
      m[0].toUpperCase() + m.slice(1))));
}
drawPills();

// ---- the ring items -----------------------------------------------------------------
const els = items.map((it, i) => {
  const el = h("button", { class: "ring-item", "aria-label": `${it.name || it.groupLabel} (${it.groupLabel})`, "data-i": i },
    h("img", { src: it.thumb, alt: "", draggable: "false" }));
  el._ratio = Math.min(ratioFor(it), 1.35);
  origin.append(el);
  return el;
});

// ---- motion state -------------------------------------------------------------
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const AUTO = reduced ? 0 : 0.35;          // items per second, always turning
let auto = 0, user = 0, vel = 0, scrollRot = 0;
let target = null;                         // item index being brought to the front
let pauseUntil = 0;
let rot = 0;
const wrapIdx = (d) => ((((d + N / 2) % N) + N) % N) - N / 2;   // shortest signed distance on the ring

// scroll through the tall section = one full turn
function readScroll() {
  const r = wrap.getBoundingClientRect();
  const total = wrap.offsetHeight - innerHeight;
  scrollRot = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) * N : 0;
}
addEventListener("scroll", readScroll, { passive: true });

// drag (mouse or touch, horizontal)
let drag = null;
stage.addEventListener("pointerdown", (e) => {
  if (e.target.closest(".pill")) return;
  drag = { x: e.clientX, last: e.clientX, t: performance.now(), moved: 0, id: e.pointerId };
  vel = 0; target = null;
});
addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.last;
  drag.moved += Math.abs(dx);
  if (drag.moved > 5 && !stage.classList.contains("dragging")) stage.classList.add("dragging");
  const now = performance.now();
  const step = pxPerItem();
  user -= dx / step;
  vel = (-dx / step) / Math.max(0.008, (now - drag.t) / 1000);
  drag.last = e.clientX; drag.t = now;
  pauseUntil = now + 1500;
});
const endDrag = () => { if (drag) { stage.classList.remove("dragging"); setTimeout(() => (drag = null), 0); } };
addEventListener("pointerup", endDrag);
addEventListener("pointercancel", () => { vel = 0; endDrag(); });

// click: a back item comes to the front; the front item opens
origin.addEventListener("click", (e) => {
  const el = e.target.closest(".ring-item");
  if (!el || (drag && drag.moved > 5)) return;
  const i = Number(el.dataset.i);
  if (Math.abs(wrapIdx(i - rot)) < 0.5) openPin(items[i]);
  else { target = i; vel = 0; }
});
addEventListener("keydown", (e) => {
  if (document.querySelector(".modal") || e.target.closest("input, textarea")) return;
  const r = stage.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return;
  if (e.key === "ArrowRight") { target = (Math.round(rot) + 1 + N) % N; e.preventDefault(); }
  if (e.key === "ArrowLeft") { target = (Math.round(rot) - 1 + N) % N; e.preventDefault(); }
});

let size = { w: stage.clientWidth, h: stage.clientHeight };
new ResizeObserver(() => { size = { w: stage.clientWidth, h: stage.clientHeight }; }).observe(stage);
const radius = () => Math.min(size.w * cur.rW, size.h * cur.rH);
const pxPerItem = () => Math.max(40, cur.g > 0.5 ? baseW() * 1.3 : (2 * Math.PI * radius()) / N);
// card size follows the ring: neighbours overlap a little, like a fanned deck
const baseW = () => Math.max(64, Math.min(150, ((2 * Math.PI * radius()) / N) * 1.5, Math.min(size.w, size.h * 1.5) * 0.12));

// ---- the frame loop: move, project, draw ------------------------------------------
let last = performance.now();
let frontShown = -1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const k = Math.min(1, dt * 4);
  for (const key of Object.keys(cur)) cur[key] += (MODES[mode][key] - cur[key]) * k;

  if (!drag) {
    if (Math.abs(vel) > 0.01) { user += vel * dt; vel *= Math.pow(0.04, dt); }
    if (target != null) {
      const d = wrapIdx(target - rot);
      user += d * Math.min(1, dt * 6);
      pauseUntil = now + 2500;
      if (Math.abs(d) < 0.01) target = null;
    }
    if (now > pauseUntil) auto += AUTO * dt;
  }
  rot = auto + user + scrollRot;

  const R = radius(), W = baseW();
  const tilt = (cur.tilt * Math.PI) / 180, rz = (cur.rotZ * Math.PI) / 180;
  const sinT = Math.sin(tilt), cosT = Math.cos(tilt), cosZ = Math.cos(rz), sinZ = Math.sin(rz);
  const spacing = W * 1.3;
  let front = 0, best = -Infinity;
  els.forEach((el, i) => {
    const o = wrapIdx(i - rot);
    // ring position
    const a = (o * 2 * Math.PI) / N;
    const x = R * Math.sin(a), z = R * Math.cos(a);
    const y = z * sinT, d = z * cosT;
    const s = cur.persp / (cur.persp - d);
    let X = x * s, Y = y * s;
    [X, Y] = [X * cosZ - Y * sinZ, X * sinZ + Y * cosZ];
    const depthRing = z / R;                                  // -1 back .. 1 front
    // gallery position: a straight filmstrip, the front one larger
    const gX = o * spacing, gS = 1 + 0.45 * Math.max(0, 1 - Math.abs(o));
    const g = cur.g;
    const fx = X + (gX - X) * g, fy = Y * (1 - g) + cur.yOff * size.h, fs = s + (gS - s) * g;
    const depth = depthRing * (1 - g) + (1 - Math.abs(o) / (N / 2)) * g;
    const fade = cosT * (1 - g);                              // flat view: everything fully visible
    const opacity = 1 - fade * (0.55 * (1 - (depthRing + 1) / 2));
    const w = W, hgt = W * el._ratio;
    el.style.width = `${w}px`;
    el.style.height = `${hgt}px`;
    el.style.transform = `translate3d(${fx - w / 2}px, ${fy - hgt / 2}px, 0) scale(${fs.toFixed(4)})`;
    el.style.opacity = opacity.toFixed(3);
    el.style.zIndex = String(Math.round(depth * 200) + 200);
    if (depth > best) { best = depth; front = i; }
  });
  if (front !== frontShown) {
    els[frontShown]?.classList.remove("front");
    els[front].classList.add("front");
    frontShown = front;
    const it = items[front];
    caption.replaceChildren(h("b", {}, it.name || pretty(it.material)),
      h("span", {}, `${it.groupLabel} · ${it.source === "swatch" ? `clean swatch, ${it.library}` : "photo"} · click to open`));
    counter.textContent = `${String(front + 1).padStart(2, "0")} — ${String(N).padStart(2, "0")}`;
  }
  requestAnimationFrame(frame);
}
readScroll();
requestAnimationFrame(frame);

// ---- below the ring: one card per material ----------------------------------------
function covers(key, n = 4) {
  const own = c.items.filter((it) => it.group === key);
  const sw = own.filter((it) => it.source === "swatch");
  const ph = own.filter((it) => it.source === "photo");
  return sw.length >= 20 ? [sw[0], ph[0], sw[1], ph[1]] : [...ph.slice(0, n), ...sw].slice(0, n);
}
const RATIOS = [1.25, 0.9, 1.1, 1.4, 1, 1.2, 0.85];
function materialCard(g, i) {
  const pics = covers(g.key);
  const ratio = RATIOS[i % RATIOS.length];
  const parts = [g.photos && `${g.photos} photos`, g.swatches && `${g.swatches} swatches`].filter(Boolean).join(" · ");
  const card = h("a", { class: "card mat-card", href: `/browse?g=${encodeURIComponent(g.key)}`, "aria-label": g.label },
    h("div", { class: "cover" },
      h("div", { class: "big", style: `--ratio: 1 / ${ratio}` }, h("img", { src: pics[0].thumb, alt: "", loading: "lazy", class: "ready" })),
      h("div", { class: "strip" }, ...pics.slice(1, 4).map((p) => h("img", { src: p.thumb, alt: "", loading: "lazy" })))),
    h("div", { class: "caption" }, h("b", {}, g.label), h("span", {}, parts)));
  card._ratio = ratio + 0.55;
  return card;
}
new Masonry(gridMats, { minWidth: 230 }).add(c.groups.filter((g) => g.photos).map(materialCard));
new Masonry(gridOnly, { minWidth: 230 }).add(c.groups.filter((g) => !g.photos).map((g, i) => materialCard(g, i + 3)));
openFromHash();
