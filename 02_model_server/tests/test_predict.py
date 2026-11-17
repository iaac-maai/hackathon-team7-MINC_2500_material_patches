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
from app.routes import finder, predict

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


@pytest.mark.skipif(not os.environ.get("MODEL_URL"), reason="set MODEL_URL to test the live server")
def test_live_server():
    from gradio_client import Client
    client = Client(os.environ["MODEL_URL"].rstrip("/"))
    check_answer(client.predict(b64(EXAMPLES / "brick.jpg"), api_name="/predict"))
