# Frota compartilhada — produção

## O que está pronto no código
- API `/api/fleet` (Expo + servidor `npm run fleet:server`)
- Postgres opcional (`FLEET_DATABASE_URL`) com claim atômico
- App sincroniza pedidos / ofertas / heartbeat / denúncias
- Chip **Frota online** nos painéis comércio e entregador
- Corridas ativas em destaque nos dois painéis

## Rodar agora (LAN / vários Expo Go)

```bash
# Terminal 1 — app
npm start

# Terminal 2 — frota dedicada (opcional, recomendado)
npm run fleet:server
```

No `.env` do app (IP do seu PC na Wi‑Fi):

```
EXPO_PUBLIC_USE_FLEET_SERVER=1
# ou fixo:
# EXPO_PUBLIC_FLEET_URL=http://192.168.x.x:8787
```

Reinicie o Expo. Todos os celulares no mesmo QR compartilham a fila.

Cheque: `npm run fleet:check`

## Produção (quando for lançar)

1. Crie Postgres no [Neon](https://neon.tech) → cole `FLEET_DATABASE_URL` no `.env` / Railway
2. Deploy da API (`Dockerfile` ou `railway.toml`)
3. No app: `EXPO_PUBLIC_API_URL=https://sua-api...`
4. Health deve retornar `"persistence":"postgres"`

Schema: `server/schema.sql` (auto-cria no 1º request).

Plataforma (auth/pedidos/lojas) no mesmo servidor: ver [PLATFORM.md](PLATFORM.md).

## Testes
```bash
npm run fleet:test
npm run fleet:check
npm run platform:check
```
