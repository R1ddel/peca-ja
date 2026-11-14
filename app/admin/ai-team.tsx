/**
 * Equipe IA no Command Center — roster + run com dados reais do HQ.
 * Manuais: equipe-ia/agentes/. Não altera app cliente.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { useHqMode } from '@/app/admin/_hqContext';
import { getPlatformToken } from '@/services/platformSession';
import { hq, hqStyles } from '@/app/admin/_ui';
import {
  ErrBox,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusPill,
  EnvBanner,
  KpiCard,
} from '@/app/admin/_components';
import {
  decideHqAiApproval,
  listHqAiAgents,
  listHqAiApprovals,
  listHqAiInsights,
  runHqAiAgents,
  clearHqAiInsights,
  type HqAiApproval,
  type HqAiInsight,
} from '@/utils/hqAiAgents';

export default function AdminAiTeamScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { mode, environmentLabel, isProjection } = useHqMode();
  const [insights, setInsights] = useState<HqAiInsight[]>([]);
  const [approvals, setApprovals] = useState<HqAiApproval[]>([]);
  const [briefing, setBriefing] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const agents = useMemo(() => listHqAiAgents(), []);
  const runnable = useMemo(() => agents.filter((a) => a.runnable), [agents]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [ins, apr] = await Promise.all([listHqAiInsights(), listHqAiApprovals()]);
      setInsights(ins);
      setApprovals(apr.filter((a) => a.status === 'pending'));
      const lastChefe = ins.find((i) => i.agentId === 'chefe');
      setBriefing(lastChefe?.body || '');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (ok) void load();
    }, [ok, load])
  );

  async function runAll() {
    setRunning(true);
    setErr('');
    setMsg('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await runHqAiAgents({ token, hqMode: mode });
      setBriefing(res.briefing);
      setMsg(`Run ok · ${res.insights.length} insight(s) novos · ${res.approvals.length} aprovação(ões) pendente(s).`);
      await load();
    } catch (e: any) {
      setErr(e?.message || 'Falha ao rodar agentes.');
    } finally {
      setRunning(false);
    }
  }

  async function onDecide(id: string, status: 'approved' | 'rejected') {
    await decideHqAiApproval(id, status);
    setMsg(status === 'approved' ? 'Aprovado.' : 'Recusado.');
    await load();
  }

  async function onClear() {
    await clearHqAiInsights();
    setMsg('Insights limpos.');
    await load();
  }

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  const critical = insights.filter((i) => i.severity === 'critical').length;
  const warning = insights.filter((i) => i.severity === 'warning').length;

  return (
    <ScrollView
      style={hqStyles.screen}
      contentContainerStyle={hqStyles.content}
      refreshControl={<RefreshControl refreshing={loading && !insights.length} onRefresh={() => void load()} />}
    >
      <PageHeader
        title="Equipe IA"
        lead={`${isProjection ? environmentLabel + ' · ' : ''}Agentes do pacote equipe-ia · análise com dados do HQ`}
        right={
          <TouchableOpacity
            style={[styles.runBtn, running && { opacity: 0.7 }]}
            onPress={() => void runAll()}
            disabled={running}
            accessibilityRole="button"
            accessibilityLabel="Rodar agentes"
          >
            {running ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.runBtnText}>Rodar agentes</Text>
            )}
          </TouchableOpacity>
        }
      />
      <EnvBanner />
      <ErrBox message={err} />
      {msg ? <Text style={styles.msg}>{msg}</Text> : null}

      <View style={styles.kpiRow}>
        <KpiCard label="Agentes" value={agents.length} tone="blue" />
        <KpiCard label="Automáticos" value={runnable.length} tone="green" hint="rodam no botão" />
        <KpiCard label="Críticos" value={critical} tone={critical ? 'red' : 'green'} />
        <KpiCard label="Aprovações" value={approvals.length} tone={approvals.length ? 'amber' : 'green'} />
      </View>

      {briefing ? (
        <SectionCard title="Briefing (Chefe de Gabinete)">
          <Text style={styles.briefing}>{briefing}</Text>
        </SectionCard>
      ) : null}

      {approvals.length > 0 ? (
        <SectionCard title="Fila de aprovações">
          {approvals.map((a) => (
            <View key={a.id} style={styles.approval}>
              <View style={styles.approvalTop}>
                <StatusPill label={a.urgency.toUpperCase()} tone={a.urgency === 'alta' ? 'red' : 'amber'} />
                <Text style={styles.agentMini}>{a.agent}</Text>
              </View>
              <Text style={styles.approvalWhat}>{a.what}</Text>
              <Text style={styles.muted}>{a.why}</Text>
              <Text style={styles.muted}>Risco: {a.risk}</Text>
              <Text style={styles.reco}>Recomendação: {a.recommendation}</Text>
              <View style={styles.rowBtns}>
                <TouchableOpacity style={styles.okBtn} onPress={() => void onDecide(a.id, 'approved')}>
                  <Text style={styles.okBtnText}>APROVO</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.noBtn} onPress={() => void onDecide(a.id, 'rejected')}>
                  <Text style={styles.noBtnText}>NÃO APROVO</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Insights (${insights.length})`}
        action={
          insights.length ? (
            <TouchableOpacity onPress={() => void onClear()}>
              <Text style={styles.link}>Limpar</Text>
            </TouchableOpacity>
          ) : null
        }
      >
        {insights.length === 0 ? (
          <Text style={styles.muted}>Nenhum insight ainda. Toque em “Rodar agentes”.</Text>
        ) : (
          insights.slice(0, 40).map((i) => (
            <TouchableOpacity
              key={i.id}
              style={styles.insight}
              activeOpacity={i.href ? 0.85 : 1}
              onPress={() => {
                if (i.href) router.push(i.href as any);
              }}
            >
              <View style={styles.insightTop}>
                <StatusPill
                  label={i.severity}
                  tone={i.severity === 'critical' ? 'red' : i.severity === 'warning' ? 'amber' : 'blue'}
                />
                <Text style={styles.agentMini}>{i.agent}</Text>
                <Text style={styles.time}>
                  {new Date(i.createdAt).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.insightTitle}>{i.title}</Text>
              <Text style={styles.muted}>{i.body}</Text>
              {i.href ? <Text style={styles.link}>Abrir →</Text> : null}
            </TouchableOpacity>
          ))
        )}
      </SectionCard>

      <SectionCard title="Roster (15 agentes)">
        <Text style={[styles.muted, { marginBottom: 10 }]}>
          Automáticos leem o HQ. Os outros trabalham em chat Cursor com o manual em equipe-ia/agentes/.
        </Text>
        {agents.map((a) => (
          <View key={a.id} style={styles.agentRow}>
            <Text style={styles.emoji}>{a.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.agentName}>
                {a.name}{' '}
                <Text style={styles.area}>· {a.area}</Text>
              </Text>
              <Text style={styles.muted}>{a.blurb}</Text>
              <Text style={styles.manual}>{a.manual}</Text>
            </View>
            <StatusPill
              label={a.runnable ? 'auto' : 'manual'}
              tone={a.runnable ? 'green' : 'muted'}
            />
          </View>
        ))}
      </SectionCard>

      <Text style={styles.foot}>
        Avisos: agentes não gastam anúncio sozinhos · deploy e Pix exigem você · manuais em equipe-ia/
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  runBtn: {
    backgroundColor: hq.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 140,
    alignItems: 'center',
  },
  runBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  msg: { color: hq.greenDark, fontWeight: '700', marginBottom: 10, fontSize: 13 },
  kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  briefing: {
    fontSize: 13,
    lineHeight: 20,
    color: hq.text,
    fontFamily: 'monospace',
  },
  approval: {
    borderTopWidth: 1,
    borderTopColor: hq.line,
    paddingVertical: 12,
  },
  approvalTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  approvalWhat: { fontSize: 15, fontWeight: '800', color: hq.text, marginBottom: 4 },
  reco: { fontSize: 13, fontWeight: '700', color: hq.greenDark, marginTop: 6, marginBottom: 8 },
  muted: { fontSize: 13, color: hq.muted, lineHeight: 18 },
  rowBtns: { flexDirection: 'row', gap: 8, marginTop: 4 },
  okBtn: {
    backgroundColor: hq.greenDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  okBtnText: { color: hq.greenDark, fontWeight: '800', fontSize: 12 },
  noBtn: {
    backgroundColor: hq.redDim,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  noBtnText: { color: hq.red, fontWeight: '800', fontSize: 12 },
  insight: {
    borderTopWidth: 1,
    borderTopColor: hq.line,
    paddingVertical: 12,
  },
  insightTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  insightTitle: { fontSize: 14, fontWeight: '800', color: hq.text, marginBottom: 4 },
  agentMini: { fontSize: 12, fontWeight: '700', color: hq.muted },
  time: { fontSize: 11, color: hq.faint, marginLeft: 'auto' },
  link: { color: hq.greenDark, fontWeight: '700', fontSize: 12, marginTop: 6 },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: hq.line,
  },
  emoji: { fontSize: 20, width: 28, textAlign: 'center' },
  agentName: { fontSize: 14, fontWeight: '800', color: hq.text },
  area: { fontWeight: '600', color: hq.muted },
  manual: { fontSize: 11, color: hq.faint, marginTop: 2 },
  foot: {
    marginTop: 8,
    marginBottom: 28,
    fontSize: 12,
    color: hq.faint,
    lineHeight: 17,
  },
});
