/**
 * Chat do pedido (AsyncStorage + sync na plataforma):
 * - customer ↔ merchant → peer `merchant`
 * - customer ↔ driver ↔ merchant → peer `driver` (mesmo fio)
 *
 * Mensagens ficam salvas após entrega/cancelamento para o dono auditar.
 * Escritas serializadas para não perder mensagem (race read/modify/write).
 * Sync na API para funcionar entre aparelhos (cliente / loja / entregador).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  asPlatformChats,
  platformListChats,
  platformUpsertChatMessage,
} from '@/services/platformClient';
import { getPlatformToken } from '@/services/platformSession';

export type ChatPeer = 'driver' | 'merchant' | 'driver_merchant';
export type ChatSender = 'customer' | 'driver' | 'merchant' | 'system';

export type ChatMessage = {
  id: string;
  orderId: string;
  peer: ChatPeer;
  sender: ChatSender;
  text: string;
  createdAt: string;
  kind?: 'text' | 'item_unavailable' | 'item_replaced' | 'item_removed';
  meta?: {
    lineId?: string;
    itemName?: string;
    replacedWithName?: string;
  };
};

export type MerchantThread = {
  orderId: string;
  peer: 'merchant' | 'driver';
  peerLabel: string;
  peerKind: 'customer' | 'driver';
  lastMessage?: ChatMessage;
  unreadHint: boolean;
  /** Pedido ainda em andamento (não entregue/cancelado). */
  active: boolean;
  orderStatus: string;
};

export type ListMerchantThreadsOpts = {
  /** Inclui pedidos entregues/cancelados que tenham mensagem salva. Default: true */
  includeHistory?: boolean;
};

const KEY = '@pecaja_order_chats';
/** Última msg lida pelo cliente por thread: `${orderId}::${peer}` → messageId */
const CUSTOMER_READ_KEY = '@pecaja_chat_reads_customer';
const DRIVER_READ_KEY = '@pecaja_chat_reads_driver';

type Store = Record<string, ChatMessage[]>;
type ReadMap = Record<string, string>;

export type CustomerChatAlert = {
  orderId: string;
  peer: 'merchant' | 'driver';
  from: 'merchant' | 'driver';
  preview: string;
  createdAt: string;
  label: string;
  messageId: string;
};

export type DriverChatAlert = {
  orderId: string;
  from: 'customer' | 'merchant';
  preview: string;
  createdAt: string;
  messageId: string;
  label: string;
};

function threadKey(orderId: string, peer: ChatPeer) {
  return `${orderId}::${peer}`;
}

function isChatMessage(raw: unknown): raw is ChatMessage {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Partial<ChatMessage>;
  return (
    typeof m.id === 'string' &&
    typeof m.orderId === 'string' &&
    typeof m.text === 'string' &&
    typeof m.createdAt === 'string' &&
    typeof m.sender === 'string'
  );
}

