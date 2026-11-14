# -*- coding: utf-8 -*-
"""Contrato de colaboração operacional e participação nos resultados — Peça Já."""
from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "PECAJA_Contrato_Colaboracao_Operacional.pdf"

INK = "#1a1a1a"
MUTED = "#444444"
PAGE_W, PAGE_H = A4
ML, MR, MT, MB = 2.4 * cm, 2.4 * cm, 2.1 * cm, 2.3 * cm


def _styles() -> dict[str, ParagraphStyle]:
    return {
        "kicker": ParagraphStyle(
            "kicker",
            fontName="Times-Bold",
            fontSize=8,
            leading=11,
            alignment=TA_CENTER,
            textColor=HexColor(MUTED),
            spaceAfter=4,
        ),
        "title": ParagraphStyle(
            "title",
            fontName="Times-Bold",
            fontSize=13,
            leading=17,
            alignment=TA_CENTER,
            textColor=HexColor(INK),
            spaceAfter=4,
        ),
        "sub": ParagraphStyle(
            "sub",
            fontName="Times-Italic",
            fontSize=9,
            leading=12,
            alignment=TA_CENTER,
            textColor=HexColor(MUTED),
            spaceAfter=14,
        ),
        "clause": ParagraphStyle(
            "clause",
            fontName="Times-Bold",
            fontSize=10.5,
            leading=14,
            alignment=TA_LEFT,
            textColor=HexColor(INK),
            spaceBefore=11,
            spaceAfter=5,
        ),
        "body": ParagraphStyle(
            "body",
            fontName="Times-Roman",
            fontSize=10,
            leading=14.2,
            alignment=TA_JUSTIFY,
            textColor=HexColor(INK),
            spaceAfter=6,
            firstLineIndent=0,
        ),
        "sign": ParagraphStyle(
            "sign",
            fontName="Times-Roman",
            fontSize=10,
            leading=14,
            alignment=TA_CENTER,
            textColor=HexColor(INK),
            spaceBefore=4,
            spaceAfter=4,
        ),
        "foot": ParagraphStyle(
            "foot",
            fontName="Times-Roman",
            fontSize=8,
            leading=10,
            alignment=TA_CENTER,
            textColor=HexColor(MUTED),
        ),
    }


def _header_footer(canvas, doc) -> None:
    canvas.saveState()
    canvas.setStrokeColor(HexColor("#1a1a1a"))
    canvas.setLineWidth(0.4)
    canvas.line(ML, PAGE_H - 1.35 * cm, PAGE_W - MR, PAGE_H - 1.35 * cm)
    canvas.setFont("Times-Roman", 8)
    canvas.setFillColor(HexColor(MUTED))
    canvas.drawString(ML, PAGE_H - 1.15 * cm, "InovaTech  ·  instrumento particular")
    canvas.drawRightString(PAGE_W - MR, PAGE_H - 1.15 * cm, "uso interno — preencher e assinar")
    canvas.line(ML, 1.45 * cm, PAGE_W - MR, 1.45 * cm)
    canvas.drawString(ML, 1.15 * cm, "Confidencial")
    canvas.drawRightString(PAGE_W - MR, 1.15 * cm, f"Página {doc.page}")
    canvas.restoreState()


