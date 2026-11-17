"""Loads the model and the gallery, and turns one image into a ranked answer.

The ONNX file (90 MB) and the gallery are NOT in GitHub (*.onnx and *.npy are git-ignored).
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
HF_REVISION = os.environ.get("HF_REVISION", "b7ed48d56e5504f3fc099385bef837694aaf16de")   # model v2
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"
FILES = ["material_finder.onnx", "config.json", "gallery_latents.npy", "gallery_meta.json"]
THUMB_URL = f"https://huggingface.co/{HF_REPO}/resolve/{HF_REVISION}/{{thumb}}"


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
        self.gallery = np.load(paths["gallery_latents.npy"])
        self.meta = json.loads(paths["gallery_meta.json"].read_text())
        self.k = int(self.config["neighbours"])
        self.min_share = float(self.config["min_share"])
        self.threshold = float(self.config["unusual_threshold"])
        assert len(self.gallery) == len(self.meta), "gallery and metadata do not match"

    def predict(self, image) -> dict:
        x = preprocess(image)
        code, unusual_score = self.session.run(None, {"image": x})
        distances = np.linalg.norm(self.gallery - code[0], axis=1)     # codes have length 1: cosine search
        top = np.argsort(distances)[:self.k]
        materials = [self.meta[i]["material"] for i in top]
        # Rank by votes; a tie goes to the material with the closest match (it appears first in `materials`)
        ranked = sorted(set(materials), key=lambda m: (-materials.count(m), materials.index(m)))
        answer = [{"name": m, "share": round(materials.count(m) / self.k, 2)} for m in ranked]
        shown = [a for a in answer[:3] if a["share"] >= self.min_share] or answer[:1]
        score = float(unusual_score[0])
        return {
            "material_guess": answer[0]["name"],
            "confidence": answer[0]["share"],
            "materials": shown,
            "matches": [{
                "rank": r + 1,
                "id": self.meta[i]["id"],
                "material": self.meta[i]["material"],
                "distance": round(float(distances[i]), 4),
                "thumb_url": THUMB_URL.format(thumb=self.meta[i]["thumb"]),
            } for r, i in enumerate(top)],
            "unusual_score": round(score, 4),
            "threshold": round(self.threshold, 4),
            "is_unusual": score > self.threshold,
            "model_version": self.config.get("version", 2),
        }
