# -*- coding: utf-8 -*-
"""Gera Contrato de Sócio Investidor Operacional — Peça Já (40% ou 45%)."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
)

from contrato_socio_investidor_clauses import build_clauses

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
ASSETS = Path(__file__).resolve().parent / "assets"
CONFIG_JSON = DOCS / "contrato_socio_investidor.json"
LOGO_SOURCE_PNG = ASSETS / "inovatech-logo-source.png"
LOGO_FULL_PNG = ASSETS / "inovatech-logo-full.png"

PAGE_W, PAGE_H = A4
INK = "#1a1f3d"
MUTED = "#4a5278"
ACCENT = "#1a5fb4"

MARGIN_L = 2.4 * cm
MARGIN_R = 2.4 * cm
MARGIN_T = 2.2 * cm
MARGIN_B = 2.4 * cm


def load_config() -> dict:
    with open(CONFIG_JSON, encoding="utf-8") as f:
        return json.load(f)


def prepare_logo_full(
    src: Path = LOGO_SOURCE_PNG,
    dst: Path = LOGO_FULL_PNG,
) -> Path | None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        return dst
    if not src.exists():
        print(f"Aviso: logo não encontrada em {src} — PDF sem logo.")
        return None

    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            brightness = (r + g + b) / 3
            spread = max(r, g, b) - min(r, g, b)
            if brightness > 200 and spread < 35:
                px[x, y] = (r, g, b, 0)
            elif brightness > 228:
                px[x, y] = (r, g, b, 0)

    bbox = im.split()[-1].getbbox()
    if bbox:
        im = im.crop(bbox)

    im.save(dst)
    return dst


def _logo_flowable(logo_path: Path, *, width: float = 5.2 * cm) -> Table:
    im = Image.open(logo_path)
    iw, ih = im.size
    logo_h = width * ih / max(iw, 1)
    img = RLImage(str(logo_path), width=width, height=logo_h)
    t = Table([[img]], colWidths=[16 * cm])
    t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    return t


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "STitle",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=14.5,
            leading=18,
            textColor=HexColor(INK),
            alignment=TA_CENTER,
            spaceAfter=8,
        ),
        "subtitle": ParagraphStyle(
            "SSub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "SH2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=HexColor(ACCENT),
            spaceBefore=10,
            spaceAfter=4,
        ),
        "body": ParagraphStyle(
            "SBody",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.5,
            textColor=HexColor(INK),
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        ),
        "bullet": ParagraphStyle(
            "SBullet",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9.2,
            leading=13.5,
            textColor=HexColor(INK),
            alignment=TA_JUSTIFY,
            leftIndent=14,
            spaceAfter=3,
        ),
        "sig": ParagraphStyle(
            "SSig",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=HexColor(INK),
            alignment=TA_CENTER,
        ),
        "footer": ParagraphStyle(
            "SFoot",
            parent=base["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=7.5,
            leading=10,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
        ),
    }


def _p(text: str, style) -> Paragraph:
    return Paragraph(text, style)


class ContractDoc(BaseDocTemplate):
    def __init__(self, filename, **kwargs):
        super().__init__(filename, **kwargs)
        frame = Frame(
            self.leftMargin, self.bottomMargin, self.width, self.height, id="normal"
        )
        self.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=self._on_page)])

    def _draw_footer(self, canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(HexColor(MUTED))
        canvas.drawRightString(PAGE_W - MARGIN_R, MARGIN_B - 0.85 * cm, f"Página {doc.page}")
        canvas.restoreState()

    def _on_page(self, canvas, doc):
        canvas.setFillColor(HexColor("#ffffff"))
        canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        self._draw_footer(canvas, doc)


def _cover(story, styles, cfg: dict, logo_path: Path | None, percentual: int):
    c = cfg["contratante"]
    inv = cfg["investidor"]
    if logo_path and logo_path.exists():
        story.append(Spacer(1, 0.6 * cm))
        story.append(_logo_flowable(logo_path, width=5.2 * cm))
        story.append(Spacer(1, 0.9 * cm))

    story.append(_p(
        "CONTRATO DE APORTE OPERACIONAL E PARTICIPAÇÃO NOS RESULTADOS",
        styles["title"],
    ))
    story.append(_p(
        f"APLICATIVO PEÇA JÁ — {percentual}% DA FATIA DO CONTRATANTE",
        styles["title"],
    ))
    story.append(Spacer(1, 0.25 * cm))
    story.append(_p(
        f"<b>Contratante:</b> {c['nome_completo']}<br/>"
        f"<b>CPF:</b> {c['cpf']}<br/>"
        f"<b>Marca:</b> {c.get('marca', 'InovaTech')} — {c.get('nome_comercial', 'Inova Tech Desenvolvimento Digital')}<br/>"
        f"<b>Investidor:</b> {inv['nome']}<br/>"
        f"<b>Participação:</b> {percentual}% da fatia do Contratante "
        f"(no exemplo ilustrativo, {percentual}% de R$ 18.000,00)<br/>"
        f"<b>Prazo:</b> 12 meses, até a data correspondente do ano seguinte, sem renovação automática",
        styles["subtitle"],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(_p(
        "Instrumento particular celebrado entre as partes qualificadas neste contrato, "
        "nos termos do Código Civil. O Investidor custeia a InovaTech, empresa à qual o "
        "aplicativo Peça Já pertence; o aporte serve ao app e a outras necessidades da empresa. "
        "A participação econômica é limitada e temporária, restrita à receita da plataforma "
        "do Peça Já. Não constitui sociedade, não confere administração nem acesso a contas. "
        "Planos mensais não integram a base. O prazo extingue-se na data correspondente do "
        "ano seguinte, sem renovação tácita.",
        styles["body"],
    ))
    story.append(PageBreak())


def _signatures(story, styles, cfg: dict, logo_path: Path | None, percentual: int):
    story.append(Spacer(1, 0.8 * cm))
    story.append(_p(
        f"{cfg['local_assinatura']}, {cfg['data_assinatura']}.",
        styles["body"],
    ))
    story.append(Spacer(1, 1.0 * cm))

    def sig_block(lines: list[str]):
        rows = [[_p("<br/>".join(lines), styles["sig"])]]
        t = Table(rows, colWidths=[7.5 * cm])
        t.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.8, HexColor(INK)),
            ("TOPPADDING", (0, 0), (-1, 0), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        return t

    c = cfg["contratante"]
    inv = cfg["investidor"]
    row = Table([
        [
            sig_block([
                "<b>CONTRATANTE</b>",
                "(titular e gestor exclusivo)",
                c["nome_completo"],
                f"CPF: {c['cpf']}",
                f"E-mail: {c['email']}",
                f"Pix: {c['pix']}",
                f"Marca: {c.get('marca', 'InovaTech')}",
                "(pessoa física, salvo qualificação diversa)",
                "",
                "Assinatura: ________________________",
            ]),
            sig_block([
                "<b>INVESTIDOR OPERACIONAL</b>",
                f"(participação: {percentual}% da fatia do Contratante)",
                f"Nome: {inv['nome']}",
                f"CPF: {inv['cpf']}",
                f"E-mail: {inv['email']}",
                f"Telefone: {inv['telefone']}",
                f"Pix: {inv.get('chave_pix_recebimento', '____________________')}",
                "",
                "Assinatura: ________________________",
            ]),
        ]
    ], colWidths=[7.8 * cm, 7.8 * cm])
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(row)
    story.append(Spacer(1, 1.2 * cm))

    story.append(_p("<b>TESTEMUNHAS (recomendado):</b>", styles["body"]))
    story.append(Spacer(1, 0.6 * cm))
    wit = Table([
        [
            sig_block([
                "<b>Testemunha 1</b>",
                "Nome: ________________________________",
                "CPF: ____________________",
                "Assinatura: ________________________",
            ]),
            sig_block([
                "<b>Testemunha 2</b>",
                "Nome: ________________________________",
                "CPF: ____________________",
                "Assinatura: ________________________",
            ]),
        ]
    ], colWidths=[7.8 * cm, 7.8 * cm])
    wit.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(wit)
    story.append(Spacer(1, 0.8 * cm))
    story.append(_p(
        f"As partes declaram ter lido este contrato e seus Anexos I e II. "
        f"Participação do Investidor: {percentual}% da fatia do Contratante, como única remuneração. "
        "Sem sociedade, sem administração e sem acesso a contas. "
        "Prazo de 12 meses, sem renovação tácita. O aporte não é empréstimo e não se restitui.",
        styles["footer"],
    ))

    if logo_path and logo_path.exists():
        story.append(Spacer(1, 1.0 * cm))
        story.append(_logo_flowable(logo_path, width=4.5 * cm))


def build_pdf(percentual: int) -> Path:
    if percentual not in (40, 45):
        raise ValueError("Percentual deve ser 40 ou 45")

    cfg = load_config()
    logo = prepare_logo_full()
    styles = _styles()
    story = []

    out_name = f"PECAJA_Contrato_Socio_Investidor_{percentual}.pdf"
    out_pdf = DOCS / out_name

    _cover(story, styles, cfg, logo, percentual)

    for title, paragraphs in build_clauses(cfg, percentual_investidor=percentual):
        story.append(_p(title, styles["h2"]))
        for para in paragraphs:
            if len(para) >= 2 and para[1] == ")" and para[0] in "abcdefghij":
                story.append(_p(para, styles["bullet"]))
            elif para.startswith("•") or para.startswith("☐"):
                story.append(_p(para, styles["bullet"]))
            else:
                story.append(_p(para, styles["body"]))

    _signatures(story, styles, cfg, logo, percentual)

    doc = ContractDoc(
        str(out_pdf),
        pagesize=A4,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title=f"Contrato Sócio Investidor {percentual}% — Peça Já",
        author="InovaTech",
    )
    doc.build(story)
    public_pdf = ROOT / "public" / out_name
    if public_pdf.parent.exists():
        public_pdf.write_bytes(out_pdf.read_bytes())
        print("OK", public_pdf)
    print("OK", out_pdf)
    return out_pdf


def main():
    parser = argparse.ArgumentParser(description="Gera contrato sócio investidor Peça Já")
    parser.add_argument(
        "percentual",
        nargs="?",
        type=int,
        choices=[40, 45],
        help="Percentual da fatia do Contratante (40 ou 45)",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Gera os dois PDFs (40% e 45%)",
    )
    args = parser.parse_args()

    if args.all:
        for pct in (40, 45):
            build_pdf(pct)
        return

    if args.percentual is None:
        parser.error("Informe 40 ou 45, ou use --all")
    build_pdf(args.percentual)


if __name__ == "__main__":
    main()