CLAUSES: list[tuple[str, list[str]]] = [
    (
        "CLÁUSULA PRIMEIRA – DAS PARTES",
        [
            "Pelo presente instrumento particular, de um lado, <b>INOVA TECH DESENVOLVIMENTO "
            "DIGITAL</b>, marca <b>InovaTech</b>, com endereço eletrônico inovatech.onee@gmail.com "
            "e telefone (75) 9 8120-6630, ainda sem inscrição no CNPJ, neste ato representada "
            "por seu titular, <b>IAGO PINTO TELES</b>, brasileiro, solteiro, empreendedor digital, "
            "inscrito no CPF sob o n.º 066.806.965-18, residente e domiciliado na Rua João "
            "Oliveira, Bairro Cidade Nova, Mucugê/BA, CEP 46750-000, doravante denominada "
            "<b>CONTRATANTE</b> ou <b>InovaTech</b>; e, de outro lado,"
            "<b>________________________________________________</b>, "
            "nacionalidade ________________, estado civil ________________, "
            "profissão ________________, inscrito(a) no CPF sob o n.º ________________, "
            "RG n.º ________________, residente e domiciliado(a) em "
            "________________________________________________, "
            "endereço eletrônico ________________, telefone ________________, "
            "chave Pix para recebimento ________________, "
            "doravante denominado(a) <b>COLABORADOR</b>.",
            "As partes, adiante também chamadas simplesmente de Parte ou, em conjunto, de Partes, "
            "têm entre si justo e contratado o que segue, a que se obrigam por si, seus herdeiros "
            "e sucessores.",
        ],
    ),
    (
        "CLÁUSULA SEGUNDA – DO OBJETO",
        [
            "O presente contrato tem por objeto a colaboração operacional do COLABORADOR junto "
            "à InovaTech, exclusivamente no aplicativo <b>Peça Já</b> — concepção, desenvolvimento, "
            "manutenção, divulgação e rotina —, bem como a sua participação econômica, limitada "
            "e variável, tão somente sobre os lucros apurados desse aplicativo, na forma da "
            "Cláusula Sexta."
            "<b>Parágrafo primeiro.</b> A atuação do COLABORADOR é ampla e não se restringe a "
            "um cargo, departamento ou especialidade. Abrange, sem caráter enumerativo, o "
            "desenvolvimento do aplicativo e de sistemas correlatos, a gestão de tráfego e "
            "comunicação, o apoio à operação com lojistas, entregadores e usuários, e demais "
            "atividades que o CONTRATANTE lhe confiar, sempre sob a direção estratégica deste.",
            "<b>Parágrafo segundo.</b> O COLABORADOR é a pessoa de confiança imediata do "
            "CONTRATANTE na operação (“braço direito”). Essa confiança não lhe confere mandato, "
            "administração, representação nem poder de obrigar o CONTRATANTE, a marca ou o "
            "aplicativo perante terceiros.",
            "<b>Parágrafo terceiro.</b> Não integram o objeto, nem a base de lucro, outros "
            "produtos, serviços, clientes ou estabelecimentos da InovaTech, nem negócios "
            "pessoais do titular. Tampouco se transfere a titularidade do Peça Já, do "
            "código-fonte, das marcas, dos domínios, das bases de dados, das contas ou da "
            "clientela."
        ],
    ),
    (
        "CLÁUSULA TERCEIRA – DA NATUREZA JURÍDICA",
        [
            "Este contrato é civil, atípico e de colaboração com participação em resultados, "
            "regido pelo Código Civil, em especial pelos arts. 112, 113, 421, 421-A, 422, 425 "
            "e 458 a 461. Não se aplica o Código de Defesa do Consumidor.",
            "<b>Parágrafo primeiro.</b> As Partes reconhecem, de forma expressa, que <b>não há</b> "
            "entre elas relação de emprego. Inexistem, para os fins do art. 3º da Consolidação "
            "das Leis do Trabalho, os requisitos concomitantes de pessoalidade subordinada com "
            "jornada, salário fixo e subordinação jurídica típica de contrato de trabalho. "
            "O COLABORADOR não está sujeito a cartão de ponto, horário prefixado, meta laboral "
            "própria de empregado, nem a regulamento interno de pessoal.",
            "<b>Parágrafo segundo.</b> Em razão do parágrafo anterior, não incidem, por força "
            "deste instrumento, FGTS, contribuição previdenciária patronal, 13º salário, férias "
            "acrescidas de um terço, aviso-prévio, multa do art. 477 da CLT ou demais verbas "
            "decorrentes de contrato de trabalho.",
            "<b>Parágrafo terceiro.</b> O presente não constitui sociedade empresária, sociedade "
            "simples, sociedade em comum, associação, consórcio, mandato, representação "
            "comercial, agência ou constituição de pessoa jurídica. O COLABORADOR não é sócio, "
            "quotista, acionista, administrador, procurador, preposto ou empregado, e não tem "
            "direito de voto, veto, preferência ou de figurar em contrato social.",
            "<b>Parágrafo quarto.</b> A remuneração é exclusivamente a participação da Cláusula "
            "Sexta. Não há salário, pró-labore, ordenado, comissão fixa, ajuda de custo "
            "habitual nem garantia de valor mínimo. Ciclo sem resultado distribuível não gera "
            "crédito, acúmulo nem dever de adiantamento.",
            "<b>Parágrafo quinto.</b> O COLABORADOR não responde, perante terceiros, por "
            "obrigações da operação ou do CONTRATANTE. É-lhe vedado contratar, assinar, "
            "endossar, abrir conta, emitir nota, admitir pessoal ou transigir em nome do "
            "CONTRATANTE, da InovaTech ou do Peça Já.",
        ],
    ),
    (
        "CLÁUSULA QUARTA – DA DIREÇÃO E DA PALAVRA FINAL",
        [
            "A direção da InovaTech e do aplicativo Peça Já é privativa da CONTRATANTE, "
            "exercida exclusivamente por Iago Pinto Teles. Toda decisão — operacional, "
            "financeira, comercial, técnica, de tráfego, de produto ou estratégica — depende "
            "de sua aprovação. Na divergência, prevalece, sem recurso interno, a deliberação "
            "do titular."
            "<b>Parágrafo primeiro.</b> O COLABORADOR poderá propor, executar e acompanhar. "
            "Não poderá, isoladamente, alterar preço, contratar fornecedor, comprometer "
            "caixa, publicar campanha, modificar o produto em produção, conceder desconto "
            "fora da política vigente nem falar em nome da operação, salvo autorização "
            "prévia, específica e escrita do CONTRATANTE.",
            "<b>Parágrafo segundo.</b> Contas bancárias, Pix, meios de pagamento, painéis de "
            "anúncio, lojas de aplicativo, servidores, repositórios e acessos administrativos "
            "permanecem em nome e sob controle do CONTRATANTE. Credencial eventualmente "
            "concedida ao COLABORADOR é pessoal, revogável a qualquer tempo, e não o torna "
            "cotitular.",
            "<b>Parágrafo terceiro.</b> Nenhuma urgência, costume ou mensagem informal supre "
            "a ausência de autorização do CONTRATANTE para ato de disposição ou de representação.",
        ],
    ),
    (
        "CLÁUSULA QUINTA – DO MODO DE EXECUÇÃO",
        [
            "O COLABORADOR organiza o modo e o tempo de sua colaboração, sem controle de "
            "jornada. Compromete-se a empregar diligência de profissional da área, a manter "
            "o CONTRATANTE informado do andamento e a alinhar prioridades com a frequência "
            "que a operação exigir.",
            "<b>Parágrafo primeiro.</b> Ferramentas, acessos e materiais fornecidos pelo "
            "CONTRATANTE destinam-se exclusivamente à execução deste contrato e serão "
            "devolvidos ou desativados no termo.",
            "<b>Parágrafo segundo.</b> O COLABORADOR poderá desenvolver atividade paralela, "
            "desde que não conflite com o Peça Já, não utilize informação confidencial e não "
            "prejudique os prazos combinados. Atividade em marketplace de entregas na área "
            "de Mucugê/BA e municípios limítrofes depende de anuência escrita do CONTRATANTE.",
        ],
    ),
    (
        "CLÁUSULA SEXTA – DA PARTICIPAÇÃO ECONÔMICA",
        [
            "A única remuneração do COLABORADOR é a participação no <b>pool dos cotistas</b> "
            "incidente sobre os lucros do aplicativo Peça Já, apurada a cada ciclo de 2 "
            "(dois) meses. Não há participação sobre faturamento, lucro ou caixa de qualquer "
            "outro trabalho da InovaTech.",
            "<b>Parágrafo primeiro — base (lucros do app).</b> Integram a base somente os "
            "valores efetivamente creditados e disponíveis, em regime de caixa, a título de "
            "taxa, comissão ou remuneração da plataforma incidente sobre pedidos concluídos "
            "no aplicativo Peça Já. Não a integram o preço devido aos comerciantes, gorjeta, "
            "frete em trânsito, publicidade avulsa, receita de outro produto ou serviço da "
            "InovaTech, nem os valores pagos pelos comerciantes a título de mensalidade, "
            "assinatura ou plano de permanência na plataforma (inclusive os planos atualmente "
            "praticados de R$ 200,00, R$ 250,00 e R$ 300,00, e outros de igual natureza)."
            "<b>Parágrafo segundo — deduções.</b> Da receita da plataforma do ciclo "
            "deduzem-se estornos, chargebacks e reembolsos a ela relativos, conhecidos em "
            "até 90 (noventa) dias, compensáveis no ciclo seguinte; tarifas do meio de "
            "pagamento; e tributos incidentes sobre essa receita, quando devidos. O saldo "
            "positivo é o caixa líquido da base.",
            "<b>Parágrafo terceiro — retenção e divisão.</b> Do caixa líquido, 70% (setenta "
            "por cento) ficam retidos, à livre disposição do CONTRATANTE. Os 30% (trinta por "
            "cento) restantes constituem o montante distribuível. Desse montante, 60% "
            "(sessenta por cento) cabem ao CONTRATANTE e 40% (quarenta por cento) constituem "
            "o pool dos cotistas. Se o caixa líquido for nulo ou negativo, não haverá "
            "distribuição no ciclo, sem acúmulo.",
            "<b>Parágrafo quarto — rateio igualitário.</b> O COLABORADOR integra o pool dos "
            "cotistas. Enquanto houver dois titulares ativos nesse pool — o cotista já "
            "vinculado à operação e o COLABORADOR —, o pool divide-se em partes iguais, "
            "cabendo a cada um 50% (cinquenta por cento) do pool, equivalente a 20% "
            "(vinte por cento) do montante distribuível e a 6% (seis por cento) do caixa "
            "líquido da base. O COLABORADOR não faz jus a qualquer fração da parcela de 60% "
            "do CONTRATANTE, nem da parcela retida de 70%.",
            "<b>Parágrafo quinto — titular ativo.</b> Considera-se titular ativo aquele cujo "
            "instrumento próprio esteja vigente no último dia do ciclo. Cessada a vigência "
            "quanto a um deles, a cota vaga não se acresce automaticamente ao remanescente: "
            "reverte ao CONTRATANTE, salvo aditivo escrito em sentido diverso.",
            "<b>Parágrafo sexto — ausência de aporte.</b> A participação do COLABORADOR não "
            "se condiciona a aporte financeiro. Não se aplica, a este contrato, o rateio "
            "proporcional a capital previsto em avença de cotista apoiador.",
            "<b>Parágrafo sétimo — exemplo, sem caráter de previsão.</b> Caixa líquido de "
            "R$ 10.000,00: retido R$ 7.000,00; distribuível R$ 3.000,00; CONTRATANTE "
            "R$ 1.800,00; pool R$ 1.200,00; COLABORADOR R$ 600,00; outro titular ativo do "
            "pool R$ 600,00.",
            "<b>Parágrafo oitavo.</b> A memória de cálculo é elaborada pelo CONTRATANTE e "
            "enviada ao COLABORADOR no encerramento do ciclo. Impugnação limitada à fórmula "
            "far-se-á em 10 (dez) dias do recebimento. Erro de cálculo resolve-se pelo "
            "pagamento da diferença, corrigida pela taxa Selic, sem conversão em sociedade "
            "e sem verba trabalhista.",
            "<b>Parágrafo nono.</b> O CONTRATANTE declara que formalizará, em instrumento "
            "apartado com o cotista já existente, a adequação do rateio do pool à regra "
            "igualitária desta cláusula. A mora ou a recusa daquele terceiro não transfere "
            "ao COLABORADOR cota alheia, nem onera o CONTRATANTE além da metade do pool "
            "enquanto os dois titulares estiverem ativos.",
        ],
    ),
    (
        "CLÁUSULA SÉTIMA – DO PAGAMENTO E DOS TRIBUTOS",
        [
            "Encerrado cada ciclo de 2 (dois) meses, contado da assinatura, o CONTRATANTE "
            "encaminhará a memória de cálculo e pagará a participação por Pix, na chave "
            "indicada pelo COLABORADOR, em até 5 (cinco) dias úteis. O comprovante quita "
            "o ciclo. Em atraso, incide a taxa Selic sobre a quantia incontroversa.",
            "<b>Parágrafo primeiro.</b> Cada Parte responde pelos tributos de sua esfera. "
            "O COLABORADOR declara-se ciente de que valores recebidos a título de "
            "participação devem ser por ele informados ao Fisco, na forma da legislação "
            "aplicável à sua condição (pessoa física ou, se vier a constituir, pessoa jurídica).",
            "<b>Parágrafo segundo.</b> A participação é intransmissível sem autorização "
            "escrita do CONTRATANTE. É vedado ao COLABORADOR ceder, dar em garantia ou "
            "prometer a cota a terceiro.",
            "<b>Parágrafo terceiro.</b> Não há obrigação de nota fiscal enquanto a InovaTech "
            "atuar sem CNPJ, na pessoa de seu titular. Constituída pessoa jurídica sob a "
            "mesma marca, os direitos e obrigações deste contrato transferem-se a ela "
            "mediante comunicação escrita ao COLABORADOR, mantidas as regras econômicas, "
            "sem inclusão do COLABORADOR no quadro societário."
        ],
    ),
    (
        "CLÁUSULA OITAVA – DA PROPRIEDADE INTELECTUAL",
        [
            "Todo resultado da colaboração — inclusive código-fonte, interfaces, textos, "
            "criativos, campanhas, bancos, documentações, melhorias e know-how — pertence "
            "exclusivamente ao CONTRATANTE, como obra por encomenda, nos termos do art. 4º "
            "da Lei n.º 9.609/1998 e da Lei n.º 9.610/1998.",
            "<b>Parágrafo primeiro.</b> O COLABORADOR cede, neste ato, a título gratuito, "
            "definitivo e irrevogável, quaisquer direitos patrimoniais de autor ou de "
            "programa de computador que pudessem caber-lhe sobre o resultado da colaboração.",
            "<b>Parágrafo segundo.</b> É vedado ao COLABORADOR registrar sinal distintivo "
            "idêntico ou semelhante a “Peça Já” ou à marca InovaTech, durante a vigência e "
            "nos 24 (vinte e quatro) meses seguintes ao término.",
        ],
    ),
    (
        "CLÁUSULA NONA – DO SIGILO",
        [
            "São confidenciais as informações da operação a que o COLABORADOR tiver acesso, "
            "incluindo código, credenciais, números, cadastros, estratégias de tráfego e "
            "condições comerciais. O dever permanece por 2 (dois) anos após a extinção, e "
            "por prazo indeterminado quanto a senha, token, chave, dado pessoal e código-fonte.",
            "<b>Parágrafo primeiro.</b> Pelo prazo de 12 (doze) meses após a extinção, o "
            "COLABORADOR não aliciará comerciante, entregador ou colaborador com quem tenha "
            "tido contato em razão deste contrato, para marketplace de entregas concorrente.",
            "<b>Parágrafo segundo.</b> É vedado utilizar informação confidencial para "
            "reproduzir serviço substancialmente equivalente, em especial marketplace de "
            "entregas no Município de Mucugê/BA e limítrofes, durante a vigência e por 12 "
            "(doze) meses após a extinção.",
        ],
    ),
    (
        "CLÁUSULA DÉCIMA – DO PRAZO E DA EXTINÇÃO",
        [
            "O contrato vigorará pelo prazo de 12 (doze) meses, contado da assinatura, "
            "podendo ser renovado somente por instrumento escrito. Não há prorrogação tácita.",
            "<b>Parágrafo primeiro.</b> Qualquer das Partes poderá denunciar o contrato, "
            "por escrito, com antecedência de 15 (quinze) dias, sem multa. Pagam-se o ciclo "
            "já encerrado e a fração do ciclo em curso, apurada sobre a receita já "
            "disponibilizada, sem projeção. Não há indenização por lucros cessantes.",
            "<b>Parágrafo segundo.</b> Resolve-se de pleno direito, mediante comunicação "
            "escrita, se o COLABORADOR: (a) assinar, contratar ou se apresentar como sócio, "
            "administrador, procurador ou empregado; (b) obtiver ou conservar credencial "
            "não autorizada; (c) divulgar informação confidencial; (d) recusar, de forma "
            "reiterada e injustificada, a colaboração objeto da Cláusula Segunda; ou "
            "(e) pleitear reconhecimento de sociedade ou de vínculo de emprego com base "
            "neste instrumento, em desacordo com a Cláusula Terceira. A resolução por "
            "essas hipóteses implica perda da participação ainda não paga do ciclo em "
            "curso, subsistindo a cláusula penal.",
            "<b>Parágrafo terceiro.</b> No termo, o COLABORADOR devolverá acessos e "
            "materiais, cessará qualquer apresentação como vinculado à operação e, se "
            "solicitado, firmará em 15 (quinze) dias declaração de inexistência de crédito, "
            "quota ou participação remanescente, ressalvado ciclo já apurado e não pago.",
        ],
    ),
    (
        "CLÁUSULA DÉCIMA PRIMEIRA – DAS PENALIDADES",
        [
            "O descumprimento das Cláusulas Terceira, parágrafo quinto; Quarta; Oitava; "
            "Nona; e Décima, parágrafo segundo, alíneas “a” a “c”, sujeita o COLABORADOR "
            "a multa não compensatória de R$ 15.000,00 (quinze mil reais) por infração, "
            "exigível em 10 (dez) dias da notificação, sem prejuízo da resolução, da tutela "
            "de urgência e das perdas e danos excedentes, na forma do art. 416, parágrafo "
            "único, do Código Civil.",
            "<b>Parágrafo único.</b> Persistindo uso indevido de marca, credencial ou "
            "informação após a notificação, acresce multa diária de R$ 500,00 (quinhentos "
            "reais), limitada a 60 (sessenta) dias.",
        ],
    ),
    (
        "CLÁUSULA DÉCIMA SEGUNDA – DAS OBRIGAÇÕES RECÍPROCAS",
        [
            "Obriga-se a CONTRATANTE a aplicar a fórmula da Cláusula Sexta apenas sobre os "
            "lucros do aplicativo Peça Já, pagar no prazo da Cláusula Sétima, manter a "
            "palavra final com o titular e não atribuir ao COLABORADOR dívida, fiança ou "
            "mandato. Não se obriga a atingir faturamento, constituir pessoa jurídica em "
            "data certa, renovar o contrato ou admitir o COLABORADOR em sociedade."
            "<b>Parágrafo único.</b> Obriga-se o COLABORADOR a: (a) colaborar na forma da "
            "Cláusula Segunda, com diligência; (b) observar a direção da Cláusula Quarta; "
            "(c) guardar sigilo; (d) não se apresentar como sócio, administrador ou "
            "empregado; (e) não assinar em nome da operação; (f) não exigir salário, "
            "verba trabalhista ou remuneração diversa da Cláusula Sexta; (g) manter "
            "atualizados os dados de qualificação e a chave Pix; (h) não ceder este "
            "contrato; (i) firmar, quando exigida, declaração de que não é sócio nem "
            "empregado.",
        ],
    ),
    (
        "CLÁUSULA DÉCIMA TERCEIRA – DO FORO E DAS DISPOSIÇÕES GERAIS",
        [
            "Controvérsia exclusivamente sobre o valor de um ciclo será precedida de "
            "tentativa de composição, pelo prazo de 15 (quinze) dias, entre os endereços "
            "eletrônicos das qualificações. Questões de credencial, sigilo, marca, "
            "representação ou pretensão de sociedade ou de emprego independem dessa "
            "antecedência.",
            "<b>Parágrafo primeiro.</b> Fica eleito o foro da Comarca competente para o "
            "Município de Mucugê, Estado da Bahia, com renúncia a qualquer outro, por mais "
            "privilegiado que seja.",
            "<b>Parágrafo segundo.</b> Este instrumento constitui o inteiro teor do acordo "
            "quanto à colaboração e à participação do COLABORADOR. Conversas, áudios e "
            "mensagens anteriores ficam revogados naquilo que conflitarem. Alteração depende "
            "de aditivo escrito, assinado por ambas as Partes.",
            "<b>Parágrafo terceiro.</b> A assinatura eletrônica é válida nos termos da "
            "Medida Provisória n.º 2.200-2/2001 e da Lei n.º 14.063/2020. Recomenda-se a "
            "assinatura de duas testemunhas, para os fins do art. 784, III, do Código de "
            "Processo Civil.",
            "<b>Parágrafo quarto.</b> A invalidade de disposição não prejudica as demais. "
            "Subsistem, em qualquer caso, a inexistência de mandato e de quota; a limitação "
            "da remuneração à metade do pool dos cotistas enquanto houver dois titulares "
            "ativos; a palavra final do CONTRATANTE; e a cessão da propriedade intelectual.",
            "<b>Parágrafo quinto.</b> Na interpretação prevalece o sentido que conserve a "
            "colaboração sem representação, a participação econômica limitada ao pool e a "
            "inexistência de emprego e de sociedade (art. 112 do Código Civil). A boa-fé "
            "objetiva não cria direito não escrito.",
            "<b>Parágrafo sexto.</b> As Partes declaram ter lido o instrumento na íntegra, "
            "tido oportunidade de consultar advogado de sua confiança e firmá-lo de livre "
            "e espontânea vontade, sem coação.",
        ],
    ),
]


