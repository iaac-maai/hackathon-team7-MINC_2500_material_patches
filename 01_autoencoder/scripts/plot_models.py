"""Draw the four autoencoder designs we tried, and compare every setup we measured.

Reads only the results CSVs and model configs already in 01_autoencoder/ (nothing is retrained).
Writes two figures next to the others in notebook/:
    20_architectures.png    one network diagram per design
    21_model_comparison.png precision@5, unusual-patch AUC and size for every setup
Run from the repository root:
    .venv/bin/python 01_autoencoder/scripts/plot_models.py
"""
import math
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from matplotlib.patches import FancyArrowPatch, Polygon, Rectangle
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FIG_DIR = ROOT / "notebook"
THUMB = ROOT / "models" / "gallery_thumbs" / "00000.jpg"   # a brick patch, used as the example input

ENC, CODE, DEC, FROZEN, IO = "#4C78A8", "#F58518", "#54A24B", "#B0B0B0", "#E8E8E8"
FAMILY_COLOURS = {"Dense AE (pixels)": "#9D755D", "Conv AE (pixels)": "#4C78A8",
                  "ResNet-18 + feature AE": "#B279A2", "DINOv2 + feature AE": "#F58518",
                  "No autoencoder (reference)": "#BAB0AC"}
CHANCE = 1 / 13                                            # 13 building materials, equal numbers each

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False,
                     "axes.spines.right": False})


# ---- 1. network diagrams --------------------------------------------------------------
# A layer is a dict: kind "vec" (a list of numbers), "map" (channels x size x size feature map),
# "img" (the input picture), "frozen" (a pretrained network we did not train).
def vec(n, colour, label, note=""):
    return {"kind": "vec", "n": n, "c": colour, "label": label, "note": note}


def fmap(ch, size, colour, label, note=""):
    return {"kind": "map", "ch": ch, "s": size, "c": colour, "label": label, "note": note}


def size_to_height(n):
    return 0.35 + 2.2 * math.log(n) / math.log(12288)       # 32 numbers -> short bar, 12,288 -> tall bar


def draw_layer(ax, x, L, thumb):
    if L["kind"] == "img":
        ax.imshow(thumb, extent=(x - 0.55, x + 0.55, -0.55, 0.55), zorder=3)
        ax.add_patch(Rectangle((x - 0.55, -0.55), 1.1, 1.1, fill=False, lw=1, ec="#333", zorder=4))
        top, bottom = 0.55, -0.55
    elif L["kind"] == "frozen":
        ax.add_patch(Rectangle((x - 0.55, -1.1), 1.1, 2.2, fc=FROZEN, ec="#555", hatch="///", lw=1, zorder=3))
        ax.text(x, 0, L["name"], ha="center", va="center", fontsize=9, weight="bold", zorder=5,
                bbox=dict(fc="white", ec="none", pad=1.5, alpha=0.9))
        top, bottom = 1.1, -1.1
    elif L["kind"] == "map":
        # a feature map: front face shows the spatial size, the depth shows the channel count
        hgt = 0.4 + 1.6 * L["s"] / 64
        d = 0.12 + 0.5 * L["ch"] / 128
        x0, y0 = x - 0.18 - d / 2, -hgt / 2 - d / 4
        front = Rectangle((x0, y0), 0.36, hgt, fc=L["c"], ec="white", lw=0.8, zorder=3, alpha=0.95)
        topf = Polygon([(x0, y0 + hgt), (x0 + d, y0 + hgt + d / 2), (x0 + d + 0.36, y0 + hgt + d / 2),
                        (x0 + 0.36, y0 + hgt)], fc=L["c"], ec="white", lw=0.8, alpha=0.6, zorder=2)
        side = Polygon([(x0 + 0.36, y0), (x0 + 0.36 + d, y0 + d / 2), (x0 + 0.36 + d, y0 + hgt + d / 2),
                        (x0 + 0.36, y0 + hgt)], fc=L["c"], ec="white", lw=0.8, alpha=0.75, zorder=2)
        for p in (topf, side, front):
            ax.add_patch(p)
        top, bottom = y0 + hgt + d / 2, y0
    else:
        hgt = size_to_height(L["n"])
        ax.add_patch(Rectangle((x - 0.17, -hgt / 2), 0.34, hgt, fc=L["c"], ec="white", lw=0.8, zorder=3))
        top, bottom = hgt / 2, -hgt / 2
    ax.text(x, top + 0.12, L["label"], ha="center", va="bottom", fontsize=8.5, weight="bold", color="#222")
    if L.get("note"):
        ax.text(x, bottom - 0.12, L["note"], ha="center", va="top", fontsize=7.5, color="#555", linespacing=1.15)


XMAX_LAYER = 8 * 1.55                                       # widest row (conv AE, 9 layers): same scale for every row


