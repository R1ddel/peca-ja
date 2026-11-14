/**
 * Tipos da plataforma Peça Já (auth, pedidos, lojas, carteira, suporte, Command Center).
 */
import type { Order, User } from '@/types';
import type { MerchantShop } from '@/utils/merchantShop';
import type { PlatformRole } from '@/services/platformRoles';
import type { HqProblemCase } from '@/services/hqProblems';

export type { PlatformRole };

export type PlatformUser = User & {
  passwordHash: string;
  passwordSalt: string;
  /** Bloqueio HQ do cliente/conta. */
  blocked?: boolean;
  blockedReason?: string;
  blockedAt?: string;
};

export type PlatformSession = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

/** Chave Pix de qualquer banco, usada no repasse do gateway. */
export type PayoutProfile = {
  ownerType: 'merchant' | 'driver';
  ownerId: string;
  pixKey: string;
  pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  holderName: string;
  document: string;
  updatedAt: string;
};

export type LedgerEntry = {
  id: string;
  ownerType: 'merchant' | 'driver' | 'platform';
  ownerId: string;
  orderId?: string;
  kind: 'credit' | 'debit' | 'withdraw' | 'adjust';
  amount: number;
  note: string;
  createdAt: string;
  /** Quem gerou o lançamento (HQ). */
  actorUserId?: string;
};

export type SupportTicket = {
  id: string;
  userId?: string;
  email: string;
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority?: 'low' | 'normal' | 'high' | 'critical';
  category?: string;
  assigneeUserId?: string;
  orderId?: string;
  createdAt: string;
  updatedAt: string;
  messages: { at: string; from: 'user' | 'support'; text: string }[];
};

/** Audit log append-only do Command Center. */
export type AuditLogEntry = {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string;
  ip?: string;
  result: 'success' | 'failure';
  createdAt: string;
};

export type PartnerApplicationRecord = {
  id: string;
  role: 'merchant' | 'driver';
  status: 'pending' | 'approved' | 'rejected' | 'lead' | 'contact' | 'interested' | 'meeting' | 'proposal' | 'negotiation' | 'contract' | 'registered' | 'active';
  pipelineStage?: string;
  city?: string;
  name: string;
  email: string;
  phone: string;
  businessName?: string;
  document?: string;
  notes?: string;
  ownerUserId?: string;
  assigneeUserId?: string;
  followUpAt?: string;
  tags?: string[];
  timeline?: { at: string; text: string; actorId?: string }[];
  createdAt: string;
  updatedAt: string;
  raw?: Record<string, unknown>;
};

/** Cobrança de plano mensal (Mercado Pago direto — sem gateway de pedido). */
export type PlanPaymentRecord = {
  id: string;
  applicationId: string;
  plan: 'essencial' | 'crescimento' | 'destaque';
  amount: number;
  method: 'pix' | 'card';
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  externalReference: string;
  createdAt: string;
  paidAt?: string;
  ownerUserId?: string;
  businessName?: string;
};

