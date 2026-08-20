# Smoke + soft launch (piloto pago)

Ver também: [VOCE_FAZ.md](./VOCE_FAZ.md) — lista curta do que só você (Neon/Railway/celular) precisa fazer.

Critério de “no ar”: cliente paga Pix LIVE, loja e entregador veem o pedido, dinheiro credita no ledger, saque Pix-out funciona — **sem Expo Go** no APK de teste.

## Pré-requisitos

1. Railway com `DATABASE_URL`, `MP_ACCESS_TOKEN` (APP_USR), `NODE_ENV=production`, `MP_PAYOUT_MODE=live`
2. Health: `GET /health` → `fleet=postgres`, `platform=postgres`, `payments=true`
3. App: `EXPO_PUBLIC_API_URL=https://sua-api...` no profile EAS `preview`/`production`
4. Build: `eas build -p android --profile preview` → instalar APK nos testadores
5. Flags OFF: `ALLOW_MANUAL_PIX`, `USE_MOCK_PAYMENTS`, `ALLOW_DEMO_CITY`, `ALLOW_TEST_PIX`
6. Opcional: `FLEET_SYNC_SECRET` / `PLATFORM_LEDGER_SECRET` (ops interno)

## Checklist dinheiro (ordem)

- [ ] Cadastro/login **cliente** na nuvem (mesma conta no celular)
- [ ] **Comércio**: login cloud → sync loja (`upsert_shop` grava `ownerUserId`)
- [ ] Pedido Pix LIVE (valor baixo) → polling confirma → `paymentConfirmed`
- [ ] API: `POST /api/payments/order-credit` phase `paid` (automático no app) → ledger merchant com crédito do `establishmentAmount`
- [ ] Comércio: carteira mostra saldo do ledger → preparar → código retirada
- [ ] **Entregador**: login cloud → online → claim → entrega → código
- [ ] Após entrega: `order-credit` phase `delivered` credita frete no `userId` da sessão do entregador
- [ ] Cancelamento &lt; 2 min com pagamento → `POST /api/payments/refund` (Bearer + orderId) estorna MP **e** debita ledger
- [ ] Saque **merchant** (Payouts liberado) → Pix-out real
- [ ] Saque **entregador** (chave Pix + CPF) → mesmo `/api/payments/withdraw` com `driverId`
- [ ] Reiniciar app: conta e pedido ainda existem (Postgres)

## Checklist descoberta (cliente)

- [ ] Home: busca mostra **itens e lojas**; filtros Abertos/km/frete aplicam nos produtos
- [ ] Chip Conveniência filtra a grade na home; CTA abre o hub
- [ ] Hub Conveniência: Abertos / até 2 km / ordenação
- [ ] Tab Buscar: distâncias atualizadas (proximidade)
- [ ] Voltar de produto aberto na home volta para a home (não para a tab Buscar)
- [ ] Mapa só aparece com entrega ao vivo

## Soft launch

- Convidar só comércios + entregadores + clientes da cidade piloto
- Monitorar logs Railway + painel Mercado Pago o dia inteiro
- Emergência: derrubar checkout (remover `MP_ACCESS_TOKEN`) + rollback APK

## Comandos úteis

```bash
# API local com Postgres
NODE_ENV=production DATABASE_URL=... MP_ACCESS_TOKEN=... npm run api:server

# Build interno Android
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Substitua `extra.eas.projectId` em `app.json` após `eas init`.
