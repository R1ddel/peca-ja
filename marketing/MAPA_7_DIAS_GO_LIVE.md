# Peça Já — mapa 0 → lançamento (7 dias)

**Hoje:** sábado 07/11/2026  
**Cidade piloto:** Mucugê (BA)  
**Modo atual:** **remoto** — fundador **fora da cidade**, **sem carteira de lojas** ainda  
**Dia D de tráfego pago:** só depois de ter loja + entrega de verdade. Com zero comerciante, o sábado 14 **não** é “ligar anúncio”; é **fechar as primeiras lojas à distância**.

**Regra de ouro:** anúncio de cliente sem loja aberta = queima dinheiro e queima a marca. Primeiro oferta (loja), depois demanda (ads).

---

## 0) Realidade: você não está em Mucugê

Isso **não impede** o lançamento. Muda a ordem:

| Antes (presencial) | Agora (remoto) |
|--------------------|----------------|
| Porta a porta | WhatsApp + vídeo-chamada + braço local |
| Você cadastra cardápio na loja | Loja se cadastra no app · você guia por tela compartilhada |
| Você vê a moto na rua | Motoboy remoto + alguém local confirma plantão |
| Dia D = ads + panfleto | Dia D só com **≥ 3 lojas ativas** e **≥ 1 moto** (ou entrega da própria loja) |

### O que você precisa conseguir em 7 dias (meta remota)

1. **Braço local** (1 pessoa em Mucugê): amigo, parente, contato da prefeitura, blogueira, motoboy-líder. Função: visitar 5–10 lojas **com o celular aberto no Peça Já**, tirar foto, fechar “sim”.  
2. **Lista de 30 contatos** de comércio (Google Maps + Instagram + indicação).  
3. **3 lojas fechadas** (cadastro + cardápio mínimo + horário).  
4. **1 caminho de entrega:** moto Peça Já **ou** a loja entrega com o próprio motoboy no começo.  
5. App/Pix ok (Frente A).

Sem o item 1, a conversão WhatsApp cai muito. Sem 3 lojas, **não gaste 1 real** em ads de cliente.

### Como achar loja sem pisar na cidade (funil)

```
Lista 30 nomes (Maps/IG)
  → Abertura WhatsApp (só pedir 5 min de conversa)
    → Áudio ou vídeo 2 min (o que é o Peça Já)
      → Cadastro guiado no app (você na chamada)
        → Cardápio mínimo (5–10 itens + 1 foto)
          → Entra na lista do lançamento + story
```

Scripts prontos: [`docs/ABORDAGEM_WHATSAPP_COMERCIANTE.md`](../docs/ABORDAGEM_WHATSAPP_COMERCIANTE.md)  
Pitch completo: [`docs/ABORDAGEM_VENDA_COMERCIANTE.md`](../docs/ABORDAGEM_VENDA_COMERCIANTE.md)  
Dados pra divulgação: [`docs/DADOS_APOIADOR_DIVULGACAO.md`](../docs/DADOS_APOIADOR_DIVULGACAO.md)

### Oferta que fecha à distância (use esta)

> 1º mês do plano **Já na Rua incluso (R$ 0)** no lançamento.  
> Do 2º mês: R$ 200.  
> Cliente paga no Pix; **o preço do cardápio fica com a loja** (não é comissão de 20–30% do prato).  
> Você cadastra pelo celular; a gente te guia na videochamada.

### Entrega no piloto remoto (escolha 1)

| Modo | Quando usar |
|------|-------------|
| **A · Moto Peça Já** | Achou 1–2 entregadores por WhatsApp/indicação do braço local |
| **B · Loja entrega** | Loja já tem moto própria; no app marca entrega da loja / combina frete |
| **C · Só retirada** | Último recurso: cliente busca — **não** ligue ads de “delivery” |

No Dia D de ads, prefira A ou B. C não escala.

### Meta Ads neste modo

- **Campanha de CLIENTES:** pausada até ter ≥ 3 lojas + entrega.  
- **Campanha de LOJISTAS (WhatsApp):** pode ligar **antes**, orçamento baixo (ex. R$ 20–40/dia), público Mucugê, objetivo mensagem — isso **substitui a rua**.  
- Panfleto físico: só se o braço local imprimir/distribuir; senão ignore na 1ª semana.

---

## 1) O que “lançado” significa (definição de pronto)

Para ligar tráfego de **cliente**, tudo isto verde:

| # | Critério | Como provar |
|---|----------|-------------|
| 1 | Cliente abre o app e pede | APK/web + 1 pedido teste |
| 2 | Pix LIVE cai | Pedido R$ 1–5 |
| 3 | ≥ 3 lojas com cardápio e horário | Lista no HQ |
| 4 | Entrega resolvida (moto ou loja) | 1 pedido entregue de verdade |
| 5 | Suporte WhatsApp | Você ou backup no plantão |
| 6 | Braço local avisado no Dia D | Confirmação no zap |

