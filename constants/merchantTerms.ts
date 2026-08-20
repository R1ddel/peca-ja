/**
 * Termo de Compromisso e Responsabilidade — Comerciante Peça Já
 * Texto-base operacional. Não substitui parecer de advogado inscrito na OAB
 * sobre o caso concreto da pessoa jurídica titular da marca.
 */
export const MERCHANT_TERMS_VERSION = '2026.08.1';

export const MERCHANT_TERMS_TITLE =
  'Termo de Compromisso, Responsabilidade e Adesão ao Peça Já — Comerciante';

export function buildMerchantTermsBody(opts: {
  businessName: string;
  ownerName: string;
  planLabel: string;
  planPrice: string;
  city: string;
  document?: string;
}): string {
  const doc = opts.document?.trim() || 'a informar';
  const city = opts.city?.trim() || 'município de atuação';
  const today = new Date().toLocaleDateString('pt-BR');

  return `
TERMO DE COMPROMISSO, RESPONSABILIDADE E ADESÃO À PLATAFORMA PEÇA JÁ
(Comerciante / Estabelecimento — prestador autônomo ou empresário)

Versão: ${MERCHANT_TERMS_VERSION}
Data de referência: ${today}

PREÂMBULO

O Peça Já é ferramenta digital de intermediação. Conecta consumidores a estabelecimentos que decidem, com autonomia, abrir ou fechar o painel e honrar os pedidos que ACEITAREM. A Plataforma NÃO é dona do restaurante, NÃO é cozinheira, NÃO é empregadora do comércio nem do entregador, e NÃO assume a obrigação de fornecer a mercadoria.

PARTES

a) PLATAFORMA: Peça Já, ferramenta digital de intermediação tecnológica, operada pela pessoa jurídica titular da marca e dos sistemas no Brasil (“Peça Já” ou “Plataforma”);
b) COMERCIANTE: ${opts.ownerName}, responsável pelo estabelecimento “${opts.businessName}”, documento ${doc}, com atuação em ${city} (“Comerciante”).

Plano contratado: ${opts.planLabel} — ${opts.planPrice}/mês.

1. OBJETO E NATUREZA DA RELAÇÃO — SEM EMPREGO

1.1. O Peça Já intermedia a conexão entre consumidores, comerciantes e, quando houver, entregadores autônomos, nos termos do Marco Civil da Internet (Lei nº 12.965/2014) e do Código Civil (Lei nº 10.406/2002).

1.2. NÃO há vínculo empregatício, societário, de representação comercial ou de parceria societária entre o Comerciante e a Plataforma (CLT — Decreto-Lei nº 5.452/1943). O Comerciante não é empregado, gerente, franqueado nem preposto do Peça Já.

1.3. LIBERDADE DE HORÁRIO. O Comerciante abre e fecha o estabelecimento / o painel quando quiser. Não há escala imposta pela Plataforma, nem meta de faturamento mínimo como condição de emprego. Pausar vendas, fechar mais cedo ou não operar em determinado dia NÃO gera justa causa trabalhista, porque não há emprego.

1.4. O Peça Já NÃO é fornecedor dos produtos/serviços do cardápio, NÃO é o vendedor final ao consumidor e NÃO assume obrigação de resultado de preparar, embalar ou entregar a mercadoria, ressalvado dever legal próprio da plataforma (ex.: falha do software, cobrança indevida feita pela própria Plataforma).

1.5. A relação de consumo PRINCIPAL, para o CDC (Lei nº 8.078/1990), quanto ao produto/serviço anunciado (comida, item, qualidade, quantidade, prazo de preparo), estabelece-se entre o CONSUMIDOR e o COMERCIANTE. A Plataforma presta serviço de intermediação digital e de meios de pagamento, nos limites da lei.

2. VERACIDADE CADASTRAL E LICENÇAS

2.1. O Comerciante declara verdadeiras as informações de cadastro, cardápio, preços, fotos, horários e documentos.

2.2. Declara possuir alvará, licença sanitária (vigilância sanitária / normas da ANVISA aplicáveis a alimentos, quando for o caso) e demais autorizações de ${city} e da União, mantendo-as válidas.

2.3. É vedado anunciar produto ilícito, falsificado, vencido ou sujeito a autorização que o Comerciante não detenha.

3. CARDÁPIO, QUALIDADE, PRAZO E PEDIDO NÃO ENTREGUE / NÃO PREPARADO

3.1. O Comerciante é o EXCLUSIVO responsável pela qualidade, quantidade, higiene, acondicionamento, validade, descrição e conformidade do produto com o anunciado (CDC, arts. 12, 14, 18, 20 e correlatos, no que couber ao fornecedor do produto).

3.2. Preços e disponibilidade devem ser reais. Item indisponível após o pedido, demora injustificada na COZINHA/BALCÃO ou recusa injustificada de pedido já aceito geram dever de reparar o consumidor, às expensas do Comerciante (reembolso, produto substituto ou o que a lei e a Plataforma preverem).

3.3. PEDIDO NÃO ENTREGUE POR FALHA DO COMÉRCIO (não preparou, não liberou, recusou depois de aceitar, produto errado, fechou no meio do fluxo, endereço de retirada incorreto): o Comerciante assume o inadimplemento perante o consumidor e autoriza a Plataforma a: (i) cancelar; (ii) estornar/reembolsar o consumidor; (iii) debitar/compensar o valor nos repasses futuros; (iv) exercer regresso, inclusive judicial, contra o Comerciante.

3.4. PEDIDO NÃO ENTREGUE POR FATO DO ENTREGADOR (aceitou a corrida e extraviou, abandonou, avariou ou atrasou de forma imputável a ele, após a retirada): a responsabilidade civil imediata é do Entregador, na medida de sua culpa. O Comerciante ainda deve cooperar (códigos, embalagem). A Plataforma poderá reembolsar o consumidor por política de confiança e regressar contra o causador (comércio e/ou entregador, conforme a prova).

3.5. A Plataforma NÃO garante que todo pedido terá entregador disponível, nem prazo de rua. Indisponibilidade de motoboy, trânsito, chuva e caso fortuito da via NÃO convertem a Plataforma em transportadora nem em empregadora.

4. RELAÇÃO COM ENTREGADORES E CONSUMIDORES

4.1. O entregador parceiro NÃO é empregado do Comerciante nem do Peça Já em razão deste Termo. O Comerciante NÃO dará ordens de emprego ao motoboy (escala, punição trabalhista, exclusividade). Poderá apenas tratar da retirada daquele pedido (embalagem, conferência, código).

4.2. Embalar adequadamente, identificar o pedido e validar a retirada pelos procedimentos do Peça Já é dever do Comerciante.

4.3. Tratamento abusivo, discriminatório ou fraudulento a consumidores ou entregadores autoriza suspensão do painel.

5. PAGAMENTOS, PIX EM CPF, PLANO E TRIBUTOS

5.1. O Comerciante adere ao plano ${opts.planLabel} por ${opts.planPrice}/mês, sujeito à confirmação de pagamento.

5.2. Valores de pedidos pagos pelo consumidor (Pix, cartão etc.) seguem split/repasse das regras do Peça Já e do meio de pagamento, com taxas, chargebacks, estornos e retenções legais.

5.3. Chargebacks e cancelamentos por falha do Comerciante (não entregue, divergência grave, má-fé) podem ser debitados dos repasses, com cobrança judicial se preciso.

5.4. Inadimplência do plano autoriza suspender listagem e, se persistir, bloquear o painel.

5.5. PIX EM CPF (pessoa física). O Comerciante declara que o recebimento via Pix em CPF, quando utilizado, é liquidação civil do preço da mercadoria/serviço e/ou do plano, NÃO salário e NÃO emprego. Assume por sua conta as obrigações fiscais da atividade (IR, MEI, Simples, emissão de documento fiscal ao consumidor quando a lei exigir). A Plataforma NÃO é responsável pela sonegação do Comerciante.

5.6. MEI / CNPJ. Se lei, banco, meio de pagamento ou autoridade exigir pessoa jurídica para receber, a Plataforma poderá solicitar cadastro de MEI/CNPJ e nota fiscal. Orientação de abertura de MEI no app, se houver, é informativa. O Comerciante pode ser obrigado a regularizar-se para continuar recebendo.

6. PROTEÇÃO DE DADOS (LGPD)

6.1. Dados de consumidores e entregadores obtidos via Peça Já: só para o pedido e a lei (Lei nº 13.709/2018). Vedados spam e venda de base.

6.2. Incidente de segurança deve ser comunicado à Plataforma sem demora injustificada.

7. PROPRIEDADE INTELECTUAL E MARCA

7.1. Marcas, software e layout do Peça Já permanecem da Plataforma. Licença limitada de uso do painel enquanto a adesão estiver ativa.

7.2. O Comerciante autoriza exibir nome, logo, fotos e cardápio na vitrine, busca e marketing da operação em ${city}.

8. RESPONSABILIDADE, INDENIZAÇÃO E LIMITES

8.1. O Comerciante responde por danos materiais e morais a consumidores, entregadores ou terceiros causados por produtos, serviços, informações falsas, atraso de preparo, acidente sanitário (intoxicação, corpo estranho, alergênico não informado), violação de direitos ou descumprimento deste Termo.

8.2. O Comerciante indenizará e manterá indene o Peça Já de reclamações, PROCONs, autuações, processos e despesas (inclusive honorários) decorrentes de fatos imputáveis ao Comerciante, na medida de sua responsabilidade, com direito de regresso.

8.3. Na qualidade de intermediário tecnológico, o Peça Já responde nos LIMITES da legislação: não se responsabiliza por (i) conteúdo inserido pelo Comerciante; (ii) falha de preparo/embalagem; (iii) rede de terceiros; (iv) caso fortuito/força maior. NÃO se exclui dolo ou culpa grave da PRÓPRIA Plataforma, nem dever legal indisponível (CDC) quando configurado. Cláusula de isenção total absoluta seria nula; por isso este item observa a lei.

8.4. Intoxicação alimentar, produto impróprio ou publicidade enganosa do cardápio são risco do FORNECEDOR (Comerciante). A Plataforma poderá apoiar o consumidor e regressar 100% contra o Comerciante.

9. FRAUDE, COMPLIANCE E SANÇÕES

9.1. Vedados pedidos fictícios, manipulação de avaliações, uso de dados de terceiros, lavagem de dinheiro, sonegação e ilícitos.

9.2. O Peça Já poderá suspender acesso, remover anúncios e reter valores controversos diante de indício grave de fraude ou risco, com registro do motivo.

10. VIGÊNCIA, RESCISÃO E FORO

10.1. Vigência enquanto o cadastro estiver ativo e o plano adimplente, ou até rescisão por qualquer das partes.

10.2. O Comerciante pode encerrar a conta, observadas obrigações financeiras e pedidos em andamento.

10.3. Foro da comarca do município da operação (${city}), ou o do domicílio do réu, quando a lei exigir. Direitos indisponíveis do consumidor e competência legal (PROCON, Justiça do Trabalho se alguém ajuizar e o juiz entender cabível) não são afastados por este foro de eleição.

11. ACEITE ELETRÔNICO E ASSINATURA DIGITAL

11.1. Nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, o Comerciante pode:
a) ACEITE ELETRÔNICO neste aplicativo, com data/hora, identificação e versão do termo; ou
b) assinatura via Gov.br / ICP-Brasil.

11.2. O aceite equivale à anuência integral a este Termo.

11.3. O Comerciante declara ter lido e compreendido todas as cláusulas, em especial as dos itens 1, 3, 5 e 8, e ter poderes para vincular o estabelecimento.

12. DECLARAÇÃO FINAL

A liberação do painel depende de: (1) pagamento do plano confirmado; e (2) aceite deste Termo. O Comerciante reconhece que o Peça Já é intermediário; que abrir/fechar o comércio é decisão sua; que pedido não honrado é risco seu; que Pix em CPF não cria emprego; e que entregadores da rede não são seus empregados em razão deste app.

Local de referência: ${city}.
Comerciante: ${opts.ownerName} — ${opts.businessName}.
`.trim();
}
