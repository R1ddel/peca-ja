# Deploy produção — Neon + Railway

O app no Expo Go / APK aponta pra API pública. A API usa Postgres (Neon) pra auth, pedidos, lojas, frota **e pagamentos** (`/api/payments/*`).

Ver também: [SMOKE_PILOT.md](./SMOKE_PILOT.md).

## 1) Neon (banco)

1. Abra https://console.neon.tech e crie conta (GitHub ok)
2. **New Project** → nome `pecaja` → região perto do Brasil
3. Em **Connection details** copie a URL (`postgresql://...`)
4. Cole no `.env` local:

```env
DATABASE_URL=postgresql://USER:PASS@HOST/neondb?sslmode=require
FLEET_DATABASE_URL=${DATABASE_URL}
EXPO_PUBLIC_USE_FLEET_SERVER=1
SUPPORT_PIN=pecaja-suporte
```

5. Inicialize o schema:

```bash
npm run db:init
```

## 2) Railway (API)

1. https://railway.app → **Deploy from GitHub** ou Dockerfile
2. Variáveis:

| Key | Valor |
|-----|--------|
| `DATABASE_URL` | URL Neon |
| `FLEET_DATABASE_URL` | igual (opcional) |
| `NODE_ENV` | `production` |
| `PORT` | `8787` |
| `SUPPORT_PIN` | PIN suporte (nunca `EXPO_PUBLIC_`) |
| `MP_ACCESS_TOKEN` | `APP_USR-...` LIVE |
| `MP_PAYOUT_MODE` | `live` (nunca `simulate` em prod) |

3. **Generate Domain**
4. Health: `https://SEU-DOMINIO.up.railway.app/health`  
   Deve retornar `"fleet":"postgres"`, `"platform":"postgres"`, `"payments":true`.
5. Privacidade (Play Store): `https://SEU-DOMINIO.up.railway.app/privacy`
6. Rotas: `/api/fleet`, `/api/platform`, `/api/payments/pix`, `/api/payments/refund`, `/api/payments/withdraw`, …
7. Depois do domínio: `npm run api:url -- https://SEU-DOMINIO.up.railway.app`

Em `NODE_ENV=production` **não há** fallback `.data/` — se o Postgres cair, a API falha de propósito.

## 3) App (Expo / EAS)

```env
EXPO_PUBLIC_API_URL=https://SEU-DOMINIO.up.railway.app
EXPO_PUBLIC_USE_FLEET_SERVER=1
```

- `MP_ACCESS_TOKEN` fica **só no servidor**, não no app.
- Build interno: `eas.json` profile `preview` → `npx eas-cli build -p android --profile preview`
- Substitua `extra.eas.projectId` em `app.json` após `eas init`.

Flags OFF: `ALLOW_MANUAL_PIX_CONFIRM`, `USE_MOCK_PAYMENTS`, `ALLOW_DEMO_CITY`, `ALLOW_TEST_PIX`.

## 4) Checklist

```bash
npm run db:init
npm run api:server
npm run platform:check
npm run fleet:check
npm run payments:check
# Com API no ar:
SMOKE_HTTP=1 npm run payments:check
```

Depois do domínio Railway, substitua `REPLACE_WITH_RAILWAY_URL` em `eas.json` e `app.json`.

Ver também: [VOCE_FAZ.md](./VOCE_FAZ.md) (só o que depende de contas suas).

## Notas

- Dockerfile + `railway.toml` prontos
- Não commit `.env`
