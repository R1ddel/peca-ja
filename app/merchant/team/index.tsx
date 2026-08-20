import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import {
  StaffRole,
  STAFF_ROLE_LABEL,
  roleAccent,
  roleDescription,
  deactivateStaffMember,
  reactivateStaffMember,
  listStaff,
  resolveStaffSession,
  staffCan,
  updateStaffRole,
  setMemberPin,
  listPendingAccessRequests,
  approveAccessRequest,
  rejectAccessRequest,
  StaffMember,
  StaffSession,
  StaffAccessRequest,
} from '@/utils/merchantTeam';
import {
  buildPunchReport,
  getOpenPunch,
  PunchReportRow,
} from '@/utils/merchantPunch';
import { formatOrderDate, formatOrderDateTime, formatOrderTime, formatWaitLabel } from '@/utils/datetime';
import { theme } from '@/constants/theme';

type RoleFilter = 'all' | Exclude<StaffRole, 'owner'>;

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'manager', label: 'Gerente' },
  { key: 'kitchen', label: 'Cozinha' },
  { key: 'cashier', label: 'Caixa' },
];

type MemberExtra = {
  open: boolean;
  lastAt: string | null;
  sinceAt: string | null;
  minutesToday: number;
  entriesToday: number;
};

/**
 * Painel Equipe — visão rica pro dono/gerente.
 */
