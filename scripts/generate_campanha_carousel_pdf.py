# -*- coding: utf-8 -*-
"""Recorta a colagem 3x4 da campanha Peça Já e gera PDF carrossel (1 slide por página)."""
from __future__ import annotations

import os

from PIL import Image
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

SRC = r"C:\Users\iagot\.cursor\projects\c-Users-iagot-Projects-peca-ja\assets\c__Users_iagot_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_pecaja_campanha-75c33cbe-27c6-475f-b3fe-450916caae6a.png"
OUT_DIR = r"C:\Users\iagot\Projects\peca-ja\docs\campanha_tiles"
PDF_PATH = r"C:\Users\iagot\Projects\peca-ja\docs\PECA_JA_Campanha_Carousel.pdf"


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    im = Image.open(SRC).convert("RGB")
    w, h = im.size

    # Gutters detectados: faixas claras horizontais + escuras verticais
    x_ranges = [(0, 304), (323, 610), (626, w)]
    y_ranges = [(0, 299), (305, 564), (570, 796), (801, h)]

    tiles: list[str] = []
    n = 1
    for yr in y_ranges:
        for xr in x_ranges:
            box = (xr[0], yr[0], xr[1], yr[1])
            tile = im.crop(box)
            path = os.path.join(OUT_DIR, f"slide_{n:02d}.png")
            scale = 3
            tile_hi = tile.resize(
                (tile.width * scale, tile.height * scale),
                Image.Resampling.LANCZOS,
            )
            tile_hi.save(path, optimize=True)
            tiles.append(path)
            print(n, box, tile.size)
            n += 1

    first = Image.open(tiles[0])
    tw, th = first.size
    page = landscape(A4) if tw >= th else A4
    c = canvas.Canvas(PDF_PATH, pagesize=page)
    pw, ph = page
    margin = 10

    for path in tiles:
        img = Image.open(path)
        iw, ih = img.size
        max_w, max_h = pw - 2 * margin, ph - 2 * margin
        scale = min(max_w / iw, max_h / ih)
        dw, dh = iw * scale, ih * scale
        x = (pw - dw) / 2
        y = (ph - dh) / 2
        c.setFillColorRGB(0, 0, 0)
        c.rect(0, 0, pw, ph, fill=1, stroke=0)
        c.drawImage(path, x, y, width=dw, height=dh, preserveAspectRatio=True, mask="auto")
        c.showPage()

    c.save()
    print("PDF", PDF_PATH, "pages", len(tiles))


if __name__ == "__main__":
    main()
