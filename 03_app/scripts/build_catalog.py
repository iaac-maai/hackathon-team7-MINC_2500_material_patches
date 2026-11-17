"""Builds public/data/catalog.json: every gallery photo (MINC-2500) and clean swatch (CC0) the website shows.

The pictures themselves stay on Hugging Face; the catalogue only lists them, with the material group,
a colour name and (for swatches) the name, library and link. Run from the repository root after the
model folder is up to date:
    .venv/bin/python 03_app/scripts/build_catalog.py
"""
import json
import re
from collections import Counter
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "01_autoencoder" / "models"
OUT = ROOT / "03_app" / "public" / "data" / "catalog.json"
REPO = "iaac-maai/hackathon-team7-material-finder-ae"
# Same revision the model server is pinned to (02_model_server/app/model.py)
REVISION = re.search(r'HF_REVISION", "([0-9a-f]{40})"',
                     (ROOT / "02_model_server" / "app" / "model.py").read_text()).group(1)

# The 13 MINC building materials are the groups of the home page; each swatch joins the closest one.
GROUPS = {
    "brick": "Brick", "carpet": "Carpet", "ceramic": "Ceramic", "glass": "Glass", "metal": "Metal",
    "mirror": "Mirror", "painted": "Painted & plaster", "plastic": "Plastic", "polishedstone": "Polished stone & marble",
    "stone": "Stone", "tile": "Tile", "wallpaper": "Wallpaper", "wood": "Wood",
    # swatch-only groups (MINC has no photos of these)
    "concrete": "Concrete", "terracotta": "Terracotta", "roof tiles": "Roof tiles",
}
SWATCH_GROUP = {"brick": "brick", "ceramic": "ceramic", "metal": "metal", "plaster": "painted", "plastic": "plastic",
                "marble": "polishedstone", "stone": "stone", "rock": "stone", "paving": "stone", "tile": "tile",
                "wood": "wood", "concrete": "concrete", "terracotta": "terracotta", "roof tiles": "roof tiles"}


def colour_name(rgb):
    # Same buckets as the swatch notebook (cc0_swatches.ipynb)
    r, g, b = rgb / 255
    mx, mn = max(r, g, b), min(r, g, b)
    if mx < 0.22:
        return "black"
    if mx - mn < 0.08:
        return "white" if mx > 0.75 else "grey"
    hue = (np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) + 360) % 360
    if hue < 18 or hue >= 330:
        return "red"
    if hue < 45:
        return "brown" if mx < 0.6 else "orange"
    if hue < 70:
        return "beige" if mx - mn < 0.25 else "yellow"
    if hue < 170:
        return "green"
    if hue < 260:
        return "blue"
    return "purple"


def nice_name(key):
    # acg_PavingStones115B -> "Paving Stones 115B"; ph_brick_wall_02 -> "Brick wall 02"
    name = key.split("_", 1)[1]
    if "_" in name:
        name = name.replace("_", " ")
    else:
        name = re.sub(r"(?<=[a-z])(?=[A-Z0-9])", " ", name)
    return name[:1].upper() + name[1:]


photos = json.loads((MODEL_DIR / "gallery_meta.json").read_text())
swatches = json.loads((MODEL_DIR / "swatch_meta.json").read_text())
items = []
for m in photos:
    pixels = np.asarray(Image.open(MODEL_DIR / m["thumb"]).convert("RGB"), dtype=np.float32)
    centre = pixels[64:192, 64:192].reshape(-1, 3).mean(0)          # the part of the photo the model looks at
    items.append({"s": "p", "i": m["id"], "g": m["material"], "c": colour_name(centre), "t": m["thumb"]})
for m in swatches:
    items.append({"s": "w", "i": m["id"], "g": SWATCH_GROUP[m["material"]], "x": m["material"], "c": m["colour"],
                  "t": m["thumb"], "sp": m["sphere"], "n": nice_name(m["key"]), "l": m["source"], "k": m["link"],
                  "tg": m["tags"][:6]})

# Mix photos and swatches so browsing is not 3,900 photos and then the swatches
rng = np.random.default_rng(7)
items = [items[i] for i in rng.permutation(len(items))]

catalog = {"base": f"https://huggingface.co/{REPO}/resolve/{REVISION}/", "revision": REVISION,
           "groups": [{"key": k, "label": v, "photos": sum(1 for it in items if it["g"] == k and it["s"] == "p"),
                       "swatches": sum(1 for it in items if it["g"] == k and it["s"] == "w")} for k, v in GROUPS.items()],
           "items": items}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(catalog, separators=(",", ":")))
print(f"{len(items):,} items ({len(photos):,} photos, {len(swatches):,} swatches) -> {OUT.relative_to(ROOT)}, "
      f"{OUT.stat().st_size / 1e3:.0f} kB")
print("photo colours:", Counter(it["c"] for it in items if it["s"] == "p").most_common())
for g in catalog["groups"]:
    print(f"  {g['label']:<26} {g['photos']:>4} photos {g['swatches']:>4} swatches")