def build() -> Path:
    styles = _styles()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=ML,
        rightMargin=MR,
        topMargin=MT,
        bottomMargin=MB,
        title="Contrato de Colaboração Operacional — InovaTech / Peça Já",
        author="InovaTech",
    )
    frame = Frame(ML, MB, PAGE_W - ML - MR, PAGE_H - MT - MB, id="normal")
    doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=_header_footer))

    story = [
        Paragraph("INSTRUMENTO PARTICULAR", styles["kicker"]),
        Paragraph(
            "CONTRATO DE COLABORAÇÃO OPERACIONAL<br/>E PARTICIPAÇÃO NOS RESULTADOS",
            styles["title"],
        ),
        Paragraph("InovaTech  ·  lucros do aplicativo Peça Já", styles["sub"]),
    ]
    for title, paras in CLAUSES:
        block = [Paragraph(title, styles["clause"])]
        for para in paras:
            block.append(Paragraph(para, styles["body"]))
        story.append(KeepTogether(block))

    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "E, por estarem assim justas e contratadas, as Partes assinam o presente "
            "instrumento em 2 (duas) vias de igual teor, juntamente com as testemunhas "
            "abaixo, na data e no local indicados.",
            styles["body"],
        )
    )
    story.append(Spacer(1, 10))
    story.append(Paragraph("Mucugê/BA, _____ de ________________ de ________.", styles["sign"]))
    story.append(Spacer(1, 28))
    story.append(Paragraph("________________________________", styles["sign"]))
    story.append(
        Paragraph(
            "<b>INOVA TECH DESENVOLVIMENTO DIGITAL</b><br/>marca InovaTech — CONTRATANTE<br/>"
            "p/ Iago Pinto Teles, titular<br/>CPF 066.806.965-18",
            styles["sign"],
        )
    )
    story.append(Spacer(1, 26))
    story.append(Paragraph("________________________________", styles["sign"]))
    story.append(
        Paragraph(
            "<b>COLABORADOR</b><br/>Nome: _______________________________<br/>"
            "CPF: ________________",
            styles["sign"],
        )
    )
    story.append(Spacer(1, 22))
    story.append(
        Paragraph(
            "Testemunha 1: ______________________________&nbsp;&nbsp;&nbsp;"
            "CPF: ________________",
            styles["sign"],
        )
    )
    story.append(
        Paragraph(
            "Testemunha 2: ______________________________&nbsp;&nbsp;&nbsp;"
            "CPF: ________________",
            styles["sign"],
        )
    )
    doc.build(story)
    return OUT


if __name__ == "__main__":
    path = build()
    print("OK", path)
