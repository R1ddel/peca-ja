import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CartItem, MenuItem, SelectedAddon } from '@/types';
import { OrdersProvider } from '@/context/OrdersContext';
import { ReviewsProvider } from '@/context/ReviewsContext';
import { FavoritesProvider } from '@/context/FavoritesContext';
import { getLineTotal, makeLineId, normalizeCartItem } from '@/utils/cartLine';

interface CartContextType {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  businessId: string | null;
  businessName: string | null;
  isReady: boolean;
  addItem: (
    item: MenuItem,
    businessId: string,
    businessName: string,
    selectedAddons?: SelectedAddon[],
    note?: string
  ) => void;
  removeItem: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  updateNote: (lineId: string, note: string) => void;
  /** Substitui o carrinho (ex.: pedir de novo). */
  replaceCart: (items: CartItem[]) => void;
  clearCart: () => void;
  getItemQuantity: (itemId: string) => number;
  decreaseItem: (itemId: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_KEY = '@pecaja_cart';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(CART_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as CartItem[];
          setItems(parsed.map(normalizeCartItem));
        }
      } catch {
        // ignore
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items, isReady]);

  const businessId = items.length > 0 ? items[0].businessId : null;
  const businessName = items.length > 0 ? items[0].businessName : null;

  const itemCount = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + getLineTotal(i), 0), [items]);

  const addItem = useCallback(
    (
      item: MenuItem,
      bId: string,
      bName: string,
      selectedAddons: SelectedAddon[] = [],
      note?: string
    ) => {
      const cleanNote = note?.trim() || undefined;
      const lineId = makeLineId(item.id, selectedAddons, cleanNote);
      const payload: CartItem = {
        lineId,
        item,
        quantity: 1,
        businessId: bId,
        businessName: bName,
        selectedAddons,
        note: cleanNote,
      };

      setItems((prev) => {
        if (prev.length > 0 && prev[0].businessId !== bId) {
          Alert.alert(
            'Trocar de comércio?',
            `Seu carrinho é de "${prev[0].businessName}". Para pedir em "${bName}", o carrinho atual será limpo.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Trocar e adicionar',
                style: 'destructive',
                onPress: () => setItems([payload]),
              },
            ]
          );
          return prev;
        }

        const existing = prev.find((i) => i.lineId === lineId);
        if (existing) {
          return prev.map((i) =>
            i.lineId === lineId ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, payload];
      });
    },
    []
  );

  const removeItem = useCallback((lineId: string) => {
    setItems((prev) => prev.filter((i) => i.lineId !== lineId));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.lineId !== lineId));
      return;
    }
    setItems((prev) => prev.map((i) => (i.lineId === lineId ? { ...i, quantity } : i)));
  }, []);

  const updateNote = useCallback((lineId: string, note: string) => {
    const clean = note.trim();
    setItems((prev) =>
      prev.map((i) => {
        if (i.lineId !== lineId) return i;
        const nextNote = clean || undefined;
        return {
          ...i,
          note: nextNote,
          lineId: makeLineId(i.item.id, i.selectedAddons, nextNote),
        };
      })
    );
  }, []);

  const replaceCart = useCallback((next: CartItem[]) => {
    setItems(next.map(normalizeCartItem));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const getItemQuantity = useCallback(
    (itemId: string) =>
      items.filter((i) => i.item.id === itemId).reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const decreaseItem = useCallback((itemId: string) => {
    setItems((prev) => {
      const idx = [...prev].reverse().findIndex((i) => i.item.id === itemId);
      if (idx === -1) return prev;
      const realIndex = prev.length - 1 - idx;
      const line = prev[realIndex];
      if (line.quantity <= 1) {
        return prev.filter((_, i) => i !== realIndex);
      }
      return prev.map((item, i) =>
        i === realIndex ? { ...item, quantity: item.quantity - 1 } : item
      );
    });
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        itemCount,
        subtotal,
        businessId,
        businessName,
        isReady,
        addItem,
        removeItem,
        updateQuantity,
        updateNote,
        replaceCart,
        clearCart,
        getItemQuantity,
        decreaseItem,
      }}
    >
      <ReviewsProvider>
        <FavoritesProvider>
          <OrdersProvider>{children}</OrdersProvider>
        </FavoritesProvider>
      </ReviewsProvider>
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider');
  return context;
}
