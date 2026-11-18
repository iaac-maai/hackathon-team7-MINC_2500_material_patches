"""Rebuild the photo-gallery thumbnails at 256 px (from the original 362 px MINC patches) for the web app.

The gallery itself (which patches, their codes) does not change: only models/gallery_thumbs/*.jpg is rewritten,
same file names. Run from the repository root:
    .venv/bin/python 01_autoencoder/scripts/gallery_thumbs_256.py
"""
import io
import json
from pathlib import Path

import polars as pl
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "01_autoencoder" / "models"
MINC_DIR = ROOT / "data" / "minc-2500" / "data"
ALL_CLASSES = ["brick", "carpet", "ceramic", "fabric", "foliage", "food", "glass", "hair", "leather",
               "metal", "mirror", "other", "painted", "paper", "plastic", "polishedstone", "skin", "sky",
               "stone", "tile", "wallpaper", "water", "wood"]
BUILDING = ["brick", "carpet", "ceramic", "glass", "metal", "mirror", "painted", "plastic",
            "polishedstone", "stone", "tile", "wallpaper", "wood"]
SIZE = 256

meta = json.loads((MODEL_DIR / "gallery_meta.json").read_text())
files = sorted(MINC_DIR.glob("train-*.parquet"))
# Same order as every notebook: training split, building classes, parquet order -> meta["id"] indexes this
df = (pl.scan_parquet(files).select(pl.col("image").struct.field("bytes").alias("bytes"), pl.col("label"))
      .filter(pl.col("label").is_in([ALL_CLASSES.index(c) for c in BUILDING])).collect())

for m in meta:
    label = ALL_CLASSES[df["label"][m["id"]]]
    assert label == m["material"], f"order mismatch at id {m['id']}: {label} vs {m['material']}"
    image = Image.open(io.BytesIO(df["bytes"][m["id"]])).convert("RGB")
    w, h = image.size
    s = min(w, h)
    image = image.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((SIZE, SIZE), Image.LANCZOS)
    image.save(MODEL_DIR / m["thumb"], quality=85)
print(f"rewrote {len(meta):,} thumbnails at {SIZE} px")
