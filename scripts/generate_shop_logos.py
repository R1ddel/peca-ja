#!/usr/bin/env python3
"""Generate unique Canva-style 512x512 PNG logos for each Mucugê shop."""
from __future__ import annotations

import json
import math
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "assets" / "merchants" / "logos" / "shops"
DATA_FILES = [
    ROOT / "data" / "mucugeMerchants.ts",
    ROOT / "data" / "mucugeMerchantsExtra.ts",
]

SIZE = 512
CX = CY = SIZE // 2

# Curated professional palettes (bg, accent, text, secondary)
PALETTES = [
    ((26, 58, 82), (232, 168, 74), (255, 255, 255), (196, 214, 230)),  # navy/gold
    ((139, 42, 42), (255, 228, 196), (255, 255, 255), (180, 80, 80)),  # wine/cream
    ((34, 85, 68), (214, 232, 184), (255, 255, 255), (90, 150, 120)),  # forest
    ((45, 45, 48), (240, 200, 90), (255, 255, 255), (180, 180, 185)),  # charcoal/gold
    ((92, 48, 28), (255, 214, 160), (255, 255, 255), (160, 110, 80)),  # espresso
    ((28, 90, 120), (255, 255, 255), (20, 50, 70), (160, 210, 230)),  # teal
    ((120, 40, 70), (255, 200, 210), (255, 255, 255), (200, 120, 150)),  # berry
    ((40, 70, 40), (200, 230, 120), (255, 255, 255), (120, 160, 100)),  # olive
    ((70, 50, 110), (220, 200, 255), (255, 255, 255), (150, 130, 190)),  # plum
    ((180, 90, 40), (255, 240, 220), (60, 30, 10), (220, 150, 90)),  # terracotta
    ((20, 40, 60), (100, 180, 200), (255, 255, 255), (60, 100, 130)),  # deep ocean
    ((90, 30, 30), (240, 180, 80), (255, 255, 255), (160, 70, 70)),  # brick/amber
    ((50, 80, 100), (255, 255, 255), (30, 50, 65), (140, 180, 200)),  # slate
    ((110, 70, 40), (255, 230, 180), (50, 30, 15), (180, 130, 80)),  # caramel
    ((30, 30, 30), (230, 230, 230), (255, 255, 255), (100, 100, 100)),  # mono
    ((55, 100, 55), (255, 255, 220), (255, 255, 255), (120, 170, 120)),  # green
    ((100, 55, 90), (255, 220, 240), (255, 255, 255), (170, 120, 160)),  # mauve
    ((35, 75, 95), (255, 190, 100), (255, 255, 255), (100, 140, 160)),  # dusk
    ((75, 35, 55), (255, 210, 160), (255, 255, 255), (140, 90, 110)),  # burgundy warm
    ((25, 55, 45), (180, 220, 190), (255, 255, 255), (80, 130, 110)),  # pine
]

TEMPLATES = [
    "circular_badge",
    "rounded_square",
    "geometric_diamond",
    "monogram_banner",
    "split_circle",
    "hex_frame",
    "arc_badge",
    "stacked_block",
]

STOPWORDS = {
    "de", "da", "do", "das", "dos", "e", "a", "o", "as", "os",
    "em", "na", "no", "nas", "nos", "&", "and", "the",
}


def normalize_key(raw: str) -> str:
    s = unicodedata.normalize("NFD", raw)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


def slugify(name: str) -> str:
    s = normalize_key(name)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = re.sub(r"-+", "-", s).strip("-")
    return s or "shop"


def name_hash(name: str) -> int:
    h = 2166136261
    for ch in normalize_key(name):
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def extract_shops() -> list[dict]:
    shops: list[dict] = []
    # Top-level: "  {\n    name: '...'," blocks that also have category
    re_block = re.compile(
        r"^  \{\r?\n    name:\s*'((?:\\'|[^'])*)',\r?\n([\s\S]*?)(?=^  \{|\Z)",
        re.MULTILINE,
    )
    re_cat = re.compile(r"\bcategory:\s*'((?:\\'|[^'])*)'")
    for path in DATA_FILES:
        text = path.read_text(encoding="utf-8")
        for m in re_block.finditer(text):
            name = m.group(1).replace("\\'", "'")
            body = m.group(2)
            cm = re_cat.search(body)
            if not cm:
                continue
            shops.append({"name": name, "category": cm.group(1)})
    return shops


