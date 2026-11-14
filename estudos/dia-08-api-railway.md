# Dia 8 · API, Neon e Railway · 50 min

[Voltar para a trilha](01-TRILHA.md)

Hoje é leitura. Não rode comando. Não cole senha, token ou URL de banco no chat.

## Ler nesta ordem

1. Este desenho (10 min)
2. [Deploy do Peça Já](../docs/DEPLOY.md) — só as partes "Neon (banco)" e "Railway (API)" (20 min)
3. [Quick start do Railway](https://docs.railway.com/quick-start) — olhar os nomes, sem criar projeto (15 min)

## O desenho real do Peça Já

- O app no celular fala com a API.
- A API é um programa Node e fica ligada no Railway.
- Os dados ficam num Postgres chamado Neon. O Railway não é o banco. O Railway é a casa da API.
- A API acha o Neon por uma variável `DATABASE_URL`.
- O Mercado Pago é acionado pela API. A chave dele também é uma variável no Railway, não um texto dentro do app.
- O app só precisa saber o endereço público da API.

Variável de ambiente = um nome com um valor secreto, guardado na hospedagem. Exemplo de nome: `DATABASE_URL`. O valor é a senha do banco. Ela não vai para o caderno e não vai para o chat.

Log = o diário do programa. Quando algo cai, o log do Railway é o primeiro lugar para olhar.

## O que anotar

Uma frase: "Railway liga a API. Neon guarda os pedidos. O app só conversa com a API."

## Pronto quando

- [ ] Li o deploy sem executar os passos
- [ ] Escrevi a frase acima no caderno, com as minhas palavras
- [ ] Marquei o dia 8 na trilha
