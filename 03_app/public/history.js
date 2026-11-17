// History: the latest photo searches (stored in D1, photos in R2)
import { h, api, sidebar, pretty } from "/app.js";

sidebar("history");
const main = document.getElementById("main");
main.append(h("header", { class: "page-head" }, h("div", {},
  h("div", { class: "eyebrow" }, "History"),
  h("h1", {}, "Recent searches"),
  h("p", {}, "The last 30 photos uploaded by the team. Open one to see its matches again."))));

try {
  const rows = await api("/api/history");
  main.append(rows.length ? h("div", { class: "list" }, ...rows.map((r) =>
    h("a", { class: "history-item", href: `/upload?search=${r.id}`, style: "text-decoration:none" },
      h("img", { src: r.image_url, alt: "", loading: "lazy" }),
      h("div", {},
        h("b", {}, r.materials.map((m) => `${pretty(m.name)} ${Math.round(m.share * 100)}%`).join(" · ")),
        h("div", { class: "meta" }, [r.file_name, new Date(r.created_at).toLocaleString()].filter(Boolean).join(" · "))),
      r.is_unusual ? h("span", { class: "tag", style: "color:var(--warn)" }, "unusual") : h("span")))) :
    h("div", { class: "empty" }, "No searches yet.", h("br"), h("a", { class: "btn primary", href: "/upload" }, "Upload a photo")));
} catch (err) {
  main.append(h("div", { class: "notice err" }, err.message));
}