Se na sexta ainda tiver **0–1 loja** → o “sábado 14” é **dia de fechar loja**, não de anúncio. Empurre o Dia D de demanda.

---

## 2) Três frentes em paralelo (você + este chat)

| Frente | O que é | Quem puxa |
|--------|---------|-----------|
| **A · Produto** | Pix, APK, site, smoke | Você aprova · agente executa quando mandar |
| **B · Oferta remota** | Lista, WhatsApp, braço local, cadastro guiado | **Você** (zap/vídeo) + braço local na rua |
| **C · Demanda** | Ads lojista agora; ads cliente **só com oferta** | Você no Ads Manager |

Orçamento: ads de **lojista** pode começar cedo e barato. Ads de **cliente** só com lojas no ar.

---

## 3) Inventário do que já existe (não recomeçar do zero)

- App Expo SDK 57 + site `https://peca-ja.expo.app`
- API Railway online (`api-production-8092.up.railway.app`) com Postgres + Mercado Pago configurado
- HQ em `/admin` (Cadastros, planos, projeção)
- Fluxo pedido → Pix → cozinha → fila moto → entrega por código
- Material antigo em `marketing/CONTAGEM_LANCAMENTO.md` (datas de out/nov — use **este** arquivo como mapa atual)

**Pendências técnicas típicas do piloto (tratar em D−6 a D−3):**

1. Conta **Mercado Pago PJ** com Pix LIVE e (se possível) Pix-out / payouts
2. Build **Android instalável** (EAS preview/production) — Mucugê não vive só de Expo Go
3. Publicar no site o fix do botão Pix (abrir QR na hora) se ainda não estiver no ar
4. Smoke ponta a ponta com dinheiro real (valor baixo)
5. Lista escrita: lojas ✅ vs ⏳ e motos confirmadas

---

## 4) Calendário dia a dia — modo remoto (07 → 14/11)

### Sábado 07/11 — D−7 · Montar a máquina remota

- [ ] Escolher **1 braço local** e mandar mensagem hoje (ver §0)  
- [ ] Abrir planilha/lista: 30 comércios Mucugê (Google Maps → nome + IG/telefone)  
- [ ] Definir teto da semana: quanto em **ads lojista** (ex. R$ 150) vs reserva cliente  
- [ ] Status MP PJ (Pix LIVE?)

**Critério:** braço local contatado + ≥ 15 nomes na lista.

---

### Domingo 08/11 — D−6 · Disparo WhatsApp (volume)

- [ ] Enviar **abertura** (só pedir conversa) para 20–30 lojas — script em `ABORDAGEM_WHATSAPP`  
- [ ] Não mande textão de venda na 1ª mensagem  
- [ ] Anotar quem respondeu: pode falar / depois / não  
- [ ] Braço local: pedir 5 fotos de fachada das lojas do centro (mesmo sem fechar)

**Critério:** ≥ 5 “pode falar” ou áudio marcado.

---

### Segunda 09/11 — D−5 · Fechar + produto

- [ ] 5–8 videochamadas / áudios de pitch (15 min)  
- [ ] Meta do dia: **1ª loja cadastrada** no app (você guia a tela)  
- [ ] Smoke Pix + APK se ainda faltar  
- [ ] Conta Meta: montar campanha **Lojistas | Mucugê | WhatsApp** (pode ligar R$ 20–30/dia)

**Critério:** ≥ 1 loja no app **ou** 3 quentes pra fechar amanhã.

---

### Terça 10/11 — D−4 · Segunda e terceira loja

- [ ] Fechar lojas 2 e 3 (cardápio mínimo 5 itens)  
- [ ] Combinar entrega: moto própria da loja **ou** motoboy indicado pelo braço local  
- [ ] Pedido teste na loja 1 (você ou braço local como cliente)  
- [ ] Ads lojista: olhar CTR/msg; trocar criativo se zero resposta

**Critério:** ≥ 2 lojas com cardápio.

---

### Quarta 11/11 — D−3 · Operação mínima

- [ ] 3ª loja ou reforço nas 2  
- [ ] 1 motoboy com termo + HQ Aceitar **ou** 2 lojas no modo entrega própria  
- [ ] 2 pedidos teste remotos (braço local pede; você monitora HQ)  
- [ ] Campanha **Clientes** montada e **PAUSADA**

**Critério:** 1 pedido teste entregue de verdade.

---

### Quinta 12/11 — D−2 · Trava

- [ ] Health + Pix + links certos  
- [ ] Lista oficial das lojas do soft launch (nome no story)  
- [ ] Go/no-go: tem ≥ 3 lojas + entrega?  

