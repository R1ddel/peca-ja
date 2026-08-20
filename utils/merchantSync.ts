/**
 * Backup / sync entre aparelhos.
 * - Código clipboard PECAJA1.… / PECAJA2.… (offline)
 * - Nuvem via API Expo (`/api/merchant/cloud-sync`)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { MerchantShop, getShopByApplicationId, hydratePartnerShops } from '@/utils/merchantShop';
import { getWallet, MerchantWallet } from '@/utils/merchantWallet';
import { listStaff, StaffMember } from '@/utils/merchantTeam';
import { StaffPunch } from '@/utils/merchantPunch';
import { Order } from '@/types';
import { ChatMessage } from '@/services/orderChat';

const SHOPS_KEY = '@pecaja_merchant_shops_v1';
const WALLET_KEY = '@pecaja_merchant_wallet_v1';
const STAFF_KEY = '@pecaja_merchant_staff_v1';
const ORDERS_KEY = '@pecaja_orders';
const PUNCHES_KEY = '@pecaja_merchant_punches_v1';
const CHATS_KEY = '@pecaja_order_chats';
const SYNC_TOKEN_KEY = '@pecaja_merchant_cloud_tokens_v1';

export type MerchantSyncPayloadV1 = {
  v: 1;
  kind: 'pecaja_merchant_sync';
  exportedAt: string;
  applicationId: string;
  shop: MerchantShop;
  wallet: MerchantWallet | null;
  staff: StaffMember[];
};

export type MerchantSyncPayload = {
  v: 2;
  kind: 'pecaja_merchant_sync';
  exportedAt: string;
  applicationId: string;
  businessId: string;
  shop: MerchantShop;
  wallet: MerchantWallet | null;
  staff: StaffMember[];
  orders: Order[];
  punches: StaffPunch[];
  chats: Record<string, ChatMessage[]>;
  cloudToken?: string;
};

export type AnyMerchantSyncPayload = MerchantSyncPayload | MerchantSyncPayloadV1;

function b64Encode(json: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = unescape(encodeURIComponent(json));
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes.charCodeAt(i);
    const b = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) : 0;
    const c = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}

function b64Decode(b64: string): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = b64.replace(/=+$/, '');
  let bytes = '';
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (chars.indexOf(clean[i]) << 18) |
      (chars.indexOf(clean[i + 1]) << 12) |
      ((chars.indexOf(clean[i + 2]) || 0) << 6) |
      (chars.indexOf(clean[i + 3]) || 0);
    bytes += String.fromCharCode((n >> 16) & 255);
    if (clean[i + 2] && clean[i + 2] !== '=') bytes += String.fromCharCode((n >> 8) & 255);
    if (clean[i + 3] && clean[i + 3] !== '=') bytes += String.fromCharCode(n & 255);
  }
  return decodeURIComponent(escape(bytes));
}

/** Token estável por loja — qualquer aparelho com o mesmo applicationId sincroniza. */
export function cloudTokenForApplication(applicationId: string): string {
  const safe = String(applicationId || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 48);
  return `pj_${safe || 'loja'}`;
}

