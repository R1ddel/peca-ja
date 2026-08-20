# Plataforma Peça Já (auth · pedidos · lojas · ledger · suporte)

## Endpoints

Base: mesmo host da frota (`EXPO_PUBLIC_API_URL` ou `:8787`).

| Método | Path | Uso |
|--------|------|-----|
| GET | `/api/platform` | Health (`persistence`: postgres \| filesystem) |
| POST | `/api/platform` | Ações JSON `{ "action": "..." }` |

### Ações principais

- `register` / `login` / `me` / `logout` / `reset_password` / `update_profile`
- `list_orders` / `upsert_order` / `sync_orders` / `get_order`
- `list_shops` / `upsert_shop`
- `ledger_list` / `ledger_post`
- `ticket_create` / `ticket_list` / `ticket_update` (list/update admin exigem PIN)

## Persistência

Usa `PLATFORM_DATABASE_URL` → senão `FLEET_DATABASE_URL` → senão `DATABASE_URL`.  
Sem URL: `.data/platform/state.json`.

Tabela Postgres auto-criada: `platform_state` (JSONB).

## App

- `context/AuthContext.tsx` — tenta nuvem, fallback local
- `context/OrdersContext.tsx` — sync pedidos com plataforma + frota
- `utils/merchantShop.ts` — push/pull de lojas
- `app/support/tickets.tsx` — ops de tickets (PIN)

## Checagem

```bash
npm run fleet:server
npm run platform:check
```
