#!/usr/bin/env python3
# generate_colored_icons.py — Crea varianti sensitive (giallo) e profiling (rosso)
# a partire dalle icone normal/. Mantiene trasparenza alpha.

from PIL import Image
import os

SOURCE_DIR  = "icons/normal/"
OUTPUT_DIRS = {
    "sensitive": ("icons/sensitive/", (249, 168,  37)),  # Giallo #F9A825
    "profiling": ("icons/profiling/", (198,  40,  40)),  # Rosso  #C62828
}

def colorize(img_path, out_path, target_rgb):
    img = Image.open(img_path).convert("RGBA")
    r, g, b, a = img.split()
    colored = Image.merge("RGBA", (
        r.point(lambda _: target_rgb[0]),
        g.point(lambda _: target_rgb[1]),
        b.point(lambda _: target_rgb[2]),
        a,
    ))
    colored.save(out_path, "PNG", optimize=True)

for state, (out_dir, color) in OUTPUT_DIRS.items():
    os.makedirs(out_dir, exist_ok=True)
    count = 0
    for fname in sorted(os.listdir(SOURCE_DIR)):
        if fname.endswith(".png"):
            colorize(
                os.path.join(SOURCE_DIR, fname),
                os.path.join(out_dir, fname),
                color,
            )
            count += 1
    print(f"OK [{state.upper()}] generate {count} icone in {out_dir}")
