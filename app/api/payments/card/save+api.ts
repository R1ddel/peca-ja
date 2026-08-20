import { isMercadoPagoConfigured, mpFetch } from '@/services/mercadopagoServer';

type Body = {
  number?: string;
  holderName?: string;
  expMonth?: number | string;
  expYear?: number | string;
  cvv?: string;
  kind?: 'credit' | 'debit';
  email?: string;
  identificationNumber?: string;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function detectBrand(number: string): string {
  const d = onlyDigits(number);
  if (/^4/.test(d)) return 'visa';
  // Inclui BIN de teste 5031… (Mastercard)
  if (/^5[1-5]/.test(d) || /^2(2[2-9]|[3-6]\d|7[01])/.test(d) || /^50/.test(d)) {
    return 'mastercard';
  }
  if (/^3[47]/.test(d)) return 'amex';
  if (/^(636368|438935|504175|451416|636297|5067|4576|4011|506699)/.test(d)) return 'elo';
  if (/^(606282|3841)/.test(d)) return 'hipercard';
  return 'unknown';
}

function paymentMethodIdFor(brand: string, kind: 'credit' | 'debit'): string | null {
  if (kind === 'debit') {
    if (brand === 'visa') return 'debvisa';
    if (brand === 'mastercard') return 'debmaster';
    if (brand === 'elo') return 'debelo';
  }
  if (brand === 'visa') return 'visa';
  if (brand === 'mastercard') return 'master';
  if (brand === 'elo') return 'elo';
  if (brand === 'amex') return 'amex';
  if (brand === 'hipercard') return 'hipercard';
  return null;
}

/** Cartões oficiais de teste do Mercado Pago (Brasil). */
function isMpTestCard(number: string): boolean {
  const d = onlyDigits(number);
  return (
    d.startsWith('503143') || // Master
    d.startsWith('548083') || // Master (doc novo)
    d.startsWith('423564') || // Visa
    d.startsWith('375365') || // Amex
    d.startsWith('506776') // Elo débito
  );
}

async function findOrCreateCustomer(email: string, name: string, cpf: string) {
  const search = await mpFetch(
    `/v1/customers/search?email=${encodeURIComponent(email)}`,
    { method: 'GET' }
  );
  const existing = search?.results?.[0];
  if (existing?.id) return existing;

  return mpFetch('/v1/customers', {
    method: 'POST',
    body: JSON.stringify({
      email,
      first_name: name.trim().split(/\s+/)[0] || 'Cliente',
      last_name: name.trim().split(/\s+/).slice(1).join(' ') || 'PeçaJá',
      identification: {
        type: 'CPF',
        number: cpf,
      },
    }),
  });
}

export async function POST(request: Request) {
  try {
    if (!isMercadoPagoConfigured()) {
      return Response.json(
        {
          ok: false,
          code: 'NO_TOKEN',
          message: 'Configure MP_ACCESS_TOKEN no .env para salvar cartão de verdade.',
        },
        { status: 503 }
      );
    }

    const body = (await request.json()) as Body;
    const number = onlyDigits(String(body.number || ''));
    let holderName = String(body.holderName || '').trim();
    const cvv = onlyDigits(String(body.cvv || ''));
    const kind = body.kind === 'debit' ? 'debit' : 'credit';
    const email = String(body.email || '').trim().toLowerCase();
    let cpf = onlyDigits(String(body.identificationNumber || ''));

    let expMonth = Number(onlyDigits(String(body.expMonth || '')));
    let expYear = Number(onlyDigits(String(body.expYear || '')));
    if (expYear > 0 && expYear < 100) expYear += 2000;

    const testCard = isMpTestCard(number);
    // Cartões de teste: nome APRO + CPF oficial do MP
    if (testCard) {
      holderName = 'APRO';
      cpf = '12345678909';
    }

    if (!email.includes('@')) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'E-mail do cliente inválido.' },
        { status: 400 }
      );
    }
    if (cpf.length !== 11) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Informe um CPF válido (11 dígitos).' },
        { status: 400 }
      );
    }
    if (!holderName || holderName.length < 3) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Informe o nome impresso no cartão.' },
        { status: 400 }
      );
    }
    if (number.length < 13 || number.length > 19) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Número do cartão inválido.' },
        { status: 400 }
      );
    }
    if (!expMonth || expMonth < 1 || expMonth > 12 || !expYear) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Validade do cartão inválida.' },
        { status: 400 }
      );
    }
    if (cvv.length < 3 || cvv.length > 4) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'CVV inválido.' },
        { status: 400 }
      );
    }

    const brand = detectBrand(number);
    const paymentMethodId = paymentMethodIdFor(brand, kind);
    if (!paymentMethodId) {
      return Response.json(
        {
          ok: false,
          code: 'INVALID',
          message: `Bandeira não suportada (${brand}). Use Visa ou Mastercard.`,
        },
        { status: 400 }
      );
    }

    /**
     * Cartões de TESTE do MP:
     * Com credencial de produção (APP_USR-…) o MP costuma responder
     * "payment method response is empty" (code 128) ao tokenizar/salvar.
     * Cadastro fica local; a cobrança gera token fresco pelo last4 (já implementado).
     */
    if (testCard) {
      const last4 = number.slice(-4);
      return Response.json({
        ok: true,
        card: {
          mpCustomerId: `test_cust_${last4}`,
          mpCardId: `test_card_${last4}`,
          paymentMethodId,
          brand,
          last4,
          holderName: 'APRO',
          expMonth,
          expYear,
          kind,
          localTest: true,
        },
      });
    }

    // Cartão real: tokeniza e salva no customer do Mercado Pago
    const token = await mpFetch('/v1/card_tokens', {
      method: 'POST',
      body: JSON.stringify({
        card_number: number,
        expiration_month: expMonth,
        expiration_year: expYear,
        security_code: cvv,
        cardholder: {
          name: holderName,
          identification: {
            type: 'CPF',
            number: cpf,
          },
        },
      }),
    });

    const tokenId = String(token?.id || '');
    if (!tokenId) {
      return Response.json(
        { ok: false, code: 'GATEWAY', message: 'Mercado Pago não retornou token do cartão.' },
        { status: 502 }
      );
    }

    let resolvedPm = paymentMethodId;
    if (token?.payment_method_id) resolvedPm = String(token.payment_method_id);

    const issuerId =
      token?.issuer_id != null
        ? String(token.issuer_id)
        : token?.card_issuer?.id != null
          ? String(token.card_issuer.id)
          : null;

    const customer = await findOrCreateCustomer(email, holderName, cpf);
    const customerId = String(customer?.id || '');
    if (!customerId) {
      return Response.json(
        { ok: false, code: 'GATEWAY', message: 'Não foi possível criar o cliente no Mercado Pago.' },
        { status: 502 }
      );
    }

    const savePayload: Record<string, unknown> = { token: tokenId };
    if (resolvedPm) savePayload.payment_method_id = resolvedPm;
    if (issuerId) savePayload.issuer_id = Number(issuerId) || issuerId;

    let saved: any;
    try {
      saved = await mpFetch(`/v1/customers/${encodeURIComponent(customerId)}/cards`, {
        method: 'POST',
        body: JSON.stringify(savePayload),
      });
    } catch {
      saved = await mpFetch(`/v1/customers/${encodeURIComponent(customerId)}/cards`, {
        method: 'POST',
        body: JSON.stringify({ token: tokenId }),
      });
    }

    const mpCardId = String(saved?.id || '');
    if (!mpCardId) {
      return Response.json(
        { ok: false, code: 'GATEWAY', message: 'Não foi possível salvar o cartão no Mercado Pago.' },
        { status: 502 }
      );
    }

    return Response.json({
      ok: true,
      card: {
        mpCustomerId: customerId,
        mpCardId,
        paymentMethodId: String(saved?.payment_method?.id || resolvedPm),
        brand,
        last4: number.slice(-4),
        holderName: holderName.toUpperCase(),
        expMonth,
        expYear,
        kind,
      },
    });
  } catch (err: any) {
    console.error('[payments/card/save]', err?.message || err, err?.body);
    const detail =
      err?.body?.cause?.[0]?.description ||
      err?.body?.message ||
      err?.message ||
      'Falha ao salvar cartão no Mercado Pago.';

    const friendly =
      String(detail).toLowerCase().includes('payment method response is empty')
        ? 'O Mercado Pago não reconheceu este cartão na sua conta (comum com cartão de teste + credencial de produção). Use os cartões de teste oficiais Visa/Master ou ative cartões no painel do MP.'
        : String(detail);

    return Response.json(
      { ok: false, code: 'GATEWAY', message: friendly },
      { status: 502 }
    );
  }
}
