/**
 * Shell WEB redesenhado — Peça Já Command Center.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { Slot, router, usePathname, useGlobalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { hqTokens, makeHqStyles, type HqThemeMode } from '@/app/admin/_ui';
import { useHqTheme } from '@/app/admin/_useAdminGate';
import { isStaffRole, roleLabel, hasPermission } from '@/services/platformRoles';
import { getPlatformToken } from '@/services/platformSession';
import { setClientHqMode } from '@/services/platformClient';
import { platformAdminSearch, platformAdminOpsNow, platformAdminHealth, platformAdminProblemsNow } from '@/services/platformClient';
import { LiveBadge, StatusPill } from '@/app/admin/_components';
import { HqModeProvider, useHqMode } from '@/app/admin/_hqContext';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  perm?: Parameters<typeof hasPermission>[1];
  section?: string;
};

const NAV: NavItem[] = [
  { href: '/admin/overview', label: 'Visão Geral', icon: '◉', section: 'Visão Geral' },
  { href: '/admin/ops', label: 'Operação', icon: '◈', section: 'Operação' },
  { href: '/admin/map', label: 'Mapa ao vivo', icon: '◎', section: 'Operação' },
  { href: '/admin/problems', label: 'Central de Problemas', icon: '⚡', section: 'Problemas' },
  { href: '/admin/intelligence', label: 'Inteligência', icon: '◈', section: 'Análises' },
  { href: '/admin/orders', label: 'Pedidos', icon: '≡', section: 'Pedidos' },
  { href: '/admin/cities', label: 'Rede / Cidades', icon: '⌖', section: 'Rede' },
  { href: '/admin/shops', label: 'Comércios', icon: '⌂', section: 'Comércio' },
  { href: '/admin/products', label: 'Produtos', icon: '▣', section: 'Comércio' },
  { href: '/admin/customers', label: 'Clientes', icon: '☺', section: 'Clientes' },
  { href: '/admin/fleet', label: 'Entregadores', icon: '↯', section: 'Entregadores' },
  { href: '/admin/finance', label: 'Financeiro', icon: '₿', perm: 'financial', section: 'Financeiro' },
  { href: '/admin/wallets', label: 'Carteiras', icon: '▭', perm: 'financial', section: 'Financeiro' },
  { href: '/admin/crm', label: 'Cadastros', icon: '⇉', perm: 'crm', section: 'Operação' },
  { href: '/admin/reports', label: 'Crescimento', icon: '▤', section: 'Análises' },
  { href: '/admin/marketing', label: 'Marketing', icon: '✧', perm: 'marketing_manage', section: 'Marketing' },
  { href: '/admin/tickets', label: 'Suporte', icon: '✉', section: 'Suporte' },
  { href: '/admin/reviews', label: 'Avaliações', icon: '★', section: 'Suporte' },
  { href: '/admin/audit', label: 'Auditoria', icon: '☰', perm: 'audit', section: 'Segurança' },
  { href: '/admin/quality', label: 'Data Quality', icon: '✓', perm: 'audit', section: 'Segurança' },
  { href: '/admin/health', label: 'Saúde', icon: '♥', section: 'Sistema' },
  { href: '/admin/logs', label: 'Logs', icon: '⌥', perm: 'audit', section: 'Sistema' },
  { href: '/admin/flags', label: 'Flags', icon: '⚑', perm: 'flags', section: 'Sistema' },
  { href: '/admin/incidents', label: 'Incidentes', icon: '⚠', section: 'Sistema' },
  { href: '/admin/team', label: 'Equipe', icon: '⚭', perm: 'team', section: 'Sistema' },
  { href: '/admin/ai-team', label: 'Equipe IA', icon: '✦', section: 'Sistema' },
];

function AdminShell() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ present?: string }>();
  const presentMode = String(params.present || '') === '1';
  const { mode: themeMode, toggle } = useHqTheme();
  const { mode: dataMode, setMode: setDataMode, isProjection } = useHqMode();
  useEffect(() => {
    setClientHqMode(dataMode);
  }, [dataMode]);
  const t = hqTokens(themeMode);
  const styles = useMemo(() => makeLayoutStyles(themeMode), [themeMode]);
  const hqStyles = useMemo(() => makeHqStyles(themeMode), [themeMode]);
  const role = user?.platformRole;
  const isStaff = isStaffRole(role);
  const hideNav =
    pathname === '/admin/login' || pathname === '/admin' || pathname?.endsWith('/login');

  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [q, setQ] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  const links = NAV.filter((n) => !n.perm || hasPermission(role, n.perm));

  const refreshTop = useCallback(async () => {
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const [ops, health, problems] = await Promise.all([
        platformAdminOpsNow(token, dataMode),
        platformAdminHealth(token),
        platformAdminProblemsNow(token, { hqMode: dataMode }),
      ]);
      if (problems?.ok) {
        const s = (problems as any).summary || {};
        setAlertCount(Number(s.open || 0) + Number(s.slaBreached || 0));
      } else if (ops?.ok) {
        const o = (ops as any).ops || {};
        setAlertCount(Number(o.delayedCount || 0) + Number(o.awaitingDriverCount || 0));
      }
      if (health?.ok) {
        const h = (health as any).health;
        setApiOk(h?.platform?.status === 'online');
      }
    } catch {
      setApiOk(false);
    }
  }, [dataMode]);

  useEffect(() => {
    if (hideNav || Platform.OS !== 'web') return;
    void refreshTop();
    const id = setInterval(() => void refreshTop(), 20000);
    return () => clearInterval(id);
  }, [hideNav, refreshTop]);

  useEffect(() => {
    if (Platform.OS !== 'web' || hideNav) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.closest?.('input,textarea,[contenteditable]');
      if (tag) return;
      if (e.key === '/' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hideNav]);

  const runSearch = useCallback(async (text: string) => {
    setQ(text);
    if (text.trim().length < 2) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminSearch(token, text.trim());
      if (res?.ok) setSearchResults((res as any).results);
    } finally {
      setSearching(false);
    }
  }, []);

  if (Platform.OS !== 'web') {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
          Command Center é web
        </Text>
        <Text style={{ color: t.muted, fontSize: 15, textAlign: 'center', marginTop: 12, maxWidth: 360 }}>
          Abra no navegador do PC: /admin
        </Text>
      </View>
    );
  }

  if (hideNav) return <Slot />;

  const sections = Array.from(new Set(links.map((l) => l.section || 'Outros')));
  const pageTitle =
    links.find((n) => pathname.startsWith(n.href))?.label || 'Command Center';

  if (presentMode) {
    return (
      <View style={[styles.root, { backgroundColor: t.bg }]}>
        <View style={styles.mainCol}>
          <View style={[styles.topbar, { justifyContent: 'space-between' }]}>
            <View>
              <Text style={styles.crumb}>Peça Já HQ · Apresentação</Text>
              <Text style={styles.pageTitle}>Inteligência da operação</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <StatusPill
                label={isProjection ? 'PROJEÇÃO' : 'OPERAÇÃO REAL'}
                tone={isProjection ? 'amber' : 'green'}
              />
              <TouchableOpacity
                style={hqStyles.btnGhost}
                onPress={() => router.replace('/admin/overview' as any)}
              >
                <Text style={hqStyles.btnGhostText}>Sair do modo</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView style={styles.mainScroll} contentContainerStyle={[styles.main, { maxWidth: 1200 }]}>
            <Slot />
          </ScrollView>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.sidebar, collapsed && styles.sidebarCollapsed]}>
        <View style={styles.brandBlock}>
          <View style={styles.brandMark}>
            <Text style={styles.brandMarkText}>PJ</Text>
          </View>
          {!collapsed ? (
            <View style={{ flex: 1 }}>
              <Text style={styles.brand}>Peça Já HQ</Text>
              <Text style={styles.brandSub}>Intelligence OS</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity style={styles.collapseBtn} onPress={() => setCollapsed((v) => !v)}>
          <Text style={styles.collapseText}>{collapsed ? '›' : '‹ menu'}</Text>
        </TouchableOpacity>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {sections.map((section) => (
            <View key={section} style={{ marginBottom: 12 }}>
              {!collapsed ? <Text style={styles.sectionLabel}>{section}</Text> : null}
              {links
                .filter((n) => (n.section || 'Outros') === section)
                .map((n) => {
                  const active = pathname.startsWith(n.href);
                  return (
                    <TouchableOpacity
                      key={n.href}
                      style={[styles.navItem, active && styles.navItemActive]}
                      onPress={() => router.push(n.href as any)}
                    >
                      <Text style={[styles.navIcon, active && styles.navTextActive]}>{n.icon}</Text>
                      {!collapsed ? (
                        <Text style={[styles.navText, active && styles.navTextActive]} numberOfLines={1}>
                          {n.label}
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))}
        </ScrollView>

        <View style={styles.sideFoot}>
          {!collapsed ? (
            <>
              <Text style={styles.roleFoot} numberOfLines={1}>
                {user?.name || user?.email || 'Admin'}
              </Text>
              <Text style={[styles.roleFoot, { opacity: 0.7 }]} numberOfLines={1}>
                {roleLabel(role)}
              </Text>
            </>
          ) : null}
          <TouchableOpacity onPress={toggle}>
            <Text style={styles.themeText}>{themeMode === 'light' ? '☾ Escuro' : '☀ Claro'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
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
      </View>

      <View style={styles.mainCol}>
        <View style={styles.topbar}>
          <View style={{ flex: 1, minWidth: 120 }}>
            <Text style={styles.crumb}>Peça Já HQ</Text>
            <Text style={styles.pageTitle}>{pageTitle}</Text>
          </View>

          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeBtn, !isProjection && styles.modeBtnOn]}
              onPress={() => setDataMode('real')}
            >
              <Text style={[styles.modeBtnText, !isProjection && styles.modeBtnTextOn]}>OPERAÇÃO REAL</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, isProjection && styles.modeBtnOnProj]}
              onPress={() => setDataMode('projection')}
            >
              <Text style={[styles.modeBtnText, isProjection && styles.modeBtnTextOnProj]}>PROJEÇÃO</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.searchBtn} onPress={() => setSearchOpen(true)}>
            <Text style={styles.searchBtnText}>Buscar…</Text>
            <View style={styles.kbd}>
              <Text style={styles.kbdText}>⌘K</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.alertBtn} onPress={() => router.push('/admin/problems' as any)}>
            {alertCount > 0 ? <LiveBadge text={`${alertCount}`} /> : <StatusPill label="OK" tone="green" />}
          </TouchableOpacity>

          <StatusPill
            label={apiOk === null ? 'API…' : apiOk ? 'API' : 'API↓'}
            tone={apiOk ? 'green' : apiOk === false ? 'red' : 'muted'}
          />

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name || user?.email || 'A').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.mainScroll} contentContainerStyle={styles.main}>
          <Slot />
        </ScrollView>
      </View>

      <Modal visible={searchOpen} transparent animationType="fade" onRequestClose={() => setSearchOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSearchOpen(false)}>
          <Pressable style={[hqStyles.card, styles.searchModal]} onPress={(e) => e.stopPropagation?.()}>
            <Text style={hqStyles.h2}>Busca global</Text>
            <TextInput
              style={[hqStyles.input, { marginTop: 10 }]}
              placeholder="Cliente, pedido, loja, e-mail…"
              placeholderTextColor={t.faint}
              value={q}
              autoFocus
              onChangeText={(v) => void runSearch(v)}
            />
            {searching ? <Text style={[hqStyles.lead, { marginTop: 10 }]}>Buscando…</Text> : null}
            {searchResults ? (
              <ScrollView style={{ maxHeight: 420, marginTop: 12 }}>
                {(['customers', 'shops', 'orders', 'tickets', 'applications'] as const).map((key) => {
                  const list = searchResults[key] || [];
                  if (!list.length) return null;
                  const titles: Record<string, string> = {
                    customers: 'Clientes',
                    shops: 'Comércios',
                    orders: 'Pedidos',
                    tickets: 'Tickets',
                    applications: 'CRM',
                  };
                  return (
                    <View key={key} style={{ marginBottom: 14 }}>
                      <Text style={hqStyles.h2}>{titles[key]}</Text>
                      {list.map((item: any, i: number) => {
                        const label =
                          item.name || item.businessName || item.subject || item.id || '—';
                        const href =
                          key === 'customers'
                            ? `/admin/customers/${item.id}`
                            : key === 'shops'
                              ? `/admin/shops/${item.businessId}`
                              : key === 'orders'
                                ? `/admin/orders?q=${item.id}`
                                : key === 'tickets'
                                  ? '/admin/tickets'
                                  : '/admin/crm';
                        return (
                          <TouchableOpacity
                            key={`${key}-${i}`}
                            style={styles.searchHit}
                            onPress={() => {
                              setSearchOpen(false);
                              router.push(href as any);
                            }}
                          >
                            <Text style={{ color: t.text, fontWeight: '600' }}>{label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function AdminLayout() {
  return (
    <HqModeProvider>
      <AdminShell />
    </HqModeProvider>
  );
}

function makeLayoutStyles(mode: HqThemeMode) {
  const t = hqTokens(mode);
  return StyleSheet.create({
    root: {
      flex: 1,
      flexDirection: 'row',
      backgroundColor: t.bg,
      minHeight: '100vh' as any,
    },
    sidebar: {
      width: 236,
      paddingTop: 16,
      paddingHorizontal: 12,
      paddingBottom: 12,
      backgroundColor: t.sidebar,
    },
    sidebarCollapsed: { width: 68 },
    brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, paddingHorizontal: 6 },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: t.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandMarkText: { color: '#04140c', fontWeight: '900', fontSize: 13 },
    brand: { color: t.sidebarText, fontSize: 15, fontWeight: '800' },
    brandSub: { color: t.sidebarMuted, fontSize: 11, marginTop: 1, fontWeight: '600' },
    sectionLabel: {
      color: t.sidebarMuted,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.7,
      marginBottom: 6,
      marginTop: 4,
      paddingHorizontal: 10,
    },
    navItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginBottom: 2,
    },
    navItemActive: { backgroundColor: t.sidebarActive },
    navIcon: { color: t.sidebarMuted, fontSize: 14, width: 18, textAlign: 'center' },
    navText: { color: t.sidebarMuted, fontWeight: '700', fontSize: 13, flex: 1 },
    navTextActive: { color: t.green },
    collapseBtn: { marginBottom: 10, paddingHorizontal: 10 },
    collapseText: { color: t.sidebarMuted, fontSize: 12, fontWeight: '600' },
    sideFoot: {
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
      paddingTop: 12,
      gap: 8,
      paddingHorizontal: 6,
    },
    roleFoot: { color: t.sidebarMuted, fontSize: 11, fontWeight: '600' },
    themeText: { color: t.sidebarMuted, fontWeight: '600', fontSize: 12 },
    logout: { color: '#ff8a8a', fontWeight: '700', fontSize: 13 },
    mainCol: { flex: 1 },
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 22,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: t.line,
      backgroundColor: t.topbar,
    },
    crumb: { color: t.faint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    pageTitle: { color: t.text, fontSize: 16, fontWeight: '800', marginTop: 1 },
    searchBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minWidth: 220,
      maxWidth: 360,
      flex: 1,
      backgroundColor: t.panel2,
      borderWidth: 1,
      borderColor: t.line,
      borderRadius: 11,
      paddingVertical: 9,
      paddingHorizontal: 12,
    },
    searchBtnText: { color: t.faint, fontSize: 13, flex: 1 },
    kbd: {
      borderWidth: 1,
      borderColor: t.line,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: t.panel,
    },
    kbdText: { color: t.faint, fontSize: 11, fontWeight: '700' },
    alertBtn: { paddingHorizontal: 2 },
    avatar: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: t.greenDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: t.greenDark, fontWeight: '800', fontSize: 13 },
    mainScroll: { flex: 1 },
    main: {
      padding: 24,
      maxWidth: t.max,
      width: '100%' as any,
      alignSelf: 'center',
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(15,23,42,0.5)',
      justifyContent: 'flex-start',
      paddingTop: 72,
      alignItems: 'center',
    },
    searchModal: { width: '90%' as any, maxWidth: 560 },
    searchHit: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.line },
    modeSwitch: {
      flexDirection: 'row',
      borderWidth: 1,
      borderColor: t.line,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: t.panel2,
    },
    modeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
    modeBtnOn: { backgroundColor: t.greenDim },
    modeBtnOnProj: { backgroundColor: t.amberDim },
    modeBtnText: { color: t.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
    modeBtnTextOn: { color: t.greenDark },
    modeBtnTextOnProj: { color: t.amber },
  });
}