def draw_network(ax, layers, title, subtitle, side_notes=(), thumb=None):
    xs = [i * 1.55 for i in range(len(layers))]
    for i, (x, L) in enumerate(zip(xs, layers)):
        draw_layer(ax, x, L, thumb)
        if i:
            ax.add_patch(FancyArrowPatch((xs[i - 1] + 0.62, 0), (x - 0.62, 0), arrowstyle="-|>",
                                         mutation_scale=10, color="#888", lw=1, zorder=1))
    code_i = next(i for i, L in enumerate(layers) if L.get("c") == CODE)
    enc_start = next(i for i, L in enumerate(layers) if L.get("c") == ENC)
    # encoder / decoder brackets
    for a, b, text, col in [(enc_start, code_i, "encoder (trained)", ENC),
                            (code_i, len(layers) - 1, "decoder (trained)", DEC)]:
        y = -2.05
        ax.plot([xs[a] - 0.3, xs[b] + 0.3], [y, y], color=col, lw=2.5, solid_capstyle="butt")
        ax.text((xs[a] + xs[b]) / 2, y - 0.15, text, ha="center", va="top", fontsize=8.5, color=col, weight="bold")
    ax.text(-0.75, 2.75, title, fontsize=12.5, weight="bold", va="bottom")
    ax.text(-0.75, 2.5, subtitle, fontsize=9, color="#444", va="top")
    for k, note in enumerate(side_notes):
        ax.text(XMAX_LAYER + 1.1, 0.8 - k * 0.5, note, fontsize=8.5, color="#333", va="center")
    ax.set_xlim(-0.9, XMAX_LAYER + 4.6)
    ax.set_ylim(-2.6, 3.2)
    ax.set_aspect("equal")
    ax.axis("off")


def figure_architectures():
    thumb = Image.open(THUMB).convert("RGB")
    img = {"kind": "img", "label": "patch", "note": "3 × 64 × 64"}
    img224 = {"kind": "img", "label": "patch", "note": "3 × 224 × 224"}
    nets = [
        ("A  Dense autoencoder", "every pixel to every neuron · latent 64 · 6.3 M trained parameters · first try",
         [img, vec(12288, ENC, "flatten", "12,288"), vec(256, ENC, "Linear+ReLU", "256"),
          vec(64, CODE, "code", "64"), vec(256, DEC, "Linear+ReLU", "256"),
          vec(12288, DEC, "Linear+Sigmoid", "12,288\n→ 3×64×64")],
         ["learns: rebuild the pixels", "search: Euclidean on the code", "precision@5: 0.134"]),
        ("B  Convolutional autoencoder", "small filters slide over the patch · latent 32 · 0.86 M trained parameters · v1 model",
         [img, fmap(32, 32, ENC, "Conv 4×4 /2", "32 × 32²"), fmap(64, 16, ENC, "Conv 4×4 /2", "64 × 16²"),
          fmap(128, 8, ENC, "Conv 4×4 /2", "128 × 8²"), vec(32, CODE, "Linear", "code 32"),
          fmap(128, 8, DEC, "Linear+ReLU", "128 × 8²"), fmap(64, 16, DEC, "ConvT 4×4 ×2", "64 × 16²"),
          fmap(32, 32, DEC, "ConvT 4×4 ×2", "32 × 32²"), fmap(3, 64, DEC, "ConvT+Sigmoid", "3 × 64²")],
         ["learns: rebuild the pixels", "search: Euclidean on the code", "precision@5: 0.136 (0.149 zoomed)"]),
        ("C  ResNet-18 + feature autoencoder", "a frozen ImageNet network describes the texture; the AE squeezes that · 0.28 M trained",
         [img224, {"kind": "frozen", "name": "ResNet-18\n(frozen,\nImageNet)", "label": "backbone", "note": "11.2 M, not trained"},
          vec(512, ENC, "features", "512\nstandardised"), vec(256, ENC, "Linear+ReLU", "256"),
          vec(32, CODE, "code", "32"), vec(256, DEC, "Linear+ReLU", "256"), vec(512, DEC, "Linear", "512 rebuilt")],
         ["learns: rebuild the features", "search: cosine on the code", "precision@5: 0.439 (0.472 centre)"]),
        ("D  DINOv2-small + feature autoencoder  (v2, the one we ship)",
         "centre crop · self-supervised backbone · denoising + weight decay · 0.41 M trained parameters",
         [img224, {"kind": "frozen", "name": "DINOv2-\nsmall\n(frozen)", "label": "backbone", "note": "22 M, not trained"},
          vec(768, ENC, "CLS + mean", "768\nstandardised"), vec(256, ENC, "Linear+ReLU", "256"),
          vec(32, CODE, "code", "32 → length 1"), vec(256, DEC, "Linear+ReLU", "256"), vec(768, DEC, "Linear", "768 rebuilt")],
         ["learns: rebuild the features", "search: cosine on the code", "precision@5: 0.647",
          "rebuild error → 'unusual' flag"]),
    ]
    fig, axes = plt.subplots(len(nets), 1, figsize=(16, 4.1 * len(nets)))
    for ax, (title, sub, layers, notes) in zip(axes, nets):
        draw_network(ax, layers, title, sub, notes, thumb)
    handles = [Rectangle((0, 0), 1, 1, fc=c, ec="#555", hatch=h) for c, h in
               [(ENC, ""), (CODE, ""), (DEC, ""), (FROZEN, "///")]]
    fig.legend(handles, ["encoder", "code (the 'fingerprint' we search with)", "decoder", "pretrained, frozen"],
               loc="lower center", ncol=4, frameon=False, fontsize=10)
    fig.suptitle("The four autoencoder designs we tried (bar height ∝ log of how many numbers; boxes: channels × size²)",
                 fontsize=13, y=0.995)
    fig.tight_layout(rect=(0, 0.025, 1, 0.985))
    out = FIG_DIR / "20_architectures.png"
    fig.savefig(out, dpi=150, facecolor="white")
    print("wrote", out)


