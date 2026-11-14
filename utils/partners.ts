/**
 * Onboarding comerciante/entregador (local → depois API).
 * Comerciante: cadastro → plano → pagamento → termo → painel liberado (sem aprovação manual).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MerchantPlan, MERCHANT_PLANS, formatPlanPrice } from '@/constants/plans';
import { MERCHANT_TERMS_VERSION } from '@/constants/merchantTerms';
import { DRIVER_TERMS_VERSION } from '@/constants/driverTerms';
import type { WeeklyHours } from '@/utils/weeklyHours';
import type { ShopPaymentMethod } from '@/utils/paymentMethods';
import type { ShopDeliveryMode } from '@/utils/shopDelivery';
import { getDriverSession, setDriverSession } from '@/utils/driverSession';
import { getPlatformToken, setPlatformToken } from '@/services/platformSession';
import {
  asPlatformToken,
  asPlatformUser,
  platformLogin,
  platformMe,
  platformRegister,
  platformSyncDriverApplication,
} from '@/services/platformClient';

export type PartnerRole = 'merchant' | 'driver';
/** approved = painel liberado (pagamento + termo ok). */
export type PartnerStatus = 'pending' | 'approved' | 'rejected';

export type PaymentStatus = 'unpaid' | 'paid' | 'failed';
export type TermsStatus = 'pending' | 'accepted';
export type TermsSignatureMethod = 'aceite_eletronico' | 'govbr';
export type PlanPaymentMethod = 'pix' | 'card';

/** Dias de vigência da assinatura após pagamento confirmado. */
export const PLAN_BILLING_DAYS = 30;

export type MerchantApplication = {
  id: string;
  role: 'merchant';
  status: PartnerStatus;
  createdAt: string;
  updatedAt: string;
  ownerName: string;
  email: string;
  phone: string;
  businessName: string;
  category: string;
  address: string;
  document: string;
  notes?: string;
  /** Grade semanal informada no cadastro. */
  weeklyHours?: WeeklyHours;
  /** Pagamentos que a loja aceita, definidos no cadastro. */
  acceptedPayments?: ShopPaymentMethod[];
  /** store = entregador próprio. app = motoboy da Peça Já. */
  deliveryBy?: ShopDeliveryMode;
  /** Município de atuação escolhido no cadastro. Ex.: "Mucugê — BA". */
  city?: string;
  plan?: MerchantPlan;
  planCity?: string;
  paymentStatus?: PaymentStatus;
  paymentId?: string;
  paymentPaidAt?: string;
  paymentAmount?: number;
  /** Fim da competência mensal (ISO). Sem isso ou expirado → precisa pagar de novo. */
  planPaidUntil?: string;
  paymentMethod?: PlanPaymentMethod;
  termsStatus?: TermsStatus;
  termsVersion?: string;
  termsAcceptedAt?: string;
  termsSignatureMethod?: TermsSignatureMethod;
  termsSignerName?: string;
  termsSignerDocument?: string;
  termsGovBrRef?: string;
};

export type DriverVehicleType = 'Moto' | 'Bicicleta' | 'Carro' | 'A pé';

export type DriverApplication = {
  id: string;
  role: 'driver';
  status: PartnerStatus;
  createdAt: string;
  updatedAt: string;
  name: string;
  email: string;
  phone: string;
  /** Tipo resumido (compatível com cadastros antigos). */
  vehicle: string;
  document: string;
  notes?: string;
  /** Foto e bio públicas (aparecem no pedido para cliente/loja). */
  photoUrl?: string;
  bio?: string;
  /** Senha do painel do entregador (local). */
  password?: string;
  city?: string;
  birthDate?: string;
  /** CNH */
  cnhNumber?: string;
  cnhCategory?: string;
  cnhExpiry?: string;
  /** Dados do veículo */
  vehicleType?: DriverVehicleType | string;
  plate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  renavam?: string;
  /** Termo de responsabilidade */
  termsStatus?: TermsStatus;
  termsVersion?: string;
  termsAcceptedAt?: string;
  termsSignatureMethod?: TermsSignatureMethod;
  termsSignerName?: string;
  termsSignerDocument?: string;
};

export type PartnerApplication = MerchantApplication | DriverApplication;

