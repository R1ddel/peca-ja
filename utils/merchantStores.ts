/**
 * Multi-loja: várias candidaturas/lojas no mesmo e-mail + loja ativa.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MerchantApplication,
  isMerchantPanelUnlocked,
  resolveMerchantApplication,
  submitMerchantApplication,
  setMerchantPlan,
  confirmMerchantPlanPayment,
  acceptMerchantTerms,
  getApplicationById,
} from '@/utils/partners';
import {
  MerchantShop,
  ensureShopFromApplication,
  getShopByApplicationId,
  getShopByBusinessId,
  hydratePartnerShops,
} from '@/utils/merchantShop';

const ACTIVE_APP_KEY = '@pecaja_active_merchant_app';

async function loadAllApps(): Promise<MerchantApplication[]> {
  try {
    const raw = await AsyncStorage.getItem('@pecaja_partner_applications');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((a: { role?: string }) => a.role === 'merchant') as MerchantApplication[];
  } catch {
    return [];
  }
}

export async function listMerchantApplicationsForEmail(
  email?: string | null
): Promise<MerchantApplication[]> {
  if (!email?.trim()) return [];
  const needle = email.trim().toLowerCase();
  const all = await loadAllApps();
  return all
    .filter((a) => a.email.trim().toLowerCase() === needle)
    .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getActiveMerchantApplicationId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_APP_KEY);
  } catch {
    return null;
  }
}

export async function setActiveMerchantApplicationId(applicationId: string) {
  await AsyncStorage.setItem(ACTIVE_APP_KEY, applicationId);
  await AsyncStorage.setItem('@pecaja_last_merchant_app', applicationId);
}

/**
 * Resolve a loja ativa: prioriza ACTIVE_APP_KEY se pertencer ao e-mail;
 * senão a primeira liberada; senão resolveMerchantApplication.
 */
export async function resolveActiveMerchantContext(email?: string | null): Promise<{
  app: MerchantApplication | null;
  shop: MerchantShop | null;
  all: MerchantApplication[];
}> {
  const all = await listMerchantApplicationsForEmail(email);
  if (!all.length) {
    const app = await resolveMerchantApplication(email);
    const shop = app ? await ensureShopFromApplication(app) : null;
    return { app, shop, all: app ? [app] : [] };
  }

  const activeId = await getActiveMerchantApplicationId();
  const app =
    (activeId ? all.find((a) => a.id === activeId) : null) ??
    all.find((a) => isMerchantPanelUnlocked(a)) ??
    all[0];

  if (app) {
    await setActiveMerchantApplicationId(app.id);
  }

  const shop = app ? await ensureShopFromApplication(app) : null;
  await hydratePartnerShops();
  return { app, shop, all };
}

/**
 * Contexto da loja para operador (dono via e-mail OU sessão/membro de equipe).
 * Funcionário logado não precisa do mesmo e-mail do dono.
 */
export async function resolveOperatorMerchantContext(email?: string | null): Promise<{
  app: MerchantApplication | null;
  shop: MerchantShop | null;
  all: MerchantApplication[];
  viaStaff: boolean;
}> {
  const { getStaffSession, findStaffByEmail } = await import('@/utils/merchantTeam');
  const session = await getStaffSession();
  if (session) {
    await hydratePartnerShops();
    const shop = await getShopByBusinessId(session.businessId);
    if (shop) {
      const app = await getApplicationById(shop.applicationId);
      if (app?.role === 'merchant') {
        await setActiveMerchantApplicationId(app.id);
        return { app, shop, all: [app], viaStaff: true };
      }
    }
  }

  const ctx = await resolveActiveMerchantContext(email);
  if (ctx.app && ctx.shop) {
    return { ...ctx, viaStaff: false };
  }

  // Funcionário cadastrado: acha a loja pelo e-mail da equipe (não pelo e-mail da compra).
  if (email?.trim()) {
    const memberships = await findStaffByEmail(email);
    for (const m of memberships) {
      await hydratePartnerShops();
      const shop = await getShopByBusinessId(m.businessId);
      if (!shop) continue;
      const app = await getApplicationById(shop.applicationId);
      if (app?.role === 'merchant') {
        return { app, shop, all: [app], viaStaff: true };
      }
    }
  }

  return { app: null, shop: null, all: [], viaStaff: false };
}

export type StoreBranchSummary = {
  applicationId: string;
  businessId: string;
  name: string;
  unlocked: boolean;
  isActive: boolean;
  isOpen: boolean;
  plan?: string;
};

export async function listStoreBranches(email?: string | null): Promise<StoreBranchSummary[]> {
  const { all, app: active } = await resolveActiveMerchantContext(email);
  const rows: StoreBranchSummary[] = [];
  for (const a of all) {
    const shop = await getShopByApplicationId(a.id);
    rows.push({
      applicationId: a.id,
      businessId: shop?.businessId ?? `partner_${a.id}`,
      name: shop?.name ?? a.businessName,
      unlocked: isMerchantPanelUnlocked(a),
      isActive: a.id === active?.id,
      isOpen: shop?.isOpen ?? false,
      plan: a.plan,
    });
  }
  return rows;
}

/**
 * Cria uma nova loja (filial) no mesmo e-mail.
 * Se a loja origem estiver liberada, clona plano/termo para a filial operar na hora.
 */
export async function createStoreBranch(opts: {
  email: string;
  ownerName: string;
  phone: string;
  businessName: string;
  category: string;
  address: string;
  document: string;
  cloneUnlockedFrom?: MerchantApplication | null;
}): Promise<{ ok: true; application: MerchantApplication } | { ok: false; error: string }> {
  const created = await submitMerchantApplication({
    ownerName: opts.ownerName,
    email: opts.email,
    phone: opts.phone,
    businessName: opts.businessName.trim(),
    category: opts.category,
    address: opts.address,
    document: opts.document,
    allowAdditionalStore: true,
  });
  if (!created.ok) return created;

  let app = created.application;
  const source = opts.cloneUnlockedFrom;
  if (source?.plan && isMerchantPanelUnlocked(source)) {
    await setMerchantPlan(app.id, source.plan, source.planCity);
    await confirmMerchantPlanPayment(app.id, {
      paymentId: `branch_clone_${Date.now()}`,
      method: 'pix',
    });
    await acceptMerchantTerms(app.id, {
      signerName: opts.ownerName,
      signerDocument: opts.document || '00000000000',
      method: 'aceite_eletronico',
    });
    const refreshed = await getApplicationById(app.id);
    if (refreshed?.role === 'merchant') app = refreshed;
  }

  await ensureShopFromApplication(app);
  await setActiveMerchantApplicationId(app.id);
  return { ok: true, application: app };
}
