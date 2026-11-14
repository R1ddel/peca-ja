# Dia 1 · O mapa · 40 min

[Voltar para a trilha](01-TRILHA.md)

Hoje não tem vídeo. Leia esta página inteira e escreva 3 linhas no [caderno](02-CADERNO.md).

## O Peça Já em uma frase

O celular pede. A API atende. O banco guarda. O Railway mantém a API ligada.

## As peças

| Nome | No Peça Já | Em uma frase |
|---|---|---|
| Site | Página no navegador (Chrome) | Abre por um endereço. Não instala. |
| App | Aplicativo do cliente, do lojista e do entregador | Instala no celular. Feito com Expo. |
| API | Programa em Node | Recebe o pedido, confere e responde. |
| Banco | Postgres no Neon | Onde ficam usuários, lojas e pedidos. |
| Railway | Hospedagem da API | Liga esse programa 24 horas, fora do seu computador. |
| Mercado Pago | Pagamento | Empresa de fora. A API conversa com ela. |
| Sistema | Tudo junto | App + API + banco + pagamento + hospedagem. |

## Um pedido, do toque até a tela

1. A pessoa toca em pedir no app.
2. O app manda uma mensagem para a API: quem pediu, o quê, para onde.
3. A API confere e grava no banco (Neon).
4. A API responde "pedido criado".
5. O app mostra isso na tela.

Essa mensagem costuma ir num formato chamado JSON: um texto organizado com nomes e valores. A API é o balcão que aceita essas mensagens. O app não grava direto no banco.

## O que mantém de pé

O código mora no seu projeto. A versão oficial sobe para a internet. O Railway liga a API. O Neon guarda os dados. As senhas (banco, Mercado Pago) ficam em variáveis de ambiente no Railway, fora do código do app. Se a API cai, o app abre e o pedido não completa. O log do Railway mostra o motivo.

## Pronto quando você consegue dizer

- [ ] Site abre no navegador. App instala no celular.
- [ ] API atende. Neon guarda. Railway liga a API.
- [ ] Escrevi 3 linhas no caderno e marquei o dia 1 na trilha.
