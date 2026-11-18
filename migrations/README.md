# Migrations (Postgres)

Fase **F0** da migração JSONB → relacional. Ver plano no Project store (`docs/database-migration-plan.md`).

## Como usar

```bash
npm run db:migrate:status   # conecta e lista aplicadas / pendentes
npm run db:migrate          # aplica pendentes (transação por arquivo)
npm run db:migrate -- --dry-run
```

- Arquivos: `NNNN_descricao.sql` (ordem numérica).
- Controle: tabela `schema_migrations` (`id` = nome do arquivo).
- URL: `DATABASE_URL` → senão `FLEET_DATABASE_URL` → senão `PLATFORM_DATABASE_URL`.

**Não rode contra produção sem aprovação explícita do Iago.**

## Feature flags (default off)

| Env | Valores | Default |
|-----|---------|---------|
| `PERSISTENCE_MODE` | `jsonb` \| `hybrid` \| `relational` | `jsonb` |
| `REL_USERS` | `0` \| `1` | off |
| `REL_SHOPS` | `0` \| `1` | off |
| `REL_ORDERS` | `0` \| `1` | off |
| `REL_FLEET` | `0` \| `1` | off |
| `REL_LEDGER` | `0` \| `1` | off |
| `REL_HQ` | `0` \| `1` | off |

Código: `services/persistenceMode.ts`.

- **F0:** runner + flags (default off).
- **F1:** tabelas `users` / `sessions` / `password_resets` (`0002_…sql`). Com `PERSISTENCE_MODE=hybrid` + `REL_USERS=1`, auth faz **dual-write** (JSONB continua SoT/leitura). Cutover de leitura **não** ligado.
