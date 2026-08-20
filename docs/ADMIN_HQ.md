# Painel HQ Peça Já (`/admin`)

Painel web/ops da plataforma: overview, lojas, pedidos, tickets, frota e equipe.

## Acesso

1. Conta cloud no app (registro/login plataforma)
2. **CEO:** e-mail em `PLATFORM_CEO_EMAILS` **ou** aba **Ativar HQ** com `SUPPORT_PIN`
3. **Ops:** CEO promove em `/admin/team`

### Recuperar senha

Em `/admin/login` → aba **Recuperar** → Gerar código (aparece na tela no piloto) → nova senha.

Vars: `EXPOSE_PASSWORD_RESET_CODE=1` no Railway (padrão recomendado até ter SMTP).

```env
PLATFORM_CEO_EMAILS=seu@email.com,outro@email.com
EXPOSE_PASSWORD_RESET_CODE=1
SUPPORT_PIN=seu-pin
```

Após mudar vars no Railway, faça redeploy / restart do serviço `api`.

## Abrir

- Local web: `npx expo start --web` → `http://localhost:8081/admin`
- App: navegue para `/admin` (login HQ)

A API de dados é a mesma do Railway (`EXPO_PUBLIC_API_URL`).

## Papéis

| Papel | Pode |
|-------|------|
| CEO | Tudo + suspender loja + gerir equipe |
| Ops | Overview, lojas (leitura), pedidos, tickets, frota |
| PIN `SUPPORT_PIN` | Break-glass nos tickets/frota antigos (`/support/*`) |

## Suspensão de loja

CEO suspende em Lojas → ficha. Loja some de `list_shops` / catálogo do cliente.
