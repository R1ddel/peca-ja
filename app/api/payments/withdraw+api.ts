/**
 * Saque Pix — lojista (businessId) ou entregador (driverId = userId da plataforma).
 * Normas (mínimo / limite diário) no servidor. Ledger só debita se o MP aceitar o envio;
 * se o Pix-out falhar depois, o ledger é estornado automaticamente.
 */
import { createPixPayout, getPixPayout, isMercadoPagoConfigured } from '@/services/mercadopagoServer';
import { loadPlatformState, mutatePlatformState } from '@/services/platformStore';
import { newId } from '@/services/platformCrypto';
import {
  countWithdrawalsToday,
  findWithdrawByEntryId,
  ledgerBalance,
  reverseFailedWithdraw,
} from '@/services/orderLedgerServer';
import {
  DRIVER_MAX_WITHDRAWS_PER_DAY,
  DRIVER_MIN_WITHDRAW,
  MERCHANT_MAX_WITHDRAWS_PER_DAY,
  MERCHANT_MIN_WITHDRAW,
} from '@/constants/withdrawRules';

type Body = {
  entryId?: string;
  /** Loja — saque merchant */
  businessId?: string;
  /** Entregador — saque driver (ownerId no ledger = userId da sessão) */
  driverId?: string;
  applicationId?: string;
  amount?: number;
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holderName?: string;
  document?: string;
  payoutId?: string;
  token?: string;
};

function bearerToken(request: Request, body: Body): string | null {
  const h = request.headers.get('authorization') || request.headers.get('Authorization');
  if (h?.toLowerCase().startsWith('bearer ')) {
    return h.slice(7).trim() || null;
  }
  return body.token?.trim() || null;
}

