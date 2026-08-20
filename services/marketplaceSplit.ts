/**
 * Marketplace split PJ-ready (Mercado Pago Split 1:1).
 *
 * OFF (padrão): cobrança na conta collector da plataforma + ledger interno
 *   (lojista/entregador sacam depois) — piloto atual.
 *
 * ON + seller OAuth da loja: Pix/cartão na conta do lojista com application_fee
 *   = taxa Peça Já (+ frete se HOLD_DRIVER). Lojista recebe direto; entregador
 *   continua via ledger até split 3 vias existir.
 *
 * Conta PJ: use MP_ACCESS_TOKEN da conta PJ + PLATFORM_MP_COLLECTOR_ID.
 * Não precisa mudar o app — só vars + OAuth das lojas.
 */
import type { PaymentSplit } from '@/services/mercadopagoServer';
import { roundMoney } from '@/constants/pricing';

export type SettlementMode = 'collector_ledger' | 'marketplace_split';

export type SplitPartyStatus = 'ready' | 'missing_account' | 'held_on_platform';

export type SettlementParty = {
  role: 'platform' | 'merchant' | 'driver';
  amount: number;
  /** Collector / user id no MP (quando conhecido). */
  mpCollectorId?: string | null;
  status: SplitPartyStatus;
};

export type OrderSettlement = {
  mode: SettlementMode;
  /** Lojista já recebe via MP (não creditar ledger merchant). */
  merchantPaidViaMp: boolean;
  /** Frete ainda via ledger / saque plataforma. */
  driverViaLedger: boolean;
  /** Taxa (+ frete retido) cobrada como application_fee no MP. */
  applicationFee: number;
  /** Token OAuth do seller usado na cobrança (nunca expor ao client). */
  usedSellerToken: boolean;
  parties: SettlementParty[];
  reason: string;
};

export type MarketplaceRecipients = {
  /** Access token OAuth do lojista (seller). */
  merchantSellerAccessToken?: string | null;
  merchantCollectorId?: string | null;
  driverCollectorId?: string | null;
  /** Override opcional; senão PLATFORM_MP_COLLECTOR_ID. */
  platformCollectorId?: string | null;
};

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

/** Feature flag servidor — nunca EXPO_PUBLIC. */
export function isMarketplaceSplitEnabled(): boolean {
  return envFlag('MP_MARKETPLACE_SPLIT');
}

/** Frete na application_fee (plataforma paga motoboy via ledger). Padrão: on. */
export function holdDriverOnPlatform(): boolean {
  const raw = process.env.MP_SPLIT_HOLD_DRIVER_ON_PLATFORM?.trim();
  if (raw === undefined || raw === '') return true;
  return envFlag('MP_SPLIT_HOLD_DRIVER_ON_PLATFORM');
}

/** ID da conta PJ Peça Já no MP (documentação / metadata). */
export function getPlatformMpCollectorId(): string | null {
  const id = process.env.PLATFORM_MP_COLLECTOR_ID?.trim();
  return id || null;
}

/**
 * Monta o plano de liquidação do pedido.
 * Com flag OFF ou sem OAuth da loja → collector_ledger (fluxo atual).
 */
