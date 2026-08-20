import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  FavoriteDish,
  FavoritesStore,
  loadFavorites,
  saveFavorites,
} from '@/utils/favorites';

type FavoritesContextType = {
  businesses: string[];
  dishes: FavoriteDish[];
  isLoading: boolean;
  isBusinessFavorite: (businessId: string) => boolean;
  isDishFavorite: (businessId: string, itemId: string) => boolean;
  toggleBusiness: (businessId: string) => Promise<void>;
  toggleDish: (businessId: string, itemId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<FavoritesStore>({ businesses: [], dishes: [] });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadFavorites()
      .then(setStore)
      .finally(() => setIsLoading(false));
  }, []);

  const persist = useCallback(async (next: FavoritesStore) => {
    setStore(next);
    await saveFavorites(next);
  }, []);

  const isBusinessFavorite = useCallback(
    (businessId: string) => store.businesses.includes(businessId),
    [store.businesses]
  );

  const isDishFavorite = useCallback(
    (businessId: string, itemId: string) =>
      store.dishes.some((d) => d.businessId === businessId && d.itemId === itemId),
    [store.dishes]
  );

  const toggleBusiness = useCallback(
    async (businessId: string) => {
      const has = store.businesses.includes(businessId);
      const businesses = has
        ? store.businesses.filter((id) => id !== businessId)
        : [businessId, ...store.businesses];
      await persist({ ...store, businesses });
    },
    [persist, store]
  );

  const toggleDish = useCallback(
    async (businessId: string, itemId: string) => {
      const has = store.dishes.some(
        (d) => d.businessId === businessId && d.itemId === itemId
      );
      const dishes = has
        ? store.dishes.filter(
            (d) => !(d.businessId === businessId && d.itemId === itemId)
          )
        : [{ businessId, itemId }, ...store.dishes];
      await persist({ ...store, dishes });
    },
    [persist, store]
  );

  const value = useMemo(
    () => ({
      businesses: store.businesses,
      dishes: store.dishes,
      isLoading,
      isBusinessFavorite,
      isDishFavorite,
      toggleBusiness,
      toggleDish,
    }),
    [
      store.businesses,
      store.dishes,
      isLoading,
      isBusinessFavorite,
      isDishFavorite,
      toggleBusiness,
      toggleDish,
    ]
  );

  return (
    <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error('useFavorites deve ser usado dentro de FavoritesProvider');
  return ctx;
}
