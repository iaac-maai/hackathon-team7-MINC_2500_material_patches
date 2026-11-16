# Team 7 · Hackathon to-do list: Material Finder (MINC-2500)

**Team:** Ugo, Alvaro, Sneha
**Week:** Mon 16 – Fri 20 Nov 2026, 10:00–13:00, room 303
**Rule:** each day's deadline is **10:00 the next morning**. At that time the course pins the latest commit on `main`. Anything pushed later does not count for that day.

Tick the boxes (`[x]`) as you finish things, and put your name next to a task when you take it.

---

## The idea in one paragraph

A user uploads a photo of a surface (a facade, floor or wall finish). The app returns the **5 most similar material patches**, a **material guess** ("Brick, 4 of 5 matches") and a warning if the photo **looks unusual** for a building material.

- **Who uses it:** architects and interior designers ("find me something that looks like this"), renovation teams matching an existing finish, people cataloguing reclaimed materials.
- **Main use:** similarity search in latent space. Bonus: anomaly score from the reconstruction error.

**How the pieces fit:**

```
Photo ──> Cloudflare app (password, D1, R2) ──> Render model server (ONNX encoder + gallery) ──> 5 matches + guess
                                                     ^
                                    model and gallery published on Hugging Face
```

---

## Setup (Monday, first thing)

- [ ] Send the repo URL to the course maintainers
- [ ] Check the repo name with the instructors. The brief asks for lowercase with hyphens (`hackathon-team7-<topic>`); ours has capitals and underscores
- [ ] Replace `.gitignore` with the one from the brief (section 10). The current file is the default Python one. It is **missing**: `data/*`, `*.onnx`, `*.pt`, `*.joblib`, `node_modules/`, `.wrangler/`, `.dev.vars`, `kaggle.json`, `.DS_Store`
- [ ] Make sure `LICENSE` is MIT (code). The data keeps its own licence (CC BY 4.0)
- [ ] Hugging Face: everyone has an account, is in the **iaac-maai** org, has run `hf auth login` (Day 2 brief, section 5.1)
- [ ] Everyone has a Render account and a Cloudflare account
- [ ] Choose the HF model name, e.g. `iaac-maai/hackathon-team7-material-finder-ae` (lowercase, hyphens)
- [ ] Root `README.md`: team, topic, links (fill in during the week), AI usage disclosure (section 11, graded)

## Impulse talk (choose on Monday)

One talk, 3–5 min, 3–5 slides, Google Slides shared as "anyone with the link can view". The link goes in `impulse/LINK.md`, due at the start of the class where we present. Full guide: `hackathon/docs/IMPULSE_TALKS.md`.

| Day | Topics on the board |
|---|---|
| Tue 17 · models | Latent Space · Generative AI · Anomaly Detection |
| Wed 18 · apps | App Anatomy A · App Anatomy B · Data Storage |
| Thu 19 · products | Agent Skills · Sign in with Google · Passwords · 1,000 users at once |

- [ ] Choose a topic. **Suggestion: Latent Space** ("how does find similar work?"), which is exactly what our app does. Note it is due **Tuesday 10:00**
- [ ] Slides: 1 the question, 2 the use case (pictures), 3 how it works inside (system or sequence diagram), 4 what it means for us, 5 one question for the class
- [ ] Add `impulse/LINK.md`

---

## Monday 16 · `01_autoencoder/` (due Tue 10:00)

### Data
- [ ] Download `mcimpoi/minc-2500_split_1` from Hugging Face (2.35 GB) into a git-ignored `data/` folder **outside iCloud/OneDrive**
- [ ] Check the label names in `ds.features`. Don't assume the class numbers
- [ ] Keep the 13 building-material classes: brick, carpet, ceramic, glass, metal, mirror, painted, plastic, polished stone, stone, tile, wallpaper, wood (32,500 patches)
- [ ] Use the train / validation / test splits that come with the dataset. Fix the seed
- [ ] Preprocessing in **one function**: RGB, resize 362 → 64 × 64, pixels 0–1. Store the images as uint8 and convert batches to float. Write the function down: the server must do exactly the same