async function loadCloudTokens(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_TOKEN_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function getOrCreateCloudSyncToken(applicationId: string): Promise<string> {
  const stable = cloudTokenForApplication(applicationId);
  const map = await loadCloudTokens();
  if (map[applicationId] !== stable) {
    map[applicationId] = stable;
    await AsyncStorage.setItem(SYNC_TOKEN_KEY, JSON.stringify(map));
  }
  return stable;
}

export async function setCloudSyncToken(applicationId: string, token: string) {
  const map = await loadCloudTokens();
  map[applicationId] = token;
  await AsyncStorage.setItem(SYNC_TOKEN_KEY, JSON.stringify(map));
}

async function loadBusinessOrders(businessId: string): Promise<Order[]> {
  try {
    const raw = await AsyncStorage.getItem(ORDERS_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as Order[];
    if (!Array.isArray(all)) return [];
    return all.filter((o) => o?.businessId === businessId);
  } catch {
    return [];
  }
}

async function loadBusinessPunches(businessId: string): Promise<StaffPunch[]> {
  try {
    const raw = await AsyncStorage.getItem(PUNCHES_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as StaffPunch[];
    if (!Array.isArray(all)) return [];
    return all.filter((p) => p?.businessId === businessId).slice(0, 800);
  } catch {
    return [];
  }
}

async function loadBusinessChats(
  businessId: string,
  orders: Order[]
): Promise<Record<string, ChatMessage[]>> {
  try {
    const orderIds = new Set(orders.map((o) => o.id));
    const raw = await AsyncStorage.getItem(CHATS_KEY);
    if (!raw) return {};
    const store = JSON.parse(raw) as Record<string, ChatMessage[]>;
    if (!store || typeof store !== 'object') return {};
    const out: Record<string, ChatMessage[]> = {};
    for (const [key, msgs] of Object.entries(store)) {
      if (!Array.isArray(msgs) || !msgs.length) continue;
      const orderId = msgs[0]?.orderId || key.split('::')[0];
      if (orderIds.has(orderId)) out[key] = msgs.slice(-200);
    }
    return out;
  } catch {
    return {};
  }
}

export async function buildMerchantSyncPayload(
  applicationId: string
): Promise<MerchantSyncPayload | null> {
  const shop = await getShopByApplicationId(applicationId);
  if (!shop) return null;
  const wallet = await getWallet(shop.businessId);
  const staff = await listStaff(shop.businessId);
  const orders = await loadBusinessOrders(shop.businessId);
  const punches = await loadBusinessPunches(shop.businessId);
  const chats = await loadBusinessChats(shop.businessId, orders);
  const cloudToken = await getOrCreateCloudSyncToken(applicationId);
  return {
    v: 2,
    kind: 'pecaja_merchant_sync',
    exportedAt: new Date().toISOString(),
    applicationId,
    businessId: shop.businessId,
    shop,
    wallet,
    staff,
    orders,
    punches,
    chats,
    cloudToken,
  };
}

export function encodeSyncPayload(payload: AnyMerchantSyncPayload): string {
  const json = JSON.stringify(payload);
  const prefix = payload.v === 2 ? 'PECAJA2.' : 'PECAJA1.';
  return `${prefix}${b64Encode(json)}`;
}

export function parseSyncPayload(raw: string): AnyMerchantSyncPayload | null {
  try {
    const text = raw.trim();
    let json: string;
    if (text.startsWith('PECAJA2.') || text.startsWith('PECAJA1.')) {
      json = b64Decode(text.slice(8));
    } else if (text.startsWith('{')) {
      json = text;
    } else {
      return null;
    }
    const parsed = JSON.parse(json);
    if (parsed?.kind !== 'pecaja_merchant_sync' || !parsed.shop) return null;
    if (parsed.v !== 1 && parsed.v !== 2) return null;
    return parsed as AnyMerchantSyncPayload;
  } catch {
    return null;
  }
}

function toV2(payload: AnyMerchantSyncPayload): MerchantSyncPayload {
  if (payload.v === 2) return payload;
  return {
    v: 2,
    kind: 'pecaja_merchant_sync',
    exportedAt: payload.exportedAt,
    applicationId: payload.applicationId,
    businessId: payload.shop.businessId,
    shop: payload.shop,
    wallet: payload.wallet,
    staff: payload.staff || [],
    orders: [],
    punches: [],
    chats: {},
  };
}

export async function applyMerchantSyncPayload(
  payloadIn: AnyMerchantSyncPayload
): Promise<{ ok: true; shopName: string } | { ok: false; error: string }> {
  const payload = toV2(payloadIn);
  try {
    const shopsRaw = await AsyncStorage.getItem(SHOPS_KEY);
    const shops: MerchantShop[] = shopsRaw ? JSON.parse(shopsRaw) : [];
    const nextShops = [
      payload.shop,
      ...shops.filter((s) => s.businessId !== payload.shop.businessId),
    ];
    await AsyncStorage.setItem(SHOPS_KEY, JSON.stringify(nextShops));

    if (payload.wallet) {
      const wRaw = await AsyncStorage.getItem(WALLET_KEY);
      const wallets: MerchantWallet[] = wRaw ? JSON.parse(wRaw) : [];
      const nextW = [
        payload.wallet,
        ...wallets.filter((w) => w.businessId !== payload.wallet!.businessId),
      ];
      await AsyncStorage.setItem(WALLET_KEY, JSON.stringify(nextW));
    }

    if (payload.staff?.length) {
      const sRaw = await AsyncStorage.getItem(STAFF_KEY);
      const staff: StaffMember[] = sRaw ? JSON.parse(sRaw) : [];
      const others = staff.filter((m) => m.businessId !== payload.shop.businessId);
      await AsyncStorage.setItem(STAFF_KEY, JSON.stringify([...payload.staff, ...others]));
    }

    if (payload.orders?.length) {
      const oRaw = await AsyncStorage.getItem(ORDERS_KEY);
      const allOrders: Order[] = oRaw ? JSON.parse(oRaw) : [];
      const keep = allOrders.filter((o) => o.businessId !== payload.shop.businessId);
      const byId = new Map<string, Order>();
      for (const o of [...keep, ...payload.orders]) byId.set(o.id, o);
      await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify([...byId.values()]));
    }

    if (payload.punches?.length) {
      const pRaw = await AsyncStorage.getItem(PUNCHES_KEY);
      const allP: StaffPunch[] = pRaw ? JSON.parse(pRaw) : [];
      const keep = allP.filter((p) => p.businessId !== payload.shop.businessId);
      await AsyncStorage.setItem(
        PUNCHES_KEY,
        JSON.stringify([...payload.punches, ...keep].slice(0, 1200))
      );
    }

    if (payload.chats && Object.keys(payload.chats).length) {
      const cRaw = await AsyncStorage.getItem(CHATS_KEY);
      const store: Record<string, ChatMessage[]> = cRaw ? JSON.parse(cRaw) : {};
      await AsyncStorage.setItem(CHATS_KEY, JSON.stringify({ ...store, ...payload.chats }));
    }

    if (payload.cloudToken) {
      await setCloudSyncToken(payload.applicationId, payload.cloudToken);
    }

    await AsyncStorage.setItem('@pecaja_active_merchant_app', payload.applicationId);
    await AsyncStorage.setItem('@pecaja_last_merchant_app', payload.applicationId);
    await hydratePartnerShops();
    return { ok: true, shopName: payload.shop.name };
  } catch {
    return { ok: false, error: 'Falha ao gravar o backup neste aparelho.' };
  }
}

export async function exportMerchantSyncToClipboard(
  applicationId: string
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const payload = await buildMerchantSyncPayload(applicationId);
  if (!payload) return { ok: false, error: 'Loja não encontrada.' };
  const code = encodeSyncPayload(payload);
  await Clipboard.setStringAsync(code);
  return { ok: true, code };
}

export async function importMerchantSync(
  raw: string
): Promise<{ ok: true; shopName: string } | { ok: false; error: string }> {
  const payload = parseSyncPayload(raw);
  if (!payload) return { ok: false, error: 'Código inválido. Cole o backup PECAJA2.…' };
  return applyMerchantSyncPayload(payload);
}
