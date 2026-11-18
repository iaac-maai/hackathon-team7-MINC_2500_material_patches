"""Fair check of the v3 clusters: cluster the 3,250 TEST patches (never seen in training) as well as the gallery.

The gallery patches are training patches, and v3 was trained with their labels, so clusters on the gallery look better
than they really are. Here both v2 and v3 encode the cached DINOv2 centre-crop features of the test patches
(the same numbers the ONNX file computes), and k-means (13 clusters, no labels) runs on those codes.
Writes notebook/28_v3_clusters_gallery_vs_test.png. Run from the repository root:
    .venv/bin/python 01_autoencoder/scripts/cluster_v3_test.py
"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, normalized_mutual_info_score
from sklearn.preprocessing import normalize
from torch import nn

ROOT = Path(__file__).resolve().parents[2]
AE = ROOT / "01_autoencoder"
K, SEED = 13, 0
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10, "axes.spines.top": False, "axes.spines.right": False})


def purity(y, c):
    return sum(np.bincount(y[c == k]).max() for k in np.unique(c)) / len(y)


def scores(y, Z):
    c = KMeans(K, n_init=10, random_state=SEED).fit_predict(Z)
    return {"purity": purity(y, c), "NMI": normalized_mutual_info_score(y, c), "ARI": adjusted_rand_score(y, c)}


def encoder(path):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    enc = nn.Sequential(nn.Linear(768, 256), nn.ReLU(), nn.Linear(256, 32))
    enc.load_state_dict({k[len("encoder."):]: v for k, v in ckpt["feature_ae"].items() if k.startswith("encoder.")})
    mu, sd = np.asarray(ckpt["feat_mu"]), np.asarray(ckpt["feat_sd"])
    def encode(F):
        with torch.no_grad():
            return normalize(enc(torch.from_numpy(((F - mu) / sd).astype(np.float32))).numpy())
    return encode


test = np.load(ROOT / "data" / "minc_round2_test.npz")
F_test, y_test = test["dino_centre"], test["y"]
meta = json.loads((AE / "models" / "gallery_meta.json").read_text())
mats = sorted({m["material"] for m in meta})
y_gal = np.array([mats.index(m["material"]) for m in meta])

rows = {}
for name, pt, gal in [("v2", AE / "models_v2_dino_ae" / "material_finder_ae.pt", AE / "models_v2_dino_ae" / "gallery_latents.npy"),
                      ("v3 supervised", AE / "models" / "material_finder_ae.pt", AE / "models" / "gallery_latents.npy")]:
    rows[name] = {"gallery\n(training patches)": scores(y_gal, np.load(gal)),
                  "test\n(never seen)": scores(y_test, encoder(pt)(F_test))}
for name, r in rows.items():
    for split, s in r.items():
        print(f"{name:15s} {split.replace(chr(10), " "):28s} purity {s['purity']:.3f}  NMI {s['NMI']:.3f}  ARI {s['ARI']:.3f}")

fig, axes = plt.subplots(1, 3, figsize=(14, 4.2), sharey=True)
labels = [f"{n}\n{split}" for n in rows for split in rows[n]]
colors = ["#9ecae1", "#4C78A8", "#fdae6b", "#E4572E"]
for ax, metric in zip(axes, ["purity", "NMI", "ARI"]):
    v = [rows[n][split][metric] for n in rows for split in rows[n]]
    ax.bar(range(4), v, color=colors)
    for i, vi in enumerate(v):
        ax.text(i, vi + 0.015, f"{vi:.2f}", ha="center", fontsize=9)
    ax.set_xticks(range(4), labels, fontsize=7.5)
    ax.set_title(metric, loc="left", weight="bold")
    ax.set_ylim(0, 1.05)
fig.suptitle("k-means with 13 clusters: v2 vs v3 codes, on the gallery and on test patches the models never saw",
             fontsize=12, weight="bold")
fig.tight_layout()
fig.savefig(AE / "notebook" / "28_v3_clusters_gallery_vs_test.png", dpi=150, facecolor="white")
print("wrote 28_v3_clusters_gallery_vs_test.png")
