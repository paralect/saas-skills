"""
Cut a render into logo files ready to drop into a site.

    cut.py render.png out/ --name relay

Writes, next to nothing else:
  out/relay-mark.png  the mark alone: transparent background, trimmed to its
                      edges, no tile, no padding
  out/relay-tile.png  the app-icon tile: transparent outside the rounded
                      square, trimmed to the tile

The render is the model's canvas: a flat grey field, one tile on it, the mark
on the tile. The canvas colour is read from the corners, the tile colour from
a band just inside the tile's edge, and every pixel is unmixed from those, so
anti-aliased edges keep their softness without a halo. A render with no tile
(a mark straight on the canvas) gives the mark file only.
"""
import argparse
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw


def dominant(pixels: np.ndarray) -> np.ndarray:
    """The most common colour in a pixel list, on a coarse grid, then refined."""
    q = (pixels // 8).astype(np.int64)
    keys = q[:, 0] * 4096 + q[:, 1] * 64 + q[:, 2]
    values, counts = np.unique(keys, return_counts=True)
    top = values[np.argmax(counts)]
    chosen = pixels[keys == top]
    return np.median(chosen, axis=0)


def distance(rgb: np.ndarray, colour: np.ndarray) -> np.ndarray:
    return np.max(np.abs(rgb.astype(np.int16) - colour.astype(np.int16)), axis=-1)


def bbox(mask: np.ndarray):
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if rows.size == 0 or cols.size == 0:
        return None
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def mark_colours(rgb: np.ndarray, colour: np.ndarray, lo=10, share=0.02) -> list[np.ndarray]:
    """The colours the mark is drawn in: each one at least `share` of the pixels."""
    pixels = rgb.reshape(-1, 3)
    away = pixels[distance(pixels, colour) > lo]
    if away.size == 0:
        return []
    q = (away // 16).astype(np.int64)
    keys = q[:, 0] * 256 + q[:, 1] * 16 + q[:, 2]
    values, counts = np.unique(keys, return_counts=True)
    return [
        np.median(away[keys == value], axis=0)
        for value, count in zip(values, counts)
        if count >= share * pixels.shape[0]
    ]


def key_out(rgb: np.ndarray, colour: np.ndarray, lo=10) -> np.ndarray:
    """
    RGBA with `colour` made transparent, edge pixels unmixed from it. A pixel
    is fully opaque once it is as far from `colour` as the nearest of the
    mark's own colours, so a half-blended edge comes out half transparent in
    the mark's colour rather than opaque in the blend.
    """
    d = distance(rgb, colour).astype(np.float32)
    colours = mark_colours(rgb, colour, lo)
    hi = min((float(distance(c[None], colour)[0]) for c in colours), default=40.0)
    hi = max(hi * 0.92, lo + 10)
    alpha = np.clip((d - lo) / (hi - lo), 0, 1)
    a = alpha[..., None]
    unmixed = np.where(
        a > 0,
        (rgb.astype(np.float32) - (1 - a) * colour.astype(np.float32)) / np.maximum(a, 1e-6),
        rgb,
    )
    out = np.zeros((*rgb.shape[:2], 4), np.uint8)
    out[..., :3] = np.clip(unmixed, 0, 255)
    out[..., 3] = np.round(alpha * 255)
    return out


def rounded_mask(size: int, radius_ratio=0.22, scale=4) -> np.ndarray:
    """An anti-aliased iOS-style rounded square, as an alpha plane 0..255."""
    big = size * scale
    im = Image.new("L", (big, big), 0)
    ImageDraw.Draw(im).rounded_rectangle(
        (0, 0, big - 1, big - 1), radius=int(big * radius_ratio), fill=255
    )
    return np.array(im.resize((size, size), Image.LANCZOS))


def trim(rgba: np.ndarray) -> np.ndarray:
    box = bbox(rgba[..., 3] >= 128)
    if box is None:
        raise SystemExit("nothing found to cut out")
    x0, y0, x1, y1 = box
    return rgba[y0:y1, x0:x1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("render")
    ap.add_argument("out", nargs="?", help="folder; defaults to out/saas-logo/<name>")
    ap.add_argument("--name", default=None, help="file prefix; defaults to the render's name")
    args = ap.parse_args()
    render = pathlib.Path(args.render)
    name = args.name or render.stem
    out = pathlib.Path(args.out or f"out/saas-logo/{name}")
    out.mkdir(parents=True, exist_ok=True)

    rgb = np.array(Image.open(render).convert("RGB"))
    h, w = rgb.shape[:2]
    patch = max(4, min(h, w) // 64)
    corners = np.concatenate(
        [rgb[:patch, :patch], rgb[:patch, -patch:], rgb[-patch:, :patch], rgb[-patch:, -patch:]]
    ).reshape(-1, 3)
    canvas = dominant(corners)

    # The tile: everything that isn't canvas, boxed.
    box = bbox(distance(rgb, canvas) > 10)
    if box is None:
        raise SystemExit("the render is one flat colour")
    x0, y0, x1, y1 = box
    side = min(x1 - x0, y1 - y0)
    squarish = abs((x1 - x0) - (y1 - y0)) <= side * 0.06

    # The tile colour: a band just inside the tile's edge, where no mark is.
    tile = None
    if squarish:
        inset, band = int(side * 0.07), int(side * 0.03)
        region = rgb[y0:y1, x0:x1]
        ring = np.concatenate([
            region[inset:inset + band, inset:-inset].reshape(-1, 3),
            region[-inset - band:-inset, inset:-inset].reshape(-1, 3),
            region[inset:-inset, inset:inset + band].reshape(-1, 3),
            region[inset:-inset, -inset - band:-inset].reshape(-1, 3),
        ])
        candidate = dominant(ring)
        # A band that is mostly one colour is a tile; a mark with no tile
        # puts many colours in it, or the canvas itself.
        share = np.mean(distance(ring, candidate) <= 10)
        if share > 0.9 and distance(candidate[None], canvas)[0] > 10:
            tile = candidate

    if tile is None:
        mark = trim(key_out(rgb, canvas))
        Image.fromarray(mark).save(out / f"{name}-mark.png")
        print(f"{name}: no tile found; mark {mark.shape[1]}x{mark.shape[0]} → {out / f'{name}-mark.png'}")
        return

    # Square the box up on the tile's centre, then cut the corners.
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    x0, y0 = int(round(cx - side / 2)), int(round(cy - side / 2))
    region = rgb[y0:y0 + side, x0:x0 + side]

    # The tile's outermost pixels are the render's blend of tile and canvas, and would
    # show as a light rim on a dark page. In a thin ring at the edge they are unmixed
    # from the canvas colour; inside the ring the tile is opaque, so a mark close to
    # the canvas colour (white on white) is left alone.
    edge = max(1, round(side * 0.004))
    ring = max(3, round(side * 0.02))
    outer = np.zeros((side, side), np.uint16)
    outer[edge:-edge, edge:-edge] = rounded_mask(side - 2 * edge)
    inner = np.zeros((side, side), np.uint16)
    inner[ring:-ring, ring:-ring] = rounded_mask(side - 2 * ring)
    if distance(tile[None], canvas)[0] < 40:
        # A white tile on the light canvas: its rim is the tile's own colour give or
        # take, and keying it would only make the edge ragged.
        tile_png = np.dstack([region, outer.astype(np.uint8)])
    else:
        keyed = key_out(region, canvas)
        tile_alpha = np.maximum(inner, keyed[..., 3].astype(np.uint16) * outer // 255)
        tile_png = np.dstack([np.where(inner[..., None] > 0, region, keyed[..., :3]), tile_alpha.astype(np.uint8)])
    Image.fromarray(tile_png.astype(np.uint8)).save(out / f"{name}-tile.png")

    # The tile's own edge blends into the canvas and would read as mark, so
    # the mark is keyed inside a tile shrunk by a hair.
    pad = max(2, int(side * 0.015))
    inner = np.zeros((side, side), np.uint8)
    inner[pad:-pad, pad:-pad] = rounded_mask(side - 2 * pad)
    mark = key_out(region, tile)
    mark[..., 3] = (mark[..., 3].astype(np.uint16) * inner // 255).astype(np.uint8)
    mark = trim(mark)
    Image.fromarray(mark).save(out / f"{name}-mark.png")

    print(
        f"{name}: canvas #{''.join(f'{int(v):02x}' for v in canvas)}, "
        f"tile #{''.join(f'{int(v):02x}' for v in tile)} {side}px, "
        f"mark {mark.shape[1]}x{mark.shape[0]} → {out}/{name}-mark.png, {name}-tile.png"
    )


if __name__ == "__main__":
    sys.exit(main())
