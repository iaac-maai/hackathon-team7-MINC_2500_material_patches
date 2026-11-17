// Browse: every photo and swatch on one endless canvas. Drag, scroll or use the arrow keys to move in any
// direction; the columns repeat forever. Filters (material, source, colour, search) rebuild the canvas.
import { h, loadCatalog, sidebar, itemCard, openFromHash, pretty, ratioFor } from "/app.js";

sidebar("browse");
document.body.classList.add("canvas-body");
const main = document.getElementById("main");
main.classList.add("canvas-page");
const c = await loadCatalog();
const params = new URLSearchParams(location.search);
const state = { g: params.get("g") || "", src: params.get("src") || "", c: params.get("c") || "", q: params.get("q") || "" };

const COLOURS = { black: "#1c1c1c", grey: "#8a8a8a", white: "#ecebe6", red: "#b5392e", brown: "#7a4a2a", orange: "#d4803a",
  beige: "#cdb89a", yellow: "#e2c33b", green: "#5d8a4c", blue: "#3f6fb0", purple: "#7d4fa0" };

// ---- the floating filter bar ----------------------------------------------------
const search = h("input", { class: "input", type: "search", placeholder: "Search: oak, cobblestone, rusty, terrazzo…",
  value: state.q, style: "flex:1;min-width:180px", "aria-label": "Search materials" });
const seg = h("div", { class: "seg", role: "group", "aria-label": "Source" });
const groupChips = h("div", { class: "chips", role: "group", "aria-label": "Material" });
const colourDots = h("div", { class: "chips", role: "group", "aria-label": "Colour", style: "gap:6px;align-items:center" });
const count = h("span", { class: "count" });
const toggle = h("button", { class: "btn", "aria-expanded": "true", onclick: () => {
  const collapsed = toolbar.classList.toggle("collapsed");
  toggle.setAttribute("aria-expanded", String(!collapsed));
  toggle.textContent = collapsed ? "Filters" : "Hide filters";
} }, "Hide filters");
const toolbar = h("div", { class: "toolbar" },
  h("div", { class: "row" }, search, seg, count, toggle),
  h("div", { class: "more-filters", style: "display:flex;flex-direction:column;gap:10px" }, groupChips, colourDots));
if (innerWidth < 760) toggle.click();

// ---- the canvas ----------------------------------------------------------------------
const layer = h("div", { class: "canvas-layer" });
const view = h("div", { class: "canvas-view", tabindex: 0, "aria-label": "Material samples. Drag or use the arrow keys to move." }, layer);
const hint = h("div", { class: "canvas-hint" }, "Drag or scroll in any direction");
const empty = h("div", { class: "canvas-empty", hidden: true },
  h("div", { class: "empty" }, "Nothing matches these filters.", h("br"),
    h("button", { class: "btn", onclick: () => { Object.assign(state, { g: "", src: "", c: "", q: "" }); search.value = ""; update(); } }, "Clear filters")));
main.append(view, toolbar, empty, hint);
setTimeout(() => (hint.style.opacity = "0"), 4500);