export default function MerchantTeamScreen() {
  const { user } = useAuth();
  const [shopName, setShopName] = useState('');
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [pending, setPending] = useState<StaffAccessRequest[]>([]);
  const [session, setSession] = useState<StaffSession | null>(null);
  const [report, setReport] = useState<PunchReportRow[]>([]);
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const [sinceMap, setSinceMap] = useState<Record<string, string>>({});
  const [pinEditId, setPinEditId] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [filter, setFilter] = useState<RoleFilter>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const { app, shop } = await resolveOperatorMerchantContext(user?.email);
    if (!app || !shop) {
      setBusinessId(null);
      setShopName('');
      setMembers([]);
      setPending([]);
      setReport([]);
      setOpenMap({});
      setSinceMap({});
      return;
    }
    setBusinessId(shop.businessId);
    setShopName(shop.name);
    const sess = await resolveStaffSession({
      businessId: shop.businessId,
      ownerName: app.ownerName,
      ownerEmail: app.email,
    });
    setSession(sess);
    const staff = await listStaff(shop.businessId);
    setMembers(staff);
    setPending(await listPendingAccessRequests(shop.businessId));

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    setReport(await buildPunchReport(shop.businessId, start.getTime()));

    const opens: Record<string, boolean> = {};
    const since: Record<string, string> = {};
    await Promise.all(
      staff
        .filter((m) => m.active && m.role !== 'owner')
        .map(async (m) => {
          const open = await getOpenPunch(shop.businessId, m.id);
          opens[m.id] = !!open;
          if (open) since[m.id] = open.punchedAt;
        })
    );
    setOpenMap(opens);
    setSinceMap(since);
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      setNowMs(Date.now());
      const tick = setInterval(() => setNowMs(Date.now()), 30000);
      return () => clearInterval(tick);
    }, [refresh])
  );

  const canManageTeam = session ? staffCan(session.role, 'team') : false;

  const activeMembers = useMemo(() => members.filter((m) => m.active), [members]);
  const inactiveMembers = useMemo(() => members.filter((m) => !m.active), [members]);

  const counts = useMemo(() => {
    const base = { owner: 0, manager: 0, kitchen: 0, cashier: 0 };
    for (const m of activeMembers) base[m.role] += 1;
    return base;
  }, [activeMembers]);

  const onShiftCount = useMemo(
    () => Object.values(openMap).filter(Boolean).length,
    [openMap]
  );

  const extras = useMemo(() => {
    const map: Record<string, MemberExtra> = {};
    for (const m of members) {
      const row = report.find((r) => r.memberId === m.id);
      map[m.id] = {
        open: !!openMap[m.id],
        lastAt: row?.lastAt ?? null,
        sinceAt: sinceMap[m.id] ?? null,
        minutesToday: row?.minutesWorkedApprox ?? 0,
        entriesToday: row?.entries ?? 0,
      };
    }
    return map;
  }, [members, report, openMap, sinceMap]);

  const onShiftList = useMemo(() => {
    return activeMembers
      .filter((m) => extras[m.id]?.open)
      .map((m) => ({
        member: m,
        since: extras[m.id]?.sinceAt,
      }));
  }, [activeMembers, extras]);

  const filteredActive = useMemo(() => {
    if (filter === 'all') return activeMembers;
    return activeMembers.filter((m) => m.role === filter);
  }, [activeMembers, filter]);

  async function onApprove(req: StaffAccessRequest) {
    Alert.alert(
      'Liberar acesso',
      `Liberar ${req.name} como ${STAFF_ROLE_LABEL[req.role]}?\n${req.email}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Liberar',
          onPress: () =>
            void (async () => {
              const res = await approveAccessRequest(req.id, session?.name || 'Dono');
              if (!res.ok) {
                Alert.alert('Liberação', res.error);
                return;
              }
              Alert.alert(
                'Membro liberado',
                `${res.member.name}\nE-mail: ${res.member.email}\nPIN: ${res.member.pin}`
              );
              await refresh();
            })(),
        },
      ]
    );
  }

  async function onReject(req: StaffAccessRequest) {
    Alert.alert('Recusar', `Recusar o pedido de ${req.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Recusar',
        style: 'destructive',
        onPress: () =>
          void (async () => {
            const res = await rejectAccessRequest(req.id, session?.name || 'Dono');
            if (!res.ok) {
              Alert.alert('Recusa', res.error);
              return;
            }
            await refresh();
          })(),
      },
    ]);
  }

  function changeRole(m: StaffMember) {
    if (!businessId || m.role === 'owner') return;
    Alert.alert('Alterar função', `Nova função de ${m.name}:`, [
      {
        text: 'Gerente',
        onPress: () => void updateStaffRole(businessId, m.id, 'manager').then(refresh),
      },
      {
        text: 'Cozinha',
        onPress: () => void updateStaffRole(businessId, m.id, 'kitchen').then(refresh),
      },
      {
        text: 'Caixa',
        onPress: () => void updateStaffRole(businessId, m.id, 'cashier').then(refresh),
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function startPinEdit(m: StaffMember) {
    setPinEditId(m.id);
    setPinValue(m.pin || '');
  }

  async function savePin(m: StaffMember) {
    if (!businessId) return;
    setPinBusy(true);
    try {
      const res = await setMemberPin(businessId, m.id, pinValue);
      if (!res.ok) {
        Alert.alert('PIN', res.error);
        return;
      }
      Alert.alert('PIN atualizado', `${m.name} agora usa ${pinValue.trim()}.`);
      setPinEditId(null);
      setPinValue('');
      await refresh();
    } finally {
      setPinBusy(false);
    }
  }

  function formatMins(mins: number) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m} min`;
    return `${h}h ${String(m).padStart(2, '0')}min`;
  }

  async function copyPin(m: StaffMember) {
    const pin = m.pin || '';
    if (!pin) {
      Alert.alert('PIN', 'Este membro ainda não tem PIN salvo.');
      return;
    }
    await Clipboard.setStringAsync(pin);
    Alert.alert('PIN copiado', `${m.name}: ${pin}`);
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Equipe" fallbackHref="/merchant" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Text style={styles.shopTitle}>{shopName || 'Sua loja'}</Text>
        <Text style={styles.shopSub}>Gestão de pessoas, ponto e acessos</Text>

        {canManageTeam ? (
          <View style={styles.kpiRow}>
            <Kpi label="Ativos" value={String(activeMembers.length)} />
            <Kpi label="Em turno" value={String(onShiftCount)} accent="#059669" />
            <Kpi
              label="Pedidos"
              value={String(pending.length)}
              accent={pending.length ? '#DC2626' : undefined}
            />
            <Kpi label="Inativos" value={String(inactiveMembers.length)} />
          </View>
        ) : null}

        {canManageTeam ? (
          <View style={styles.roleSummary}>
            {(['manager', 'kitchen', 'cashier'] as const).map((r) => (
              <View key={r} style={[styles.roleChip, { borderColor: roleAccent(r) + '55' }]}>
                <View style={[styles.roleDot, { backgroundColor: roleAccent(r) }]} />
                <Text style={styles.roleChipText}>
                  {STAFF_ROLE_LABEL[r]} · {counts[r]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {canManageTeam && onShiftList.length > 0 ? (
          <View style={styles.onShiftBox}>
            <Text style={styles.onShiftTitle}>Em turno agora</Text>
            {onShiftList.map(({ member: m, since }) => (
              <View key={m.id} style={styles.onShiftRow}>
                <Ionicons name="radio-button-on" size={12} color="#059669" />
                <Text style={styles.onShiftLine}>
                  {m.name} · {STAFF_ROLE_LABEL[m.role]}
                  {since ? ` · desde ${formatOrderTime(since)}` : ''}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {canManageTeam ? (
          <View style={styles.quickRow}>
            <Quick
              icon="person-add"
              label="Cadastrar"
              onPress={() => router.push('/merchant/team/create' as any)}
            />
            <Quick
              icon="time-outline"
              label="Ponto"
              onPress={() => router.push('/merchant/punches' as any)}
            />
            <Quick
              icon="list-outline"
              label="Auditoria"
              onPress={() => router.push('/merchant/audit' as any)}
            />
            <Quick
              icon="layers-outline"
              label="Avançado"
              onPress={() => router.push('/merchant/advanced' as any)}
            />
          </View>
        ) : null}

        {canManageTeam && pending.length > 0 ? (
          <>
            <View style={styles.pendingHead}>
              <Text style={styles.section}>Solicitações pendentes</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pending.length}</Text>
              </View>
            </View>
            {pending.map((req) => (
              <View key={req.id} style={styles.pendingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{req.name}</Text>
                  <Text style={styles.memberMeta}>
                    Quer ser {STAFF_ROLE_LABEL[req.role]} · {req.email}
                  </Text>
                  <Text style={styles.pendingDate}>
                    Pedido {formatOrderDateTime(req.createdAt)}
                  </Text>
                </View>
                <View style={styles.pendingActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => void onApprove(req)}
                  >
                    <Ionicons name="checkmark" size={18} color="#fff" />
                    <Text style={styles.approveText}>Aceitar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => void onReject(req)}>
                    <Ionicons name="close" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : null}

        {canManageTeam ? (
          <>
            <Text style={styles.section}>Equipe</Text>
            <View style={styles.filterRow}>
              {ROLE_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipOn]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[styles.filterText, filter === f.key && styles.filterTextOn]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.section}>Quem tem acesso</Text>
        )}

        {filteredActive.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="people-outline" size={32} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Ninguém nesta categoria ainda.</Text>
          </View>
        ) : (
          filteredActive.map((m) => {
            const color = roleAccent(m.role);
            const info = extras[m.id];
            return (
              <View key={m.id} style={styles.memberWrap}>
                <View style={[styles.memberCard, info?.open && styles.memberCardOn]}>
                  <View style={[styles.avatar, { backgroundColor: color + '18' }]}>
                    <Ionicons
                      name={
                        m.role === 'owner'
                          ? 'shield'
                          : m.role === 'manager'
                            ? 'briefcase'
                            : m.role === 'kitchen'
                              ? 'flame'
                              : 'keypad'
                      }
                      size={20}
                      color={color}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      {info?.open ? (
                        <View style={styles.onShift}>
                          <Text style={styles.onShiftText}>
                            Em turno
                            {info.sinceAt ? ` · ${formatOrderTime(info.sinceAt)}` : ''}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.memberMeta}>
                      {STAFF_ROLE_LABEL[m.role]} · {m.email}
                    </Text>
                    {canManageTeam ? (
                      <>
                        <View style={styles.pinRow}>
                          <Text style={styles.pinMeta}>PIN: {m.pin || '—'}</Text>
                          {m.pin ? (
                            <TouchableOpacity
                              style={styles.copyPinBtn}
                              onPress={() => void copyPin(m)}
                              hitSlop={8}
                            >
                              <Ionicons name="copy-outline" size={14} color={theme.colors.primary} />
                              <Text style={styles.copyPinText}>Copiar</Text>
                            </TouchableOpacity>
                          ) : null}
                        </View>
                        <Text style={styles.detailMeta}>
                          {m.role === 'owner'
                            ? `Cadastro ${formatOrderDate(m.createdAt)}`
                            : info?.entriesToday
                              ? `Hoje: ${info.entriesToday} entrada(s) · ${formatMins(info.minutesToday)}${
                                  info.lastAt
                                    ? ` · último ${formatWaitLabel(info.lastAt, nowMs)}`
                                    : ''
                                }`
                              : `Sem ponto hoje · desde ${formatOrderDate(m.createdAt)}`}
                        </Text>
                        <Text style={styles.roleHint}>{roleDescription(m.role)}</Text>
                      </>
                    ) : null}
                  </View>
                  {canManageTeam ? (
                    <View style={styles.memberActions}>
                      <TouchableOpacity onPress={() => startPinEdit(m)} hitSlop={6}>
                        <Ionicons name="keypad-outline" size={20} color={theme.colors.primary} />
                      </TouchableOpacity>
                      {m.role !== 'owner' ? (
                        <>
                          <TouchableOpacity onPress={() => changeRole(m)} hitSlop={6}>
                            <Ionicons
                              name="swap-horizontal"
                              size={20}
                              color={theme.colors.primary}
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() =>
                              Alert.alert('Desativar', `Tirar ${m.name} da equipe ativa?`, [
                                { text: 'Cancelar', style: 'cancel' },
                                {
                                  text: 'Desativar',
                                  style: 'destructive',
                                  onPress: () =>
                                    void deactivateStaffMember(businessId!, m.id).then(refresh),
                                },
                              ])
                            }
                            hitSlop={6}
                          >
                            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                          </TouchableOpacity>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                {canManageTeam && pinEditId === m.id ? (
                  <View style={styles.pinEdit}>
                    <Text style={styles.pinEditLabel}>Novo PIN de {m.name}</Text>
                    <View style={styles.pinEditRow}>
                      <TextInput
                        style={styles.pinInput}
                        value={pinValue}
                        onChangeText={(t) => setPinValue(t.replace(/\D/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxLength={4}
                        placeholder="0000"
                        placeholderTextColor={theme.colors.textMuted}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[
                          styles.pinSave,
                          pinBusy || pinValue.length < 4 ? styles.pinSaveDisabled : null,
                        ]}
                        disabled={pinBusy || pinValue.length < 4}
                        onPress={() => void savePin(m)}
                      >
                        <Text style={styles.pinSaveText}>Salvar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pinCancel}
                        onPress={() => {
                          setPinEditId(null);
                          setPinValue('');
                        }}
                      >
                        <Text style={styles.pinCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {canManageTeam && inactiveMembers.length > 0 ? (
          <>
            <TouchableOpacity
              style={styles.inactiveToggle}
              onPress={() => setShowInactive((v) => !v)}
            >
              <Text style={styles.section}>
                Inativos ({inactiveMembers.length})
              </Text>
              <Ionicons
                name={showInactive ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
            {showInactive
              ? inactiveMembers.map((m) => (
                  <View key={m.id} style={styles.inactiveCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{m.name}</Text>
                      <Text style={styles.memberMeta}>
                        {STAFF_ROLE_LABEL[m.role]} · {m.email}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.reactivateBtn}
                      onPress={() =>
                        void (async () => {
                          const res = await reactivateStaffMember(businessId!, m.id);
                          if (!res.ok) Alert.alert('Reativar', res.error);
                          else await refresh();
                        })()
                      }
                    >
                      <Text style={styles.reactivateText}>Reativar</Text>
                    </TouchableOpacity>
                  </View>
                ))
              : null}
          </>
        ) : null}

        <Text style={styles.hint}>
          Dono vê tudo. Gerente gerencia equipe. Cozinha e caixa usam PIN + ponto no sistema
          avançado.
        </Text>
      </KeyboardScreen>
    </MobileShell>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <View style={styles.kpi}>
      <Text style={[styles.kpiValue, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Quick({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress} activeOpacity={0.88}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <Text style={styles.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, paddingBottom: 48 },
  shopTitle: {
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  shopSub: { color: theme.colors.textMuted, marginTop: 2, marginBottom: 12 },
  kpiRow: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    paddingVertical: 12,
    marginBottom: 10,
  },
  kpi: { flex: 1, alignItems: 'center' },
  kpiValue: {
    fontSize: 18,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  kpiLabel: { fontSize: 10, color: theme.colors.textMuted, marginTop: 2 },
  roleSummary: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  roleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  roleDot: { width: 8, height: 8, borderRadius: 4 },
  roleChipText: { fontSize: 12, fontWeight: theme.fontWeight.semibold, color: theme.colors.text },
  quickRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quick: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  quickLabel: { fontSize: 11, fontWeight: theme.fontWeight.bold, color: theme.colors.text },
  section: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    fontSize: 15,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  filterChipOn: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterText: { fontSize: 12, fontWeight: '600', color: theme.colors.text },
  filterTextOn: { color: '#fff' },
  emptyBox: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  emptyText: { color: theme.colors.textMuted },
  onShiftBox: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    gap: 6,
  },
  onShiftTitle: {
    fontSize: 13,
    fontWeight: theme.fontWeight.bold,
    color: '#047857',
    marginBottom: 2,
  },
  onShiftRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  onShiftLine: { fontSize: 13, color: theme.colors.text, fontWeight: theme.fontWeight.semibold },
  memberWrap: { marginBottom: 10 },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  memberCardOn: { borderColor: '#6EE7B7', backgroundColor: '#ECFDF5' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  memberName: { fontWeight: theme.fontWeight.bold, color: theme.colors.text, fontSize: 15 },
  onShift: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  onShiftText: { color: '#fff', fontSize: 10, fontWeight: theme.fontWeight.bold },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  pinMeta: {
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  copyPinBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyPinText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.primary,
  },
  memberMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  detailMeta: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 3, lineHeight: 15 },
  roleHint: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3, lineHeight: 15 },
  memberActions: { gap: 12, paddingTop: 4 },
  pinEdit: {
    marginTop: 6,
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  pinEditLabel: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  pinEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pinInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: theme.colors.text,
    fontSize: 18,
    letterSpacing: 4,
    fontWeight: theme.fontWeight.bold,
    textAlign: 'center',
  },
  pinSave: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pinSaveDisabled: { opacity: 0.5 },
  pinSaveText: { color: '#fff', fontWeight: theme.fontWeight.bold },
  pinCancel: { paddingHorizontal: 8, paddingVertical: 10 },
  pinCancelText: { color: theme.colors.textMuted, fontWeight: theme.fontWeight.semibold },
  pendingHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: theme.fontWeight.bold },
  pendingCard: {
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FDBA74',
    marginBottom: 8,
    gap: 10,
  },
  pendingDate: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  pendingActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  approveText: { color: '#fff', fontWeight: theme.fontWeight.bold, fontSize: 13 },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  inactiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  inactiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  reactivateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryLight,
  },
  reactivateText: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold, fontSize: 12 },
  hint: { marginTop: 16, fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
});
