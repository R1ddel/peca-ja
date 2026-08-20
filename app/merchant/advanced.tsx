import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { MobileShell } from '@/components/MobileShell';
import { BackHeader } from '@/components/BackHeader';
import { useAuth } from '@/context/AuthContext';
import {
  STAFF_ROLE_LABEL,
  roleDescription,
  roleAccent,
  logoutStaff,
  findStaffByEmail,
  isApplicationOwnerEmail,
  StaffRole,
} from '@/utils/merchantTeam';
import {
  listStoreBranches,
  setActiveMerchantApplicationId,
  resolveActiveMerchantContext,
  StoreBranchSummary,
} from '@/utils/merchantStores';
import { getOpsMode, setOpsMode, OpsMode, getSessionHours } from '@/utils/merchantOpsMode';
import { logMerchantAudit } from '@/utils/merchantAudit';
import { theme } from '@/constants/theme';

const ALL_PANELS: {
  role: StaffRole;
  href: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { role: 'owner', href: '/merchant/staff/owner', icon: 'shield-checkmark' },
  { role: 'manager', href: '/merchant/staff/manager', icon: 'briefcase' },
  { role: 'kitchen', href: '/merchant/staff/kitchen', icon: 'flame' },
  { role: 'cashier', href: '/merchant/staff/cashier', icon: 'keypad' },
];

/**
 * Sistema avançado — PIN + ponto, filiais e modo simples/avançado.
 * Dono: só e-mail da compra. Equipe: só painel da função cadastrada.
 */