function formatBrl(n: number) {
  return n.toFixed(2).replace('.', ',');
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const token = bearerToken(request, body);

    // Poll de status — exige sessão e estorna ledger se o MP falhou
    if (body.payoutId) {
      if (!token) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sessão obrigatória.' },
          { status: 401 }
        );
      }
      const state = await loadPlatformState();
      const session = state.sessions.find((s) => s.token === token);
      if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
        return Response.json(
          { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
          { status: 401 }
        );
      }

      const payoutId = String(body.payoutId);
      const status = await getPixPayout(payoutId);

      const linked = state.ledger.find(
        (e) =>
          e.kind === 'withdraw' &&
          (e.note || '').includes(payoutId) &&
          (e.ownerType === 'merchant'
            ? state.shops.some(
                (s) => s.businessId === e.ownerId && s.ownerUserId === session.userId
              )
            : e.ownerId === session.userId)
      );

      if (status.status === 'failed' && linked) {
        await reverseFailedWithdraw(linked.id);
      }

      return Response.json({
        ok: true,
        ...status,
        entryId: linked?.id ?? null,
        reversed: status.status === 'failed' && !!linked,
      });
    }

    if (!token) {
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão obrigatória para saque.' },
        { status: 401 }
      );
    }

    const state = await loadPlatformState();
    const session = state.sessions.find((s) => s.token === token);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) {
      return Response.json(
        { ok: false, code: 'AUTH', message: 'Sessão inválida ou expirada.' },
        { status: 401 }
      );
    }

    const businessId = String(body.businessId || '').trim();
    const driverIdRaw = String(body.driverId || '').trim();
    const isDriver = !!driverIdRaw && !businessId;

    let ownerType: 'merchant' | 'driver' = 'merchant';
    let ownerId = businessId;
    let label = businessId;
    const minWithdraw = isDriver ? DRIVER_MIN_WITHDRAW : MERCHANT_MIN_WITHDRAW;
    const maxPerDay = isDriver ? DRIVER_MAX_WITHDRAWS_PER_DAY : MERCHANT_MAX_WITHDRAWS_PER_DAY;

    if (isDriver) {
      ownerType = 'driver';
      ownerId = session.userId;
      label = `driver:${ownerId}`;
    } else {
      const ownsShop = state.shops.some(
        (s) => s.businessId === businessId && s.ownerUserId === session.userId
      );
      if (!ownsShop) {
        return Response.json(
          {
            ok: false,
            code: 'AUTH',
            message: 'Sem permissão para sacar desta loja. Sincronize a loja com a conta logada.',
          },
          { status: 403 }
        );
      }
    }

    const pixKey = String(body.pixKey || '').trim();
    const holderName = String(body.holderName || '').trim();
    const document = String(body.document || '').replace(/\D/g, '');
    const pixKeyType = body.pixKeyType || 'random';
    const requested = Number(body.amount ?? 0);

    if (!ownerId || !pixKey || !holderName || requested < 0.01) {
      return Response.json(
        { ok: false, code: 'INVALID', message: 'Dados do saque incompletos.' },
        { status: 400 }
      );
    }
    if (document.length !== 11 && document.length !== 14) {
      return Response.json(
        {
          ok: false,
          code: 'DOCUMENT',
          message: 'Informe CPF ou CNPJ do titular da chave Pix.',
        },
        { status: 400 }
      );
    }

    if (requested + 1e-9 < minWithdraw) {
      return Response.json(
        {
          ok: false,
          code: 'MIN',
          message: `Saque mínimo de R$ ${formatBrl(minWithdraw)}.`,
        },
        { status: 400 }
      );
    }

    const todayCount = countWithdrawalsToday(state, ownerType, ownerId);
    if (todayCount >= maxPerDay) {
      return Response.json(
        {
          ok: false,
          code: 'DAILY_LIMIT',
          message:
            maxPerDay === 1
              ? 'Você já fez o saque de hoje. Tente novamente amanhã.'
              : `Limite de ${maxPerDay} saques por dia atingido.`,
        },
        { status: 400 }
      );
    }

    const balance = ledgerBalance(state, ownerType, ownerId);
    const amount = Math.min(requested, Math.round(balance * 100) / 100);
    if (amount < minWithdraw) {
      return Response.json(
        {
          ok: false,
          code: 'BALANCE',
          message:
            amount < 0.01
              ? 'Saldo insuficiente no ledger.'
              : `Saldo insuficiente para o mínimo de R$ ${formatBrl(minWithdraw)}.`,
        },
        { status: 400 }
      );
    }

    const mode = (process.env.MP_PAYOUT_MODE || 'live').trim().toLowerCase();
    if (mode !== 'simulate' && !isMercadoPagoConfigured()) {
      return Response.json(
        {
          ok: false,
          code: 'NO_TOKEN',
          message: 'Configure MP_ACCESS_TOKEN no .env para saque real via Mercado Pago.',
        },
        { status: 503 }
      );
    }

    const entryId = String(body.entryId || '').trim() || newId('wd');

    const existing = findWithdrawByEntryId(state, entryId);
    if (existing) {
      return Response.json({
        ok: true,
        entryId,
        businessId: businessId || null,
        driverId: isDriver ? ownerId : null,
        applicationId: body.applicationId ?? null,
        amount: existing.amount,
        ownerType,
        payoutId: (existing.note.match(/Saque Pix (\S+)/) || [])[1] || entryId,
        status: 'pending' as const,
        idempotent: true,
      });
    }

    const result = await createPixPayout({
      amount,
      pixKey,
      pixKeyType,
      holderName,
      document,
      externalReference: entryId,
      description: `Peça Já · Saque ${label}`.slice(0, 230),
      idempotencyKey: `wd-${ownerType}-${ownerId}-${entryId}`,
    });

    if (result.status === 'failed') {
      return Response.json(
        {
          ok: false,
          code: 'PAYOUT_FAILED',
          message: 'Mercado Pago recusou o Pix-out. Saldo não foi debitado.',
          ...result,
        },
        { status: 502 }
      );
    }

    // Debita só depois do MP aceitar (pending/processing/paid)
    await mutatePlatformState((s) => {
      if (findWithdrawByEntryId(s, entryId)) {
        return { state: s, result: { ok: true as const } };
      }
      return {
        state: {
          ...s,
          ledger: [
            ...s.ledger,
            {
              id: entryId,
              ownerType,
              ownerId,
              kind: 'withdraw' as const,
              amount,
              note: `Saque Pix ${result.payoutId || entryId}`,
              createdAt: new Date().toISOString(),
            },
          ],
        },
        result: { ok: true as const },
      };
    });

    return Response.json({
      ok: true,
      entryId,
      businessId: businessId || null,
      driverId: isDriver ? ownerId : null,
      applicationId: body.applicationId ?? null,
      amount,
      ownerType,
      ...result,
    });
  } catch (err: any) {
    console.error('[payments/withdraw]', err?.message || err, err?.body);
    const status = typeof err?.status === 'number' ? err.status : 502;
    return Response.json(
      {
        ok: false,
        code: 'GATEWAY',
        message: err?.message || 'Falha ao processar saque no Mercado Pago.',
        details: err?.body ?? null,
      },
      { status: status >= 400 && status < 600 ? status : 502 }
    );
  }
}
