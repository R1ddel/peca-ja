/**
 * Cliente da plataforma Peça Já (auth, pedidos, lojas, ledger, suporte).
 * Se a API estiver offline, retorna null / ok:false — o app usa fallback local.
 */
import { getApiBaseUrl, getFleetBaseUrl } from '@/services/apiBase';
import type { Order, User } from '@/types';
import type { MerchantShop } from '@/utils/merchantShop';
import type {
  AuthPublicUser,
  LedgerEntry,
  PlatformResult,
  SupportTicket,
} from '@/services/platformTypes';
import type { PlatformRole } from '@/services/platformRoles';

const TIMEOUT_MS = 15000;

let clientHqMode: 'real' | 'projection' = 'projection';

/** O shell do HQ define o modo; toda ação admin_* segue REAL ou PROJEÇÃO. */
export function setClientHqMode(mode: 'real' | 'projection') {
  clientHqMode = mode === 'projection' ? 'projection' : 'real';
}

async function post(body: Record<string, unknown>): Promise<PlatformResult | null> {
  const actionName = String(body.action || '');
  if (actionName.startsWith('admin_') && body.hqMode == null) {
    body = { ...body, hqMode: clientHqMode };
  }
  const bases = [getFleetBaseUrl(), getApiBaseUrl()].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  for (const base of bases) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const res = await fetch(`${base}/api/platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = (await res.json()) as PlatformResult;
      if (json && typeof json === 'object' && 'ok' in json) return json;
    } catch {
      // tenta próxima base
    }
  }
  return null;
}

export type PlatformHealthStatus = {
  /** API + Postgres respondendo — HQ pode logar. */
  online: boolean;
  /** Processo HTTP no ar (mesmo com DB caído). */
  processUp: boolean;
  persistence?: string;
  code?: string;
  message?: string;
};

export async function platformHealth(): Promise<PlatformHealthStatus> {
  const bases = [getFleetBaseUrl(), getApiBaseUrl()].filter(
    (v, i, a) => a.indexOf(v) === i
  );

  let processUp = false;
  let lastDb: { code?: string; message?: string; persistence?: string } | null = null;

  async function probeBase(base: string): Promise<PlatformHealthStatus | null> {
    const root = base.replace(/\/$/, '');
    // 1) Processo vivo?
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(`${root}/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) {
        processUp = true;
      }
    } catch {
      /* tenta platform */
    }

    // 2) Plataforma + Postgres (obrigatório pro HQ)
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${root}/api/platform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health' }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = await res.json().catch(() => null);
      if (json?.ok) {
        return {
          online: true,
          processUp: true,
          persistence: String(json.persistence || ''),
        };
      }
      if (json && typeof json === 'object') {
        processUp = true;
        lastDb = {
          code: String(json.code || 'DB'),
          message: String(json.message || 'Postgres indisponível.'),
          persistence: String(json.persistence || ''),
        };
      }
    } catch {
      /* offline neste base */
    }
    return null;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const base of bases) {
      const hit = await probeBase(base);
      if (hit?.online) return hit;
    }
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }

  if (lastDb || processUp) {
    const msg = lastDb?.message || 'API no ar, mas o banco (Postgres) não responde.';
    return {
      online: false,
      processUp: true,
      persistence: lastDb?.persistence,
      code: lastDb?.code || 'DB',
      message: msg.startsWith('Postgres') ? msg : `Postgres indisponível: ${msg}`,
    };
  }

  return {
    online: false,
    processUp: false,
    code: 'OFFLINE',
    message: `API offline (${getApiBaseUrl()}).`,
  };
}

export async function platformRegister(data: {
  name: string;
  email: string;
  phone: string;
  password: string;
  address: string;
}): Promise<PlatformResult | null> {
  return post({ action: 'register', ...data });
}

export async function platformLogin(
  email: string,
  password: string
): Promise<PlatformResult | null> {
  return post({ action: 'login', email, password });
}

export async function platformMe(token: string): Promise<PlatformResult | null> {
  return post({ action: 'me', token });
}

export async function platformLogout(token: string): Promise<void> {
  await post({ action: 'logout', token });
}

export async function platformRequestPasswordReset(
  email: string
): Promise<PlatformResult | null> {
  return post({ action: 'request_password_reset', email });
}

export async function platformResetPassword(
  email: string,
  newPassword: string,
  resetToken: string
): Promise<PlatformResult | null> {
  return post({ action: 'reset_password', email, newPassword, resetToken });
}

export async function platformUpdateProfile(
  token: string,
  patch: Partial<User>
): Promise<PlatformResult | null> {
  return post({ action: 'update_profile', token, patch });
}