# ---- 2. comparison --------------------------------------------------------------------
def load_results():
    rows = []

    def add(name, family, p5, auc=None, params=None, stage=""):
        rows.append({"setup": name, "family": family, "p5": p5, "auc": auc, "params": params, "stage": stage})

    t = pd.read_csv(ROOT / "results_table.csv")
    for _, r in t.iterrows():
        fam = "Dense AE (pixels)" if r["setup"].startswith("dense") else "Conv AE (pixels)"
        add(r["setup"], fam, r["precision@5"], None, r["parameters"], "day 1")

    imp = pd.read_csv(ROOT / "results_improvements.csv")
    for _, r in imp.iterrows():
        s = r["setup"]
        if s.startswith("baseline"):
            continue                                           # same model as "conv AE, latent 32" above
        if s.startswith("reference"):
            add("ResNet-18 features, no AE (512 numbers)", "No autoencoder (reference)", r["precision@5"], None, 0, "round 1")
            continue
        fam = "ResNet-18 + feature AE" if s.startswith("ResNet") else "Conv AE (pixels)"
        add(s, fam, r["precision@5"], r["unusual AUC"], r["parameters"], "round 1")

    r2 = pd.read_csv(ROOT / "results_round2.csv")
    for _, r in r2.iterrows():
        f = r["features"]
        if "round 1" in f:
            add("ResNet-18 + feature AE, cosine", "ResNet-18 + feature AE", r["AE 32, cosine"], r["unusual AUC"], None, "round 2")
            continue
        fam = "DINOv2 + feature AE" if f.startswith("DINO") else "ResNet-18 + feature AE"
        add(f"{f} + feature AE, cosine", fam, r["AE 32, cosine"], r["unusual AUC"], None, "round 2")
    df = pd.DataFrame(rows)
    df["shipped"] = df["setup"].isin(["conv AE, latent 32", "DINOv2-small, centre crop + feature AE, cosine"])
    return df


