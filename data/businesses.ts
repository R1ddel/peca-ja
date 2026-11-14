import { Business, MenuItem } from '@/types';
import { BusinessCategory } from '@/constants/theme';
import { getAddonGroupsForCategory } from '@/data/addons';
import { TOP_MERCHANT_PLAN } from '@/constants/plans';
import { customerUnitPrice } from '@/constants/pricing';
import { MUCUGE_SHOPS, MucugeProduct, MucugeShop } from '@/data/mucugeMerchants';
import { getActiveCatalogCityName, getShopsForActiveCity } from '@/data/cityCatalog';
import { sameOperatingCity } from '@/utils/operatingCity';
import { resolveBusinessCoords } from '@/utils/orderGeo';
import {
  getActiveDemoLocation,
  getDemoLocationIdSync,
  getDemoTokenCity,
  getSimulatedCityLabel,
} from '@/utils/demoLocation';
import {
  MENU_ITEM_PHOTO_POOLS,
  productGalleryFromName,
  productImageFromName,
  resolveMenuItemPhotoKey,
} from '@/utils/menuItemPhotoSuggest';

type ProductTemplate = {
  name: string;
  description: string;
  price: number;
  category: string;
  popular?: boolean;
  promo?: number;
};

/** Fotos Unsplash reais por tema (não paisagens aleatórias). */
const u = (id: string, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

const STORE_PHOTOS: Record<BusinessCategory, { logo: string[]; cover: string[] }> = {
  restaurante: {
    logo: [
      'photo-1517248135467-4c7edcad34c4',
      'photo-1555396273-367ea4eb4db5',
      'photo-1552567621-eee1e2a279e2',
      'photo-1414235077428-338989a2e8c0',
      'photo-1466978913421-dad2ebd01d17',
      'photo-1559339352-11d035aa65de',
    ],
    cover: [
      'photo-1414235077428-338989a2e8c0',
      'photo-1504674900247-0877df9cc836',
      'photo-1559339352-11d035aa65de',
      'photo-1514933651103-005eec06c04b',
      'photo-1550963211-6ae0e14bd6d8',
      'photo-1424847653820-66856651f88c',
    ],
  },
  mercado: {
    logo: [
      'photo-1578916171728-46686eac8d58',
      'photo-1604719312566-8912e9227c6a',
      'photo-1542838132-92c53300491e',
      'photo-1534723452862-4c874648dca9',
      'photo-1578916171728-46686eac8d58',
      'photo-1604719312566-8912e9227c6a',
    ],
    cover: [
      'photo-1604719312566-8912e9227c6a',
      'photo-1542838132-92c53300491e',
      'photo-1583258292688-ab0045641966',
      'photo-1578916171728-46686eac8d58',
      'photo-1534723452862-4c874648dca9',
      'photo-1601593346740-925612772716',
    ],
  },
  farmacia: {
    logo: [
      'photo-1576602976047-174e57a47881',
      'photo-1587854692152-cf660b4c48ea',
      'photo-1576091160399-112ba8d25d1d',
      'photo-1631549916768-4119b2e5f926',
      'photo-1584308666744-24d5c474f2ae',
      'photo-1471864190281-a93a3070b6de',
    ],
    cover: [
      'photo-1587854692152-cf660b4c48ea',
      'photo-1576091160550-2173dba999ef',
      'photo-1631549916768-4119b2e5f926',
      'photo-1576602976047-174e57a47881',
      'photo-1471864190281-a93a3070b6de',
      'photo-1584308666744-24d5c474f2ae',
    ],
  },
  distribuidora: {
    logo: [
      'photo-1608270586620-248524c67de9',
      'photo-1569529463441-c963b3b55005',
      'photo-1510812431401-41d2bd2722f3',
      'photo-1558618666-fcd25c85cd64',
      'photo-1548839140-29a7492991a9',
      'photo-1622483767028-3ff66e4bb782',
    ],
    cover: [
      'photo-1569529463441-c963b3b55005',
      'photo-1510812431401-41d2bd2722f3',
      'photo-1608270586620-248524c67de9',
      'photo-1470337458703-46ad6014eead',
      'photo-1558618666-fcd25c85cd64',
      'photo-1546171753-97d4264b7930',
    ],
  },
  padaria: {
    logo: [
      'photo-1509440159596-0249088772ff',
      'photo-1555507036-ab1f4038808a',
      'photo-1608198093002-4d4e5e253606',
      'photo-1517433670267-08bbd4be890f',
      'photo-1509440159596-0249088772ff',
      'photo-1549931319-a545dcf3bc73',
    ],
    cover: [
      'photo-1608198093002-4d4e5e253606',
      'photo-1517433670267-08bbd4be890f',
      'photo-1555507036-ab1f4038808a',
      'photo-1509440159596-0249088772ff',
      'photo-1486297678162-eb2a19b0a32d',
      'photo-1549931319-a545dcf3bc73',
    ],
  },
  bebidas: {
    logo: [
      'photo-1546171753-97d4264b7930',
      'photo-1510812431401-41d2bd2722f3',
      'photo-1622597467836-f3285f2131b8',
      'photo-1495474472287-4d89b1ccc336',
      'photo-1608270586620-248524c67de9',
      'photo-1556679343-c7306c1976bc',
    ],
    cover: [
      'photo-1510812431401-41d2bd2722f3',
      'photo-1546171753-97d4264b7930',
      'photo-1470337458703-46ad6014eead',
      'photo-1622597467836-f3285f2131b8',
      'photo-1495474472287-4d89b1ccc336',
      'photo-1558618666-fcd25c85cd64',
    ],
  },
  conveniencia: {
    logo: [
      'photo-1604719312566-8912e9227c6a',
      'photo-1601593346740-925612772716',
      'photo-1534723452862-4c874648dca9',
      'photo-1556740738-b6a63e27c4df',
      'photo-1441986300917-64674bd600d8',
      'photo-1604719312566-8912e9227c6a',
    ],
    cover: [
      'photo-1601593346740-925612772716',
      'photo-1441986300917-64674bd600d8',
      'photo-1556740738-b6a63e27c4df',
      'photo-1604719312566-8912e9227c6a',
      'photo-1534723452862-4c874648dca9',
      'photo-1578916171728-46686eac8d58',
    ],
  },
};

function productImage(name: string, menuCategory: string, index: number) {
  return productImageFromName(name, menuCategory, index);
}

/** Foto larga do carrossel da home — o prato ocupa o card, não um recorte quadrado. */
function bannerFoodImage(item: MenuItem, shopId: string): string {
  const key = resolveMenuItemPhotoKey(item.name, item.category);
  const pool = MENU_ITEM_PHOTO_POOLS[key] ?? MENU_ITEM_PHOTO_POOLS.default;
  let hash = 0;
  for (let i = 0; i < shopId.length; i++) hash = (hash + shopId.charCodeAt(i) * (i + 3)) % 997;
  return u(pool[hash % pool.length], 1400, 800);
}

/** 3–4 fotos do mesmo tema para a galeria ao tocar no prato. */
function productGallery(
  name: string,
  menuCategory: string,
  index: number,
  mainImage: string
): string[] {
  return productGalleryFromName(name, menuCategory, index, mainImage);
}

function buildItemDetails(name: string, description: string, category: string): string {
  const cat = category.toLowerCase();
  const city = getSimulatedCityLabel();
  let tip = `As fotos mostram o produto de ângulos diferentes. O preparo segue o padrão da casa em ${city}.`;

  if (cat.includes('bebida') || cat.includes('drink')) {
    tip = 'Servido gelado (quando aplicável). Confira volume e sabor na descrição.';
  } else if (cat.includes('pizza') || cat.includes('burger') || cat.includes('prato') || cat.includes('massa')) {
    tip = 'Preparado na hora do pedido. Porção pensada para uma pessoa — combine acompanhamentos se quiser.';
  } else if (cat.includes('sobremesa') || cat.includes('doce')) {
    tip = 'Doce da casa. Ideal para fechar o pedido ou dividir.';
  } else if (cat.includes('mercado') || cat.includes('mercearia') || cat.includes('higiene') || cat.includes('limpeza')) {
    tip = 'Produto de prateleira. Embalagem e validade conforme o comércio.';
  } else if (cat.includes('farm') || cat.includes('medic')) {
    tip = 'Siga a bula e as orientações do comércio. Em caso de dúvida, consulte um profissional de saúde.';
  }

  return `${description}\n\nSobre ${name}\n${tip}`;
}

function storeImage(category: BusinessCategory, index: number, kind: 'logo' | 'cover') {
  const pool = STORE_PHOTOS[category][kind];
  const size = kind === 'cover' ? ([800, 400] as const) : ([400, 300] as const);
  const id = pool[Math.abs(index) % pool.length];
  return u(id, size[0], size[1]);
}

const PRODUCT_CATALOGS: Record<BusinessCategory, ProductTemplate[]> = {
  restaurante: [
    { name: 'PF Executivo', description: 'Arroz, feijão, carne, salada e batata frita', price: 28.9, category: 'Pratos', popular: true },
    { name: 'Feijoada Completa', description: 'Feijoada tradicional com farofa, couve e laranja', price: 36.9, category: 'Pratos', popular: true },
    { name: 'Strogonoff de Frango', description: 'Cremoso com arroz branco e batata palha', price: 32.9, category: 'Pratos' },
    { name: 'Bife à Parmegiana', description: 'Filé empanado, molho e queijo gratinado', price: 39.9, category: 'Pratos', popular: true },
    { name: 'Filé de Frango Grelhado', description: 'Acompanha legumes e arroz integral', price: 29.9, category: 'Pratos' },
    { name: 'Risoto de Camarão', description: 'Arborio cremoso com camarões frescos', price: 48.9, category: 'Pratos' },
    { name: 'Lasanha Bolonhesa', description: 'Camadas de massa, molho e queijo', price: 34.9, category: 'Pratos' },
    { name: 'Espaguete ao Alho e Óleo', description: 'Massa al dente com azeite e pimenta', price: 26.9, category: 'Massas' },
    { name: 'Nhoque ao Sugo', description: 'Nhoque caseiro com molho de tomate', price: 27.9, category: 'Massas' },
    { name: 'Pizza Margherita', description: 'Molho, mussarela, tomate e manjericão', price: 44.9, category: 'Pizzas', popular: true },
    { name: 'Pizza Calabresa', description: 'Calabresa, cebola e azeitona', price: 46.9, category: 'Pizzas' },
    { name: 'Pizza Quatro Queijos', description: 'Mussarela, gorgonzola, parmesão e provolone', price: 52.9, category: 'Pizzas' },
    { name: 'Hamburger Clássico', description: 'Blend 160g, queijo, alface e tomate', price: 31.9, category: 'Burgers', popular: true },
    { name: 'Smash Burger Duplo', description: 'Duas carnes smash e cheddar', price: 36.9, category: 'Burgers' },
    { name: 'Batata Frita Grande', description: 'Crocante com tempero da casa', price: 16.9, category: 'Acompanhamentos' },
    { name: 'Onion Rings', description: 'Anéis de cebola empanados', price: 18.9, category: 'Acompanhamentos' },
    { name: 'Salada Caesar', description: 'Alface, croutons, parmesão e molho', price: 24.9, category: 'Saladas' },
    { name: 'Salada Tropical', description: 'Mix de folhas, frutas e castanhas', price: 22.9, category: 'Saladas' },
    { name: 'Sopa do Dia', description: 'Receita quente do chef', price: 19.9, category: 'Sopas' },
    { name: 'Açaí 500ml', description: 'Com granola, banana e mel', price: 21.9, category: 'Sobremesas', popular: true },
    { name: 'Pudim de Leite', description: 'Cremoso com calda de caramelo', price: 12.9, category: 'Sobremesas' },
    { name: 'Brownie com Sorvete', description: 'Chocolate belga e baunilha', price: 18.9, category: 'Sobremesas' },
    { name: 'Mousse de Maracujá', description: 'Leve e refrescante', price: 14.9, category: 'Sobremesas' },
    { name: 'Suco Natural 500ml', description: 'Laranja, limão, abacaxi ou maracujá', price: 9.9, category: 'Bebidas', popular: true },
    { name: 'Suco Detox Verde', description: 'Couve, limão, gengibre e maçã', price: 12.9, category: 'Bebidas' },
    { name: 'Refrigerante Lata', description: 'Coca-Cola, Guaraná ou Sprite 350ml', price: 6.9, category: 'Bebidas', popular: true },
    { name: 'Refrigerante 600ml', description: 'Gelado, vários sabores', price: 8.9, category: 'Bebidas' },
    { name: 'Refrigerante 2L', description: 'Para compartilhar', price: 12.9, category: 'Bebidas' },
    { name: 'Água Mineral 500ml', description: 'Sem gás', price: 3.9, category: 'Bebidas' },
    { name: 'Água com Gás 500ml', description: 'Gelada', price: 4.5, category: 'Bebidas' },
    { name: 'Chá Gelado', description: 'Pêssego ou limão', price: 7.9, category: 'Bebidas' },
    { name: 'Cerveja Long Neck', description: 'Opções nacionais geladas', price: 9.9, category: 'Bebidas' },
    { name: 'Milkshake Chocolate', description: '400ml cremoso', price: 16.9, category: 'Bebidas', popular: true },
    { name: 'Milkshake Morango', description: '400ml com pedaços de fruta', price: 16.9, category: 'Bebidas' },
    { name: 'Café Expresso', description: 'Curto e encorpado', price: 5.9, category: 'Bebidas' },
    { name: 'Combo Família', description: '4 pratos + 2 sobremesas + refrigerante 2L', price: 129.9, category: 'Combos', popular: true, promo: 109.9 },
    { name: 'Porção de Pastéis (6un)', description: 'Carne, queijo e pizza', price: 24.9, category: 'Entradas' },
    { name: 'Coxinha Cremosa (4un)', description: 'Frango desfiado com catupiry', price: 18.9, category: 'Entradas' },
    { name: 'Bruschetta Caprese', description: 'Pão italiano, tomate e mussarela', price: 17.9, category: 'Entradas' },
    { name: 'Yakissoba de Carne', description: 'Macarrão oriental com legumes', price: 33.9, category: 'Pratos' },
  ],
  mercado: [
    { name: 'Arroz Tipo 1 5kg', description: 'Arroz branco premium', price: 24.9, category: 'Mercearia', popular: true, promo: 19.9 },
    { name: 'Feijão Carioca 1kg', description: 'Grãos selecionados', price: 8.99, category: 'Mercearia' },
    { name: 'Açúcar Cristal 1kg', description: 'Pacote econômico', price: 4.49, category: 'Mercearia' },
    { name: 'Café Torrado 500g', description: 'Moído tradicional', price: 18.9, category: 'Mercearia', popular: true },
    { name: 'Macarrão Espaguete 500g', description: 'Massa de sêmola', price: 4.29, category: 'Mercearia' },
    { name: 'Óleo de Soja 900ml', description: 'Para frituras e refogados', price: 7.49, category: 'Mercearia' },
    { name: 'Sal Refinado 1kg', description: 'Iodado', price: 2.49, category: 'Mercearia' },
    { name: 'Farinha de Trigo 1kg', description: 'Tipo 1', price: 5.99, category: 'Mercearia' },
    { name: 'Leite Integral 1L', description: 'Caixa longa vida', price: 5.49, category: 'Laticínios', popular: true },
    { name: 'Queijo Mussarela 200g', description: 'Fatiado fresco', price: 14.9, category: 'Laticínios' },
    { name: 'Iogurte Natural 170g', description: 'Sem sabor', price: 3.99, category: 'Laticínios' },
    { name: 'Manteiga com Sal 200g', description: 'Cremeira', price: 12.9, category: 'Laticínios' },
    { name: 'Banana Prata (kg)', description: 'Fruta fresca selecionada', price: 4.99, category: 'Hortifruti' },
    { name: 'Maçã Gala (kg)', description: 'Doce e crocante', price: 8.99, category: 'Hortifruti' },
    { name: 'Tomate (kg)', description: 'Ideal para saladas', price: 6.99, category: 'Hortifruti' },
    { name: 'Alface Crespa', description: 'Unidade fresca', price: 3.49, category: 'Hortifruti' },
    { name: 'Cebola (kg)', description: 'Amarela selecionada', price: 5.49, category: 'Hortifruti' },
    { name: 'Batata Inglesa (kg)', description: 'Lavada', price: 4.79, category: 'Hortifruti' },
    { name: 'Pão de Forma 500g', description: 'Fatiado tradicional', price: 7.99, category: 'Padaria' },
    { name: 'Bisnaga Leite 300g', description: 'Macio para café', price: 6.49, category: 'Padaria' },
    { name: 'Carne Moída 500g', description: 'Primeira patinho', price: 22.9, category: 'Açougue', popular: true },
    { name: 'Peito de Frango 1kg', description: 'Sem osso', price: 19.9, category: 'Açougue' },
    { name: 'Linguiça Toscana 500g', description: 'Para churrasco', price: 16.9, category: 'Açougue' },
    { name: 'Detergente 500ml', description: 'Limpeza profunda', price: 2.99, category: 'Limpeza' },
    { name: 'Sabão em Pó 800g', description: 'Renderização alta', price: 14.9, category: 'Limpeza' },
    { name: 'Papel Higiênico 12un', description: 'Folha dupla', price: 18.9, category: 'Higiene', popular: true },
    { name: 'Sabonete Neutro (3un)', description: 'Glicerinado', price: 7.9, category: 'Higiene' },
    { name: 'Shampoo 350ml', description: 'Uso diário', price: 15.9, category: 'Higiene' },
    { name: 'Refrigerante 2L', description: 'Vários sabores', price: 9.99, category: 'Bebidas' },
    { name: 'Água Mineral 1,5L', description: 'Sem gás', price: 2.99, category: 'Bebidas' },
    { name: 'Biscoito Recheado 140g', description: 'Chocolate ou morango', price: 3.49, category: 'Biscoitos' },
    { name: 'Chocolate em Barra 90g', description: 'Ao leite', price: 6.99, category: 'Doces' },
  ],
  farmacia: [
    { name: 'Dipirona 500mg 20cp', description: 'Analgésico e antitérmico', price: 8.9, category: 'Medicamentos', popular: true },
    { name: 'Paracetamol 750mg 20cp', description: 'Alívio de dores e febre', price: 12.9, category: 'Medicamentos' },
    { name: 'Ibuprofeno 600mg 20cp', description: 'Anti-inflamatório', price: 18.9, category: 'Medicamentos' },
    { name: 'Omeprazol 20mg 28cp', description: 'Protetor gástrico', price: 22.9, category: 'Medicamentos' },
    { name: 'Loratadina 10mg 12cp', description: 'Antialérgico', price: 14.9, category: 'Medicamentos' },
    { name: 'Vitamina C 1000mg 30cp', description: 'Suporte à imunidade', price: 24.9, category: 'Vitaminas', popular: true },
    { name: 'Complexo B 60cp', description: 'Vitaminas do complexo B', price: 29.9, category: 'Vitaminas' },
    { name: 'Ômega 3 60cp', description: 'Óleo de peixe concentrado', price: 39.9, category: 'Vitaminas' },
    { name: 'Vitamina D 2000UI 60cp', description: 'Saúde óssea', price: 34.9, category: 'Vitaminas' },
    { name: 'Protetor Solar FPS 50', description: 'Toque seco 120ml', price: 49.9, category: 'Dermocosméticos', popular: true },
    { name: 'Hidratante Facial 50g', description: 'Pele normal a seca', price: 42.9, category: 'Dermocosméticos' },
    { name: 'Protetor Labial FPS 15', description: 'Com manteiga de karité', price: 12.9, category: 'Dermocosméticos' },
    { name: 'Sérum Vitamina C 30ml', description: 'Antioxidante facial', price: 59.9, category: 'Dermocosméticos' },
    { name: 'Álcool Gel 500ml', description: '70% higienizante', price: 12.9, category: 'Higiene' },
    { name: 'Máscara Cirúrgica (50un)', description: 'TNT descartável', price: 19.9, category: 'Higiene' },
    { name: 'Algodão Hidrófilo 50g', description: 'Uso medicinal', price: 6.9, category: 'Higiene' },
    { name: 'Curativo Adesivo (40un)', description: 'Diversas medidas', price: 9.9, category: 'Primeiros socorros' },
    { name: 'Gaze Estéril (10un)', description: 'Pacote hospitalar', price: 8.9, category: 'Primeiros socorros' },
    { name: 'Soro Fisiológico 500ml', description: 'Cloreto de sódio 0,9%', price: 7.9, category: 'Primeiros socorros' },
    { name: 'Termômetro Digital', description: 'Medição rápida', price: 29.9, category: 'Equipamentos', popular: true },
    { name: 'Inalador Nebulizador', description: 'Uso doméstico', price: 149.9, category: 'Equipamentos' },
    { name: 'Aparelho de Pressão', description: 'Digital de braço', price: 129.9, category: 'Equipamentos' },
    { name: 'Fralda Geriátrica G (8un)', description: 'Absorção máxima', price: 34.9, category: 'Cuidados' },
    { name: 'Lenço Umedecido (50un)', description: 'Suave para a pele', price: 14.9, category: 'Cuidados' },
    { name: 'Repelente Spray 100ml', description: 'Proteção 8h', price: 22.9, category: 'Cuidados' },
    { name: 'Colírio Lubrificante 15ml', description: 'Alívio dos olhos secos', price: 27.9, category: 'Medicamentos' },
    { name: 'Pastilha para Garganta', description: 'Sabor menta (12un)', price: 11.9, category: 'Medicamentos' },
    { name: 'Xarope Expectorante 120ml', description: 'Alívio da tosse', price: 26.9, category: 'Medicamentos' },
    { name: 'Teste de Gravidez', description: 'Resultado em minutos', price: 19.9, category: 'Testes' },
    { name: 'Kit Primeiros Socorros', description: 'Essenciais para casa', price: 79.9, category: 'Kits', popular: true },
    { name: 'Sabonete Antisséptico', description: 'Barra 90g', price: 8.9, category: 'Higiene' },
    { name: 'Creme Dental 90g', description: 'Com flúor', price: 6.49, category: 'Higiene' },
  ],
  distribuidora: [
    { name: 'Cerveja Long Neck (6un)', description: 'Pack gelado 355ml', price: 29.9, category: 'Cervejas', popular: true },
    { name: 'Cerveja Lata 350ml (12un)', description: 'Caixa fechada', price: 36.9, category: 'Cervejas', popular: true },
    { name: 'Cerveja Pilsen 600ml (6un)', description: 'Garrafas retornáveis', price: 34.9, category: 'Cervejas' },
    { name: 'Cerveja IPA 473ml (6un)', description: 'Artesanal lupulada', price: 49.9, category: 'Cervejas' },
    { name: 'Refrigerante 2L (6un)', description: 'Mix de sabores', price: 48.9, category: 'Refrigerantes' },
    { name: 'Refrigerante Lata (12un)', description: 'Pack econômico', price: 32.9, category: 'Refrigerantes', popular: true },
    { name: 'Água Mineral 1,5L (12un)', description: 'Pack sem gás', price: 18.9, category: 'Águas' },
    { name: 'Água com Gás 500ml (12un)', description: 'Pack premium', price: 28.9, category: 'Águas' },
    { name: 'Energético 250ml (6un)', description: 'Pack energia', price: 34.9, category: 'Energéticos', promo: 29.9 },
    { name: 'Energético 473ml (4un)', description: 'Lata grande', price: 27.9, category: 'Energéticos' },
    { name: 'Suco de Uva 1L (6un)', description: 'Integral', price: 69.9, category: 'Sucos' },
    { name: 'Suco de Laranja 1L (6un)', description: 'Néctar', price: 42.9, category: 'Sucos' },
    { name: 'Vinho Tinto Seco 750ml', description: 'Seleção da casa', price: 39.9, category: 'Vinhos', popular: true },
    { name: 'Vinho Branco Suave 750ml', description: 'Harmoniza com peixes', price: 34.9, category: 'Vinhos' },
    { name: 'Espumante Brut 750ml', description: 'Para celebrações', price: 54.9, category: 'Vinhos' },
    { name: 'Whisky 1L', description: 'Blended scotch', price: 99.9, category: 'Destilados' },
    { name: 'Vodka 1L', description: 'Premium', price: 69.9, category: 'Destilados' },
    { name: 'Gin 750ml', description: 'Botânicos selecionados', price: 89.9, category: 'Destilados' },
    { name: 'Gelo em Cubos 5kg', description: 'Saco para festas', price: 12.9, category: 'Extras' },
    { name: 'Copos Descartáveis (50un)', description: '300ml', price: 9.9, category: 'Extras' },
    { name: 'Carvão Vegetal 3kg', description: 'Para churrasco', price: 16.9, category: 'Extras' },
    { name: 'Isotônico 500ml (6un)', description: 'Sabores variados', price: 29.9, category: 'Isotônicos' },
    { name: 'Chá Gelado 1,5L (6un)', description: 'Limão e pêssego', price: 39.9, category: 'Chás' },
    { name: 'Café Gelado Lata (6un)', description: 'Pronto para beber', price: 27.9, category: 'Cafés' },
    { name: 'Kit Churrasco Bebidas', description: '12 cervejas + 2 refrigerantes 2L + gelo', price: 89.9, category: 'Kits', popular: true, promo: 79.9 },
    { name: 'Kit Festa 20 Pessoas', description: 'Bebidas variadas para eventos', price: 249.9, category: 'Kits' },
    { name: 'Água de Coco 1L (6un)', description: 'Natural', price: 36.9, category: 'Águas' },
    { name: 'Cerveja Sem Álcool (6un)', description: 'Long neck', price: 32.9, category: 'Cervejas' },
    { name: 'Licor Creme 700ml', description: 'Sobremesa alcoolizada', price: 59.9, category: 'Destilados' },
    { name: 'Mixers Tônica (6un)', description: 'Para drinks', price: 24.9, category: 'Mixers' },
    { name: 'Xarope para Drinks 750ml', description: 'Grenadine', price: 29.9, category: 'Mixers' },
    { name: 'Caixa Mista Premium', description: 'Seleção surpresa de 12 itens', price: 119.9, category: 'Kits' },
  ],
  padaria: [
    { name: 'Pão Francês (10un)', description: 'Recém-saído do forno', price: 12.0, category: 'Pães', popular: true },
    { name: 'Pão de Forma Integral', description: 'Fatiado 500g', price: 11.9, category: 'Pães' },
    { name: 'Pão Australiano', description: 'Unidade grande', price: 14.9, category: 'Pães' },
    { name: 'Pão de Queijo (10un)', description: 'Quentinho e macio', price: 16.9, category: 'Salgados', popular: true },
    { name: 'Croissant Manteiga', description: 'Folhado artesanal', price: 8.9, category: 'Salgados', popular: true },
    { name: 'Coxinha de Frango', description: 'Unidade generosa', price: 7.5, category: 'Salgados' },
    { name: 'Empada de Palmito', description: 'Massa amanteigada', price: 7.9, category: 'Salgados' },
    { name: 'Esfiha de Carne (4un)', description: 'Assada', price: 14.9, category: 'Salgados' },
    { name: 'Bolo de Cenoura Fatia', description: 'Com cobertura de chocolate', price: 9.9, category: 'Doces' },
    { name: 'Bolo de Chocolate Inteiro', description: 'Serve 8 fatias', price: 49.9, category: 'Doces', popular: true },
    { name: 'Sonho de Creme', description: 'Recheio generoso', price: 6.5, category: 'Doces' },
    { name: 'Brigadeiro Gourmet (6un)', description: 'Chocolate belga', price: 18.9, category: 'Doces' },
    { name: 'Torta de Limão Fatia', description: 'Merengue tostado', price: 12.9, category: 'Doces' },
    { name: 'Café Especial 300ml', description: 'Grãos selecionados', price: 7.9, category: 'Bebidas' },
    { name: 'Cappuccino 300ml', description: 'Espuma cremosa', price: 9.9, category: 'Bebidas' },
    { name: 'Chocolate Quente 300ml', description: 'Cacau 70%', price: 10.9, category: 'Bebidas' },
    { name: 'Suco Natural 300ml', description: 'Feito na hora', price: 8.9, category: 'Bebidas' },
    { name: 'Pão Doce com Creme', description: 'Unidade', price: 5.9, category: 'Doces' },
    { name: 'Rosca Doce com Coco', description: 'Serve 6', price: 22.9, category: 'Doces' },
    { name: 'Cuque Alemão', description: 'Com farofa doce', price: 24.9, category: 'Doces' },
    { name: 'Mini Quiches (4un)', description: 'Alho-poró e queijo', price: 19.9, category: 'Salgados' },
    { name: 'Focaccia Alecrim', description: 'Azeite e flor de sal', price: 16.9, category: 'Pães' },
    { name: 'Baguete Crocante', description: 'Ideal para sanduíches', price: 8.9, category: 'Pães' },
    { name: 'Sanduíche Natural', description: 'Peito de peru e salada', price: 14.9, category: 'Lanches' },
    { name: 'Misto Quente', description: 'Presunto e queijo na chapa', price: 12.9, category: 'Lanches' },
    { name: 'Torrada com Geleia', description: 'Acompanha manteiga', price: 11.9, category: 'Lanches' },
    { name: 'Kit Café da Manhã', description: 'Pães, frios, café e suco', price: 39.9, category: 'Kits', popular: true, promo: 34.9 },
    { name: 'Cookie Chocolate (3un)', description: 'Recém-assado', price: 12.9, category: 'Doces' },
    { name: 'Pão Sírio (5un)', description: 'Para wraps', price: 9.9, category: 'Pães' },
    { name: 'Broa de Milho', description: 'Tradicional', price: 6.9, category: 'Pães' },
    { name: 'Torta Salgada Fatia', description: 'Frango com catupiry', price: 11.9, category: 'Salgados' },
    { name: 'Churros (2un)', description: 'Doce de leite', price: 10.9, category: 'Doces' },
  ],
  bebidas: [
    { name: 'Cerveja Premium Long Neck', description: 'Unidade 355ml', price: 7.9, category: 'Cervejas', popular: true },
    { name: 'Pack Cerveja (6un)', description: 'Marcas variadas', price: 32.9, category: 'Cervejas', popular: true },
    { name: 'Chop Delivery 1L', description: 'Gelado na hora', price: 24.9, category: 'Cervejas' },
    { name: 'Vinho Tinto Reservado', description: 'Garrafa 750ml', price: 59.9, category: 'Vinhos' },
    { name: 'Vinho Rosé', description: 'Leve e frutado', price: 49.9, category: 'Vinhos' },
    { name: 'Espumante Moscatel', description: 'Doce e gelado', price: 44.9, category: 'Vinhos' },
    { name: 'Refrigerante 2L', description: 'Principal marca', price: 10.9, category: 'Refrigerantes' },
    { name: 'Refrigerante Zero 2L', description: 'Sem açúcar', price: 10.9, category: 'Refrigerantes' },
    { name: 'Água Premium 500ml', description: 'Garrafa de vidro', price: 6.9, category: 'Águas' },
    { name: 'Água Comum 1,5L', description: 'Sem gás', price: 3.49, category: 'Águas' },
    { name: 'Energético Original', description: 'Lata 250ml', price: 9.9, category: 'Energéticos' },
    { name: 'Energético Zero', description: 'Lata 250ml', price: 9.9, category: 'Energéticos' },
    { name: 'Suco Detox 500ml', description: 'Couve, limão e gengibre', price: 14.9, category: 'Sucos', popular: true },
    { name: 'Suco Verde 500ml', description: 'Maçã, couve e hortelã', price: 14.9, category: 'Sucos' },
    { name: 'Suco de Laranja 1L', description: 'Natural espremido', price: 16.9, category: 'Sucos' },
    { name: 'Smoothie Morango', description: '400ml cremoso', price: 18.9, category: 'Smoothies' },
    { name: 'Smoothie Banana', description: 'Com pasta de amendoim', price: 18.9, category: 'Smoothies' },
    { name: 'Chá Mate Gelado', description: '1L limão', price: 8.9, category: 'Chás' },
    { name: 'Chá Verde Gelado', description: '500ml', price: 7.9, category: 'Chás' },
    { name: 'Café Cold Brew', description: '350ml intenso', price: 12.9, category: 'Cafés' },
    { name: 'Latte Gelado', description: '300ml', price: 13.9, category: 'Cafés' },
    { name: 'Whisky Dose 50ml', description: 'Para viagem', price: 19.9, category: 'Destilados' },
    { name: 'Gin Tônica Pronto', description: 'Lata 269ml', price: 12.9, category: 'Drinks' },
    { name: 'Drink Mojito Kit', description: 'Pré-mix para 4 doses', price: 39.9, category: 'Drinks' },
    { name: 'Isotônico 500ml', description: 'Reposição', price: 6.9, category: 'Isotônicos' },
    { name: 'Água de Coco 1L', description: 'Natural', price: 9.9, category: 'Águas' },
    { name: 'Kombucha 300ml', description: 'Gengibre e limão', price: 14.9, category: 'Funcionais' },
    { name: 'Kit Hidratação', description: '6 águas + 2 isotônicos', price: 29.9, category: 'Kits', popular: true },
    { name: 'Kit Happy Hour', description: '6 cervejas + petiscos partner', price: 54.9, category: 'Kits', promo: 49.9 },
    { name: 'Leite Vegetal 1L', description: 'Aveia ou amêndoas', price: 12.9, category: 'Alternativos' },
    { name: 'Kefir Pronto 500ml', description: 'Probiótico', price: 15.9, category: 'Funcionais' },
    { name: 'Shot Vitamina 100ml', description: 'Imunidade', price: 9.9, category: 'Funcionais' },
  ],
  conveniencia: [
    { name: 'Kit Café da Manhã', description: 'Pão, manteiga, café e suco', price: 19.9, category: 'Kits', popular: true },
    { name: 'Kit Lanche Rápido', description: 'Sanduíche + refrigerante lata', price: 16.9, category: 'Kits' },
    { name: 'Macarrão Instantâneo', description: 'Sabor galinha', price: 3.49, category: 'Mercearia' },
    { name: 'Salgadinho 45g', description: 'Vários sabores', price: 4.99, category: 'Snacks' },
    { name: 'Chocolate ao Leite 90g', description: 'Barra', price: 6.99, category: 'Doces' },
    { name: 'Bala Mastigável 100g', description: 'Sortidas', price: 5.49, category: 'Doces' },
    { name: 'Pilha AA (4un)', description: 'Alcalinas', price: 14.9, category: 'Utilidades' },
    { name: 'Pilha AAA (4un)', description: 'Alcalinas', price: 14.9, category: 'Utilidades' },
    { name: 'Isqueiro', description: 'Recarregável', price: 7.9, category: 'Utilidades' },
    { name: 'Carregador USB-C', description: 'Cabo 1m', price: 29.9, category: 'Utilidades' },
    { name: 'Fone de Ouvido', description: 'Com fio P2', price: 24.9, category: 'Utilidades' },
    { name: 'Água 500ml', description: 'Gelada', price: 2.99, category: 'Bebidas' },
    { name: 'Refrigerante Lata', description: '350ml', price: 5.99, category: 'Bebidas', popular: true },
    { name: 'Energético Lata', description: '250ml', price: 9.9, category: 'Bebidas' },
    { name: 'Café Pronto Copo', description: '200ml', price: 6.9, category: 'Bebidas' },
    { name: 'Sanduíche Natural', description: 'Pronto para consumo', price: 12.9, category: 'Lanches', popular: true },
    { name: 'Wrap de Frango', description: 'Tortilla e molho especial', price: 14.9, category: 'Lanches' },
    { name: 'Yogurte 170g', description: 'Sabores', price: 3.99, category: 'Laticínios' },
    { name: 'Queijo Minas 300g', description: 'Frescal', price: 16.9, category: 'Laticínios' },
    { name: 'Presunto Fatiado 200g', description: 'Cozido', price: 12.9, category: 'Frios' },
    { name: 'Guardanapo (50un)', description: 'Pacote', price: 4.9, category: 'Casa' },
    { name: 'Saco de Lixo 30L (20un)', description: 'Reforçado', price: 9.9, category: 'Casa' },
    { name: 'Papel Toalha', description: 'Rolo duplo', price: 6.9, category: 'Casa' },
    { name: 'Sabonete', description: 'Unidade 90g', price: 2.99, category: 'Higiene' },
    { name: 'Pasta de Dente', description: '90g', price: 5.99, category: 'Higiene' },
    { name: 'Escova de Dente', description: 'Média', price: 8.9, category: 'Higiene' },
    { name: 'Desinfetante 500ml', description: 'Aroma suave', price: 7.9, category: 'Limpeza' },
    { name: 'Esponja Multiuso (3un)', description: 'Cozinha', price: 4.49, category: 'Limpeza' },
    { name: 'Garrafa Térmica 500ml', description: 'Inox', price: 49.9, category: 'Utilidades' },
    { name: 'Guarda-chuva Compacto', description: 'Dobrável', price: 34.9, category: 'Utilidades' },
    { name: 'Kit Churrasco Express', description: 'Carvão + isqueiro + carne temperada', price: 59.9, category: 'Kits', popular: true },
    { name: 'Sorvete Picolé', description: 'Sabores gelados', price: 4.5, category: 'Congelados' },
  ],
};

function mapProductToMenuItem(
  product: MucugeProduct | ProductTemplate,
  businessId: string,
  shopIndex: number,
  index: number,
  shopCategory?: BusinessCategory
): MenuItem {
  const addonGroups = getAddonGroupsForCategory(product.category);
  const customImage = 'image' in product ? product.image : undefined;
  const image = customImage || productImage(product.name, product.category, shopIndex + index);
  const item: MenuItem = {
    id: `${businessId}-p${index + 1}`,
    name: product.name,
    description: product.description,
    details: buildItemDetails(product.name, product.description, product.category),
    price: product.price,
    image,
    images: productGallery(product.name, product.category, shopIndex + index, image),
    category: product.category,
  };
  if (product.popular) item.popular = true;
  if (product.promo != null) item.promo = product.promo;
  if (addonGroups?.length) item.addonGroups = addonGroups;
  if (shopCategory === 'conveniencia') item.convenience = true;
  return item;
}

function buildMenu(
  businessId: string,
  shop: MucugeShop,
  shopIndex: number
): MenuItem[] {
  const catalog = PRODUCT_CATALOGS[shop.category] ?? [];
  const custom = shop.products ?? [];
  /** Especialidades da loja primeiro; depois o catálogo completo da categoria (ex.: Pudim). */
  const seen = new Set<string>();
  const merged: Array<MucugeProduct | ProductTemplate> = [];
  for (const product of [...custom, ...catalog]) {
    const key = product.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(product);
  }
  return merged.map((product, index) =>
    mapProductToMenuItem(product, businessId, shopIndex, index, shop.category)
  );
}

function buildBusinessesFromShops(
  shops: MucugeShop[],
  tokenCity = 'LOCAL'
): Business[] {
  return shops.map((shop, index) => {
    const id = `seed-${tokenCity.toLowerCase()}-${index + 1}`;
    const distanceKm = (shop.distanceKm ?? 0.3 + (index % 20) * 0.15).toFixed(1);
    const deliveryFee = 5;
    const sellsDrinks =
      shop.category === 'restaurante' ||
      shop.category === 'bebidas' ||
      shop.category === 'distribuidora' ||
      shop.category === 'padaria' ||
      shop.category === 'conveniencia' ||
      shop.category === 'mercado';

    const operatingCity = getActiveCatalogCityName();
    // Pin estável na cidade (frete/OSRM). Parceiros reais sobrescrevem via MerchantShop.
    const pin = resolveBusinessCoords(id, shop.name);
    return {
      id,
      name: shop.name,
      city: operatingCity && operatingCity !== 'sua cidade' ? operatingCity : undefined,
      description: shop.description,
      category: shop.category,
      image: shop.image || storeImage(shop.category, index, 'logo'),
      coverImage: shop.coverImage || storeImage(shop.category, index + 2, 'cover'),
      rating: shop.rating ?? Math.round((4.2 + (index % 8) * 0.1) * 10) / 10,
      reviewCount: shop.reviewCount ?? 80 + index * 37,
      deliveryTime:
        shop.deliveryTime ?? `${15 + (index % 6) * 5}-${25 + (index % 6) * 5} min`,
      deliveryFee,
      minOrder: 0,
      distance: `${distanceKm} km`,
      distanceKm: Number(distanceKm),
      latitude: pin.latitude,
      longitude: pin.longitude,
      hours:
        shop.category === 'farmacia'
          ? '07:00–23:00'
          : shop.category === 'conveniencia' || shop.category === 'bebidas'
            ? '10:00–00:00'
            : '08:00–22:00',
      // Alguns fechados no mock para o cliente ver o aviso claro
      isOpen: shop.isOpen ?? index % 11 !== 0,
      tags: shop.tags,
      sellsDrinks,
      plan: shop.plan,
      // Seeds não fingem OAuth MP conectado
      mpAccessToken: undefined,
      menu: buildMenu(id, shop, index),
    };
  });
}

/** Pack exclusivo da cidade demo ativa (sem misturar cidades). */
function getSeedShops(): MucugeShop[] {
  return getShopsForActiveCity();
}

let seedBusinessesCacheKey = '';
let seedBusinessesCache: Business[] = [];

/** Seeds memoizados por cidade demo — evita novo objeto a cada getBusinessById. */
export function getSeedBusinesses(): Business[] {
  const token = getDemoTokenCity();
  const city = getActiveCatalogCityName() || '';
  const key = `${token}::${city}::op`;
  if (key === seedBusinessesCacheKey && seedBusinessesCache.length > 0) {
    return seedBusinessesCache;
  }
  seedBusinessesCacheKey = key;
  seedBusinessesCache = buildBusinessesFromShops(getSeedShops(), token);
  return seedBusinessesCache;
}

/** Fallback estático (Mucugê) — preferir getAllBusinesses() / getSeedBusinesses(). */
export const businesses: Business[] = buildBusinessesFromShops(MUCUGE_SHOPS);

export type DestaqueSuggestion = {
  id: string;
  itemId: string;
  headline: string;
  subtitle: string;
  hook: string;
  image: string;
  businessId: string;
  businessName: string;
  rating: number;
  deliveryTime: string;
  price: number;
  promo?: number;
  kind: 'combo' | 'produto';
};

const SUGGESTION_HOOKS = [
  'Queridinho da casa',
  'Vale cada pedido',
  'Perfeito pra agora',
  'Sucesso de vendas',
  'Combina com sua fome',
  'Escolha dos clientes',
];

function isComboItem(item: MenuItem): boolean {
  const text = `${item.name} ${item.category}`.toLowerCase();
  return text.includes('combo') || text.includes('kit') || text.includes('duo') || text.includes('pack');
}

function scoreSuggestionItem(item: MenuItem): number {
  let score = 0;
  if (isComboItem(item)) score += 4;
  if (item.popular) score += 3;
  if (item.promo) score += 2;
  if (item.category !== 'Bebidas') score += 1;
  return score;
}

/** Restaurantes assinantes do pacote Destaque (mais caro). */
export function getDestaqueRestaurants(): Business[] {
  return getAllBusinesses().filter(
    (b) => b.category === 'restaurante' && b.plan === TOP_MERCHANT_PLAN
  );
}

/**
 * Sugestões atrativas para a busca: combos e produtos
 * só de restaurantes no pacote mais caro.
 */
export function getDestaqueSearchSuggestions(limit = 10): DestaqueSuggestion[] {
  const shops = getDestaqueRestaurants().filter((b) => b.isOpen);
  const picks: DestaqueSuggestion[] = [];

  shops.forEach((shop, shopIndex) => {
    const candidates = [...shop.menu]
      .filter((m) => m.category !== 'Bebidas')
      .sort((a, b) => scoreSuggestionItem(b) - scoreSuggestionItem(a))
      .slice(0, 3);

    candidates.forEach((item, itemIndex) => {
      picks.push({
        id: `${shop.id}-${item.id}`,
        itemId: item.id,
        headline: item.name,
        subtitle: shop.name,
        hook: isComboItem(item)
          ? 'Combo em destaque'
          : SUGGESTION_HOOKS[(shopIndex + itemIndex) % SUGGESTION_HOOKS.length],
        image: item.image,
        businessId: shop.id,
        businessName: shop.name,
        rating: shop.rating,
        deliveryTime: shop.deliveryTime,
        price: item.price,
        promo: item.promo,
        kind: isComboItem(item) ? 'combo' : 'produto',
      });
    });
  });

  return picks
    .sort((a, b) => {
      const aScore = (a.kind === 'combo' ? 3 : 0) + (a.promo ? 2 : 0) + a.rating;
      const bScore = (b.kind === 'combo' ? 3 : 0) + (b.promo ? 2 : 0) + b.rating;
      return bScore - aScore;
    })
    .slice(0, limit);
}

export type PromoBannerItem = {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  image: string;
  /** Categoria para filtrar na Home / Busca. */
  category?: BusinessCategory;
  /** Query sugerida na busca. */
  searchQuery?: string;
  /** Restaurante da oferta. Toque abre a loja. */
  businessId?: string;
  /** Prato da oferta. Toque abre esse item. */
  itemId?: string;
};

function offerPrice(item: MenuItem): number {
  const merchant =
    item.promo != null && item.promo > 0 && item.promo < item.price ? item.promo : item.price;
  return customerUnitPrice(merchant);
}

function cheapest(items: MenuItem[]): MenuItem {
  return items.reduce((best, cur) => (offerPrice(cur) < offerPrice(best) ? cur : best));
}

const HERO_CATEGORIES = new Set(['Pratos', 'Burgers', 'Pizzas', 'Massas', 'Combos', 'Entradas']);

/** Um prato principal da casa, variando entre os restaurantes. */
function heroDish(items: MenuItem[], shopId: string): MenuItem {
  const mains = items.filter((item) => HERO_CATEGORIES.has(item.category));
  const popular = (mains.length ? mains : items).filter((item) => item.popular);
  const pool = popular.length ? popular : mains.length ? mains : items;
  const sorted = [...pool].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  let hash = 0;
  for (let i = 0; i < shopId.length; i++) hash += shopId.charCodeAt(i);
  return sorted[hash % sorted.length];
}

/**
 * Painel da home: uma publicidade por restaurante cadastrado.
 * Quem tem combo entra com "Combos a partir de…". Os outros entram com o prato em oferta.
 */
export function getRestaurantPromoBanners(source?: Business[]): PromoBannerItem[] {
  const all = source ?? getAllBusinesses();
  const restaurants = all.filter((b) => b.category === 'restaurante' && b.menu?.length);
  const open = restaurants.filter((b) => b.isOpen);
  const pool = open.length >= 4 ? open : restaurants;

  const ads = pool
    .map((shop) => {
      const menu = shop.menu.filter((item) => item.available !== false);
      const ownCombos = menu.filter(
        (item) => isComboItem(item) && item.name.trim().toLowerCase() !== 'combo família'
      );
      const promos = menu.filter(
        (item) =>
          !isComboItem(item) &&
          item.promo != null &&
          item.promo > 0 &&
          item.promo < item.price &&
          item.category !== 'Bebidas'
      );
      const popular = menu.filter((item) => item.popular && item.category !== 'Bebidas');
      const dishes = menu.filter((item) => item.category !== 'Bebidas');
      const familyCombo = menu.find((item) => item.name.trim().toLowerCase() === 'combo família');

      let item: MenuItem | undefined;
      let title = '';
      let rank = 0;
      if (ownCombos.length) {
        item = cheapest(ownCombos);
        title = `Combos a partir de ${formatPrice(offerPrice(item))}`;
        rank = 30;
      } else if (promos.length || popular.length || dishes.length) {
        const pool = (promos.length ? promos : popular.length ? popular : dishes).filter(
          (entry) => entry.name.trim().toLowerCase() !== 'combo família'
        );
        item = heroDish(pool.length ? pool : dishes, shop.id);
        const priced = formatPrice(offerPrice(item));
        const onPromo = item.promo != null && item.promo > 0 && item.promo < item.price;
        title = onPromo ? `${item.name} por ${priced}` : `${item.name} a partir de ${priced}`;
        rank = onPromo ? 20 : 10;
      } else if (familyCombo) {
        item = familyCombo;
        title = `Combos a partir de ${formatPrice(offerPrice(item))}`;
        rank = 5;
      }
      if (!item) return null;
      if (shop.plan === TOP_MERCHANT_PLAN) rank += 2;
      if (shop.isOpen) rank += 1;
      const banner: PromoBannerItem = {
        id: `ad-${shop.id}`,
        title,
        subtitle: shop.name,
        color: '#111827',
        image: bannerFoodImage(item, shop.id),
        businessId: shop.id,
        itemId: item.id,
      };
      return { banner, rank, rating: shop.rating };
    })
    .filter((row): row is { banner: PromoBannerItem; rank: number; rating: number } => !!row)
    .sort((a, b) => b.rank - a.rank || b.rating - a.rating)
    .slice(0, 8)
    .map((row) => row.banner);

  return ads;
}

export const banners: PromoBannerItem[] = [
  {
    id: 'b1',
    title: 'Mucugê no Peça Já',
    subtitle: 'Comércios reais da Chapada Diamantina',
    color: '#00A86B',
    image: u('photo-1504674900247-0877df9cc836', 600, 300),
    searchQuery: 'restaurante',
  },
  {
    id: 'b2',
    title: 'Farma Mucugê',
    subtitle: 'Medicamentos com entrega rápida',
    color: '#3B82F6',
    image: u('photo-1576091160399-112ba8d25d1d', 600, 300),
    category: 'farmacia',
  },
  {
    id: 'b3',
    title: 'Mercado em casa',
    subtitle: 'Oliveira e Mercado Municipal',
    color: '#8B5CF6',
    image: u('photo-1604719312566-8912e9227c6a', 600, 300),
    category: 'mercado',
  },
  {
    id: 'b4',
    title: 'Pizza da Chapada',
    subtitle: "Point da Chapada e d'Enrico",
    color: '#FF6B35',
    image: u('photo-1513104890138-7c749659a591', 600, 300),
    category: 'restaurante',
    searchQuery: 'pizza',
  },
  {
    id: 'b5',
    title: 'Padaria Diamantina',
    subtitle: 'Pães frescos saindo do forno',
    color: '#D97706',
    image: u('photo-1509440159596-0249088772ff', 600, 300),
    category: 'padaria',
  },
  {
    id: 'b6',
    title: 'Bebidas geladas',
    subtitle: 'Depósito e Adega da Chapada',
    color: '#EC4899',
    image: u('photo-1608270586620-248524c67de9', 600, 300),
    category: 'bebidas',
  },
  {
    id: 'b7',
    title: 'Parceiros Destaque',
    subtitle: 'Paraguassú, Casa Amarela e mais',
    color: '#007A4D',
    image: u('photo-1414235077428-338989a2e8c0', 600, 300),
    category: 'restaurante',
  },
  {
    id: 'b8',
    title: 'Conveniência Mucugê',
    subtitle: 'O essencial quando você precisa',
    color: '#14B8A6',
    image: u('photo-1601593346740-925612772716', 600, 300),
    category: 'conveniencia',
  },
];

const CAPAO_BANNERS: PromoBannerItem[] = [
  {
    id: 'c1',
    title: 'Vale do Capão no Peça Já',
    subtitle: 'Pousadas, trilha e comércio do vale',
    color: '#2D6A4F',
    image: u('photo-1504674900247-0877df9cc836', 600, 300),
    searchQuery: 'restaurante',
  },
  {
    id: 'c2',
    title: 'Farmácia Capão Vida',
    subtitle: 'Protetor, repelente e primeiros socorros',
    color: '#3B82F6',
    image: u('photo-1576602976047-174e57a47881', 600, 300),
    category: 'farmacia',
  },
  {
    id: 'c3',
    title: 'Mercadinho do Vale',
    subtitle: 'Mantimentos e hortifruti pra pousada',
    color: '#8B5CF6',
    image: u('photo-1578916171728-46686eac8d58', 600, 300),
    category: 'mercado',
  },
  {
    id: 'c4',
    title: 'Pizza do Fogo',
    subtitle: 'Forno a lenha no Vale do Capão',
    color: '#FF6B35',
    image: u('photo-1513104890138-7c749659a591', 600, 300),
    category: 'restaurante',
    searchQuery: 'pizza',
  },
  {
    id: 'c5',
    title: 'Padaria Trilha do Sol',
    subtitle: 'Pão quentinho antes da trilha',
    color: '#D97706',
    image: u('photo-1509440159596-0249088772ff', 600, 300),
    category: 'padaria',
  },
  {
    id: 'c6',
    title: 'Depósito Gelado Capão',
    subtitle: 'Cerveja, gelo e refri no vale',
    color: '#EC4899',
    image: u('photo-1608270586620-248524c67de9', 600, 300),
    category: 'bebidas',
  },
  {
    id: 'c7',
    title: 'Açaí da Cachoeira',
    subtitle: 'Batido na hora com frutas da região',
    color: '#007A4D',
    image: u('photo-1590301157890-4810ed352733', 600, 300),
    category: 'restaurante',
    searchQuery: 'açaí',
  },
  {
    id: 'c8',
    title: 'Conveniência Portal',
    subtitle: 'O essencial pra mochila e pousada',
    color: '#14B8A6',
    image: u('photo-1601593346740-925612772716', 600, 300),
    category: 'conveniencia',
  },
];

/** Banners da home: ofertas dos restaurantes. Nichos só se a cidade não tiver restaurante. */
export function getPromoBanners(gpsCity?: string | null): PromoBannerItem[] {
  const ads = getRestaurantPromoBanners();
  if (ads.length) return ads;
  const id = getDemoLocationIdSync();
  if (id === 'vale-do-capao') return CAPAO_BANNERS;
  if (id === 'mucuge') return banners;
  const city = (gpsCity || getActiveCatalogCityName() || 'sua cidade').trim() || 'sua cidade';
  if (city === 'Mucugê') return banners;
  return [
    {
      id: 'g1',
      title: `${city === 'sua cidade' ? 'Peça Já' : `${city} no Peça Já`}`,
      subtitle: 'Comércios locais com entrega perto de você',
      color: '#00A86B',
      image: u('photo-1504674900247-0877df9cc836', 600, 300),
      searchQuery: 'restaurante',
    },
    {
      id: 'g2',
      title: city === 'sua cidade' ? 'Farmácia perto' : `Farmácia em ${city}`,
      subtitle: 'Medicamentos com entrega rápida',
      color: '#3B82F6',
      image: u('photo-1576091160399-112ba8d25d1d', 600, 300),
      category: 'farmacia',
    },
    {
      id: 'g3',
      title: 'Mercado em casa',
      subtitle:
        city === 'sua cidade'
          ? 'Mantimentos e hortifruti na sua região'
          : `Mantimentos e hortifruti em ${city}`,
      color: '#8B5CF6',
      image: u('photo-1604719312566-8912e9227c6a', 600, 300),
      category: 'mercado',
    },
    {
      id: 'g4',
      title: city === 'sua cidade' ? 'Restaurantes perto' : `Restaurantes de ${city}`,
      subtitle: 'Os melhores perto de você',
      color: '#FF6B35',
      image: u('photo-1414235077428-338989a2e8c0', 600, 300),
      category: 'restaurante',
    },
  ];
}

/** Comércios cadastrados pelo painel (parceiros) — hidratados do AsyncStorage. */
let partnerBusinessesCache: Business[] = [];

export function setPartnerBusinessesCache(list: Business[]) {
  partnerBusinessesCache = Array.isArray(list) ? list : [];
}

export function getPartnerBusinesses(): Business[] {
  return partnerBusinessesCache;
}

/** Catálogo do cliente: só lojas da cidade em que ele está. */
export function getAllBusinesses(viewerCity?: string | null): Business[] {
  const city = (viewerCity || getActiveDemoLocation()?.city || '').trim();
  const byId = new Map<string, Business>();
  if (!city || city.toLowerCase() === 'sua cidade') return [];
  for (const b of getSeedBusinesses()) {
    if (sameOperatingCity(b.city, city)) byId.set(b.id, b);
  }
  for (const b of partnerBusinessesCache) {
    if (sameOperatingCity(b.city, city)) byId.set(b.id, b);
  }
  return Array.from(byId.values());
}

export function getBusinessById(id: string): Business | undefined {
  return (
    partnerBusinessesCache.find((b) => b.id === id) ||
    getSeedBusinesses().find((b) => b.id === id)
  );
}

export function formatPrice(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
