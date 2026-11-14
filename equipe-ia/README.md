# EQUIPE DE AGENTES DE IA: GUIA DE IMPLEMENTAÇÃO

## O que tem neste pacote
- `00-contexto-empresa.md`: preencha UMA vez. Todo agente lê isto.
- `01-regras-globais.md`: limites e aprovações. Revise e ajuste.
- `agentes/`: 15 manuais de função (um por agente).
- `02-rotinas-agendadas.md`: quem roda quando.
- `03-modelo-fila-aprovacoes.md`: como os agentes pedem decisão a você.
- `cursor/`: regras prontas para o Cursor (Dev, QA, DevOps).

## Importante: entenda o que este pacote é
Estes arquivos são o **"cérebro" e o manual de cada funcionário**. Para eles trabalharem sozinhos
precisam de: (1) uma plataforma onde rodar, (2) ferramentas conectadas, (3) gatilhos/agendamento.
Os manuais funcionam em qualquer plataforma (Claude, Cursor, n8n/Make, frameworks de agentes).

## Passo a passo

### Etapa 0 (1 hora): preparação
1. Preencha `00-contexto-empresa.md` (troque tudo que está em [COLCHETES]).
2. Revise `01-regras-globais.md`.
3. Crie um canal (Slack ou e-mail dedicado) chamado "aprovações".
4. Crie uma planilha/Notion com: Backlog, Log diário, Fila de aprovações, Metas.

### Etapa 1 (semana 1): núcleo mínimo com 4 agentes
Comece só com: **Chefe de Gabinete, Dev Full-stack, QA e Marketing/Conteúdo**.
- Dev e QA: copie a pasta `cursor/` para a raiz do repositório do app (Cursor lê `.cursor/rules` e `AGENTS.md`). Para execução autônoma, use Claude Code em segundo plano ou GitHub Actions.
- Marketing e Chefe de Gabinete: crie um projeto no Claude, cole contexto + regras + manual do agente como instruções, e envie arquivos de apoio (identidade visual, textos já usados).
- Ative uma tarefa agendada para o briefing diário.

### Etapa 2 (semanas 2–3): crescimento
Adicione **Tráfego Pago, Criativo, ASO, Analista de Dados, DevOps**. Conecte analytics e relatórios de anúncios (somente leitura no início).

### Etapa 3 (semanas 4–6): comercial e suporte
Adicione **Prospecção, Vendas/CRM, Suporte**. Conecte CRM e e-mail/WhatsApp Business.

### Etapa 4 (depois): operação
Adicione **Financeiro, Jurídico, Product Manager** quando já houver dados e rotina.

## Como automatizar de verdade (madrugada)
Duas rotas, escolha conforme seu time:
1. **Sem código:** n8n, Make ou Zapier. Gatilho (horário/novo lead/erro) → chama a IA via API com o manual do agente como instrução → grava resultado na planilha/Slack.
2. **Com código (você tem devs):** um pequeno serviço que, em cada horário, carrega o manual do agente, chama a API da IA com as ferramentas permitidas e salva o log. Um agente por arquivo em `agentes/` facilita isso.

Exemplo de estrutura de chamada (conceito): `system = contexto + regras + manual_do_agente` / `user = tarefa da rotina`.

## Segurança (não pule)
- Comece com acessos **somente leitura** e vá liberando escrita aos poucos.
- Chaves de API em cofre/variáveis de ambiente, nunca em texto.
- Dev SEMPRE em branch + PR. Produção só com sua aprovação.
- Teto de gasto nos anúncios configurado na própria plataforma.
- Revise os logs dos primeiros 14 dias todo dia. Ajuste os manuais conforme os erros.
- Jurídico e financeiro: sempre validar com profissional.

## Como melhorar com o tempo
Quando um agente errar, não corrija só o resultado: **atualize o manual dele** com a regra que faltava.
Em 1 mês os agentes estarão muito mais afinados que no primeiro dia.

## Quer que eu faça mais?
Posso: personalizar tudo para o seu app (me passe nome, cidade e stack), escrever as automações em n8n,
criar o script que roda os agentes via API, ou montar os modelos de planilha (backlog, CRM, fluxo de caixa).
