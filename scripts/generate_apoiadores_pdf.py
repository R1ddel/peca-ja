# -*- coding: utf-8 -*-
"""PDF de convite a apoiadores / lojas parceiras — mesmo padrão visual do portfólio."""
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

OUT_PDF = os.path.join(OUT_DIR, "PECA_JA_Apoiadores.pdf")


class ApoiadoresDoc(WatermarkDoc):
    def _on_page(self, canvas, doc):
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
        canvas.drawString(2 * cm, 1.2 * cm, "Peça Já · convite a apoiadores · Mucugê")
        canvas.drawRightString(page_w - 2 * cm, 1.2 * cm, f"pág. {doc.page}")


def _styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            fontName="Helvetica-Bold",
            fontSize=26,
            leading=32,
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
            name="H1",
            fontName="Helvetica-Bold",
            fontSize=14,
            leading=18,
            textColor=HexColor(PRIMARY_DARK),
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            name="H2",
            fontName="Helvetica-Bold",
            fontSize=11.5,
            leading=15,
            textColor=HexColor(SECONDARY),
            spaceBefore=8,
            spaceAfter=3,
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
            name="PjBullet",
            fontName="Helvetica",
            fontSize=10,
            leading=13,
            textColor=HexColor(TEXT),
            leftIndent=12,
            spaceAfter=2,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Quote",
            fontName="Helvetica-Oblique",
            fontSize=10,
            leading=13.5,
            textColor=HexColor(PRIMARY_DARK),
            leftIndent=6,
            rightIndent=6,
            spaceBefore=4,
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
            name="CTA",
            fontName="Helvetica-Bold",
            fontSize=10.5,
            leading=14,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceBefore=4,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Notice",
            fontName="Helvetica",
            fontSize=9.5,
            leading=13,
            textColor=HexColor(TEXT),
            alignment=TA_JUSTIFY,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="NoticeTitle",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=HexColor(PRIMARY_DARK),
            alignment=TA_CENTER,
            spaceAfter=6,
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
    styles.add(
        ParagraphStyle(
            name="Small",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=HexColor(MUTED),
            alignment=TA_CENTER,
            spaceBefore=8,
        )
    )
    return styles


def _table(data, col_widths):
    table = Table(data, colWidths=col_widths)
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
    return table