function mergeMessages(a: ChatMessage[], b: ChatMessage[]): ChatMessage[] {
  const byId = new Map<string, ChatMessage>();
  for (const m of [...a, ...b]) {
    if (!m?.id) continue;
    byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort(
    (x, y) => +new Date(x.createdAt) - +new Date(y.createdAt)
  );
}

let lastCloudPullAt = 0;
let cloudPullInFlight: Promise<void> | null = null;

/** Puxa threads da API e mescla no AsyncStorage (entre aparelhos). */
export async function syncChatsFromCloud(orderIds?: string[]): Promise<void> {
  if (orderIds && orderIds.length === 0) return;
  const now = Date.now();
  if (!orderIds?.length && now - lastCloudPullAt < 900 && cloudPullInFlight) {
    return cloudPullInFlight;
  }
  if (!orderIds?.length && now - lastCloudPullAt < 900) return;

  if (cloudPullInFlight) {
    await cloudPullInFlight;
    if (!orderIds?.length && Date.now() - lastCloudPullAt < 900) return;
  }

  lastCloudPullAt = Date.now();
  cloudPullInFlight = (async () => {
    try {
      const token = await getPlatformToken();
      const res = await platformListChats(
        orderIds?.length ? { orderIds, token } : { token }
      );
      const remote = asPlatformChats(res);
      const keys = Object.keys(remote);
      if (!keys.length) return;

      await enqueueWrite(async () => {
        const store = await loadStoreLocal();
        let changed = false;
        for (const key of keys) {
          const remoteList = (remote[key] || [])
            .filter(isChatMessage)
            .map((m) => ({
              ...m,
              peer: resolveChatPeer((m.peer as ChatPeer) || 'merchant'),
            }));
          if (!remoteList.length) continue;
          const next = mergeMessages(store[key] ?? [], remoteList);
          if (
            next.length !== (store[key]?.length ?? 0) ||
            next[next.length - 1]?.id !== store[key]?.[store[key].length - 1]?.id
          ) {
            store[key] = next;
            changed = true;
          }
        }
        if (changed) await saveStore(store);
      });
    } catch {
      /* API offline — fica no local */
    } finally {
      cloudPullInFlight = null;
    }
  })();

  return cloudPullInFlight;
}

function pushMessageToCloud(orderId: string, peer: ChatPeer, message: ChatMessage) {
  const key = threadKey(orderId, resolveChatPeer(peer));
  void getPlatformToken().then((token) => {
    if (!token) return;
    void platformUpsertChatMessage(key, { ...message }, token).catch(() => undefined);
  });
}

async function loadCustomerReads(): Promise<ReadMap> {
  try {
    const raw = await AsyncStorage.getItem(CUSTOMER_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveCustomerReads(map: ReadMap) {
  await AsyncStorage.setItem(CUSTOMER_READ_KEY, JSON.stringify(map));
}

async function loadDriverReads(): Promise<ReadMap> {
  try {
    const raw = await AsyncStorage.getItem(DRIVER_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveDriverReads(map: ReadMap) {
  await AsyncStorage.setItem(DRIVER_READ_KEY, JSON.stringify(map));
}

/** Marca o chat como lido até a mensagem informada (ou a última). */
export async function markCustomerThreadRead(
  orderId: string,
  peer: ChatPeer,
  lastMessageId?: string
): Promise<void> {
  const p = resolveChatPeer(peer);
  if (p !== 'merchant' && p !== 'driver') return;

  let msgId = lastMessageId;
  if (!msgId) {
    const list = await loadChat(orderId, p);
    msgId = list[list.length - 1]?.id;
  }
  if (!msgId) return;

  const map = await loadCustomerReads();
  map[threadKey(orderId, p)] = msgId;
  await saveCustomerReads(map);
}

/** Marca o chat da entrega como lido pelo motoboy. */
export async function markDriverThreadRead(
  orderId: string,
  lastMessageId?: string
): Promise<void> {
  let msgId = lastMessageId;
  if (!msgId) {
    const list = await loadChat(orderId, 'driver');
    msgId = list[list.length - 1]?.id;
  }
  if (!msgId) return;
  const map = await loadDriverReads();
  map[threadKey(orderId, 'driver')] = msgId;
  await saveDriverReads(map);
}

function isUnreadForCustomer(msg: ChatMessage | undefined): msg is ChatMessage {
  if (!msg) return false;
  return msg.sender === 'merchant' || msg.sender === 'driver';
}

/**
 * Alertas de chat para o cliente: loja ou entregador mandaram algo
 * que ainda não foi aberto.
 */
export async function listCustomerChatAlerts(
  orders: {
    id: string;
    status: string;
    businessName: string;
    driverName?: string;
  }[]
): Promise<CustomerChatAlert[]> {
  await syncChatsFromCloud(orders.map((o) => o.id));
  const store = await loadStoreLocal();
  const reads = await loadCustomerReads();
  const active = orders.filter(
    (o) => o.status !== 'cancelado' && o.status !== 'entregue'
  );
  const alerts: CustomerChatAlert[] = [];

  for (const order of active) {
    const peers: Array<'merchant' | 'driver'> = order.driverName
      ? ['merchant', 'driver']
      : ['merchant'];

    for (const peer of peers) {
      const key = threadKey(order.id, peer);
      let msgs = store[key] ?? [];
      if (peer === 'driver' && msgs.length === 0) {
        msgs = store[threadKey(order.id, 'driver_merchant')] ?? [];
      }
      const last = msgs[msgs.length - 1];
      if (!isUnreadForCustomer(last)) continue;
      if (reads[key] === last.id) continue;

      alerts.push({
        orderId: order.id,
        peer,
        from: last.sender === 'driver' ? 'driver' : 'merchant',
        preview: last.text,
        createdAt: last.createdAt,
        label:
          last.sender === 'driver'
            ? order.driverName ?? 'Entregador'
            : order.businessName,
        messageId: last.id,
      });
    }
  }

  alerts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return alerts;
}

/**
 * Alertas para o entregador: cliente ou loja mandaram no chat da entrega.
 */
export async function listDriverChatAlerts(
  orders: {
    id: string;
    status: string;
    businessName: string;
    customerName?: string;
  }[]
): Promise<DriverChatAlert[]> {
  await syncChatsFromCloud(orders.map((o) => o.id));
  const store = await loadStoreLocal();
  const reads = await loadDriverReads();
  const active = orders.filter(
    (o) => o.status !== 'cancelado' && o.status !== 'entregue'
  );
  const alerts: DriverChatAlert[] = [];

  for (const order of active) {
    const key = threadKey(order.id, 'driver');
    let msgs = store[key] ?? [];
    if (msgs.length === 0) {
      msgs = store[threadKey(order.id, 'driver_merchant')] ?? [];
    }
    const last = msgs[msgs.length - 1];
    if (!last || (last.sender !== 'customer' && last.sender !== 'merchant')) continue;
    if (reads[key] === last.id) continue;

    alerts.push({
      orderId: order.id,
      from: last.sender,
      preview: last.text,
      createdAt: last.createdAt,
      messageId: last.id,
      label:
        last.sender === 'customer'
          ? order.customerName || 'Cliente'
          : order.businessName,
    });
  }

  alerts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return alerts;
}

/** Motoboy: loja e cliente usam o mesmo peer `driver`. */
export function resolveChatPeer(peer: ChatPeer): ChatPeer {
  if (peer === 'driver_merchant') return 'driver';
  return peer;
}

async function loadStoreLocal(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveStore(store: Store) {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}

/** Fila de escrita — evita sobrescrever mensagens. */
let writeChain: Promise<unknown> = Promise.resolve();

function enqueueWrite<T>(fn: () => Promise<T>): Promise<T> {
  const next = writeChain.then(fn, fn);
  writeChain = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function newMsgId() {
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadChat(orderId: string, peer: ChatPeer): Promise<ChatMessage[]> {
  const p = resolveChatPeer(peer);
  await syncChatsFromCloud([orderId]);
  const store = await loadStoreLocal();
  const primary = store[threadKey(orderId, p)] ?? [];

  // Migra threads antigas driver_merchant → driver
  if (p === 'driver') {
    const legacy = store[threadKey(orderId, 'driver_merchant')] ?? [];
    if (legacy.length && primary.length === 0) {
      return legacy.map((m) => ({ ...m, peer: 'driver' as const }));
    }
    if (legacy.length && primary.length) {
      const byId = new Map<string, ChatMessage>();
      for (const m of [...legacy, ...primary]) {
        byId.set(m.id, { ...m, peer: 'driver' });
      }
      return Array.from(byId.values()).sort(
        (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
      );
    }
  }
  return primary;
}

async function appendMessage(
  orderId: string,
  peer: ChatPeer,
  message: ChatMessage
): Promise<ChatMessage[]> {
  const p = resolveChatPeer(peer);
  return enqueueWrite(async () => {
    const store = await loadStoreLocal();
    const key = threadKey(orderId, p);
    const prev = store[key] ?? [];
    // Evita duplicar se a mesma msg já existir
    if (prev.some((m) => m.id === message.id)) {
      return prev;
    }
    const saved = { ...message, peer: p, orderId };
    const list = [...prev, saved];
    store[key] = list;
    // Limpa legado após migrar
    if (p === 'driver') {
      delete store[threadKey(orderId, 'driver_merchant')];
    }
    await saveStore(store);
    pushMessageToCloud(orderId, p, saved);
    return list;
  });
}

export async function ensureWelcomeMessages(opts: {
  orderId: string;
  peer: ChatPeer;
  peerName: string;
  businessName: string;
  pickupCode?: string;
}): Promise<ChatMessage[]> {
  const p = resolveChatPeer(opts.peer);

  return enqueueWrite(async () => {
    await syncChatsFromCloud([opts.orderId]);
    const store = await loadStoreLocal();
    const key = threadKey(opts.orderId, p);
    let existing = store[key] ?? [];

    if (p === 'driver') {
      const legacy = store[threadKey(opts.orderId, 'driver_merchant')] ?? [];
      if (legacy.length) {
        const byId = new Map<string, ChatMessage>();
        for (const m of [...legacy, ...existing]) {
          byId.set(m.id, { ...m, peer: 'driver' });
        }
        existing = Array.from(byId.values()).sort(
          (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)
        );
        store[key] = existing;
        delete store[threadKey(opts.orderId, 'driver_merchant')];
        await saveStore(store);
      }
    }

    if (existing.length > 0) return existing;

    const now = Date.now();
    const pickupHint =
      opts.pickupCode && p === 'driver'
        ? ` Seu código de RETIRADA no comércio é ${opts.pickupCode} — mostre para a loja liberar o pedido.`
        : '';

    const welcome: ChatMessage =
      p === 'driver'
        ? {
            id: `m_${now}_w`,
            orderId: opts.orderId,
            peer: 'driver',
            sender: 'system',
            text: `Chat da entrega · ${opts.peerName} (motoboy), cliente e loja (${opts.businessName}).${pickupHint}`,
            createdAt: new Date(now).toISOString(),
          }
        : {
            id: `m_${now}_w`,
            orderId: opts.orderId,
            peer: 'merchant',
            sender: 'system',
            text: `Chat da loja ${opts.businessName} com o cliente · pedido #${opts.orderId.slice(-6).toUpperCase()}.`,
            createdAt: new Date(now).toISOString(),
          };

    const list = [welcome];
    store[key] = list;
    await saveStore(store);
    pushMessageToCloud(opts.orderId, p, welcome);
    return list;
  });
}

export async function sendCustomerMessage(opts: {
  orderId: string;
  peer: ChatPeer;
  text: string;
}): Promise<ChatMessage[]> {
  const text = opts.text.trim();
  const p = resolveChatPeer(opts.peer);
  if (!text) return loadChat(opts.orderId, p);

  const msg: ChatMessage = {
    id: newMsgId(),
    orderId: opts.orderId,
    peer: p,
    sender: 'customer',
    text,
    createdAt: new Date().toISOString(),
  };
  return appendMessage(opts.orderId, p, msg);
}

/** Comércio envia mensagem (cliente ou motoboy). */
export async function sendMerchantMessage(opts: {
  orderId: string;
  peer: ChatPeer;
  text: string;
}): Promise<ChatMessage[]> {
  const text = opts.text.trim();
  const p = resolveChatPeer(opts.peer);
  if (!text) return loadChat(opts.orderId, p);

  const msg: ChatMessage = {
    id: newMsgId(),
    orderId: opts.orderId,
    peer: p,
    sender: 'merchant',
    text,
    createdAt: new Date().toISOString(),
  };
  return appendMessage(opts.orderId, p, msg);
}

/** Motoboy envia (painel ou simulação). */
export async function sendDriverMessage(opts: {
  orderId: string;
  peer?: ChatPeer;
  text: string;
}): Promise<ChatMessage[]> {
  const text = opts.text.trim();
  const p = resolveChatPeer(opts.peer ?? 'driver');
  if (!text) return loadChat(opts.orderId, p);

  const msg: ChatMessage = {
    id: newMsgId(),
    orderId: opts.orderId,
    peer: p === 'merchant' ? 'driver' : p,
    sender: 'driver',
    text,
    createdAt: new Date().toISOString(),
  };
  return appendMessage(opts.orderId, msg.peer, msg);
}

export async function appendSystemMessage(opts: {
  orderId: string;
  peer?: ChatPeer;
  text: string;
  kind?: ChatMessage['kind'];
  meta?: ChatMessage['meta'];
}): Promise<ChatMessage[]> {
  const peer = resolveChatPeer(opts.peer ?? 'merchant');
  const msg: ChatMessage = {
    id: newMsgId(),
    orderId: opts.orderId,
    peer,
    sender: 'system',
    text: opts.text.trim(),
    createdAt: new Date().toISOString(),
    kind: opts.kind ?? 'text',
    meta: opts.meta,
  };
  return appendMessage(opts.orderId, peer, msg);
}

export function chatFingerprint(list: ChatMessage[]): string {
  if (!list.length) return '0';
  const last = list[list.length - 1];
  return `${list.length}:${last.id}:${last.createdAt}`;
}

const MERCHANT_CHAT_READ_KEY = '@pecaja_chat_reads_merchant';

type MerchantReadMap = Record<string, string>;

async function loadMerchantReads(): Promise<MerchantReadMap> {
  try {
    const raw = await AsyncStorage.getItem(MERCHANT_CHAT_READ_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function saveMerchantReads(map: MerchantReadMap) {
  await AsyncStorage.setItem(MERCHANT_CHAT_READ_KEY, JSON.stringify(map));
}

/** Marca thread como lida pelo comércio (até a última msg). */
export async function markMerchantThreadRead(
  orderId: string,
  peer: ChatPeer,
  lastMessageId?: string
): Promise<void> {
  const p = resolveChatPeer(peer);
  let msgId = lastMessageId;
  if (!msgId) {
    const list = await loadChat(orderId, p);
    msgId = list[list.length - 1]?.id;
  }
  if (!msgId) return;
  const map = await loadMerchantReads();
  map[threadKey(orderId, p)] = msgId;
  await saveMerchantReads(map);
}

export type MerchantChatAlert = {
  orderId: string;
  peer: 'merchant' | 'driver';
  from: 'customer' | 'driver';
  preview: string;
  createdAt: string;
  messageId: string;
};

function merchantUnreadFromLast(
  last: ChatMessage | undefined,
  reads: MerchantReadMap,
  key: string
): boolean {
  if (!last) return false;
  if (last.sender !== 'customer' && last.sender !== 'driver') return false;
  return reads[key] !== last.id;
}

function threadMsgs(
  store: Store,
  orderId: string,
  peer: 'merchant' | 'driver'
): ChatMessage[] {
  const key = threadKey(orderId, peer);
  let msgs = store[key] ?? [];
  if (peer === 'driver' && msgs.length === 0) {
    msgs = store[threadKey(orderId, 'driver_merchant')] ?? [];
  }
  return msgs;
}

/**
 * Mensagens do cliente ou entregador ainda não vistas pelo comércio
 * (chat loja↔cliente e chat da entrega).
 */
export async function listMerchantChatAlerts(
  orders: { id: string; status: string; driverName?: string }[]
): Promise<MerchantChatAlert[]> {
  await syncChatsFromCloud(orders.map((o) => o.id));
  const store = await loadStoreLocal();
  const reads = await loadMerchantReads();
  const active = orders.filter(
    (o) => o.status !== 'cancelado' && o.status !== 'entregue'
  );
  const alerts: MerchantChatAlert[] = [];

  for (const order of active) {
    const peers: Array<'merchant' | 'driver'> = order.driverName
      ? ['merchant', 'driver']
      : ['merchant'];

    for (const peer of peers) {
      const key = threadKey(order.id, peer);
      const msgs = threadMsgs(store, order.id, peer);
      const last = msgs[msgs.length - 1];
      if (!last || (last.sender !== 'customer' && last.sender !== 'driver')) continue;
      if (reads[key] === last.id) continue;

      alerts.push({
        orderId: order.id,
        peer,
        from: last.sender,
        preview: last.text,
        createdAt: last.createdAt,
        messageId: last.id,
      });
    }
  }

  alerts.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  return alerts;
}

/** Quantidade de threads com mensagem não lida (cliente ou entregador). */
export async function countMerchantUnread(
  orders: { id: string; status: string; driverName?: string }[]
): Promise<number> {
  const alerts = await listMerchantChatAlerts(orders);
  return alerts.length;
}

/**
 * Lista conversas do painel do comércio.
 * Pedidos ativos sempre entram; histórico (entregue/cancelado) só se houver mensagem salva.
 */
export async function listMerchantThreads(
  orders: {
    id: string;
    status: string;
    driverName?: string;
    businessName: string;
  }[],
  opts?: ListMerchantThreadsOpts
): Promise<MerchantThread[]> {
  await syncChatsFromCloud(orders.map((o) => o.id));
  const includeHistory = opts?.includeHistory !== false;
  const store = await loadStoreLocal();
  const reads = await loadMerchantReads();
  const threads: MerchantThread[] = [];

  for (const order of orders) {
    const isClosed = order.status === 'cancelado' || order.status === 'entregue';
    const active = !isClosed;

    const custMsgs = threadMsgs(store, order.id, 'merchant');
    const lastCust = custMsgs[custMsgs.length - 1];
    const custKey = threadKey(order.id, 'merchant');

    const drvMsgs = threadMsgs(store, order.id, 'driver');
    const lastDrv = drvMsgs[drvMsgs.length - 1];
    const hasDriverThread = !!order.driverName || drvMsgs.length > 0;

    if (isClosed) {
      if (!includeHistory) continue;
      // Histórico: só threads com conversa salva (segurança / auditoria).
      if (custMsgs.length > 0) {
        threads.push({
          orderId: order.id,
          peer: 'merchant',
          peerKind: 'customer',
          peerLabel: 'Cliente',
          lastMessage: lastCust,
          unreadHint: merchantUnreadFromLast(lastCust, reads, custKey),
          active: false,
          orderStatus: order.status,
        });
      }
      if (hasDriverThread && drvMsgs.length > 0) {
        threads.push({
          orderId: order.id,
          peer: 'driver',
          peerKind: 'driver',
          peerLabel: order.driverName || 'Motoboy',
          lastMessage: lastDrv,
          unreadHint: merchantUnreadFromLast(lastDrv, reads, threadKey(order.id, 'driver')),
          active: false,
          orderStatus: order.status,
        });
      }
      continue;
    }

    threads.push({
      orderId: order.id,
      peer: 'merchant',
      peerKind: 'customer',
      peerLabel: 'Cliente',
      lastMessage: lastCust,
      unreadHint: merchantUnreadFromLast(lastCust, reads, custKey),
      active: true,
      orderStatus: order.status,
    });

    if (hasDriverThread) {
      threads.push({
        orderId: order.id,
        peer: 'driver',
        peerKind: 'driver',
        peerLabel: order.driverName || 'Motoboy',
        lastMessage: lastDrv,
        unreadHint: merchantUnreadFromLast(lastDrv, reads, threadKey(order.id, 'driver')),
        active: true,
        orderStatus: order.status,
      });
    }
  }

  threads.sort((a, b) => {
    if (a.unreadHint !== b.unreadHint) return a.unreadHint ? -1 : 1;
    if (a.active !== b.active) return a.active ? -1 : 1;
    const ta = a.lastMessage ? +new Date(a.lastMessage.createdAt) : 0;
    const tb = b.lastMessage ? +new Date(b.lastMessage.createdAt) : 0;
    return tb - ta;
  });

  return threads;
}
