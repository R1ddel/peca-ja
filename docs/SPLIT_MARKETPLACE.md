# Repasse Peça Já — conta PJ e qualquer banco

Guardar este plano para o dia em que a conta Mercado Pago PJ da Peça Já for aberta.
Não ligar `MP_MARKETPLACE_SPLIT` nem exigir OAuth do Mercado Pago para loja ou entregador.

## Quem usa o quê

- A Peça Já recebe o pagamento do cliente na conta Mercado Pago PJ. Essa escolha é da plataforma.
- Loja e entregador cadastram chave Pix de qualquer banco: CPF, CNPJ, e-mail, celular ou chave aleatória.
- Ninguém além da Peça Já é obrigado a abrir Mercado Pago.

## Para onde vai cada valor

O cliente paga: preço cadastrado pela loja + frete + R$ 2 por item.

- Preço cadastrado (menos cupom da loja) → chave Pix da loja.
- Frete → chave de quem entregou. Entregador do app recebe o frete. Se a loja entrega com a equipe dela, o frete fica com a loja.
- R$ 2 por item → conta da Peça Já. Esse valor é cobrado por cima e não sai do preço da loja.
- Mensalidade do plano → conta da Peça Já, cobrança à parte.

Nota e imposto da Peça Já incidem sobre a taxa de R$ 2 por item e sobre a mensalidade. O valor da comida não é faturamento da Peça Já.

## Quando o dinheiro sai

Só depois dos dois códigos que o app já tem:

1. A loja confirma a retirada com o código de 4 dígitos.
2. O entregador confirma a entrega com o código do cliente.

Aí o gateway manda o preço para a chave da loja e o frete para a chave de quem entregou. Os R$ 2 por item ficam na Peça Já. Antes dessa confirmação o valor não entra como saldo disponível da plataforma.

Pix aceito pelo Mercado Pago cai na hora. Não há prazo de três dias para o dinheiro chegar na chave.

## O que só a abertura da conta PJ não faz

Abrir a conta não liga o repasse. Ainda depende de:

1. Mercado Pago liberar o envio de Pix para outras chaves (Payouts) nessa conta PJ. Não há prazo fixo. Se pedirem documento, passa de um dia.
2. Chave privada Ed25519 no servidor (`MP_PAYOUT_PRIVATE_KEY`) e a chave pública entregue à equipe de integrações do Mercado Pago. Produção recusa saque sem essa assinatura. O saldo não é debitado.
3. Publicar o app que dispara esse envio na confirmação da entrega. O código do `POST /v1/payouts` está no projeto e ainda não está no site publicado.
4. Um pedido real de poucos reais, com os dois códigos, e o Pix aparecendo na chave da loja e na chave do entregador.

No dia em que o Mercado Pago já puder enviar Pix, o ajuste do aplicativo cabe em um dia de trabalho, mais esse teste. Enquanto a liberação não chega, o Pix do cliente continua caindo inteiro na conta da Peça Já.

## Reembolso por atraso

O dinheiro da loja e do entregador só entra depois do código de entrega. Se o pedido não chega, o cliente recebe o valor inteiro de volta e ninguém fica com a parte do prato nem do frete.

O prazo informado pela loja e pela entrega pode mudar. A tolerância depois que esse prazo acaba não muda.

- Pedido ainda não pronto: prazo que a loja informou mais 35 minutos. No exemplo de 1 hora, a opção aparece em 1h35.
- Pedido que já saiu da loja: prazo da entrega mais 20 minutos. No exemplo de 20 minutos, a opção aparece aos 40 minutos.

O cliente pode cancelar e receber o reembolso, ou esperar. O app não cancela sozinho. Se ele cancelar, a loja e o entregador recebem o aviso com o motivo e o pedido fica cancelado.

| Situação | O que acontece |
| --- | --- |
| Cliente desiste nos 2 primeiros minutos | Cancela e estorna na hora |
| Loja recusa ou cancela antes da retirada | Cancela e estorna na hora |
| Loja não deixa pronto no prazo informado mais 35 minutos | O cliente pode cancelar e receber o reembolso, ou esperar |
| Entrega passa do prazo informado mais 20 minutos | O cliente pode cancelar e receber o reembolso, ou esperar. A loja não recebe se a entrega não foi confirmada |
| Dinheiro na entrega da própria loja, e o cliente cancela | Não há Pix para devolver. A taxa Peça Já volta para o caixa da loja |
| Entrega confirmada com o código do cliente | O dinheiro já foi para cada um. Reclamação depois disso não estorna sozinha |

O estorno no Mercado Pago só se completa se aquela cobrança foi confirmada de verdade. Pagamento de teste marcado à mão não devolve Pix.

## Taxa quando a loja recebe em dinheiro

A loja fica com a cédula. A taxa de R$ 2 por item desse pedido vira um débito, conferido pelo valor do pedido. Não se cobra no saque.

No próximo pedido pago com Pix ou cartão, depois da entrega confirmada, o débito sai da parte da loja. Exemplo: débito de R$ 2 e prato de R$ 51. A chave da loja recebe R$ 49. A Peça Já fica com os R$ 2 deste pedido mais os R$ 2 do dinheiro. O frete do entregador não entra nessa conta.

Se o débito for maior que a parte da loja naquele pedido, o resto espera o pedido seguinte. Se o pedido em dinheiro cancelar antes da entrega, o débito não fica. Loja que nunca mais receber Pix ou cartão continua com o débito em aberto, sem um Pix da taxa para a Peça Já.

## O que não marcar como resolvido

- Saque Pix real não está provado. O site só pode dar o saque como feito se o Mercado Pago aceitar o envio. Modo simulado no computador, que marca pago sem o Pix sair, não vale.
- Estorno real não está provado. A devolução usa a cobrança já confirmada no Mercado Pago. Sem um pagamento real aprovado, o estorno não se completa.
- A nuvem do site publicado já grava conta e pedido. Isso não substitui o Pix de saída nem o estorno de uma cobrança real.

## Fora deste plano

Não usar split em que cada loja conecta a própria conta Mercado Pago. O destino do repasse é a chave Pix cadastrada, de qualquer banco.
