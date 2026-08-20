# -*- coding: utf-8 -*-
"""Manual visual para comerciantes: print da tela + o que aquela parte faz."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    KeepTogether,
    PageBreak,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
)

from reportlab.pdfgen.canvas import Canvas
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


class ManualDoc(WatermarkDoc):
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
        canvas.drawString(2 * cm, 1.2 * cm, "Peça Já · manual do comércio")
        canvas.drawRightString(page_w - 2 * cm, 1.2 * cm, f"pág. {doc.page}")

ASSETS = r"C:\Users\iagot\.cursor\projects\c-Users-iagot-Projects-peca-ja\assets"
OUT_PDF = os.path.join(OUT_DIR, "PECA_JA_Manual_Comerciante.pdf")

SCREENS = [
    {
        "file": "print_home.png",
        "title": "Home do cliente — onde sua loja aparece",
        "lead": "É a primeira tela de quem abre o Peça Já para pedir.",
        "bullets": [
            "<b>Busca e categorias</b> — o cliente acha restaurante, padaria, mercado, farmácia. Sua loja entra na categoria certa quando o cardápio está cadastrado.",
            "<b>Parceiros Já no Topo</b> — lojas do plano mais alto sobem na vitrine. Por isso o plano muda visibilidade, não a comissão no prato.",
            "<b>Card da loja</b> — foto, nota, distância, “aberto”. Se a loja estiver fechada no interruptor do painel, o cliente não consegue pedir.",
            "<b>Por que importa:</b> vocês não vendem “um app escondido”. Vendem presença na cidade, no celular de quem mora perto.",
        ],
    },
    {
        "file": "print_painel_comercio.png",
        "title": "Painel do comércio — o centro da operação",
        "lead": "A tela do dono. Daqui sai o dia a dia da loja no Peça Já.",
        "bullets": [
            "<b>Loja aberta / fechada</b> — interruptor. Aberto = recebendo pedido. Fechado = cliente não pede. Use no horário de funcionamento.",
            "<b>Números do dia</b> — líquido (o que é da loja), quantidade de pedidos, o que está na cozinha e o que já saiu em rota.",
            "<b>Atalhos</b> — Pedidos, Cardápio, Saldo e Conversas são o uso diário. Promos, Equipe, Insights e Retirada ficam no segundo grupo.",
            "<b>Banner de código</b> — quando o pedido está pronto, o motoboy chega e vocês digitam o código da tela dele. Sem isso a entrega não “some na porta”.",
        ],
    },
    {
        "file": "print_pedidos.png",
        "title": "Pedidos — a fila da cozinha",
        "lead": "Aqui o comércio aceita, prepara e acompanha cada venda. O pagamento já veio.",
        "bullets": [
            "<b>Filtros</b> — Ativos, Cozinha, Na rua, Todos. Serve para não misturar o que ainda está no forno com o que o motoboy já levou.",
            "<b>Status</b> — recebido → confirmado → em preparo → saiu para entrega → entregue. Vocês avançam o pedido no app.",
            "<b>Pedido já pago</b> — Pix ou cartão entram antes do preparo. Vocês não cozinham “no fiado do aplicativo”.",
            "<b>O que fazer:</b> quando pinar, abrir o pedido, conferir itens, marcar em preparo e, quando estiver pronto, ir em Retirada.",
        ],
    },
    {
        "file": "print_cardapio.png",
        "title": "Cardápio — o preço que vocês recebem",
        "lead": "Cadastro de produtos, fotos e disponibilidade. Este é o preço da loja.",
        "bullets": [
            "<b>Regra de ouro:</b> cadastrou R$ 8, recebe R$ 8. A taxa Peça Já (R$ 2 por item) sobe só no total do cliente — não sai do bolso da loja.",
            "<b>Disponível / indisponível</b> — se acabou o bolo, desliga o item. Melhor do que aceitar e faltar.",
            "<b>Fotos</b> — no celular o cliente compra com os olhos. Foto boa vira pedido; lista sem foto some na home.",
            "<b>Mesmo preço do balcão</b> — não invente cardápio “só para o app”. Confiança é o diferencial do Peça Já.",
        ],
    },
    {
        "file": "print_saldo.png",
        "title": "Saldo — o dinheiro da loja",
        "lead": "Carteira do comércio. Aqui entra o valor do cardápio, não a taxa da plataforma.",
        "bullets": [
            "<b>Disponível</b> — soma do que a loja vendeu pelo app (preço cadastrado), já pago pelo cliente.",
            "<b>Sacar via Pix</b> — vocês pedem o saque para a chave cadastrada. Não é salário: é o caixa da própria loja.",
            "<b>Extrato</b> — cada pedido vira crédito; cada saque aparece. Dá para mostrar ao contador ou ao sócio.",
            "<b>Lembrete:</b> o Peça Já intermedia o pagamento. A loja continua sendo a empresa de vocês — sem vínculo empregatício.",
        ],
    },
    {
        "file": "print_retirada.png",
        "title": "Retirada — o código do motoboy",
        "lead": "A conferência na porta da loja. Evita entregar o pedido errado ou para a pessoa errada.",
        "bullets": [
            "<b>Como funciona:</b> o entregador mostra um código no celular. Vocês digitam no Peça Já. O pedido certo aparece e a retirada é confirmada.",
            "<b>Por que existe:</b> menos “levou o lanche do outro”, menos briga, rastreio claro se o cliente perguntar.",
            "<b>Quando usar:</b> só depois que a cozinha marcou pronto. O motoboy não deve sair sem esse ok.",
            "<b>Entrega na casa do cliente</b> também tem código — o cliente confirma do outro lado. Vocês não precisam ir junto.",
        ],
    },
    {
        "file": "print_insights.png",
        "title": "Insights — o que está vendendo",
        "lead": "Resumo do desempenho. Não é planilha de contador; é leitura rápida da semana.",
        "bullets": [
            "<b>Líquido 7 dias</b> — quanto a loja faturou de verdade no app (cardápio), não o que o cliente pagou no total.",
            "<b>Ticket e entregues</b> — ajuda a ver se o pedido médio está bom e se as entregas estão fechando.",
            "<b>Pico de horário</b> — hora em que mais pede. Útil para ter gente na cozinha.",
            "<b>No plano Já em Alta / Já no Topo</b> esse tipo de leitura e a vitrine na home pesam mais — mas o painel básico já mostra o caixa do dia.",
        ],
    },
    {
        "file": "print_painel_entregador.png",
        "title": "Painel do entregador — como a moto trabalha",
        "lead": "O comerciante não gerencia a frota como patrão. Mas precisa entender o que acontece depois que o pedido sai.",
        "bullets": [
            "<b>Online</b> — o motoboy liga disponibilidade e recebe oferta de corrida. Não é funcionário da Peça Já nem da loja.",
            "<b>Oferta com frete</b> — ele vê origem, distância e o valor da corrida (o frete). Aceita ou recusa.",
            "<b>Na prática para a loja:</b> vocês preparam → confirmam a retirada com o código → o app mostra o pedido em rota.",
            "<b>O dinheiro dele</b> é o frete, na carteira própria. Vocês não “pagam a moto no fim do mês” com a margem do pão.",
        ],
    },
]


def _styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceAfter=4,
        )
    )
    styles.add(
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
    styles.add(
        ParagraphStyle(
            name="Pitch",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=15,
            textColor=HexColor(SECONDARY),
            alignment=TA_CENTER,
            spaceBefore=4,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=HexColor(PRIMARY_DARK),
            spaceBefore=4,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Lead",
            fontName="Helvetica",
            fontSize=10,
            leading=14,
            textColor=HexColor(TEXT),
            alignment=TA_JUSTIFY,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="PjBullet",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=HexColor(TEXT),
            leftIndent=2,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Body",
            fontName="Helvetica",
            fontSize=10,
            leading=13.5,
            textColor=HexColor(TEXT),
            alignment=TA_JUSTIFY,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceBefore=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CTA",
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceBefore=8,
        )
    )
    return styles


def _phone(path: str):
    img = RLImage(path, width=6.4 * cm, height=11.4 * cm)
    t = Table([[img]], colWidths=[6.6 * cm])
    t.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.6, HexColor("#D7E8DF")),
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#FFFFFF")),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
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
    styles = _styles()

    story = []
    logo = Table(
        [[RLImage(header_path, width=3.0 * cm, height=3.0 * cm)]],
        colWidths=[16 * cm],
    )
    logo.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story.append(Spacer(1, 6 * mm))
    story.append(logo)
    story.append(Paragraph("Peça Já", styles["CoverTitle"]))
    story.append(Paragraph("MANUAL DO COMÉRCIO — COMO O APP FUNCIONA", styles["CoverSub"]))
    story.append(
        Paragraph(
            "Cada tela importante, com print e o que vocês precisam saber "
            "para vender sem entregar a margem.",
            styles["Pitch"],
        )
    )
    story.append(
        Paragraph(
            "Este material é para o <b>dono da loja</b> e para quem vai operar o painel. "
            "O app tem três pontas: <b>cliente</b> (pede), <b>comércio</b> (prepara) e "
            "<b>entregador</b> (leva). A Peça Já só <b>intermedia</b> — não é patrão "
            "da loja nem da moto, e não há vínculo empregatício.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Como o dinheiro fecha (grave isso)", styles["H1"]))
    story.append(
        Paragraph(
            "Cliente paga <b>produtos + frete + R$&nbsp;2 por item</b> (taxa Peça Já). "
            "A loja recebe o preço do cardápio. O entregador recebe o frete. "
            "A plataforma recebe a taxa visível. Sem comissão escondida no pão.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Planos mensais (vitrine, não comissão no prato): "
            "<b>Já na Rua R$&nbsp;200</b> · <b>Já em Alta R$&nbsp;250</b> · "
            "<b>Já no Topo R$&nbsp;300</b>. Quanto mais alto o plano, mais a loja "
            "aparece na home e na busca.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Nas próximas páginas: print da tela à esquerda e a explicação à direita.",
            styles["Small"],
        )
    )

    for i, screen in enumerate(SCREENS):
        story.append(PageBreak())
        img_path = os.path.join(ASSETS, screen["file"])
        if not os.path.isfile(img_path):
            raise FileNotFoundError(img_path)
        bullets = [Paragraph("• " + b, styles["PjBullet"]) for b in screen["bullets"]]
        right = [
            Paragraph(screen["title"], styles["H1"]),
            Paragraph(screen["lead"], styles["Lead"]),
            *bullets,
        ]
        row = Table(
            [[_phone(img_path), right]],
            colWidths=[7.2 * cm, 8.8 * cm],
        )
        row.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 2),
                    ("RIGHTPADDING", (0, 0), (0, 0), 8),
                    ("RIGHTPADDING", (1, 0), (1, 0), 0),
                ]
            )
        )
        story.append(KeepTogether([row]))

    story.append(PageBreak())
    story.append(Paragraph("Resumo do dia a dia na loja", styles["H1"]))
    for line in [
        "1. De manhã: ligue <b>Loja aberta</b> no painel (e confirme horário/cardápio).",
        "2. Chegou pedido: ele já está pago. Confira itens e vá para <b>Em preparo</b>.",
        "3. Pronto: use <b>Retirada</b> e o código do motoboy.",
        "4. O app mostra o pedido <b>em rota</b>. Cliente acompanha do lado dele.",
        "5. O valor do cardápio cai no <b>Saldo</b>. Quando quiser, saque no Pix.",
        "6. Acabou o expediente: feche a loja no interruptor.",
    ]:
        story.append(Paragraph(line, styles["PjBullet"]))
    story.append(Paragraph("O que o plano paga (e o que não paga)", styles["H1"]))
    story.append(
        Paragraph(
            "A mensalidade coloca a loja no app e na vitrine (mais alto = mais destaque). "
            "<b>Não é comissão sobre o que vocês venderam.</b> A taxa de R$&nbsp;2 por item "
            "é do cliente, transparente no checkout.",
            styles["Body"],
        )
    )
    story.append(Paragraph("Equipe, conversas e promos (extra)", styles["H1"]))
    story.append(
        Paragraph(
            "<b>Equipe</b> — se tiver caixa ou cozinha, dá para pedir acesso sem usar o e-mail do dono. "
            "A Peça Já não emprega essa gente; são da loja de vocês.<br/>"
            "<b>Conversas</b> — chat do pedido (cliente ou moto) quando falta um item ou o endereço trava.<br/>"
            "<b>Promos</b> — cupom da própria loja (plano Já em Alta para cima). Desconto que <i>vocês</i> "
            "oferecem sai de vocês, não de uma comissão misteriosa.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Dúvida na visita: mostre o painel aberto, ligue a loja e simule um pedido. "
            "Ver o Pix cair e o pedido pingar convence mais do que qualquer frase.",
            styles["Pitch"],
        )
    )
    story.append(
        Paragraph(
            "Peça Já: vocês vendem. A moto leva. O cliente vê a conta. Nós só conectamos.",
            styles["CTA"],
        )
    )
    story.append(Spacer(1, 8 * mm))
    closing = Table(
        [[RLImage(header_path, width=2.2 * cm, height=2.2 * cm)]],
        colWidths=[16 * cm],
    )
    closing.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    story.append(closing)
    story.append(
        Paragraph("Peça Já · manual do comércio · Mucugê", styles["CoverSub"])
    )
    story.append(
        Paragraph(
            "Imagens ilustrativas das telas do aplicativo. A Peça Já atua como "
            "intermediadora digital — sem vínculo empregatício com comerciantes ou entregadores.",
            styles["Small"],
        )
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    doc = ManualDoc(
        OUT_PDF,
        watermark_path=wm_path,
        header_logo=header_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.6 * cm,
        bottomMargin=2 * cm,
        title="Peça Já — Manual do comércio",
        author="Peça Já",
    )
    doc.build(story)
    print("OK", OUT_PDF)
    return OUT_PDF


if __name__ == "__main__":
    build_pdf()