**Critério:** escrito verde/amarelo/vermelho.

---

### Sexta 13/11 — D−1 · Decisão

- [ ] Se **verde** (≥ 3 lojas + entrega + Pix): sábado = soft launch de cliente (ads leve)  
- [ ] Se **amarelo** (1–2 lojas): sábado = só fechar mais loja; ads só lojista  
- [ ] Se **vermelho** (0 loja): sábado = dia de WhatsApp + braço local; **zero** ads cliente; Dia D de demanda = quando fechar 3

---

### Sábado 14/11 — O que o dia vira (remoto)

| Situação | O que fazer |
|----------|-------------|
| ≥ 3 lojas + entrega | Soft launch: ads cliente **baixo** (ex. R$ 50–80) + stories das lojas |
| 1–2 lojas | Operar só com círculo próximo; ads **só lojista**; não prometa cidade inteira |
| 0 lojas | Não lance. Meta do dia: fechar a 1ª loja ao vivo com o braço local |

**Meta realista remoto na 1ª semana:** 3 lojas + 5–15 pedidos de ensaio — não 50 downloads vazios.

---

## 5) Material de estudo rápido e profundo — tráfego pago

Leia isto **uma vez** (40–60 min). É o mínimo para não queimar verba.

### 5.1 O que você está comprando

Na Meta (Instagram/Facebook), você não “compra like”. Você compra **atenção de pessoas na região** para:

1. **Instalar / abrir** o app (ou site), **ou**
2. **Mandar mensagem** no WhatsApp, **ou**
3. **Ver o perfil** e lembrar do nome no almoço

No lançamento de cidade pequena, o objetivo certo na 1ª semana é:

**Tráfego / engajamento com conversa** → gente da cidade **sabe que existe** e **pede 1 vez**.  
Otimizar “compra” no pixel cedo demais = caro e instável com poucos eventos.

### 5.2 Funil em 1 frase

```
Ver anúncio → baixar/abrir → escolher loja → pagar Pix → receber
```

Cada etapa tem custo. Se a oferta (loja fechada / sem moto) quebra, o anúncio vira prejuízo mesmo com CTR alto.

### 5.3 Métricas que importam (decore)

| Sigla | Nome | O que é | Bom sinal no piloto |
|-------|------|---------|---------------------|
| **CPM** | Custo por mil impressões | Quão caro está a atenção | Varia; não obsessione |
| **CTR** | Cliques / impressões | Anúncio desperta interesse | ≥ 1% já é ok em feed |
| **CPC** | Custo por clique | Preço do clique | Compare entre criativos |
| **CPI** | Custo por instalação | Se usar app install | Só se tiver eventos |
| **CPL** | Custo por lead/msg | WhatsApp | Útil se CTA for msg |
| **CAC** | Custo por cliente que pediu | Gasto ÷ novos pedidores | Meta da semana |
| **ROAS** | Receita ÷ gasto ads | Ainda cedo no Dia D | Ignore nos 3 primeiros dias |

**Regra prática:** nos 3 primeiros dias, olhe **CTR + CPC + se o pedido acontece**. Não escale por “aprendizado” da Meta se a operação não entrega.

### 5.4 Público em cidade pequena (o jeito certo)

- Localização: **Mucugê** + cidades vizinhas só se tiver entrega  
- Idade: 18–45 (ajuste depois)  
- Interesses: **leve** (comida, delivery) — em cidade pequena, **localização manda mais que interesse**  
- Excluir: funcionários da operação (lista) se possível  
- **Nunca** “Brasil inteiro” no piloto

### 5.5 Criativo que funciona em Mucugê

Ordem de força:

1. Foto/vídeo da **loja real** + prato real  
2. Você ou apoiador falando “já dá pra pedir no Peça Já”  
3. Antes/depois: WhatsApp bagunçado → app com status  
4. Stock genérico de pizza americana → **pior**

Textos curtos, tom da cidade, sem enrolação. CTA único.

### 5.6 Estrutura mental de campanha (Meta)

```
Campanha (objetivo)
  └─ Conjunto de anúncios (público + orçamento + horário)
       └─ Anúncios (criativos A/B)
```

1 campanha = 1 objetivo.  
Não misture “lojista” e “cliente” na mesma campanha.

### 5.7 Orçamento (como não quebrar)

Exemplo com **R$ 500 na semana do lançamento** (ajuste ao seu teto):

| Dia | Gasto | Por quê |
|-----|-------|---------|
| Seg–Qui | R$ 0 | Conta + criativo + smoke |
| Sex | R$ 0–30 | Só se quiser teste de 2 criativos, 2h, sem volume |
| Sáb Dia D | R$ 80–150 | Almoço + jantar |
| Dom | R$ 40–80 | Se sábado aguentou |
| Reserva | resto | Segunda/terça se a operação segurar |

