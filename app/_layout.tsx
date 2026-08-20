import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Slot } from 'expo-router';

import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { OrdersProvider } from '@/context/OrdersContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <OrdersProvider>
          <StatusBar style="auto" />
          <Slot />
        </OrdersProvider>
      </CartProvider>
    </AuthProvider>
  );
}
