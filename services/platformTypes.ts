/**
 * Tipos da plataforma Peça Já (auth, pedidos, lojas, carteira, suporte).
 */
import type { Order, User } from '@/types';
import type { MerchantShop } from '@/utils/merchantShop';
import type { PlatformRole } from '@/services/platformRoles';

export type { PlatformRole };

export type PlatformUser = User & {
  passwordHash: string;
  passwordSalt: string;
};

export type PlatformSession = {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
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
};

export type SupportTicket = {
  id: string;
  userId?: string;
  email: string;
  subject: string;
  body: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  orderId?: string;
  createdAt: string;
  updatedAt: string;
  messages: { at: string; from: 'user' | 'support'; text: string }[];
};

export type PlatformState = {
  revision: number;
  updatedAt: string;
  users: PlatformUser[];
  sessions: PlatformSession[];
  /** Tokens de reset de senha (uso único, TTL curto). */
  passwordResets: {
    email: string;
    token: string;
    expiresAt: string;
  }[];
  orders: Order[];
  shops: MerchantShop[];
  ledger: LedgerEntry[];
  tickets: SupportTicket[];
  /** Threads de chat do pedido: `${orderId}::${peer}` → mensagens */
  chats: Record<string, unknown[]>;
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
      email: string;
      subject: string;
      body: string;
      userId?: string;
      orderId?: string;
    }
  | { action: 'ticket_list'; pin?: string; email?: string }
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
  | { action: 'admin_overview'; token: string }
  | { action: 'admin_list_shops'; token: string }
  | { action: 'admin_shop_detail'; token: string; businessId: string }
  | {
      action: 'admin_list_orders';
      token: string;
      businessId?: string;
      status?: string;
      sinceDays?: number;
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
      /** Break-glass: SUPPORT_PIN + sessão → promove CEO (piloto / sem var). */
      action: 'admin_claim_ceo';
      token: string;
      supportPin: string;
    };

export type PlatformOk = { ok: true; [key: string]: unknown };
export type PlatformErr = { ok: false; code: string; message: string };
export type PlatformResult = PlatformOk | PlatformErr;
