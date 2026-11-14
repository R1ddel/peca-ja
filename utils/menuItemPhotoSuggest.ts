/**
 * Sugestão de foto do item pelo nome (e seção).
 * Não é 100% preciso: a loja confirma ou troca pela foto dela.
 */

const unsplash = (id: string, w = 400, h = 300) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

/** IDs Unsplash por tipo / prato conhecido. */
export const MENU_ITEM_PHOTO_POOLS: Record<string, string[]> = {
  default: [
    'photo-1546069901-ba9599a7e63c',
    'photo-1504674900247-0877df9cc836',
    'photo-1567620905732-2d1ec7ab7445',
  ],
  prato: [
    'photo-1546069901-ba9599a7e63c',
    'photo-1608039829572-7854f8c4ebd4',
    'photo-1467003909585-2f8a72700288',
    'photo-1432139509613-5c4255815697',
  ],
  feijoada: [
    'photo-1547592166-23ac45744acd',
    'photo-1608039829572-7854f8c4ebd4',
    'photo-1467003909585-2f8a72700288',
  ],
  strogonoff: [
    'photo-1608039829572-7854f8c4ebd4',
    'photo-1432139509613-5c4255815697',
    'photo-1546069901-ba9599a7e63c',
  ],
  parmegiana: [
    'photo-1432139509613-5c4255815697',
    'photo-1467003909585-2f8a72700288',
    'photo-1608039829572-7854f8c4ebd4',
  ],
  pizza: [
    'photo-1513104890138-7c749659a591',
    'photo-1574071318508-1cdbab80d002',
    'photo-1628840042765-356cda07504e',
    'photo-1565299624946-b28f40a0ae38',
  ],
  pizza_calabresa: [
    'photo-1628840042765-356cda07504e',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1513104890138-7c749659a591',
    'photo-1574071318508-1cdbab80d002',
  ],
  pizza_mussarela: [
    'photo-1574071318508-1cdbab80d002',
    'photo-1513104890138-7c749659a591',
    'photo-1565299624946-b28f40a0ae38',
  ],
  burger: [
    'photo-1568901347635-c0230a490990',
    'photo-1550547660-d9450f859349',
    'photo-1571091718767-18b5b1457add',
    'photo-1594212699903-ec8a3eca50f5',
  ],
  massa: [
    'photo-1621996346565-e3dbc646d9a9',
    'photo-1551892374-ecf8754cf8b0',
    'photo-1598866594230-a7c12756260f',
  ],
  lasanha: [
    'photo-1551892374-ecf8754cf8b0',
    'photo-1621996346565-e3dbc646d9a9',
    'photo-1598866594230-a7c12756260f',
  ],
  salada: [
    'photo-1512621776951-a57141f2eefd',
    'photo-1540420773420-3366772f4999',
    'photo-1546793665-c74683f339c1',
  ],
  sobremesa: [
    'photo-1578985545062-69928b1d9587',
    'photo-1587314168485-3236d6710814',
    'photo-1606313564200-e75d5e30476c',
    'photo-1488477181946-6428a0291777',
  ],
  acai: ['photo-1590301157890-4810ed352733', 'photo-1488477181946-6428a0291777'],
  batata: ['photo-1573080496219-bb080dd4f877', 'photo-1630384060421-cb28817995c1'],
  entrada: ['photo-1601050690597-df0568f70950', 'photo-1626700051175-6818013e1d4f'],
  coxinha: ['photo-1626700051175-6818013e1d4f', 'photo-1601050690597-df0568f70950'],
  pastel: ['photo-1601050690597-df0568f70950', 'photo-1626700051175-6818013e1d4f'],
  esfiha: ['photo-1601050690597-df0568f70950', 'photo-1626700051175-6818013e1d4f'],
  suco: [
    'photo-1622597467836-f3285f2131b8',
    'photo-1600271886742-f049cd451bba',
    'photo-1523677011781-c91d1bbe7241',
  ],
  refrigerante: ['photo-1622483767028-3ff66e4bb782', 'photo-1629203851122-3726ecdf080e'],
  agua: ['photo-1548839140-29a7492991a9', 'photo-1560026301-8833a940b848'],
  milkshake: ['photo-1572490122747-3964b21cbd69', 'photo-1579954115545-a9551373057c'],
  cafe: [
    'photo-1495474472287-4d89b1ccc336',
    'photo-1509042239860-f550ce710b93',
    'photo-1511920170033-f8396924c348',
  ],
  cerveja: [
    'photo-1608270586620-248524c67de9',
    'photo-1535958636474-b021ee887b13',
    'photo-1618885472179-5e474019f2c3',
  ],
  vinho: [
    'photo-1510812431401-41d2bd2722f3',
    'photo-1506377247377-2a5b3b417ebb',
    'photo-1474722883778-79220a8abce9',
  ],
  energetico: ['photo-1558618666-fcd25c85cd64', 'photo-1622543921706-6c7f01b8e0e4'],
  whisky: ['photo-1527281400683-1aae777175f8', 'photo-1569529463441-c963b3b55005'],
  drink: ['photo-1514362545857-3bc16c4c7d1b', 'photo-1556679343-c7306c1976bc'],
  pao: [
    'photo-1509440159596-0249088772ff',
    'photo-1549931319-a545dcf3bc73',
    'photo-1555507036-ab1f4038808a',
  ],
  doce: [
    'photo-1578985545062-69928b1d9587',
    'photo-1486427944299-d1955d23e34d',
    'photo-1606313564200-e75d5e30476c',
  ],
  salgado: ['photo-1601050690597-df0568f70950', 'photo-1626700051175-6818013e1d4f'],
  arroz: ['photo-1586201375761-83865001e31c', 'photo-1536304993881-ff6e9eefa2a6'],
  feijao: ['photo-1596797038530-2c107229654b', 'photo-1586201375761-83865001e31c'],
  leite: ['photo-1563636619-914303474212', 'photo-1550583724-b2692b85b150'],
  queijo: ['photo-1486297678162-eb2a19b0a32d', 'photo-1452195100486-9cc805987862'],
  fruta: [
    'photo-1571771894821-ce9b6c11d08e',
    'photo-1610832958506-aa56368176cf',
    'photo-1560806887-1e4cd0b6cbd6',
  ],
  hortifruti: [
    'photo-1540420773420-3366772f4999',
    'photo-1597362920021-2cb3a50a1c2f',
    'photo-1518977956812-cd3d692e4473',
  ],
  carne: ['photo-1603048297172-c92544767ff4', 'photo-1529692236671-f1f6cf9683ba'],
  limpeza: ['photo-1583947215250-de1766684f62', 'photo-1563453392212-326f5e854473'],
  higiene: ['photo-1556228578-0d85b1a4d571', 'photo-1584308666744-24d5c474f2ae'],
  medicamento: [
    'photo-1584308666744-24d5c474f2ae',
    'photo-1471864190281-a93a3070b6de',
    'photo-1587854692152-cf660b4c48ea',
  ],
  vitamina: ['photo-1550572017-edd951aa8b8a', 'photo-1505751172876-fa5741dbc594'],
  protetor: ['photo-1556228720-195a672e8a03', 'photo-1571781926291-c477ebfd024b'],
  equipamento: ['photo-1584515933487-7798240a0708', 'photo-1631549916768-4119b2e5f926'],
  snack: ['photo-1621939514644-15479cfa5bd7', 'photo-1599490659213-e2b925b5b95c'],
  chocolate: ['photo-1549007994-cb92aaebd54b', 'photo-1606313564200-e75d5e30476c'],
  utilidade: ['photo-1609091839311-d5365f9ff1c5', 'photo-1558618666-fcd25c85cd64'],
  kit: ['photo-1607083206869-4c797edcb84c', 'photo-1607082349566-187342175e2f'],
  combo: [
    'photo-1550547660-d9450f859349',
    'photo-1571091718767-18b5b1457add',
    'photo-1513104890138-7c749659a591',
    'photo-1565299624946-b28f40a0ae38',
    'photo-1555939594-58d7cb561ad1',
    'photo-1504674900247-0877df9cc836',
    'photo-1467003909585-2f8a72700288',
    'photo-1414235077428-338989a2e8c0',
    'photo-1546069901-ba9599a7e63c',
    'photo-1567620905732-2d1ec7ab7445',
  ],
  smoothie: ['photo-1505252585461-04db1eb6788a', 'photo-1638176066601-c62db8d3355f'],
  cha: ['photo-1556679343-c7306c1976bc', 'photo-1576092768241-dec231879fc3'],
};

