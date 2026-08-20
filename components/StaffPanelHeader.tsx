import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StaffRole, STAFF_ROLE_LABEL } from '@/utils/merchantTeam';
import { punchOutAndLogout } from '@/utils/merchantPunch';
import { theme } from '@/constants/theme';

type Props = {
  shopName: string;
  operatorName: string;
  role: StaffRole;
  title: string;
  subtitle?: string;
  accent?: string;
  /** Sobrescreve a ação padrão do botão "Trocar". */
  onSwitchOperator?: () => void;
};

export function StaffPanelHeader({
  shopName,
  operatorName,
  role,
  title,
  subtitle,
  accent = theme.colors.primary,
  onSwitchOperator,
}: Props) {
  function switchOperator() {
    if (onSwitchOperator) {
      onSwitchOperator();
      return;
    }
    Alert.alert(
      'Trocar operador',
      role === 'owner'
        ? 'Sair do painel do dono?\nVocê precisará digitar o PIN de novo.'
        : 'Bater ponto de saída e sair desta função?\nSeu turno será fechado agora.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: role === 'owner' ? 'Sair' : 'Bater saída e sair',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await punchOutAndLogout();
              router.replace('/merchant/advanced' as any);
            })();
          },
        },
      ]
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={[styles.bar, { backgroundColor: accent }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.shop}>{shopName}</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        <TouchableOpacity
          style={styles.logout}
          onPress={switchOperator}
          accessibilityLabel="Trocar operador"
        >
          <Ionicons name="swap-horizontal-outline" size={18} color="#fff" />
          <Text style={styles.logoutText}>Trocar</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.operator}>
        <Ionicons name="person-circle" size={22} color={accent} />
        <Text style={styles.operatorText}>
          {operatorName} · {STAFF_ROLE_LABEL[role]}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  bar: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  shop: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: theme.fontWeight.extrabold,
    marginTop: 2,
  },
  sub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4, lineHeight: 18 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  logoutText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.bold },
  operator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 10,
  },
  operatorText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
  },
});