export type PlatformCity = {
  id: string;
  name: string;
  state: string;
  status: 'active' | 'implanting' | 'inactive';
  latitude?: number;
  longitude?: number;
  serviceRadiusKm?: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformCoupon = {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  cityId?: string;
  active: boolean;
  maxUses?: number;
  usedCount: number;
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
  updatedAt: string;
  note?: string;
};

export type PlatformCampaign = {
  id: string;
  name: string;
  channel: 'push' | 'email' | 'in_app';
  segment: string;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  body: string;
  cityId?: string;
  scheduledAt?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  scope: 'global' | 'city' | 'percent';
  cityId?: string;
  percent?: number;
  note?: string;
  updatedAt: string;
  updatedBy?: string;
};

export type SystemLogEntry = {
  id: string;
  level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  service: string;
  message: string;
  meta?: Record<string, unknown>;
  requestId?: string;
  createdAt: string;
};

export type PlatformIncident = {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  impact?: string;
  cause?: string;
  solution?: string;
  ownerUserId?: string;
  startedAt: string;
  resolvedAt?: string;
  updatedAt: string;
};

export type PlatformReview = {
  id: string;
  targetType: 'business' | 'driver' | 'order';
  targetId: string;
  userId?: string;
  rating: number;
  comment?: string;
  hidden?: boolean;
  hiddenReason?: string;
  createdAt: string;
};

export type PlatformState = {
  revision: number;
  updatedAt: string;
  users: PlatformUser[];
  sessions: PlatformSession[];
  passwordResets: {
    email: string;
    /** SHA-256 do código; nunca o valor em claro. */
    tokenHash?: string;
    /** @deprecated plaintext legado — ignorado. */
    token?: string;
    expiresAt: string;
    usedAt?: string;
    attempts?: number;
  }[];
  orders: Order[];
  shops: MerchantShop[];
  ledger: LedgerEntry[];
  /** Chaves Pix da loja e do entregador para o repasse do gateway. */
  payoutProfiles?: PayoutProfile[];
  tickets: SupportTicket[];
  chats: Record<string, unknown[]>;
  /** Command Center */
  auditLogs: AuditLogEntry[];
  applications: PartnerApplicationRecord[];
  /** Assinaturas mensais (Pix/cartão direto na conta MP). Pedidos não entram. */
  planPayments?: PlanPaymentRecord[];
  cities: PlatformCity[];
  coupons: PlatformCoupon[];
  campaigns: PlatformCampaign[];
  featureFlags: FeatureFlag[];
  systemLogs: SystemLogEntry[];
  incidents: PlatformIncident[];
  reviews: PlatformReview[];
  problemCases?: HqProblemCase[];
};

export type AuthPublicUser = Omit<PlatformUser, 'passwordHash' | 'passwordSalt'>;

export type PlatformAction =
  | { action: 'health' }
  | {
      action: 'register';
      name: string;
      email: string;
      phone: string;
      password: string;
      address: string;
    }
  | { action: 'login'; email: string; password: string }
  | { action: 'me'; token: string }
  | { action: 'logout'; token: string }
  | { action: 'request_password_reset'; email: string }
  | {
      action: 'reset_password';
      email: string;
      newPassword: string;
      resetToken: string;
    }
  | { action: 'update_profile'; token: string; patch: Partial<User> }
  | {
      action: 'sync_driver_application';
      token: string;
      application: {
        id: string;
        name: string;
        email: string;
        phone: string;
        city?: string;
        document?: string;
        vehicle?: string;
        termsStatus?: string;
      };
    }
  | { action: 'list_orders'; token: string; userId?: string; businessId?: string }
  | { action: 'upsert_order'; token: string; order: Order }
  | { action: 'sync_orders'; token: string; orders: Order[] }
  | { action: 'get_order'; token: string; id: string }
  | { action: 'list_shops' }
  | { action: 'upsert_shop'; token: string; shop: MerchantShop }
  | {
      action: 'ledger_list';
      token: string;
      ownerType: LedgerEntry['ownerType'];
      ownerId: string;
    }
  | {
      action: 'ledger_post';
      token: string;
      entry: Omit<LedgerEntry, 'id' | 'createdAt'> & { id?: string; createdAt?: string };
    }
  | {
      action: 'ticket_create';
      token: string;
      email?: string;
      subject: string;
      body: string;
      userId?: string;
      orderId?: string;
    }
  | { action: 'ticket_list'; pin?: string; email?: string; token?: string }
  | {
      action: 'ticket_update';
      pin: string;
      id: string;
      status?: SupportTicket['status'];
      reply?: string;
    }
  | {
      action: 'upsert_chat_message';
      token: string;
      threadKey: string;
      message: Record<string, unknown>;
    }
  | {
      action: 'sync_chats';
      token: string;
      chats: Record<string, unknown[]>;
    }
  | { action: 'list_chats'; token: string; orderIds?: string[] }
  | { action: 'admin_overview'; token: string; hqMode?: 'real' | 'projection' }
  | { action: 'admin_list_shops'; token: string }
  | { action: 'admin_shop_detail'; token: string; businessId: string }
  | {
      action: 'admin_list_orders';
      token: string;
      businessId?: string;
      status?: string;
      sinceDays?: number;
      q?: string;
      city?: string;
    }
  | {
      action: 'admin_order_detail';
      token: string;
      orderId: string;
    }
  | {
      action: 'admin_set_shop_status';
      token: string;
      businessId: string;
      status: 'active' | 'suspended';
      reason?: string;
    }
  | { action: 'admin_list_staff'; token: string }
  | {
      action: 'admin_set_staff_role';
      token: string;
      userId: string;
      role: PlatformRole | null;
    }
  | { action: 'admin_ticket_list'; token: string }
  | {
      action: 'admin_ticket_update';
      token: string;
      id: string;
      status?: SupportTicket['status'];
      reply?: string;
    }
  | {
      action: 'admin_claim_ceo';
      token: string;
      supportPin: string;
    }
  | {
      action: 'admin_list_customers';
      token: string;
      q?: string;
      city?: string;
      blocked?: boolean;
      limit?: number;
    }
  | { action: 'admin_customer_detail'; token: string; userId: string }
  | {
      action: 'admin_set_user_block';
      token: string;
      userId: string;
      blocked: boolean;
      reason?: string;
    }
  | {
      action: 'admin_audit_list';
      token: string;
      q?: string;
      entityType?: string;
      limit?: number;
    }
  | { action: 'admin_health'; token: string }
  | {
      action: 'admin_search';
      token: string;
      q: string;
    }
  | {
      action: 'admin_ops_now';
      token: string;
      hqMode?: 'real' | 'projection';
    }
  | {
      action: 'admin_finance_overview';
      token: string;
      sinceDays?: number;
      hqMode?: 'real' | 'projection';
    }
  | {
      action: 'admin_ledger_list';
      token: string;
      ownerType?: LedgerEntry['ownerType'];
      ownerId?: string;
      limit?: number;
    }
  | {
      action: 'admin_ledger_adjust';
      token: string;
      ownerType: LedgerEntry['ownerType'];
      ownerId: string;
      amount: number;
      kind: 'credit' | 'debit' | 'adjust';
      note: string;
      reason: string;
    }
  | {
      action: 'admin_list_applications';
      token: string;
      role?: 'merchant' | 'driver';
      status?: string;
    }
  | {
      action: 'admin_upsert_application';
      token: string;
      application: Partial<PartnerApplicationRecord> & { id?: string; role: 'merchant' | 'driver'; name: string; email: string; phone: string };
    }
  | {
      action: 'admin_set_application_status';
      token: string;
      id: string;
      status: PartnerApplicationRecord['status'];
      reason?: string;
      pipelineStage?: string;
    }
  | { action: 'admin_list_cities'; token: string }
  | {
      action: 'admin_upsert_city';
      token: string;
      city: Partial<PlatformCity> & { id?: string; name: string; state: string };
    }
  | {
      action: 'admin_set_city_status';
      token: string;
      id: string;
      status: PlatformCity['status'];
      reason?: string;
    }
  | { action: 'admin_list_coupons'; token: string }
  | {
      action: 'admin_upsert_coupon';
      token: string;
      coupon: Partial<PlatformCoupon> & { code: string; type: 'percent' | 'fixed'; value: number };
    }
  | { action: 'admin_list_campaigns'; token: string }
  | {
      action: 'admin_upsert_campaign';
      token: string;
      campaign: Partial<PlatformCampaign> & { name: string; channel: PlatformCampaign['channel']; segment: string; body: string };
    }
  | { action: 'admin_list_flags'; token: string }
  | {
      action: 'admin_set_flag';
      token: string;
      flag: Partial<FeatureFlag> & { key: string };
      reason?: string;
    }
  | {
      action: 'admin_list_system_logs';
      token: string;
      level?: SystemLogEntry['level'];
      service?: string;
      limit?: number;
    }
  | {
      action: 'admin_append_system_log';
      token: string;
      entry: Omit<SystemLogEntry, 'id' | 'createdAt'> & { id?: string };
    }
  | { action: 'admin_list_incidents'; token: string }
  | {
      action: 'admin_upsert_incident';
      token: string;
      incident: Partial<PlatformIncident> & { title: string; severity: PlatformIncident['severity']; service: string };
    }
  | { action: 'admin_data_quality'; token: string }
  | { action: 'admin_list_reviews'; token: string; hidden?: boolean }
  | {
      action: 'admin_moderate_review';
      token: string;
      id: string;
      hidden: boolean;
      reason?: string;
    }
  | {
      action: 'admin_list_products';
      token: string;
      q?: string;
      businessId?: string;
      limit?: number;
    }
  | {
      action: 'admin_set_product_available';
      token: string;
      businessId: string;
      productId: string;
      available: boolean;
      reason?: string;
    }
  | {
      action: 'admin_export_audit';
      token: string;
      kind: 'customers' | 'orders' | 'ledger' | 'audit';
      sinceDays?: number;
    }
  | { action: 'admin_reports'; token: string; sinceDays?: number }
  | {
      action: 'admin_problems_now';
      token: string;
      hqMode?: 'real' | 'projection';
      severity?: string;
      sla?: string;
    }
  | {
      action: 'admin_problem_detail';
      token: string;
      orderId: string;
      hqMode?: 'real' | 'projection';
    }
  | {
      action: 'admin_problem_action';
      token: string;
      orderId: string;
      problemAction: string;
      message?: string;
      rootCause?: string;
      rootCauseNote?: string;
      reason?: string;
      hqMode?: 'real' | 'projection';
    }
  | {
      action: 'admin_intelligence';
      token: string;
      hqMode?: 'real' | 'projection';
      sinceDays?: number;
    }
  | {
      action: 'sync_partner_application';
      token?: string;
      application: PartnerApplicationRecord;
    };

export type PlatformOk = { ok: true; [key: string]: unknown };
export type PlatformErr = { ok: false; code: string; message: string };
export type PlatformResult = PlatformOk | PlatformErr;
