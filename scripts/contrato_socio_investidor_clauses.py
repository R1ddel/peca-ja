# -*- coding: utf-8 -*-
"""Cláusulas do Contrato de Aporte Operacional e Participação nos Resultados — Peça Já."""

from __future__ import annotations


def _pct_words(pct: int) -> str:
    words = {
        30: "trinta",
        40: "quarenta",
        45: "quarenta e cinco",
        55: "cinquenta e cinco",
        60: "sessenta",
        70: "setenta",
    }
    return words.get(pct, str(pct))


def _brl(n: int) -> str:
    return f"R$ {n:,}".replace(",", ".")


def _pool_share(pct_investidor: int) -> str:
    """Percentual do montante distribuível (30%) correspondente ao investidor."""
    value = round(pct_investidor * 0.60, 1)
    if value == int(value):
        return str(int(value))
    return str(value).replace(".", ",")


def _total_share(pct_investidor: int) -> str:
    """Percentual do caixa líquido da base correspondente ao investidor."""
    value = round(pct_investidor * 0.60 * 0.30, 2)
    return str(value).replace(".", ",")


def build_clauses(cfg: dict, *, percentual_investidor: int) -> list[tuple[str, list[str]]]:
    c = cfg["contratante"]
    inv = cfg["investidor"]
    op = cfg["operacao"]
    foro = cfg["foro"]
    nome_op = op["nome"]
    marca = c.get("marca", "InovaTech")
    nome_comercial = c.get("nome_comercial", "Inova Tech Desenvolvimento Digital")
    banco = (c.get("banco") or "").strip()
    pct_inv = percentual_investidor
    pct_contr = 100 - pct_inv
    pool_inv = _pool_share(pct_inv)
    total_inv = _total_share(pct_inv)
    pool_contr = _pool_share(pct_contr)
    total_contr = _total_share(pct_contr)

    fatia = 18_000
    inv_val = fatia * pct_inv // 100
    contr_val = fatia - inv_val
    ex_inv = _brl(inv_val)
    ex_contr = _brl(contr_val)

    return [
        (
            "CLÁUSULA 1 — QUALIFICAÇÃO E OBJETO",
            [
                f"<b>1.1. CONTRATANTE.</b> {c['nome_completo']}, "
                f"{c.get('nacionalidade', 'brasileiro(a)')}, estado civil {c.get('estado_civil', '____________________')}, "
                f"profissão {c.get('profissao', '____________________')}, "
                f"inscrito(a) no CPF sob o n.º {c['cpf']}, RG {c.get('rg', '____________________')}, "
                f"residente e domiciliado(a) em {c['endereco']}, {c.get('cidade_uf', '____________________')}, "
                f"e-mail {c['email']}, telefone {c['telefone']}, chave Pix {c['pix']}"
                + (f", instituição financeira {banco}" if banco else "")
                + f", titular da marca <b>{marca}</b> ({nome_comercial}), "
                "doravante denominado(a) <b>CONTRATANTE</b>.",
                f"<b>1.2. INVESTIDOR.</b> {inv['nome']}, "
                f"{inv.get('nacionalidade', 'brasileiro(a)')}, estado civil "
                f"{inv.get('estado_civil', '____________________')}, profissão "
                f"{inv.get('profissao', '____________________')}, inscrito(a) no CPF sob o n.º {inv['cpf']}, "
                f"RG {inv.get('rg', '____________________')}, residente e domiciliado(a) em {inv['endereco']}, "
                f"{inv['cidade_uf']}, e-mail {inv['email']}, telefone {inv['telefone']}, "
                f"chave Pix para recebimento {inv.get('chave_pix_recebimento', '____________________')}, "
                "doravante denominado(a) <b>INVESTIDOR</b>.",
                f"<b>1.3. Objeto.</b> O presente instrumento tem por objeto: "
                f"(i) o aporte, pelo INVESTIDOR, dos recursos necessários ao custeio da "
                f"<b>{marca}</b> ({nome_comercial}) — pessoa física do CONTRATANTE nessa gestão e "
                f"pessoa jurídica presente ou futura vinculada a essa marca —, nos termos da Cláusula 7; e "
                f"(ii) a participação do INVESTIDOR, de forma limitada e temporária, "
                f"<b>somente</b> nos resultados distribuíveis do aplicativo <b>{nome_op}</b>, "
                f"nos termos da Cláusula 5. "
                f"O aplicativo {nome_op} é produto da {marca}; o custeio da empresa abrange o "
                f"{nome_op} e demais custos, produtos e necessidades da {marca} indicados pelo "
                f"CONTRATANTE no Anexo II. "
                f"A operação {nome_op} é {op['descricao']}. "
                f"O custeio da {marca} <b>não</b> confere participação nos resultados da empresa, "
                f"da marca ou de produtos distintos do Aplicativo.",
                f"<b>1.4. Limitação do objeto.</b> A participação econômica restringe-se ao aplicativo "
                f"{nome_op}. O aporte à {marca} — ainda que sirva ao {nome_op} e a outros produtos ou "
                f"custos da empresa — <b>não</b> transforma o INVESTIDOR em sócio, quotista, acionista "
                f"ou administrador, nem lhe confere direito sobre a marca {marca} ou sobre qualquer "
                f"outro produto, sistema ou receita. A designação de publicidade prevista na Cláusula 11 "
                f"não altera esta limitação.",
                "<b>1.5. Capacidade.</b> As partes declaram-se maiores e capazes, e celebram este "
                "contrato de forma livre, informada e de boa-fé, sem vício de consentimento.",
                "<b>1.6. Campos em branco.</b> Os campos não preenchidos serão completados antes da "
                "assinatura. A omissão de dado de qualificação não amplia o objeto nem prorroga o prazo.",
            ],
        ),
        (
            "CLÁUSULA 2 — DEFINIÇÕES",
            [
                "Para os fins deste contrato, entende-se por:",
                f"<b>a) Aplicativo:</b> o aplicativo {nome_op}, inclusive suas versões, marcas associadas "
                "ao próprio aplicativo e a receita de plataforma dele decorrente.",
                f"<b>b) Empresa / {marca}:</b> a marca {marca} ({nome_comercial}), a pessoa física "
                f"do CONTRATANTE na gestão dessa marca e a pessoa jurídica presente ou futura "
                f"vinculada a ela. O aplicativo {nome_op} é produto da {marca}. O custeio da Empresa "
                f"abrange a estrutura empresarial e os custos necessários ao {nome_op} e a outros "
                f"produtos, sistemas ou necessidades da {marca} indicados no Anexo II.",
                "<b>c) Receita da plataforma:</b> valores efetivamente recebidos e disponíveis em caixa "
                "da operação, em regime de caixa, a título de taxa, comissão ou outra remuneração da "
                "plataforma incidente sobre pedidos concluídos no Aplicativo. Não integra a receita da "
                "plataforma o valor dos produtos, refeições ou serviços devidos aos comerciantes, nem "
                "gorjeta, frete ou outro valor que apenas transite pela operação para repasse a terceiro.",
                "<b>d) Caixa líquido da base:</b> a receita da plataforma do ciclo, após as deduções "
                "da Cláusula 5.3, quando o resultado for positivo.",
                "<b>e) Ciclo:</b> período de 2 (dois) meses, contado da data de assinatura, e assim "
                "sucessivamente até o termo final.",
                "<b>f) Montante distribuível:</b> 30% (trinta por cento) do caixa líquido da base.",
                "<b>g) Parcela retida:</b> 70% (setenta por cento) do caixa líquido da base, que "
                "permanece na operação.",
                "<b>h) Fatia do CONTRATANTE:</b> 60% (sessenta por cento) do montante distribuível.",
                "<b>i) Participação do INVESTIDOR:</b> o percentual da fatia do CONTRATANTE definido "
                "na Cláusula 5.6, e somente esse percentual.",
                f"<b>j) Autossuficiência operacional:</b> a situação em que, por 2 (dois) ciclos "
                f"consecutivos, a {marca} e o Aplicativo suportam os custos do Anexo II com recursos "
                f"próprios da operação e da empresa, <b>sem</b> novo desembolso do INVESTIDOR. "
                f"Não se exige que apenas a receita da plataforma cubra sozinha todos os custos da "
                f"empresa. É a esse conceito que as partes se referem ao dizer que a operação se "
                f"mantém “no verde”.",
                f"<b>k) Custos operacionais:</b> as despesas das categorias do Anexo II, necessárias "
                f"à manutenção do Aplicativo, da estrutura empresarial da {marca} e de outros "
                f"produtos ou necessidades da {marca} indicados pelo CONTRATANTE, excluídas "
                f"despesas pessoais do CONTRATANTE alheias à {marca} e qualquer distribuição de "
                f"resultados.",
            ],
        ),
        (
            "CLÁUSULA 3 — NATUREZA JURÍDICA",
            [
                "<b>3.1.</b> Este contrato é de natureza civil e empresarial, atípico, de aporte "
                "operacional e participação limitada em resultados. Aplica-se o Código Civil e, no "
                "que couber, a Lei n.º 13.874/2019, por se tratar de contrato entre partes capazes, "
                "com alocação de risco expressamente ajustada.",
                "<b>3.2.</b> O contrato <b>não</b> constitui, nem poderá ser interpretado como, "
                "sociedade empresária, sociedade simples, sociedade em conta de participação, "
                "sociedade em comum, joint venture, associação, mandato, representação comercial, "
                "agência ou contrato de trabalho.",
                "<b>3.3.</b> O INVESTIDOR não é sócio, quotista, acionista, administrador, diretor, "
                "procurador, preposto ou empregado. Não possui direito de voto, veto, preferência, "
                "administração ou representação. A recusa de sugestão pelo CONTRATANTE não constitui "
                "inadimplemento e não autoriza retenção de aporte, revisão de percentual ou prorrogação.",
                "<b>3.4.</b> Não há subordinação jurídica, horário, salário, pró-labore, FGTS, "
                "férias, 13º salário ou verba rescisória. Eventual colaboração não gera vínculo "
                "empregatício.",
                "<b>3.5.</b> Não há promessa de lucro, rentabilidade mínima, prazo de recuperação "
                "do capital ou obrigação de resultado quanto ao faturamento. O risco de perda total "
                "do aporte é do INVESTIDOR.",
                "<b>3.6.</b> O CONTRATANTE não responde pela restituição do aporte. O INVESTIDOR não "
                "responde por dívidas, obrigações ou passivo da operação ou do CONTRATANTE, nem "
                "figura como fiador, avalista ou devedor solidário.",
            ],
        ),
        (
            "CLÁUSULA 4 — TITULARIDADE, GESTÃO E PROPRIEDADE",
            [
                "<b>4.1.</b> A gestão do Aplicativo, da operação e dos negócios do CONTRATANTE é "
                "exclusiva deste. Incluem-se, sem limitação, preço, comissão, contratação, desligamento, "
                "expansão, tecnologia, marca e alocação da parcela retida.",
                "<b>4.2.</b> Permanecem de titularidade exclusiva do CONTRATANTE, sem que o aporte "
                "ou a participação confiram qualquer direito real, societário ou de propriedade: "
                "o Aplicativo, o código, as marcas, os domínios, as bases de dados, as contas, os "
                "contratos, a clientela, os comerciantes, os entregadores, os demais sistemas e os "
                "trabalhos realizados fora do Aplicativo, bem como a pessoa jurídica que venha a ser "
                "constituída.",
                "<b>4.3.</b> A constituição de MEI, empresário individual, sociedade limitada ou "
                "outra pessoa jurídica, e a transferência da operação para pessoa jurídica controlada "
                "pelo CONTRATANTE, não incluem o INVESTIDOR no quadro societário, não lhe atribuem "
                "quota ou ação e não exigem sua anuência, desde que preservada a participação "
                "econômica da Cláusula 5 pelo prazo restante. É vedado aditivo que converta este "
                "instrumento em contrato social ou em cessão de quotas.",
                "<b>4.4.</b> Sugestões, ideias e materiais que o INVESTIDOR voluntariamente apresentar "
                "sobre o Aplicativo incorporam-se ao acervo do CONTRATANTE, sem remuneração adicional "
                "e sem coautoria, salvo direito moral de autor quando a lei o impuser de forma irrenunciável.",
                "<b>4.5.</b> O INVESTIDOR não tem direito sobre venda, fusão, cessão, investimento "
                "ou liquidação do Aplicativo ou da empresa, além da participação já apurada até a "
                "data do evento, se este ocorrer na vigência.",
            ],
        ),
        (
            "CLÁUSULA 5 — BASE DE CÁLCULO E PARTICIPAÇÃO",
            [
                "<b>5.1. Base.</b> Integram o cálculo somente a receita da plataforma, tal como "
                "definida na Cláusula 2, alínea “c”, recebida no ciclo. Pedido não pago, cancelado, "
                "estornado ou reembolsado não integra a base.",
                "<b>5.2. Exclusões.</b> Não entram no cálculo, em qualquer hipótese: "
                "(i) planos, assinaturas ou mensalidades de comerciantes, inclusive os atualmente "
                "praticados nos valores de R$ 200,00 (duzentos reais), R$ 250,00 (duzentos e cinquenta "
                "reais) e R$ 300,00 (trezentos reais), bem como qualquer plano futuro de igual natureza; "
                "(ii) outros sistemas, sites, automações, consultorias e trabalhos realizados fora do "
                f"Aplicativo; (iii) receitas e negócios da marca {marca} estranhos ao Aplicativo; "
                "(iv) comércio pessoal e projetos particulares do CONTRATANTE. "
                "Essas receitas não são informadas no relatório da Cláusula 9, salvo a menção de que "
                "foram excluídas, sem discriminação de valor, cliente ou contrato.",
                "<b>5.3. Deduções.</b> Do total da receita da plataforma do ciclo deduzem-se, e somente "
                "se deduzem: (i) estornos, chargebacks e reembolsos dessa mesma receita; "
                "(ii) tarifas do meio de pagamento incidentes sobre ela; "
                "(iii) tributos incidentes sobre essa receita, quando devidos. "
                "Custos operacionais custeados pelo INVESTIDOR não são deduzidos da base, "
                "para que não haja dupla repercussão do mesmo dispêndio. Não há reserva técnica "
                "adicional, nem outra dedução unilateral.",
                "<b>5.4. Divisão.</b> Do caixa líquido da base, 70% (setenta por cento) constituem a "
                "parcela retida, que permanece na operação sob gestão exclusiva do CONTRATANTE, sem "
                "direito, crédito ou expectativa do INVESTIDOR. Os 30% (trinta por cento) restantes "
                "constituem o montante distribuível. Se o caixa líquido for zero ou negativo, não há "
                "distribuição no ciclo, sem acúmulo para ciclo futuro e sem prorrogação do prazo.",
                "<b>5.5. Partilha do montante distribuível.</b> Do montante distribuível, 40% "
                "(quarenta por cento) destinam-se aos cotistas apoiadores que possuam contrato próprio "
                "e vigente. Na ausência de cotista ativo, essa parcela permanece na operação e "
                "<b>não</b> se acresce à participação do INVESTIDOR. Os outros 60% (sessenta por cento) "
                "constituem a fatia do CONTRATANTE.",
                f"<b>5.6. Participação do INVESTIDOR.</b> O INVESTIDOR faz jus a <b>{pct_inv}% "
                f"({_pct_words(pct_inv)} por cento)</b> da fatia do CONTRATANTE, e a nada mais. "
                f"Esse percentual equivale a {pool_inv}% do montante distribuível e a aproximadamente "
                f"{total_inv}% do caixa líquido da base, quando positivo. "
                f"Não corresponde a {pct_inv}% da empresa, a {pct_inv}% da parcela retida, a {pct_inv}% "
                f"do caixa líquido nem a {pct_inv}% do montante distribuível.",
                f"<b>5.7.</b> Os {pct_contr}% ({_pct_words(pct_contr)} por cento) restantes da fatia "
                f"do CONTRATANTE, equivalentes a {pool_contr}% do montante distribuível e a cerca de "
                f"{total_contr}% do caixa líquido da base, permanecem com o CONTRATANTE, além da "
                "parcela retida.",
                "<b>5.8. Apuração.</b> A memória de cálculo é elaborada pelo CONTRATANTE, de boa-fé, "
                "pela fórmula desta cláusula e do Anexo I. O INVESTIDOR não audita a contabilidade "
                "geral, os demais negócios ou as contas bancárias. Divergência sobre a aplicação da "
                "fórmula não confere acesso a credenciais, extratos ou informações excluídas.",
                f"<b>5.9. Exemplo ilustrativo.</b> Os percentuais são vinculantes; o valor de "
                f"R$ 100.000,00 é apenas exemplo, e não previsão de faturamento. "
                f"Sendo o caixa líquido da base R$ 100.000,00: a parcela retida é de R$ 70.000,00; "
                f"o montante distribuível é de R$ 30.000,00; a parcela dos cotistas é de R$ 12.000,00; "
                f"a fatia do CONTRATANTE é de R$ 18.000,00; a participação do INVESTIDOR é de "
                f"{pct_inv}% de R$ 18.000,00, isto é, <b>{ex_inv}</b>; permanecem com o CONTRATANTE, "
                f"nessa fatia, <b>{ex_contr}</b>, além dos R$ 70.000,00 retidos. Qualquer outro valor "
                "de caixa líquido segue a mesma ordem e os mesmos percentuais.",
            ],
        ),
        (
            "CLÁUSULA 6 — REMUNERAÇÃO E PAGAMENTO",
            [
                f"<b>6.1.</b> A única remuneração do INVESTIDOR é a participação da Cláusula 5.6. "
                "Não são devidos pró-labore, salário, bônus, gratificação, comissão adicional, "
                "dividendo, participação na parcela retida, participação nos planos mensais, "
                "participação em outros sistemas ou pagamento por colaboração.",
                "<b>6.2.</b> O aporte não constitui mútuo, adiantamento, despesa reembolsável ou "
                "crédito de qualquer natureza. Não haverá restituição, ainda que a autossuficiência "
                "operacional não seja atingida, que o contrato se extinga pelo decurso do prazo ou "
                "que o CONTRATANTE não celebre novo instrumento.",
                "<b>6.3.</b> Encerrado cada ciclo, o CONTRATANTE encaminha a memória de cálculo e "
                "paga a participação mediante Pix, na chave indicada pelo INVESTIDOR, em até "
                "<b>5 (cinco) dias úteis</b>. Recaindo o vencimento em dia sem expediente bancário, "
                "prorroga-se para o dia útil seguinte. O comprovante de transferência quita o ciclo.",
                "<b>6.4.</b> Enquanto o CONTRATANTE não estiver obrigado à emissão de nota fiscal, "
                "o comprovante de pagamento é documento hábil de quitação. Cada parte responde pelos "
                "tributos de sua esfera. O INVESTIDOR não pode condicionar o aporte, nem o recebimento, "
                "à emissão de documento fiscal a que o CONTRATANTE ainda não esteja obrigado.",
                "<b>6.5.</b> A participação é intransmissível sem autorização prévia e escrita do "
                "CONTRATANTE. Cessão, promessa ou oneração sem essa autorização é ineficaz perante ele.",
                "<b>6.6.</b> Havendo impugnação tempestiva e fundamentada apenas sobre a aplicação "
                "da fórmula, paga-se no prazo da Cláusula 6.3 a parcela incontroversa. O saldo "
                "controvertido observa a Cláusula 15, sem suspensão do dever de aporte e sem abertura "
                "da contabilidade geral.",
            ],
        ),
        (
            "CLÁUSULA 7 — APORTE OPERACIONAL",
            [
                f"<b>7.1.</b> Durante a vigência, e até que se verifique a autossuficiência operacional "
                f"ou o termo final, o que ocorrer primeiro, o INVESTIDOR aportará os recursos necessários "
                f"ao custeio da <b>{marca}</b>. Como o {nome_op} é produto da {marca}, esse custeio "
                f"abrange o Aplicativo e demais custos, produtos e necessidades da empresa indicados "
                f"no Anexo II. O CONTRATANTE indicará o custo por escrito, por e-mail ou mensagem da "
                f"qual conste o destinatário, acompanhado de boleto, fatura ou documento equivalente. "
                f"O pagamento será feito em até <b>5 (cinco) dias úteis</b> do recebimento da indicação.",
                f"<b>7.2.</b> O objeto do aporte é determinável: compreende as categorias do Anexo II "
                f"— constituição e manutenção da pessoa jurídica, contabilidade, certificações, "
                f"infraestrutura, custos do Aplicativo e demais custos da {marca} necessários à "
                f"empresa e aos seus produtos — e o valor indicado com documento de cobrança. "
                f"Não compreende despesa pessoal do CONTRATANTE alheia à {marca}. Teto preenchido "
                f"no Anexo II limita a referência mensal daquela categoria; campo em branco não "
                f"converte o aporte em obrigação ilimitada fora do Anexo II, nem dispensa a indicação "
                f"escrita. O custeio da {marca} e de produtos distintos do Aplicativo <b>não</b> "
                f"amplia a base de cálculo da Cláusula 5.",
                "<b>7.3.</b> Verificada a autossuficiência operacional, extingue-se o dever de aportar, "
                "sem crédito, restituição, quota ou direito de permanência além do termo final. A "
                "participação da Cláusula 5 permanece até o termo final, e não além dele.",
                "<b>7.4.</b> Bem, licença, domínio, crédito ou direito adquirido com o aporte integra "
                "o patrimônio do CONTRATANTE desde o pagamento, sem cotitularidade do INVESTIDOR. "
                "O pagamento não confere credencial, mandato ou poder de condicionar o aporte seguinte "
                "à alteração deste contrato.",
                "<b>7.5.</b> O atraso no aporte suspende, a partir do vencimento, a participação do "
                "ciclo em curso, até a purgação da mora. Ciclo já encerrado e calculado antes do "
                "vencimento inadimplido permanece exigível. Não purgada a mora em 15 (quinze) dias, "
                "o CONTRATANTE poderá resolver o contrato por inadimplemento, sem restituição do "
                "aporte e sem indenização por expectativa de ganho. Participações de ciclos já "
                "quitados permanecem quitadas.",
            ],
        ),
        (
            "CLÁUSULA 8 — CONTAS, CREDENCIAIS E MOVIMENTAÇÃO",
            [
                "<b>8.1.</b> Contas bancárias, chaves Pix, contas de pagamento, provedores de nuvem, "
                "domínios, lojas de aplicativo e demais meios de pagamento da operação são de "
                "titularidade exclusiva do CONTRATANTE. O INVESTIDOR não será incluído como cotitular, "
                "procurador, usuário administrador ou portador de cartão.",
                "<b>8.2.</b> É vedado ao INVESTIDOR obter, utilizar ou conservar senha, token, chave "
                "de API, acesso administrativo ou aplicativo bancário da operação, bem como realizar "
                "saque, transferência ou pagamento em nome da operação. A tentativa de obtenção ou "
                "o uso não autorizado de credencial constitui inadimplemento. Pedido isolado de "
                "informação, feito de boa-fé e no limite da Cláusula 9, não o constitui; a reiteração "
                "após recusa escrita, ou o condicionamento do aporte a esse acesso, constitui.",
                "<b>8.3.</b> Nenhuma urgência, conversa ou aporte autoriza movimentação pelo "
                "INVESTIDOR. Autorização, se houver, será prévia, específica e escrita, e não "
                "transfere a titularidade da conta.",
                "<b>8.4.</b> O conhecimento do INVESTIDOR sobre a situação financeira limita-se aos "
                "relatórios da Cláusula 9.",
            ],
        ),
        (
            "CLÁUSULA 9 — PRESTAÇÃO DE INFORMAÇÕES",
            [
                "<b>9.1.</b> Uma vez por mês, por e-mail ou mensagem escrita, o CONTRATANTE encaminhará "
                "relatório restrito ao que disser respeito ao INVESTIDOR, contendo: "
                f"(i) os aportes por ele realizados no mês, discriminados entre Aplicativo e {marca}, "
                "quando aplicável; "
                "(ii) os custos operacionais pagos com esses aportes; "
                "(iii) no mês de encerramento do ciclo, a memória de cálculo da Cláusula 5 e o valor "
                "a pagar. No mês em que o ciclo não se encerrar, o relatório limitará-se a indicar "
                "que o ciclo está em curso e que não há valor a pagar naquele mês.",
                f"<b>9.2.</b> O relatório não compreende receitas da {marca} distintas da receita da "
                "plataforma do Aplicativo, trabalhos externos, planos mensais, finanças pessoais, "
                "estratégia, código-fonte, base de clientes ou matéria estranha à fórmula. "
                "O CONTRATANTE pode recusar essas informações sem incorrer em mora.",
                "<b>9.3.</b> Impugnação da memória de cálculo, limitada à aplicação da fórmula, deverá "
                "ser apresentada em até 10 (dez) dias do recebimento. A resposta será dada em até "
                "10 (dez) dias úteis e versará somente sobre esse ponto.",
            ],
        ),
        (
            "CLÁUSULA 10 — PRAZO, EXTINÇÃO E EFEITOS",
            [
                "<b>10.1. Prazo.</b> O contrato vigorará por 12 (doze) meses, com termo inicial na "
                "data da assinatura e termo final na data correspondente do ano subsequente, quando "
                "se extinguirá de pleno direito. A contagem observa o art. 132, § 3º, do Código Civil. "
                "Recaindo o termo inicial em 29 de fevereiro, o termo final será 28 de fevereiro do "
                "ano seguinte. Não há prazo indeterminado.",
                "<b>10.2. Extinção pelo termo.</b> No dia seguinte ao termo final cessam a participação, "
                "a autorização de uso da designação, a expectativa de novo ciclo e qualquer dever de "
                "pagar daí em diante. Ciclo já encerrado e não pago será pago. Ciclo em curso será "
                "apurado proporcionalmente aos dias decorridos, exclusivamente sobre a receita da "
                "plataforma já recebida até o termo final, pela mesma fórmula, sem projeção de receita futura.",
                "<b>10.3. Não renovação.</b> Não há renovação automática, nem dever de negociar ou de "
                "responder a pedido de renovação. A renovação somente ocorrerá por novo instrumento "
                "escrito, assinado pelo CONTRATANTE. Silêncio, continuidade de conversa ou aporte "
                "extraordinário não a produzem.",
                "<b>10.4. Cessação da posição do INVESTIDOR.</b> Como o INVESTIDOR não integra quadro "
                "societário, a extinção implica o dever de cessar, de imediato, qualquer apresentação "
                "pública como vinculado ao Aplicativo ou ao CONTRATANTE, o uso da designação e da "
                "marca, e qualquer pretensão de permanência, aviso prévio, indenização, recompra ou "
                "restituição. Se solicitado, o INVESTIDOR firmará, em 15 (quinze) dias, declaração de "
                "inexistência de crédito ou participação remanescente. A falta dessa declaração não "
                "prorroga o contrato.",
                "<b>10.5. Denúncia pelo CONTRATANTE.</b> O CONTRATANTE poderá denunciar o contrato "
                "antes do termo final, por escrito, com antecedência de 15 (quinze) dias, sem multa "
                "e sem declinar motivo. Serão devidos apenas os ciclos já encerrados e a apuração "
                "proporcional do ciclo em curso, na forma da Cláusula 10.2. Não haverá restituição "
                "do aporte nem indenização por lucro cessante.",
                "<b>10.6. Denúncia pelo INVESTIDOR.</b> O INVESTIDOR poderá denunciar o contrato por "
                "escrito. A denúncia extingue a participação dos ciclos futuros, não gera restituição "
                "do aporte e não pode ser condicionada a pagamento, quota ou prazo adicional.",
                "<b>10.7. Resolução por inadimplemento do INVESTIDOR.</b> O contrato poderá ser "
                "resolvido de imediato, mediante comunicação escrita, se o INVESTIDOR: obtiver ou "
                "tentar obter credencial da operação; apresentar-se como proprietário, sócio da "
                "empresa ou administrador; divulgar informação confidencial; ceder este contrato como "
                "se sociedade fosse; ou recusar a cessação da Cláusula 10.4. A resolução implica perda "
                "da participação ainda não paga e da autorização de uso da designação, sem restituição "
                "do aporte, sem prejuízo da cláusula penal.",
            ],
        ),
        (
            "CLÁUSULA 11 — DESIGNAÇÃO E PUBLICIDADE",
            [
                "<b>11.1.</b> Durante a vigência, o INVESTIDOR poderá utilizar, em publicidade pessoal, "
                "a designação <b>“sócio investidor do aplicativo Peça Já”</b>. A designação é licença "
                "de uso de nome, não societária, intransmissível e limitada a esta cláusula. A "
                "comunicação não afirmará, nem deixará implícito, que o INVESTIDOR é proprietário, "
                "sócio da empresa, administrador ou pessoa autorizada a obrigar o CONTRATANTE ou o "
                "Aplicativo.",
                "<b>11.2.</b> Logotipo, arte e demais sinais distintivos somente serão usados com "
                "autorização escrita e específica. O INVESTIDOR não falará em nome do CONTRATANTE, "
                "da empresa ou do Aplicativo.",
                "<b>11.3.</b> Se a utilização for inexata, enganosa ou prejudicial à marca, o "
                "CONTRATANTE notificará a correção, que deverá ser feita em até 5 (cinco) dias. "
                "Não corrigida, a autorização de uso fica suspensa até a correção, sem prejuízo da "
                "resolução se a conduta se enquadrar na Cláusula 10.7.",
                "<b>11.4.</b> Com a extinção ou a resolução, a autorização cessa. O INVESTIDOR "
                "retirará a designação de materiais sob seu controle em até 15 (quinze) dias e não "
                "autorizará terceiro a mantê-la. O aporte não gera direito de uso posterior da imagem "
                "ou da marca.",
            ],
        ),
        (
            "CLÁUSULA 12 — OBRIGAÇÕES DAS PARTES",
            [
                "<b>12.1. Obrigações do CONTRATANTE:</b>",
                "a) aplicar a fórmula da Cláusula 5 e pagar a participação no prazo da Cláusula 6.3;",
                "b) encaminhar o relatório da Cláusula 9;",
                f"c) aplicar o aporte no custeio da {marca}, inclusive do Aplicativo e demais "
                f"necessidades da empresa indicadas no Anexo II;",
                "d) não atribuir ao INVESTIDOR dívida, fiança ou vínculo de emprego;",
                "e) tratar dados pessoais necessários a este contrato na forma da legislação aplicável.",
                "O CONTRATANTE não se obriga a atingir faturamento, a constituir pessoa jurídica em "
                "data determinada, a renovar o contrato, a admitir o INVESTIDOR em sociedade ou a "
                "prestar informação estranha à fórmula.",
                "<b>12.2. Obrigações do INVESTIDOR:</b>",
                "a) realizar o aporte na forma da Cláusula 7;",
                "b) manter atualizados os dados de qualificação e a chave Pix de recebimento;",
                "c) guardar sigilo;",
                "d) abster-se de se apresentar como proprietário, sócio da empresa ou administrador;",
                "e) abster-se de obter ou usar credencial, conta ou meio de saque da operação;",
                "f) não exigir remuneração diversa da Cláusula 6;",
                "g) declarar a origem lícita dos recursos, nos termos da Lei n.º 9.613/1998;",
                "h) não ceder este contrato sem autorização escrita do CONTRATANTE;",
                "i) observar a cessação da Cláusula 10.4;",
                "j) não requerer registro, nem usar no mesmo segmento de mercado, sinal distintivo "
                "idêntico ou semelhante o bastante para causar confusão com “Peça Já” ou com a marca "
                f"{marca}, durante a vigência e nos 24 (vinte e quatro) meses seguintes.",
            ],
        ),
        (
            "CLÁUSULA 13 — CONFIDENCIALIDADE, PROPRIEDADE INTELECTUAL E NÃO ALICIAMENTO",
            [
                "<b>13.1.</b> São confidenciais as informações do Aplicativo, da operação, de números, "
                "comerciantes, métodos e pessoas a que o INVESTIDOR tiver acesso em razão deste "
                "contrato, ainda que o acesso não devesse ter ocorrido. O dever permanece por "
                "2 (dois) anos após a extinção, e por prazo indeterminado quanto a credencial, "
                "código-fonte, chave e dado pessoal.",
                "<b>13.2.</b> Pelo prazo de 12 (doze) meses após a extinção, o INVESTIDOR não "
                "solicitará, para marketplace de entregas concorrente, comerciante, entregador ou "
                "integrante da operação com quem tenha tido contato em razão deste contrato. Esta "
                "vedação não impede o exercício de profissão ou atividade econômica alheia a esse "
                "círculo de pessoas e a esse objeto.",
                "<b>13.3.</b> É vedado utilizar informação confidencial ou elemento do Aplicativo "
                "para reproduzir serviço substancialmente equivalente. A vedação decorre de sigilo "
                "e de propriedade intelectual, e não de cláusula geral de não concorrência.",
                f"<b>13.4.</b> Dados pessoais serão tratados somente para a execução deste contrato. "
                f"O canal de contato do CONTRATANTE é o e-mail indicado em sua qualificação.",
            ],
        ),
        (
            "CLÁUSULA 14 — INADIMPLEMENTO E CLÁUSULA PENAL",
            [
                "<b>14.1.</b> O descumprimento das Cláusulas 8.2, 10.4, 11, 12.2, alíneas “d”, “e” e “j”, "
                "e 13.1 sujeita o infrator a multa de <b>R$ 5.000,00 (cinco mil reais)</b> por infração, "
                "exigível em 10 (dez) dias da notificação, sem prejuízo da resolução e da indenização "
                "por perdas e danos que excedam a multa, nos termos do art. 416, parágrafo único, do "
                "Código Civil.",
                "<b>14.2.</b> A multa não se compensa com participação, não se confunde com o aporte "
                "e não o converte em crédito restituível. A resolução e a multa podem ser cumuladas "
                "quando a infração for de obrigação de não fazer.",
            ],
        ),
        (
            "CLÁUSULA 15 — MEDIAÇÃO E FORO",
            [
                "<b>15.1.</b> Controvérsia exclusivamente sobre o valor de um ciclo será precedida de "
                "tentativa de mediação, pelo prazo de até 30 (trinta) dias. Descumprimento relativo "
                "a credencial, sigilo, marca ou cessação da posição do INVESTIDOR não se subordina a "
                "essa antecedência, podendo o CONTRATANTE postular tutela de urgência.",
                f"<b>15.2.</b> Fica eleito o foro da <b>{foro}</b>, com renúncia a qualquer outro, "
                "por mais privilegiado que seja.",
            ],
        ),
        (
            "CLÁUSULA 16 — DISPOSIÇÕES GERAIS",
            [
                "<b>16.1.</b> Este instrumento e seus anexos constituem o acordo integral sobre o "
                "aporte e a participação. Comunicações anteriores não ampliam o objeto. O que não "
                "estiver escrito não se considera concedido.",
                "<b>16.2.</b> Alteração depende de aditivo escrito assinado por ambas as partes. "
                "Mensagem isolada não altera percentual, prazo ou titularidade.",
                "<b>16.3.</b> A assinatura eletrônica ou digital é válida, nos termos da Medida "
                "Provisória n.º 2.200-2/2001 e da Lei n.º 14.063/2020. Recomenda-se a assinatura de "
                "duas testemunhas, para os fins do art. 784, inciso III, do Código de Processo Civil.",
                "<b>16.4.</b> A invalidade de disposição não prejudica as demais. Em qualquer caso "
                "permanecem: a inexistência de sociedade e de copropriedade; a limitação da "
                "remuneração à fórmula da Cláusula 5; a vedação de acesso a contas; e a extinção "
                "no termo final, sem renovação tácita.",
                "<b>16.5.</b> Na interpretação, prevalece o sentido que preserve a finalidade do "
                "contrato: participação econômica limitada, temporária e calculada apenas sobre a "
                "receita da plataforma, sem sociedade, sem administração e sem restituição do aporte. "
                "A boa-fé objetiva não cria direito não escrito.",
                "<b>16.6.</b> Cada parte declara que pôde ler este instrumento com a antecedência "
                "necessária e consultar profissional de sua confiança, se assim desejou.",
                f"<b>16.7. Síntese, que as partes afirmam ter compreendido:</b> o INVESTIDOR não "
                f"custeia apenas o {nome_op}; custeia a <b>{marca}</b>, empresa à qual o {nome_op} "
                f"pertence. Por isso, o aporte serve ao {nome_op} e a outros custos, produtos e "
                f"necessidades da {marca} indicados pelo CONTRATANTE, até a autossuficiência ou o "
                f"termo final. A participação econômica, porém, restringe-se a {pct_inv}% da fatia "
                f"do CONTRATANTE na divisão bimestral da receita da plataforma do {nome_op}, e "
                f"somente a isso. Custeiar a empresa não gera participação societária nem direito "
                f"sobre outros produtos ou receitas. Planos mensais das lojas não entram na base. "
                f"O INVESTIDOR não é sócio da empresa, não administra e não movimenta contas; "
                f"recebe apenas o relatório que lhe diz respeito. Ao termo final, a relação se "
                f"extingue, sem dever de renovação e sem restituição do aporte, salvo novo contrato "
                f"escrito.",
            ],
        ),
        (
            "ANEXO I — FÓRMULA DE CÁLCULO",
            [
                f"<b>1.</b> Somar a receita da plataforma do Aplicativo {nome_op} recebida no ciclo.",
                "<b>2.</b> Excluir, antes de qualquer percentual, planos e mensalidades de lojas, "
                "outros sistemas, trabalhos externos e toda receita que não seja remuneração da "
                "plataforma sobre pedidos.",
                "<b>3.</b> Deduzir apenas os itens da Cláusula 5.3. O saldo positivo é o caixa líquido da base.",
                "<b>4.</b> Se o saldo for zero ou negativo, a participação do ciclo é zero.",
                "<b>5.</b> Separar 70% como parcela retida e 30% como montante distribuível.",
                "<b>6.</b> Do montante distribuível, 40% cabem aos cotistas ativos, conforme seus "
                "próprios contratos. Não havendo cotista ativo, essa parcela permanece na operação "
                "e não se transfere ao INVESTIDOR. Os 60% restantes são a fatia do CONTRATANTE.",
                f"<b>7.</b> Participação do INVESTIDOR = {pct_inv}% da fatia do CONTRATANTE.",
                f"<b>8.</b> O saldo da fatia ({pct_contr}%) permanece com o CONTRATANTE, somado à parcela retida.",
                "<b>Exemplo ilustrativo — caixa líquido da base = R$ 100.000,00:</b>",
                "• parcela retida (70%) = R$ 70.000,00;",
                "• montante distribuível (30%) = R$ 30.000,00;",
                "• cotistas (40% do montante distribuível) = R$ 12.000,00;",
                "• fatia do CONTRATANTE (60% do montante distribuível) = R$ 18.000,00;",
                f"• INVESTIDOR = {pct_inv}% × R$ 18.000,00 = <b>{ex_inv}</b>;",
                f"• CONTRATANTE, na fatia = {pct_contr}% × R$ 18.000,00 = <b>{ex_contr}</b>, "
                "além dos R$ 70.000,00 retidos.",
                "O exemplo não fixa faturamento. A ordem e os percentuais aplicam-se a qualquer outro valor.",
            ],
        ),
        (
            "ANEXO II — CUSTOS OPERACIONAIS E DECLARAÇÕES",
            [
                f"<b>A) Custos do Aplicativo {nome_op}</b>, a serem indicados por escrito pelo "
                f"CONTRATANTE até a autossuficiência operacional ou o termo final:",
                "☐ Hospedagem e API — referência mensal, se houver: R$ __________",
                "☐ Banco de dados — referência mensal, se houver: R$ __________",
                "☐ Domínio, DNS e correio eletrônico da operação",
                "☐ Lojas de aplicativos — conforme fatura",
                "☐ Meios de pagamento e ferramentas necessárias ao Aplicativo",
                "☐ Outro custo do Aplicativo, descrito no documento de cobrança: ________________________________",
                f"<br/><br/><b>B) Custos da {marca} / estrutura empresarial</b> "
                f"(o {nome_op} é produto da {marca}; esta seção cobre a empresa e demais "
                f"produtos/necessidades dela, além do Aplicativo):",
                "☐ Abertura e manutenção de CNPJ / pessoa jurídica",
                "☐ Contabilidade e obrigações acessórias — referência mensal, se houver: R$ __________",
                "☐ Certificados digitais, alvarás e registros",
                "☐ Domínio, site institucional, e-mail e infraestrutura da marca",
                "☐ Ferramentas e serviços necessários à operação da marca",
                "☐ Outro produto, sistema ou necessidade da empresa, descrito no documento de cobrança: ________________________________",
                f"Valor pago a esses títulos é aporte, não empréstimo. O bem ou o direito fica do "
                f"CONTRATANTE. O custeio da {marca} e de produtos distintos do {nome_op} não confere "
                f"quota, participação societária nem ampliação da base da Cláusula 5.",
                "<br/><br/><b>Declarações do INVESTIDOR, que integram este contrato:</b>",
                f"a) a única remuneração é {pct_inv}% da fatia do CONTRATANTE; no exemplo do Anexo I, "
                f"{ex_inv} sobre a fatia de R$ 18.000,00, e não {pct_inv}% de R$ 100.000,00 nem "
                f"{pct_inv}% de R$ 30.000,00;",
                "b) planos mensais, outros sistemas e trabalhos externos não integram a base;",
                "c) a designação “sócio investidor do aplicativo Peça Já” não cria sociedade nem "
                "participação na empresa;",
                f"d) o aporte no Aplicativo e na {marca} não adquire o Aplicativo, a marca, as contas "
                f"nem a empresa;",
                "e) não haverá acesso a contas, credenciais ou movimentação financeira;",
                "f) as informações devidas limitam-se ao relatório da Cláusula 9;",
                f"g) o dever de aportar o Aplicativo e a {marca} cessa com a autossuficiência "
                f"operacional ou com o termo final;",
                "h) o aporte não será restituído e não se converterá em quota;",
                "i) o contrato extingue-se na data correspondente do ano seguinte, sem renovação "
                "tácita e sem indenização pela não renovação;",
                "j) a designação publicitária vale apenas durante a vigência e cessa com ela;",
                "k) leu o Anexo I e compreendeu que o exemplo de R$ 100.000,00 ilustra a fórmula, "
                "sem garantir esse faturamento.",
                "<br/><br/>Local e data: ____________________, ____/____/________",
                "<br/><br/>Assinatura do INVESTIDOR: ________________________________",
            ],
        ),
    ]
