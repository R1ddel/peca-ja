# DevOps — Fase 2, passo 1: onde está o banco e se há backup

Data: 2026-11-04, cerca de 16:50 (Brasília).
Escopo: só leitura via CLI Railway. Sem deploy, sem `psql`, sem mudar variável, sem ligar PITR.

## Resultado

**Infra no ar: verde. Backup: vermelho. Documentação do repo: amarela (desatualizada).**

A API de produção usa o **Postgres do próprio Railway** (`postgres.railway.internal`). O backup contínuo (PITR) está **desligado**. O `.env` desta máquina aponta para **Supabase** — não é o banco da produção.

## O que confirmei

| Item | Evidência |
|---|---|
| Projeto Railway | `successful-hope`, ambiente `production` |
| Serviço `api` | Online, 1 réplica, região **sfo**, URL pública `api-production-8092.up.railway.app` |
| Último deploy da API | SUCCESS em 2026-11-04 14:42 (Brasília) |
| Serviço `Postgres` | Online, imagem `postgres-ssl:18`, volume `postgres-volume` montado em `/var/lib/postgresql/data` (cota 50 GB) |
| `DATABASE_URL` da API (produção) | host `postgres.railway.internal:5432`, database `railway` |
| `FLEET_DATABASE_URL` (produção) | mesmo host interno |
| `NODE_ENV` | `production` |
| `MP_PAYOUT_MODE` | `live` |
| Token Mercado Pago | presente (`APP_USR-…`) |
| App parado / dormindo | `deploymentStopped: false` na API e no Postgres |
| PITR (backup contínuo) | **Atualizado 17:10 BRT:** `enabled: true`, `bucketWired: true` (Deploy do staged). Antes estava desligado. |
| Alta disponibilidade do Postgres | não (1 nó) |
| `.env` local | pooler Supabase `aws-0-sa-east-1.pooler.supabase.com:6543` — **diferente da produção** |
| `SUPABASE_URL` / chave no Railway | ausentes (produção não usa REST Supabase) |

## Métricas (últimas 6 h, painel Railway)

| Serviço | CPU | Memória | HTTP |
|---|---|---|---|
| `api` | ~0% | ~125 MB | 24 342 req · p50 5 ms · p99 73 ms · 2xx 13 985 · 4xx 10 334 · 5xx 23 |
| `Postgres` | ~0% | ~48 MB | — |

Amostra recente de HTTP (200 linhas): quase tudo `POST /api/platform`, `POST /api/fleet` e `OPTIONS`. Há `401` em frota. A amostra filtrada de 5xx não trouxe linha; o número 23 do painel precisa de investigação no passo seguinte (sem dump de dados pessoais).

## O que isso muda na prática

1. **Restaurar “no Supabase”** (texto antigo no login do HQ) **não recupera a produção atual**. O dado vivo está no volume Railway.
2. **Docs** (`DEPLOY.md` = Neon, `LANCAMENTO_LOJAS.md` / `TESTES_TERCA.md` = Supabase) estão **fora do que o Railway está rodando agora**.
3. **Sem PITR**, se o volume ou o serviço Postgres sumir, não há linha do tempo de restore pronta. Volume sozinho não é plano de recuperação.
4. Região **sfo** (EUA) para Mucugê: a sonda pública da Fase 1 (~350–800 ms) casa com isso. Não é incidente; é custo de latência.

## Variáveis que notei ausentes no Railway (só inventário)

Não alterei nada. Só listei o que o exemplo `docs/RAILWAY_VARS.example.env` cita e a API em produção não mostrou:

- `PLATFORM_CEO_EMAILS`
- `EXPOSE_PASSWORD_RESET_CODE`

HQ ainda pode abrir via PIN (`SUPPORT_PIN` presente). Confirmar depois se isso é intencional.

## Não feito neste passo

- Histórico do GitHub Actions Keep API alive (`gh` ausente nesta máquina).
- Ligar PITR (muda produção → precisa de APROVO).
- Abrir shell no Postgres.
- Comparar conteúdo Supabase local × Railway (risco de misturar ambientes).

## Próximo passo sugerido (Fase 2, passo 2)

1. Pedir APROVO para **ligar PITR** no Postgres Railway (backup contínuo). Eu não ligo sozinho.
2. Em paralelo, sem mudar nada: olhar os 5xx das 6 h e o motivo dos 4xx (provável varredura / 401), só agregados.
3. Instalar `gh` ou mandar print das últimas runs do workflow `keep-api-alive.yml`.
