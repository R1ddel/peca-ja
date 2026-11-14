# Segurança — Rodada 2 (08/11/2026)

Base: `relatorio-seguranca-pecaja-v2.md`. Código corrigido no repositório; **sem deploy** e **sem SQL em produção**.

## Status

| ID | Item | Status |
|----|------|--------|
| P0-1 | Reset sem token na resposta; hash SHA-256; e-mail Resend; uso único; revoga sessões | Corrigido no código. E-mail só sai com `RESEND_API_KEY`. |
| P0-2 | Login/reset uniformes; dummy hash; sem `exists` | Corrigido |
| P0-3 | Heartbeat exige `driverToken`; `driver_auth` com cadastro aprovado; sem roster/PII; não cria probe | Corrigido. Tokens antigos revogados no boot (`FLEET_REVOKE_TOKENS_ON_BOOT`). |
| P0-4 | Webhook: secret ausente → 503; assinatura inválida → 401; idempotência em memória; alerta no boot | Corrigido no código. **`MP_WEBHOOK_SECRET` ainda precisa ser setado no Railway.** |
| P1-5 | Sem PIN `1234` / `FIXED_PANEL_PIN`; dono = e-mail da compra; erro genérico | Corrigido no client. Sessão de equipe **ainda é local** (Expo Go); ver riscos. |
| P1-6 | `showAlert` + `AlertHost` no web (patch de `Alert.alert`) | Corrigido. Host dentro do `AuthProvider` (não altera `_layout.tsx`). |
| P1-7 | Rate limit login/reset/payments/fleet/webhook + `Retry-After` + `RATE_LIMIT` | Corrigido (memória por réplica). |
| P1-8 | CSP meta + `public/_headers` | Corrigido no repo. Headers HTTP reais só após redeploy EAS/Cloudflare. |
| P2-9 | API atrás do Cloudflare | **Pendente (DNS manual).** |
| P2-10 | Servidor ignora flags de teste do cliente; ghost card só em `__DEV__` | Corrigido |
| P2-11 | `order-credit` autentica antes da validação | Corrigido |
| P2-12 | health `{ok:true}`; TRACE 405; register vazio 400; 500 genérico em prod | Corrigido |
| P3 | Obras demo gated; loja Recheck filtrada; script de limpeza (não executado) | Parcial |
| P3 | Hydration SSR / rating único | **Adiado** (risco de regressão, não é takeover). |
| T9 | Cookie HttpOnly | **Adiado** (quebra o app nativo/AsyncStorage). |

## O que você precisa configurar (produção, sem eu fazer)

1. Railway: `MP_WEBHOOK_SECRET` (secret do painel Mercado Pago). Sem isso pagamentos reais não confirmam (503).
2. Railway: `RESEND_API_KEY` + `RESET_MAIL_FROM`. Sem isso o reset responde 200 genérico e **não entrega e-mail**.
3. Railway: `EXPOSE_PASSWORD_RESET_CODE=0`.
4. Redeploy da API e do site EAS quando autorizar.
5. Cloudflare: `api.peca-ja.expo.app` → Railway (P2-9).
6. Limpeza SQL: revisar `scripts/cleanup-security-round2.sql` com backup; **não rode agora**.

## Testes

```bash
npm run security:round2
```

Não executa SQL, não chama a API de produção, não usa `DATABASE_URL`.