export async function platformUpsertOrder(
  order: Order,
  token?: string | null
): Promise<PlatformResult | null> {
  if (!token) return null;
  return post({ action: 'upsert_order', order, token });
}

export async function platformSyncOrders(
  orders: Order[],
  token?: string | null
): Promise<PlatformResult | null> {
  if (!token) return null;
  return post({ action: 'sync_orders', orders, token });
}

export async function platformListOrders(opts?: {
  token?: string | null;
  userId?: string;
  businessId?: string;
}): Promise<PlatformResult | null> {
  if (!opts?.token) return null;
  return post({
    action: 'list_orders',
    token: opts.token,
    userId: opts?.userId,
    businessId: opts?.businessId,
  });
}

export async function platformListShops(): Promise<PlatformResult | null> {
  return post({ action: 'list_shops' });
}

export async function platformUpsertShop(
  shop: MerchantShop,
  token?: string | null
): Promise<PlatformResult | null> {
  const { getPlatformToken } = await import('@/services/platformSession');
  const tok = token || (await getPlatformToken());
  if (!tok) {
    return { ok: false, code: 'AUTH', message: 'Sessão obrigatória para sincronizar loja.' };
  }
  return post({ action: 'upsert_shop', shop, token: tok });
}

export async function platformLedgerList(
  ownerType: LedgerEntry['ownerType'],
  ownerId: string,
  token?: string | null
): Promise<PlatformResult | null> {
  if (!token) return null;
  return post({ action: 'ledger_list', ownerType, ownerId, token });
}

export async function platformLedgerPost(
  entry: Omit<LedgerEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  token?: string | null
): Promise<PlatformResult | null> {
  if (!token) return null;
  return post({ action: 'ledger_post', entry, token });
}

export async function platformCreateTicket(input: {
  token: string;
  subject: string;
  body: string;
  orderId?: string;
}): Promise<PlatformResult | null> {
  return post({ action: 'ticket_create', ...input });
}

export async function platformListTickets(opts: {
  pin?: string;
  token?: string;
}): Promise<PlatformResult | null> {
  return post({ action: 'ticket_list', ...opts });
}

export async function platformUpdateTicket(input: {
  pin: string;
  id: string;
  status?: SupportTicket['status'];
  reply?: string;
}): Promise<PlatformResult | null> {
  return post({ action: 'ticket_update', ...input });
}

export async function platformUpsertChatMessage(
  threadKey: string,
  message: Record<string, unknown>,
  token?: string | null
): Promise<PlatformResult | null> {
  if (!token) return null;
  return post({ action: 'upsert_chat_message', threadKey, message, token });
}

export async function platformSyncChats(
  chats: Record<string, unknown[]>,
  token?: string | null
): Promise<PlatformResult | null> {
  if (!token) return null;
  return post({ action: 'sync_chats', chats, token });
}

export async function platformListChats(opts?: {
  orderIds?: string[];
  token?: string | null;
}): Promise<PlatformResult | null> {
  if (!opts?.token) return null;
  return post({ action: 'list_chats', orderIds: opts?.orderIds, token: opts.token });
}

export function asPlatformChats(
  res: PlatformResult | null
): Record<string, Record<string, unknown>[]> {
  if (!res?.ok || !res.chats || typeof res.chats !== 'object') return {};
  const out: Record<string, Record<string, unknown>[]> = {};
  for (const [key, list] of Object.entries(res.chats as Record<string, unknown>)) {
    if (Array.isArray(list)) out[key] = list as Record<string, unknown>[];
  }
  return out;
}

/** Helpers de cast seguros a partir do resultado genérico. */
export function asPlatformUser(res: PlatformResult): AuthPublicUser | null {
  if (!res.ok || typeof res.user !== 'object' || !res.user) return null;
  return res.user as AuthPublicUser;
}

export function asPlatformToken(res: PlatformResult): string | null {
  if (!res.ok || typeof res.token !== 'string') return null;
  return res.token;
}

export function asPlatformOrders(res: PlatformResult): Order[] {
  if (!res.ok || !Array.isArray(res.orders)) return [];
  return res.orders as Order[];
}

export function asPlatformShops(res: PlatformResult): MerchantShop[] {
  if (!res.ok || !Array.isArray(res.shops)) return [];
  return res.shops as MerchantShop[];
}

export function asPlatformTickets(res: PlatformResult): SupportTicket[] {
  if (!res.ok || !Array.isArray(res.tickets)) return [];
  return res.tickets as SupportTicket[];
}

