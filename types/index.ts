import { BusinessCategory, OrderStatus } from '@/constants/theme';
import { MerchantPlan } from '@/constants/plans';
import type { ShopPaymentMethod } from '@/utils/paymentMethods';
import type { ShopDeliveryMode } from '@/utils/shopDelivery';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  photoUrl?: string | null;
  /** Foto de capa do perfil (plano de fundo). */
  coverUrl?: string | null;
  /** Biografia pública do cliente. */
  bio?: string | null;
  /** Papel HQ Peça Já (painel /admin). null/undefined = cliente. */
  platformRole?:
    | 'ceo'
    | 'ops'
    | 'admin'
    | 'finance'
    | 'support'
    | 'commercial'
    | 'marketing'
    | 'operations'
    | 'auditor'
    | null;
  /** Conta bloqueada pelo Command Center. */
  blocked?: boolean;
  blockedReason?: string | null;
  blockedAt?: string | null;
  createdAt: string;
}

export interface MenuAddon {
  id: string;
  name: string;
  price: number;
}

export interface MenuAddonGroup {
  id: string;
  name: string;
  /** Se true, o cliente precisa escolher ao menos 1 opção. */
  required?: boolean;
  /** Máximo de opções selecionáveis no grupo (1 = escolha única). */
  maxSelect?: number;
  options: MenuAddon[];
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  /** Texto longo na galeria (toque na foto). */
  details?: string;
  price: number;
  image: string;
  /** Fotos extras do prato (galeria). Sempre inclui a capa. */
  images?: string[];
  category: string;
  popular?: boolean;
  promo?: number;
  addonGroups?: MenuAddonGroup[];
  /** false = pausado no painel (some do cardápio do cliente). */
  available?: boolean;
  /**
   * true = aparece no hub Conveniência (mesmo se a loja for mercado/farmácia/etc.).
   * Lojas da categoria `conveniencia` listam o cardápio inteiro no hub.
   */
  convenience?: boolean;
}

export interface Business {
  id: string;
  name: string;
  description: string;
  category: BusinessCategory;
  image: string;
  coverImage: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  distance: string;
  /** Distância numérica (km) quando calculada por GPS. */
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  /** Raio de atendimento em km (parceiros). */
  serviceRadiusKm?: number;
  isOpen: boolean;
  /** Ex.: "08:00–22:00" */
  hours?: string;
  tags: string[];
  menu: MenuItem[];
  /** Restaurantes (e similares) que oferecem bebidas no cardápio. */
  sellsDrinks?: boolean;
  /** Pacote de assinatura do comércio no Peça Já. */
  plan: MerchantPlan;
  /** Métodos que esta loja aceita. Ausente = Pix e cartão. */
  acceptedPayments?: ShopPaymentMethod[];
  /** store = entregador da loja. app = motoboy da Peça Já. Ausente = app. */
  deliveryBy?: ShopDeliveryMode;
  /**
   * Access Token OAuth do Mercado Pago do comerciante (conta conectada ao marketplace).
   * Usado no Split Pix para creditar a fatia do comércio.
   */
  mpAccessToken?: string;
}

export interface SelectedAddon {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  /** Identifica a linha no carrinho (item + adicionais + observação). */
  lineId: string;
  item: MenuItem;
  quantity: number;
  businessId: string;
  businessName: string;
  selectedAddons: SelectedAddon[];
  /** Observação do cliente (ex.: sem cebola). */
  note?: string;
}

/** Item do pedido marcado pela loja como indisponível (em falta). */
export type OrderLineIssueStatus =
  | 'awaiting_customer'
  | 'replaced'
  | 'removed';

export interface OrderLineIssue {
  lineId: string;
  itemName: string;
  reason: string;
  flaggedAt: string;
  status: OrderLineIssueStatus;
  /** Nome do item escolhido na troca (se replaced). */
  replacedWithName?: string;
  resolvedAt?: string;
  /** Sugestão da loja para o cliente trocar. */
  suggestedItemId?: string;
  suggestedItemName?: string;
  suggestedItemImage?: string;
  suggestedItemPrice?: number;
}

