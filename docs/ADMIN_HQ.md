# Peça Já Command Center (`/admin`)

Painel administrativo **exclusivo na web (desktop)**. Não use no app mobile — no celular o shell mostra aviso para abrir no navegador.

## Abrir

```bash
npx expo start --web
# http://localhost:8081/admin
```

API: mesma do Railway (`EXPO_PUBLIC_API_URL`).

## Acesso

1. Conta cloud (registro/login plataforma)
2. **Super Admin (CEO):** e-mail em `PLATFORM_CEO_EMAILS` **ou** aba **Ativar HQ** com `SUPPORT_PIN`
3. Outros papéis: Super Admin promove em **Equipe HQ**

```env
PLATFORM_CEO_EMAILS=seu@email.com
EXPOSE_PASSWORD_RESET_CODE=0
SUPPORT_PIN=seu-pin
```

## Papéis (RBAC)

| Papel | Capacidade principal |
|-------|----------------------|
| `ceo` | Tudo (Super Admin) |
| `admin` | Quase tudo (sem team) |
| `ops` / `operations` | Operação, block, CRM |
| `finance` | Financeiro, export, audit leitura |
| `support` | View + edit + CRM |
| `commercial` | CRM comercial |
| `marketing` | Cupons/campanhas |
| `auditor` | Audit/export |

Permissões verificadas **no backend** (`hasPermission` / `requirePerm`).

## Módulos

Dashboard, Operação Agora, Mapa, Pedidos, Clientes 360, Comércios, Frota, Pipeline CRM, Cidades, Produtos, Financeiro, Carteiras, Marketing, Suporte, Avaliações, Relatórios, Auditoria, Logs técnicos, Saúde, Feature Flags, Incidentes, Data Quality, Equipe, **Equipe IA** (`/admin/ai-team` — agentes do pacote `equipe-ia/`, briefing e aprovações).

## Regras

- Dados reais (`platform_state` + `fleet_state`)
- Toda mutação sensível gera **audit log** append-only
- Ações de alto risco exigem **motivo**
- Sem mock de produção; sem botões decorativos

## Tema

Light (padrão) / Dark — toggle no sidebar.
