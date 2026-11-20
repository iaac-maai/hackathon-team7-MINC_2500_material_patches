"""Point cloud for the app's Home page: where model v3 puts every photo and swatch.

Reads the 32-number codes the model server searches with (gallery + swatches), squashes them to 3D with UMAP
(cosine distance, seed 42) and writes 03_app/public/data/cloud.json, one point per catalogue item, in the same
order as 03_app/public/data/catalog.json.

Colours: the 13 k-means clusters from cluster_v3.py (fitted on the gallery codes, no labels). Swatches get the
nearest cluster centre. Each cluster is matched one-to-one to a material (Hungarian matching on the overlap), so in
the app "cluster" and "true material" colours agree wherever the clusters agree with the labels.

Run from the repo root:  python 01_autoencoder/scripts/cloud_layout.py   (needs umap-learn, scikit-learn, scipy)
"""
import json
from pathlib import Path

import numpy as np
import umap
from scipy.optimize import linear_sum_assignment

ROOT = Path(__file__).resolve().parents[2]
MODELS = ROOT / "02_model_server" / "models"          # the same files the live server uses (HF revision cbe7297)
CATALOG = ROOT / "03_app" / "public" / "data" / "catalog.json"
CLUSTERS = ROOT / "01_autoencoder" / "models" / "gallery_clusters.json"
OUT = ROOT / "03_app" / "public" / "data" / "cloud.json"

gallery = np.load(MODELS / "gallery_latents.npy")
swatches = np.load(MODELS / "swatch_latents.npy")
gallery_meta = json.load(open(MODELS / "gallery_meta.json"))
clusters = json.load(open(CLUSTERS))
catalog = json.load(open(CATALOG))
materials = [g["key"] for g in catalog["groups"]]

# ---- clusters: gallery labels from k-means, swatches by nearest cluster centre --------------------------
assert [c["id"] for c in clusters] == [m["id"] for m in gallery_meta], "cluster file and gallery are not aligned"
ids = sorted({c["cluster"] for c in clusters})                    # the file numbers clusters from 1
g_cluster = np.array([ids.index(c["cluster"]) for c in clusters])
k = len(ids)
centres = np.stack([gallery[g_cluster == c].mean(0) for c in range(k)])
s_cluster = np.argmin(((swatches[:, None, :] - centres[None]) ** 2).sum(-1), axis=1)

# Match clusters to materials one-to-one by how many gallery photos they share
materials = [m for m in materials if any(g["material"] == m for g in gallery_meta)]   # the 13 photo materials
g_material = np.array([materials.index(m["material"]) for m in gallery_meta])
overlap = np.zeros((k, len(materials)), int)
for c, m in zip(g_cluster, g_material):
    overlap[c, m] += 1
rows, cols = linear_sum_assignment(-overlap)
cluster_material = dict(zip(rows.tolist(), cols.tolist()))

# ---- 3D layout ---------------------------------------------------------------------------------------
codes = np.concatenate([gallery, swatches])
xyz = umap.UMAP(n_components=3, n_neighbors=30, min_dist=0.15, metric="cosine", random_state=42).fit_transform(codes)
xyz -= xyz.mean(0)
xyz /= np.abs(xyz).max()                                 # fits in a cube from -1 to 1

photo_row = {m["id"]: i for i, m in enumerate(gallery_meta)}
points = []
for it in catalog["items"]:
    if it["s"] == "p":
        row, c = photo_row[it["i"]], g_cluster[photo_row[it["i"]]]
    else:
        row, c = len(gallery) + it["i"], s_cluster[it["i"]]
    points.append([int(round(v * 1000)) for v in xyz[row]] + [int(c)])

summary = []
for c in range(k):
    members = g_material[g_cluster == c]
    top = np.bincount(members, minlength=len(materials)).argmax()
    summary.append({"id": c, "material": materials[cluster_material[c]], "top": materials[top],
                    "purity": round(float((members == top).mean()), 3), "photos": int(len(members)),
                    "swatches": int((s_cluster == c).sum())})
summary.sort(key=lambda s: materials.index(s["material"]))

json.dump({"about": "Model v3 codes (32 numbers) squashed to 3D with UMAP (cosine, seed 42); x, y, z in thousandths;"
                    " last number = k-means cluster (13, fitted on gallery codes without labels).",
           "clusters": summary, "points": points}, open(OUT, "w"), separators=(",", ":"))
print(f"wrote {OUT.relative_to(ROOT)}: {len(points)} points, {OUT.stat().st_size // 1024} KB")
for s in summary:
    print(f"  cluster {s['id']:2d} -> colour of {s['material']:13s} top {s['top']:13s} purity {s['purity']:.2f}"
          f"  {s['photos']} photos, {s['swatches']} swatches")
