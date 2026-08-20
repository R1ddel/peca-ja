import { MenuAddonGroup } from '@/types';

const FOOD_EXTRAS: MenuAddonGroup = {
  id: 'extras',
  name: 'Adicionais',
  maxSelect: 8,
  options: [
    { id: 'bacon', name: 'Bacon', price: 4.5 },
    { id: 'queijo', name: 'Queijo extra', price: 3.5 },
    { id: 'ovo', name: 'Ovo', price: 2.5 },
    { id: 'catupiry', name: 'Catupiry', price: 4.0 },
    { id: 'cheddar', name: 'Cheddar', price: 3.5 },
    { id: 'cebola-caramelizada', name: 'Cebola caramelizada', price: 3.0 },
  ],
};

const SAUCES: MenuAddonGroup = {
  id: 'molhos',
  name: 'Molhos',
  maxSelect: 3,
  options: [
    { id: 'barbecue', name: 'Barbecue', price: 1.5 },
    { id: 'maionese', name: 'Maionese da casa', price: 1.5 },
    { id: 'mostarda-mel', name: 'Mostarda e mel', price: 1.5 },
    { id: 'picante', name: 'Molho picante', price: 1.0 },
  ],
};

const PIZZA_EXTRAS: MenuAddonGroup = {
  id: 'pizza-extras',
  name: 'Adicionais da pizza',
  maxSelect: 6,
  options: [
    { id: 'borda-catupiry', name: 'Borda de catupiry', price: 8.9 },
    { id: 'borda-cheddar', name: 'Borda de cheddar', price: 8.9 },
    { id: 'extra-mussarela', name: 'Mussarela extra', price: 6.0 },
    { id: 'calabresa-extra', name: 'Calabresa extra', price: 5.5 },
    { id: 'azeitona', name: 'Azeitona', price: 3.0 },
  ],
};

const SIDE_EXTRAS: MenuAddonGroup = {
  id: 'porcao-extras',
  name: 'Adicionais',
  maxSelect: 4,
  options: [
    { id: 'cheddar-sauce', name: 'Cheddar', price: 4.0 },
    { id: 'bacon-bits', name: 'Bacon crocante', price: 4.5 },
    { id: 'ketchup', name: 'Ketchup', price: 0.5 },
    { id: 'maionese-side', name: 'Maionese', price: 0.5 },
  ],
};

const DRINK_OPTIONS: MenuAddonGroup = {
  id: 'drink-opts',
  name: 'Preferências',
  maxSelect: 4,
  options: [
    { id: 'gelo', name: 'Com gelo', price: 0 },
    { id: 'limao', name: 'Com limão', price: 0.5 },
    { id: 'sem-acucar', name: 'Sem açúcar', price: 0 },
    { id: 'copa-extra', name: 'Copo extra', price: 1.0 },
  ],
};

const DRINK_SIZE: MenuAddonGroup = {
  id: 'drink-size',
  name: 'Tamanho',
  required: true,
  maxSelect: 1,
  options: [
    { id: 'normal', name: 'Normal', price: 0 },
    { id: 'grande', name: 'Grande', price: 3.0 },
  ],
};

/** Grupos de adicionais por categoria do cardápio. */
export function getAddonGroupsForCategory(menuCategory: string): MenuAddonGroup[] | undefined {
  switch (menuCategory) {
    case 'Burgers':
      return [FOOD_EXTRAS, SAUCES];
    case 'Pratos':
    case 'Massas':
    case 'Entradas':
      return [FOOD_EXTRAS, SAUCES];
    case 'Pizzas':
      return [PIZZA_EXTRAS];
    case 'Acompanhamentos':
      return [SIDE_EXTRAS];
    case 'Bebidas':
    case 'Drinks':
    case 'Sucos':
    case 'Refrigerantes':
    case 'Cervejas':
      return [DRINK_SIZE, DRINK_OPTIONS];
    case 'Sobremesas':
      return [
        {
          id: 'dessert-extras',
          name: 'Adicionais',
          maxSelect: 3,
          options: [
            { id: 'calda', name: 'Calda extra', price: 2.0 },
            { id: 'chantilly', name: 'Chantilly', price: 2.5 },
            { id: 'granulado', name: 'Granulado', price: 1.5 },
          ],
        },
      ];
    default:
      return undefined;
  }
}
