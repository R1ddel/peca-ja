# DevOps — Fase 1: linha de base (API + HQ)

Data: 2026-11-04, cerca de 16:43 (Brasília).
Escopo: só leitura. Sem deploy, sem banco, sem pagamento, sem console Railway.
Alvo: `https://api-production-8092.up.railway.app` e o HQ em `app/admin/`.

## Resultado

**Disponibilidade agora: verde. Monitoramento: amarelo.**

A API respondeu, o Postgres respondeu (`SELECT 1` ou o ping equivalente) e a página de privacidade abriu. Isso não diz qual provedor guarda o banco, se há backup, se o serviço dorme, nem se uma cobrança no Mercado Pago passaria.

## Sonda pública

| Checagem | HTTP | Tempo | O que voltou |
|---|---|---|---|
| `GET /health` (1ª) | 200 | 807 ms | `db=up`, frota e plataforma `postgres`, `mpConfigured=true` |
| `GET /health` (2ª) | 200 | 351 ms | Igual. A primeira amostra estava mais lenta. |
| `GET /` | 200 | 517 ms | Mesmo handler do `/health` (155 bytes). |
| `POST /api/platform` `{"action":"health"}` | 200 | 543 ms | `persistence=postgres` |
| `GET /privacy` | 200 | 313 ms | HTML, 3324 bytes |
| `GET /api/nao-existe` | 404 | 335 ms | Rota desconhecida recusada |

Não chamei `/api/fleet` nem `/api/payments`. Essas rotas mudam pedido ou dinheiro.

Duas amostras não são tendência. Não há número de erro por hora.

## O que cada luz verde significa

1. **`/health` com `db=up`.** O processo está no ar e o ping do banco passou. `payments: true` está escrito fixo no código (`server/index.ts`). Não consulta o Mercado Pago. O campo que importa é `mpConfigured`: o token existe no servidor. Existir token não prova Pix, estorno ou saque.

2. **Login do HQ, pílula “Nuvem ok”.** O navegador chama o mesmo `POST /api/platform` com `action: health`. Verde = API + banco. Não olha Mercado Pago nem latência.

3. **Tela Saúde do HQ** (`/admin/health`). Só abre com sessão de equipe. Se a leitura do estado da plataforma funciona, marca plataforma e frota como `online`. Pagamento fica `online` se o token existe, `not_configured` se não existe. Não mede tempo de resposta, fila ou erro.

4. **Logs do HQ.** A API escreve falha no console do Railway (`console.error`). Isso não entra na lista `systemLogs` do HQ. A tela de logs só mostra o que alguém gravou pela ação `admin_append_system_log`. Hoje, erro de processo não aparece no Command Center.

5. **Incidentes do HQ.** Registro manual. Queda da API não abre incidente sozinha.

6. **Workflow Keep API alive.** A cada 5 minutos pede `/health` e o health da plataforma, até 6 vezes. Sucesso = os dois em HTTP 200. Não lê `mpConfigured`. Não há passo de aviso além do que o GitHub Actions mandar se o job falhar. Nesta máquina o `gh` não está instalado: não vi se as últimas execuções passaram.

## O que a Fase 1 não fecha

- Provedor do Postgres. O deploy fala em Neon (`docs/DEPLOY.md`). A tela de login do HQ fala em Postgres no Railway. O código também aceita Supabase se `SUPABASE_URL` e a chave de serviço existirem (`services/supabaseRest.ts`). A resposta pública só diz `postgres`.
- Backup e último restore. Não olhei console.
- App Sleeping ligado ou desligado. O `railway.toml` pede para ficar desligado. O painel é que vale.
- Custo do mês. Sem número, sem chute.
- Histórico de restart e de erro no Railway.

## Fases

| Fase | O que é | Estado |
|---|---|---|
| 1 | Linha de base pública: API no ar, o que o HQ realmente mede | Feita neste arquivo |
| 2 | Console só leitura: qual Postgres, backup, sleep, runs do keep-alive | Parada. Precisa de acesso ou print |
| 3 | Branch para o `/health` deixar de dizer `payments: true` sempre. Sem merge | Não começou |
| 4 | Alerta quando o keep-alive falhar | Não começou |
| 5 | Rascunho de quem restaura o banco e em quanto tempo. Sem restore | Não começou |
| 6 | HQ continua no computador (`npx expo start --web`) ou ganha endereço | Decisão. Recomendação: local nesta semana |
| 7 | Custo semanal só com número de painel | Não começou |