export function buildOrderSettlement(
  split: PaymentSplit,
  recipients: MarketplaceRecipients = {}
): OrderSettlement {
  const platformId =
    recipients.platformCollectorId?.trim() || getPlatformMpCollectorId();

  const partiesBase: SettlementParty[] = [
    {
      role: 'platform',
      amount: roundMoney(split.platformAmount),
      mpCollectorId: platformId,
      status: platformId ? 'ready' : 'held_on_platform',
    },
    {
      role: 'merchant',
      amount: roundMoney(split.merchantAmount),
      mpCollectorId: recipients.merchantCollectorId || null,
      status: recipients.merchantSellerAccessToken?.trim()
        ? 'ready'
        : 'missing_account',
    },
    {
      role: 'driver',
      amount: roundMoney(split.driverAmount),
      mpCollectorId: recipients.driverCollectorId || null,
      status: holdDriverOnPlatform()
        ? 'held_on_platform'
        : recipients.driverCollectorId
          ? 'ready'
          : 'missing_account',
    },
  ];

  if (!isMarketplaceSplitEnabled()) {
    return {
      mode: 'collector_ledger',
      merchantPaidViaMp: false,
      driverViaLedger: true,
      applicationFee: 0,
      usedSellerToken: false,
      parties: partiesBase.map((p) =>
        p.role === 'merchant' || p.role === 'driver'
          ? { ...p, status: 'held_on_platform' as const }
          : p
      ),
      reason: 'MP_MARKETPLACE_SPLIT desligado — cobrança na conta da plataforma + ledger.',
    };
  }

  const sellerToken = recipients.merchantSellerAccessToken?.trim();
  if (!sellerToken || split.merchantAmount <= 0) {
    return {
      mode: 'collector_ledger',
      merchantPaidViaMp: false,
      driverViaLedger: true,
      applicationFee: 0,
      usedSellerToken: false,
      parties: partiesBase,
      reason: !sellerToken
        ? 'Loja sem OAuth MP (mpSellerAccessToken) — fallback collector + ledger.'
        : 'Sem valor de lojista (ex.: assinatura) — collector + ledger.',
    };
  }

  const holdDriver = holdDriverOnPlatform();
  const applicationFee = roundMoney(
    split.platformAmount + (holdDriver ? split.driverAmount : 0)
  );

  // application_fee não pode ser >= transaction_amount
  if (applicationFee >= split.customerTotal - 0.01) {
    return {
      mode: 'collector_ledger',
      merchantPaidViaMp: false,
      driverViaLedger: true,
      applicationFee: 0,
      usedSellerToken: false,
      parties: partiesBase,
      reason: 'application_fee inválida vs total — fallback collector + ledger.',
    };
  }

  return {
    mode: 'marketplace_split',
    merchantPaidViaMp: true,
    driverViaLedger: holdDriver || !recipients.driverCollectorId,
    applicationFee,
    usedSellerToken: true,
    parties: partiesBase.map((p) => {
      if (p.role === 'merchant') return { ...p, status: 'ready' as const };
      if (p.role === 'driver') {
        return {
          ...p,
          status: holdDriver ? ('held_on_platform' as const) : p.status,
        };
      }
      return { ...p, status: 'ready' as const };
    }),
    reason: holdDriver
      ? 'Split 1:1: lojista recebe no MP; taxa+frete via application_fee; motoboy no ledger.'
      : 'Split 1:1: lojista no MP; taxa via application_fee.',
  };
}

/** Campos a mesclar no body POST /v1/payments quando marketplace_split. */
export function mpMarketplacePaymentFields(settlement: OrderSettlement): {
  application_fee?: number;
} {
  if (settlement.mode !== 'marketplace_split' || settlement.applicationFee <= 0) {
    return {};
  }
  return { application_fee: Number(settlement.applicationFee.toFixed(2)) };
}

/** Metadata segura para o client / pedido (sem tokens). */
export function publicSettlementMeta(settlement: OrderSettlement): {
  mode: SettlementMode;
  merchantPaidViaMp: boolean;
  driverViaLedger: boolean;
  applicationFee: number;
  reason: string;
} {
  return {
    mode: settlement.mode,
    merchantPaidViaMp: settlement.merchantPaidViaMp,
    driverViaLedger: settlement.driverViaLedger,
    applicationFee: settlement.applicationFee,
    reason: settlement.reason,
  };
}

export function shouldCreditMerchantLedger(settlement?: {
  merchantPaidViaMp?: boolean;
  mode?: SettlementMode;
} | null): boolean {
  if (!settlement) return true;
  if (settlement.merchantPaidViaMp) return false;
  if (settlement.mode === 'marketplace_split') return false;
  return true;
}

export function shouldCreditDriverLedger(settlement?: {
  driverViaLedger?: boolean;
  mode?: SettlementMode;
} | null): boolean {
  if (!settlement) return true;
  if (settlement.driverViaLedger === false) return false;
  return true;
}

/** Carrega OAuth/collector da loja no Postgres/plataforma. */
export async function loadShopMarketplaceRecipients(
  businessId: string,
  overrides?: MarketplaceRecipients
): Promise<MarketplaceRecipients> {
  const out: MarketplaceRecipients = { ...overrides };
  try {
    const { loadPlatformState } = await import('@/services/platformStore');
    const state = await loadPlatformState();
    const shop = (state.shops || []).find((s) => s.businessId === businessId);
    if (shop) {
      out.merchantSellerAccessToken =
        out.merchantSellerAccessToken || shop.mpSellerAccessToken?.trim() || null;
      out.merchantCollectorId =
        out.merchantCollectorId || shop.mpCollectorId?.trim() || null;
    }
  } catch {
    /* ignore */
  }
  return out;
}
