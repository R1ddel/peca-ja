# -*- coding: utf-8 -*-
"""PDF carrossel Peça Já com slides recriados (não recortes)."""
from __future__ import annotations

import os
import shutil

from PIL import Image
from reportlab.lib.pagesizes import landscape, A4
from reportlab.pdfgen import canvas

ASSETS = r"C:\Users\iagot\.cursor\projects\c-Users-iagot-Projects-peca-ja\assets"
OUT_DIR = r"C:\Users\iagot\Projects\peca-ja\docs\campanha_recriada"
PDF_PATH = r"C:\Users\iagot\Projects\peca-ja\docs\PECA_JA_Campanha_Carousel.pdf"

# slide 08 usa versão 08b (benefícios limpos, sem nome errado)
SLIDES = [
    "pecaja_slide_01.png",
    "pecaja_slide_02.png",
    "pecaja_slide_03.png",
    "pecaja_slide_04.png",
    "pecaja_slide_05.png",
    "pecaja_slide_06.png",
    "pecaja_slide_07.png",
    "pecaja_slide_08b.png",
    "pecaja_slide_09.png",
    "pecaja_slide_10.png",
    "pecaja_slide_11.png",
    "pecaja_slide_12.png",
]


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    paths: list[str] = []
    for i, name in enumerate(SLIDES, 1):
        src = os.path.join(ASSETS, name)
        if not os.path.isfile(src):
            raise FileNotFoundError(src)
        dst = os.path.join(OUT_DIR, f"slide_{i:02d}.png")
        # normaliza para PNG RGB alta qualidade
        im = Image.open(src).convert("RGB")
        # garante lado mínimo 1080
        w, h = im.size
        if min(w, h) < 1080:
            scale = 1080 / min(w, h)
            im = im.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
        im.save(dst, format="PNG", optimize=True)
        paths.append(dst)
        print("ok", i, im.size, dst)

    page = landscape(A4)
    c = canvas.Canvas(PDF_PATH, pagesize=page)
    pw, ph = page
    margin = 8

    for path in paths:
        img = Image.open(path)
        iw, ih = img.size
        scale = min((pw - 2 * margin) / iw, (ph - 2 * margin) / ih)
        dw, dh = iw * scale, ih * scale
        x = (pw - dw) / 2
        y = (ph - dh) / 2
        c.setFillColorRGB(0, 0, 0)
        c.rect(0, 0, pw, ph, fill=1, stroke=0)
        c.drawImage(path, x, y, width=dw, height=dh, preserveAspectRatio=True, mask="auto")
        c.showPage()

    c.save()
    print("PDF", PDF_PATH)
    print("pages", len(paths))


if __name__ == "__main__":
    main()
