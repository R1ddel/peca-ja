/**
 * Bloco do termo no final do painel do entregador.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { DriverApplication } from '@/utils/partners';
import { hasAcceptedDriverTerms } from '@/utils/partners';
import {
  DRIVER_TERMS_TITLE,
  DRIVER_TERMS_VERSION,
  buildDriverTermsBody,
} from '@/constants/driverTerms';
import { theme } from '@/constants/theme';

type Props = {
  app: DriverApplication;
};

export function DriverTermsPanelSection({ app }: Props) {
  const [expanded, setExpanded] = useState(false);
  const accepted = hasAcceptedDriverTerms(app);

  const body = useMemo(
    () =>
      buildDriverTermsBody({
        name: app.name,
        document: app.document,
        vehicleType: app.vehicleType || app.vehicle || 'Veículo',
        plate: app.plate,
        city: app.city,
      }),
    [app]
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.iconWrap}>
          <Ionicons name="document-text" size={20} color="#7C3AED" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Termo de responsabilidade</Text>
          <Text style={styles.sub}>
            Versão {DRIVER_TERMS_VERSION}
            {accepted ? ' · aceito' : ' · pendente'}
          </Text>
        </View>
        {accepted ? (
          <View style={styles.okPill}>
            <Ionicons name="checkmark" size={14} color="#065F46" />
            <Text style={styles.okPillText}>OK</Text>
          </View>
        ) : (
          <View style={styles.pendPill}>
            <Text style={styles.pendPillText}>Assinar</Text>
          </View>
        )}
      </View>

      <Text style={styles.hint} numberOfLines={expanded ? undefined : 3}>
        {DRIVER_TERMS_TITLE}. Acidentes, multas e condutas na rua são do entregador — o Peça Já
        intermediário não assume esses riscos.
      </Text>

      {expanded ? (
        <ScrollView style={styles.termsBox} nestedScrollEnabled>
          <Text style={styles.termsText}>{body}</Text>
        </ScrollView>
      ) : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>
            {expanded ? 'Ocultar texto' : 'Ler termo nesta tela'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() =>
            router.push({
              pathname: '/driver/terms' as any,
              params: { id: app.id },
            })
          }
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>
            {accepted ? 'Abrir termo' : 'Assinar termo'}
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
    marginBottom: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#C4B5FD',
    padding: 14,
    gap: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  sub: {
    fontSize: 11,
    color: '#6D28D9',
    fontWeight: '600',
    marginTop: 2,
  },
  okPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  okPillText: { color: '#065F46', fontWeight: '800', fontSize: 11 },
  pendPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pendPillText: { color: '#92400E', fontWeight: '800', fontSize: 11 },
  hint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
  },
  termsBox: {
    maxHeight: 220,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
    padding: 12,
  },
  termsText: {
    fontSize: 11,
    color: theme.colors.text,
    lineHeight: 16,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    color: '#7C3AED',
    fontWeight: '800',
    fontSize: 13,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#7C3AED',
  },
  primaryBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
});
