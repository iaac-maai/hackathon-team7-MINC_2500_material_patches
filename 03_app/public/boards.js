// Mood boards: all boards as tiles, or one board's items (boards?id=...)
import { h, api, sidebar, Masonry, itemCard, loadCatalog, getBoards, toast, openFromHash, ICONS } from "/app.js";

sidebar("boards");
const main = document.getElementById("main");
const id = new URLSearchParams(location.search).get("id");

async function newBoard() {
  const name = prompt("Name the new board", "Facade ideas");
  if (!name?.trim()) return;
  try {
    const b = await api("/api/boards", { method: "POST", body: JSON.stringify({ name }) });
    location.href = `/boards?id=${b.id}`;
  } catch (err) { toast(err.message); }
}

async function listBoards() {
  const boards = await getBoards(true);
  const grid = h("div");
  main.replaceChildren(
    h("header", { class: "page-head" }, h("div", {},
      h("div", { class: "eyebrow" }, "Mood boards"),
      h("h1", {}, "Your boards"),
      h("p", {}, "Collect swatches, photos and your own uploads by project or idea. Save from any card with the bookmark button.")),
      h("button", { class: "btn primary", onclick: newBoard }, h("span", { html: ICONS.plus, style: "display:contents" }), "New board")),
    boards.length ? grid : h("div", { class: "empty" }, "No boards yet.", h("br"),
      h("a", { class: "btn primary", href: "/browse" }, "Browse materials to save")));
  const m = new Masonry(grid, { minWidth: 240 });
  m.add(boards.map((b) => {
    const covers = [...b.covers, ...Array(3).fill(null)].slice(0, 3);
    const card = h("a", { class: "card board-tile", href: `/boards?id=${b.id}` },
      h("div", { class: "cover" }, ...covers.map((src) => src ? h("img", { src, alt: "", loading: "lazy" }) : h("div"))),
      h("div", { class: "caption" }, h("b", {}, b.name), h("span", {}, `${b.count} saved`)));
    card._ratio = 1;
    return card;
  }));
}

async function showBoard() {
  let board;
  try { board = await api(`/api/boards/${encodeURIComponent(id)}`); } catch (err) {
    main.replaceChildren(h("div", { class: "notice err" }, err.message)); return;
  }
  const c = await loadCatalog();
  const title = h("h1", {}, board.name);
  const grid = h("div");
  const countEl = h("p", {}, `${board.items.length} saved`);
  main.replaceChildren(
    h("header", { class: "page-head" }, h("div", {},
      h("div", { class: "eyebrow" }, h("a", { href: "/boards", style: "text-decoration:none" }, "← All boards")),
      title, countEl),
      h("div", { style: "display:flex;gap:8px" },
        h("button", { class: "btn", onclick: async () => {
          const name = prompt("Rename the board", board.name);
          if (!name?.trim()) return;
          try { await api(`/api/boards/${board.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
            title.textContent = name.trim(); board.name = name.trim(); getBoards(true); sidebar("boards"); } catch (err) { toast(err.message); }
        } }, "Rename"),
        h("button", { class: "btn", onclick: async () => {
          if (!confirm(`Delete the board “${board.name}”? The materials stay in the gallery.`)) return;
          await api(`/api/boards/${board.id}`, { method: "DELETE" });
          location.href = "/boards";
        } }, h("span", { html: ICONS.trash, style: "display:contents" }), "Delete board"))),
    board.items.length ? grid : h("div", { class: "empty" }, "Nothing saved here yet.", h("br"),
      h("a", { class: "btn primary", href: "/browse" }, "Browse materials")));

  const remove = async (it, card) => {
    await api(`/api/boards/${board.id}/items?source=${it.source}&item_id=${encodeURIComponent(it.id)}`, { method: "DELETE" });
    card.remove();
    countEl.textContent = `${main.querySelectorAll(".card").length} saved`;
    getBoards(true);
    toast("Removed from the board");
  };
  const m = new Masonry(grid, { minWidth: 210 });
  m.add(board.items.map((row) => {
    const known = c.byKey.get(`${row.source}-${row.item_id}`);
    const it = known || { key: `${row.source}-${row.item_id}`, source: row.source, id: row.item_id,
      material: row.material, thumb: row.thumb_url, big: row.thumb_url, name: row.label };
    return itemCard(it, { ratio: row.source === "upload" ? 1.2 : undefined, onRemove: remove });
  }));
}

(id ? showBoard() : listBoards()).catch((err) => main.replaceChildren(h("div", { class: "notice err" }, err.message)));
openFromHash();