def shorten_display_name(name: str, max_chars: int = 22) -> str:
    if len(name) <= max_chars:
        return name
    # Prefer distinctive words (drop stopwords if needed)
    words = re.split(r"\s+", name.strip())
    keep = [w for w in words if normalize_key(w).strip("&") not in STOPWORDS]
    if not keep:
        keep = words
    # Drop common business-type prefixes when too long
    prefixes = {
        "restaurante", "pizzaria", "lanchonete", "hamburgeria",
        "sorveteria", "farmacia", "pharmácia", "padaria,",
        "padaria", "supermercado", "mercadinho", "mercado",
        "comercial", "hortifruti", "açougue", "acougue",
        "depósito", "deposito", "mini",
    }
    while len(" ".join(keep)) > max_chars and len(keep) > 1:
        first = normalize_key(keep[0]).rstrip(",")
        if first in prefixes or first.startswith("padaria"):
            keep = keep[1:]
            continue
        # drop last if still long
        if len(keep) > 2:
            keep = keep[:-1]
            continue
        break
    result = " ".join(keep)
    if len(result) > max_chars:
        # truncate mid-word carefully
        result = result[: max_chars - 1].rstrip(" -,") + "…"
    return result


def initials(name: str) -> str:
    words = [w for w in re.split(r"\s+", name.strip()) if w]
    significant = [
        w for w in words
        if normalize_key(w).strip("&.,") not in STOPWORDS and not w.startswith("&")
    ]
    if not significant:
        significant = words
    letters = []
    for w in significant[:3]:
        clean = re.sub(r"[^A-Za-zÀ-ÿ0-9]", "", w)
        if clean:
            letters.append(clean[0].upper())
    if len(letters) == 1 and len(significant[0]) >= 2:
        clean = re.sub(r"[^A-Za-zÀ-ÿ0-9]", "", significant[0])
        return (clean[:2]).upper()
    return "".join(letters[:2]) if letters else "?"


