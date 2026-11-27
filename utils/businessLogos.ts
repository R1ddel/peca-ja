/**
 * Logos de perfil dos comércios — uma arte única por loja (assets/merchants/logos/shops).
 * Fotos de pratos do cardápio não são alteradas.
 * Logos enviadas pelo comércio (upload) têm prioridade via isUploadedOrAuthenticLogo.
 */
import { ImageSourcePropType } from 'react-native';
import { BusinessCategory } from '@/constants/theme';

const DEFAULT_LOGO: ImageSourcePropType = require('../assets/merchants/logos/shops/_default.png');

/** Logos autênticas por nome (URL pública estável, quando existir). */
const AUTHENTIC_BY_NAME: Record<string, string> = {};

/**
 * Logo Canva gerada por loja — chave = nome normalizado (sem acento, lower).
 */
const SHOP_LOGOS: Record<string, ImageSourcePropType> = {
  'restaurante paraguassu': require('../assets/merchants/logos/shops/restaurante-paraguassu.png'),
  'point da chapada': require('../assets/merchants/logos/shops/point-da-chapada.png'),
  'pizzaria d\'enrico': require('../assets/merchants/logos/shops/pizzaria-denrico.png'),
  'casa amarela hamburguer & cia': require('../assets/merchants/logos/shops/casa-amarela-hamburguer-cia.png'),
  'central mucuge': require('../assets/merchants/logos/shops/central-mucuge.png'),
  'kanona alimentos': require('../assets/merchants/logos/shops/kanona-alimentos.png'),
  'cafe pati': require('../assets/merchants/logos/shops/cafe-pati.png'),
  'bia maria cafe': require('../assets/merchants/logos/shops/bia-maria-cafe.png'),
  'big tapioca mucuge': require('../assets/merchants/logos/shops/big-tapioca-mucuge.png'),
  'pizza d\'lucas': require('../assets/merchants/logos/shops/pizza-dlucas.png'),
  'bar de rosa': require('../assets/merchants/logos/shops/bar-de-rosa.png'),
  'padaria diamantina': require('../assets/merchants/logos/shops/padaria-diamantina.png'),
  'padaria ramalho': require('../assets/merchants/logos/shops/padaria-ramalho.png'),
  'padaria delicia da chapada': require('../assets/merchants/logos/shops/padaria-delicia-da-chapada.png'),
  'padaria, lanchonete e mercadinho abn': require('../assets/merchants/logos/shops/padaria-lanchonete-e-mercadinho-abn.png'),
  'farma mucuge': require('../assets/merchants/logos/shops/farma-mucuge.png'),
  'cuidar farma': require('../assets/merchants/logos/shops/cuidar-farma.png'),
  'pharmacia gabriela': require('../assets/merchants/logos/shops/pharmacia-gabriela.png'),
  'farmacia viva mais': require('../assets/merchants/logos/shops/farmacia-viva-mais.png'),
  'supermercado oliveira': require('../assets/merchants/logos/shops/supermercado-oliveira.png'),
  'mercado municipal doutor cesar borges': require('../assets/merchants/logos/shops/mercado-municipal-doutor-cesar-borges.png'),
  'mercadinho do centro': require('../assets/merchants/logos/shops/mercadinho-do-centro.png'),
  'quitanda da serra': require('../assets/merchants/logos/shops/quitanda-da-serra.png'),
  'deposito gelado mucuge': require('../assets/merchants/logos/shops/deposito-gelado-mucuge.png'),
  'adega da chapada': require('../assets/merchants/logos/shops/adega-da-chapada.png'),
  'bebidas express mucuge': require('../assets/merchants/logos/shops/bebidas-express-mucuge.png'),
  'mini mercado express mucuge': require('../assets/merchants/logos/shops/mini-mercado-express-mucuge.png'),
  'loja da esquina mucuge': require('../assets/merchants/logos/shops/loja-da-esquina-mucuge.png'),
  'stop & go chapada': require('../assets/merchants/logos/shops/stop-go-chapada.png'),
  'pizza da garagem': require('../assets/merchants/logos/shops/pizza-da-garagem.png'),
  'restaurante comida caseira da dona nena': require('../assets/merchants/logos/shops/restaurante-comida-caseira-da-dona-nena.png'),
  'cafe odeon': require('../assets/merchants/logos/shops/cafe-odeon.png'),
  'restaurante sabor da picanha': require('../assets/merchants/logos/shops/restaurante-sabor-da-picanha.png'),
  'restaurante cascalho': require('../assets/merchants/logos/shops/restaurante-cascalho.png'),
  'pizza no prato': require('../assets/merchants/logos/shops/pizza-no-prato.png'),
  'ponto do espetinho': require('../assets/merchants/logos/shops/ponto-do-espetinho.png'),
  'restaurante monte serrat': require('../assets/merchants/logos/shops/restaurante-monte-serrat.png'),
  'restaurante fua': require('../assets/merchants/logos/shops/restaurante-fua.png'),
  'panela de barro': require('../assets/merchants/logos/shops/panela-de-barro.png'),
  'o matuto': require('../assets/merchants/logos/shops/o-matuto.png'),
  'claudia restaurante': require('../assets/merchants/logos/shops/claudia-restaurante.png'),
  'restaurante arenito': require('../assets/merchants/logos/shops/restaurante-arenito.png'),
  'restaurante e pizzaria du\' profeta': require('../assets/merchants/logos/shops/restaurante-e-pizzaria-du-profeta.png'),
  'restaurante sabor e arte': require('../assets/merchants/logos/shops/restaurante-sabor-e-arte.png'),
  'coronel gastro bar': require('../assets/merchants/logos/shops/coronel-gastro-bar.png'),
  'sarau e burger': require('../assets/merchants/logos/shops/sarau-e-burger.png'),
  'capim rosa cha': require('../assets/merchants/logos/shops/capim-rosa-cha.png'),
  'pizzaria da villa': require('../assets/merchants/logos/shops/pizzaria-da-villa.png'),
  'cantinho na serra bistro': require('../assets/merchants/logos/shops/cantinho-na-serra-bistro.png'),
  'sabor garimpo food & beer': require('../assets/merchants/logos/shops/sabor-garimpo-food-beer.png'),
  'mandacaru bar e restaurante': require('../assets/merchants/logos/shops/mandacaru-bar-e-restaurante.png'),
  'restaurante joao de barro': require('../assets/merchants/logos/shops/restaurante-joao-de-barro.png'),
  'abraco cafe e bistro': require('../assets/merchants/logos/shops/abraco-cafe-e-bistro.png'),
  'igatupi cafe': require('../assets/merchants/logos/shops/igatupi-cafe.png'),
  'cafe rabello & gondim': require('../assets/merchants/logos/shops/cafe-rabello-gondim.png'),
  'cafe preto': require('../assets/merchants/logos/shops/cafe-preto.png'),
  'lanchonete fid mae': require('../assets/merchants/logos/shops/lanchonete-fid-mae.png'),
  'bendito boteco': require('../assets/merchants/logos/shops/bendito-boteco.png'),
  'cangaco espeto bar': require('../assets/merchants/logos/shops/cangaco-espeto-bar.png'),
  'sobrado da lia bistro': require('../assets/merchants/logos/shops/sobrado-da-lia-bistro.png'),
  'braseiro do juba': require('../assets/merchants/logos/shops/braseiro-do-juba.png'),
  'hamburgeria toca dos leoes': require('../assets/merchants/logos/shops/hamburgeria-toca-dos-leoes.png'),
  'chocolate mucuge': require('../assets/merchants/logos/shops/chocolate-mucuge.png'),
  'restaurante mandacaru': require('../assets/merchants/logos/shops/restaurante-mandacaru.png'),
  'dona bia brigaderia': require('../assets/merchants/logos/shops/dona-bia-brigaderia.png'),
  'frio bom sorveteria': require('../assets/merchants/logos/shops/frio-bom-sorveteria.png'),
  'sorveteria brandao': require('../assets/merchants/logos/shops/sorveteria-brandao.png'),
  'padaria flor da chapada': require('../assets/merchants/logos/shops/padaria-flor-da-chapada.png'),
  'farmacia chapada': require('../assets/merchants/logos/shops/farmacia-chapada.png'),
  'farmacia amanda': require('../assets/merchants/logos/shops/farmacia-amanda.png'),
  'farmacia pati': require('../assets/merchants/logos/shops/farmacia-pati.png'),
  'farmacia popular maciel': require('../assets/merchants/logos/shops/farmacia-popular-maciel.png'),
  'farmacia viva mais vila agricola': require('../assets/merchants/logos/shops/farmacia-viva-mais-vila-agricola.png'),
  'mercado extra mucuge': require('../assets/merchants/logos/shops/mercado-extra-mucuge.png'),
  'comercial oliveira': require('../assets/merchants/logos/shops/comercial-oliveira.png'),
  'mercearia jjl': require('../assets/merchants/logos/shops/mercearia-jjl.png'),
  'mercearia ana clara': require('../assets/merchants/logos/shops/mercearia-ana-clara.png'),
  'casa do morango': require('../assets/merchants/logos/shops/casa-do-morango.png'),
  'hortifruti araujo': require('../assets/merchants/logos/shops/hortifruti-araujo.png'),
  'hortifruti leandros': require('../assets/merchants/logos/shops/hortifruti-leandros.png'),
  'acougue do jaime': require('../assets/merchants/logos/shops/acougue-do-jaime.png'),
  'acougue boi gordo': require('../assets/merchants/logos/shops/acougue-boi-gordo.png'),
  'acougue mek': require('../assets/merchants/logos/shops/acougue-mek.png'),
  'cds oliveira acougue': require('../assets/merchants/logos/shops/cds-oliveira-acougue.png'),
  'mercadinho 2 irmaos': require('../assets/merchants/logos/shops/mercadinho-2-irmaos.png'),
  'comercial chapada': require('../assets/merchants/logos/shops/comercial-chapada.png'),
  'comercial propecio': require('../assets/merchants/logos/shops/comercial-propecio.png'),
  'acai da roca & comercial sacerdote': require('../assets/merchants/logos/shops/acai-da-roca-comercial-sacerdote.png'),
  'emporio mucuge best beer': require('../assets/merchants/logos/shops/emporio-mucuge-best-beer.png'),
  'na brisa bebidas': require('../assets/merchants/logos/shops/na-brisa-bebidas.png'),
  'boteco jma bebidas': require('../assets/merchants/logos/shops/boteco-jma-bebidas.png'),
  'felix drink': require('../assets/merchants/logos/shops/felix-drink.png'),
  'sc frutas chapada': require('../assets/merchants/logos/shops/sc-frutas-chapada.png'),
};