const PHOTO_LABELS: Record<string, string> = {
  default: 'Foto genérica',
  prato: 'Prato feito',
  feijoada: 'Feijoada',
  strogonoff: 'Strogonoff',
  parmegiana: 'Parmegiana',
  pizza: 'Pizza',
  pizza_calabresa: 'Pizza de calabresa',
  pizza_mussarela: 'Pizza de mussarela',
  burger: 'Hambúrguer',
  massa: 'Massa',
  lasanha: 'Lasanha',
  salada: 'Salada',
  sobremesa: 'Sobremesa',
  acai: 'Açaí',
  batata: 'Batata',
  entrada: 'Salgado / entrada',
  coxinha: 'Coxinha',
  pastel: 'Pastel',
  esfiha: 'Esfiha',
  suco: 'Suco',
  refrigerante: 'Refrigerante',
  agua: 'Água',
  milkshake: 'Milkshake',
  cafe: 'Café',
  cerveja: 'Cerveja',
  vinho: 'Vinho',
  energetico: 'Energético',
  whisky: 'Destilado',
  drink: 'Drink',
  pao: 'Pão',
  doce: 'Doce',
  salgado: 'Salgado',
  arroz: 'Arroz',
  feijao: 'Feijão',
  leite: 'Laticínio',
  queijo: 'Queijo',
  fruta: 'Fruta',
  hortifruti: 'Hortifruti',
  carne: 'Carne',
  limpeza: 'Limpeza',
  higiene: 'Higiene',
  medicamento: 'Medicamento',
  vitamina: 'Vitamina',
  protetor: 'Dermocosmético',
  equipamento: 'Equipamento',
  snack: 'Snack',
  chocolate: 'Chocolate',
  utilidade: 'Utilidade',
  kit: 'Kit',
  combo: 'Combo',
  smoothie: 'Smoothie',
  cha: 'Chá',
};