function matches(it, skip = "") {
  if (skip !== "g" && state.g && it.group !== state.g) return false;
  if (skip !== "src" && state.src && it.source !== state.src) return false;
  if (skip !== "c" && state.c && it.colour !== state.c) return false;
  if (state.q) {
    const hay = [it.name, it.groupLabel, it.material, pretty(it.material), it.library, it.colour, ...(it.tags || []),
      it.source === "swatch" ? "swatch clean cc0" : "photo"].join(" ").toLowerCase();
    if (!state.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function drawFilters() {
  const srcCount = (s) => c.items.filter((it) => (!s || it.source === s) && matches(it, "src")).length;
  seg.replaceChildren(...[["", "All"], ["swatch", "Swatches"], ["photo", "Photos"]].map(([v, t]) =>
    h("button", { class: state.src === v ? "on" : null, onclick: () => { state.src = v; update(); } }, `${t} `,
      h("span", { style: "color:var(--faint)" }, srcCount(v)))));
  const inView = c.items.filter((it) => matches(it, "g"));
  groupChips.replaceChildren(
    h("button", { class: `chip ${state.g ? "" : "on"}`, onclick: () => { state.g = ""; update(); } }, "All materials"),
    ...c.groups.map((g) => {
      const n = inView.filter((it) => it.group === g.key).length;
      const off = !n && state.g !== g.key;
      return h("button", { class: `chip ${state.g === g.key ? "on" : ""}`, disabled: off ? true : null, style: off ? "opacity:.35" : null,
        onclick: () => { state.g = state.g === g.key ? "" : g.key; update(); } }, g.label, h("span", { class: "n" }, n));
    }));
  colourDots.replaceChildren(h("span", { style: "color:var(--faint);font:12px var(--mono);margin-right:4px" }, "COLOUR"),
    ...Object.entries(COLOURS).map(([name, hex]) =>
      h("button", { class: `dot ${state.c === name ? "on" : ""}`, title: name, "aria-label": `Colour ${name}`,
        "aria-pressed": state.c === name ? "true" : "false", style: `background:${hex}`,
        onclick: () => { state.c = state.c === name ? "" : name; update(); } })),
    state.c && h("button", { class: "chip", onclick: () => { state.c = ""; update(); } }, `${state.c} ✕`));
  const on = groupChips.querySelector(".chip.on");
  if (on) groupChips.scrollLeft = on.offsetLeft - groupChips.clientWidth / 2 + on.clientWidth / 2;
}

// ---- layout: a block of masonry columns that repeats in every direction -------------
// Each column is filled shortest-first; a column repeats downwards with its own height,
// and the block of columns repeats sideways, so the canvas never ends.
let L = null;
const cardWidth = () => (innerWidth < 760 ? 150 : 230);
const GAP = () => (innerWidth < 760 ? 12 : 22);

function buildLayout(list) {
  const W = cardWidth(), G = GAP();
  // about as wide as it is tall, so both directions have plenty to explore
  const K = Math.max(1, Math.min(list.length, Math.round(Math.sqrt(list.length * 1.15))));
  const cols = Array.from({ length: K }, (_, i) => ({ cards: [], h: 0, off: (i * 97) % 160 }));
  for (const it of list) {
    const col = cols.reduce((a, b) => (b.h < a.h ? b : a));
    const hgt = Math.round(W * ratioFor(it));
    col.cards.push({ it, y: col.h, h: hgt, ratio: ratioFor(it) });
    col.h += hgt + G;
  }
  return { cols, K, W, G, step: W + G };
}

const cam = { x: 0, y: 0 };
const shown = new Map(); // key -> card element

function render() {
  layer.style.transform = `translate3d(${-cam.x}px, ${-cam.y}px, 0)`;
  if (!L) return;
  const vw = view.clientWidth, vh = view.clientHeight, M = 400;
  const want = new Set();
  const c0 = Math.floor((cam.x - M) / L.step), c1 = Math.floor((cam.x + vw + M) / L.step);
  for (let ci = c0; ci <= c1; ci++) {
    const col = L.cols[((ci % L.K) + L.K) % L.K];
    if (!col.h) continue;
    const x = ci * L.step;
    const k0 = Math.floor((cam.y - M - col.off - col.h) / col.h), k1 = Math.floor((cam.y + vh + M - col.off) / col.h);
    for (let k = k0; k <= k1; k++) {
      col.cards.forEach((card, j) => {
        const y = col.off + k * col.h + card.y;
        if (y + card.h < cam.y - M || y > cam.y + vh + M) return;
        const key = `${ci}|${k}|${j}`;
        want.add(key);
        if (!shown.has(key)) {
          const el = itemCard(card.it, { ratio: card.ratio });
          el.style.left = `${x}px`;
          el.style.top = `${y}px`;
          el.style.width = `${L.W}px`;
          layer.append(el);
          shown.set(key, el);
        }
      });
    }
  }
  for (const [key, el] of shown) if (!want.has(key)) { el.remove(); shown.delete(key); }
}

let queued = false;
const requestRender = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; render(); }); } };

