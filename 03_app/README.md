# 03_app · Material Finder website (Cloudflare Pages)

**Live:** https://team7-material-finder.pages.dev

A password-protected gallery of building materials, with photo search by our model. An interior designer
uploads a photo of a surface and gets back the material (for example "ceramic 60 % · tile 40 %") with
5 clean CC0 swatches and 5 similar photos, then saves the ones they like to a named mood board.
Without a photo, they can browse all 5,180 samples by material and colour and ask for "more like this".

**Log in:** open the URL and type the team password. The password is a Cloudflare secret
(`APP_PASSWORD`), checked by the server code in `functions/_middleware.js`. It is not in this repository:
we send it to the instructors with the course hand-in.

**The model may be asleep.** The model server runs on Render's free plan and sleeps after 15 minutes
without use. The Upload page pings it when it opens and shows "Model server waking up…". The first search
can take up to a minute; if it takes longer, the app says "the model is waking up, try again in a minute"
instead of showing an error.

### Cloudflare services and why

| Service | Used for | Why |
|---|---|---|
| **Pages** | the pages in `public/` | static files on a fast public URL, free |
| **Pages Functions** | the API in `functions/` (login, predict, similar, boards, history, wake) | runs next to the pages, keeps the password and the model URL on the server |
| **D1** | `searches`, `boards`, `board_items` (see `schema.sql`) | every result and every mood board stays after a reload, for the whole team |
| **R2** | the uploaded photos (`uploads/<id>`) | files are too big for a database row; served back through `/api/images/<id>` |

### Design: user stories and diagrams

Drawn before building (also on our Miro board), exported to [`diagrams/`](diagrams):

| | |
|---|---|
| [User story 1](diagrams/user_story_1.png) | upload a photo, see the material and swatches, save to a mood board |
| [User story 2](diagrams/user_story_2.png) | browse swatches by material and colour, find more like one |
| [System diagram](diagrams/system.png) | page, Pages Functions, Render model server, D1, R2, Hugging Face |
| [Sequence 1](diagrams/sequence_1_upload_save.png) | story 1, in time order |
| [Sequence 2](diagrams/sequence_2_browse_similar.png) | story 2, in time order |
| [Sequence 3](diagrams/sequence_3_wake_up.png) | what happens when the model server is asleep |

The diagrams are made from `diagrams/src/diagrams.html`; `sh diagrams/src/export.sh` rebuilds the PNGs.

### Diagrams compared with the app we built

- The app has more than the two stories: a Home page (the turning ring), a History page and log out; no diagram shows them.
- Only uploads are stored in D1. "More like this" results (story 2) are not saved, only cached for an hour, so they never appear in History.
- The function asks the model **before** it stores the photo, so a failed or sleeping model leaves nothing in R2 or D1. We only saw this order clearly when we drew sequence 1.
- The stories say "my client", but there are no user accounts: one shared password, and every board is shared by the whole team.
- The wake-up check runs on the Upload page only; on Browse, a sleeping model shows the "try again in a minute" message.

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
