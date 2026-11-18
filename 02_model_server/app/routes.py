"""The endpoints: functions for programs (the /predict and /similar APIs) and for people (the web page)."""
import gradio as gr

from app.model import MaterialFinder
from app.preprocess import BadImage, decode_base64

finder = MaterialFinder()   # downloads and loads the model once, when the server starts


# ---- For programs: used by the Cloudflare app ---------------------------------
def predict(image_b64: str) -> dict:
    """Find similar material photos and clean swatches for one photo.

    Send a base64-encoded JPEG or PNG (a 'data:image/...;base64,' prefix is allowed).
    Returns the ranked materials, 5 similar photos, 5 clean swatches (with image URLs)
    and the unusual-photo score.
    """
    try:
        image = decode_base64(image_b64)
    except BadImage as error:
        raise gr.Error(str(error))
    return finder.predict(image)


def similar(source: str, item_id: float, k: float = 12) -> dict:
    """Find the photos and swatches most similar to one gallery item.

    source: 'photo' (a MINC gallery patch, id = its training-set id) or 'swatch' (id = swatch id).
    k: how many of each to return (1-40). No image upload: the item's stored code is used.
    """
    try:
        return finder.similar(str(source), int(item_id), int(k))
    except (KeyError, ValueError, TypeError) as error:
        raise gr.Error(str(error))


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
    swatches = [(m["thumb_url"], f"{m['name']} · {m['material']}") for m in result["swatches"]]
    photos = [(m["thumb_url"], f"{m['rank']}. {m['material']} ({m['distance']:.2f})") for m in result["matches"]]
    return answer_text(result), swatches, photos, result
