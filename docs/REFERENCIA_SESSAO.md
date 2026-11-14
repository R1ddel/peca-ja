# Peça Já — Referência da sessão (20/08/2026)

## Git e commit

| Campo | Valor |
|-------|-------|
| **Repositório** | `C:\Users\iagot\Projects\peca-ja` |
| **Git instalado** | Git for Windows 2.55.0.3 (`C:\Program Files\Git\cmd\git.exe`) |
| **Branch** | `master` |
| **Commit** | `48396d4` |
| **Autor** | Iago Teles `<iagoteles37@gmail.com>` |
| **Mensagem** | Initial commit: Peça Já with embedded platform fee pricing. |
| **Arquivos** | 516 arquivos, +95.620 linhas |
| **Status** | Working tree limpa após o commit |

### Fora do commit (proposital)

- `.env` (secrets — no `.gitignore`)
- `.curl-body.txt`, `.curl-headers.txt`, `.restore/`, `.tmp-extract/`, etc.

---

## Taxa Peça Já embutida (+R$ 2,00 por item)

### Cliente

- Preço no cardápio/carrinho/checkout = **preço cadastrado + R$ 2,00**
- Exemplo: comerciante cadastra **R$ 10,00** → cliente vê **R$ 12,00**
- **Sem** linha “Taxa Peça Já” no checkout
- **Sem** texto abaixo de “Total a pagar”
- Loja continua recebendo o valor cadastrado (taxa não sai do bolso dela)

### Comerciante — avisos permanentes

| Tela | O que aparece |
|------|----------------|
| `/partner/merchant-apply` | Aviso fixo no formulário + alerta após 1º cadastro |
| `/partner/plans` | Aviso junto ao **Termo de compromisso** |
| `/merchant/menu` | Rodapé com taxa + referência ao termo |
| `/merchant/menu/form` | Aviso ao cadastrar preço do item |

### Arquivos principais

- `constants/pricing.ts` — regras e textos
- `utils/cartLine.ts` — `getCustomerUnitPrice`, `getCustomerLineTotal`
- `app/cart.tsx`, `app/checkout.tsx` — totais sem linha de taxa
- `components/FloatingCartButton.tsx` — total com taxa embutida
- `app/merchant/menu/index.tsx`, `app/partner/merchant-apply.tsx`, `app/partner/plans.tsx`

---

## Testes no browser (localhost:8081)

### Cliente

- Item **PF Executivo** (Pizza da Garagem): cadastro **R$ 28,90** → cliente **R$ 30,90**
- Carrinho: subtotal **R$ 30,90** + frete **R$ 5,00** = total **R$ 35,90**
- Botão “Ver carrinho” na home: **R$ 30,90** (após correção do FloatingCartButton)
- Checkout exige login (conta de teste abaixo)

### Comerciante

- Cadastro: aviso com exemplo R$ 10 → R$ 12 ✓
- Planos: taxa junto ao termo ✓
- Cardápio: rodapé com taxa + termo ✓
- Formulário de item: aviso no preço ✓

---

## Conta de teste (browser)

| Campo | Valor |
|-------|-------|
| **Nome** | Cliente Teste |
| **E-mail** | `cliente.teste.pecaja.20260819@gmail.com` |
| **Senha** | `Teste123!` |

---

## Comandos úteis

```powershell
# Subir app web
npx expo start --web --port 8081

# Git (se PATH não tiver git ainda)
$env:Path = "C:\Program Files\Git\cmd;" + $env:Path
git log -1
git status
```

---

## Próximos passos (opcional)

1. Criar repositório remoto (GitHub) e `git push -u origin master`
2. Validar checkout logado (Pix/cartão) no browser ou Expo Go
3. Testar fluxo comerciante completo (cadastro → plano → termo → cardápio)