export type MenuItemPhotoSuggestion = {
  key: string;
  label: string;
  /** Fotos alternativas do mesmo tema (a loja escolhe a que melhor enquadra). */
  photos: string[];
  primary: string;
  /** true quando o nome bateu em algo além do genérico. */
  matched: boolean;
};

function pick(ids: string[], index: number, w: number, h: number) {
  return unsplash(ids[index % ids.length], w, h);
}

/** Classifica o nome em uma chave de foto. Pratos específicos primeiro. */
export function resolveMenuItemPhotoKey(name: string, menuCategory = ''): string {
  const text = `${name} ${menuCategory}`.toLowerCase();

  if (text.includes('feijoada')) return 'feijoada';
  if (text.includes('strogonoff') || text.includes('estrogonof')) return 'strogonoff';
  if (text.includes('parmegiana') || text.includes('parmegiana')) return 'parmegiana';
  if (text.includes('lasanha')) return 'lasanha';
  if (text.includes('coxinha')) return 'coxinha';
  if (text.includes('pastel')) return 'pastel';
  if (text.includes('esfiha') || text.includes('esfirra')) return 'esfiha';

  if (text.includes('pizza')) {
    if (text.includes('calabresa')) return 'pizza_calabresa';
    if (text.includes('mussarela') || text.includes('muçarela') || text.includes('mucarela')) {
      return 'pizza_mussarela';
    }
    return 'pizza';
  }

  if (text.includes('combo') || menuCategory.toLowerCase() === 'combos') return 'combo';
  if (text.includes('burger') || text.includes('hambur')) return 'burger';
  if (text.includes('açaí') || text.includes('acai')) return 'acai';
  if (text.includes('milkshake')) return 'milkshake';
  if (text.includes('batata') || text.includes('onion')) return 'batata';
  if (text.includes('salada')) return 'salada';
  if (
    text.includes('massa') ||
    text.includes('espaguete') ||
    text.includes('nhoque') ||
    text.includes('yakissoba')
  ) {
    return 'massa';
  }
  if (
    text.includes('pudim') ||
    text.includes('brownie') ||
    text.includes('mousse') ||
    text.includes('bolo') ||
    text.includes('torta') ||
    text.includes('sonho') ||
    text.includes('doce') ||
    text.includes('cookie') ||
    text.includes('churros') ||
    text.includes('brigadeiro')
  ) {
    return 'sobremesa';
  }
  if (
    text.includes('bruschetta') ||
    text.includes('entrada') ||
    text.includes('empada') ||
    text.includes('salgado') ||
    text.includes('quiche')
  ) {
    return 'entrada';
  }
  if (text.includes('suco') || text.includes('detox') || text.includes('laranja')) return 'suco';
  if (text.includes('refrigerante') || text.includes('coca')) return 'refrigerante';
  if (text.includes('água') || text.includes('agua') || text.includes('coco')) return 'agua';
  if (text.includes('cerveja') || text.includes('chop')) return 'cerveja';
  if (text.includes('vinho') || text.includes('espumante')) return 'vinho';
  if (text.includes('energético') || text.includes('energetico')) return 'energetico';
  if (
    text.includes('whisky') ||
    text.includes('vodka') ||
    text.includes('gin') ||
    text.includes('destil')
  ) {
    return 'whisky';
  }
  if (text.includes('drink') || text.includes('mojito') || text.includes('tônica')) return 'drink';
  if (
    text.includes('café') ||
    text.includes('cafe') ||
    text.includes('cappuccino') ||
    text.includes('latte') ||
    text.includes('brew')
  ) {
    return 'cafe';
  }
  if (text.includes('chá') || text.includes('cha') || text.includes('kombucha')) return 'cha';
  if (text.includes('smoothie') || text.includes('shot')) return 'smoothie';
  if (
    text.includes('pão') ||
    text.includes('pao') ||
    text.includes('croissant') ||
    text.includes('baguete') ||
    text.includes('focaccia') ||
    text.includes('broa') ||
    text.includes('rosca') ||
    text.includes('bisnaga')
  ) {
    return 'pao';
  }
  if (text.includes('arroz')) return 'arroz';
  if (text.includes('feijão') || text.includes('feijao')) return 'feijao';
  if (text.includes('leite') || text.includes('iogurte') || text.includes('manteiga')) return 'leite';
  if (text.includes('queijo')) return 'queijo';
  if (
    text.includes('banana') ||
    text.includes('maçã') ||
    text.includes('maca') ||
    text.includes('fruta')
  ) {
    return 'fruta';
  }
  if (
    text.includes('tomate') ||
    text.includes('alface') ||
    text.includes('cebola') ||
    text.includes('hortifruti') ||
    text.includes('legume')
  ) {
    return 'hortifruti';
  }
  if (
    text.includes('carne') ||
    text.includes('frango') ||
    text.includes('linguiça') ||
    text.includes('bife') ||
    text.includes('filé') ||
    text.includes('galeto') ||
    text.includes('churrasco')
  ) {
    return 'carne';
  }
  if (
    text.includes('detergente') ||
    text.includes('sabão') ||
    text.includes('desinfet') ||
    text.includes('esponja') ||
    text.includes('limpeza')
  ) {
    return 'limpeza';
  }
  if (
    text.includes('shampoo') ||
    text.includes('sabonete') ||
    text.includes('papel') ||
    text.includes('creme dental') ||
    text.includes('escova') ||
    text.includes('álcool') ||
    text.includes('mascara') ||
    text.includes('máscara') ||
    text.includes('algodão')
  ) {
    return 'higiene';
  }
  if (
    text.includes('dipirona') ||
    text.includes('paracetamol') ||
    text.includes('ibuprofeno') ||
    text.includes('omeprazol') ||
    text.includes('loratadina') ||
    text.includes('xarope') ||
    text.includes('colírio') ||
    text.includes('pastilha') ||
    text.includes('medicamento') ||
    text.includes('soro') ||
    text.includes('curativo') ||
    text.includes('gaze')
  ) {
    return 'medicamento';
  }
  if (text.includes('vitamina') || text.includes('ômega') || text.includes('omega') || text.includes('complexo')) {
    return 'vitamina';
  }
  if (
    text.includes('protetor') ||
    text.includes('hidratante') ||
    text.includes('sérum') ||
    text.includes('serum') ||
    text.includes('derm')
  ) {
    return 'protetor';
  }
  if (
    text.includes('termômetro') ||
    text.includes('termometro') ||
    text.includes('inalador') ||
    text.includes('pressão') ||
    text.includes('equipamento')
  ) {
    return 'equipamento';
  }
  if (
    text.includes('salgadinho') ||
    text.includes('snack') ||
    text.includes('biscoito') ||
    text.includes('bala')
  ) {
    return 'snack';
  }
  if (text.includes('chocolate')) return 'chocolate';
  if (
    text.includes('pilha') ||
    text.includes('carregador') ||
    text.includes('fone') ||
    text.includes('isqueiro') ||
    text.includes('garrafa') ||
    text.includes('guarda-chuva') ||
    text.includes('utilidade')
  ) {
    return 'utilidade';
  }
  if (text.includes('kit') || text.includes('caixa')) return 'kit';
  if (
    text.includes('pf') ||
    text.includes('risoto') ||
    text.includes('sopa') ||
    text.includes('prato')
  ) {
    return 'prato';
  }
  if (
    text.includes('sanduíche') ||
    text.includes('sanduiche') ||
    text.includes('misto') ||
    text.includes('wrap') ||
    text.includes('lanche')
  ) {
    return 'entrada';
  }

  return 'default';
}

