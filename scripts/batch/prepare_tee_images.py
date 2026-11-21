"""Turn a batch of tee mockups into the storefront's product photos.

Usage:
  python3 scripts/batch/prepare_tee_images.py batches/<batch>.json "<unzipped batch folder>" [--only id1,id2]

For every product in the manifest it writes, into public/assets/products/:
  <id>-black.webp, <id>-black-480.webp, <id>-white.webp, <id>-white-480.webp

What it does to each mockup:
  1. Background: transparent PNGs are used as they are. Mockups on a white background
     (with or without a floor shadow) are cut out. The outline comes from the black tee,
     where the edge is unambiguous, and is reused for the white tee of the same design
     when the two line up (they come from the same template).
  2. Size: the tee is scaled and centred into the same box the existing photos use,
     on a 1122 x 1402 canvas, so every tee on the site sits at the same size.
  3. Output: WebP (quality 82) plus a 480 x 600 thumbnail, like the existing photos.
Needs Pillow and numpy (pip3 install pillow numpy).
"""
import json
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageFilter

CANVAS = (1122, 1402)
TEE_BOX = (22, 106, 1083, 1279)  # where the tee sits in the existing product photos
THUMB = (480, 600)
OUT_DIR = Path(__file__).resolve().parents[2] / "public" / "assets" / "products"


def has_transparency(im: Image.Image) -> bool:
    if im.mode != "RGBA":
        return False
    w, h = im.size
    corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]
    return all(im.getpixel(p)[3] == 0 for p in corners)


def flood(passable: bytearray, w: int, h: int, seeds: list[tuple[int, int]]) -> bytearray:
    """Marks every passable pixel reachable from the seeds (4-connected)."""
    seen = bytearray(w * h)
    queue = deque()
    for x, y in seeds:
        i = y * w + x
        if passable[i] and not seen[i]:
            seen[i] = 1
            queue.append((x, y))
    while queue:
        x, y = queue.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if passable[i] and not seen[i]:
                    seen[i] = 1
                    queue.append((nx, ny))
    return seen


def background_mask(im: Image.Image, light_threshold: int) -> Image.Image:
    """Cuts the tee out of a light background. Returns an L mask: 255 = tee, 0 = background.

    Light, low-saturation pixels reachable from the image border are background. Anything left that
    is not connected to the tee (a floor shadow under it, specks) is dropped too.
    """
    rgb = np.asarray(im.convert("RGB"), dtype=np.int32)
    h, w = rgb.shape[:2]
    luma = (rgb[..., 0] * 299 + rgb[..., 1] * 587 + rgb[..., 2] * 114) // 1000
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    is_bg_like = bytearray(((luma >= light_threshold) & (spread <= 40)).astype(np.uint8).tobytes())
    border = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    background = np.frombuffer(bytes(flood(is_bg_like, w, h, border)), dtype=np.uint8).reshape(h, w)

    not_background = background == 0
    ys, xs = np.nonzero(not_background)
    if len(xs) == 0:
        raise ValueError("no tee found")
    # Seed from the not-background pixel closest to the image centre: that is the tee.
    nearest = np.argmin((xs - w // 2) ** 2 + (ys - h // 2) ** 2)
    tee = flood(bytearray(not_background.astype(np.uint8).tobytes()), w, h, [(int(xs[nearest]), int(ys[nearest]))])
    mask = Image.fromarray((np.frombuffer(bytes(tee), dtype=np.uint8).reshape(h, w) * 255).astype(np.uint8))
    # Fill pin-holes, then soften the edge so it does not look cut out with scissors.
    mask = mask.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(5))
    return mask.filter(ImageFilter.GaussianBlur(0.8))


def overlap(a: Image.Image, b: Image.Image) -> float:
    a1 = a.point(lambda v: 255 if v > 127 else 0)
    b1 = b.point(lambda v: 255 if v > 127 else 0)
    inter = ImageChops.multiply(a1, b1).histogram()[255]
    union = ImageChops.lighter(a1, b1).histogram()[255]
    return inter / union if union else 0.0


def cut_out(black_path: Path, white_path: Path) -> tuple[Image.Image, Image.Image, str]:
    black = Image.open(black_path)
    white = Image.open(white_path)
    black = black.convert("RGBA") if black.mode in ("RGBA", "LA", "P") else black.convert("RGB")
    white = white.convert("RGBA") if white.mode in ("RGBA", "LA", "P") else white.convert("RGB")
    if has_transparency(black) and has_transparency(white):
        return black, white, "transparent"
    note = []
    if has_transparency(black):
        black_rgba = black
        tee_mask = black.getchannel("A")
    else:
        tee_mask = background_mask(black, light_threshold=150)
        black_rgba = black.convert("RGBA")
        black_rgba.putalpha(tee_mask)
        note.append("black cut out")
    if has_transparency(white):
        white_rgba = white
    else:
        # The white tee's own outline is faint, so reuse the black tee's when they line up.
        own = background_mask(white, light_threshold=246)
        if white.size == black.size and overlap(own, tee_mask) > 0.95:
            mask = tee_mask
            note.append("white uses black outline")
        else:
            mask = own
            note.append("white cut out on its own (check it)")
        white_rgba = white.convert("RGBA")
        white_rgba.putalpha(mask)
    return black_rgba, white_rgba, ", ".join(note)


def fit_to_canvas(im: Image.Image) -> Image.Image:
    bbox = im.getchannel("A").point(lambda v: 255 if v > 16 else 0).getbbox()
    if not bbox:
        raise ValueError("image is fully transparent")
    tee = im.crop(bbox)
    box_w, box_h = TEE_BOX[2] - TEE_BOX[0], TEE_BOX[3] - TEE_BOX[1]
    scale = min(box_w / tee.width, box_h / tee.height)
    tee = tee.resize((round(tee.width * scale), round(tee.height * scale)), Image.LANCZOS)
    canvas = Image.new("RGBA", CANVAS, (255, 255, 255, 0))
    x = TEE_BOX[0] + (box_w - tee.width) // 2
    y = TEE_BOX[1] + (box_h - tee.height) // 2
    canvas.alpha_composite(tee, (x, y))
    return canvas


def save(im: Image.Image, product_id: str, color: str) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im.save(OUT_DIR / f"{product_id}-{color}.webp", "WEBP", quality=82, method=6)
    im.resize(THUMB, Image.LANCZOS).save(OUT_DIR / f"{product_id}-{color}-480.webp", "WEBP", quality=80, method=6)


def main() -> None:
    manifest_path, source_root = Path(sys.argv[1]), Path(sys.argv[2])
    only = set(sys.argv[4].split(",")) if len(sys.argv) > 4 and sys.argv[3] == "--only" else None
    manifest = json.loads(manifest_path.read_text())
    for collection in manifest["collections"]:
        for product in collection["products"]:
            if only and product["id"] not in only:
                continue
            black, white, note = cut_out(source_root / product["images"]["black"], source_root / product["images"]["white"])
            save(fit_to_canvas(black), product["id"], "black")
            save(fit_to_canvas(white), product["id"], "white")
            print(f"{collection['id']:>16}  {product['id']:<40} {note}", flush=True)


if __name__ == "__main__":
    main()
