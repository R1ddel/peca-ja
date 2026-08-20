/**
 * Helper: tenta várias bases (frota LAN + API) para rotas de pagamento.
 */
import { getApiBaseUrl, getFleetBaseUrl } from '@/services/apiBase';

export function paymentApiBases(): string[] {
  return [getFleetBaseUrl(), getApiBaseUrl()].filter((v, i, a) => a.indexOf(v) === i);
}

/** POST JSON em /api/payments/... tentando cada base até sucesso ou erro de negócio. */
export async function fetchPaymentsJson(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<{ okHttp: boolean; status: number; json: any; base: string } | null> {
  const { timeoutMs = 12_000, ...rest } = init;
  const bases = paymentApiBases();
  const pathClean = path.startsWith('/') ? path : `/${path}`;

  for (const base of bases) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(`${base}${pathClean}`, {
        ...rest,
        signal: rest.signal ?? ctrl.signal,
      });
      clearTimeout(timer);
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        json = null;
      }
      // Rede ok — retorna mesmo se 4xx (erro de negócio)
      if (res.status !== 404) {
        return { okHttp: res.ok, status: res.status, json, base };
      }
    } catch {
      /* próxima base */
    }
  }
  return null;
}
