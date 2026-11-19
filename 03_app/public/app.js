// Shared by every page: sidebar, catalogue, masonry grid, cards, the pin view, mood-board picker, toasts.
// Each page has its own small script (home.js, browse.js, ...) that imports from here.

// ---- tiny helpers -----------------------------------------------------------
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // only ever used with our own icon strings
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  home: svg('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'),
  browse: svg('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  boards: svg('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  upload: svg('<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>'),
  save: svg('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'),
  similar: svg('<circle cx="10" cy="10" r="6"/><path d="M21 21l-6.5-6.5"/><path d="M10 7v6M7 10h6"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  link: svg('<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};
const icon = (name) => h("span", { html: ICONS[name], style: "display:contents" });

export function toast(text) {
  document.querySelector(".toast")?.remove();
  const t = h("div", { class: "toast", role: "status" }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

// fetch JSON from our own API; a missing login sends you to the login page
export async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body && !(options.body instanceof FormData) ? { "Content-Type": "application/json" } : undefined,
  });
  if (res.status === 401) {
    location.href = "/login";
    throw new Error("Not logged in");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// ---- the catalogue (every photo and swatch) ---------------------------------
let catalogPromise;
export function loadCatalog() {
  catalogPromise ??= fetch("/data/catalog.json").then((r) => {
    if (r.status === 401 || r.redirected) location.href = "/login";
    return r.json();
  }).then((c) => {
    c.groupLabel = Object.fromEntries(c.groups.map((g) => [g.key, g.label]));
    c.items = c.items.map((raw) => fromCatalog(raw, c));
    c.byKey = new Map(c.items.map((it) => [it.key, it]));
    return c;
  });
  return catalogPromise;
}

// One shape for every item, whether it comes from the catalogue, the model server or a board
function fromCatalog(r, c) {
  const source = r.s === "w" ? "swatch" : "photo";
  return {
    key: `${source}-${r.i}`, source, id: r.i, group: r.g, groupLabel: c.groupLabel[r.g],
    material: r.x || r.g, colour: r.c, thumb: c.base + r.t, big: r.sp ? c.base + r.sp : c.base + r.t,
    name: r.n || null, library: r.l || null, link: r.k || null, tags: r.tg || [],
  };
}

export async function fromServer(m) {
  const c = await loadCatalog();
  const known = c.byKey.get(`${m.source}-${m.id}`);
  return { ...(known || { key: `${m.source}-${m.id}`, source: m.source, id: m.id, material: m.material,
    group: m.material, groupLabel: m.material, thumb: m.thumb_url, big: m.sphere_url || m.thumb_url,
    name: m.name, library: m.library, link: m.link, tags: [] }), distance: m.distance, rank: m.rank };
}

export const label = (it) => it.name || `${it.groupLabel || it.material} photo`;
export const pretty = (s) => ({ polishedstone: "polished stone" }[s] || s);

// ---- sidebar -------------------------------------------------------------------
export function sidebar(active) {
  const aside = document.getElementById("sidebar");
  const link = (href, name, text) =>
    h("a", { href, class: active === name ? "active" : null, "aria-current": active === name ? "page" : null },
      icon(name), h("span", {}, text));
  const boardsBox = h("div", { class: "side-boards" });
  const me = h("span", { class: "me" });
  aside.replaceChildren(
    h("a", { class: "brand", href: "/" }, h("b", {}, "Material Finder"), h("span", {}, "Team 7 · IAAC")),
    h("a", { class: "upload-cta", href: "/upload" }, icon("upload"), h("span", {}, "Upload a photo")),
    h("nav", { class: "nav" },
      link("/", "home", "Home"), link("/browse", "browse", "Browse all"),
      link("/boards", "boards", "Mood boards"), link("/history", "history", "History")),
    boardsBox,
    h("div", { class: "side-foot" },
      h("span", {}, "Swatches: CC0, ambientCG & Poly Haven (via MatSynth). Photos: MINC-2500."),
      me,
      h("form", { method: "post", action: "/api/logout" }, h("button", { class: "linkish" }, "Log out"))),
  );
  refreshSideBoards(boardsBox);
  api("/api/me").then((r) => { if (r.name) me.textContent = `Logged in as ${r.name}`; }).catch(() => {});
}

async function refreshSideBoards(box = document.querySelector(".side-boards")) {
  if (!box) return;
  const boards = await getBoards().catch(() => []);
  box.replaceChildren(...(boards.length ? [h("h4", {}, "Your boards"),
    ...boards.slice(0, 12).map((b) => h("a", { href: `/boards?id=${b.id}` }, `${b.name} · ${b.count}`))] : []));
}

// ---- mood boards ---------------------------------------------------------------
let boardsCache;
export function getBoards(fresh = false) {
  if (fresh || !boardsCache) boardsCache = api("/api/boards");
  return boardsCache;
}

export async function saveTo(board, it) {
  await api(`/api/boards/${board.id}/items`, {
    method: "POST",
    body: JSON.stringify({ source: it.source, item_id: String(it.id), material: it.material,
      thumb_url: it.thumb, label: label(it) }),
  });
  getBoards(true);
  refreshSideBoards();
  document.querySelectorAll(`[data-key="${CSS.escape(it.key)}"]`).forEach((el) => el.classList.add("saved"));
  toast(`Saved to “${board.name}”`);
}

export async function boardPicker(anchor, it) {
  document.querySelector(".picker")?.remove();
  const box = h("div", { class: "picker", role: "dialog", "aria-label": "Save to a mood board" },
    h("h5", {}, "Save to board"), h("div", { class: "empty", style: "padding:8px" }, "Loading…"));
  document.body.append(box);
  const r = anchor.getBoundingClientRect();
  box.style.top = `${Math.min(window.scrollY + r.bottom + 6, window.scrollY + innerHeight - 330)}px`;
  box.style.left = `${Math.max(8, Math.min(window.scrollX + r.right - 260, innerWidth - 270))}px`;
  if (anchor.closest(".modal")) box.style.position = "fixed", box.style.top = `${Math.min(r.bottom + 6, innerHeight - 330)}px`,
    box.style.left = `${Math.max(8, Math.min(r.right - 260, innerWidth - 270))}px`;

  const close = (e) => { if (!box.contains(e.target) && e.target !== anchor) { box.remove(); document.removeEventListener("pointerdown", close); } };
  setTimeout(() => document.addEventListener("pointerdown", close), 0);

  const input = h("input", { class: "input", placeholder: "New board name", maxlength: 60, "aria-label": "New board name" });
  const form = h("form", { onsubmit: async (e) => {
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return input.focus();
    try {
      const board = await api("/api/boards", { method: "POST", body: JSON.stringify({ name }) });
      await saveTo(board, it);
      box.remove();
    } catch (err) { toast(err.message); }
  } }, input, h("button", { class: "btn primary", type: "submit" }, "Create"));

  try {
    const boards = await getBoards();
    box.replaceChildren(h("h5", {}, boards.length ? "Save to board" : "Make your first board"),
      ...boards.map((b) => h("button", { class: "board", onclick: async () => {
        try { await saveTo(b, it); } catch (err) { toast(err.message); }
        box.remove();
      } }, h("span", {}, b.name), h("span", { style: "color:var(--faint)" }, b.count))),
      form);
    input.focus({ preventScroll: true });
  } catch (err) {
    box.replaceChildren(h("div", { class: "error" }, err.message));
  }
}

// ---- masonry grid (Pinterest-style: each card goes in the shortest column) -----
export class Masonry {
  constructor(container, { minWidth = 220, gap = 14 } = {}) {
    this.el = container;
    this.minWidth = minWidth;
    this.gap = gap;
    this.cards = [];
    this.el.classList.add("masonry");
    this.layout();
    let t;
    this.resize = new ResizeObserver(() => { clearTimeout(t); t = setTimeout(() => this.layout(), 120); });
    this.resize.observe(this.el);
  }

  columnsFor(width) { return Math.max(2, Math.floor((width + this.gap) / (this.minWidth + this.gap))); }

  layout() {
    const n = this.columnsFor(this.el.clientWidth || innerWidth);
    if (this.cols && this.cols.length === n) return;
    this.cols = Array.from({ length: n }, () => h("div", { class: "col" }));
    this.heights = new Array(n).fill(0);
    this.el.replaceChildren(...this.cols);
    for (const c of this.cards) this.place(c);
  }

  place(card) {
    const i = this.heights.indexOf(Math.min(...this.heights));
    this.cols[i].append(card);
    this.heights[i] += (card._ratio || 1) + 0.18; // estimated height in column widths (+ caption)
  }

  add(cards) { for (const c of cards) { this.cards.push(c); this.place(c); } }
  clear() { this.cards = []; this.cols.forEach((c) => c.replaceChildren()); this.heights.fill(0); }
}

// ---- cards -------------------------------------------------------------------
const RATIOS = { photo: [1, 1.3, 0.8, 1.15, 1.45, 0.9], swatch: [1, 1.2, 0.85, 1.35] };
export const ratioFor = (it) => { const r = RATIOS[it.source] || [1]; return r[(it.id * 7 + 3) % r.length]; };

function lazyImg(src, alt) {
  const img = h("img", { src, alt, loading: "lazy", decoding: "async" });
  img.addEventListener("load", () => img.classList.add("ready"), { once: true });
  img.addEventListener("error", () => img.classList.add("ready"), { once: true });
  return img;
}

export function itemCard(it, { ratio = ratioFor(it), caption = false, onRemove } = {}) {
  const tag = it.source === "swatch" ? (it.library || "Swatch") : it.source === "upload" ? "Your photo" : "Photo";
  const saveBtn = h("button", { class: "icon-btn save-btn", title: "Save to a mood board", "aria-label": "Save to a mood board",
    html: ICONS.save, onclick: (e) => { e.stopPropagation(); boardPicker(e.currentTarget, it); } });
  const simBtn = it.source !== "upload" && h("button", { class: "icon-btn", title: "More like this", "aria-label": "More like this",
    html: ICONS.similar, onclick: (e) => { e.stopPropagation(); openPin(it, { jump: true }); } });
  const rmBtn = onRemove && h("button", { class: "icon-btn", title: "Remove from board", "aria-label": "Remove from board",
    html: ICONS.trash, onclick: (e) => { e.stopPropagation(); onRemove(it, card); } });

  const card = h("figure", { class: "card", tabindex: 0, "data-key": it.key, "aria-label": label(it),
    onclick: () => (it.source === "upload" ? (location.href = `/upload?search=${it.id}`) : openPin(it)),
    onkeydown: (e) => { if (e.key === "Enter") card.click(); } },
    h("div", { class: "media", style: `aspect-ratio: 1 / ${ratio}` }, lazyImg(it.thumb, label(it)),
      h("div", { class: "shade" },
        h("div", { class: "top" }, h("span", { class: `tag ${it.source}` }, tag),
          h("div", { class: "actions" }, rmBtn, simBtn, it.source !== "upload" && saveBtn)),
        h("div", { class: "label" }, h("b", {}, label(it)),
          h("span", {}, [pretty(it.material), it.colour, it.distance != null && `distance ${it.distance.toFixed(2)}`]
            .filter(Boolean).join(" · "))))),
    caption && h("figcaption", { class: "caption" }, h("b", {}, label(it)), h("span", {}, pretty(it.material))));
  card._ratio = ratio;
  return card;
}

// ---- pin view (the big modal with details and "more like this") ---------------
let modal;
export async function openPin(it, { jump = false } = {}) {
  closePin(false);
  const more = h("div");
  const moreHead = h("div", { class: "more-head" }, h("h2", {}, "More like this"),
    h("span", { class: "count" }, "asking the model…"));
  const saveBtn = h("button", { class: "btn primary", onclick: (e) => boardPicker(e.currentTarget, it) }, icon("save"), "Save");

  const facts = [
    ["Material", pretty(it.material)],
    ["Group", it.groupLabel],
    ["Colour", it.colour],
    ["Source", it.source === "swatch" ? `${it.library} (CC0 licence, free to use)` : "MINC-2500 photo patch (research dataset)"],
    it.tags?.length && ["Tags", it.tags.join(", ")],
  ].filter((f) => f && f[1]);

  modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": label(it),
    onclick: (e) => { if (e.target === modal) closePin(); } },
    h("button", { class: "icon-btn close", "aria-label": "Close", html: ICONS.close, onclick: () => closePin() }),
    h("div", { class: "modal-inner" },
      h("article", { class: "pin" },
        h("div", { class: "hero" }, h("img", { src: it.big, alt: label(it) })),
        h("div", { class: "info" },
          h("div", { class: "eyebrow" }, it.source === "swatch" ? "Clean swatch" : "Photo sample"),
          h("h3", {}, label(it)),
          h("dl", {}, ...facts.flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, v)])),
          h("div", { class: "row" }, saveBtn,
            h("a", { class: "btn", href: `/browse?g=${encodeURIComponent(it.group)}` }, icon("browse"), `All ${it.groupLabel}`),
            it.link && h("a", { class: "btn", href: it.link, target: "_blank", rel: "noopener" }, icon("link"), `Open at ${it.library}`)),
          it.source === "swatch" && h("p", { style: "color:var(--muted);margin:0;font-size:13px" },
            "Rendered on a sphere by the library. The model searched with this same image."))),
      moreHead, more));
  document.body.append(modal);
  document.body.style.overflow = "hidden";
  history.replaceState(null, "", `#${it.key}`);
  addEventListener("keydown", escClose);
  if (jump) moreHead.scrollIntoView({ behavior: "smooth" });

  try {
    const res = await api(`/api/similar?source=${it.source}&id=${it.id}&k=12`);
    const [swatches, photos] = await Promise.all([Promise.all(res.swatches.map(fromServer)), Promise.all(res.photos.map(fromServer))]);
    moreHead.querySelector(".count").textContent = "nearest by the model · swatches first";
    const grid = h("div");
    more.replaceChildren(grid);
    const m = new Masonry(grid, { minWidth: 190 });
    m.add([...swatches, ...photos].map((x) => itemCard(x)));
  } catch (err) {
    moreHead.querySelector(".count").textContent = "";
    more.replaceChildren(h("div", { class: "notice warn" }, err.message));
  }
}

function escClose(e) { if (e.key === "Escape" && !document.querySelector(".picker")) closePin(); }

export function closePin(clearHash = true) {
  if (!modal) return;
  modal.remove();
  modal = null;
  document.querySelector(".picker")?.remove();
  document.body.style.overflow = "";
  removeEventListener("keydown", escClose);
  if (clearHash) history.replaceState(null, "", location.pathname + location.search);
}

// Open the item named in the address (#swatch-12), so a pin can be shared or reloaded
export async function openFromHash() {
  const key = decodeURIComponent(location.hash.slice(1));
  if (!/^(photo|swatch)-\d+$/.test(key)) return;
  const it = (await loadCatalog()).byKey.get(key);
  if (it) openPin(it);
}

// Infinite scroll: call `more()` whenever the sentinel comes into view
export function onReachEnd(sentinel, more) {
  const io = new IntersectionObserver((entries) => entries[0].isIntersecting && more(), { rootMargin: "1200px" });
  io.observe(sentinel);
  return io;
}
