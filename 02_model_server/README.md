# Team 7 · Material Finder model server

Send a photo of a surface, get back the **5 most similar building-material patches** (from a gallery of 3,900), a **ranked material answer** ("carpet 40% · wood 20% · tile 20%") and an **unusual-photo** flag.

- **Live server:** `https://<service-name>.onrender.com` ← *fill in after the first deploy*
- **Model:** [iaac-maai/hackathon-team7-material-finder-ae](https://huggingface.co/iaac-maai/hackathon-team7-material-finder-ae) (v2, pinned to revision `b7ed48d`)
- **Made with:** Gradio 6.32 + ONNX Runtime 1.31 on a free Render web service. No PyTorch on the server.

> The free server **sleeps after 15 minutes without requests**. The first request wakes it up, which takes about a minute (plus a few seconds to load the model). Open the page once before a demo.

## The model

| | |
|---|---|
| **What it does** | Similarity search: finds the gallery patches that look most like the photo |
| **Inside** | Frozen DINOv2-small (pretrained, 768 features) → **our autoencoder** (768 → 256 → **32**) → 32-number code of length 1 |
| **Search** | Cosine distance to the 3,900 gallery codes (300 per material, 13 building materials from MINC-2500) |
| **Answer** | Each material's share of the 5 nearest patches; materials with at least 20%, at most 3 |
| **Unusual score** | How badly the autoencoder rebuilds the photo's features; above the threshold (95th percentile on validation photos) = "not like a building material" |
| **Test results** | Right material first for 70% of test photos, in the top 3 for 85% (random: 8%). Unusual score ROC AUC 0.82 |
| **Notebooks** | `01_autoencoder/notebook/` (training, improvements, export) |

## Input and output

**Input:** one photo, base64-encoded JPEG or PNG, at most 10 MB. A `data:image/jpeg;base64,` prefix is allowed.

The server takes the **middle half of the centre square** and resizes it to 224 × 224, the same as in training. So a **close-up of one surface** works best; on a wide shot, only the middle counts.

**Output (JSON):**

```json
{
  "material_guess": "carpet",
  "confidence": 0.4,
  "materials": [{"name": "carpet", "share": 0.4}, {"name": "wood", "share": 0.2}, {"name": "tile", "share": 0.2}],
  "matches": [
    {"rank": 1, "id": 3121, "material": "carpet", "distance": 0.5641,
     "thumb_url": "https://huggingface.co/iaac-maai/hackathon-team7-material-finder-ae/resolve/b7ed48d56e5504f3fc099385bef837694aaf16de/gallery_thumbs/00370.jpg"},
    "… 4 more matches"
  ],
  "unusual_score": 0.3312,
  "threshold": 0.635,
  "is_unusual": false,
  "model_version": 2
}
```

| Field | Meaning |
|---|---|
| `material_guess`, `confidence` | The first material and its share of the 5 votes (0.2–1.0) |
| `materials` | The ranked answer to show the user (1–3 materials) |
| `matches` | The 5 nearest gallery patches, closest first. `distance` 0 = identical. `thumb_url` is a 128 px JPEG on Hugging Face that a web page can show directly |
| `unusual_score`, `threshold`, `is_unusual` | The unusual-photo hint. Treat it as "results may be less reliable", never as a verdict |

A bad upload (not base64, not an image, too large) returns an error with a clear message instead of a result.

## Call it from a program

**Python** (`pip install gradio_client`):

```python
import base64
from gradio_client import Client

client = Client("https://<service-name>.onrender.com")
image_b64 = base64.b64encode(open("examples/brick.jpg", "rb").read()).decode()
result = client.predict(image_b64, api_name="/predict")
print(result["materials"], result["is_unusual"])
```

**Plain HTTP** (what the Cloudflare app does), two steps:

```bash
URL=https://<service-name>.onrender.com
EVENT=$(curl -s -X POST $URL/gradio_api/call/predict -H "Content-Type: application/json" \
  -d "{\"data\": [\"$(base64 -i examples/brick.jpg | tr -d '\n')\"]}" | python3 -c "import sys, json; print(json.load(sys.stdin)['event_id'])")
curl -s -N $URL/gradio_api/call/predict/$EVENT
```

1. `POST /gradio_api/call/predict` with `{"data": ["<base64 image>"]}` returns an `event_id`.
2. `GET /gradio_api/call/predict/<event_id>` streams `event: complete` followed by `data: [ {…result…} ]` (or `event: error` with a message).

## Run it locally

```bash
cd 02_model_server
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m app.main            # then open http://127.0.0.1:7860
```

The first start downloads the model (90 MB) and the gallery from Hugging Face into `models/` (git-ignored).

**Tests:**

```bash
pip install pytest
python -m pytest -q                                              # loads the real model, no server needed
MODEL_URL=https://<service-name>.onrender.com python -m pytest -q   # also tests the live server
```

## Put it online (Render, free)

1. On [render.com](https://render.com), sign in with GitHub and choose **New → Blueprint**.
2. Select the repository `iaac-maai/hackathon-team7-MINC_2500_material_patches`. Set the **Blueprint path** to `02_model_server/render.yaml`.
3. Render creates the free web service `team7-material-finder`:
   - root directory: `02_model_server`
   - build command: `pip install -r requirements.txt`
   - start command: `python -m app.main`
4. Wait for the build and the first start (a few minutes). The server answers at `https://team7-material-finder.onrender.com` (or the name Render shows).

**Without the Blueprint:** New → Web Service → the repository → Language *Python 3*, Root Directory `02_model_server`, the build and start commands above, Instance type *Free*.

## Measured locally (M-series Mac, 1 thread)

| | |
|---|---|
| Memory after start-up | about 360 MB (Render free: 512 MB) |
| Memory after requests | about 375 MB |
| Time per photo | 0.27 s. Render's free CPU is much slower: expect a few seconds |
| Start-up | about 3 s once the model is downloaded; the first start on Render also downloads 90 MB |

## Files

| File | Contents |
|---|---|
| `app/main.py` | Starts the server: the web page and the `/predict` API |
| `app/routes.py` | The endpoints: `predict()` for programs, `search_for_page()` for people |
| `app/model.py` | Downloads the model from Hugging Face, loads it, searches the gallery, builds the answer |
| `app/preprocess.py` | Image → numbers (base64 decoding, centre crop, 224 px) |
| `models/config.json` | Settings, classes, threshold and results (the server downloads the same file from Hugging Face) |
| `tests/test_predict.py` | Does `/predict` work? |
| `examples/` | 4 test photos from MINC-2500 (CC BY 4.0, Bell et al. 2015) |
| `requirements.txt`, `.python-version`, `render.yaml` | What Render needs to build and start the server |

## Limitations

- Trained on MINC-2500 patches, not phone photos. Real photos (other cameras, lighting, wide shots) may give worse results. Not tested on our own photos yet.
- One label per patch: a "wrong" match often shows the right material elsewhere in the picture.
- Metal (first guess right 46% of the time) and wood (61%) are the weakest; brick, carpet and stone the strongest.
- About 375 MB of the free server's 512 MB is used. Very large uploads are refused (10 MB limit).
