# -*- coding: utf-8 -*-
"""Gera PDF de portfólio Peça Já com logo da sacola (bag-handle) e marca d'água."""
from __future__ import annotations

import os
from io import BytesIO

from PIL import Image, ImageDraw, ImageFont
from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    FrameBreak,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    Flowable,
)

ROOT = r"C:\Users\iagot\Projects\peca-ja"
OUT_DIR = os.path.join(ROOT, "docs")
OUT_PDF = os.path.join(OUT_DIR, "PECA_JA_Portfolio.pdf")
IONICONS = os.path.join(
    ROOT,
    r"node_modules\@expo\vector-icons\build\vendor\react-native-vector-icons\Fonts\Ionicons.ttf",
)
BAG_CODE = 0xF15E  # bag-handle
PRIMARY = "#00A86B"
PRIMARY_DARK = "#007A4D"
SECONDARY = "#1E3A2F"
BG = "#F5FAF7"
TEXT = "#1A2E24"
MUTED = "#6B7B72"


def make_bag_logo(size: int = 512, circle: bool = True, alpha: int = 255) -> Image.Image:
    """Logo Peça Já: círculo + sacola Ionicons (mesma marca da abertura do app)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    pad = int(size * 0.06)
    if circle:
        # fundo branco + anel verde suave
        draw.ellipse(
            [pad, pad, size - pad, size - pad],
            fill=(255, 255, 255, alpha if alpha > 200 else 230),
        )
        ring = int(size * 0.035)
        draw.ellipse(
            [pad, pad, size - pad, size - pad],
            outline=(0, 168, 107, alpha),
            width=ring,
        )
    font_size = int(size * (0.48 if circle else 0.72))
    font = ImageFont.truetype(IONICONS, font_size)
    glyph = chr(BAG_CODE)
    bbox = draw.textbbox((0, 0), glyph, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1] - size * 0.02
    draw.text((x, y), glyph, font=font, fill=(0, 168, 107, alpha))
    return img


def make_watermark(page_w: int, page_h: int) -> Image.Image:
    """Marca d'água grande e suave no centro da página."""
    canvas = Image.new("RGBA", (page_w, page_h), (0, 0, 0, 0))
    bag = make_bag_logo(size=min(page_w, page_h) * 55 // 100, circle=True, alpha=255)
    # reduzir opacidade geral
    r, g, b, a = bag.split()
    a = a.point(lambda p: int(p * 0.08))
    bag = Image.merge("RGBA", (r, g, b, a))
    x = (page_w - bag.width) // 2
    y = (page_h - bag.height) // 2 + int(page_h * 0.04)
    canvas.paste(bag, (x, y), bag)
    return canvas


def save_assets():
    os.makedirs(OUT_DIR, exist_ok=True)
    logo = make_bag_logo(512, circle=True)
    logo_path = os.path.join(OUT_DIR, "pecaja-logo-sacola.png")
    logo.save(logo_path)
    # header strip logo smaller
    header = make_bag_logo(256, circle=True)
    header_path = os.path.join(OUT_DIR, "pecaja-logo-header.png")
    header.save(header_path)
    return logo_path, header_path


class WatermarkDoc(BaseDocTemplate):
    def __init__(self, filename, watermark_path, header_logo, **kwargs):
        super().__init__(filename, **kwargs)
        self.watermark_path = watermark_path
        self.header_logo = header_logo
        frame = Frame(
            self.leftMargin,
            self.bottomMargin,
            self.width,
            self.height,
            id="normal",
        )
        self.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=self._on_page)])

    def _on_page(self, canvas, doc):
        page_w, page_h = A4
        # fundo
        canvas.setFillColor(HexColor(BG))
        canvas.rect(0, 0, page_w, page_h, fill=1, stroke=0)
        # marca d'água
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
        # topo fino
        canvas.setFillColor(HexColor(PRIMARY))
        canvas.rect(0, page_h - 4 * mm, page_w, 4 * mm, fill=1, stroke=0)
        # rodapé
        canvas.setFillColor(HexColor(MUTED))
        canvas.setFont("Helvetica", 8)
        canvas.drawString(2 * cm, 1.2 * cm, "Peça Já · delivery com transparência")
        canvas.drawRightString(page_w - 2 * cm, 1.2 * cm, f"pág. {doc.page}")


