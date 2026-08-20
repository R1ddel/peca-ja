# -*- coding: utf-8 -*-
"""Gera PDFs dos termos oficiais (entregador e comerciante) a partir do código do app."""
from __future__ import annotations

import os
import re
import sys
from datetime import date
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph, Spacer, Image as RLImage

from generate_portfolio_pdf import (
    BG,
    MUTED,
    OUT_DIR,
    PRIMARY,
    PRIMARY_DARK,
    SECONDARY,
    TEXT,
    WatermarkDoc,
    make_watermark,
    save_assets,
)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DRIVER_TS = os.path.join(ROOT, "constants", "driverTerms.ts")
MERCHANT_TS = os.path.join(ROOT, "constants", "merchantTerms.ts")
OUT_DRIVER = os.path.join(OUT_DIR, "PECA_JA_Termo_Entregador.pdf")
OUT_MERCHANT = os.path.join(OUT_DIR, "PECA_JA_Termo_Comerciante.pdf")

TODAY = date.today().strftime("%d/%m/%Y")


class TermsDoc(WatermarkDoc):
    def __init__(self, filename, watermark_path, header_logo, footer: str, **kwargs):
        self._footer = footer
        super().__init__(filename, watermark_path, header_logo, **kwargs)

    def _on_page(self, canvas: Canvas, doc):
        page_w, page_h = A4
        canvas.setFillColor(HexColor(BG))
        canvas.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        canvas.saveState()
        canvas.drawImage(
            self.watermark_path,
            0,
            0,
            width=page_w,
            height=page_h,
            mask="auto",
            preserveAspectRatio=True,
        )
        canvas.restoreState()
        canvas.setFillColor(HexColor(PRIMARY))
        canvas.rect(0, page_h - 4 * mm, page_w, 4 * mm, fill=1, stroke=0)
        canvas.setFillColor(HexColor(MUTED))
        canvas.setFont("Helvetica", 8)
        canvas.drawString(2 * cm, 1.2 * cm, self._footer)
        canvas.drawRightString(page_w - 2 * cm, 1.2 * cm, f"pág. {doc.page}")


def _styles():
    s = getSampleStyleSheet()
    s.add(
        ParagraphStyle(
            name="Kicker",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    s.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=21,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    s.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    s.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=HexColor(PRIMARY_DARK),
            spaceBefore=10,
            spaceAfter=5,
        )
    )
    s.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=9.2,
            leading=13,
            textColor=HexColor(TEXT),
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        )
    )
    s.add(
        ParagraphStyle(
            name="TermBullet",
            fontName="Helvetica",
            fontSize=9.2,
            leading=12.5,
            textColor=HexColor(TEXT),
            leftIndent=12,
            spaceAfter=2,
        )
    )
    s.add(
        ParagraphStyle(
            name="Small",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceBefore=8,
        )
    )
    s.add(
        ParagraphStyle(
            name="Notice",
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=HexColor(SECONDARY),
            alignment=TA_LEFT,
            spaceBefore=4,
            spaceAfter=8,
            backColor=HexColor("#E8F6EE"),
            borderPadding=6,
        )
    )
    return s


def extract_ts_const(src: str, name: str) -> str:
    m = re.search(rf"export const {name} = '([^']+)'", src)
    if not m:
        raise ValueError(f"const {name} não encontrada")
    return m.group(1)


def extract_template(src: str) -> str:
    start = src.find("return `")
    end = src.rfind("`.trim()")
    if start < 0 or end < 0:
        raise ValueError("template do termo não encontrado")
    return src[start + 8 : end]


def fill_driver(src: str) -> tuple[str, str]:
    version = extract_ts_const(src, "DRIVER_TERMS_VERSION")
    body = extract_template(src)
    body = body.replace("${DRIVER_TERMS_VERSION}", version)
    body = body.replace("${today}", TODAY)
    body = body.replace("${opts.name}", "[NOME DO ENTREGADOR]")
    body = body.replace("${doc}", "[CPF]")
    body = body.replace("${opts.vehicleType}", "[VEÍCULO]")
    body = body.replace("${plate}", "[PLACA]")
    body = body.replace("${city}", "Mucugê/BA")
    return version, body.strip()


def fill_merchant(src: str) -> tuple[str, str]:
    version = extract_ts_const(src, "MERCHANT_TERMS_VERSION")
    body = extract_template(src)
    body = body.replace("${MERCHANT_TERMS_VERSION}", version)
    body = body.replace("${today}", TODAY)
    body = body.replace("${opts.ownerName}", "[NOME DO RESPONSÁVEL]")
    body = body.replace("${opts.businessName}", "[NOME DA LOJA]")
    body = body.replace("${doc}", "[CPF/CNPJ]")
    body = body.replace("${opts.planLabel}", "[PLANO]")
    body = body.replace("${opts.planPrice}", "[VALOR]")
    body = body.replace("${city}", "Mucugê/BA")
    return version, body.strip()


HEADING_NAMES = {
    "PREÂMBULO",
    "PARTES",
}


def is_heading(line: str) -> bool:
    t = line.strip()
    if not t:
        return False
    if t in HEADING_NAMES:
        return True
    # Títulos de cláusula: "1. NATUREZA..." (não "1.1. texto.")
    if re.match(r"^\d+\.\s+[A-ZÁÉÍÓÚÀÂÊÔÃÕÇ0-9]", t) and not re.match(r"^\d+\.\d+", t):
        if len(t) <= 100 and (not t.endswith(".") or "—" in t):
            return True
    return False


