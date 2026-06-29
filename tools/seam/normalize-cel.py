# tools/seam/normalize-cel.py — scale each anchor to fit a 1104x756 cream canvas, centred.
from PIL import Image
import os
SRC = "tools/figsrc/avatar-anchors/with-mat"
OUT = "tools/seam/anchors-cel"
W, H = 1104, 756
CREAM = (236, 232, 220)  # #ece8dc
os.makedirs(OUT, exist_ok=True)
for pose in ["stand", "reach", "dog", "lunge", "seated"]:
    im = Image.open(os.path.join(SRC, f"{pose}.png")).convert("RGB")
    fit = im.copy()
    fit.thumbnail((W, H), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), CREAM)
    canvas.paste(fit, ((W - fit.width) // 2, (H - fit.height) // 2))
    canvas.save(os.path.join(OUT, f"KEY-{pose}.png"))
    print(f"KEY-{pose}.png  {im.size} -> {canvas.size}")