def build_pdf():
    logo_path, header_path = save_assets()
    wm = make_watermark(1190, 1684)
    wm_path = os.path.join(OUT_DIR, "pecaja-watermark.png")
    wm.save(wm_path)
    styles = _styles()
    cell, head = styles["TableCell"], styles["TableHead"]

    centered_logo = Table(
        [[RLImage(header_path, width=3.0 * cm, height=3.0 * cm)]],
        colWidths=[16 * cm],
    )
    centered_logo.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))

    story = []
    story.append(Spacer(1, 4 * mm))
    story.append(centered_logo)
    story.append(Paragraph("Peça Já", styles["CoverTitle"]))
    story.append(
        Paragraph("CONVITE A APOIADORES E LOJAS PARCEIRAS", styles["CoverSub"])
    )
    story.append(
        Paragraph(
            "Delivery local de Mucugê. Você vende. Nós conectamos. "
            "Cada um fica com o que é seu.",
            styles["Pitch"],
        )
    )

    story.append(Paragraph("Por que este convite existe", styles["H1"]))
    story.append(
        Paragraph(
            "Estamos fechando as primeiras lojas apoiadoras do <b>Peça Já</b> — "
            "o app de delivery feito para Mucugê. Ser apoiador, neste momento, "
            "é <b>entrar como comércio parceiro</b>: cadastrar a loja, aparecer "
            "para o cliente da cidade e vender sem entregar a margem do cardápio "
            "para uma plataforma grande.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Este material é direto. Explica <b>o que somos</b>, "
            "<b>como trabalhamos</b>, <b>como o dinheiro entra e sai</b> "
            "e a natureza da parceria — para você decidir com clareza hoje.",
            styles["Body"],
        )
    )

    story.append(Paragraph("O que somos", styles["H1"]))
    story.append(
        Paragraph(
            "O <b>Peça Já</b> é uma <b>plataforma digital de intermediação</b>. "
            "Unimos, num só app, três pontas independentes: "
            "<b>comerciante, entregador e cliente</b>.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Não somos restaurante, não somos frota própria e não somos empregadores "
            "de loja nem de motoboy. <b>Somos o meio:</b> tecnologia, pedido, "
            "pagamento, rastreio e combinado claro de quem recebe o quê.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "A regra que muda o jogo: <b>a loja lucra o valor cheio que cadastrou "
            "no cardápio</b>. A taxa da plataforma <b>não come a sua margem</b>; "
            "ela é somada de forma transparente no checkout do cliente "
            "(<b>R$&nbsp;2 por item</b>). O frete é do entregador.",
            styles["Body"],
        )
    )

    story.append(Paragraph("O problema que resolvemos", styles["H1"]))
    story.append(
        Paragraph(
            "Nas plataformas grandes, o comércio frequentemente perde "
            "<b>20% a 30% (ou mais)</b> em comissão. Para compensar, infla o preço "
            "no app, compete consigo mesmo e vê o volume subir enquanto o "
            "<b>lucro some</b>. O cliente paga caro sem entender. O entregador "
            "não vê com clareza o que é dele.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "<b>O Peça Já nasce do contrário:</b> regra clara, lucro do lojista "
            "preservado, frete da corrida para quem entrega, cliente que enxerga "
            "o que está pagando.",
            styles["Body"],
        )
    )

    story.append(Paragraph("Como trabalhamos", styles["H1"]))
    story.append(
        Paragraph(
            "1. O cliente escolhe a sua loja no app, monta o pedido e paga "
            "(Pix ou cartão) <b>antes do preparo</b>.<br/>"
            "2. Você recebe o pedido no painel, prepara e aguarda a retirada "
            "com <b>código de segurança</b>.<br/>"
            "3. Um entregador independente da frota busca e leva até a porta "
            "do cliente, também com código na entrega.<br/>"
            "4. O valor do cardápio fica na sua carteira. O frete fica na "
            "carteira de quem entregou. A taxa Peça Já é a da plataforma, "
            "paga pelo cliente, à vista no total.",
            styles["Body"],
        )
    )
    for b in [
        "• Cardápio, horários e área de entrega no seu controle",
        "• Pedidos em tempo real, já pagos",
        "• Carteira e saque com regra objetiva",
        "• Mesmo preço do balcão — sem “cardápio só para o app”",
    ]:
        story.append(Paragraph(b, styles["PjBullet"]))

    story.append(PageBreak())

    story.append(Paragraph("O que cada um recebe", styles["H1"]))
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
            Paragraph("<b>Relação</b>", cell),
            Paragraph("Loja e moto “dentro” da marca grande", cell),
            Paragraph("<b>Parceria independente</b> via plataforma", cell),
        ],
    ]
    story.append(_table(data, [3.2 * cm, 6.2 * cm, 6.2 * cm]))
    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "<b>Exemplo:</b> 2 itens a R$&nbsp;20 + frete R$&nbsp;5.<br/>"
            "• <b>Outro modelo</b> (ex. 25% sobre o produto): a loja pode perder "
            "cerca de R$&nbsp;10 só de comissão — e o cliente ainda pagou caro.<br/>"
            "• <b>Peça Já:</b> loja recebe <b>R$&nbsp;40</b>; entregador "
            "<b>R$&nbsp;5</b>; taxa Peça Já <b>R$&nbsp;4</b> (2× R$&nbsp;2), "
            "paga pelo cliente de forma clara.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Cadastrou o prato a R$&nbsp;25? <b>Recebe R$&nbsp;25</b> "
            "(menos desconto que <i>você</i> decidir oferecer). "
            "A taxa Peça Já <b>não é descontada da sua venda</b>.",
            styles["Body"],
        )
    )

    story.append(Paragraph("O que a loja apoiadora ganha na prática", styles["H1"]))
    for b in [
        "• Canal extra de venda sem inflar o preço para “pagar o app”",
        "• Visibilidade na cidade: o cliente pede o comércio daqui, no celular",
        "• Pagamento confirmado antes de gastar ingrediente e tempo",
        "• Menos briga na porta: código de retirada e de entrega",
        "• Crescimento que não vira punição: quanto mais vende, a comissão percentual não come a margem",
        "• Marca de lançamento: as primeiras lojas são as que o cliente vai associar ao Peça Já",
    ]:
        story.append(Paragraph(b, styles["PjBullet"]))
    story.append(
        Paragraph(
            "“Nas outras plataformas, uma parte do que o cliente paga pelo seu "
            "produto vira comissão delas. No Peça Já, o valor do cardápio é seu. "
            "A gente ganha a taxa da plataforma — e cada um sabe o que é de cada um.”",
            styles["Quote"],
        )
    )

    story.append(Paragraph("O que pedimos de um apoiador hoje", styles["H1"]))
    story.append(
        Paragraph(
            "Para fechar a parceria agora, o comerciante precisa, em resumo:",
            styles["Body"],
        )
    )
    for b in [
        "• Querer vender pelo app com o mesmo preço honesto da loja",
        "• Ter cardápio (ou lista de produtos) e horário de funcionamento",
        "• Atender o pedido quando ele chegar — preparar e entregar ao motoboy com o código",
        "• Cuidar da qualidade, da nota e da operação da própria loja",
        "• Concordar com o modelo: somos intermediadores, não patrão nem sócios ocultos da sua empresa",
    ]:
        story.append(Paragraph(b, styles["PjBullet"]))

    story.append(Paragraph("Natureza da parceria — leia com atenção", styles["H1"]))
    notice_inner = [
        Paragraph("Somos intermediadores, não empregadores", styles["NoticeTitle"]),
        Paragraph(
            "O Peça Já <b>não mantém vínculo empregatício</b> com comerciantes "
            "nem com entregadores. Também <b>não é sociedade, associação "
            "obrigatória nem contrato de trabalho</b> com a loja ou com a moto. "
            "Cada ponta atua de forma <b>independente</b>. Nós intermediamos "
            "o encontro entre quem vende, quem entrega e quem pede — e operamos "
            "a tecnologia e o fluxo de pagamento da plataforma.",
            styles["Notice"],
        ),
        Paragraph(
            "<b>Do comércio:</b> a loja continua sendo a responsável pelo produto, "
            "pelo atendimento, pelos preços cadastrados, por seus empregados "
            "(se houver) e pelas obrigações legais da própria atividade. "
            "Usar o Peça Já é aderir a um <b>canal de venda intermediado</b>, "
            "não se tornar funcionário ou filial da plataforma.",
            styles["Notice"],
        ),
        Paragraph(
            "<b>Do entregador:</b> quem aceita a corrida atua como prestador "
            "independente. O frete daquela entrega é a referência da "
            "remuneração da corrida. A plataforma não é empregadora da frota.",
            styles["Notice"],
        ),
        Paragraph(
            "<b>Da plataforma:</b> disponibilizar o app, conectar as pontas, "
            "receber o pagamento do cliente, destinar o valor do cardápio à loja, "
            "o frete a quem entregou e a taxa Peça Já à operação — com "
            "transparência no checkout.",
            styles["Notice"],
        ),
        Paragraph(
            "Este documento é um <b>convite comercial claro</b>, não substitui "
            "contrato específico que venha a ser assinado. Combinações de "
            "cadastro, saque e uso do app seguem as regras da plataforma.",
            styles["Notice"],
        ),
    ]
    notice_box = Table([[notice_inner]], colWidths=[16 * cm])
    notice_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), HexColor("#E8F8F0")),
                ("BOX", (0, 0), (-1, -1), 1.2, HexColor(PRIMARY)),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(notice_box)

    story.append(PageBreak())

    story.append(Paragraph("Responsabilidades de cada ponta", styles["H1"]))
    resp = [
        [
            Paragraph("<b>Quem</b>", head),
            Paragraph("<b>Faz</b>", head),
            Paragraph("<b>Não faz</b>", head),
        ],
        [
            Paragraph("<b>Peça Já</b>", cell),
            Paragraph(
                "App, pedido, pagamento, rastreio, combinação financeira transparente",
                cell,
            ),
            Paragraph(
                "Não cozinha, não emprega loja/moto, não assume a operação do seu balcão",
                cell,
            ),
        ],
        [
            Paragraph("<b>Comerciante</b>", cell),
            Paragraph(
                "Cardápio, preparo, qualidade, horário, retirada com código, própria empresa",
                cell,
            ),
            Paragraph(
                "Não é funcionário da plataforma; não “aluga” a marca Peça Já como emprego",
                cell,
            ),
        ],
        [
            Paragraph("<b>Entregador</b>", cell),
            Paragraph(
                "Aceita corrida, busca, entrega com código — prestador independente",
                cell,
            ),
            Paragraph("Não é empregado da Peça Já nem da loja por usar o app", cell),
        ],
        [
            Paragraph("<b>Cliente</b>", cell),
            Paragraph("Pede, paga (produtos + frete + taxa) e recebe", cell),
            Paragraph("Vê a conta aberta, sem comissão escondida no prato", cell),
        ],
    ]
    story.append(_table(resp, [3.0 * cm, 6.5 * cm, 6.5 * cm]))

    story.append(Paragraph("Por que fechar hoje", styles["H1"]))
    story.append(
        Paragraph(
            "As primeiras lojas apoiadoras definem a cara do Peça Já na cidade. "
            "Quem entra agora aparece no lançamento, ajuda a formar a oferta "
            "que o cliente vai abrir no celular e ocupa o espaço antes da "
            "concorrência “copiar o discurso”. O modelo já está claro: "
            "<b>você não paga comissão em cima do seu prato</b>.",
            styles["Body"],
        )
    )
    story.append(
        Paragraph(
            "Apoiar o projeto, para o comércio, é simples: <b>dizer sim, "
            "cadastrar a loja e vender pelo app com a regra justa</b>. "
            "Sem virar funcionário. Sem entregar a margem. Sem vínculo empregatício.",
            styles["Body"],
        )
    )

    story.append(Paragraph("Como dizer sim", styles["H1"]))
    story.append(
        Paragraph(
            "1. Confirme o interesse em ser <b>loja apoiadora</b>.<br/>"
            "2. Informe nome da loja, o que vende e horário.<br/>"
            "3. Combinamos o cadastro no app e o primeiro cardápio.<br/>"
            "4. Quando o cliente pedir, você opera como sempre: prepara, "
            "entrega ao motoboy com o código, acompanha o saldo.",
            styles["Body"],
        )
    )

    story.append(
        Paragraph(
            "Peça Já: assine e venda sem entregar sua margem.",
            styles["CTA"],
        )
    )
    story.append(
        Paragraph(
            "Somos a ponte. Você é o comércio. A moto é independente. "
            "O cliente paga sabendo o que está financiando.",
            styles["Pitch"],
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
        Paragraph("Peça Já · inovação com transparência · Mucugê", styles["CoverSub"])
    )
    story.append(
        Paragraph(
            "Documento de apresentação comercial. A parceria efetiva segue "
            "o cadastro na plataforma. Peça Já atua exclusivamente como "
            "intermediadora digital — sem vínculo empregatício com comerciantes "
            "ou entregadores.",
            styles["Small"],
        )
    )

    os.makedirs(OUT_DIR, exist_ok=True)
    doc = ApoiadoresDoc(
        OUT_PDF,
        watermark_path=wm_path,
        header_logo=header_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=1.6 * cm,
        bottomMargin=2 * cm,
        title="Peça Já — Convite a apoiadores",
        author="Peça Já",
    )
    doc.build(story)
    print("OK", OUT_PDF)
    return OUT_PDF


if __name__ == "__main__":
    build_pdf()
