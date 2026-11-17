"""Starts the Material Finder model server (Gradio + ONNX Runtime).

Locally:   python -m app.main            (from the 02_model_server folder) -> http://127.0.0.1:7860
On Render: the same command; Render sets the PORT variable.
"""
import os
from pathlib import Path

import gradio as gr

from app.routes import finder, predict, search_for_page

EXAMPLES = sorted(str(p) for p in (Path(__file__).resolve().parent.parent / "examples").glob("*.jpg"))

with gr.Blocks(title="Material Finder · Team 7") as demo:
    gr.Markdown(
        "# Material Finder\n"
        "Upload a photo of a surface (a facade, floor or wall finish). The server finds the **5 most similar** "
        f"patches among {len(finder.gallery):,} building-material photos and ranks the materials they show.\n\n"
        "Works best on a **close-up of one surface**: only the middle of the photo is used. "
        "Model: DINOv2-small + our autoencoder, "
        "[model card on Hugging Face](https://huggingface.co/iaac-maai/hackathon-team7-material-finder-ae)."
    )
    with gr.Row():
        with gr.Column(scale=1):
            image_in = gr.Image(type="pil", label="Your photo")
            button = gr.Button("Find similar", variant="primary")
            gr.Examples(EXAMPLES, inputs=image_in)
        with gr.Column(scale=2):
            answer_out = gr.Markdown()
            gallery_out = gr.Gallery(label="5 most similar patches", columns=5, height=220)
            details_out = gr.JSON(label="API answer (what the app receives)")
    button.click(search_for_page, inputs=image_in, outputs=[answer_out, gallery_out, details_out],
                 api_visibility="private")
    gr.api(predict, api_name="predict")

if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=int(os.environ.get("PORT", 7860)))
