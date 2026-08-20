# Lançamento Play Store + App Store

Objetivo: quando isto estiver ✅, o **último passo** é só publicar nas lojas.

## Fase A — Infra (antes do build de loja)

| # | Item | Status | Como |
|---|------|--------|------|
| A1 | Postgres (Supabase) + `db:init` | [ ] | `DATABASE_URL` pooler |
| A2 | API no Railway HTTPS | [ ] | CLI abaixo |
| A3 | `/health` → postgres + payments + mp | [ ] | Abrir no browser |
| A4 | `/privacy` no ar | [ ] | Link da ficha das lojas |
| A5 | `npm run api:url -- https://…railway.app` | [ ] | Grava `eas.json` + `.env` |
| A6 | Flags mock OFF | [ ] | Sem `USE_MOCK` / `ALLOW_MANUAL_PIX` / `ALLOW_TEST_PIX` |
| A7 | Token MP LIVE novo (rotacionado) | [ ] | Painel MP → Credentials |
| A8 | Payouts MP liberado (saque) | [ ] | Suporte MP |

### Railway CLI (sem GitHub App)

No PowerShell, na pasta do projeto:

```powershell
cd C:\Users\iagot\Projects\peca-ja
npx @railway/cli login
npx @railway/cli link
```

Escolha o projeto `bem-sucedida-esperança` (ou crie um).

Variáveis (painel **Variables** ou `railway variables set`):

```
NODE_ENV=production
PORT=8787
MP_PAYOUT_MODE=live
DATABASE_URL=...
FLEET_DATABASE_URL=...
MP_ACCESS_TOKEN=...
SUPPORT_PIN=...
```

Deploy:

```powershell
npx @railway/cli up
npx @railway/cli domain
```

Me envie o domínio gerado.

---

## Fase B — Contas e identidade do app

| # | Item | Status |
|---|------|--------|
| B1 | Expo: `npx eas-cli login` | [ ] |
| B2 | Expo: `npx eas-cli init` (grava projectId real) | [ ] |
| B3 | Google Play Console (US$ 25) | [ ] |
| B4 | Apple Developer (US$ 99/ano) | [ ] |
| B5 | App criado no Play (`app.pecaja.cliente`) | [ ] |
| B6 | App criado no App Store Connect (mesmo bundle id) | [ ] |

---

## Fase C — Builds de loja (EAS)

Com a URL Railway já no `eas.json`:

```powershell
npx eas-cli build -p android --profile production
npx eas-cli build -p ios --profile production
```

| # | Item | Status |
|---|------|--------|
| C1 | AAB Android production | [ ] |
| C2 | IPA iOS production | [ ] |
| C3 | Smoke no AAB/TestFlight: Pix → pedido → saque | [ ] |

Opcional submit draft:

```powershell
npx eas-cli submit -p android --profile production
npx eas-cli submit -p ios --profile production
```

---

## Fase D — Ficha das lojas (conteúdo)

Textos prontos em [TESTES_TERCA.md](./TESTES_TERCA.md).

| # | Item | Status |
|---|------|--------|
| D1 | Nome, short/full description | [ ] |
| D2 | Ícone 512 + screenshots phone | [ ] |
| D3 | Link privacidade = `https://API/privacy` | [ ] |
| D4 | Data safety / App Privacy (localização, fotos, compras) | [ ] |
| D5 | Classificação etária | [ ] |
| D6 | E-mail de suporte | [ ] |

---

## Fase E — Último passo (só lançamento)

Quando A–D estiverem ✅:

### Play Store
1. Upload AAB (ou já submetido via EAS)
2. Teste interno → (se conta pessoal nova) closed 12×14 → pedir produção
3. **Publicar** / rollout

### App Store
1. Build no TestFlight
2. Preencher App Store Connect
3. **Submit for Review** → após aprovação, **Release**

---

## IDs do app (não mudar)

- Android package: `app.pecaja.cliente`
- iOS bundle: `app.pecaja.cliente`
- Nome: Peça Já
- Versão inicial: `1.0.0`