function normalize(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Foto genérica de stock (Unsplash) — não é identidade do comércio. */
export function isStockCommercePhoto(uri?: string | null): boolean {
  if (!uri) return true;
  return uri.toLowerCase().includes('images.unsplash.com');
}

/**
 * Detecta se a URI já é uma logo/foto enviada pelo comércio (não stock Unsplash).
 */
export function isUploadedOrAuthenticLogo(uri?: string | null): boolean {
  if (!uri) return false;
  const u = uri.toLowerCase();
  if (
    u.startsWith('file:') ||
    u.startsWith('content:') ||
    u.startsWith('ph://') ||
    u.startsWith('assets-library') ||
    u.startsWith('data:')
  ) {
    return true;
  }
  if (Object.values(AUTHENTIC_BY_NAME).includes(uri)) return true;
  // Stock Unsplash / fotos de comida do seed não são logo
  if (isStockCommercePhoto(uri)) return false;
  if (u.includes('restauranteparaguassu.com.br')) return false;
  return false;
}

export function getAuthenticLogoUri(name: string): string | null {
  const key = Object.keys(AUTHENTIC_BY_NAME).find(
    (k) => normalize(k) === normalize(name)
  );
  return key ? AUTHENTIC_BY_NAME[key] : null;
}

export function getBusinessLogoSource(opts: {
  name: string;
  category: BusinessCategory;
  image?: string | null;
}): ImageSourcePropType {
  const authentic = getAuthenticLogoUri(opts.name);
  if (authentic) return { uri: authentic };
  if (isUploadedOrAuthenticLogo(opts.image)) {
    return { uri: opts.image! };
  }
  const key = normalize(opts.name);
  return SHOP_LOGOS[key] ?? DEFAULT_LOGO;
}

/**
 * Capa do comércio: mantém foto real (upload / site oficial);
 * se for Unsplash genérico, usa a logo Canva da loja.
 */
export function getBusinessCoverSource(opts: {
  name: string;
  category: BusinessCategory;
  image?: string | null;
  coverImage?: string | null;
}): ImageSourcePropType {
  if (opts.coverImage && !isStockCommercePhoto(opts.coverImage)) {
    return { uri: opts.coverImage };
  }
  return getBusinessLogoSource({
    name: opts.name,
    category: opts.category,
    image: opts.image,
  });
}

type MenuLike = {
  image?: string | null;
  images?: string[] | null;
  popular?: boolean;
  promo?: number | null;
  price?: number;
};

/** URI de um produto do cardápio (popular → promo → primeiro com foto). */
export function pickBusinessProductImageUri(menu?: MenuLike[] | null): string | null {
  if (!menu?.length) return null;
  const uriOf = (m: MenuLike) => {
    const fromGallery = m.images?.find((u) => typeof u === 'string' && u.length > 0);
    if (fromGallery) return fromGallery;
    if (m.image && m.image.length > 0) return m.image;
    return null;
  };
  const popular = menu.find((m) => m.popular && uriOf(m));
  if (popular) return uriOf(popular);
  const promo = menu.find((m) => m.promo != null && uriOf(m));
  if (promo) return uriOf(promo);
  for (const m of menu) {
    const u = uriOf(m);
    if (u) return u;
  }
  return null;
}

/**
 * Capa comercial: foto de produto do cardápio; se não houver, cai na capa/logo.
 */
export function getBusinessProductCoverSource(opts: {
  name: string;
  category: BusinessCategory;
  image?: string | null;
  coverImage?: string | null;
  menu?: MenuLike[] | null;
}): ImageSourcePropType {
  const product = pickBusinessProductImageUri(opts.menu);
  if (product) return { uri: product };
  return getBusinessCoverSource(opts);
}

/** Resolve logo a partir do pedido (usa catálogo atual quando o id existir). */
export function getOrderBusinessLogoSource(opts: {
  businessId: string;
  businessName: string;
  businessImage?: string | null;
  /** Lookup opcional — evita import circular se passado de fora. */
  category?: BusinessCategory;
  image?: string | null;
}): ImageSourcePropType {
  return getBusinessLogoSource({
    name: opts.businessName,
    category: opts.category ?? 'restaurante',
    image: opts.image ?? opts.businessImage,
  });
}
