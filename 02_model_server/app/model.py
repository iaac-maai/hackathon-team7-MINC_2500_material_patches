"""Loads the model and the two galleries, and turns one image (or one gallery item) into an answer.

Two galleries, both encoded with the same model:
- photos:   3,900 MINC-2500 patches (300 per material), real photos with context;
- swatches: clean CC0 material samples from ambientCG and Poly Haven (via MatSynth's list).

The ONNX file (90 MB) and the galleries are NOT in GitHub (*.onnx and *.npy are git-ignored).
At start-up they are downloaded from Hugging Face into models/, pinned to one revision so the
server always runs the model the README describes.
"""
import json
import os
from pathlib import Path

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download

from app.preprocess import preprocess

HF_REPO = os.environ.get("HF_REPO", "iaac-maai/hackathon-team7-material-finder-ae")
HF_REVISION = os.environ.get("HF_REVISION", "cbe7297f47bef9d54a9ed8c2889c3e6e35be41c5")
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
FILES = ["material_finder.onnx", "config.json", "gallery_latents.npy", "gallery_meta.json",
         "swatch_latents.npy", "swatch_meta.json"]
FILE_URL = f"https://huggingface.co/{HF_REPO}/resolve/{HF_REVISION}/{{path}}"
SOURCES = ("photo", "swatch")


def download():
    # Downloads only what is missing; returns {file name: local path}
    return {name: Path(hf_hub_download(HF_REPO, name, revision=HF_REVISION, local_dir=MODELS_DIR))
            for name in FILES}


class MaterialFinder:
    def __init__(self):
        paths = download()
        options = ort.SessionOptions()
        options.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "2"))   # Render free: a small share of a CPU
        options.enable_mem_pattern = False                                      # less memory on a 512 MB server
        self.session = ort.InferenceSession(str(paths["material_finder.onnx"]), options,
                                            providers=["CPUExecutionProvider"])
        self.config = json.loads(paths["config.json"].read_text())
        self.codes = {"photo": np.load(paths["gallery_latents.npy"]), "swatch": np.load(paths["swatch_latents.npy"])}
        self.meta = {"photo": json.loads(paths["gallery_meta.json"].read_text()),
                     "swatch": json.loads(paths["swatch_meta.json"].read_text())}
        # Photo gallery ids are MINC training-set ids; position in the gallery is what we search by
        self.photo_pos = {m["id"]: pos for pos, m in enumerate(self.meta["photo"])}
        self.k = int(self.config["neighbours"])
        self.min_share = float(self.config["min_share"])
        self.threshold = float(self.config["unusual_threshold"])
        for source in SOURCES:
            assert len(self.codes[source]) == len(self.meta[source]), f"{source} gallery and metadata differ"

    @property
    def gallery(self):
        return self.codes["photo"]

    # ---- building blocks ---------------------------------------------------
    def item(self, source, pos, distance=None, rank=None):
        m = self.meta[source][pos]
        out = {"source": source, "id": m["id"], "material": m["material"],
               "thumb_url": FILE_URL.format(path=m["thumb"])}
        if source == "swatch":
            out.update({"name": m["name"], "category": m["category"], "library": m["source"], "link": m["link"],
                        "colour": m.get("colour"), "sphere_url": FILE_URL.format(path=m["sphere"])})
        if distance is not None:
            out["distance"] = round(float(distance), 4)
        if rank is not None:
            out["rank"] = rank
        return out

    def nearest(self, code, source, k, skip=None):
        distances = np.linalg.norm(self.codes[source] - code, axis=1)     # codes have length 1: cosine search
        order = [int(i) for i in np.argsort(distances) if (source, int(i)) != skip][:k]
        return [self.item(source, i, distances[i], r + 1) for r, i in enumerate(order)]

    def ranked_materials(self, matches):
        materials = [m["material"] for m in matches]
        # Rank by votes; a tie goes to the material with the closest match (it appears first in `materials`)
        ranked = sorted(set(materials), key=lambda m: (-materials.count(m), materials.index(m)))
        answer = [{"name": m, "share": round(materials.count(m) / len(materials), 2)} for m in ranked]
        return answer, [a for a in answer[:3] if a["share"] >= self.min_share] or answer[:1]

    # ---- the two questions the app asks -------------------------------------
    def predict(self, image) -> dict:
        """A photo -> ranked materials, 5 similar photos, 5 clean swatches, unusual score."""
        code, unusual_score = self.session.run(None, {"image": preprocess(image)})
        code = code[0]
        photos = self.nearest(code, "photo", self.k)
        answer, shown = self.ranked_materials(photos)
        swatches = self.nearest(code, "swatch", self.k)
        score = float(unusual_score[0])
        return {
            "material_guess": answer[0]["name"],
            "confidence": answer[0]["share"],
            "materials": shown,
            "matches": photos,
            "swatches": swatches,
            "swatch_materials": self.ranked_materials(swatches)[1],
            "unusual_score": round(score, 4),
            "threshold": round(self.threshold, 4),
            "is_unusual": score > self.threshold,
            "model_version": self.config.get("version", 2),
            "code": [round(float(x), 4) for x in code],     # the 32 numbers, for the app's "how the model read it"
        }

    def similar(self, source: str, item_id: int, k: int = 12) -> dict:
        """A gallery item (photo or swatch) -> the most similar photos and swatches, using its stored code."""
        if source not in SOURCES:
            raise KeyError(f"source must be 'photo' or 'swatch', not {source!r}")
        if source == "photo":
            if item_id not in self.photo_pos:
                raise KeyError(f"no photo with id {item_id}")
            pos = self.photo_pos[item_id]
        else:
            if not 0 <= item_id < len(self.meta["swatch"]):
                raise KeyError(f"no swatch with id {item_id}")
            pos = item_id
        k = max(1, min(int(k), 40))
        code = self.codes[source][pos]
        return {"item": self.item(source, pos),
                "photos": self.nearest(code, "photo", k, skip=(source, pos)),
                "swatches": self.nearest(code, "swatch", k, skip=(source, pos))}