function update() {
  const q = new URLSearchParams(Object.entries(state).filter(([, v]) => v));
  history.replaceState(null, "", `/browse${q.size ? `?${q}` : ""}${location.hash}`);
  const list = c.items.filter((it) => matches(it));
  count.textContent = `${list.length.toLocaleString("en")} of ${c.items.length.toLocaleString("en")}`;
  empty.hidden = list.length > 0;
  drawFilters();
  for (const el of shown.values()) el.remove();
  shown.clear();
  L = list.length ? buildLayout(list) : null;
  // start just below the filter bar
  cam.x = -GAP();
  cam.y = -(toolbar.offsetHeight + 30);
  requestRender();
}

// ---- moving around: drag (with a little glide), wheel/trackpad, arrow keys ------------
let drag = null, vel = { x: 0, y: 0 }, glide = null, lastMove = 0;
view.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;
  cancelAnimationFrame(glide);
  drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, id: e.pointerId };
  vel = { x: 0, y: 0 };
});
view.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
    drag.moved = true;
    view.classList.add("dragging");
    view.setPointerCapture(e.pointerId);
  }
  if (!drag.moved) return;
  const now = performance.now(), dt = Math.max(8, now - drag.t);
  cam.x -= dx; cam.y -= dy;
  vel = { x: (-dx / dt) * 16, y: (-dy / dt) * 16 };
  drag.x = e.clientX; drag.y = e.clientY; drag.t = now; lastMove = now;
  hint.style.opacity = "0";
  requestRender();
});
function endDrag(e) {
  if (!drag || e.pointerId !== drag.id) return;
  const moved = drag.moved;
  const lastT = drag.t;
  drag = null;
  view.classList.remove("dragging");
  const speed = Math.hypot(vel.x, vel.y);
  if (speed > 40) { vel.x *= 40 / speed; vel.y *= 40 / speed; }   // a hard flick glides, but not across the world
  if (performance.now() - lastT > 120) vel = { x: 0, y: 0 };  // let go after stopping: no glide
  if (moved && Math.hypot(vel.x, vel.y) > 1) {
    const step = () => {
      cam.x += vel.x; cam.y += vel.y;
      vel.x *= 0.93; vel.y *= 0.93;
      render();
      if (Math.hypot(vel.x, vel.y) > 0.3) glide = requestAnimationFrame(step);
    };
    glide = requestAnimationFrame(step);
  }
}
view.addEventListener("pointerup", endDrag);
view.addEventListener("pointercancel", endDrag);
// a drag must not count as a click on the card under the pointer
view.addEventListener("click", (e) => { if (view.classList.contains("dragging")) e.stopPropagation(); }, true);

view.addEventListener("wheel", (e) => {
  e.preventDefault();
  cancelAnimationFrame(glide);
  const k = e.deltaMode === 1 ? 32 : 1;
  cam.x += (e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX) * k;
  cam.y += (e.shiftKey && !e.deltaX ? 0 : e.deltaY) * k;
  hint.style.opacity = "0";
  requestRender();
}, { passive: false });

addEventListener("keydown", (e) => {
  if (document.querySelector(".modal") || e.target.closest("input, textarea, button")) return;
  const d = { ArrowLeft: [-160, 0], ArrowRight: [160, 0], ArrowUp: [0, -160], ArrowDown: [0, 160] }[e.key];
  if (!d) return;
  e.preventDefault();
  cam.x += d[0]; cam.y += d[1];
  requestRender();
});
new ResizeObserver(requestRender).observe(view);

let t;
search.addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); update(); }, 180); });
update();
openFromHash();
