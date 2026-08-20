# Peça Já — caminho até testes na Play (meta: terça)

Checklist operacional para começar testes **terça**. Produção pública da loja pode vir depois (regra dos 12×14 dias).

## Dom (hoje) — o que o agente já prepara

- [x] Fluxo Pix / ledger / saque no código
- [x] `MP_ACCESS_TOKEN` LIVE + API local
- [x] Política de privacidade em `GET /privacy`
- [x] Dockerfile + `railway.toml`
- [x] Profile EAS `preview` (APK) e `production` (AAB)
- [ ] Subir API pública (Railway) **← precisa da sua conta**
- [ ] `eas login` + `eas init` **← precisa da sua conta Expo**

## Seg (amanhã) — contas e deploy

### Você (contas — sem isso não fecha)

1. **Railway** — https://railway.app → login GitHub → New Project → Deploy from local/GitHub deste repo  
   Vars:
   - `DATABASE_URL` = mesma do Supabase (pooler `:6543` + `pgbouncer=true`)
   - `FLEET_DATABASE_URL` = igual
   - `NODE_ENV=production`
   - `PORT=8787`
   - `MP_ACCESS_TOKEN` = token LIVE (gere um novo; o antigo vazou no chat)
   - `MP_PAYOUT_MODE=live`
   - `SUPPORT_PIN` = PIN só seu
2. Generate Domain → abra `https://SEU-DOMINIO/health` e `…/privacy`
3. Me manda a URL (ex.: `https://pecaja-xxx.up.railway.app`)
4. **Expo** — no terminal: `npx eas-cli login` e `npx eas-cli init`
5. **Play Console** — conta desenvolvedor (US$ 25) se ainda não tiver

### Agente (depois da URL)

- Colar URL em `eas.json` + `.env` (`EXPO_PUBLIC_API_URL`)
- `eas build -p android --profile preview` (APK interno)
- `eas build -p android --profile production` (AAB para Play)

## Terça — testes

### Caminho A — rápido (sem esperar review Play)

1. Instalar APK `preview` nos celulares dos testadores
2. Smoke: cadastro → Pix baixo → loja vê pedido → crédito → saque
3. Entregador: claim → entrega → saque frete

### Caminho B — Play (teste interno/fechado)

1. Criar app `Peça Já` no Play Console (`app.pecaja.cliente`)
2. Preencher ficha + Data safety + link `/privacy`
3. Upload AAB → **Internal testing** (até 100 e-mails) **ou** Closed testing
4. Convidar ≥12 testers se for conta pessoal nova (relógio 14 dias para produção)

## Textos da loja (copiar/colar)

**Nome:** Peça Já  
**Pacote:** `app.pecaja.cliente`  
**Short description (80):** Pedidos locais com Pix: peça no comércio perto de você e receba em casa.  
**Full description:**  
Peça Já conecta clientes, comércios e entregadores na sua cidade. Pague com Pix, acompanhe o pedido e receba na porta. Comerciantes gerenciam cardápio, pedidos e saques. Entregadores aceitam corridas e recebem o frete.

**Categoria:** Comida e bebida / Compras  
**E-mail suporte:** (preencha o seu)  
**Política de privacidade:** `https://SUA-API/privacy`

## Comandos úteis

```bash
npm run api:server
npm run payments:check
npm run qr

# Depois do login Expo + URL Railway:
npx eas-cli build -p android --profile preview
npx eas-cli build -p android --profile production
```

## Bloqueios externos (não são código)

| Item | Impacto |
|------|---------|
| Conta Railway / Expo / Play | Deploy e build |
| Payouts MP liberado | Saque Pix-out real |
| 12×14 dias (conta pessoal Play nova) | Só afeta **produção pública**, não o teste interno |
