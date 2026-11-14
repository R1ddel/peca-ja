# O que só você precisa fazer (parte do agente já pronta)

**Meta lojas:** [LANCAMENTO_LOJAS.md](./LANCAMENTO_LOJAS.md) — deixar A–D prontos; E = só publicar.  
**Testes terça:** [TESTES_TERCA.md](./TESTES_TERCA.md).

O repasse para qualquer banco está em [SPLIT_MARKETPLACE.md](./SPLIT_MARKETPLACE.md).
Quando a conta Mercado Pago PJ abrir, seguir aquele arquivo. Loja e entregador não conectam Mercado Pago.
Abaixo é **só ops** — contas e cliques que eu não posso fazer por você.

## 1) Banco (Supabase ou Neon) — 5 min

```env
DATABASE_URL=postgresql://...
FLEET_DATABASE_URL=postgresql://...
MP_PAYOUT_MODE=live
```

`npm run db:init`

## 2) Railway (API pública) — CLI sem GitHub App

```powershell
npx @railway/cli login
npx @railway/cli link
npx @railway/cli up
```

Vars: ver [RAILWAY_VARS.example.env](./RAILWAY_VARS.example.env)  
Depois: Generate Domain → `npm run api:url -- https://SEU-DOMINIO.up.railway.app`

## 3) Expo / EAS

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build -p android --profile production
npx eas-cli build -p ios --profile production
```

## 4) Smoke

[SMOKE_PILOT.md](./SMOKE_PILOT.md)

## Já pronto no código

- Pix / ledger / saque / normas no servidor
- `/privacy` para as lojas
- `eas.json` production Android (AAB) + iOS
- `npm run payments:check`
