/**
 * Shell do painel HQ — lateral web / topo mobile.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { Slot, router, usePathname } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { hq } from '@/app/admin/_ui';

const NAV: { href: string; label: string; hint: string; ceoOnly?: boolean }[] = [
  { href: '/admin/overview', label: 'Overview', hint: 'KPIs' },
  { href: '/admin/shops', label: 'Lojas', hint: 'Rede' },
  { href: '/admin/orders', label: 'Pedidos', hint: 'Global' },
  { href: '/admin/tickets', label: 'Tickets', hint: 'Suporte' },
  { href: '/admin/fleet', label: 'Frota', hint: 'Motoboys' },
  { href: '/admin/team', label: 'Equipe', hint: 'CEO', ceoOnly: true },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const role = user?.platformRole;
  const isStaff = role === 'ceo' || role === 'ops';
  const hideNav = pathname === '/admin/login' || pathname === '/admin' || pathname?.endsWith('/login');

  if (hideNav) {
    return <Slot />;
  }

  const links = NAV.filter((n) => !n.ceoOnly || role === 'ceo');

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <View style={styles.brandBlock}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>PJ</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>Peça Já HQ</Text>
            <Text style={styles.role}>
              {role === 'ceo' ? 'CEO' : role === 'ops' ? 'Ops' : 'Sem papel'}
              {user?.email ? ` · ${user.email}` : ''}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {links.map((n) => {
            const active = pathname.startsWith(n.href);
            return (
              <TouchableOpacity
                key={n.href}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(n.href as any)}
              >
                <Text style={[styles.navText, active && styles.navTextActive]}>{n.label}</Text>
                <Text style={styles.navHint}>{n.hint}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => {
            if (!isStaff) {
              router.replace('/admin/login' as any);
              return;
            }
            void logout().then(() => router.replace('/admin/login' as any));
          }}
        >
          <Text style={styles.logout}>{isStaff ? 'Sair' : 'Entrar'}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.main}>
        <Slot />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    backgroundColor: hq.bg,
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
  },
  sidebar: {
    width: Platform.OS === 'web' ? 248 : undefined,
    padding: 16,
    backgroundColor: hq.panel,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderBottomWidth: Platform.OS === 'web' ? 0 : 1,
    borderColor: hq.line,
  },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  brandMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: hq.greenDim,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: {
    color: hq.green,
    fontWeight: '900',
    fontSize: 14,
  },
  brand: { color: hq.text, fontSize: 16, fontWeight: '800' },
  role: { color: hq.muted, fontSize: 11, marginTop: 2 },
  navItem: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  navItemActive: { backgroundColor: hq.greenDim },
  navText: { color: hq.muted, fontWeight: '700', fontSize: 14 },
  navTextActive: { color: hq.green },
  navHint: { color: hq.faint, fontSize: 10, marginTop: 2, fontWeight: '600' },
  logoutBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: hq.line,
  },
  logout: { color: hq.red, fontWeight: '700' },
  main: {
    flex: 1,
    padding: Platform.OS === 'web' ? 28 : 16,
    maxWidth: hq.max,
    width: '100%' as any,
    alignSelf: 'center',
  },
});
