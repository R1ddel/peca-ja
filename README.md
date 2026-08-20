# Peça Já

App de delivery multi-papel (cliente · comércio · entregador · suporte) no **Expo SDK 54** / Expo Go.

> **Regra crítica:** não usar `react-native-reanimated` nem `react-native-worklets` (quebra no motor do celular).

## O que já roda

| Papel | Fluxo |
|-------|--------|
| Cliente | Cardápio → carrinho → Pix/cartão (Mercado Pago) → acompanhamento |
| Comércio | Pedidos, cardápio, equipe, promo, saldo, insights |
| Entregador | Online, oferta exclusiva, mapa, código de entrega, carteira |
| Suporte | FAQ + tickets (`/support`) + frota admin (`/support/fleet-admin`) |

## Arquitetura (piloto → produção)

- **App** Expo Router (`app/`)
- **API unificada** `npm run fleet:server` (porta **8787**):
  - `/api/fleet` — ofertas, claim, heartbeat
  - `/api/platform` — auth (senha com scrypt), pedidos, lojas, ledger, tickets
- **Persistência:** Postgres (`DATABASE_URL` / `FLEET_DATABASE_URL`) ou arquivo `.data/` (só LAN)
- **Fallback:** se a API estiver offline, o app continua em AsyncStorage local

## Subir agora (LAN / vários celulares)

```bash
# Terminal 1 — API (frota + plataforma)
npm run fleet:server

# Terminal 2 — app
npm start
```

No `.env` (copie de `.env.example`):

```env
MP_ACCESS_TOKEN=TEST-...ou APP_USR-...
EXPO_PUBLIC_USE_FLEET_SERVER=1
# EXPO_PUBLIC_FLEET_URL=http://SEU_IP_NA_WIFI:8787
# DATABASE_URL=postgresql://...   # Neon / Railway — produção
EXPO_PUBLIC_SUPPORT_PIN=pecaja-suporte
```

Reinicie o Expo depois de mudar o `.env`.

### Checagens

```bash
npm run fleet:check
npm run platform:check
```

Health da API: `http://localhost:8787/health`  
Plataforma: `http://localhost:8787/api/platform` (GET)

## Produção (checklist)

1. Postgres (Neon) + API (Railway) — guia completo: [docs/DEPLOY.md](docs/DEPLOY.md)
2. `npm run db:init` com `DATABASE_URL` no `.env`
3. Deploy Railway (`Dockerfile` / `railway.toml`)
4. App: `EXPO_PUBLIC_API_URL=https://sua-api...`
5. Health deve mostrar `fleet` / `platform` = `postgres`
6. Mercado Pago live + webhooks; mocks desligados

## Contas / auth

- Registro e login preferem a **API** (hash scrypt + token de sessão)
- Sem API: fallback local (demo no aparelho)
- Perfil mostra se a sessão é nuvem (`cloudAuth`)

## Docs extras

- [Frota](docs/FLEET.md)
- [Plataforma](docs/PLATFORM.md)

## Scripts

| Script | Uso |
|--------|-----|
| `npm start` | Expo LAN :8081 |
| `npm run fleet:server` | API frota + plataforma :8787 |
| `npm run fleet:check` | Health / sync frota |
| `npm run platform:check` | Health auth/pedidos |
| `npm run fleet:test` | Smoke dispatch |