def figure_comparison():
    df = load_results().sort_values("p5").reset_index(drop=True)
    fig = plt.figure(figsize=(16, 13))
    gs = fig.add_gridspec(2, 2, height_ratios=[2.2, 1], width_ratios=[1.35, 1], hspace=0.28, wspace=0.32, top=0.91)

    # (a) every setup, precision@5
    ax = fig.add_subplot(gs[0, :])
    colours = [FAMILY_COLOURS[f] for f in df["family"]]
    bars = ax.barh(range(len(df)), df["p5"], color=colours, height=0.72)
    for i, r in df.iterrows():
        label = f"{r['p5']:.3f}" + ("   ← shipped " + ("v2" if "DINO" in r["setup"] else "v1") if r["shipped"] else "")
        ax.text(r["p5"] + 0.005, i, label, va="center", fontsize=8.5, weight="bold" if r["shipped"] else None)
        if r["shipped"]:
            bars[i].set_edgecolor("black"); bars[i].set_linewidth(1.6)
    ax.set_yticks(range(len(df)), [f"{s}  [{st}]" for s, st in zip(df["setup"], df["stage"])], fontsize=8.5)
    ax.axvline(CHANCE, color="#C33", ls="--", lw=1)
    ax.text(CHANCE + 0.004, -0.9, "random guess (1 in 13)", color="#C33", fontsize=8.5, va="center")
    ax.set_xlim(0, 0.76)
    ax.set_ylim(-1.4, len(df) - 0.4)
    ax.set_xlabel("precision@5 on the test patches: share of the 5 most similar patches that are the same material")
    ax.set_title("a  Every setup we measured: which finds the right material most often", loc="left", weight="bold")
    handles = [Rectangle((0, 0), 1, 1, fc=c) for c in FAMILY_COLOURS.values()]
    ax.legend(handles, FAMILY_COLOURS.keys(), loc="lower right", frameon=False, fontsize=9)

    # (b) best of each design, precision and unusual AUC side by side
    ax = fig.add_subplot(gs[1, 0])
    # best single-pass setup per design (TTA is left out: 3 runs per photo, and it spots unusual patches worse)
    picks = ["conv AE 32, centre zoom 64 px", "ResNet-18, centre crop + feature AE, cosine",
             "DINOv2-small, centre crop + feature AE, cosine"]
    best = df.set_index("setup").loc[picks].reset_index().set_index("family")
    dense = df[df["family"] == "Dense AE (pixels)"].iloc[0]
    names = ["Dense AE"] + [f.replace(" (pixels)", "").replace(" + feature AE", "\n+ feature AE") for f in best.index]
    p5 = [dense["p5"]] + list(best["p5"])
    auc = [float("nan")] + list(best["auc"])
    x = range(len(names))
    ax.bar([i - 0.2 for i in x], p5, 0.4, color=[FAMILY_COLOURS["Dense AE (pixels)"]] + [FAMILY_COLOURS[f] for f in best.index],
           label="precision@5 (solid, design colour)")
    ax.bar([i + 0.2 for i in x], auc, 0.4, color="none", ec="#333", hatch="///", label="unusual-patch AUC")
    for i in x:
        ax.text(i - 0.2, p5[i] + 0.012, f"{p5[i]:.2f}", ha="center", fontsize=8.5)
        if not math.isnan(auc[i]):
            ax.text(i + 0.2, auc[i] + 0.012, f"{auc[i]:.2f}", ha="center", fontsize=8.5)
    ax.text(0 + 0.2, 0.03, "not\nmeasured", ha="center", fontsize=7.5, color="#777")
    ax.axhline(0.5, color="#777", ls=":", lw=1)
    ax.text(-0.45, 0.51, "AUC 0.5 = coin flip", fontsize=7.5, color="#777", ha="left", va="bottom")
    ax.set_xticks(list(x), names, fontsize=8.5)
    ax.set_ylim(0, 1)
    ax.legend(frameon=False, fontsize=8.5, loc="upper left")
    ax.get_legend().legend_handles[0].set_color("#888")
    ax.set_title("b  Best of each design: finding the material, and spotting non-building patches",
                 loc="left", weight="bold", fontsize=10.5)

    # (c) size vs quality: more trained parameters did not help
    ax = fig.add_subplot(gs[1, 1])
    pts = [("Dense AE 64", 6_337_088, 0.134, "Dense AE (pixels)"), ("Conv AE 32", 863_587, 0.136, "Conv AE (pixels)"),
           ("Conv AE 128", 2_436_547, 0.128, "Conv AE (pixels)"), ("Conv AE 32, 128 px", 1_388_131, 0.144, "Conv AE (pixels)"),
           ("ResNet-18 + AE\n(centre, cosine)", 279_584, 0.472, "ResNet-18 + feature AE"),
           ("DINOv2 + AE (v2)", 410_912, 0.647, "DINOv2 + feature AE")]
    for name, n, p, fam in pts:
        ax.scatter(n, p, s=90, color=FAMILY_COLOURS[fam], ec="black" if "v2" in name else "none", zorder=3)
        off = {"Conv AE 32": (-10, -16), "Conv AE 32, 128 px": (-20, 9), "Conv AE 128": (-6, -16),
               "Dense AE 64": (-20, 9)}.get(name, (7, 4))
        ax.annotate(name, (n, p), xytext=off, textcoords="offset points", fontsize=8)
    ax.set_xscale("log")
    ax.set_xlim(2e5, 2e7)
    ax.set_ylim(0, 0.75)
    ax.axhline(CHANCE, color="#C33", ls="--", lw=1)
    ax.set_xlabel("parameters we trained (log scale; frozen backbones not counted)")
    ax.set_ylabel("precision@5")
    ax.set_title("c  Bigger is not better: what goes in matters more", loc="left", weight="bold", fontsize=10.5)

    fig.suptitle("Which autoencoder works best?  DINOv2-small + feature AE on the centre crop: "
                 "4.8× the first models, 8.4× random", fontsize=13.5, weight="bold", y=0.965)
    out = FIG_DIR / "21_model_comparison.png"
    fig.savefig(out, dpi=150, facecolor="white", bbox_inches="tight")
    print("wrote", out)
    return df


if __name__ == "__main__":
    figure_architectures()
    df = figure_comparison()
    print(df[["setup", "family", "p5", "auc"]].sort_values("p5", ascending=False).to_string(index=False))
