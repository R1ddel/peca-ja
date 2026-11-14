# Patch de segurança — 08/11/2026 (rodada 1)

> Rodada 2: ver [`docs/SEGURANCA_ROUND2.md`](./SEGURANCA_ROUND2.md).

Base: relatório de auditoria (3 críticas, 2 altas, 3 médias).

## Feito no código

| ID | Item | Status |
|----|------|--------|
| T1 | Heartbeat autenticado; sem roster; sem overwrite de perfil | ✅ |
| T2 | CORS allowlist (sem `*`) | ✅ |
| T3 | Webhook MP exige `x-signature` + `MP_WEBHOOK_SECRET` | ✅ |
| T4 | Rate limit 5/min pagamentos + admin; lockout PIN | ✅ |
| T6 | Headers de segurança API + `public/_headers` no web | ✅ (web precisa redeploy EAS) |
| T7 | `pix` / `card/save` / `card/charge` exigem sessão primeiro | ✅ |
| T8 | `/health` só `{ok:true}`; 404 genérico | ✅ |
| — | Revoga driverTokens + apaga probes no boot | ✅ |

## Você precisa configurar (produção)

1. **Railway Variables**
   - `MP_WEBHOOK_SECRET` = secret do webhook no painel Mercado Pago  
   - `CORS_ALLOWED_ORIGINS` = opcional, CSV além de `https://peca-ja.expo.app` e localhost  
   - Webhook URL no MP: `https://api-production-8092.up.railway.app/api/payments/webhook`

2. **Deploy da API** (quando autorizar): `railway up` no serviço `api`

3. **Redeploy do site** (headers CSP/`_headers`): `eas deploy --prod` quando autorizar

4. **T5 Cloudflare** (ainda manual): apontar `api.pecaja...` via Cloudflare para o Railway e trocar `EXPO_PUBLIC_API_URL` — esconde a URL crua do Railway

## Aceitação rápida (depois do deploy)

```bash
# Heartbeat anônimo → 401
curl -s -X POST https://API/api/fleet -H "Content-Type: application/json" \
  -d "{\"action\":\"heartbeat\",\"fleetId\":\"x\"}"

# CORS evil → sem Allow-Origin
curl -sI -H "Origin: https://evil.example.com" https://API/api/fleet

# Webhook vazio → 401
curl -s -X POST https://API/api/payments/webhook -H "Content-Type: application/json" -d "{}"

# Health mínimo
curl -s https://API/health
# → {"ok":true}

# Pix sem token → AUTH
curl -s -X POST https://API/api/payments/pix -H "Content-Type: application/json" -d "{}"
```