export default function MerchantAdvancedScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState<OpsMode>('simple');
  const [hours, setHours] = useState(12);
  const [branches, setBranches] = useState<StoreBranchSummary[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>([]);

  useFocusEffect(
    useCallback(() => {
      void logoutStaff();
      void (async () => {
        setMode(await getOpsMode());
        setHours(await getSessionHours());
        const { app } = await resolveActiveMerchantContext(user?.email);
        const owner = isApplicationOwnerEmail(user?.email, app?.email);
        setIsOwner(owner);
        setBranches(owner ? await listStoreBranches(user?.email) : []);

        if (owner) {
          setStaffRoles(['owner', 'manager', 'kitchen', 'cashier']);
        } else if (user?.email) {
          const memberships = await findStaffByEmail(user.email);
          const roles = Array.from(new Set(memberships.map((m) => m.role)));
          setStaffRoles(roles);
        } else {
          setStaffRoles([]);
        }
      })();
    }, [user?.email])
  );

  const panels = useMemo(() => {
    if (isOwner) return ALL_PANELS;
    return ALL_PANELS.filter((p) => p.role !== 'owner' && staffRoles.includes(p.role));
  }, [isOwner, staffRoles]);

  async function toggleMode() {
    if (!isOwner) return;
    const next: OpsMode = mode === 'advanced' ? 'simple' : 'advanced';
    await setOpsMode(next);
    setMode(next);
    setHours(await getSessionHours());
  }

  async function selectBranch(b: StoreBranchSummary) {
    if (!isOwner) return;
    await setActiveMerchantApplicationId(b.applicationId);
    setBranches(await listStoreBranches(user?.email));
    await logMerchantAudit({
      businessId: b.businessId,
      actorName: user?.name || 'Dono',
      actorRole: 'owner',
      action: 'switch_store',
      detail: `Loja ativa: ${b.name}`,
    });
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Sistema avançado" fallbackHref="/merchant" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Painéis por função</Text>
        <Text style={styles.sub}>
          {isOwner
            ? `Dono: só o e-mail da compra. Equipe cadastrada entra no painel da função com PIN + ponto. Sessão ${hours}h.`
            : 'Entre no painel da sua função (PIN pessoal + ponto). O painel do dono fica só com o e-mail da compra.'}
        </Text>

        {isOwner ? (
          <TouchableOpacity style={styles.modeCard} onPress={() => void toggleMode()} activeOpacity={0.88}>
            <View style={styles.modeIcon}>
              <Ionicons
                name={mode === 'advanced' ? 'business' : 'storefront'}
                size={22}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modeTitle}>
                Modo {mode === 'advanced' ? 'rede / avançado' : 'pequeno comércio'}
              </Text>
              <Text style={styles.modeSub}>
                {mode === 'advanced'
                  ? 'Sessão 8h, foco em equipe e filiais. Toque para modo simples.'
                  : 'Sessão 12h, fluxo mais leve. Toque para modo rede.'}
              </Text>
            </View>
            <Ionicons name="swap-horizontal" size={18} color="#fff" />
          </TouchableOpacity>
        ) : null}

        {isOwner && branches.length > 1 ? (
          <>
            <Text style={styles.section}>Filial ativa</Text>
            {branches.map((b) => (
              <TouchableOpacity
                key={b.applicationId}
                style={[styles.branch, b.isActive && styles.branchOn]}
                onPress={() => void selectBranch(b)}
              >
                <Ionicons
                  name={b.isActive ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={b.isActive ? theme.colors.primary : theme.colors.textMuted}
                />
                <Text style={styles.branchName}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : null}

        {panels.length === 0 ? (
          <View style={styles.emptyStaff}>
            <Ionicons name="people-outline" size={36} color={theme.colors.textMuted} />
            <Text style={styles.emptyTitle}>Sem função liberada</Text>
            <Text style={styles.emptyText}>
              Peça acesso à loja. Depois que o dono aprovar, seu painel aparece aqui.
            </Text>
            <TouchableOpacity
              style={styles.cta}
              onPress={() => router.push('/merchant/staff/request-access' as any)}
            >
              <Text style={styles.ctaText}>Pedir acesso</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ctaGhost}
              onPress={() => router.push('/merchant/staff/login' as any)}
            >
              <Text style={styles.ctaGhostText}>Já tenho cadastro · Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          panels.map((p) => {
            const color = roleAccent(p.role);
            return (
              <TouchableOpacity
                key={p.role}
                style={[styles.card, { borderColor: color + '55' }]}
                activeOpacity={0.88}
                onPress={() => router.push(p.href as any)}
              >
                <View style={[styles.icon, { backgroundColor: color + '18' }]}>
                  <Ionicons name={p.icon} size={24} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{STAFF_ROLE_LABEL[p.role]}</Text>
                  <Text style={styles.cardSub}>{roleDescription(p.role)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            );
          })
        )}

        {!isOwner ? (
          <TouchableOpacity
            style={styles.tool}
            onPress={() => router.push('/merchant/staff/request-access' as any)}
          >
            <Ionicons name="person-add-outline" size={20} color={theme.colors.primary} />
            <Text style={styles.toolText}>Pedir acesso / cadastro na equipe</Text>
          </TouchableOpacity>
        ) : null}

        {isOwner ? (
          <>
            <TouchableOpacity
              style={styles.tool}
              onPress={() => router.push('/merchant/punches' as any)}
            >
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.toolText}>Relatório de ponto</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tool}
              onPress={() => router.push('/merchant/audit' as any)}
            >
              <Ionicons name="list-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.toolText}>Auditoria</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tool}
              onPress={() => router.push('/merchant/stores' as any)}
            >
              <Ionicons name="git-branch-outline" size={20} color={theme.colors.primary} />
              <Text style={styles.toolText}>Lojas / filiais</Text>
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 40 },
  title: {
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    marginBottom: 6,
  },
  sub: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  modeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  modeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeTitle: { color: '#fff', fontWeight: theme.fontWeight.extrabold, fontSize: 15 },
  modeSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2, lineHeight: 16 },
  section: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  branch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  branchOn: { borderColor: theme.colors.primary + '66', backgroundColor: theme.colors.primaryLight },
  branchName: { fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { fontSize: 16, fontWeight: theme.fontWeight.extrabold, color: theme.colors.text },
  cardSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 16 },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
  },
  toolText: { fontSize: 14, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  emptyStaff: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  cta: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  ctaText: { color: '#fff', fontWeight: theme.fontWeight.bold },
  ctaGhost: { paddingVertical: 10 },
  ctaGhostText: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
});