export interface Order {
  id: string;
  userId: string;
  businessId: string;
  businessName: string;
  businessImage: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  /** Desconto de clube / promo aplicado no checkout. */
  discount?: number;
  total: number;
  status: OrderStatus;
  address: string;
  /**
   * Ponto do cliente gravado na hora do pedido (plano 2).
   * Não é o GPS ao vivo e não é preenchido com um pin inventado.
   */
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  /** Quando o GPS (ou a cidade demo) foi salvo neste pedido. */
  deliveryPinSavedAt?: string;
  /** GPS ao vivo do celular do cliente (plano 1). Não substitui o ponto salvo. */
  customerLiveLatitude?: number;
  customerLiveLongitude?: number;
  customerLiveAt?: string;
  /** GPS da loja (retirada). */
  businessLatitude?: number;
  businessLongitude?: number;
  paymentMethod: string;
  /** Quem leva este pedido. Gravado no checkout. */
  deliveryBy?: ShopDeliveryMode;
  /** Cidade de atuação da loja. Ex.: "Mucugê — BA". */
  city?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery: string;
  /** Taxa Peça Já (cobrada a mais do cliente, não descontada do preço da loja). */
  platformFee?: number;
  /**
   * Pedido em dinheiro da própria loja: este valor saiu do caixa Pix
   * e ficou com o Peça Já. A loja ficou com a cédula.
   */
  cashFeePixAmount?: number;
  /**
   * No Pix/cartão seguinte: quanto da dívida de taxa (dinheiro) foi abatido
   * da parte da loja (via application_fee ou líquido do crédito).
   */
  cashFeeDebtRecovered?: number;
  establishmentAmount?: number;
  driverAmount?: number;
  /** ID da cobrança Pix (Mercado Pago ou mock). */
  paymentId?: string;
  /** provedor: mercadopago | mock | card */
  paymentProvider?: string;
  /**
   * Liquidação: collector_ledger (piloto) ou marketplace_split (lojista no MP).
   * Com merchantPaidViaMp, não creditar ledger do comércio.
   */
  settlementMode?: 'collector_ledger' | 'marketplace_split';
  settlementMerchantPaidViaMp?: boolean;
  settlementDriverViaLedger?: boolean;
  settlementApplicationFee?: number;
  /** true só depois do gateway confirmar o pagamento. */
  paymentConfirmed?: boolean;
  /**
   * Crédito da parte da loja no ledger da nuvem, depois da entrega.
   * pending = a nuvem recusou ou não estava logada.
   */
  merchantLedgerCredit?: 'credited' | 'pending' | 'skipped';
  /**
   * Repasse do gateway depois dos dois códigos.
   * A taxa Peça Já não sai. Loja e frete vão para as chaves Pix.
   */
  gatewaySplit?: {
    at: string;
    merchantStatus: 'paid' | 'pending' | 'failed' | 'skipped' | 'missing_key';
    driverStatus: 'paid' | 'pending' | 'failed' | 'skipped' | 'missing_key';
    merchantAmount?: number;
    driverAmount?: number;
    simulated?: boolean;
    message?: string;
  };
  /** Entregador atribuído (`null` = liberado / sem motoboy). */
  driverId?: string | null;
  /** userId da plataforma do entregador (ledger / auth do frete). */
  driverPlatformUserId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  /** Snapshot do perfil do entregador no aceite. */
  driverPhotoUrl?: string | null;
  driverBio?: string | null;
  driverVehicle?: string | null;
  /** Snapshot do cliente no momento do pedido. */
  customerName?: string;
  customerPhone?: string;
  customerPhotoUrl?: string;
  customerBio?: string;
  /** Número sequencial do pedido nesta loja (#1, #2, #3…). */
  shopOrderNumber?: number;
  /**
   * Código de RETIRADA — o entregador mostra ao comércio.
   * Só libera o pedido da loja para o motoboy.
   */
  pickupCode?: string;
  /**
   * Código de ENTREGA — o cliente mostra ao motoboy.
   * Só confirma que a entrega foi feita de verdade.
   */
  deliveryCode?: string;
  /** Quando o comércio validou o código de retirada. */
  pickupVerifiedAt?: string;
  /** Quando o entregador validou o código de entrega do cliente. */
  deliveryVerifiedAt?: string;
  /** Quando a cozinha marcou o pedido como pronto para retirada. */
  kitchenReadyAt?: string;
  /**
   * Fila justa: oferta exclusiva ao entregador (fleetId `da_…`).
   * Só esse motoboy vê/aceita até expirar.
   */
  offeredToDriverId?: string | null;
  offerExpiresAt?: string | null;
  /** Motoboys que recusaram esta corrida nesta rodada. */
  offerDeclinedBy?: string[];
  /** Linhas do pedido já separadas/montadas na cozinha (lineId). */
  preparedLineIds?: string[];
  /**
   * Itens em falta sinalizados pela loja.
   * Enquanto status = awaiting_customer, o cliente pode trocar pelo cardápio.
   */
  lineIssues?: OrderLineIssue[];
  /** Motivo do cancelamento (obrigatório na UI). */
  cancelReason?: string;
  /** Quem cancelou. */
  cancelledBy?: 'customer' | 'merchant' | 'system';
  /** Quando foi cancelado. */
  cancelledAt?: string;
  /**
   * Estorno após cancelar pedido pago online.
   * not_applicable = sem cobrança online / dinheiro na entrega.
   * skipped = mock/local. processing/confirmed/failed = gateway.
   */
  refundStatus?: 'not_applicable' | 'skipped' | 'processing' | 'confirmed' | 'failed';
  refundId?: string;
  refundMessage?: string;
  refundAt?: string;
}

/** Avaliação de um pedido entregue no comércio. */
export interface BusinessReview {
  id: string;
  businessId: string;
  orderId: string;
  userId: string;
  userName: string;
  /** Nota do estabelecimento (1–5). */
  rating: number;
  comment: string;
  createdAt: string;
  /** Nota do entregador (1–5), após confirmação do código. */
  driverRating?: number;
  driverId?: string;
  driverName?: string;
  /** Comentário opcional só sobre a conduta na entrega. */
  driverComment?: string;
}

/** Denúncia grave de conduta do entregador (com provas → suporte). */
export type ConductReportCategory =
  | 'racismo'
  | 'bullying'
  | 'assedio'
  | 'violencia'
  | 'furto'
  | 'ameaca'
  | 'outro';

export interface ConductReport {
  id: string;
  orderId: string;
  businessId: string;
  businessName: string;
  driverId?: string;
  driverName?: string;
  reporterUserId: string;
  reporterName: string;
  reporterEmail?: string;
  category: ConductReportCategory;
  description: string;
  /** URIs locais das provas (fotos). */
  evidenceUris: string[];
  createdAt: string;
  status: 'enviado_suporte' | 'em_analise' | 'encerrado';
  /** Se o cliente afirmou ter acionado/acionará a polícia. */
  policeAware?: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
}
