/**
 * Frota / entregadores — Command Center (web).
 */
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { getPlatformToken } from '@/services/platformSession';
import { fleetAdminRemote } from '@/services/fleetClient';
import type { FleetDriverPresence } from '@/services/fleetTypes';
import type { ConductReport } from '@/types';
import { hq, hqStyles } from '@/app/admin/_ui';
import { ErrBox, KpiCard, LoadingBlock, PageHeader } from '@/app/admin/_components';
import { useHqMode } from '@/app/admin/_hqContext';
import { HQ_YEAR2 } from '@/services/hqProjection';

export default function AdminFleetScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { isProjection } = useHqMode();
  const [drivers, setDrivers] = useState<FleetDriverPresence[]>([]);
  const [reports, setReports] = useState<ConductReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await fleetAdminRemote({
        token,
        adminAction: 'list',
        hqMode: isProjection ? 'projection' : 'real',
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar frota.');
        return;
      }
      setDrivers(Object.values((res as any).drivers || {}));
      setReports(Array.isArray((res as any).reports) ? (res as any).reports : []);
    } finally {
      setLoading(false);
    }
  }, [isProjection]);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function toggleBlock(d: FleetDriverPresence) {
    const token = await getPlatformToken();
    if (!token) return;
    if (!d.blocked && reason.trim().length < 3) {
      setErr('Informe o motivo para bloquear.');
      return;
    }
    const res = await fleetAdminRemote({
      token,
      adminAction: d.blocked ? 'unblock' : 'block',
      fleetId: d.fleetId,
      reason: reason.trim() || undefined,
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha na ação.');
      return;
    }
    setReason('');
    await load();
  }

  async function setReportStatus(reportId: string, status: ConductReport['status']) {
    const token = await getPlatformToken();
    if (!token) return;
    const res = await fleetAdminRemote({
      token,
      adminAction: 'set_report_status',
      reportId,
      status,
    });
    if (!res?.ok) {
      setErr((res as any)?.message || 'Falha ao atualizar denúncia.');
      return;
    }
    await load();
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const online = drivers.filter((d) => d.online && !d.blocked).length;
  const blocked = drivers.filter((d) => d.blocked).length;
  const projectionOn = isProjection;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
    >
      <PageHeader
        title="Entregadores"
        lead={
          projectionOn
            ? 'AMBIENTE DE PLANEJAMENTO — KPIs projetados; lista é amostra'
            : 'Presença, bloqueio e denúncias'
        }
      />
      <ErrBox message={err} />

      <View style={hqStyles.row}>
        <KpiCard
          label="Total"
          value={projectionOn ? HQ_YEAR2.fleetTotal.toLocaleString('pt-BR') : drivers.length}
        />
        <KpiCard
          label="Online"
          value={projectionOn ? HQ_YEAR2.fleetOnline.toLocaleString('pt-BR') : online}
          tone="green"
        />
        <KpiCard label="Bloqueados" value={projectionOn ? 186 : blocked} tone="red" />
        <KpiCard label="Denúncias" value={reports.length} tone="amber" />
      </View>

      <TextInput
        style={hqStyles.input}
        placeholder="Motivo (obrigatório para bloquear)"
        placeholderTextColor={hq.faint}
        value={reason}
        onChangeText={setReason}
      />

      <Text style={hqStyles.h2}>Frota</Text>
      <View style={hqStyles.card}>
        {drivers.length === 0 ? (
          <Text style={hqStyles.empty}>Nenhum entregador no fleet state.</Text>
        ) : (
          drivers.map((d) => (
            <View key={d.fleetId} style={hqStyles.tableRow}>
              <View style={{ flex: 1 }}>
                <Text style={hqStyles.tableCell}>{d.name}</Text>
                <Text style={{ color: hq.muted, fontSize: 12 }}>
                  {d.online ? 'Online' : 'Offline'}
                  {d.blocked ? ' · BLOQUEADO' : ''} · {d.phone}
                </Text>
              </View>
              <TouchableOpacity style={hqStyles.btnGhost} onPress={() => void toggleBlock(d)}>
                <Text style={[hqStyles.btnGhostText, { color: d.blocked ? hq.green : hq.red }]}>
                  {d.blocked ? 'Desbloquear' : 'Bloquear'}
                </Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <Text style={hqStyles.h2}>Denúncias</Text>
      <View style={hqStyles.card}>
        {reports.length === 0 ? (
          <Text style={hqStyles.empty}>Nenhuma denúncia.</Text>
        ) : (
          reports.map((r) => (
            <View key={r.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: hq.line }}>
              <Text style={hqStyles.tableCell}>
                {r.category} · {r.status}
              </Text>
              <Text style={{ color: hq.muted, fontSize: 12 }}>{r.description}</Text>
              <View style={[hqStyles.row, { marginTop: 8 }]}>
                <TouchableOpacity
                  style={hqStyles.btnGhost}
                  onPress={() => void setReportStatus(r.id, 'em_analise')}
                >
                  <Text style={hqStyles.btnGhostText}>Em análise</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={hqStyles.btnGhost}
                  onPress={() => void setReportStatus(r.id, 'encerrado')}
                >
                  <Text style={hqStyles.btnGhostText}>Encerrar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