const KEY = '@pecaja_partner_applications';
const LAST_MERCHANT_KEY = '@pecaja_last_merchant_app';
const LAST_DRIVER_KEY = '@pecaja_last_driver_app';

async function loadAll(): Promise<PartnerApplication[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: PartnerApplication[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

function newId(role: PartnerRole) {
  return `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function patchMerchant(
  id: string,
  patch: Partial<MerchantApplication>
): Promise<MerchantApplication | null> {
  const list = await loadAll();
  const idx = list.findIndex((a) => a.id === id && a.role === 'merchant');
  if (idx < 0) return null;
  const current = list[idx] as MerchantApplication;
  const updated: MerchantApplication = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = updated;
  await saveAll(list);
  return updated;
}

/** Pagamento confirmado + termo aceito + mês vigente → libera painel. */
export function computePlanPaidUntil(from: Date = new Date()): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + PLAN_BILLING_DAYS);
  return d.toISOString();
}

export function isMerchantSubscriptionActive(app: MerchantApplication): boolean {
  // Só vale assinatura com data de vigência gravada após gateway (cartão/Pix).
  // Pagamentos antigos/"Já paguei" sem planPaidUntil NÃO liberam.
  if (app.paymentStatus !== 'paid' || !app.plan || !app.planPaidUntil) return false;
  const until = new Date(app.planPaidUntil).getTime();
  return !Number.isNaN(until) && until > Date.now();
}

export function formatPlanPaidUntil(app: MerchantApplication): string | null {
  const iso = app.planPaidUntil;
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function isMerchantPanelUnlocked(app: MerchantApplication): boolean {
  return (
    isMerchantSubscriptionActive(app) &&
    app.termsStatus === 'accepted' &&
    app.status === 'approved' &&
    !!app.plan
  );
}

export function merchantOnboardingGate(
  app: MerchantApplication
): 'plan' | 'pay' | 'terms' | 'ready' {
  if (!app.plan) return 'plan';
  if (!isMerchantSubscriptionActive(app)) return 'pay';
  if (app.termsStatus !== 'accepted') return 'terms';
  return 'ready';
}

export async function listPartnerApplications(): Promise<PartnerApplication[]> {
  return loadAll();
}

export async function findApplicationByEmail(
  email: string,
  role?: PartnerRole
): Promise<PartnerApplication | null> {
  const list = await loadAll();
  const needle = email.trim().toLowerCase();
  const found = list.find((a) => {
    const mail = a.email.toLowerCase();
    if (mail !== needle) return false;
    if (role && a.role !== role) return false;
    return true;
  });
  return found ?? null;
}

export async function submitMerchantApplication(
  input: Omit<
    MerchantApplication,
    | 'id'
    | 'role'
    | 'status'
    | 'createdAt'
    | 'updatedAt'
    | 'paymentStatus'
    | 'termsStatus'
  > & { allowAdditionalStore?: boolean }
): Promise<{ ok: true; application: MerchantApplication } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.ownerName.trim() || !input.businessName.trim() || !input.phone.trim()) {
    return { ok: false, error: 'Preencha os campos obrigatórios.' };
  }

  const list = await loadAll();
  const existing = list.find(
    (a) => a.role === 'merchant' && a.email.toLowerCase() === email
  ) as MerchantApplication | undefined;

  if (!input.allowAdditionalStore && existing) {
    return {
      ok: false,
      error: 'Este e-mail já está cadastrado. Entre com ele para continuar a loja.',
    };
  }

  const now = new Date().toISOString();
  const application: MerchantApplication = {
    id: newId('merchant'),
    role: 'merchant',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    ownerName: input.ownerName.trim(),
    email,
    phone: input.phone.trim(),
    businessName: input.businessName.trim(),
    category: input.category.trim() || 'Outro',
    address: input.address.trim(),
    document: input.document.trim(),
    notes: input.notes?.trim() || undefined,
    city: input.city?.trim() || undefined,
    weeklyHours: input.weeklyHours,
    acceptedPayments: input.acceptedPayments,
    deliveryBy: input.deliveryBy,
    paymentStatus: 'unpaid',
    termsStatus: 'pending',
  };

  await saveAll([application, ...list]);
  await AsyncStorage.setItem(LAST_MERCHANT_KEY, application.id);
  return { ok: true, application };
}

export function hasAcceptedDriverTerms(app: DriverApplication): boolean {
  // Status aceito basta para liberar o painel; versão nova aparece no rodapé para releitura.
  return app.termsStatus === 'accepted';
}

export function isDriverTermsVersionCurrent(app: DriverApplication): boolean {
  return (
    hasAcceptedDriverTerms(app) && app.termsVersion === DRIVER_TERMS_VERSION
  );
}

export function isDriverPanelUnlocked(app: DriverApplication): boolean {
  return app.status === 'approved' && hasAcceptedDriverTerms(app);
}

export function driverOnboardingGate(
  app: DriverApplication
): 'terms' | 'pending' | 'rejected' | 'ready' {
  if (app.status === 'rejected') return 'rejected';
  if (!hasAcceptedDriverTerms(app)) return 'terms';
  if (app.status !== 'approved') return 'pending';
  return 'ready';
}

export type DriverRegisterInput = {
  name: string;
  email: string;
  phone: string;
  password: string;
  document: string;
  city: string;
  birthDate?: string;
  cnhNumber: string;
  cnhCategory: string;
  cnhExpiry?: string;
  vehicleType: string;
  plate?: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleYear?: string;
  vehicleColor?: string;
  renavam?: string;
  notes?: string;
};

export async function submitDriverApplication(
  input: DriverRegisterInput
): Promise<{ ok: true; application: DriverApplication } | { ok: false; error: string }> {
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();
  const vehicleType = input.vehicleType.trim() || 'Moto';
  const needsPlate = vehicleType === 'Moto' || vehicleType === 'Carro';

  if (!email || !input.name.trim() || !input.phone.trim()) {
    return { ok: false, error: 'Preencha nome, e-mail e telefone.' };
  }
  if (password.length < 4) {
    return { ok: false, error: 'Crie uma senha com pelo menos 4 caracteres.' };
  }
  if (input.document.replace(/\D/g, '').length !== 11) {
    return { ok: false, error: 'Informe um CPF válido (11 dígitos).' };
  }
  if (!input.city.trim()) {
    return { ok: false, error: 'Informe a cidade de atuação.' };
  }
  if (vehicleType !== 'A pé' && vehicleType !== 'Bicicleta') {
    if (!input.cnhNumber.trim() || !input.cnhCategory.trim()) {
      return { ok: false, error: 'Informe número e categoria da CNH.' };
    }
  }
  if (needsPlate && !input.plate?.trim()) {
    return { ok: false, error: 'Informe a placa do veículo.' };
  }
  if (needsPlate && (!input.vehicleBrand?.trim() || !input.vehicleModel?.trim())) {
    return { ok: false, error: 'Informe marca e modelo do veículo.' };
  }

  const list = await loadAll();
  const existing = list.find(
    (a) => a.role === 'driver' && a.email.toLowerCase() === email && a.status !== 'rejected'
  );
  if (existing) {
    return {
      ok: false,
      error:
        existing.status === 'approved'
          ? 'Este e-mail já tem cadastro de entregador aprovado. Faça login.'
          : 'Já existe uma candidatura com este e-mail. Faça login ou aguarde a análise.',
    };
  }

  const now = new Date().toISOString();
  const application: DriverApplication = {
    id: newId('driver'),
    role: 'driver',
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    password,
    document: input.document.replace(/\D/g, ''),
    city: input.city.trim(),
    birthDate: input.birthDate?.trim() || undefined,
    cnhNumber: input.cnhNumber.trim() || undefined,
    cnhCategory: input.cnhCategory.trim() || undefined,
    cnhExpiry: input.cnhExpiry?.trim() || undefined,
    vehicle: vehicleType,
    vehicleType,
    plate: input.plate?.trim().toUpperCase() || undefined,
    vehicleBrand: input.vehicleBrand?.trim() || undefined,
    vehicleModel: input.vehicleModel?.trim() || undefined,
    vehicleYear: input.vehicleYear?.trim() || undefined,
    vehicleColor: input.vehicleColor?.trim() || undefined,
    renavam: input.renavam?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    termsStatus: 'pending',
  };

  await saveAll([application, ...list]);
  await AsyncStorage.setItem(LAST_DRIVER_KEY, application.id);
  return { ok: true, application };
}

export async function loginDriverApplication(
  emailRaw: string,
  passwordRaw: string
): Promise<{ ok: true; application: DriverApplication } | { ok: false; error: string }> {
  const email = emailRaw.trim().toLowerCase();
  const password = passwordRaw.trim();
  if (!email || !password) {
    return { ok: false, error: 'Informe e-mail e senha.' };
  }
  const list = await loadAll();
  const found = list.find((a) => a.role === 'driver' && a.email.toLowerCase() === email) as
    | DriverApplication
    | undefined;
  if (!found) {
    return { ok: false, error: 'Cadastro de entregador não encontrado. Crie sua conta.' };
  }
  if (found.status === 'rejected') {
    return { ok: false, error: 'Esta candidatura foi recusada. Envie um novo cadastro.' };
  }
  if (found.password && found.password !== password) {
    return { ok: false, error: 'Senha incorreta.' };
  }
  // Cadastros antigos sem senha: define a senha informada no primeiro login
  if (!found.password) {
    const patched = await patchDriver(found.id, { password });
    await AsyncStorage.setItem(LAST_DRIVER_KEY, found.id);
    return { ok: true, application: patched ?? found };
  }
  await AsyncStorage.setItem(LAST_DRIVER_KEY, found.id);
  return { ok: true, application: found };
}

async function patchDriver(
  id: string,
  patch: Partial<DriverApplication>
): Promise<DriverApplication | null> {
  const list = await loadAll();
  const idx = list.findIndex((a) => a.id === id && a.role === 'driver');
  if (idx < 0) return null;
  const current = list[idx] as DriverApplication;
  const updated: DriverApplication = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[idx] = updated;
  await saveAll(next);
  return updated;
}

export async function acceptDriverTerms(
  id: string,
  input: {
    method: TermsSignatureMethod;
    signerName: string;
    signerDocument: string;
  }
): Promise<DriverApplication | null> {
  if (!input.signerName.trim()) return null;
  const current = await getApplicationById(id);
  const keepApproved = current?.role === 'driver' && current.status === 'approved';
  return patchDriver(id, {
    status: keepApproved ? 'approved' : 'pending',
    termsStatus: 'accepted',
    termsVersion: DRIVER_TERMS_VERSION,
    termsAcceptedAt: new Date().toISOString(),
    termsSignatureMethod: input.method,
    termsSignerName: input.signerName.trim(),
    termsSignerDocument: input.signerDocument.replace(/\D/g, ''),
  });
}

export async function getApplicationById(id: string): Promise<PartnerApplication | null> {
  const list = await loadAll();
  const found = list.find((a) => a.id === id) ?? null;
  if (!found || found.role !== 'merchant') return found;
  return sanitizeMerchantPayment(found);
}

const LOCAL_TEST_MERCHANT_NAMES = new Set(['rap10x']);

function isLocalTestMerchantName(name: string | undefined): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ && LOCAL_TEST_MERCHANT_NAMES.has((name ?? '').trim().toLowerCase());
}

/** Libera loja de teste neste aparelho, sem cobrança no Mercado Pago. */
async function grantLocalTestMerchantAccess(
  app: MerchantApplication
): Promise<MerchantApplication> {
  if (!isLocalTestMerchantName(app.businessName)) return app;
  if (isMerchantPanelUnlocked(app)) return app;
  const until = new Date();
  until.setFullYear(until.getFullYear() + 1);
  const now = new Date().toISOString();
  const updated = await patchMerchant(app.id, {
    plan: app.plan ?? 'essencial',
    paymentStatus: 'paid',
    paymentId: 'teste-sem-cobranca',
    paymentPaidAt: now,
    paymentAmount: 0,
    planPaidUntil: until.toISOString(),
    termsStatus: 'accepted',
    termsVersion: MERCHANT_TERMS_VERSION,
    termsAcceptedAt: now,
    termsSignatureMethod: 'aceite_eletronico',
    termsSignerName: app.ownerName,
    termsSignerDocument: app.document || 'teste',
    status: 'approved',
  });
  return updated ?? app;
}

/** Marca Rap10x (e outras lojas de teste) como assinatura ativa, sem cobrar. */
export async function grantLocalTestMerchants(): Promise<MerchantApplication | null> {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return null;
  const list = await loadAll();
  let unlocked: MerchantApplication | null = null;
  for (const app of list) {
    if (app.role !== 'merchant') continue;
    if (!isLocalTestMerchantName(app.businessName)) continue;
    unlocked = await grantLocalTestMerchantAccess(app);
  }
  return unlocked;
}

/**
 * Limpa “pago” falso (testes antigos / Já paguei) sem vigência real.
 */
async function sanitizeMerchantPayment(
  app: MerchantApplication
): Promise<MerchantApplication> {
  if (isLocalTestMerchantName(app.businessName)) {
    return grantLocalTestMerchantAccess(app);
  }
  if (app.paymentStatus !== 'paid') return app;
  if (app.planPaidUntil) {
    const until = new Date(app.planPaidUntil).getTime();
    if (!Number.isNaN(until) && until > Date.now()) return app;
  }
  // Sem planPaidUntil válido → força cobrança de verdade
  const cleaned = await patchMerchant(app.id, {
    paymentStatus: 'unpaid',
    paymentId: undefined,
    paymentPaidAt: undefined,
    paymentAmount: undefined,
    planPaidUntil: undefined,
    paymentMethod: undefined,
    status: app.termsStatus === 'accepted' ? 'pending' : app.status,
  });
  return cleaned ?? { ...app, paymentStatus: 'unpaid', planPaidUntil: undefined };
}

/** Zera pagamento da assinatura (força nova cobrança cartão/Pix). */
export async function resetMerchantPlanPayment(
  id: string
): Promise<MerchantApplication | null> {
  return patchMerchant(id, {
    paymentStatus: 'unpaid',
    paymentId: undefined,
    paymentPaidAt: undefined,
    paymentAmount: undefined,
    planPaidUntil: undefined,
    paymentMethod: undefined,
    status: 'pending',
  });
}

/** Remove rascunho de comerciante (cadastro incompleto) deste aparelho. */
export async function abandonMerchantApplication(id: string): Promise<boolean> {
  const list = await loadAll();
  const idx = list.findIndex((a) => a.id === id && a.role === 'merchant');
  if (idx < 0) return false;
  const app = list[idx] as MerchantApplication;
  if (isMerchantPanelUnlocked(app)) return false;
  list.splice(idx, 1);
  await saveAll(list);
  try {
    const lastId = await AsyncStorage.getItem(LAST_MERCHANT_KEY);
    if (lastId === id) await AsyncStorage.removeItem(LAST_MERCHANT_KEY);
    await AsyncStorage.removeItem('@pecaja_active_merchant_app');
  } catch {
    /* ignore */
  }
  return true;
}

/** Param de rota Expo (web às vezes manda string[]). */
export function normalizeRouteParam(
  value: string | string[] | undefined | null
): string {
  if (Array.isArray(value)) return String(value[0] || '').trim();
  return String(value || '').trim();
}

/**
 * Resolve o cadastro da loja para telas de plano/pagamento.
 * Usa o id da URL, depois e-mail logado, depois última loja deste aparelho.
 */
export async function resolveMerchantAppForRoute(
  paramId?: string | string[] | null,
  email?: string | null
): Promise<MerchantApplication | null> {
  const id = normalizeRouteParam(paramId);
  if (id) {
    const byId = await getApplicationById(id);
    if (byId?.role === 'merchant') {
      try {
        await AsyncStorage.setItem(LAST_MERCHANT_KEY, byId.id);
      } catch {
        /* ignore */
      }
      return sanitizeMerchantPayment(byId);
    }
  }
  return resolveMerchantApplication(email);
}

export async function resolveMerchantApplication(
  email?: string | null
): Promise<MerchantApplication | null> {
  const ACTIVE_APP_KEY = '@pecaja_active_merchant_app';

  if (email?.trim()) {
    const needle = email.trim().toLowerCase();
    const all = (await loadAll()).filter(
      (a): a is MerchantApplication =>
        a.role === 'merchant' && a.email.trim().toLowerCase() === needle
    );
    if (all.length) {
      try {
        const activeId = await AsyncStorage.getItem(ACTIVE_APP_KEY);
        const preferred =
          (activeId ? all.find((a) => a.id === activeId) : null) ??
          all.find((a) => isMerchantPanelUnlocked(a)) ??
          all[0];
        if (preferred) {
          await AsyncStorage.setItem(LAST_MERCHANT_KEY, preferred.id);
          return sanitizeMerchantPayment(preferred);
        }
      } catch {
        /* fall through */
      }
    }
    const byEmail = await findApplicationByEmail(email, 'merchant');
    if (byEmail?.role === 'merchant') return sanitizeMerchantPayment(byEmail);
    // Com e-mail informado, NÃO usa a última loja do aparelho —
    // evita funcionário abrir o painel do dono por acidente.
    return null;
  }
  try {
    const id = await AsyncStorage.getItem(LAST_MERCHANT_KEY);
    if (!id) return null;
    const found = await getApplicationById(id);
    return found?.role === 'merchant' ? found : null;
  } catch {
    return null;
  }
}

export async function updateDriverApplication(
  id: string,
  patch: Partial<
    Pick<
      DriverApplication,
      | 'name'
      | 'phone'
      | 'vehicle'
      | 'document'
      | 'notes'
      | 'photoUrl'
      | 'bio'
      | 'city'
      | 'cnhNumber'
      | 'cnhCategory'
      | 'cnhExpiry'
      | 'vehicleType'
      | 'plate'
      | 'vehicleBrand'
      | 'vehicleModel'
      | 'vehicleYear'
      | 'vehicleColor'
      | 'renavam'
      | 'password'
    >
  >
): Promise<DriverApplication | null> {
  const cleaned: Partial<DriverApplication> = { ...patch };
  if (patch.name !== undefined) cleaned.name = patch.name.trim();
  if (patch.phone !== undefined) cleaned.phone = patch.phone.trim();
  if (patch.vehicle !== undefined) cleaned.vehicle = patch.vehicle.trim();
  if (patch.document !== undefined) cleaned.document = patch.document.replace(/\D/g, '');
  if (patch.notes !== undefined) cleaned.notes = patch.notes.trim() || undefined;
  if (patch.bio !== undefined) cleaned.bio = patch.bio.trim() || undefined;
  if (patch.photoUrl !== undefined) cleaned.photoUrl = patch.photoUrl.trim() || undefined;
  if (patch.plate !== undefined) cleaned.plate = patch.plate.trim().toUpperCase() || undefined;
  if (patch.vehicleType !== undefined) {
    cleaned.vehicleType = patch.vehicleType;
    cleaned.vehicle = String(patch.vehicleType);
  }
  if (patch.vehicleBrand !== undefined) {
    cleaned.vehicleBrand = patch.vehicleBrand.trim() || undefined;
  }
  if (patch.vehicleModel !== undefined) {
    cleaned.vehicleModel = patch.vehicleModel.trim() || undefined;
  }
  if (patch.vehicleYear !== undefined) {
    cleaned.vehicleYear = patch.vehicleYear.trim() || undefined;
  }
  if (patch.vehicleColor !== undefined) {
    cleaned.vehicleColor = patch.vehicleColor.trim() || undefined;
  }
  if (patch.renavam !== undefined) {
    cleaned.renavam = patch.renavam.trim() || undefined;
  }
  return patchDriver(id, cleaned);
}

/** Garante sessão cloud (token) para puxar aprovação do HQ — re-loga se a sessão caiu. */
async function ensureDriverCloudToken(app: DriverApplication): Promise<string | null> {
  const existing = await getPlatformToken();
  if (existing) {
    const me = await platformMe(existing);
    if (me?.ok && asPlatformUser(me)) return existing;
    await setPlatformToken(null);
  }

  const password = app.password?.trim();
  if (!password) return null;

  const loginRes = await platformLogin(app.email, password);
  const loginToken = loginRes ? asPlatformToken(loginRes) : null;
  if (loginRes?.ok && loginToken) {
    await setPlatformToken(loginToken);
    return loginToken;
  }

  const reg = await platformRegister({
    name: app.name,
    email: app.email,
    phone: app.phone || '',
    password,
    address: app.city || 'A informar',
  });
  const regToken = reg ? asPlatformToken(reg) : null;
  if (reg?.ok && regToken) {
    await setPlatformToken(regToken);
    return regToken;
  }

  // Conta já existe na nuvem mas senha local diverge — tenta login de novo após EXISTS
  if (reg && !reg.ok && reg.code === 'EXISTS') {
    const again = await platformLogin(app.email, password);
    const againToken = again ? asPlatformToken(again) : null;
    if (again?.ok && againToken) {
      await setPlatformToken(againToken);
      return againToken;
    }
  }
  return null;
}

/**
 * Busca o status no HQ e grava no aparelho.
 * Retorna o app atualizado (ou o mesmo se nuvem/offline).
 */
export async function pullDriverStatusFromHq(
  found: DriverApplication
): Promise<DriverApplication> {
  if (found.termsStatus !== 'accepted') return found;
  try {
    const token = await ensureDriverCloudToken(found);
    if (!token) return found;
    const res = await platformSyncDriverApplication(token, {
      id: found.id,
      name: found.name,
      email: found.email,
      phone: found.phone,
      city: found.city,
      document: found.document,
      vehicle: found.vehicle,
      termsStatus: found.termsStatus,
    });
    const remote = (res as { ok?: boolean; application?: { status?: string; id?: string } } | null)
      ?.application;
    const status = remote?.status;
    if (!res?.ok || (status !== 'pending' && status !== 'approved' && status !== 'rejected')) {
      return found;
    }
    if (found.status === status) return found;
    const updated = await setPartnerStatus(found.id, status);
    if (updated?.role === 'driver') {
      await setDriverSession({
        applicationId: found.id,
        email: found.email,
        loggedAt: new Date().toISOString(),
      });
      return updated;
    }
    return found;
  } catch {
    return found;
  }
}

export async function resolveDriverApplication(
  email?: string | null
): Promise<DriverApplication | null> {
  const session = await getDriverSession();
  if (session?.applicationId) {
    const bySession = await getApplicationById(session.applicationId);
    if (bySession?.role === 'driver') return pullDriverStatusFromHq(bySession);
  }

  const lookupEmail = (session?.email || email || '').trim();
  let found: DriverApplication | null = null;
  if (lookupEmail) {
    const byEmail = await findApplicationByEmail(lookupEmail, 'driver');
    if (byEmail?.role === 'driver') found = byEmail;
  }
  if (!found && !session) {
    try {
      const id = await AsyncStorage.getItem(LAST_DRIVER_KEY);
      if (id) {
        const byId = await getApplicationById(id);
        if (byId?.role === 'driver') found = byId;
      }
    } catch {
      found = null;
    }
  }
  if (!found) return null;
  return pullDriverStatusFromHq(found);
}

export async function setMerchantPlan(
  id: string,
  plan: MerchantPlan,
  planCity?: string
): Promise<MerchantApplication | null> {
  const list = await loadAll();
  const current = list.find((a) => a.id === id && a.role === 'merchant') as
    | MerchantApplication
    | undefined;
  if (!current) return null;

  const planChanged = current.plan !== plan;
  // Trocar de plano invalida pagamento/termo do pacote anterior
  if (planChanged && (current.paymentStatus === 'paid' || current.termsStatus === 'accepted')) {
    return patchMerchant(id, {
      plan,
      planCity: planCity?.trim() || undefined,
      paymentStatus: 'unpaid',
      paymentId: undefined,
      paymentPaidAt: undefined,
      paymentAmount: undefined,
      planPaidUntil: undefined,
      paymentMethod: undefined,
      termsStatus: 'pending',
      termsVersion: undefined,
      termsAcceptedAt: undefined,
      termsSignatureMethod: undefined,
      termsSignerName: undefined,
      termsSignerDocument: undefined,
      termsGovBrRef: undefined,
      status: 'pending',
    });
  }

  return patchMerchant(id, {
    plan,
    planCity: planCity?.trim() || undefined,
  });
}

/**
 * Confirma pagamento do plano (gateway).
 * Inicia (ou renova) a competência de PLAN_BILLING_DAYS dias.
 */
export async function confirmMerchantPlanPayment(
  id: string,
  opts?: { paymentId?: string; method?: PlanPaymentMethod }
): Promise<MerchantApplication | null> {
  const list = await loadAll();
  const current = list.find((a) => a.id === id && a.role === 'merchant') as
    | MerchantApplication
    | undefined;
  if (!current?.plan) return null;

  const amount = MERCHANT_PLANS[current.plan].monthlyPrice;
  const paymentId = opts?.paymentId ?? `planpay_${Date.now()}`;
  const now = new Date();
  const currentUntil = current.planPaidUntil ? new Date(current.planPaidUntil) : null;
  const base =
    currentUntil && !Number.isNaN(currentUntil.getTime()) && currentUntil.getTime() > now.getTime()
      ? currentUntil
      : now;

  const updated = await patchMerchant(id, {
    paymentStatus: 'paid',
    paymentId,
    paymentPaidAt: now.toISOString(),
    paymentAmount: amount,
    planPaidUntil: computePlanPaidUntil(base),
    paymentMethod: opts?.method,
  });
  if (!updated) return null;
  try {
    const { getShopByApplicationId, patchShop } = await import('@/utils/merchantShop');
    const shop = await getShopByApplicationId(id);
    if (shop) {
      await patchShop(id, {
        planPaidUntil: updated.planPaidUntil,
        plan: updated.plan || shop.plan,
      });
    }
  } catch {
    /* a loja ainda não existe */
  }
  return maybeUnlockMerchant(updated);
}

export async function acceptMerchantTerms(
  id: string,
  input: {
    method: TermsSignatureMethod;
    signerName: string;
    signerDocument: string;
    govBrRef?: string;
  }
): Promise<MerchantApplication | null> {
  if (!input.signerName.trim()) return null;

  const updated = await patchMerchant(id, {
    termsStatus: 'accepted',
    termsVersion: MERCHANT_TERMS_VERSION,
    termsAcceptedAt: new Date().toISOString(),
    termsSignatureMethod: input.method,
    termsSignerName: input.signerName.trim(),
    termsSignerDocument: input.signerDocument.trim(),
    termsGovBrRef: input.govBrRef?.trim() || undefined,
  });
  if (!updated) return null;
  return maybeUnlockMerchant(updated);
}

/** Libera painel só com assinatura vigente + termo. */
async function maybeUnlockMerchant(app: MerchantApplication): Promise<MerchantApplication> {
  if (isMerchantSubscriptionActive(app) && app.termsStatus === 'accepted' && app.plan) {
    const unlocked = await patchMerchant(app.id, { status: 'approved' });
    return unlocked ?? { ...app, status: 'approved' };
  }
  return app;
}

export async function setPartnerStatus(
  id: string,
  status: PartnerStatus
): Promise<PartnerApplication | null> {
  const list = await loadAll();
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  const updated = { ...list[idx], status, updatedAt: new Date().toISOString() };
  list[idx] = updated;
  await saveAll(list);
  return updated;
}

export function partnerStatusLabel(
  app: MerchantApplication | DriverApplication | { status: PartnerStatus }
): string {
  if ('role' in app && app.role === 'merchant') {
    const gate = merchantOnboardingGate(app);
    if (gate === 'plan') return 'Escolher plano';
    if (gate === 'pay') {
      return app.termsStatus === 'accepted' ? 'Renovar assinatura' : 'Aguardando pagamento';
    }
    if (gate === 'terms') return 'Aguardando termo';
    if (isMerchantPanelUnlocked(app)) return 'Painel liberado';
  }
  if ('role' in app && app.role === 'driver') {
    const gate = driverOnboardingGate(app);
    if (gate === 'terms') return 'Assinar termo';
    if (gate === 'pending') return 'Em análise';
    if (gate === 'rejected') return 'Recusado';
    if (gate === 'ready') return 'Ativo';
  }
  if (app.status === 'approved') return 'Ativo';
  if (app.status === 'rejected') return 'Recusado';
  return 'Em andamento';
}

export function planPaymentLabel(plan: MerchantPlan): string {
  return `${MERCHANT_PLANS[plan].label} · ${formatPlanPrice(MERCHANT_PLANS[plan].monthlyPrice)}`;
}