def build_pdf():
    logo_path, header_path = save_assets()

    # watermark PNG no tamanho A4 (pt ~ px at 72dpi: 595x842)
    wm = make_watermark(1190, 1684)  # 2x for sharpness
    wm_path = os.path.join(OUT_DIR, "pecaja-watermark.png")
    wm.save(wm_path)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=28,
            leading=34,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=12,
            leading=16,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=HexColor(PRIMARY_DARK),
            spaceBefore=14,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            textColor=HexColor(SECONDARY),
            spaceBefore=10,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=HexColor(TEXT),
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PjBullet",
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=HexColor(TEXT),
            leftIndent=12,
            spaceAfter=3,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Quote",
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=14,
            textColor=HexColor(PRIMARY_DARK),
            leftIndent=8,
            rightIndent=8,
            spaceBefore=6,
            spaceAfter=10,
            borderPadding=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Pitch",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=HexColor(SECONDARY),
            alignment=TA_CENTER,
            spaceBefore=8,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CTA",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=HexColor(PRIMARY),
            alignment=TA_LEFT,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableCell",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=HexColor(TEXT),
        )
    )
    styles.add(
        ParagraphStyle(
            name="TableHead",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=HexColor(PRIMARY_DARK),
        )
    )

    story = []

    # CAPA / cabeçalho
    story.append(Spacer(1, 8 * mm))
    story.append(RLImage(header_path, width=3.2 * cm, height=3.2 * cm))
    story.append(Spacer(1, 4 * mm))
    story.append(Paragraph("Peça Já", styles["CoverTitle"]))
    story.append(Paragraph("DELIVERY", styles["CoverSub"]))
    story.append(
        Paragraph(
            "O delivery em que o comerciante lucra o cardápio inteiro, "
            "o entregador recebe o frete da corrida e o cliente paga sabendo "
            "exatamente o que está financiando.",
            styles["Pitch"],
        )
    )
    story.append(Spacer(1, 4 * mm))

    story.append(Paragraph("O que é", styles["H1"]))
    story.append(
        Paragraph(
            "<b>Peça Já</b> é uma plataforma de delivery local que une "
            "<b>comerciantes, entregadores e clientes</b> num só app — com uma regra "
            "que muda o jogo: <b>a loja lucra o valor cheio que cadastrou no cardápio</b>. "
            "A taxa da plataforma <b>não come a margem do comércio</b>; ela é somada de "
            "forma transparente no checkout do cliente "
            "(<b>R$&nbsp;2 por item</b>). O frete é do entregador. "
            "Sem “surpresa no final do mês”. Sem comissão abusiva escondida no preço do prato.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Não é só mais um app de pedido. É <b>infraestrutura de venda e entrega</b> "
            "pensada para a cidade real: Pix, rastreio, códigos de retirada/entrega, "
            "carteira com saque, frota, painel do lojista e operação HQ — com a promessa "
            "de que <b>ninguém está sendo passado para trás</b>.",
            styles["Body"],
        )
    )

    story.append(Paragraph("O problema que a gente resolve", styles["H1"]))
    story.append(
        Paragraph(
            "Nas plataformas grandes, o comerciante muitas vezes perde "
            "<b>20% a 30% (ou mais)</b> em comissão sobre o que vendeu; é pressionado a "
            "inflar o cardápio; compete consigo mesmo (preço no app ≠ preço no balcão); "
            "e sente que o volume sobe, mas o <b>lucro some</b>.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "O entregador corre atrás de corrida mal paga e não enxerga com clareza "
            "o que é dele no frete. O cliente paga caro sem saber para onde foi o "
            "dinheiro e desconfia de taxa, cupom e “promoção” que na prática sobe o ticket.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>Peça Já nasce do contrário:</b> regra clara, lucro do lojista preservado, "
            "frete justo, cliente que entende o que está pagando.",
            styles["Body"],
        )
    )

    story.append(Paragraph("Para o comerciante — por que assinar", styles["H1"]))
    story.append(Paragraph("Você recebe o que cadastrou", styles["H2"]))
    story.append(
        Paragraph(
            "Cadastrou o prato a R$&nbsp;25? <b>Recebe R$&nbsp;25</b> "
            "(menos desconto que <i>você</i> ofereceu). A taxa Peça Já "
            "<b>não é descontada da sua venda</b>. Ela aparece para o cliente como "
            "taxa da plataforma — transparente.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Menos gasto, mais lucro", styles["H2"]))
    story.append(
        Paragraph(
            "Sem comissão percentual que cresce junto com o faturamento. "
            "Quanto mais você vende no modelo antigo, <b>mais a plataforma fica com "
            "uma fatia do seu crescimento</b>. Aqui, o crescimento do GMV "
            "<b>não vira punição</b> na sua margem.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Cardápio honesto", styles["H2"]))
    story.append(
        Paragraph(
            "Você não precisa inventar preço “só para o app”. O mesmo valor que faz "
            "sentido na loja faz sentido no Peça Já — e o cliente percebe confiança.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Operação de verdade, não só vitrine", styles["H2"]))
    for b in [
        "• Pedidos em tempo real",
        "• Cardápio, horários e raio de entrega",
        "• Pagamento confirmado (Pix / cartão) antes do preparo",
        "• Código de retirada com o motoboy",
        "• Carteira e saque com regras claras",
    ]:
        story.append(Paragraph(b, styles["PjBullet"]))
    story.append(
        Paragraph(
            "“Nas outras plataformas, uma parte do que o cliente paga pelo <i>seu</i> "
            "produto vira comissão delas. No Peça Já, o valor do cardápio é seu. "
            "A gente ganha a taxa da plataforma — e você sabe exatamente o que é de cada um.”",
            styles["Quote"],
        )
    )

    story.append(PageBreak())

    story.append(Paragraph("Para o entregador — por que trabalhar com a gente", styles["H1"]))
    story.append(Paragraph("O frete é a sua corrida", styles["H2"]))
    story.append(
        Paragraph(
            "O valor de entrega do pedido é a referência da sua remuneração — "
            "não um resto depois de três taxas.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Mais previsibilidade", styles["H2"]))
    story.append(
        Paragraph(
            "Painel de frota, corridas, presença online, bloqueio de má conduta quando "
            "necessário: operação séria, não “grupo de WhatsApp eternamente”.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Saque e carteira", styles["H2"]))
    story.append(
        Paragraph(
            "Crédito após entrega confirmada, regras de saque objetivas — você trabalha, "
            "vê o valor, saca.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Respeito na ponta", styles["H2"]))
    story.append(
        Paragraph(
            "Código de entrega com o cliente, rastreio, menos briga por “sumiu o pedido”. "
            "Menos estresse = mais corridas boas.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "“Aqui o frete não é migalha depois da comissão da plataforma no prato do "
            "restaurante. Você entrega, o frete é da corrida — e a loja não está te "
            "pagando com o que sobrou da taxa dela.”",
            styles["Quote"],
        )
    )

    story.append(Paragraph("Para o cliente — por que pedir com a gente", styles["H1"]))
    story.append(Paragraph("Transparência no checkout", styles["H2"]))
    story.append(
        Paragraph(
            "Você vê: <b>produtos + frete + taxa Peça Já</b>. Sem mistério de "
            "“por que o mesmo lanche está R$&nbsp;8 mais caro e ninguém explica”.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Apoia o comércio da sua cidade de verdade", styles["H2"]))
    story.append(
        Paragraph(
            "Quando você pede no Peça Já, <b>a loja não está doando 25% do prato</b> "
            "para uma big tech. Seu pedido fortalece quem cozinha, vende e entrega perto de você.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Experiência completa", styles["H2"]))
    story.append(
        Paragraph(
            "Busca, favoritos, checkout, Pix, acompanhamento, códigos de segurança na "
            "entrega — app moderno, fluxo limpo, foco em receber certo.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "“Você não está só pedindo comida. Está escolhendo um modelo em que a padaria, "
            "o restaurante e o motoboy não são espremidos para o app lucrar em cima deles.”",
            styles["Quote"],
        )
    )

    story.append(Paragraph("A diferença financeira (confiança na prática)", styles["H1"]))
    cell = styles["TableCell"]
    head = styles["TableHead"]
    data = [
        [
            Paragraph("<b></b>", head),
            Paragraph("<b>Plataformas com comissão alta</b>", head),
            Paragraph("<b>Peça Já</b>", head),
        ],
        [
            Paragraph("<b>Loja</b>", cell),
            Paragraph("Perde % do valor do cardápio", cell),
            Paragraph("Recebe o <b>valor cheio</b> cadastrado", cell),
        ],
        [
            Paragraph("<b>Taxa da plataforma</b>", cell),
            Paragraph("Embutida / escondida na margem", cell),
            Paragraph("<b>R$ 2 por item</b>, explícita no total", cell),
        ],
        [
            Paragraph("<b>Frete</b>", cell),
            Paragraph("Frequentemente opaco", cell),
            Paragraph("Vai para a <b>entrega</b>", cell),
        ],
        [
            Paragraph("<b>Sensação</b>", cell),
            Paragraph("“Estou sendo passado para trás”", cell),
            Paragraph("“Cada um recebe o que é dele”", cell),
        ],
    ]
    table = Table(data, colWidths=[3.2 * cm, 6.2 * cm, 6.2 * cm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#E8F8F0")),
                ("BACKGROUND", (0, 1), (0, -1), HexColor("#F0F5F2")),
                ("BOX", (0, 0), (-1, -1), 0.6, HexColor(PRIMARY)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, HexColor("#E2EDE7")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "<b>Exemplo simples:</b> pedido com 2 itens a R$&nbsp;20 cada + frete R$&nbsp;5.<br/>"
            "• <b>Outro modelo</b> (ex. 25% de comissão sobre o produto): a loja pode perder "
            "~R$&nbsp;10 só de comissão — e ainda assim o cliente pagou caro.<br/>"
            "• <b>Peça Já:</b> loja recebe <b>R$&nbsp;40</b>; frete <b>R$&nbsp;5</b> para o "
            "entregador; taxa Peça Já <b>R$&nbsp;4</b> (2× R$&nbsp;2) paga pelo cliente de forma clara.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Poucos “detalhes bestas”. Muita honestidade. É isso que faz a pessoa se ligar: "
            "<b>ninguém está te enrolando no meio do caminho</b>.",
            styles["Body"],
        )
    )

    story.append(PageBreak())

    story.append(Paragraph("Tecnologia (credibilidade de produto)", styles["H1"]))
    for b in [
        "• App React Native / Expo (iOS, Android e web)",
        "• Pedidos, auth e lojas em API própria (produção)",
        "• Pix e pagamentos via Mercado Pago",
        "• Ledger + saque para loja e entregador",
        "• Frota compartilhada (heartbeat, corridas, denúncias)",
        "• Painel HQ para operação (overview, lojas, pedidos, tickets, frota, equipe)",
        "• Arquitetura preparada para split de pagamento (dinheiro nas contas certas)",
    ]:
        story.append(Paragraph(b, styles["PjBullet"]))
    story.append(
        Paragraph(
            "Não é protótipo de slide. É produto com fluxo de dinheiro, operação e cidade.",
            styles["Body"],
        )
    )

    story.append(Paragraph("Posicionamento em uma frase", styles["H1"]))
    story.append(
        Paragraph(
            "<b>Peça Já</b> é o delivery em que o comerciante lucra o cardápio inteiro, "
            "o entregador recebe o frete da corrida e o cliente paga sabendo exatamente "
            "o que está financiando — a taxa da plataforma é clara, e a comissão abusiva "
            "das big platforms não tem vez aqui.",
            styles["Pitch"],
        )
    )

    story.append(Paragraph("Pitch curto (30 segundos)", styles["H1"]))
    story.append(
        Paragraph(
            "“As grandes plataformas crescem comissionando o prato do restaurante. "
            "O Peça Já não. O lojista recebe o valor que cadastrou. A gente cobra uma taxa "
            "pequena e transparente do cliente. O frete é do entregador. Resultado: mais "
            "lucro para quem vende, melhor paga para quem entrega, e confiança para quem "
            "pede. Isso não é app genérico — é um modelo novo batendo na porta da sua cidade.”",
            styles["Quote"],
        )
    )

    story.append(Paragraph("Chamadas para ação", styles["H1"]))
    story.append(
        Paragraph(
            "• <b>Comerciante:</b> “Assine e venda sem entregar sua margem.”",
            styles["CTA"],
        )
    )
    story.append(
        Paragraph(
            "• <b>Entregador:</b> “Entre na frota e rode com frete que faz sentido.”",
            styles["CTA"],
        )
    )
    story.append(
        Paragraph(
            "• <b>Cliente:</b> “Peça Já — e fortaleça quem realmente te atende.”",
            styles["CTA"],
        )
    )

    story.append(Spacer(1, 12 * mm))
    story.append(RLImage(header_path, width=2.2 * cm, height=2.2 * cm))
    story.append(Paragraph("Peça Já · inovação com transparência", styles["CoverSub"]))

    doc = WatermarkDoc(
        OUT_PDF,
        watermark_path=wm_path,
        header_logo=header_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.8 * cm,
        bottomMargin=2 * cm,
        title="Peça Já — Portfólio",
        author="Peça Já",
    )
    # center first image: wrap in a flowable trick — use keep with alignment via table
    # Rebuild story header image centered
    centered_logo = Table([[RLImage(header_path, width=3.2 * cm, height=3.2 * cm)]], colWidths=[16 * cm])
    centered_logo.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    # replace first Spacer+Image with centered
    new_story = [Spacer(1, 6 * mm), centered_logo]
    # skip original Spacer and Image (indices 0,1)
    new_story.extend(story[2:])
    # also center closing logo
    for i, item in enumerate(new_story):
        if isinstance(item, RLImage) and i > 5:
            t = Table([[item]], colWidths=[16 * cm])
            t.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
            new_story[i] = t

    doc.build(new_story)
    print("OK", OUT_PDF)
    return OUT_PDF


if __name__ == "__main__":
    build_pdf()
