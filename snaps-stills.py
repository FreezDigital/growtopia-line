#!/usr/bin/env python3
"""Snaps Line stills -> img/snaps-*.webp (and img/snaps-og.jpg).

Prefers the final stills the Pulsar build writes to /root/pulsar/out/stills/
(hero.png, comp-01..11.png, iso-fill.png, iso-seal.png, iso-outfeed.png, pack.png, og.png).
Any still that isn't there yet falls back to an interim crop from the shots already on disk,
so the site always builds. Run it again after the final stills land; nothing else changes.
"""
import json
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, "img")
STILLS = "/root/pulsar/out/stills"
SHOTS = "/root/pulsar/out/shots/final"
FULL = os.path.join(HERE, "interim", "full-2x.png")  # 2x light render of the assembled machine (2600x2000)

# Interim crops from FULL, as (centre x, centre y, width) in its pixels; 16:9 boxes.
COMP = {
    1: (1066, 1014, 560),   # bottom film unwinder: reel and dancer
    2: (1080, 730, 470),    # pouch die cutter
    3: (1480, 650, 600),    # top film unwinder: printed film over the idlers
    4: (1157, 754, 400),    # product filling system: manifold and nozzles
    5: (2054, 800, 560),    # pressure tank
    6: (1482, 845, 420),    # heat transfer printing unit
    7: (1944, 1050, 360),   # air supply connection
    8: (1950, 820, 400),    # dosing pump
    9: (1664, 936, 420),    # precut system
    10: (700, 640, 380),    # swinging arm control panel
    11: (1625, 1144, 1000), # conveyor with pick & place
}


def box(cx, cy, w, ratio=16 / 9, src=None):
    h = w / ratio
    x0, y0 = cx - w / 2, cy - h / 2
    if src is not None:
        x0 = max(0, min(x0, src.width - w))
        y0 = max(0, min(y0, src.height - h))
    return (round(x0), round(y0), round(x0 + w), round(y0 + h))


def save(im, name, width, q=86):
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.convert("RGB").save(os.path.join(IMG, name), quality=q)
    return im.size


def final(name):
    p = os.path.join(STILLS, name)
    return Image.open(p).convert("RGB") if os.path.exists(p) else None


def main():
    os.makedirs(IMG, exist_ok=True)
    full = Image.open(FULL).convert("RGB")
    used = {}

    # hero: the whole assembled machine
    hero = final("hero.png")
    used["hero"] = "final" if hero else "interim"
    if hero is None:
        hero = full.crop((540, 240, 2240, 1700))
    else:
        # trim the paper margin around the machine, keep a calm 4% border
        import PIL.ImageOps as _ops
        g = _ops.invert(hero.convert("L")).point(lambda v: 255 if v > 10 else 0)
        bb = g.getbbox()
        if bb:
            m = int(0.04 * hero.width)
            hero = hero.crop((max(0, bb[0] - m), max(0, bb[1] - m), min(hero.width, bb[2] + m), min(hero.height, bb[3] + m)))
    print("hero", save(hero, "snaps-hero-1600.webp", 1600), save(hero, "snaps-hero-800.webp", 800))
    # the home page's Snaps Line section and the overview's drawing section share this one (1400 wide)
    print("section", save(hero, "snaps-1400.webp", 1400))

    # og: 1200x630
    og = final("og.png")
    used["og"] = "final" if og else "interim"
    if og is None:
        og = full.crop(box(1390, 900, 1720, 1200 / 630, full))
    og = og.resize((1200, 630), Image.LANCZOS)
    og.save(os.path.join(IMG, "snaps-og.jpg"), quality=86)

    # the 11 components
    for n, (cx, cy, w) in COMP.items():
        im = final(f"comp-{n:02d}.png")
        used[f"comp-{n:02d}"] = "final" if im else "interim"
        if im is None:
            im = full.crop(box(cx, cy, w, src=full))
        save(im, f"snaps-c{n:02d}-800.webp", 800)

    # featured isolations (4:3 cards)
    iso_fallback = {
        "fill": (os.path.join(HERE, "interim", "iso-fill-2x.png"), (600, 220, 2000, 1700)),
        "outfeed": (os.path.join(HERE, "interim", "iso-outfeed-2x.png"), (728, 260, 1872, 1690)),
        "seal": (os.path.join(HERE, "interim", "iso-seal-2x.png"), (728, 325, 1872, 1638)),
    }
    for k, (path, crop) in iso_fallback.items():
        im = final(f"iso-{k}.png")
        used[f"iso-{k}"] = "final" if im else "interim"
        if im is None:
            im = Image.open(path).convert("RGB").crop(crop)
        # pad (never crop) to 4:3 with the page tone, so no part of the assembly is cut off
        bg = im.getpixel((2, 2))
        W, H = im.size
        if W / H > 4 / 3:
            nw, nh = W, round(W * 3 / 4)
        else:
            nw, nh = round(H * 4 / 3), H
        canvas = Image.new("RGB", (nw, nh), bg)
        canvas.paste(im, ((nw - W) // 2, (nh - H) // 2))
        im = canvas
        save(im, f"snaps-iso-{k}-960.webp", 960)

    # the overview's drawing section: the machine taken apart (final still if present, else the latest exploded shot)
    ex = final("exploded.png")
    used["exploded"] = "final" if ex else "interim"
    if ex is None:
        src = Image.open(os.path.join(SHOTS, "exploded-light.png")).convert("RGB")
        ex = src.crop((268, 110, 1220, 890))
    save(ex, "snaps-exploded-1400.webp", 1400)

    # the pack
    pack = final("pack.png")
    used["pack"] = "final" if pack else "interim"
    if pack is None:
        pack = full.crop((140, 240, 500, 480))
    save(pack, "snaps-pack-800.webp", 800)

    # record the real sizes so the pages get correct width/height attributes whichever stills were used
    sizes = {}
    for f in sorted(os.listdir(IMG)):
        if f.startswith("snaps-") and f.endswith(".webp"):
            with Image.open(os.path.join(IMG, f)) as im:
                sizes[f[:-5]] = im.size
    with open(os.path.join(IMG, "snaps-sizes.json"), "w") as fh:
        json.dump({"sizes": sizes, "sources": used}, fh, indent=1)
    print("sources:", ", ".join(f"{k}={v}" for k, v in used.items()))


if __name__ == "__main__":
    main()
