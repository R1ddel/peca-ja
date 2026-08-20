/**
 * Termo de Responsabilidade e Adesão — Entregador Peça Já
 * Texto-base operacional. Não substitui parecer de advogado inscrito na OAB
 * sobre o caso concreto da pessoa jurídica titular da marca.
 */
export const DRIVER_TERMS_VERSION = '2026.08.1';

export const DRIVER_TERMS_TITLE =
  'Termo de Responsabilidade, Isenção e Adesão ao Peça Já — Entregador';

export function buildDriverTermsBody(opts: {
  name: string;
  document?: string;
  vehicleType: string;
  plate?: string;
  city?: string;
}): string {
  const doc = opts.document?.trim() || 'a informar';
  const city = opts.city?.trim() || 'município de atuação';
  const plate = opts.plate?.trim() || 'não aplicável / a informar';
  const today = new Date().toLocaleDateString('pt-BR');

  return `
TERMO DE RESPONSABILIDADE, ISENÇÃO E ADESÃO À PLATAFORMA PEÇA JÁ
(Entregador autônomo — motofrete / ciclista / condutor)

Versão: ${DRIVER_TERMS_VERSION}
Data de referência: ${today}

PREÂMBULO

Este instrumento regula a adesão de pessoa física (ou MEI, quando houver) à ferramenta digital Peça Já. O objetivo da Plataforma é facilitar o encontro entre quem pede, quem vende e quem decide realizar a entrega, gerando oportunidade de renda autônoma. NÃO se trata de contrato de trabalho, de emprego, de estágio, de aprendiz, de representação comercial nem de sociedade.

PARTES

a) PLATAFORMA: Peça Já, ferramenta digital de intermediação tecnológica de pedidos e entregas, operada pela pessoa jurídica titular da marca e dos sistemas no Brasil (“Peça Já” ou “Plataforma”);
b) ENTREGADOR: ${opts.name}, documento ${doc}, veículo informado como ${opts.vehicleType} (placa ${plate}), com atuação voluntária em ${city} (“Entregador”).

1. NATUREZA JURÍDICA — AUSÊNCIA DE VÍNCULO EMPREGATÍCIO

1.1. O Peça Já é intermediário tecnológico, nos termos do Marco Civil da Internet (Lei nº 12.965/2014) e do Código Civil (Lei nº 10.406/2002). A simples adesão a este Termo NÃO cria vínculo empregatício (CLT — Decreto-Lei nº 5.452/1943), relação de emprego doméstico, trabalho intermitente, ou qualquer figura de subordinação jurídica típica de emprego.

1.2. O Entregador declara, de forma livre, informada e inequívoca, que:
a) NÃO há pessoalidade obrigatória para além da identificação cadastral de segurança (pode recusar corridas; a Plataforma não impõe exclusividade);
b) NÃO há habitualidade imposta: não existe escala, ponto, carga horária mínima, meta de horas, plantão nem obrigação de permanecer conectado;
c) NÃO há onerosidade salarial: não há salário, piso, 13º, férias, FGTS, vale-transporte, adicional noturno, horas extras nem verbas rescisórias. Há apenas remuneração eventual e variável por entrega ACEITA;
d) NÃO há subordinação jurídica: a Plataforma NÃO é empregadora, NÃO dá ordens de emprego, NÃO escolhe a rota, NÃO fiscaliza jornada e NÃO aplica penalidade trabalhista. Regras do aplicativo visam segurança do pedido e do consumidor (códigos, prazo razoável da corrida aceita, respeito), e não direção de emprego.

1.3. LIBERDADE DE JORNADA. O Entregador liga e desliga o painel quando quiser, inclusive no mesmo dia, em feriados ou madrugada, sem autorização prévia. Recusar corridas, ficar offline ou atuar em outras plataformas (iFood, 99, Uber, próprio comércio etc.) NÃO constitui falta grave nem motivo de “justa causa” trabalhista, porque não há contrato de trabalho.

1.4. O Entregador é prestador AUTÔNOMO da atividade de transporte de encomendas que ELE DECIDE aceitar. Equipamento, combustível, manutenção, alimentação, celular, internet, EPIs e seguro são de sua conta e risco, salvo se lei futura impuser dever diverso à plataforma — hipótese em que as partes regularão o cumprimento da norma.

1.5. Este Termo não impede que a lei ou o Poder Judiciário, no caso concreto, reconheçam figura diversa se a REALIDADE da operação for diferente do aqui declarado (primazia da realidade). Por isso a Plataforma se obriga a NÃO adotar práticas típicas de emprego (escala obrigatória, punir recusa de corrida como se fosse desobediência de empregado, exclusividade de fato, “chefe”, uniforme obrigatório de emprego, local de trabalho fixo da empresa). O Entregador obriga-se a NÃO simular emprego nem exigir verbas trabalhistas enquanto usufruir da autonomia aqui descrita.

2. OBJETO

2.1. O Entregador poderá visualizar, no painel, solicitações de retirada e entrega entre estabelecimentos e consumidores e, SE QUISER, aceitá-las. Aceita a corrida, assume a obrigação civil de cumprir aquela entrega com diligência, como prestador autônomo, e não como empregado.

2.2. A Plataforma NÃO é transportadora, NÃO é empresa de motofrete, NÃO é seguradora, NÃO é empregadora e NÃO assume o risco da circulação em via pública. Limita-se a disponibilizar software de matching e meios de pagamento/repasse.

3. CADASTRO, VEÍCULO, IDADE E MOTOFRETE

3.1. O Entregador declara, sob as penas da lei, que os dados cadastrais (identidade, CPF, CNH, veículo, placa, telefone) são verdadeiros.

3.2. Declara possuir idade mínima legal, habilitação válida quando o veículo exigir, CRLV e demais documentos, e condições para circular segundo o CTB (Lei nº 9.503/1997). É VEDADO o cadastro de menor de 18 anos para atividade em motocicleta ou equivalente.

3.3. Quando a legislação municipal ou federal de motofrete/mototáxi (inclusive Lei nº 12.009/2009 e normas locais de ${city}) exigir cadastro, capacitação, equipamento ou licença, o cumprimento é ÔNUS EXCLUSIVO do Entregador. Operar sem a licença exigida é infração sua, não da Plataforma.

3.4. A Plataforma pode pedir comprovantes e suspender o acesso em caso de irregularidade aparente, fraude ou risco a terceiros. Suspensão de conta de plataforma NÃO se confunde com punição trabalhista.

4. CONDUTA NA ENTREGA ACEITA

4.1. Depois de ACEITAR uma corrida, o Entregador compromete-se a: (i) respeito a consumidores e comerciantes; (ii) cuidado do pedido sob sua custódia; (iii) uso dos códigos de retirada/entrega; (iv) não fraudar, não substituir produtos, não cobrar extra não autorizado.

4.2. Embriaguez ao volante, ilícitos, agressão, discriminação ou fraude autorizam o desligamento da ferramenta, sem prejuízo da lei penal e civil. Isso é faculdade contratual de quem cede o software, não “justa causa” de emprego.

5. ACIDENTES, QUEDAS, TERCEIROS E ISENÇÃO (NA MEDIDA DA LEI)

5.1. O Entregador é o responsável civil e administrativo, na medida de sua culpa, por:
a) acidentes de trânsito, colisões, QUEDAS da moto/bike, atropelamentos e danos a si, a terceiros, a veículos ou a bens DURANTE o deslocamento que ELE escolheu realizar;
b) infrações de trânsito, multas, pontos na CNH e apreensões;
c) extravio, avaria, contaminação, atraso injustificado ou furto do pedido APÓS a retirada (custódia);
d) danos morais ou materiais causados por sua conduta;
e) direção perigosa, excesso de velocidade, uso de celular ao conduzir;
f) descumprimento de leis de trânsito e de motofrete.

5.2. ACIDENTE NÃO É ACIDENTE DE TRABALHO DA PLATAFORMA. Não há CAT a cargo do Peça Já, não há SAT/GILRAT de emprego, não há estabilidade acidentária nem dever de emprego de reabilitar. Socorro médico de urgência, INSS como segurado facultativo/individual, seguro pessoal e seguro do veículo são ônus do Entregador, salvo norma cogente em contrário.

5.3. O Peça Já NÃO assume o risco da atividade de circular em via pública. A decisão de sair à rua, o itinerário, a velocidade e a forma de conduzir são do Entregador.

5.4. Na máxima extensão PERMITIDA pelo direito brasileiro, o Entregador isenta e manterá indene o Peça Já, sócios, administradores e prestadores, de reclamações, ações, autuações, indenizações, custas e honorários decorrentes de fatos imputáveis ao Entregador (item 5.1), inclusive em regresso.

5.5. NÃO se exclui responsabilidade da Plataforma por dolo ou culpa grave PRÓPRIA (falha do software que cause dano direto e comprovado, por exemplo), nem direitos indisponíveis do consumidor (CDC) quando a lei atribuir à plataforma dever próprio. Nesses casos, fica assegurado o DIREITO DE REGRESSO contra o Entregador na proporção de sua culpa. Cláusula de isenção total absoluta seria nula; por isso este item é delimitado pela lei.

5.6. Demandado o Peça Já por fato do Entregador, este cooperará, assumirá o polo passivo quando cabível (denunciação da lide / chamamento) e ressarcirá a Plataforma do que ela despender por conta dele.

6. SEGURO

6.1. É fortemente recomendado (e será obrigatório quando a lei ou a política da Plataforma, com aviso prévio, exigir) seguro de acidente pessoal e/ou do veículo. Circular sem seguro é risco assumido pelo Entregador.

6.2. A Plataforma pode, no futuro, contratar seguro coletivo ou exigir apólice mínima. Isso NÃO converte a relação em emprego.

7. REMUNERAÇÃO, PIX EM CPF E TRIBUTOS

7.1. O valor de FRETE exibido na corrida aceita é a contraprestação AUTÔNOMA daquela entrega, paga pelo fluxo da operação (em regra, pelo consumidor ou pelo split da Plataforma), NÃO é salário.

7.2. PAGAMENTO VIA PIX (chave CPF de pessoa física) é meio de liquidação civil da contraprestação autônoma ou do repasse de frete. NÃO caracteriza folha de pagamento, NÃO gera vínculo e NÃO transfere à Plataforma a condição de empregadora. O Entregador declara estar ciente de que receber em CPF pode gerar obrigações próprias perante a Receita Federal e o INSS (contribuinte individual), inclusive declaração de IR.

7.3. O Entregador é o EXCLUSIVO responsável por tributos, contribuições previdenciárias e obrigações acessórias da SUA atividade (IRPF, carnê-leão, INSS como autônomo, MEI etc.), quando exigidos.

7.4. MEI / CNPJ. A Plataforma poderá, a qualquer tempo, por exigência legal, bancária, de meio de pagamento ou de autoridade, solicitar a abertura e o cadastro de MEI ou outro CNPJ e o envio de nota fiscal/recibo. Enquanto a lei e a operação permitirem Pix em CPF, o Entregador pode receber nessa modalidade, assumindo o risco fiscal. A orientação de abertura de MEI, se disponibilizada no app, é INFORMATIVA, não constitui contabilidade nem emprego.

7.5. Chargebacks, fraudes ou cancelamentos ligados a conduta do Entregador podem afetar créditos e saques, nos termos da lei e das regras do painel.

8. PROTEÇÃO DE DADOS (LGPD)

8.1. Dados de clientes e lojas obtidos via Peça Já destinam-se só à entrega (Lei nº 13.709/2018). Vedados venda de base, spam e uso alheio.

9. PROPRIEDADE INTELECTUAL

9.1. Software, marcas e conteúdos do Peça Já pertencem à Plataforma. O uso do painel é licença limitada, revogável, enquanto a adesão estiver regular.

10. VIGÊNCIA, DESLIGAMENTO E FORO

10.1. Este Termo vale enquanto o cadastro estiver ativo, ou até denúncia por qualquer das partes, a qualquer momento (liberdade de não continuar usando a ferramenta).

10.2. O Peça Já pode suspender ou encerrar o acesso por violação deste Termo, fraude, risco à segurança ou ordem de autoridade. Encerrar acesso a software NÃO é “dispensa” trabalhista.

10.3. Conflitos CIVIS deste Termo: foro da comarca de ${city}, quando legalmente admitido. Demandas que a lei considere de competência da Justiça do Trabalho ou foro legal do hipossuficiente seguem a norma cogente (não se renuncia o que a lei veda renunciar).

11. ACEITE ELETRÔNICO

11.1. Nos termos da MP nº 2.200-2/2001 e da Lei nº 14.063/2020, o aceite neste aplicativo, com data/hora, identificação, CPF e versão do termo, é manifestação inequívoca de vontade.

11.2. O Entregador declara ter LIDO, COMPREENDIDO e CONCORDADO com todas as cláusulas, em especial as dos itens 1, 5 e 7, e ter capacidade civil.

12. DECLARAÇÃO FINAL

O Entregador reconhece que: (i) usa o Peça Já por conta própria para obter renda eventual; (ii) acidentes, quedas, multas e ilícitos na rua são seus, na medida da lei; (iii) a Plataforma não é seu patrão; (iv) receber via Pix em CPF não cria emprego.

Entregador: ${opts.name} — documento ${doc}.
Veículo: ${opts.vehicleType} — placa ${plate}.
Local de referência: ${city}.
`.trim();
}
