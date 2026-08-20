/**
 * Favoritos locais (comércios e pratos).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pecaja_favorites_v1';

export type FavoriteDish = {
  businessId: string;
  itemId: string;
};

export type FavoritesStore = {
  businesses: string[];
  dishes: FavoriteDish[];
};

const EMPTY: FavoritesStore = { businesses: [], dishes: [] };

export async function loadFavorites(): Promise<FavoritesStore> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    return {
      businesses: Array.isArray(parsed.businesses) ? parsed.businesses.map(String) : [],
      dishes: Array.isArray(parsed.dishes)
        ? parsed.dishes.filter(
            (d: FavoriteDish) => d && d.businessId && d.itemId
          )
        : [],
    };
  } catch {
    return EMPTY;
  }
}

export async function saveFavorites(store: FavoritesStore): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(store));
}
