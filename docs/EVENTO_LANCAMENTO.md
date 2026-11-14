# Evento de lançamento — Peça Já (visão + checklist)

## A ideia do dia

| Momento | O que acontece |
|---------|----------------|
| **Local** | Auditório, com apoio da Prefeitura de Mucugê |
| **Público** | 200–300 pessoas (comerciantes + comunidade) |
| **1ª parte** | Apresentações de outros representantes |
| **Sua parte** | Você sobe e mostra as funcionalidades do app |
| **Demo ao vivo** | Na frente de todos: faz um pedido real → entregador chega no meio da apresentação |
| **Depois** | Network — buffet + música ao vivo (hora de ouvir lojista e fechar conversa) |

**Condição não negociável:** no dia do evento o app já está na **Play Store** e na **App Store**, com **10 lojas parceiras** cadastradas e pelo menos **1 entregador** combinado para a demo.

---

## Por que o app precisa estar 100% antes

No auditório não tem “depois a gente vê”. Se Pix falhar, loja não receber, ou entregador não achar o pedido, o público inteiro vê.

Critério de “pronto pro evento”:

1. App instalável pelas lojas (links das stores)  
2. Pedido real: Pix LIVE → loja vê → prepara → código → entregador → entrega  
3. 10 lojas com cardápio mínimo (5–10 itens + foto + horário)  
4. Ensaio da demo **no mesmo auditório / rota** 1–2 dias antes  
5. Plano B: Wi‑Fi do local + 4G backup + pedido de valor baixo já testado

Detalhe técnico das lojas: [LANCAMENTO_LOJAS.md](./LANCAMENTO_LOJAS.md) · Smoke: [SMOKE_PILOT.md](./SMOKE_PILOT.md)

---

## Contagem regressiva (trabalhe de trás pra frente)

### D−30 a D−21 — Infra + stores (bloqueia tudo)

- [ ] API pública no ar (`/health` + `/privacy` OK)  
- [ ] Mercado Pago LIVE (token novo, payouts se for usar saque)  
- [ ] Conta Expo/EAS + builds production  
- [ ] Play Console + App Store Connect criados  
- [ ] Submit Android + iOS (**Apple costuma demorar dias na review**)  
- [ ] Soft launch / teste interno enquanto aguarda aprovação  

### D−20 a D−10 — 10 lojas parceiras

- [ ] Fechar 10 apoiadoras (WhatsApp / visita)  
- [ ] Cada uma: plano + termo + cardápio + horário + Pix da loja  
- [ ] Autorização de divulgação  
- [ ] Lista oficial das 10 pro slide / material do evento  
- [ ] Dados de divulgação: [DADOS_APOIADOR_DIVULGACAO.md](./DADOS_APOIADOR_DIVULGACAO.md)  

### D−9 a D−3 — Demo ao vivo + ensaio

- [ ] Escolher **1 loja** da demo (próxima do auditório, rápida de preparar)  
- [ ] Escolher **1 entregador** de confiança + plano B (2º entregador)  
- [ ] Combinar item fixo da demo (preço baixo, preparo &lt; 10–15 min)  
- [ ] Ensaio completo 1× (pedido → entrega)  
- [ ] Segundo ensaio no horário parecido com o do evento  
- [ ] Celular do apresentador: app logado, endereço = auditório, Pix/cartão ok  
- [ ] Wi‑Fi do auditório testado + hotspot de backup  

### D−2 a D−1 — Evento operacional

- [ ] Confirmar presença Prefeitura / palestrantes  
- [ ] Slide: 10 lojas + QR das stores + “como pedir”  
- [ ] Impressos / QR na entrada (baixar Peça Já)  
- [ ] Buffet + música confirmados (pós-network)  
- [ ] Roteiro da sua fala + momento exato do pedido  

### Dia D — No auditório

1. Chegar cedo: Wi‑Fi, app, loja aberta no interruptor, entregador online  
2. Outras apresentações  
3. Sua fala: problema → Peça Já → regra do dinheiro (loja recebe o cardápio)  
4. **Pedido ao vivo** (anunciar: “pedi agora na [loja]”)  
5. Continuar features enquanto o pedido anda  
6. Entregador entra / entrega no palco ou na plateia  
7. Encerrar com CTA: baixem o app / lojistas falem com a equipe no network  
8. **Network** (buffet + música) — escutar, anotar, não só vender  

---

## Roteiro curto da sua apresentação (sugestão)

1. **Por que existe** (cidade, comércio local, margem intacta) — 2 min  
2. **Como funciona** (cliente → loja → moto) — 2 min  
3. **Demo** (pedir na hora) — 1 min + tracking enquanto fala  
4. **O que a loja ganha** (apoiador, 1º mês, divulgação) — 2 min  
5. **Entrega chega** — momento “uau”  
6. **Convite** ao network e ao download — 1 min  

---

## Risco → plano B

| Risco | Plano B |
|-------|---------|
| Store ainda em review no dia D | Ter APK/TestFlight de convidados + QR; não inventar “já está nas lojas” se não estiver |
| Pix lento | Item barato; Pix já testado; começar o pedido **no início** da sua fala |
| Loja atrasa o preparo | Loja ensaiada; item “pronto rápido”; cozinha avisada do horário exato |
| Entregador some | 2º entregador no local; você já ter o pedido em “a caminho” no ensaio |
| Internet cai | Hotspot; prints de backup só se for emergência (prefira real) |

---

## Próximo passo agora (voltar ao “app 100%”)

Ordem correta pra liberar sua cabeça pro evento:

1. **Você (contas):** Railway URL pública + `eas login` / `eas init` + Play + Apple  
2. **Junto:** colar API no app, build production, smoke Pix LIVE  
3. **Submit** nas duas stores (começar Apple cedo)  
4. Em paralelo à review: **fechar as 10 lojas** e marcar ensaio da demo  

Sem o item 1, o resto não fecha. Checklist do que só você clica: [VOCE_FAZ.md](./VOCE_FAZ.md)
