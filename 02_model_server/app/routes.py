"""The endpoints: one function for people (the web page) and one for programs (the /predict API)."""
import gradio as gr

from app.model import MaterialFinder
from app.preprocess import BadImage, decode_base64

finder = MaterialFinder()   # downloads and loads the model once, when the server starts


# ---- For programs: base64 image in, JSON out (used by the Cloudflare app) -----
def predict(image_b64: str) -> dict:
    """Find the 5 most similar material patches for one photo.

    Send a base64-encoded JPEG or PNG (a 'data:image/...;base64,' prefix is allowed).
    Returns the ranked materials, the 5 matches (with thumbnail URLs) and the unusual-photo score.
    """
    try:
        image = decode_base64(image_b64)
    except BadImage as error:
        raise gr.Error(str(error))
    return finder.predict(image)


# ---- For people: the web page ------------------------------------------------
def answer_text(result: dict) -> str:
    parts = " · ".join(f"**{m['name']}** {m['share']:.0%}" for m in result["materials"])
    text = f"### {parts}"
    if result["is_unusual"]:
        text += ("\n\n⚠️ This photo does not look like a building material. "
                 "The matches may not mean much.")
    if result["confidence"] <= 0.4:
        text += "\n\nNot sure: the matches disagree. Try a closer photo of just the surface."
    return text


def search_for_page(image):
    if image is None:
        raise gr.Error("Upload a photo first.")
    result = finder.predict(image)
    gallery = [(m["thumb_url"], f"{m['rank']}. {m['material']} ({m['distance']:.2f})") for m in result["matches"]]
    return answer_text(result), gallery, result
