// Admin activity dashboard: who logs in to Material Finder and what they do. Data: GET /api/admin/summary
const root = document.getElementById("admin");

// tiny element helper (text always goes in as text, never as HTML: names are typed by users)
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // only our own icon strings
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}
const svgIcon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const IC = {
  login: svgIcon('<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/>'),
  logout: svgIcon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>'),
  lock: svgIcon('<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>'),
  view: svgIcon('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  upload: svgIcon('<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 20h16"/>'),
  similar: svgIcon('<circle cx="10" cy="10" r="6"/><path d="M21 21l-6.5-6.5"/>'),
  save: svgIcon('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'),
  board: svgIcon('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>'),
  trash: svgIcon('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
};
const PAGE_NAMES = { home: "Home", browse: "Browse", upload: "Upload", boards: "Mood boards", history: "History" };
const pretty = (s) => ({ polishedstone: "polished stone" }[s] || s || "?");
const fmtNum = (n) => Number(n || 0).toLocaleString("en-GB");

// ---- state, remembered per browser (a convenience only) -----------------------
let state = { hours: 168, user: "" };
try { state = { ...state, ...JSON.parse(localStorage.getItem("mf-admin") || "{}") }; } catch {}
const remember = () => { try { localStorage.setItem("mf-admin", JSON.stringify(state)); } catch {} };
let data = null, feedLimit = 60;

// ---- time words ------------------------------------------------------------------
function ago(iso) {
  const s = Math.round((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
const clock = (iso) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayLabel = (iso) => {
  const d = new Date(iso), t = new Date();
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
};

// ---- what one event means, in words ------------------------------------------------
function describe(e) {
  const d = e.detail || {};
  const board = (id) => (data.boards[id] ? `"${data.boards[id]}"` : "a board (since deleted)");
  const who = h("b", {}, e.user_name);
  if (e.type === "login") return { icon: "login", text: [who, " logged in"] };
  if (e.type === "login_failed") return { icon: "lock", tone: "warn", text: [who, " typed a wrong password"] };
  if (e.type === "logout") return { icon: "logout", text: [who, " logged out"] };
  if (e.type.startsWith("view:")) {
    const page = PAGE_NAMES[e.type.slice(5)] || e.type.slice(5);
    const extra = d.board_id ? ` (board ${board(d.board_id)})` : d.filter ? ` (${pretty(d.filter)})` : d.search_id ? " (an earlier search)" : "";
    return { icon: "view", text: [who, ` opened ${page}${extra}`] };
  }
  if (e.type === "upload") {
    return { icon: "upload", tone: "accent", img: d.search_id ? `/api/images/${d.search_id}` : null,
      text: [who, " uploaded a photo → ", h("b", {}, pretty(d.material)), ` ${Math.round((d.confidence || 0) * 100)}%`,
        d.unusual ? " · flagged unusual" : ""] };
  }
  if (e.type === "upload_failed") return { icon: "upload", tone: "warn", text: [who, ` tried to upload: ${d.error || "failed"}`] };
  if (e.type === "similar") return { icon: "similar", text: [who, ` opened "More like this" for ${d.source} #${d.item_id}`] };
  if (e.type === "save") {
    return { icon: "save", tone: "accent", img: d.thumb_url || null,
      text: [who, " saved ", h("b", {}, d.label || `${pretty(d.material)} ${d.source}`), ` to ${board(d.board_id)}`] };
  }
  if (e.type === "unsave") return { icon: "trash", text: [who, ` removed ${d.source} #${d.item_id} from ${board(d.board_id)}`] };
  if (e.type === "board_create") return { icon: "board", text: [who, ` created the board "${d.name || "?"}"`] };
  if (e.type === "board_rename") return { icon: "board", text: [who, ` renamed a board to "${d.name || "?"}"`] };
  if (e.type === "board_delete") return { icon: "trash", text: [who, " deleted a board"] };
  return { icon: "view", text: [who, ` ${e.type}`] };
}

// ---- loading -------------------------------------------------------------------------
async function load() {
  const q = new URLSearchParams({ hours: state.hours });
  if (state.user) q.set("user", state.user);
  const res = await fetch(`/api/admin/summary?${q}`);
  if (res.status === 401) { location.href = "/admin-login"; return; }
  if (!res.ok) throw new Error(`Could not load the activity (${res.status})`);
  data = await res.json();
  render();
}

// ---- drawing ---------------------------------------------------------------------------
function render() {
  const t = data.totals;
  const rangeName = { 24: "last 24 hours", 168: "last 7 days", 720: "last 30 days" }[state.hours] || `last ${state.hours} h`;
  const tiles = [
    ["People", fmtNum(t.people), state.user ? "filtered to one person" : rangeName],
    ["Active now", [h("span", { class: "live-dot", "aria-hidden": "true" }), fmtNum(data.active_now)], "in the last 15 min"],
    ["Logins", fmtNum(t.logins), rangeName],
    ["Pages opened", fmtNum(t.views), rangeName],
    ["Photos uploaded", fmtNum(t.uploads), rangeName],
    ["Items saved", fmtNum(t.saves), `+ ${fmtNum(t.similar)} "more like this"`],
    ["Wrong passwords", fmtNum(t.failed_logins), "failed logins", t.failed_logins > 0],
  ];

  const userSelect = h("select", { "aria-label": "Show one person", onchange: (e) => { state.user = e.target.value; remember(); load(); } },
    h("option", { value: "" }, "Everyone"),
    ...data.people.map((p) => h("option", { value: p.name, selected: p.name === state.user }, p.name)));
  if (state.user && !data.people.some((p) => p.name === state.user)) userSelect.append(h("option", { value: state.user, selected: true }, state.user));
  const seg = h("div", { class: "seg-ctl", role: "group", "aria-label": "Time range" },
    ...[[24, "24 h"], [168, "7 days"], [720, "30 days"]].map(([v, l]) =>
      h("button", { "aria-pressed": String(state.hours === v), onclick: () => { state.hours = v; remember(); load(); } }, l)));

  root.replaceChildren(
    h("header", { class: "admin-head" },
      h("div", {},
        h("div", { class: "eyebrow" }, "Material Finder · admin"),
        h("h1", {}, "Who is using the app"),
        h("p", {}, "Logins, pages, uploads and saves, from the activity log in D1. Times in your local time zone.")),
      h("div", { class: "controls" }, seg, userSelect,
        h("span", { class: "updated", title: data.generated_at }, `updated ${clock(data.generated_at)}`),
        h("a", { class: "btn", href: "/" }, "Open the app"),
        h("form", { method: "post", action: "/api/admin/logout" }, h("button", { class: "btn" }, "Log out")))),
    h("section", { class: "tiles", "aria-label": "Totals" },
      ...tiles.map(([k, v, s, warn]) => h("div", { class: `tile${warn ? " warn" : ""}` },
        h("div", { class: "k" }, k), h("div", { class: "v" }, v), h("div", { class: "s" }, s)))),
    h("section", { class: "two" },
      h("div", { class: "panel" }, h("h2", {}, "Actions per day"),
        h("p", { class: "sub" }, "Uploads, saves, \"more like this\" and board changes (page views not counted). Hover a bar for details."),
        chart(data.daily)),
      h("div", { class: "panel" }, h("h2", {}, "What people upload"),
        h("p", { class: "sub" }, `The model's top material for each uploaded photo, ${rangeName}.`),
        materials(data.materials))),
    h("section", { class: "panel" }, h("h2", {}, "People"),
      h("p", { class: "sub" }, `Everyone seen in the ${rangeName}. Click a row to see only that person.`),
      peopleTable(data.people)),
    h("section", { class: "panel" }, h("h2", {}, state.user ? `What ${state.user} did` : "Live activity"),
      h("p", { class: "sub" }, "Newest first. Refreshes every 30 seconds."),
      feed(data.recent)),
  );
}

function chart(rows) {
  const wrap = h("div", { class: "chart" });
  // one bar per day for the last 14 days (or the whole range), empty days included
  const days = [];
  const n = Math.max(14, Math.ceil(state.hours / 24));
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(); d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r]));
  const vals = days.map((d) => ({ day: d, actions: byDay[d]?.actions || 0, views: byDay[d]?.views || 0, people: byDay[d]?.people || 0 }));
  const max = Math.max(4, ...vals.map((v) => v.actions));
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const W = 640, H = 220, L = 34, B = 24, T = 8, bw = (W - L) / vals.length;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Actions per day" });
  for (const g of [0, top / 2, top]) {
    svg.append(el("line", { class: "grid", x1: L, x2: W, y1: y(g), y2: y(g) }));
    const tx = el("text", { class: "axis", x: L - 6, y: y(g) + 4, "text-anchor": "end" }); tx.textContent = fmtNum(g); svg.append(tx);
  }
  const tip = h("div", { class: "tip", hidden: true });
  vals.forEach((v, i) => {
    const x = L + i * bw, w = Math.max(3, Math.min(26, bw - 4)), cx = x + bw / 2;
    const hgt = (H - T - B) * (v.actions / top);
    const hit = el("rect", { class: "hit", x, y: T, width: bw, height: H - T - B });
    // bar with a 4px rounded top, anchored to the baseline
    const r = Math.min(4, hgt, w / 2);
    const by = H - B - hgt;
    const bar = el("path", { class: "bar", d: hgt > 0
      ? `M${cx - w / 2},${H - B} V${by + r} Q${cx - w / 2},${by} ${cx - w / 2 + r},${by} H${cx + w / 2 - r} Q${cx + w / 2},${by} ${cx + w / 2},${by + r} V${H - B} Z`
      : `M${cx - w / 2},${H - B} H${cx + w / 2}` });
    const show = () => {
      bar.classList.add("on");
      tip.hidden = false;
      tip.replaceChildren(h("b", {}, new Date(`${v.day}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })),
        h("div", {}, `${fmtNum(v.actions)} actions · ${fmtNum(v.views)} page views`), h("div", {}, `${fmtNum(v.people)} people`));
      const box = svg.getBoundingClientRect();
      tip.style.left = `${(cx / W) * box.width}px`;
      tip.style.top = `${(Math.min(by, H - B - 6) / H) * box.height}px`;
    };
    const hide = () => { bar.classList.remove("on"); tip.hidden = true; };
    hit.addEventListener("mouseenter", show); hit.addEventListener("mouseleave", hide);
    hit.addEventListener("touchstart", show, { passive: true });
    svg.append(hit, bar);
    if (i % Math.ceil(vals.length / 7) === 0 || i === vals.length - 1) {
      const tx = el("text", { class: "axis", x: cx, y: H - 6, "text-anchor": "middle" });
      tx.textContent = new Date(`${v.day}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
      svg.append(tx);
    }
  });
  wrap.append(svg, tip);
  // the same numbers as a table, for screen readers
  wrap.append(h("table", { class: "visually-hidden", style: "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)" },
    h("tr", {}, h("th", {}, "Day"), h("th", {}, "Actions"), h("th", {}, "Page views"), h("th", {}, "People")),
    ...vals.map((v) => h("tr", {}, h("td", {}, v.day), h("td", {}, v.actions), h("td", {}, v.views), h("td", {}, v.people)))));
  return wrap;
}

function materials(rows) {
  if (!rows.length) return h("p", { class: "empty-note" }, "No photos uploaded in this period.");
  const max = Math.max(...rows.map((r) => r.n));
  return h("div", { class: "mats" }, ...rows.map((r) => h("div", { class: "mat-row" },
    h("span", {}, pretty(r.material)),
    h("div", { class: "track" }, h("div", { class: "fill", style: `width:${(r.n / max) * 100}%` })),
    h("span", { class: "n" }, r.n))));
}

function peopleTable(rows) {
  if (!rows.length) return h("p", { class: "empty-note" }, "Nobody has logged in during this period.");
  const num = (v, cls = "") => h("td", { class: `num ${cls}` }, fmtNum(v));
  return h("div", { class: "table-wrap" }, h("table", { class: "people" },
    h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "Last seen"), h("th", {}, "Where"), h("th", {}, "Device"),
      ...["Logins", "Pages", "Uploads", "More like", "Saves", "Wrong pw"].map((t) => h("th", { class: "num" }, t)))),
    h("tbody", {}, ...rows.map((p) => h("tr", {
      class: p.name === state.user ? "sel" : null, tabindex: 0,
      onclick: () => { state.user = state.user === p.name ? "" : p.name; remember(); load(); },
      onkeydown: (e) => { if (e.key === "Enter") e.currentTarget.click(); },
    },
    h("td", { class: "name" }, p.name),
    h("td", { title: new Date(p.last_seen).toLocaleString("en-GB") }, ago(p.last_seen)),
    h("td", { class: "muted" }, p.place || "?"), h("td", { class: "muted" }, p.device || "?"),
    num(p.logins), num(p.views), num(p.uploads), num(p.similar), num(p.saves), num(p.failed, p.failed ? "bad" : "muted"))))));
}

function feed(rows) {
  if (!rows.length) return h("p", { class: "empty-note" }, "No activity in this period yet.");
  const box = h("div", { class: "feed" });
  let lastDay = "";
  for (const e of rows.slice(0, feedLimit)) {
    const day = dayLabel(e.ts);
    if (day !== lastDay) { box.append(h("div", { class: "day-sep" }, day)); lastDay = day; }
    const d = describe(e);
    const where = [e.city, e.country].filter(Boolean).join(", ");
    box.append(h("div", { class: "ev" },
      h("time", { datetime: e.ts, title: new Date(e.ts).toLocaleString("en-GB") }, clock(e.ts)),
      h("span", { class: `ic ${d.tone || ""}`, html: IC[d.icon] }),
      h("div", { class: "txt" }, h("div", {}, ...d.text), h("div", { class: "meta" }, [where, e.device].filter(Boolean).join(" · "))),
      d.img ? h("img", { src: d.img, alt: "", loading: "lazy" }) : h("span")));
  }
  if (rows.length > feedLimit) {
    box.append(h("button", { class: "btn more", onclick: () => { feedLimit += 100; render(); } }, `Show more (${rows.length - feedLimit} older)`));
  }
  return box;
}

// ---- start ------------------------------------------------------------------------------
root.append(h("p", { class: "empty-note" }, "Loading the activity…"));
load().catch((err) => root.replaceChildren(h("div", { class: "notice err" }, err.message)));
setInterval(() => { if (!document.hidden) load().catch(() => {}); }, 30000);
