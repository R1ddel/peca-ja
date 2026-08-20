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

const TIMEOUT_MS = 15000;

async function post(body: Record<string, unknown>): Promise<PlatformResult | null> {
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

export async function platformHealth(): Promise<{
  online: boolean;
  persistence?: string;
}> {
  try {
    const bases = [getFleetBaseUrl(), getApiBaseUrl()].filter(
      (v, i, a) => a.indexOf(v) === i
    );
    for (const base of bases) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${base}/api/platform`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const json = await res.json();
      if (json?.ok) {
        return { online: true, persistence: String(json.persistence || '') };
      }
    }
  } catch {
    /* offline */
  }
  return { online: false };
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
  email: string;
  subject: string;
  body: string;
  userId?: string;
  orderId?: string;
}): Promise<PlatformResult | null> {
  return post({ action: 'ticket_create', ...input });
}

export async function platformListTickets(opts: {
  pin?: string;
  email?: string;
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
export async function platformAdminOverview(token: string): Promise<PlatformResult | null> {
  return post({ action: 'admin_overview', token });
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
  opts?: { businessId?: string; status?: string; sinceDays?: number }
): Promise<PlatformResult | null> {
  return post({
    action: 'admin_list_orders',
    token,
    businessId: opts?.businessId,
    status: opts?.status,
    sinceDays: opts?.sinceDays,
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
  role: 'ceo' | 'ops' | null
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
