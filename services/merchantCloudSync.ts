/**
 * Cliente do sync na nuvem (API Expo no mesmo host do Metro / EXPO_PUBLIC_API_URL).
 */
import { getApiBaseUrl } from '@/services/apiBase';
import {
  AnyMerchantSyncPayload,
  applyMerchantSyncPayload,
  buildMerchantSyncPayload,
  getOrCreateCloudSyncToken,
} from '@/utils/merchantSync';

export type CloudSyncStatus = {
  ok: boolean;
  exists?: boolean;
  updatedAt?: string | null;
  message?: string;
};

async function postCloud(body: Record<string, unknown>) {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/api/merchant/cloud-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { res, json };
}

export async function getCloudSyncStatus(applicationId: string): Promise<CloudSyncStatus> {
  try {
    const { res, json } = await postCloud({
      action: 'status',
      applicationId,
    });
    if (!res.ok || !json?.ok) {
      return { ok: false, message: json?.message || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      exists: !!json.exists,
      updatedAt: json.updatedAt ?? null,
    };
  } catch (e: any) {
    return {
      ok: false,
      message:
        e?.message ||
        'Sem conexão com a API. Confira se o Expo está no mesmo Wi‑Fi (ou EXPO_PUBLIC_API_URL).',
    };
  }
}

export async function pushMerchantCloudSync(
  applicationId: string
): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  try {
    const payload = await buildMerchantSyncPayload(applicationId);
    if (!payload) return { ok: false, error: 'Loja não encontrada.' };
    const token = payload.cloudToken || (await getOrCreateCloudSyncToken(applicationId));
    const { res, json } = await postCloud({
      action: 'push',
      applicationId,
      token,
      payload,
    });
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.message || `Falha no upload (HTTP ${res.status}).` };
    }
    return { ok: true, updatedAt: String(json.updatedAt || new Date().toISOString()) };
  } catch (e: any) {
    return {
      ok: false,
      error:
        e?.message ||
        'Sem conexão com a API de sync. Use o mesmo host do Expo ou EXPO_PUBLIC_API_URL.',
    };
  }
}

export async function pullMerchantCloudSync(
  applicationId: string
): Promise<{ ok: true; shopName: string; updatedAt?: string } | { ok: false; error: string }> {
  try {
    const token = await getOrCreateCloudSyncToken(applicationId);
    const { res, json } = await postCloud({
      action: 'pull',
      applicationId,
      token,
    });
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.message || `Falha no download (HTTP ${res.status}).` };
    }
    const payload = json.payload as AnyMerchantSyncPayload;
    const applied = await applyMerchantSyncPayload(payload);
    if (!applied.ok) return applied;
    return {
      ok: true,
      shopName: applied.shopName,
      updatedAt: json.updatedAt ? String(json.updatedAt) : undefined,
    };
  } catch (e: any) {
    return {
      ok: false,
      error:
        e?.message ||
        'Sem conexão com a API de sync. Use o mesmo host do Expo ou EXPO_PUBLIC_API_URL.',
    };
  }
}
