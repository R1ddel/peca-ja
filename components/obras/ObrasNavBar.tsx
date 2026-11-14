import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { obrasTheme } from '@/constants/obrasTheme';

type NavItem = {
  href: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

type Props = {
  items: NavItem[];
  accent?: string;
};

export function ObrasNavBar({ items, accent = obrasTheme.colors.primary }: Props) {
  const pathname = usePathname();

  return (
    <View style={styles.bar}>
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <TouchableOpacity
            key={item.href}
            style={styles.item}
            onPress={() => router.push(item.href as any)}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={active ? accent : obrasTheme.colors.textMuted}
            />
            <Text style={[styles.label, active && { color: accent, fontWeight: '700' }]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: obrasTheme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: obrasTheme.colors.border,
    paddingBottom: 8,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontSize: 10,
    color: obrasTheme.colors.textMuted,
    fontWeight: '600',
  },
});
