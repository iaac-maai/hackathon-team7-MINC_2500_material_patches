# 03_app · Material Finder website (Cloudflare Pages)

A password-protected gallery of building materials, with photo search by our model.

| Page | What it does |
|---|---|
| `/` Home | A ring of samples (2 per material) that keeps turning. Scroll, drag or click one to bring it to the front, click the front one to open it. Views: Flat, Tilt, Ring, Gallery. Below: one card per material |
| `/browse` | Every sample (3,900 MINC photos + 1,280 CC0 swatches) on an endless canvas: drag, scroll or use the arrow keys in any direction. Floating filters for material, source, colour and search |
| `/upload` | Drop, choose or paste a photo: ranked materials, 5 clean swatches first, then 5 similar photos |
| `/boards` | Named mood boards: save any swatch, photo or upload from its bookmark button |
| `/history` | The team's last 30 searches |

Click any card for the pin view: a big image, details, the CC0 credit, **Save**, and **More like this**
(the 12 nearest swatches and photos by the model, via the server's `/similar` API).

## How it fits together

```
browser ──> Cloudflare Pages (public/ + functions/)
              ├─ D1  (searches, boards, board_items)      schema.sql
              ├─ R2  (uploaded photos)
              └─ Render model server  /predict  /similar   (02_model_server)
images  <── Hugging Face, pinned revision                  (gallery_thumbs/, swatch_thumbs/, swatch_spheres/)
```

`public/data/catalog.json` lists every item (no images inside). Rebuild it whenever the
model folder or the server's `HF_REVISION` changes:

```bash
.venv/bin/python 03_app/scripts/build_catalog.py
```

## Run it locally

```bash
cd 03_app
npm install
npm run db:local
```

Make `03_app/.dev.vars` (never commit it):

```
APP_PASSWORD=choose-a-password
# optional: use a local model server (cd 02_model_server && python -m app.main)
MODEL_URL=http://127.0.0.1:7860
```

```bash
npm run dev
```

Then open http://localhost:8788.

## Put it online (once, with your Cloudflare account)

```bash
npx wrangler login
npx wrangler d1 create team7-material-finder-db       # paste the id into wrangler.toml
npx wrangler r2 bucket create team7-material-finder-images
npm run db:remote
npx wrangler pages project create team7-material-finder --production-branch main
npx wrangler pages secret put APP_PASSWORD --project-name team7-material-finder
npm run deploy
```

## Credits

Swatches: CC0 materials from [ambientCG](https://ambientcg.com) and [Poly Haven](https://polyhaven.com),
listed by [MatSynth](https://huggingface.co/datasets/gvecchio/MatSynth). Photos: MINC-2500 (Bell et al., 2015), for research use.
