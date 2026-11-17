"""Image -> numbers. The SAME steps as in training (01_autoencoder/notebook/export_material_finder.ipynb)."""
import base64
import binascii
import io

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

IMAGE_SIZE = 224
CENTRE_FRACTION = 0.5        # keep the middle half: MINC labels describe the centre of a patch
MAX_BYTES = 10 * 1024 * 1024  # refuse uploads over 10 MB


class BadImage(ValueError):
    """The upload is not an image we can read."""


def decode_base64(image_b64: str) -> Image.Image:
    # base64 text (a "data:image/...;base64," prefix is allowed) -> PIL image
    if not isinstance(image_b64, str) or not image_b64.strip():
        raise BadImage("Send a base64-encoded JPEG or PNG.")
    if "," in image_b64[:100]:
        image_b64 = image_b64.split(",", 1)[1]
    try:
        raw = base64.b64decode(image_b64, validate=False)
    except (binascii.Error, ValueError) as error:
        raise BadImage("The text is not valid base64.") from error
    if len(raw) > MAX_BYTES:
        raise BadImage("The image is larger than 10 MB.")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except (UnidentifiedImageError, OSError) as error:
        raise BadImage("The data is not an image (use JPEG or PNG).") from error
    return image


def preprocess(image: Image.Image) -> np.ndarray:
    """RGB -> centre square -> its middle half -> 224 x 224 -> 0-1 -> float32 (1, 3, 224, 224).

    ImageNet normalisation happens inside the ONNX file.
    """
    image = ImageOps.exif_transpose(image)          # phone photos: apply the camera's rotation
    image = image.convert("RGB")
    w, h = image.size
    side = min(w, h)
    left, top = (w - side) // 2, (h - side) // 2
    image = image.crop((left, top, left + side, top + side))
    half = int(side * CENTRE_FRACTION)
    off = (side - half) // 2
    image = image.crop((off, off, off + half, off + half)).resize((IMAGE_SIZE, IMAGE_SIZE), Image.BILINEAR)
    x = np.asarray(image, dtype=np.float32) / 255.0
    return x.transpose(2, 0, 1)[None]
