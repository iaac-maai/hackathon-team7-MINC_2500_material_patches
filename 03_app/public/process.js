// The model's process as a diagram: photo → crop → DINOv2 → our encoder → 32-number code → three answers.
// processDiagram()            the general version (How it works page)
// processDiagram({ r, ... })  filled with one upload's real values (Upload page): crop, code, neighbours, votes, score
import { h, pretty, materialColour } from "/app.js";

const arrow = (dir = "right") => h("div", { class: `pd-arrow ${dir}`, "aria-hidden": "true" });

function step(n, title, sub, body, cls = "") {
  return h("div", { class: `pd-step ${cls}` },
    h("div", { class: "pd-n" }, n), h("b", {}, title), h("span", { class: "pd-sub" }, sub), body || "");
}

// The middle half of the centre square: exactly what the model sees (same as 02_model_server/app/preprocess.py)
function cropCanvas(src) {
  const canvas = h("canvas", { width: 224, height: 224, class: "pd-img", "aria-label": "The part of your photo the model reads" });
  const img = new Image();
  img.onload = () => {
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const half = side / 2;
    const x = (img.naturalWidth - half) / 2, y = (img.naturalHeight - half) / 2;
    canvas.getContext("2d").drawImage(img, x, y, half, half, 0, 0, 224, 224);
  };
  img.src = src;
  return canvas;
}

function codeBars(code) {
  const max = Math.max(...code.map(Math.abs)) || 1;
  return h("div", { class: "pd-code", title: code.map((x) => x.toFixed(2)).join("  ") },
    ...code.map((x) => h("i", { style: `--v:${(Math.abs(x) / max).toFixed(3)}`, class: x < 0 ? "neg" : "" })));
}

function fakeBars(n, seed) {
  // the general diagram: a fixed, made-up pattern just to show the shape of the data
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  return h("div", { class: "pd-code ghost", title: "Illustration, not real values" }, ...Array.from({ length: n }, () => {
    const x = rnd() * 2 - 1;
    return h("i", { style: `--v:${Math.abs(x).toFixed(3)}`, class: x < 0 ? "neg" : "" });
  }), h("small", { class: "pd-ill" }, "illustration"));
}

function votes(matches) {
  const count = {};
  matches.forEach((m) => { count[m.material] = (count[m.material] || 0) + 1; });
  return h("div", { class: "pd-votes" }, ...Object.entries(count).sort((a, b) => b[1] - a[1]).map(([m, c]) =>
    h("div", {}, h("span", {}, pretty(m)),
      h("div", { class: "bar" }, h("i", { style: `width:${c * 20}%;background:${materialColour(m)}` })),
      h("b", {}, `${c}/5`))));
}

const thumbs = (items) => h("div", { class: "pd-thumbs" }, ...items.map((m) =>
  h("figure", {}, h("img", { src: m.thumb_url, alt: pretty(m.material), loading: "lazy" }),
    h("figcaption", {}, h("i", { style: `background:${materialColour(m.material)}` }), pretty(m.material),
      m.distance != null ? h("small", {}, m.distance.toFixed(2)) : ""))));

function gauge(score, threshold) {
  const max = Math.max(threshold * 1.6, score * 1.1);
  const pct = (v) => `${Math.min(100, (100 * v) / max).toFixed(1)}%`;
  return h("div", { class: "pd-gauge" },
    h("div", { class: "track" },
      h("i", { class: score > threshold ? "hot" : "", style: `width:${pct(score)}` }),
      h("span", { class: "thr", style: `left:${pct(threshold)}`, title: "threshold" })),
    h("div", { class: "nums" }, h("span", {}, `score ${score.toFixed(2)}`), h("span", {}, `threshold ${threshold.toFixed(2)}`)));
}

export function processDiagram(live = null) {
  const r = live?.r;
  const photo = r
    ? h("img", { class: "pd-img", src: live.imageUrl, alt: "Your photo" })
    : h("div", { class: "pd-img ph" }, "your photo");
  const crop = r ? cropCanvas(live.imageUrl) : h("div", { class: "pd-img ph crop" }, h("span", {}, "middle half"));

  const chain = h("div", { class: "pd-chain" },
    step(1, "Photo", r ? "what you uploaded" : "any JPEG, PNG or WebP", photo),
    arrow(),
    step(2, "Centre crop", "middle half of the centre square, 224 × 224 px", crop),
    arrow(),
    step(3, "DINOv2-small", "Meta's network, frozen: 768 features about texture and shape", fakeBars(48, 7), "dark"),
    arrow(),
    step(4, "Our encoder", "768 → 256 → 32, trained by us on 27,625 MINC photos",
      h("div", { class: "pd-funnel" }, h("i", { style: "--w:100%" }), h("i", { style: "--w:55%" }), h("i", { style: "--w:16%" })), "ours"),
    arrow(),
    step(5, "The code: 32 numbers", r?.code ? "this photo's code (bars = the numbers)" : "the photo's fingerprint; similar materials get similar codes",
      r?.code ? codeBars(r.code) : r ? h("p", { class: "pd-note" }, "The model server did not send the code for this search (searches before this feature, or before the server update).") : fakeBars(32, 3), "ours"));

  const matches = r?.matches || [];
  const branches = h("div", { class: "pd-branches" },
    step("A", "Material answer", "the 5 closest of 3,900 MINC photos vote",
      r ? h("div", {}, thumbs(matches), votes(matches),
        h("p", { class: "pd-result" }, "→ ", h("b", {}, pretty(r.material_guess)), ` ${Math.round(r.confidence * 100)}%`))
        : h("p", { class: "pd-note" }, "4 brick + 1 stone among the 5 closest → \"Brick 80% · stone 20%\". Materials under 20% are not shown.")),
    step("B", "Clean swatches", "the 5 closest of 1,280 CC0 swatches, same code, same distance",
      r ? thumbs(r.swatches || []) : h("p", { class: "pd-note" }, "Distance runs from 0 (identical code) to 2 (opposite). Each match shows its distance.")),
    step("C", "Unusual check", "our decoder rebuilds the 768 features from the 32 numbers",
      r ? h("div", {}, gauge(r.unusual_score, r.threshold),
        h("p", { class: "pd-result" }, r.is_unusual ? "→ unusual: results may not mean much" : "→ looks like a building material"))
        : h("p", { class: "pd-note" }, "A bad rebuild means the photo is unlike the training photos. Above the 95th percentile of normal photos = \"unusual\".")),
    step("D", "Its place in the cloud", "the code squashed to 3D next to all 5,180 images",
      r ? h("a", { class: "btn", href: `/?focus=${r.id}` }, "Show it in the point cloud")
        : h("a", { class: "btn", href: "/" }, "Open the point cloud")));

  return h("div", { class: `pd${r ? " live" : ""}` }, chain, h("div", { class: "pd-split", "aria-hidden": "true" }), branches);
}