// —— Painel HQ ——
export async function platformAdminOverview(
  token: string,
  hqMode: 'real' | 'projection' = 'real'
): Promise<PlatformResult | null> {
  return post({ action: 'admin_overview', token, hqMode });
}

export async function platformAdminListShops(token: string): Promise<PlatformResult | null> {
  return post({ action: 'admin_list_shops', token });
}

export async function platformAdminShopDetail(
  token: string,
  businessId: string
): Promise<PlatformResult | null> {
  return post({ action: 'admin_shop_detail', token, businessId });
}

export async function platformAdminListOrders(
  token: string,
  opts?: { businessId?: string; status?: string; sinceDays?: number; q?: string; city?: string }
): Promise<PlatformResult | null> {
  return post({
    action: 'admin_list_orders',
    token,
    businessId: opts?.businessId,
    status: opts?.status,
    sinceDays: opts?.sinceDays,
    q: opts?.q,
    city: opts?.city,
  });
}

export async function platformAdminSetShopStatus(
  token: string,
  businessId: string,
  status: 'active' | 'suspended',
  reason?: string
): Promise<PlatformResult | null> {
  return post({ action: 'admin_set_shop_status', token, businessId, status, reason });
}

export async function platformAdminListStaff(token: string): Promise<PlatformResult | null> {
  return post({ action: 'admin_list_staff', token });
}

export async function platformAdminSetStaffRole(
  token: string,
  userId: string,
  role: PlatformRole | null
): Promise<PlatformResult | null> {
  return post({ action: 'admin_set_staff_role', token, userId, role });
}

export async function platformAdminTicketList(token: string): Promise<PlatformResult | null> {
  return post({ action: 'admin_ticket_list', token });
}

export async function platformAdminTicketUpdate(
  token: string,
  input: { id: string; status?: SupportTicket['status']; reply?: string }
): Promise<PlatformResult | null> {
  return post({ action: 'admin_ticket_update', token, ...input });
}

/** Break-glass HQ: SUPPORT_PIN promove a sessão atual a CEO. */
export async function platformAdminClaimCeo(
  token: string,
  supportPin: string
): Promise<PlatformResult | null> {
  return post({ action: 'admin_claim_ceo', token, supportPin });
}