def load_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []
    windir = Path(r"C:\Windows\Fonts")
    if bold:
        candidates += [
            windir / "segoeuib.ttf",
            windir / "arialbd.ttf",
            windir / "calibrib.ttf",
            windir / "verdanab.ttf",
            windir / "tahomabd.ttf",
        ]
    candidates += [
        windir / "segoeui.ttf",
        windir / "arial.ttf",
        windir / "calibri.ttf",
        windir / "verdana.ttf",
        windir / "tahoma.ttf",
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
        Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"),
    ]
    for p in candidates:
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def fit_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    max_size: int,
    min_size: int = 18,
    bold: bool = True,
) -> tuple[ImageFont.ImageFont, str, list[str]]:
    """Return font, display text, and wrapped lines that fit."""
    display = text
    for size in range(max_size, min_size - 1, -2):
        font = load_font(size, bold=bold)
        # try single line
        bbox = draw.textbbox((0, 0), display, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font, display, [display]
        # try wrap into 2–3 lines
        words = display.split()
        if len(words) <= 1:
            continue
        for lines_n in (2, 3):
            lines = wrap_words(words, lines_n)
            ok = True
            for line in lines:
                bb = draw.textbbox((0, 0), line, font=font)
                if bb[2] - bb[0] > max_width:
                    ok = False
                    break
            if ok:
                return font, display, lines
    font = load_font(min_size, bold=bold)
    words = display.split()
    lines = wrap_words(words, 3) if len(words) > 1 else [display]
    return font, display, lines


def wrap_words(words: list[str], n_lines: int) -> list[str]:
    if n_lines <= 1 or len(words) <= 1:
        return [" ".join(words)]
    # greedy balance by char count
    total = sum(len(w) for w in words) + len(words) - 1
    target = total / n_lines
    lines: list[str] = []
    cur: list[str] = []
    cur_len = 0
    for i, w in enumerate(words):
        add = len(w) + (1 if cur else 0)
        remaining_lines = n_lines - len(lines)
        remaining_words = len(words) - i
        if cur and cur_len + add > target and remaining_lines > 1 and remaining_words >= remaining_lines:
            lines.append(" ".join(cur))
            cur = [w]
            cur_len = len(w)
        else:
            cur.append(w)
            cur_len += add
    if cur:
        lines.append(" ".join(cur))
    while len(lines) > n_lines:
        lines[-2] = lines[-2] + " " + lines[-1]
        lines.pop()
    return lines


def draw_centered_lines(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    font: ImageFont.ImageFont,
    cy: float,
    fill,
    spacing: float = 1.15,
):
    heights = []
    widths = []
    for line in lines:
        bb = draw.textbbox((0, 0), line, font=font)
        widths.append(bb[2] - bb[0])
        heights.append(bb[3] - bb[1])
    line_h = max(heights) if heights else 20
    total_h = line_h * len(lines) * spacing - line_h * (spacing - 1)
    y = cy - total_h / 2
    for i, line in enumerate(lines):
        x = CX - widths[i] / 2
        draw.text((x, y), line, font=font, fill=fill)
        y += line_h * spacing


def draw_circle(draw, r, fill, outline=None, width=0):
    draw.ellipse([CX - r, CY - r, CX + r, CY + r], fill=fill, outline=outline, width=width)


def draw_rounded_rect(draw, x0, y0, x1, y1, radius, fill, outline=None, width=0):
    draw.rounded_rectangle([x0, y0, x1, y1], radius=radius, fill=fill, outline=outline, width=width)


def polygon_points(n: int, r: float, rot: float = 0.0):
    pts = []
    for i in range(n):
        a = rot + (2 * math.pi * i / n) - math.pi / 2
        pts.append((CX + r * math.cos(a), CY + r * math.sin(a)))
    return pts


def render_logo(name: str, category: str) -> tuple[Image.Image, str, str]:
    h = name_hash(name)
    palette = PALETTES[h % len(PALETTES)]
    # slight palette shift by category to add variety without colliding
    cat_shift = sum(ord(c) for c in category) % len(PALETTES)
    palette = PALETTES[(h + cat_shift) % len(PALETTES)]
    bg, accent, text_c, secondary = palette
    template = TEMPLATES[h % len(TEMPLATES)]
    # avoid identical template+palette for neighbors: mix bits
    template = TEMPLATES[(h // 7 + h % 13) % len(TEMPLATES)]

    display = shorten_display_name(name)
    mono = initials(name)

    img = Image.new("RGB", (SIZE, SIZE), bg)
    draw = ImageDraw.Draw(img)

    # subtle geometric background texture unique per hash
    for i in range(6):
        ang = (h % 360 + i * 37) * math.pi / 180
        rr = 180 + (h // (i + 3) % 80)
        x = CX + int(math.cos(ang) * rr)
        y = CY + int(math.sin(ang) * rr)
        r = 40 + (h >> (i + 2)) % 60
        col = tuple(min(255, c + 18) for c in bg)
        draw.ellipse([x - r, y - r, x + r, y + r], fill=col)

    if template == "circular_badge":
        draw_circle(draw, 220, secondary)
        draw_circle(draw, 200, bg)
        draw_circle(draw, 190, None, outline=accent, width=8)
        draw_circle(draw, 170, None, outline=secondary, width=2)
        # monogram ring top
        font_m = load_font(72, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        draw.text((CX - (bb[2] - bb[0]) / 2, 120), mono, font=font_m, fill=accent)
        font, _, lines = fit_text(draw, display, 320, 42, 18)
        draw_centered_lines(draw, lines, font, 310, text_c)
        # accent bar
        draw.rectangle([CX - 40, 250, CX + 40, 256], fill=accent)

    elif template == "rounded_square":
        draw_rounded_rect(draw, 36, 36, 476, 476, 72, secondary)
        draw_rounded_rect(draw, 56, 56, 456, 456, 60, bg)
        draw_rounded_rect(draw, 72, 72, 440, 440, 52, None, outline=accent, width=6)
        font_m = load_font(86, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        draw.text((CX - (bb[2] - bb[0]) / 2, 130), mono, font=font_m, fill=accent)
        font, _, lines = fit_text(draw, display, 340, 40, 16)
        draw_centered_lines(draw, lines, font, 330, text_c)

    elif template == "geometric_diamond":
        draw.polygon(polygon_points(4, 230, math.pi / 4), fill=secondary)
        draw.polygon(polygon_points(4, 200, math.pi / 4), fill=bg)
        draw.polygon(polygon_points(4, 185, math.pi / 4), outline=accent)
        # thicker diamond outline via second pass
        pts = polygon_points(4, 185, math.pi / 4)
        draw.line(pts + [pts[0]], fill=accent, width=7)
        font_m = load_font(78, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        draw.text((CX - (bb[2] - bb[0]) / 2, 150), mono, font=font_m, fill=accent)
        font, _, lines = fit_text(draw, display, 280, 36, 16)
        draw_centered_lines(draw, lines, font, 320, text_c)

    elif template == "monogram_banner":
        draw_circle(draw, 210, accent)
        draw_circle(draw, 190, bg)
        font_m = load_font(110, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        draw.text((CX - (bb[2] - bb[0]) / 2, CY - (bb[3] - bb[1]) / 2 - 40), mono, font=font_m, fill=accent)
        # banner
        draw_rounded_rect(draw, 60, 340, 452, 430, 18, secondary)
        draw_rounded_rect(draw, 70, 348, 442, 422, 14, bg)
        font, _, lines = fit_text(draw, display, 350, 34, 14)
        draw_centered_lines(draw, lines, font, 385, text_c, spacing=1.1)

    elif template == "split_circle":
        draw_circle(draw, 220, secondary)
        draw.pieslice([CX - 200, CY - 200, CX + 200, CY + 200], 180, 360, fill=accent)
        draw.pieslice([CX - 200, CY - 200, CX + 200, CY + 200], 0, 180, fill=bg)
        draw_circle(draw, 200, None, outline=text_c if sum(text_c) > 400 else secondary, width=4)
        font_m = load_font(64, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        # contrast on accent half
        mono_fill = bg if sum(accent) > 400 else (255, 255, 255)
        draw.text((CX - (bb[2] - bb[0]) / 2, 130), mono, font=font_m, fill=mono_fill)
        font, _, lines = fit_text(draw, display, 320, 38, 16)
        draw_centered_lines(draw, lines, font, 340, text_c)

    elif template == "hex_frame":
        draw.polygon(polygon_points(6, 230), fill=secondary)
        draw.polygon(polygon_points(6, 205), fill=bg)
        pts = polygon_points(6, 190)
        draw.line(pts + [pts[0]], fill=accent, width=8)
        font_m = load_font(80, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        draw.text((CX - (bb[2] - bb[0]) / 2, 145), mono, font=font_m, fill=accent)
        draw.rectangle([CX - 50, 250, CX + 50, 256], fill=accent)
        font, _, lines = fit_text(draw, display, 300, 36, 16)
        draw_centered_lines(draw, lines, font, 320, text_c)

    elif template == "arc_badge":
        draw_circle(draw, 220, accent)
        draw_circle(draw, 200, bg)
        # arc ticks
        for i in range(24):
            a0 = math.radians(i * 15 + (h % 15))
            a1 = a0 + math.radians(8)
            draw.arc([80, 80, 432, 432], math.degrees(a0), math.degrees(a1), fill=secondary, width=6)
        font_m = load_font(70, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        draw.text((CX - (bb[2] - bb[0]) / 2, 155), mono, font=font_m, fill=accent)
        font, _, lines = fit_text(draw, display, 300, 38, 16)
        draw_centered_lines(draw, lines, font, 310, text_c)

    else:  # stacked_block
        draw_rounded_rect(draw, 48, 48, 464, 464, 40, secondary)
        draw_rounded_rect(draw, 64, 64, 448, 220, 28, accent)
        font_m = load_font(96, bold=True)
        bb = draw.textbbox((0, 0), mono, font=font_m)
        mono_fill = bg if sum(accent) > 450 else (255, 255, 255)
        draw.text((CX - (bb[2] - bb[0]) / 2, 110), mono, font=font_m, fill=mono_fill)
        draw_rounded_rect(draw, 64, 240, 448, 448, 28, bg)
        font, _, lines = fit_text(draw, display, 340, 40, 16)
        draw_centered_lines(draw, lines, font, 344, text_c)

    return img, template, f"palette_{(h + cat_shift) % len(PALETTES)}"


def render_default_logo() -> Image.Image:
    img = Image.new("RGB", (SIZE, SIZE), (40, 55, 70))
    draw = ImageDraw.Draw(img)
    draw_circle(draw, 210, (70, 100, 120))
    draw_circle(draw, 190, (40, 55, 70))
    draw_circle(draw, 180, None, outline=(220, 180, 90), width=6)
    font = load_font(48, bold=True)
    text = "PEÇA JÁ"
    bb = draw.textbbox((0, 0), text, font=font)
    draw.text((CX - (bb[2] - bb[0]) / 2, CY - (bb[3] - bb[1]) / 2), text, font=font, fill=(255, 255, 255))
    return img


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    shops = extract_shops()
    print(f"Found {len(shops)} shops")
    failures: list[str] = []
    mapping: list[dict] = []
    used_slugs: dict[str, int] = {}

    for shop in shops:
        name = shop["name"]
        category = shop["category"]
        try:
            img, template, theme = render_logo(name, category)
            slug = slugify(name)
            if slug in used_slugs:
                used_slugs[slug] += 1
                slug = f"{slug}-{used_slugs[slug]}"
            else:
                used_slugs[slug] = 1
            path = OUT_DIR / f"{slug}.png"
            img.save(path, "PNG", optimize=True)
            print(f"{name} -> {slug}.png -> {template} / {theme}")
            mapping.append(
                {
                    "name": name,
                    "normalized": normalize_key(name),
                    "slug": slug,
                    "template": template,
                    "theme": theme,
                    "category": category,
                }
            )
        except Exception as e:
            failures.append(f"{name}: {e}")
            print(f"FAIL {name}: {e}", file=sys.stderr)

    default_path = OUT_DIR / "_default.png"
    render_default_logo().save(default_path, "PNG", optimize=True)
    print(f"Default logo -> {default_path.name}")

    map_path = ROOT / "scripts" / "_logo_mapping.json"
    map_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nGenerated: {len(mapping)} logos")
    print(f"Failures: {len(failures)}")
    for f in failures:
        print(f"  - {f}")
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
