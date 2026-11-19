# Material Finder · Team 7

**Find a building material from a photo.** Upload a photo of a surface; an autoencoder on top of DINOv2 finds the
material, five clean CC0 swatches and five similar real photos, and you save the best to a mood board.

**Team:** Ugo, Alvaro, Sneha · **Course:** AI Methods I hackathon, IAAC, 16–20 November 2026
**Topic:** building materials in photos (MINC-2500, 13 building materials)

## Links

| | |
|---|---|
| **App** (password protected) | https://team7-material-finder.pages.dev |
| **Model server** (Render) | https://team7-material-finder.onrender.com |
| **Model** (Hugging Face) | https://huggingface.co/iaac-maai/hackathon-team7-material-finder-ae |
| **Final description, diagrams, three statements** | [`04_final/README.md`](04_final/README.md) |
| **Proofs** | [`04_final/PROOFS.md`](04_final/PROOFS.md) |

The app password is in the course hand-in, not in this repository. The model server sleeps after 15 minutes without
use and needs about a minute to wake up.

## The week, one folder per day

| Folder | Day | What it holds |
|---|---|---|
| [`01_autoencoder/`](01_autoencoder) | Monday | dataset, notebooks, setups compared, ONNX model, model card, slides |
| [`02_model_server/`](02_model_server) | Tuesday | Gradio + ONNX Runtime server on Render, API example, `call_api.ipynb` |
| [`03_app/`](03_app) | Wednesday | the Cloudflare app (Pages, Functions, D1, R2), user stories, diagrams |
| [`04_final/`](04_final) | Thursday | final README, system / user-flow / sequence diagrams, three statements, proofs |

Code: MIT ([`LICENSE`](LICENSE)). Data: MINC-2500, CC BY 4.0 (Bell et al., 2015). Swatches: CC0 (ambientCG, Poly Haven).

## AI usage disclosure

<!-- ⚠️ TEAM: this is a DRAFT. It is graded and must be honest for all three of you. Ugo and Alvaro: add your own tools
     and how you used them. Everyone: check every line, change what is wrong, then delete this comment. -->

| | |
|---|---|
| **Tools** | Claude Code (agent, in the Claude desktop app). _(Ugo, Alvaro: add yours, or "none".)_ |
| **Why** | To move faster on code we had not written before (ONNX export, Gradio, Cloudflare Functions, D1/R2), to run many controlled experiments in a short week, and to check our work (tests, secret scan, diagrams against code). |
| **Where** | **Monday:** notebook structure, ONNX export, model card. **Round 1 and 2 / v2 / v3:** the improvement experiments (ResNet-18 and DINOv2 features, centre crop, supervised contrastive loss), their notebooks and figures. **Tuesday:** the model server, its tests, the API notebook. **Wednesday:** the Cloudflare app, the user stories and diagrams (PNG) from our answers, the deployment. **Thursday:** name login and admin dashboard, the final diagrams, `PROOFS.md`, these READMEs, a thesis-style report. |
| **How** | We described the goal and the user, answered the agent's questions (user, story, style), and asked for one working step at a time. We ran every notebook ourselves and checked the numbers against the outputs. We typed all passwords and tokens ourselves in the terminal; the agent never saw them. _(Team: add what you accepted, changed or rejected, e.g. a design you changed, a claim you removed, an experiment you chose.)_ |

**Lessons learned:** _(team to write: what worked, what did not, what you would do differently. Some starting points to
confirm or replace: a fixed split, seed and metric made it easy to judge each AI-suggested change; the agent produced a
lot quickly, so reading and running everything took real time; a merge conflict in the Monday notebook went unnoticed
for days.)_

**We can explain every part.** The three statements in [`04_final/README.md`](04_final/README.md) are written by the team.