// —— Command Center ——
export async function platformAdminOpsNow(
  token: string,
  hqMode: 'real' | 'projection' = 'real'
) {
  return post({ action: 'admin_ops_now', token, hqMode });
}
export async function platformAdminHealth(token: string) {
  return post({ action: 'admin_health', token });
}
export async function platformAdminSearch(token: string, q: string) {
  return post({ action: 'admin_search', token, q });
}
export async function platformAdminOrderDetail(token: string, orderId: string) {
  return post({ action: 'admin_order_detail', token, orderId });
}
export async function platformAdminListCustomers(
  token: string,
  opts?: { q?: string; city?: string; blocked?: boolean; limit?: number }
) {
  return post({ action: 'admin_list_customers', token, ...opts });
}
export async function platformAdminCustomerDetail(token: string, userId: string) {
  return post({ action: 'admin_customer_detail', token, userId });
}
export async function platformAdminSetUserBlock(
  token: string,
  userId: string,
  blocked: boolean,
  reason?: string
) {
  return post({ action: 'admin_set_user_block', token, userId, blocked, reason });
}
export async function platformAdminAuditList(
  token: string,
  opts?: { q?: string; entityType?: string; limit?: number }
) {
  return post({ action: 'admin_audit_list', token, ...opts });
}
export async function platformAdminFinanceOverview(
  token: string,
  sinceDays?: number,
  hqMode: 'real' | 'projection' = 'real'
) {
  return post({ action: 'admin_finance_overview', token, sinceDays, hqMode });
}
export async function platformAdminLedgerList(
  token: string,
  opts?: { ownerType?: string; ownerId?: string; limit?: number }
) {
  return post({ action: 'admin_ledger_list', token, ...opts } as any);
}
export async function platformAdminLedgerAdjust(
  token: string,
  input: {
    ownerType: 'merchant' | 'driver' | 'platform';
    ownerId: string;
    amount: number;
    kind: 'credit' | 'debit' | 'adjust';
    note: string;
    reason: string;
  }
) {
  return post({ action: 'admin_ledger_adjust', token, ...input });
}
export async function platformSyncDriverApplication(
  token: string,
  application: {
    id: string;
    name: string;
    email: string;
    phone: string;
    city?: string;
    document?: string;
    vehicle?: string;
    termsStatus?: string;
  }
) {
  return post({ action: 'sync_driver_application', token, application });
}
export async function platformAdminListApplications(
  token: string,
  opts?: { role?: 'merchant' | 'driver'; status?: string }
) {
  return post({ action: 'admin_list_applications', token, ...opts });
}
export async function platformAdminSetApplicationStatus(
  token: string,
  id: string,
  status: string,
  reason?: string,
  pipelineStage?: string
) {
  return post({
    action: 'admin_set_application_status',
    token,
    id,
    status: status as any,
    reason,
    pipelineStage,
  });
}
export async function platformAdminUpsertApplication(token: string, application: any) {
  return post({ action: 'admin_upsert_application', token, application });
}
export async function platformAdminListCities(token: string) {
  return post({ action: 'admin_list_cities', token });
}
export async function platformAdminUpsertCity(token: string, city: any) {
  return post({ action: 'admin_upsert_city', token, city });
}
export async function platformAdminSetCityStatus(
  token: string,
  id: string,
  status: 'active' | 'implanting' | 'inactive',
  reason?: string
) {
  return post({ action: 'admin_set_city_status', token, id, status, reason });
}
export async function platformAdminListCoupons(token: string) {
  return post({ action: 'admin_list_coupons', token });
}
export async function platformAdminUpsertCoupon(token: string, coupon: any) {
  return post({ action: 'admin_upsert_coupon', token, coupon });
}
export async function platformAdminListCampaigns(token: string) {
  return post({ action: 'admin_list_campaigns', token });
}
export async function platformAdminUpsertCampaign(token: string, campaign: any) {
  return post({ action: 'admin_upsert_campaign', token, campaign });
}
export async function platformAdminListFlags(token: string) {
  return post({ action: 'admin_list_flags', token });
}
export async function platformAdminSetFlag(token: string, flag: any, reason: string) {
  return post({ action: 'admin_set_flag', token, flag, reason });
}
export async function platformAdminListSystemLogs(
  token: string,
  opts?: { level?: string; service?: string; limit?: number }
) {
  return post({ action: 'admin_list_system_logs', token, ...opts } as any);
}
export async function platformAdminListIncidents(token: string) {
  return post({ action: 'admin_list_incidents', token });
}
export async function platformAdminUpsertIncident(token: string, incident: any) {
  return post({ action: 'admin_upsert_incident', token, incident });
}
export async function platformAdminDataQuality(token: string) {
  return post({ action: 'admin_data_quality', token });
}
export async function platformAdminListReviews(token: string, hidden?: boolean) {
  return post({ action: 'admin_list_reviews', token, hidden });
}
export async function platformAdminModerateReview(
  token: string,
  id: string,
  hidden: boolean,
  reason?: string
) {
  return post({ action: 'admin_moderate_review', token, id, hidden, reason });
}
export async function platformAdminListProducts(
  token: string,
  opts?: { q?: string; businessId?: string; limit?: number }
) {
  return post({ action: 'admin_list_products', token, ...opts });
}
export async function platformAdminSetProductAvailable(
  token: string,
  businessId: string,
  productId: string,
  available: boolean,
  reason: string
) {
  return post({
    action: 'admin_set_product_available',
    token,
    businessId,
    productId,
    available,
    reason,
  });
}
export async function platformAdminExport(
  token: string,
  kind: 'customers' | 'orders' | 'ledger' | 'audit',
  sinceDays?: number
) {
  return post({ action: 'admin_export_audit', token, kind, sinceDays });
}
export async function platformAdminReports(token: string, sinceDays?: number) {
  return post({ action: 'admin_reports', token, sinceDays });
}

export async function platformAdminProblemsNow(
  token: string,
  opts?: { hqMode?: 'real' | 'projection'; severity?: string; sla?: string }
) {
  return post({
    action: 'admin_problems_now',
    token,
    hqMode: opts?.hqMode || 'real',
    severity: opts?.severity,
    sla: opts?.sla,
  });
}

export async function platformAdminProblemDetail(
  token: string,
  orderId: string,
  hqMode: 'real' | 'projection' = 'real'
) {
  return post({ action: 'admin_problem_detail', token, orderId, hqMode });
}

export async function platformAdminProblemAction(
  token: string,
  body: {
    orderId: string;
    problemAction: string;
    message?: string;
    rootCause?: string;
    rootCauseNote?: string;
    reason?: string;
    hqMode?: 'real' | 'projection';
  }
) {
  return post({ action: 'admin_problem_action', token, ...body });
}

export async function platformAdminIntelligence(
  token: string,
  opts?: { hqMode?: 'real' | 'projection'; sinceDays?: number }
) {
  return post({
    action: 'admin_intelligence',
    token,
    hqMode: opts?.hqMode || 'real',
    sinceDays: opts?.sinceDays ?? 30,
  });
}
