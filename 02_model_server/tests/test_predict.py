"""Does /predict work?

Local checks (load the real model, no server needed):
    cd 02_model_server && pip install pytest && python -m pytest -q

Also check the live server on Render (wakes it up first, can take a minute):
    MODEL_URL=https://<service-name>.onrender.com python -m pytest -q
"""
import base64
import os
from pathlib import Path

import gradio as gr
import pytest
from PIL import Image

from app.preprocess import preprocess
from app.routes import finder, predict, similar

EXAMPLES = Path(__file__).resolve().parent.parent / "examples"
CLASSES = set(finder.config["classes"])


def b64(path):
    return base64.b64encode(path.read_bytes()).decode()


def check_answer(result):
    assert result["material_guess"] in CLASSES
    assert 1 <= len(result["materials"]) <= 3
    assert result["materials"][0]["name"] == result["material_guess"]
    assert sum(m["share"] for m in result["materials"]) <= 1.0 + 1e-6
    assert len(result["matches"]) == 5
    distances = [m["distance"] for m in result["matches"]]
    assert distances == sorted(distances)
    assert all(m["thumb_url"].startswith("https://huggingface.co/") for m in result["matches"])
    assert isinstance(result["is_unusual"], bool)
    assert len(result["code"]) == 32 and abs(sum(x * x for x in result["code"]) - 1) < 1e-2   # length-1 code
    assert len(result["swatches"]) == 5
    assert all(s["source"] == "swatch" and s["sphere_url"].startswith("https://") for s in result["swatches"])
    swatch_distances = [s["distance"] for s in result["swatches"]]
    assert swatch_distances == sorted(swatch_distances)


def test_preprocess_shape_and_range():
    wide_photo = Image.new("RGB", (1200, 800), (120, 80, 40))
    x = preprocess(wide_photo)
    assert x.shape == (1, 3, 224, 224) and x.dtype.name == "float32"
    assert 0.0 <= x.min() and x.max() <= 1.0


@pytest.mark.parametrize("name", ["brick", "carpet", "tile", "wood"])
def test_predict_examples(name):
    check_answer(predict(b64(EXAMPLES / f"{name}.jpg")))


def test_known_answers():
    # From the model card / export notebook: these example photos are recognised first
    assert predict(b64(EXAMPLES / "brick.jpg"))["material_guess"] == "brick"
    assert predict(b64(EXAMPLES / "tile.jpg"))["material_guess"] == "tile"


def test_data_url_prefix_is_accepted():
    result = predict("data:image/jpeg;base64," + b64(EXAMPLES / "carpet.jpg"))
    check_answer(result)


@pytest.mark.parametrize("bad", ["", "not base64 at all!!", base64.b64encode(b"hello").decode()])
def test_bad_input_gives_clear_error(bad):
    with pytest.raises(gr.Error):
        predict(bad)


@pytest.mark.parametrize("source", ["photo", "swatch"])
def test_similar_from_a_gallery_item(source):
    item_id = finder.meta[source][7]["id"]
    result = similar(source, item_id, 6)
    assert result["item"]["id"] == item_id
    assert len(result["photos"]) == 6 and len(result["swatches"]) == 6
    # the item itself is never returned as its own neighbour
    assert all(not (m["source"] == source and m["id"] == item_id) for m in result["photos"] + result["swatches"])


@pytest.mark.parametrize("args", [("chair", 1), ("photo", -5), ("swatch", 10**6)])
def test_similar_bad_item_gives_clear_error(args):
    with pytest.raises(gr.Error):
        similar(*args)


@pytest.mark.skipif(not os.environ.get("MODEL_URL"), reason="set MODEL_URL to test the live server")
def test_live_server():
    from gradio_client import Client
    client = Client(os.environ["MODEL_URL"].rstrip("/"))
    check_answer(client.predict(b64(EXAMPLES / "brick.jpg"), api_name="/predict"))
    assert len(client.predict("swatch", 0, 4, api_name="/similar")["swatches"]) == 4