### Training: 3 setups, same split and seed
- [ ] Dense AE, latent 64 (baseline)
- [ ] Conv AE, latent 32
- [ ] Conv AE, latent 128
- [ ] **One table**: parameters, training time, validation MSE, test MSE, **precision@5**
  - precision@5 = for each test patch, find its 5 nearest training patches in latent space and count how many share its material. Random guessing would be about 8% (1/13)
- [ ] Written conclusion (not only numbers). Expect: grouping by colour and brightness; wood and brick work well; glass, mirror and metal get mixed up

### Figures (save in `figures/`)
- [ ] Training curves (training and validation loss go down)
- [ ] Reconstructions (input vs output)
- [ ] **Proof figure: similarity row.** A query patch plus its 5 nearest neighbours, for 4–5 materials
- [ ] UMAP of the latent space coloured by material (nice to have)

### Export (`model_app/`)
- [ ] `encoder.onnx` (image → latent vector), plus the full AE ONNX if we use the unusual score
- [ ] ONNX check: same outputs as PyTorch
- [ ] `gallery_latents.npy`: latent vectors of about 5,000 training patches (about 385 per class)
- [ ] `gallery_meta.json`: id and material for each gallery item
- [ ] `gallery_thumbs/`: 64 px JPEG thumbnails of the gallery (about 10 MB)
- [ ] `config.json`: image size, preprocessing, latent size, class list, unusual-score threshold (95th percentile of validation error)
- [ ] A few example photos (`examples/`)

### Hugging Face
- [ ] `hf repos create iaac-maai/hackathon-team7-...-ae --type model`
- [ ] `hf upload` from `01_autoencoder/` (the `models/` folder)
- [ ] Model card `models/README.md`: what it does, dataset (source, size, CC BY 4.0, cite Bell et al. 2015 CVPR), architecture, latent size, preprocessing, the setups table, training and reconstruction figures, where it fails, a "How to use" snippet, link to GitHub
- [ ] Open the HF page and check the figures render
- [ ] **Never** commit the token, `*.onnx` or `*.pt` to GitHub

### Docs and slides
- [ ] `01_autoencoder/README.md`: use case, dataset, how to run, table, 2+ figures, HF link, limitations
- [ ] `requirements.txt` with pinned versions
- [ ] Notebook runs top to bottom and is committed **with outputs**
- [ ] 3 slides (PDF in `slides/` or a link): (1) dataset + table, (2) the figure + what we see, (3) the app idea: who uses it, what they upload, what the model answers
- [ ] Push to `main` before **Tue 10:00**. **Don't** create `02_model_server/` yet

---

## Tuesday 17 · `02_model_server/` (due Wed 10:00)

Start from the class example `hackathon/docs/model_app/` (Gradio + ONNX Runtime on Render).

- [ ] `app.py` loads the encoder, gallery and config (from HF or from the folder)
- [ ] Same preprocessing as Monday, plus a **centre crop to a square** (user photos are wider than the patches)
- [ ] `predict(image_b64)` returns JSON:
  ```json
  {
    "material_guess": "brick", "confidence": 0.8,
    "matches": [{"id": 1234, "material": "brick", "distance": 0.41, "thumb_png_base64": "..."}],
    "unusual_score": 0.012, "threshold": 0.020, "is_unusual": false
  }
  ```
  - nearest neighbours: plain NumPy distances to the 5,000 gallery vectors, top 5
  - material guess: majority vote of the 5; confidence = votes / 5
