# Como usar a equipe de IA (sem mexer no app)

Este pacote vive só em **`equipe-ia/`**. Código em `app/` não é alterado por estes manuais.

## Arquivos do Cloud (pacote)
| Arquivo | Função |
|---------|--------|
| `00-contexto-empresa.md` | Quem somos (versão Peça Já preenchida) |
| `00-contexto-empresa.MODELO.md` | Modelo original com [COLCHETES] |
| `01-regras-globais.md` | O que precisa da sua aprovação |
| `02-rotinas-agendadas.md` | Quem “roda” em qual horário |
| `03-modelo-fila-aprovacoes.md` | Como pedir decisão |
| `agentes/*.md` | Manual de cada função |
| `README.md` | Guia de implementação do Cloud |

## Operação (criado aqui)
| Arquivo | Função |
|---------|--------|
| `operacao/fila-aprovacoes.md` | Pedidos esperando seu sim/não |
| `operacao/log-diario.md` | O que cada agente fez |
| `operacao/backlog.md` | Fila de trabalho |

## Rules no Cursor
`.cursor/rules/agent-dev-fullstack.mdc`  
`.cursor/rules/agent-qa-testes.mdc`  
`.cursor/rules/agent-devops-monitoramento.mdc`  

(As rules Expo do app continuam intactas.)

## No HQ do app (web)
1. `npx expo start --web` → entre em `/admin`
2. Menu **Equipe IA** (`/admin/ai-team`)
3. **Rodar agentes** — lê operação, problemas, financeiro e inteligência e gera briefing + fila de aprovação
4. Agentes “auto” trabalham no HQ; os “manual” continuam no Cursor com o arquivo em `agentes/`

## Como chamar um agente neste chat
Ex.: *“Aja como Marketing Conteúdo — leia `equipe-ia/agentes/06-marketing-conteudo.md` + contexto e regras.”*

## Núcleo da semana 1 (recomendado)
1. Chefe de Gabinete  
2. Marketing / Conteúdo *(este chat)*  
3. Dev Full-stack *(outro chat, só se for código)*  
4. QA  

Tráfego, Criativo, etc. depois do lançamento.
