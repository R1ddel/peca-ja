# Split marketplace PJ-ready (Mercado Pago)

## Ideia

| Modo | Quando | Para onde vai o dinheiro |
|------|--------|---------------------------|
| `collector_ledger` (padrão) | `MP_MARKETPLACE_SPLIT` off ou loja sem OAuth | Tudo na conta Peça Já → ledger → saque |
| `marketplace_split` | Flag on + loja com `mpSellerAccessToken` | Lojista recebe no MP; taxa (+ frete) via `application_fee` |

Motoboy (fase 1): frete fica na plataforma (`MP_SPLIT_HOLD_DRIVER_ON_PLATFORM=1`) e segue no **ledger** até existir split 3 vias.

## Vars (servidor / Railway)

```env
MP_MARKETPLACE_SPLIT=0
PLATFORM_MP_COLLECTOR_ID=
MP_SPLIT_HOLD_DRIVER_ON_PLATFORM=1
MP_ACCESS_TOKEN=          # token da conta PJ Peça Já (quando abrir)
```

Piloto: deixe `MP_MARKETPLACE_SPLIT=0`. Nada muda no app do cliente.

## Quando abrir a conta PJ

1. CNPJ + conta Mercado Pago PJ  
2. `MP_ACCESS_TOKEN` = token LIVE dessa conta  
3. Preencha `PLATFORM_MP_COLLECTOR_ID` (id do usuário/collector no MP)  
4. Ative Marketplace / Split no painel MP  
5. Cada loja: OAuth seller → grave `mpSellerAccessToken` (+ `mpCollectorId`) na loja no servidor  
6. `MP_MARKETPLACE_SPLIT=1` + redeploy  

## Estorno

- MP desfaz o pagamento e o split proporcional (loja + application_fee).  
- Ledger só reverte o que ainda foi creditado internamente (ex.: frete).  
- Se a loja já sacou e não tem saldo, o MP pode falhar o refund total — política ops cobre o cliente.

## Código

- `services/marketplaceSplit.ts` — plano + flag  
- `app/api/payments/pix+api.ts` / `card/charge+api.ts` — aplica `application_fee` + token do seller  
- `order-credit` — não credita lojista se `merchantPaidViaMp`  
- Pedido guarda `settlementMode` / flags no checkout  