- [ ] A Gradio page for people: upload, guess, 5 thumbnails
- [ ] `requirements.txt` pinned (start from `gradio==6.32.0`, `onnxruntime==1.31.1`), `render.yaml`
- [ ] Deployed on Render at a public URL
- [ ] **Test with our own phone photos.** If the results are bad, tell users to photograph close-ups
- [ ] `README.md`: public URL, input/output, an API example a stranger can copy, a note that the free server sleeps after 15 min (about 1 min to wake up)
- [ ] `call_api.ipynb` calls the API and prints the result (committed with outputs)
- [ ] Push before **Wed 10:00**

> If the model is not ready by Tue 10:00: deploy the class example model, say so in the README, and swap ours in later.

---

## Wednesday 18 · `03_app/` (due Thu 10:00)

Start from the class example `hackathon/docs/cloudflare_app/` (Pages + Functions + D1 + R2).

- [ ] Login page; the password is a Cloudflare **secret** (`.dev.vars` locally, never committed)
- [ ] Search page: upload a photo, press *Find similar*
- [ ] `functions/api/predict.js`: send the image to Render, store the photo in **R2**, store a row in **D1**, return the result
- [ ] Result view: the user's photo, a big material guess, a row of 5 thumbnails with distances, a warning if unusual
- [ ] History page (`history.js`): past searches from D1, images from R2
- [ ] D1 schema:
  ```sql
  CREATE TABLE searches (
    id TEXT PRIMARY KEY, created_at TEXT NOT NULL,
    image_key TEXT NOT NULL,          -- photo in R2
    material_guess TEXT, confidence REAL,
    unusual_score REAL, is_unusual INTEGER,
    matches_json TEXT                 -- the 5 match ids, materials and distances
  );
  ```
- [ ] `wrangler.toml`: `MODEL_URL` (no slash at the end), D1 and R2 bindings, **no** password
- [ ] Friendly message when Render is asleep ("waking up, try again in a minute")
- [ ] `diagrams/sequence.png`: user → page → function → model server → R2 → D1 → back
- [ ] `README.md`: public URL, how to log in (the password goes in the course hand-in, **not** in the repo), what the app does, which Cloudflare services we use and why
- [ ] Push before **Thu 10:00**

---

## Thursday 19 · `04_final/` (due Fri 10:00, SUBMISSION FREEZE)

**No new features we can't finish.** Small and working beats big and broken.

- [ ] Final app is live and uses **our** model and **our** server, end to end
- [ ] Nice extra, only if there's time: a ★ "mood board" (save matches to a second D1 table)
- [ ] `diagrams/system.png`: Hugging Face, Render, Cloudflare Pages, Functions, D1, R2
- [ ] `diagrams/user_flow.png`: login → upload → result → history
- [ ] `diagrams/sequence.png`: one request
- [ ] Three statements, **written by us**: what is clear / what is still unclear / what we would do next
- [ ] Final README: use case, live URLs (app, server, model), diagrams, statements, limitations (colour bias, reflective materials, wide photos vs close-ups)
- [ ] Root README links to everything, plus the **AI usage disclosure** (tools, why, where, how, lessons learned)
- [ ] No secrets, data or model files in the repo
- [ ] Push before **Fri 10:00**

## Friday 20 · Finals

- [ ] Wake up the Render server before we present
- [ ] Test all live URLs that morning
- [ ] 5–8 min: idea and model, what we found, the 3 diagrams, the services, where data is stored, **live demo**
- [ ] Everyone can explain every part, including anything an AI tool wrote

---

## Known risks

| Risk | What we do |
|---|---|
| Matches by colour more than by material | Show it honestly as a limitation; precision@5 per class shows where it fails |
| Glass, mirror and metal confused | Expected (they reflect their surroundings); mention it in the model card |
| User photos are wide shots, the patches are close-ups | Centre crop, a "take a close-up" hint, test early with our own photos |
| Slow training on a laptop | Train on a subset first; use Colab or a GPU for the final run |
| Render cold start (about 1 min) | Error message in the app; wake the server before the demo |
| 2.35 GB download | Download once, in a git-ignored folder outside cloud sync |
