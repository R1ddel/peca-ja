/**
 * Equipe HQ — atribuição de papéis (web, CEO only).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { platformAdminListStaff, platformAdminSetStaffRole } from '@/services/platformClient';
import { STAFF_ROLES, roleLabel, type PlatformRole } from '@/services/platformRoles';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, LoadingBlock, PageHeader } from '@/app/admin/_components';

type StaffRow = {
  id: string;
  name: string;
  email: string;
  platformRole: PlatformRole | null;
};

export default function AdminTeamScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate({ permission: 'team' });
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [email, setEmail] = useState('');
  const [promoteRole, setPromoteRole] = useState<PlatformRole>('ops');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminListStaff(token);
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao listar equipe.');
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

  async function setRole(userId: string, role: PlatformRole | null) {
    setErr('');
    setMsg('');
    const token = await getPlatformToken();
    if (!token) return;
    const res = await platformAdminSetStaffRole(token, userId, role);
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao alterar papel.');
      return;
    }
    setMsg(role ? `Papel → ${roleLabel(role)}` : 'Papel removido.');
    await load();
  }

  async function promoteByEmail() {
    const targetEmail = email.trim().toLowerCase();
    if (!targetEmail.includes('@')) {
      setErr('Informe um e-mail válido já cadastrado.');
      return;
    }
    await setRole(`email:${targetEmail}`, promoteRole);
    setEmail('');
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader
        title="Equipe HQ"
        lead="CEO define papéis · contas cloud existentes"
      />
      <ErrBox message={err} />
      {msg ? (
        <View style={hqStyles.okBox}>
          <Text style={hqStyles.okText}>{msg}</Text>
        </View>
      ) : null}

      <Text style={hqStyles.h2}>Promover por e-mail</Text>
      <View style={hqStyles.card}>
        <TextInput
          style={[hqStyles.input, { marginBottom: 8 }]}
          placeholder="E-mail da conta"
          placeholderTextColor={hq.faint}
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <View style={[hqStyles.row, { marginBottom: 8 }]}>
          {STAFF_ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[hqStyles.btnGhost, promoteRole === r && { borderColor: hq.green }]}
              onPress={() => setPromoteRole(r)}
            >
              <Text style={hqStyles.btnGhostText}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={hqStyles.btn} onPress={() => void promoteByEmail()}>
          <Text style={hqStyles.btnText}>Atribuir {promoteRole}</Text>
        </TouchableOpacity>
      </View>

      <Text style={hqStyles.h2}>Staff ({staff.length})</Text>
      {staff.length === 0 && !loading ? (
        <Text style={hqStyles.empty}>Nenhum membro.</Text>
      ) : (
        staff.map((s) => (
          <View key={s.id} style={hqStyles.card}>
            <Text style={hqStyles.tableCell}>
              {s.name} · {roleLabel(s.platformRole)}
            </Text>
            <Text style={hqStyles.lead}>
              {s.email} · {s.id}
            </Text>
            <View style={[hqStyles.row, { marginTop: 8 }]}>
              {STAFF_ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[
                    hqStyles.btnGhost,
                    s.platformRole === r && { borderColor: hq.green, backgroundColor: hq.greenDim },
                  ]}
                  onPress={() => void setRole(s.id, r)}
                >
                  <Text style={hqStyles.btnGhostText}>{r}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={hqStyles.btnGhost} onPress={() => void setRole(s.id, null)}>
                <Text style={hqStyles.btnGhostText}>remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