**Kill switch:** se em 2h do almoço houver pedido sem moto ou loja fantasma → pause.

### 5.8 O que NÃO fazer

- Ligar anúncio com loja fechada  
- Prometer “entrega em 20 min” se não medir  
- Mudar público/criativo/orçamento a cada 20 min  
- Usar cartão e “deixar a Meta aprender” com R$ 5/dia em objetivo Conversão sem pixel maduro  
- Copiar criativo do iFood (marca + política)

### 5.9 Google Ads no piloto?

**Deixe para a 2ª semana**, salvo search brand (“peça já mucugê”). Volume de search local é baixo; Meta + panfleto + WhatsApp vencem na abertura.

---

## 6) Textos prontos (copie e adapte)

**Anúncio clientes — feed**

> Peça Já chegou em Mucugê.  
> Peça no celular, pague no Pix e acompanhe a entrega.  
> Lojas da cidade no app — sem enrolação.  
> Baixe e faça seu primeiro pedido.

**Anúncio clientes — story**

> Fome?  
> Abre o Peça Já.  
> Escolhe a loja. Pix. Pronto.

**Anúncio lojistas (campanha separada, orçamento menor)**

> Sua loja no Peça Já.  
> Você recebe o preço que cadastrou.  
> Teste de 7 dias no lançamento.  
> Chama no WhatsApp: [SEU NÚMERO]

**CTA único (todos os canais):**  
`Baixe o Peça Já · peça agora em Mucugê`

---

## 7) Campanhas Meta — ordem no modo remoto

### Campanha 2 primeiro — `PJ | Lojistas | Mucugê | WhatsApp` ← LIGAR CEDO

- Objetivo: **Mensagens** (WhatsApp)  
- Orçamento: R$ 20–40/dia enquanto não tem 3 lojas  
- Público: Mucugê + raio; interesses comida/negócio locais se a Meta permitir  
- Criativo: “Sua loja no Peça Já · 1º mês incluso · preço do cardápio fica com você”  
- CTA: falar no WhatsApp com você  
- Esta campanha **é a sua rua remota**

### Campanha 1 depois — `PJ | Clientes | Mucugê | Lançamento` ← SÓ COM LOJAS

- Objetivo: Tráfego ou Mensagens  
- Orçamento: só no soft launch (ex. R$ 50–100/dia)  
- Pausada até go/no-go verde  
- Criativo com **nome das lojas reais** que fecharam

### Campanha 3 — NÃO criar ainda

Retargeting / Brasil inteiro — depois de volume real.

---

## 8) Checklist go / no-go (sexta 20h)

| Item | Verde | Vermelho |
|------|-------|----------|
| Pix LIVE | Pedido teste ok hoje | Falha / conta pendente |
| Lojas sábado | ≥ 5 abrem almoço | < 3 |
| Motos | 2 confirmadas | 0–1 |
| App instalável | APK/site ok em 2 chips | Só Expo Go / link quebrado |
| Suporte | Número + plantão | Ninguém responde |
| Criativos | Fotos reais + CTA | Genérico / link errado |

**≥ 1 vermelho crítico (Pix, moto, app)** → não liga Campanha 1 no sábado.

---

## 9) Plantão — imprimir

```
DATA: sábado 14/11/2026
SUPORTE WHATSAPP: _________________
LOJA ÂNCORA: _________________
LOJAS DO DIA: _________________ / _________________ / _________________
MOTOS: 1) _____________  2) _____________
ORÇAMENTO ADS DO DIA: R$ ______
HORÁRIO: 11h–22h

SE PIX FALHAR → pausar anúncio + avisar no status
SE LOJA NÃO ACEITAR → ligar loja; oferecer outra
SE SEM MOTO → pausar anúncio 30–60 min; avisar cliente
```

---

## 10) Ordem de execução nesta conversa (quando você mandar)

1. **Fechar produto:** Pix no ar, APK, smoke, publish site se faltar  
2. **Você na rua:** lojas + motos (eu não substituo)  
3. **Criativos + textos** finais (eu redijo; você aprova)  
4. **Estrutura Ads** (eu monto o passo a passo de cliques no Manager; **você** publica e define teto)  
5. **Dia D:** monitorar junto (checklist)

---

## Preciso de decisão sua (responde em 1 bloco)

1. Tem **alguém em Mucugê** que possa ser braço local esta semana? (nome/relação)  
2. Teto pra **ads de lojista** nos próximos 7 dias (R$)?  
3. Distribuição do app: **APK** / **site** / **os dois**?  
4. Mercado Pago PJ: Pix LIVE **já** / **em análise** / **só teste**?

Com isso, o próximo passo é: montar a lista das 30 lojas + disparo WhatsApp (eu redijo as mensagens personalizadas se você colar os nomes).