def is_bullet(line: str) -> bool:
    return bool(re.match(r"^[a-z]\)\s", line.strip()) or line.strip().startswith("a) "))


def xml(text: str) -> str:
    t = (
        text.replace("“", '"')
        .replace("”", '"')
        .replace("‘", "'")
        .replace("’", "'")
        .replace("—", " - ")
        .replace("–", "-")
    )
    return escape(t)


def flow_from_body(body: str, styles, skip_first_title_lines: int = 4):
    """Converte o texto do termo em flowables. As primeiras linhas viram capa."""
    lines = [ln.rstrip() for ln in body.splitlines()]
    story = []
    # title block from first non-empty lines until blank after version/date
    i = 0
    title_lines = []
    while i < len(lines):
        if not lines[i].strip():
            if title_lines:
                i += 1
                break
            i += 1
            continue
        title_lines.append(lines[i].strip())
        i += 1
        if len(title_lines) >= skip_first_title_lines:
            # keep eating until blank
            while i < len(lines) and lines[i].strip():
                title_lines.append(lines[i].strip())
                i += 1
            while i < len(lines) and not lines[i].strip():
                i += 1
            break

    if title_lines:
        story.append(Paragraph(xml(title_lines[0]), styles["CoverTitle"]))
        for extra in title_lines[1:]:
            story.append(Paragraph(xml(extra), styles["CoverSub"]))

    para_buf: list[str] = []

    def flush():
        nonlocal para_buf
        if not para_buf:
            return
        text = " ".join(para_buf)
        story.append(Paragraph(xml(text), styles["Body"]))
        para_buf = []

    while i < len(lines):
        raw = lines[i]
        t = raw.strip()
        i += 1
        if not t:
            flush()
            continue
        if is_heading(t):
            flush()
            story.append(Paragraph(xml(t), styles["H1"]))
            continue
        if re.match(r"^[a-z]\)\s", t):
            flush()
            story.append(Paragraph(xml(t), styles["TermBullet"]))
            continue
        para_buf.append(t)
    flush()
    return story


def build_one(
    out_path: str,
    kicker: str,
    notice: str,
    version: str,
    body: str,
    footer: str,
    header_path: str,
    wm_path: str,
):
    styles = _styles()
    doc = TermsDoc(
        out_path,
        wm_path,
        header_path,
        footer,
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.6 * cm,
        bottomMargin=2.0 * cm,
        title=kicker,
        author="Peça Já",
    )
    story = []
    logo = RLImage(header_path, width=1.6 * cm, height=1.6 * cm)
    logo.hAlign = "CENTER"
    story.append(logo)
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("PEÇA JÁ · MODELO DO TERMO (vitrine do app)", styles["Kicker"]))
    story.append(Paragraph(xml(kicker), styles["CoverTitle"]))
    story.append(
        Paragraph(
            xml(f"Versão {version} · modelo para Mucugê/BA · gerado em {TODAY}"),
            styles["CoverSub"],
        )
    )
    story.append(Paragraph(xml(notice), styles["Notice"]))
    story.extend(flow_from_body(body, styles))
    story.append(
        Paragraph(
            "Modelo extraído do código do aplicativo (constants/). "
            "No aceite real, nome, documento, veículo/loja e plano são preenchidos com os dados do cadastro. "
            "Texto-base operacional — revisão por advogado inscrito na OAB recomendada para o CNPJ titular da marca.",
            styles["Small"],
        )
    )
    doc.build(story)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    logo_path, header_path = save_assets()
    wm = make_watermark(int(A4[0]), int(A4[1]))
    wm_path = os.path.join(OUT_DIR, "pecaja-watermark.png")
    wm.save(wm_path)

    with open(DRIVER_TS, encoding="utf-8") as f:
        driver_src = f.read()
    with open(MERCHANT_TS, encoding="utf-8") as f:
        merchant_src = f.read()

    d_ver, d_body = fill_driver(driver_src)
    m_ver, m_body = fill_merchant(merchant_src)

    build_one(
        OUT_DRIVER,
        "Termo do entregador",
        "Este PDF é o texto que o motoboy/ciclista aceita no app. Campos entre colchetes "
        "são preenchidos no cadastro. A relação é de prestador autônomo: sem vínculo empregatício, "
        "jornada livre e Pix em CPF como meio de pagamento, nos limites da lei brasileira.",
        d_ver,
        d_body,
        "Peça Já · termo do entregador · v" + d_ver,
        header_path,
        wm_path,
    )
    build_one(
        OUT_MERCHANT,
        "Termo do comerciante",
        "Este PDF é o texto que o estabelecimento aceita no app. Campos entre colchetes "
        "são preenchidos no cadastro. A loja abre e fecha quando quiser; pedido não honrado "
        "é risco do comércio; o Peça Já atua como intermediário tecnológico.",
        m_ver,
        m_body,
        "Peça Já · termo do comerciante · v" + m_ver,
        header_path,
        wm_path,
    )
    print(OUT_DRIVER)
    print(OUT_MERCHANT)


if __name__ == "__main__":
    main()
