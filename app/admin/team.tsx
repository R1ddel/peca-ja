import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminListStaff,
  platformAdminSetStaffRole,
} from '@/services/platformClient';
import { theme } from '@/constants/theme';

type StaffRow = {
  id: string;
  name: string;
  email: string;
  platformRole: 'ceo' | 'ops' | null;
};

export default function AdminTeamScreen() {
  const { ok } = useAdminGate({ ceoOnly: true });
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminListStaff(token);
      if (!res?.ok) {
        Alert.alert('Equipe', (res as any)?.message || 'Falha.');
        return;
      }
      setStaff(((res as any).staff || []) as StaffRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function setRole(userId: string, role: 'ops' | 'ceo' | null) {
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminSetStaffRole(token, userId, role);
    if (!res?.ok) {
      Alert.alert('Erro', (res as any)?.message || 'Falha.');
      return;
    }
    await load();
  }

  async function promoteByEmail() {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail.includes('@')) {
      Alert.alert('Equipe', 'Informe um e-mail válido já cadastrado no app.');
      return;
    }
    await setRole(`email:${targetEmail}`, 'ops');
    setEmail('');
  }

  if (!ok) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.h1}>Equipe HQ</Text>
      <Text style={styles.hint}>
        CEO vem de PLATFORM_CEO_EMAILS. Promova contas cloud existentes a Ops.
      </Text>
      <View style={styles.box}>
        <TextInput
          style={styles.input}
          placeholder="E-mail da conta (já cadastrada)"
          placeholderTextColor="#8b949e"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <TouchableOpacity style={styles.btn} onPress={() => void promoteByEmail()}>
          <Text style={styles.btnText}>Promover a Ops</Text>
        </TouchableOpacity>
      </View>
      {loading && staff.length === 0 ? <ActivityIndicator color={theme.colors.primary} /> : null}
      <FlatList
        data={staff}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>
              {item.name} · {item.platformRole}
            </Text>
            <Text style={styles.meta}>
              {item.email} · {item.id}
            </Text>
            <View style={styles.actions}>
              {item.platformRole !== 'ops' ? (
                <TouchableOpacity style={styles.mini} onPress={() => void setRole(item.id, 'ops')}>
                  <Text style={styles.miniText}>Ops</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.mini} onPress={() => void setRole(item.id, null)}>
                <Text style={styles.miniText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  hint: { color: '#8b949e', marginBottom: 12, fontSize: 13 },
  box: {
    backgroundColor: '#161b22',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  input: {
    backgroundColor: '#0f1419',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 10,
    color: '#fff',
    marginBottom: 8,
  },
  btn: {
    backgroundColor: theme.colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '800' },
  card: {
    backgroundColor: '#161b22',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  title: { color: '#fff', fontWeight: '700' },
  meta: { color: '#8b949e', fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  mini: { backgroundColor: '#21262d', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  miniText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
