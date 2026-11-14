# Prompts prontos

Copie o bloco inteiro para o chat do Cursor. Troque só o que estiver entre colchetes.

## Explicar sem mexer em nada

```text
Explica em português simples, como se eu não programasse.

Quero entender: [o que a tela de pedido faz / o que este arquivo faz].
Diga:
1. o que a pessoa vê
2. qual pedido a tela manda para a API
3. o que vai para o banco
4. o que acontece se der erro

Não altere nenhum arquivo.
```

## Pedir o plano e esperar

```text
Quero [descrever o resultado em uma frase].

Quem usa: [cliente / lojista / entregador].
O que a pessoa consegue fazer: [uma ação].
Pronto quando: [o que eu vou ver na tela].

Antes de criar ou editar arquivo, devolva só o plano:
- o que vai mudar
- quais arquivos
- o que você não vai fazer

Espere eu escrever "pode fazer".
```

## Página de estudo (não mexe no app)

```text
Crie uma página HTML simples em estudos/rascunho/pagina.html.

Assunto: apresentação do Peça Já para lojista em Mucugê.
Tom: próximo, direto, cidade pequena.
Cores: verde #00A86B, verde escuro #1E3A2F, ouro #FFB800.
Conteúdo: o que é o app, para quem é, um botão de WhatsApp.

Crie somente esse arquivo dentro de estudos/rascunho/.
Não altere app/, docs/, equipe-ia/ nem arquivos de layout.
No final, explique em português o que é HTML e o que é CSS nessa página.
```

## Pedido de trabalho para a empresa

```text
Atue como [marketing / suporte / chefe de gabinete] do Peça Já.
Leia equipe-ia/00-contexto-empresa.md e o manual desse papel em equipe-ia/agentes/.

Tarefa: [o que você quer].
Limite: não invente preço, prazo ou promessa. Me entregue um rascunho para eu aprovar.
```