export function suggestMenuItemPhotos(
  name: string,
  menuCategory = '',
  opts?: { index?: number; width?: number; height?: number }
): MenuItemPhotoSuggestion {
  const key = resolveMenuItemPhotoKey(name.trim(), menuCategory);
  const pool = MENU_ITEM_PHOTO_POOLS[key] ?? MENU_ITEM_PHOTO_POOLS.default;
  const w = opts?.width ?? 800;
  const h = opts?.height ?? 600;
  const start = opts?.index ?? 0;
  const photos = pool.map((_, i) => pick(pool, start + i, w, h));
  return {
    key,
    label: PHOTO_LABELS[key] ?? PHOTO_LABELS.default,
    photos,
    primary: photos[0],
    matched: key !== 'default',
  };
}

/** Uma foto de capa (catálogo demo / fallback). */
export function productImageFromName(name: string, menuCategory: string, index: number): string {
  const key = resolveMenuItemPhotoKey(name, menuCategory);
  const pool = MENU_ITEM_PHOTO_POOLS[key] ?? MENU_ITEM_PHOTO_POOLS.default;
  return pick(pool, index, 400, 400);
}

/** Galeria 3–4 fotos do mesmo tema. */
export function productGalleryFromName(
  name: string,
  menuCategory: string,
  index: number,
  mainImage: string
): string[] {
  const key = resolveMenuItemPhotoKey(name, menuCategory);
  const pool = MENU_ITEM_PHOTO_POOLS[key] ?? MENU_ITEM_PHOTO_POOLS.default;
  const urls: string[] = [mainImage];

  for (let i = 0; i < pool.length && urls.length < 4; i++) {
    const next = pick(pool, index + i + 1, 800, 600);
    if (!urls.includes(next)) urls.push(next);
  }

  const fallback = MENU_ITEM_PHOTO_POOLS.default;
  for (let i = 0; urls.length < 3 && i < fallback.length; i++) {
    const next = pick(fallback, index + i + 5, 800, 600);
    if (!urls.includes(next)) urls.push(next);
  }

  return urls;
}

/** True se a URI veio do nosso catálogo Unsplash (sugestão do app). */
export function isCatalogMenuPhoto(uri: string | null | undefined): boolean {
  if (!uri) return false;
  if (!uri.includes('images.unsplash.com/')) return false;
  for (const ids of Object.values(MENU_ITEM_PHOTO_POOLS)) {
    for (const id of ids) {
      if (uri.includes(id)) return true;
    }
  }
  return false;
}

export const MENU_ITEM_FALLBACK_PHOTO = unsplash('photo-1546069901-ba9599a7e63c', 400, 300);
