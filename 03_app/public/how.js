// How it works: the model's process as a diagram, how to read its answers, and how it learned.
import { h, api, sidebar } from "/app.js";
import { processDiagram } from "/process.js";

sidebar("how");
const main = document.getElementById("main");

const card = (title, ...body) => h("div", { class: "how-card" }, h("h3", {}, title), ...body);
const p = (...t) => h("p", {}, ...t);

const latest = h("div");
main.append(
  h("header", { class: "page-head" }, h("div", {},
    h("div", { class: "eyebrow" }, "How it works"),
    h("h1", {}, "From a photo to an answer"),
    p("Every search runs the same path. A photo becomes 32 numbers, and everything you see is found by comparing those numbers."))),

  processDiagram(),
  latest,

  h("h2", { class: "how-h2" }, "Reading the results"),
  h("div", { class: "how-grid" },
    card("The percentages",
      p("\"Brick 80%\" means 4 of the 5 closest photos are brick. It is a vote, not a probability."),
      p("Up to three materials are shown, each with at least 20%. \"Not sure\" appears when no material has more than 2 votes.")),
    card("The distance",
      p("Each match shows how far its code is from your photo's code: 0 is identical, 2 is opposite."),
      p("Swatches and photos are measured the same way, so the closest swatch is the cleanest look-alike, even for a material the swatch libraries don't have.")),
    card("The unusual warning",
      p("The decoder tries to rebuild the 768 features from the 32 numbers. A photo unlike the training photos rebuilds badly."),
      p("Above the 95th percentile of normal photos the app warns you. About 1 in 20 normal photos gets the warning anyway, so treat it as a hint.")),
    card("The point cloud and clusters",
      p("Home shows every code squashed to 3D. k-means split the photos into 13 groups without seeing any labels; 93% of photos sit in their own material's group."),
      p("The \"Disagreements\" view shows the photos the model puts with another material: mostly look-alikes such as mirror and painted walls.")),
    card("What it can't see",
      p("Only the middle of the photo is read, so frame one surface in the centre."),
      p("Mirror, glass and painted walls look alike to it; so do brick and stone. Metal, mirror and painted are right first only about 70% of the time.")),
    card("How sure to be",
      p("On 3,250 test photos it puts the right material first 80% of the time (random guessing: 8%)."),
      p("Those are MINC photos. Phone photos in other light are untested and may score lower."))),

  h("h2", { class: "how-h2" }, "How it learned"),
  h("div", { class: "how-grid two" },
    card("Two goals at once",
      p("Our part, 410,912 numbers, was trained for 30 epochs on 27,625 labelled MINC photos with:"),
      h("pre", { class: "how-formula" }, "loss = rebuild error + 0.3 × supervised contrastive loss"),
      p("The rebuild error keeps the unusual check working. The contrastive loss pulls codes of the same material together and pushes others apart.")),
    card("What made the difference",
      h("table", { class: "how-table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Model"), h("th", {}, "Input"), h("th", {}, "5 closest right"))),
        h("tbody", {},
          h("tr", {}, h("td", {}, "v1"), h("td", {}, "pixels, 64 px"), h("td", {}, "14%")),
          h("tr", {}, h("td", {}, "v2"), h("td", {}, "DINOv2 features"), h("td", {}, "61%")),
          h("tr", {}, h("td", {}, "v3 (live)"), h("td", {}, "v2 + labels in the loss"), h("td", {}, h("b", {}, "77%"))))),
      p("Pixels taught the first model colour, not material. Changing the input mattered more than making the model bigger."))),
);

// The most recent team upload, read the same way (if there is one)
api("/api/history").then((rows) => {
  if (!rows.length) return;
  latest.replaceChildren(h("p", { class: "how-latest" }, "See the same diagram filled in with real values: ",
    h("a", { href: `/upload?search=${rows[0].id}#how` }, "the team's latest upload"), " or ", h("a", { href: "/upload" }, "upload your own photo"), "."));
}).catch(() => {});
