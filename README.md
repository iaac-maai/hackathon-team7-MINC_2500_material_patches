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


| | |
|---|---|
| **Tools** | Claude Code and ChatGPT |
| **Why** | We used AI to accelerate development in areas where we had limited experience or had not written the code before. It was useful when trying out new ideas, solving technical problems, running experiments and checking our code. This included ONNX export, Gradio, Cloudflare Functions, and D1/R2 integration |
| **Where** | **Monday:** notebook structure, ONNX export, model card. The improvement experiments (ResNet-18 and DINOv2 features, centre crop, supervised contrastive loss), their notebooks and figures. **Tuesday:** While working on the model server, tests, API notebook and Cloudflare application. **Wednesday:** To organise the user stories, diagrams and application design. **Thursday:** When working on the login system, admin dashboard, final diagrams, `PROOFS.md`, README files and final report |
| **How** | We provided the AI agent with our goals, user requirements, preferred style, and technical questions. We asked for one working step at a time, then reviewed and tested the suggested changes ourselves. We checked notebook outputs, verified experimental results, and ran tests to confirm that the implementation worked. We manually entered all passwords and tokens in the terminal; the AI agent never had access to them. We also reviewed and modified AI-generated content rather than accepting everything automatically |

**Lessons learned:** | AI helped us work faster, explore unfamiliar technologies, and generate ideas during development. However, its suggestions were not always correct and required careful verification. Running experiments and reviewing outputs took additional time, so we learned that generating code quickly does not necessarily mean completing work quickly. We also experienced a merge conflict in the Monday notebook that went unnoticed, teaching us the importance of reviewing changes and checking the final version of shared files. Overall, AI was most useful as a development assistant, but the final decisions, testing, and responsibility remained with the team. |

**We can explain every part.** The three statements in [`04_final/README.md`](04_final/README.md) are written by the team.
