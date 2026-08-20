# -*- coding: utf-8 -*-
"""PDF 2 — benefícios e fechamento do comerciante (continuação do manual)."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
)

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

OUT_PDF = os.path.join(OUT_DIR, "PECA_JA_Beneficios_Comerciante.pdf")


class CloseDoc(WatermarkDoc):
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
        canvas.drawString(2 * cm, 1.2 * cm, "Peça Já · por que assinar · Mucugê")
        canvas.drawRightString(page_w - 2 * cm, 1.2 * cm, f"pág. {doc.page}")


def _styles():
    s = getSampleStyleSheet()
    s.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    s.add(
        ParagraphStyle(
            name="CoverSub",
            fontName="Helvetica",
            fontSize=11,
            leading=15,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceAfter=8,
        )
    )
    s.add(
        ParagraphStyle(
            name="Pitch",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=HexColor(SECONDARY),
            alignment=TA_CENTER,
            spaceBefore=2,
            spaceAfter=8,
        )
    )
    s.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=13.5,
            leading=17,
            textColor=HexColor(PRIMARY_DARK),
            spaceBefore=10,
            spaceAfter=5,
        )
    )
    s.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=HexColor(TEXT),
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        )
    )
    s.add(
        ParagraphStyle(
            name="PjBullet",
            fontName="Helvetica",
            fontSize=9.5,
            leading=12.5,
            textColor=HexColor(TEXT),
            leftIndent=10,
            spaceAfter=2,
        )
    )
    s.add(
        ParagraphStyle(
            name="CTA",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceBefore=6,
            spaceAfter=4,
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
            spaceBefore=6,
        )
    )
    s.add(
        ParagraphStyle(
            name="NoticeTitle",
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=15,
            textColor=HexColor("#FFFFFF"),
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    s.add(
        ParagraphStyle(
            name="NoticeBody",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=HexColor("#FFFFFF"),
            alignment=TA_CENTER,
            spaceAfter=2,
        )
    )
    s.add(
        ParagraphStyle(
            name="TableHead",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10.5,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
        )
    )
    s.add(
        ParagraphStyle(
            name="TableCell",
            fontName="Helvetica",
            fontSize=7.8,
            leading=10.5,
            textColor=HexColor(TEXT),
        )
    )
    s.add(
        ParagraphStyle(
            name="TableCellC",
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10.5,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
        )
    )
    return s


def _table(data, col_widths):
    t = Table(data, colWidths=col_widths)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#E8F8F0")),
                ("BACKGROUND", (0, 1), (0, -1), HexColor("#F0F5F2")),
                ("BOX", (0, 0), (-1, -1), 0.6, HexColor(PRIMARY)),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, HexColor("#E2EDE7")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return t


def build_pdf():
    _, header_path = save_assets()
    wm = make_watermark(1190, 1684)
    wm_path = os.path.join(OUT_DIR, "pecaja-watermark.png")
    wm.save(wm_path)
    s = _styles()
    head, cell, cellc = s["TableHead"], s["TableCell"], s["TableCellC"]

    story = []
    logo = Table(
        [[RLImage(header_path, width=2.6 * cm, height=2.6 * cm)]],
        colWidths=[16 * cm],
    )
    logo.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story.append(Spacer(1, 3 * mm))
    story.append(logo)
    story.append(Paragraph("Peça Já", s["CoverTitle"]))
    story.append(Paragraph("VOLUME 2 — POR QUE ASSINAR HOJE", s["CoverSub"]))
    story.append(
        Paragraph(
            "Benefícios de quem fecha como loja apoiadora. "
            "Continuação do manual das telas.",
            s["Pitch"],
        )
    )

    offer_inner = [
        Paragraph("OFERTA DE LANÇAMENTO · MUCUGÊ", s["NoticeTitle"]),
        Paragraph(
            "O <b>primeiro mês do app é cortesia</b> no plano Já na Rua "
            "(equivalente a R$&nbsp;200).",
            s["NoticeBody"],
        ),
        Paragraph(
            "Quer um plano maior já no 1º mês? Paga <b>só a diferença</b>: "
            "Já em Alta <b>R$&nbsp;50</b> · Já no Topo <b>R$&nbsp;100</b>.",
            s["NoticeBody"],
        ),
        Paragraph(
            "Do 2º mês em diante vale o preço cheio do plano escolhido. "
            "Sem comissão em cima do cardápio — nunca.",
            s["NoticeBody"],
        ),
    ]
    # fix: I accidentally used Paragraph without comma - wait I used comma after first
    # Look at my write - the second Paragraph after NoticeBody has comma. Third too.
    # There's a syntax error: 
    #        Paragraph(...),
    #        Paragraph(
    #        Paragraph(  <- missing comma? Let me look...
    # I wrote:
    #        Paragraph(..., s["NoticeBody"]),
    #        Paragraph(
    #            "Quer um plano...
    # that's fine
    #
    # WAIT I see: after first NoticeBody paragraph I have ")" then next Paragraph - OK

    box = Table([[offer_inner]], colWidths=[16 * cm])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), HexColor(PRIMARY)),
                ("BOX", (0, 0), (-1, -1), 1.2, HexColor(PRIMARY_DARK)),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(box)
    story.append(Spacer(1, 3 * mm))
    story.append(
        Paragraph(
            "Quem assina agora entra como <b>loja apoiadora do lançamento</b>: "
            "aparece no app, no discurso da cidade e nas redes do projeto. "
            "A mensalidade paga <b>vitrine</b> — não uma fatia do seu pão.",
            s["Body"],
        )
    )

    story.append(Paragraph("Por que fechar com a gente (e não no automático)", s["H1"]))
    for b in [
        "• <b>O cardápio inteiro é seu.</b> Cadastrou R$ 25? Recebe R$ 25. A taxa de R$ 2 por item o cliente vê no checkout.",
        "• <b>Sem comissão de 20–30%.</b> Nas plataformas grandes, 32 pedidos de R$ 25 já comem mais de R$ 200 — o seu 1º mês aqui nem cobra isso.",
        "• <b>Preço honesto no balcão e no app.</b> Cliente não acha que vocês estão inflando.",
        "• <b>Pedido já pago</b> (Pix/cartão) antes de gastar ingrediente.",
        "• <b>Moto da cidade, sem folha.</b> Frete é da corrida. Vocês não contratam entregador pela Peça Já — somos intermediadores.",
        "• <b>As primeiras lojas definem a cara do app em Mucugê.</b> Quem entra agora é quem o cliente vê no lançamento.",
        "• <b>Custo previsível.</b> Vocês sabem o mês. Não tem “surpresa no extrato” em cima do faturamento.",
    ]:
        story.append(Paragraph(b, s["PjBullet"]))

    story.append(Paragraph("O que toda loja apoiadora tem direito", s["H1"]))
    story.append(
        Paragraph(
            "Direitos de quem assina nesta oferta (plano Já na Rua no 1º mês, incluso). "
            "Não inclui gatilho de pedido garantido nem mídia paga infinita — "
            "isso esvaziaria o projeto. O que está abaixo <b>vocês podem cobrar na visita</b>.",
            s["Body"],
        )
    )
    for b in [
        "• Loja no Peça Já da cidade: categoria, busca, cardápio com foto, pedidos <b>ilimitados</b> no painel",
        "• Interruptor aberto/fechado, fila da cozinha, chat do pedido, código de retirada com o motoboy",
        "• Carteira com o valor do cardápio + saque Pix (quando houver saldo e chave cadastrada)",
        "• Frete urbano pela regra da cidade — o cliente paga; a loja não “banca a moto” com a margem",
        "• Notificação de pedido novo + suporte por canal do projeto (FAQ / comercial)",
        "• <b>Montagem do primeiro cardápio com a gente</b> (foto + itens) para não travar o “depois eu cadastro”",
        "• Manual das telas (volume 1) para treinar quem for operar o painel",
        "• Selo / menção de <b>loja apoiadora do lançamento</b>",
        "• <b>Divulgação nas redes do Peça Já</b> no lançamento: post e/ou story citando a loja (nome + o que vende), no perfil do projeto — sem virar agência de marketing mensal",
        "• Inclusão no mapa de apoiadores que a equipe mostra na cidade (conversa com cliente e outras lojas)",
        "• Mesmas regras claras para todo mundo: intermediadores, sem vínculo empregatício, cada um no seu",
    ]:
        story.append(Paragraph(b, s["PjBullet"]))

    story.append(PageBreak())
    story.append(Paragraph("Planos — o que sobe se quiser mais vitrine", s["H1"]))
    story.append(
        Paragraph(
            "1º mês: Já na Rua <b>R$&nbsp;0</b>. Só paga se quiser subir. "
            "Do 2º mês: preço da coluna. A diferença é <b>aparecer mais</b>, não pagar comissão no prato.",
            s["Body"],
        )
    )

    data = [
        [
            Paragraph("<b></b>", head),
            Paragraph("<b>Já na Rua</b><br/>R$ 200/mês", head),
            Paragraph("<b>Já em Alta</b><br/>R$ 250/mês", head),
            Paragraph("<b>Já no Topo</b><br/>R$ 300/mês", head),
        ],
        [
            Paragraph("<b>1º mês (lançamento)</b>", cell),
            Paragraph("Cortesia", cellc),
            Paragraph("+ R$ 50", cellc),
            Paragraph("+ R$ 100", cellc),
        ],
        [
            Paragraph("<b>Do 2º mês</b>", cell),
            Paragraph("R$ 200", cellc),
            Paragraph("R$ 250", cellc),
            Paragraph("R$ 300", cellc),
        ],
        [
            Paragraph("<b>No app da cidade</b>", cell),
            Paragraph("Listagem completa", cell),
            Paragraph("Tudo da esquerda + selo Em Alta", cell),
            Paragraph("Tudo do meio + selo Topo", cell),
        ],
        [
            Paragraph("<b>Prioridade na busca / home</b>", cell),
            Paragraph("Padrão", cell),
            Paragraph("Média + destaque rotativo na home", cell),
            Paragraph("Máxima + vitrine fixa quando houver slot", cell),
        ],
        [
            Paragraph("<b>Cupom da loja</b>", cell),
            Paragraph("—", cellc),
            Paragraph("Sim (desconto que vocês escolherem)", cell),
            Paragraph("Sim", cellc),
        ],
        [
            Paragraph("<b>Relatório / insights</b>", cell),
            Paragraph("Números do dia no painel", cell),
            Paragraph("Relatório semanal simples", cell),
            Paragraph("Prioridade + canal direto com a equipe", cell),
        ],
        [
            Paragraph("<b>Campanha da cidade</b>", cell),
            Paragraph("Apoiador no lançamento", cell),
            Paragraph("+ prioridade média nas campanhas", cell),
            Paragraph("Prioridade máxima nas campanhas locais", cell),
        ],
        [
            Paragraph("<b>Faixa no card</b>", cell),
            Paragraph("Loja no ar", cell),
            Paragraph("Em Alta", cell),
            Paragraph("Parceiro Topo", cell),
        ],
        [
            Paragraph("<b>Sugestões “pra você”</b>", cell),
            Paragraph("—", cellc),
            Paragraph("—", cellc),
            Paragraph("Combos da loja na busca", cell),
        ],
    ]
    story.append(_table(data, [3.8 * cm, 4.0 * cm, 4.2 * cm, 4.0 * cm]))
    story.append(Spacer(1, 3 * mm))

    story.append(Paragraph("Conta rápida para fechar na mesa", s["H1"]))
    story.append(
        Paragraph(
            "Prato a R$&nbsp;25. Comissão 25% em outro app = <b>R$&nbsp;6,25 por venda</b>. "
            "Com 32 pedidos no mês, isso já passa de <b>R$&nbsp;200</b> — e vocês ainda inflaram o preço. "
            "Aqui, 32 × R$&nbsp;25 = <b>R$&nbsp;800 no bolso da loja</b>. "
            "O 1º mês da vitrine está incluso. Do 2º mês, R$&nbsp;200 (Já na Rua) se paga se o app "
            "trouxer pouco mais de um pedido por dia nesse ticket — e a taxa não come o crescimento.",
            s["Body"],
        )
    )

    story.append(Paragraph("Pacote de divulgação (apoiador) — o que entra", s["H1"]))
    for b in [
        "• Citação da loja nas <b>redes do Peça Já</b> no lançamento (post e/ou story: nome, bairro, o que pede)",
        "• Uso do nome como <b>comércio apoiador</b> no material de campanha da cidade, quando a peça for de lançamento / apoiadores",
        "• Direito de marcar / republicar o conteúdo oficial do projeto (a marca Peça Já continua nossa)",
        "• Não está incluso: anúncio pago diário, gestão da rede de vocês, exclusividade da categoria na cidade, volume mínimo de pedidos",
    ]:
        story.append(Paragraph(b, s["PjBullet"]))

    story.append(Paragraph("O que esta oferta propositalmente não promete", s["H1"]))
    story.append(
        Paragraph(
            "Pedidos garantidos. Topo eterno de graça. Comissão zero para sempre se o plano subir. "
            "Empregar motoboy. Segurar prejuízo de pedido. Virou agência de Instagram da loja. "
            "Exclusividade de rubrica (“só vocês de padaria”). Isso furaria o modelo e as outras lojas. "
            "O que fechamos é <b>canal + regra justa + vitrine de lançamento + 1º mês da Rua incluso</b>.",
            s["Body"],
        )
    )

    story.append(PageBreak())
    story.append(Paragraph("Como assinar na hora", s["H1"]))
    for b in [
        "1. Escolher o plano: Rua (R$ 0 no 1º mês) · Alta (+ R$ 50) · Topo (+ R$ 100).",
        "2. Passar nome da loja, o que vende, horário e um telefone/WhatsApp.",
        "3. A gente cadastra o primeiro cardápio junto — não deixa para “depois”.",
        "4. Vocês aceitam o termo no app (intermediação, sem vínculo empregatício) e o mês começa a contar.",
        "5. Loja aberta no interruptor. Primeiro pedido pago entra no painel. Saldo é de vocês.",
    ]:
        story.append(Paragraph(b, s["PjBullet"]))

    story.append(Paragraph("Checklist de fechamento (use na visita)", s["H1"]))
    for b in [
        "☐ Don@ da loja (quem decide o Pix do plano)",
        "☐ Plano escolhido: ☐ Rua  ☐ Alta  ☐ Topo",
        "☐ Valor hoje: R$ 0  /  R$ 50  /  R$ 100",
        "☐ Cardápio: foto tirada + 5–10 itens principais",
        "☐ Horário de funcionamento combinado",
        "☐ Chave Pix da loja para saque (quando o saldo existir)",
        "☐ Autorizou aparecer como apoiador nas redes do Peça Já",
        "☐ Entendeu: cardápio inteiro é da loja; R$ 2/item é do cliente; moto é independente",
    ]:
        story.append(Paragraph(b, s["PjBullet"]))

    cta = [
        Paragraph("Fecha hoje. Aparece no lançamento.", s["CTA"]),
        Paragraph(
            "1º mês Já na Rua incluso. Plano maior = só a diferença. "
            "Do 2º mês, vitrine previsível. Margem do prato, intacta.",
            s["Pitch"],
        ),
    ]
    cta_box = Table([[cta]], colWidths=[16 * cm])
    cta_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#E8F8F0")),
                ("BOX", (0, 0), (-1, -1), 1.1, HexColor(PRIMARY)),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(Spacer(1, 4 * mm))
    story.append(cta_box)

    story.append(
        Paragraph(
            "Documento comercial de lançamento, em sequência ao manual das telas. "
            "A parceria efetiva segue cadastro e termo no app. Oferta do 1º mês válida "
            "para lojas apoiadoras desta janela em Mucugê; planos e destaques sujeitos "
            "à disponibilidade de vitrine. Peça Já atua como intermediadora digital — "
            "sem vínculo empregatício com comerciantes ou entregadores.",
            s["Small"],
        )
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    doc = CloseDoc(
        OUT_PDF,
        watermark_path=wm_path,
        header_logo=header_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.5 * cm,
        bottomMargin=2 * cm,
        title="Peça Já — Por que assinar",
        author="Peça Já",
    )
    doc.build(story)
    print("OK", OUT_PDF)
    return OUT_PDF


if __name__ == "__main__":
    build_pdf()
