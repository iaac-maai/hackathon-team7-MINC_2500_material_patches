"""Cluster the v3 (supervised autoencoder) gallery codes without labels and compare with v2 and earlier codes.

Uses the 3,900 gallery codes the app already searches (DINOv2-small centre crop -> feature AE -> 32 numbers, length 1)
and, for comparison, the raw 768 DINOv2 features, ResNet-18 features and the v1 conv-AE codes.
Writes:
    notebook/26_v3_clusters.png             map of the patches, clusters vs real materials, scores
    notebook/27_v3_cluster_examples.png     8 example patches from every cluster
    models/gallery_clusters.json            cluster number for every gallery patch
Run from the repository root:
    .venv/bin/python 01_autoencoder/scripts/cluster_v3.py
"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import umap
from PIL import Image
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
from sklearn.preprocessing import StandardScaler, normalize

ROOT = Path(__file__).resolve().parents[2]
AE = ROOT / "01_autoencoder"
MODELS, FIG_DIR = AE / "models", AE / "notebook"
K, SEED = 13, 0
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})

meta = json.loads((MODELS / "gallery_meta.json").read_text())
Z = np.load(MODELS / "gallery_latents.npy")
MATS = sorted({m["material"] for m in meta})
y = np.array([MATS.index(m["material"]) for m in meta])


def purity(y_true, c):
    return sum(np.bincount(y_true[c == k]).max() for k in np.unique(c)) / len(y_true)


def scores(y_true, c):
    return {"purity": purity(y_true, c), "NMI": normalized_mutual_info_score(y_true, c),
            "ARI": adjusted_rand_score(y_true, c)}


# ---- 1. cluster the app's DINOv2 codes ------------------------------------------------
clusters = KMeans(K, n_init=10, random_state=SEED).fit_predict(Z)
main_score = scores(y, clusters)

# ---- 2. same clustering on other features, for comparison -----------------------------
compare = {}
raw = np.load(ROOT / "data" / "minc_round2_train.npz")
y_raw = raw["y"]
rng = np.random.default_rng(SEED)
idx = np.concatenate([rng.choice(np.flatnonzero(y_raw == k), 300, replace=False) for k in np.unique(y_raw)])
for key, name in [("r18_centre", "ResNet-18\nraw 512"), ("dino_centre", "DINOv2\nraw 768")]:
    X = normalize(StandardScaler().fit(raw[key]).transform(raw[key][idx]))
    compare[name] = scores(y_raw[idx], KMeans(K, n_init=10, random_state=SEED).fit_predict(X))
m1 = json.loads((AE / "models_v1_conv_ae" / "models" / "gallery_meta.json").read_text())
y1 = np.array([MATS.index(m["material"]) for m in m1])
z1 = np.load(AE / "models_v1_conv_ae" / "models" / "gallery_latents.npy")
z2 = np.load(AE / "models_v2_dino_ae" / "gallery_latents.npy")      # same 3,900 patches, same order
compare = {"conv AE v1\ncode 32": scores(y1, KMeans(K, n_init=10, random_state=SEED).fit_predict(z1)),
           **compare, "v2 AE\ncode 32": scores(y, KMeans(K, n_init=10, random_state=SEED).fit_predict(z2)),
           "v3 sup. AE\ncode 32 (app)": main_score}

# ---- 3. name each cluster by its biggest material -------------------------------------
table = np.zeros((K, len(MATS)), int)
for c, t in zip(clusters, y):
    table[c, t] += 1
order = np.lexsort((-table.max(1), table.argmax(1)))           # sort clusters by their main material
names = {c: f"{MATS[table[c].argmax()]} {table[c].max() / table[c].sum():.0%}" for c in range(K)}

# ---- figure 22 ----------------------------------------------------------------------------
xy = umap.UMAP(n_neighbors=30, min_dist=0.15, metric="cosine", random_state=SEED).fit_transform(Z)
cmap = plt.get_cmap("tab20")
fig = plt.figure(figsize=(17, 13))
gs = fig.add_gridspec(2, 3, height_ratios=[1.15, 1], hspace=0.3, wspace=0.28, top=0.91)

ax = fig.add_subplot(gs[0, 0:2]) if False else fig.add_subplot(gs[0, 0])
for t, m in enumerate(MATS):
    s = y == t
    ax.scatter(*xy[s].T, s=5, color=cmap(t), label=m, alpha=0.8)
ax.set_title("a  Real materials (the labels)", loc="left", weight="bold")
ax.legend(markerscale=3, fontsize=7.5, frameon=False, loc="best", ncol=2)
ax.set_xticks([]); ax.set_yticks([])

ax = fig.add_subplot(gs[0, 1])
for i, c in enumerate(order):
    s = clusters == c
    ax.scatter(*xy[s].T, s=5, color=plt.get_cmap("tab20b" if i % 2 else "tab20c")(i // 2 * 2 % 20), alpha=0.8)
    cx, cy = np.median(xy[s], axis=0)
    ax.text(cx, cy, str(i + 1), fontsize=10, weight="bold", ha="center", va="center",
            bbox=dict(boxstyle="circle,pad=0.2", fc="white", ec="#333", lw=0.8))
ax.set_title(f"b  {K} clusters found without labels (k-means)", loc="left", weight="bold")
ax.set_xticks([]); ax.set_yticks([])

ax = fig.add_subplot(gs[0, 2])
names_list = list(compare)
x = np.arange(len(names_list))
for j, (metric, col) in enumerate([("purity", "#4C78A8"), ("NMI", "#F58518"), ("ARI", "#54A24B")]):
    v = [compare[n][metric] for n in names_list]
    ax.bar(x + (j - 1) * 0.26, v, 0.26, color=col, label=metric)
    for xi, vi in zip(x, v):
        ax.text(xi + (j - 1) * 0.26, vi + 0.01, f"{vi:.2f}", ha="center", fontsize=7)
ax.set_xticks(x, names_list, fontsize=7.5)
ax.set_ylim(0, 1.0)
ax.legend(frameon=False, fontsize=8.5, loc="upper left")
ax.set_title("c  Do clusters match materials? (higher = yes)", loc="left", weight="bold")

ax = fig.add_subplot(gs[1, :])
share = table[order] / table[order].sum(1, keepdims=True)
im = ax.imshow(share.T, cmap="Blues", vmin=0, vmax=1, aspect="auto")
for i, c in enumerate(order):
    for t in range(len(MATS)):
        if table[c, t]:
            ax.text(i, t, table[c, t], ha="center", va="center", fontsize=7.5,
                    color="white" if share[i, t] > 0.55 else "#333")
ax.set_xticks(range(K), [f"cluster {i + 1}\n{names[c]}\n({table[c].sum()} patches)" for i, c in enumerate(order)], fontsize=7.5)
ax.set_yticks(range(len(MATS)), MATS, fontsize=8.5)
ax.set_title("d  What is inside each cluster (number of patches; colour = share of the cluster)", loc="left", weight="bold")
fig.colorbar(im, ax=ax, fraction=0.015, pad=0.01)
fig.suptitle(f"Clustering the v3 codes: {main_score['purity']:.0%} of patches sit in a cluster led by their own material "
             f"(random: {1 / K:.0%})", fontsize=13.5, weight="bold")
fig.savefig(FIG_DIR / "26_v3_clusters.png", dpi=150, facecolor="white", bbox_inches="tight")
print("wrote 26_v3_clusters.png")

# ---- figure 23: example patches, the ones closest to each cluster centre -------------
centres = np.stack([Z[clusters == c].mean(0) for c in range(K)])
N_EX = 8
fig, axes = plt.subplots(K, N_EX, figsize=(N_EX * 1.35 + 2.6, K * 1.4))
for i, c in enumerate(order):
    members = np.flatnonzero(clusters == c)
    near = members[np.argsort(-(Z[members] @ centres[c]))[:N_EX]]
    for j, ax in enumerate(axes[i]):
        ax.axis("off")
        if j < len(near):
            ax.imshow(Image.open(MODELS / meta[near[j]]["thumb"]))
            ax.set_title(meta[near[j]]["material"], fontsize=6.5, pad=1.5)
    axes[i, 0].text(-0.15, 0.5, f"{i + 1}  {names[c]}", transform=axes[i, 0].transAxes, ha="right", va="center",
                    fontsize=9, weight="bold")
fig.suptitle("Each v3 cluster: the 8 patches closest to its centre (label above = real material)", fontsize=12, weight="bold")
fig.tight_layout(rect=(0.13, 0, 1, 0.98))
fig.savefig(FIG_DIR / "27_v3_cluster_examples.png", dpi=130, facecolor="white")
print("wrote 27_v3_cluster_examples.png")

out = [{"id": m["id"], "thumb": m["thumb"], "material": m["material"],
        "cluster": int(np.flatnonzero(order == clusters[i])[0]) + 1} for i, m in enumerate(meta)]
(MODELS / "gallery_clusters.json").write_text(json.dumps(out))
for n, s in compare.items():
    print(f"{n.replace(chr(10), ' '):40s} purity {s['purity']:.3f}  NMI {s['NMI']:.3f}  ARI {s['ARI']:.3f}")
for i, c in enumerate(order):
    print(f"cluster {i + 1:2d}: {names[c]:22s} {table[c].sum():4d} patches  "
          + ", ".join(f"{MATS[t]} {table[c, t]}" for t in np.argsort(-table[c])[:3] if table[c, t]))
