/**
 * Central de Problemas — detecção, diagnóstico e ação (HQ V2).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAdminGate } from '@/app/admin/_useAdminGate';
import { useHqMode } from '@/app/admin/_hqContext';
import { getPlatformToken } from '@/services/platformSession';
import {
  platformAdminProblemsNow,
  platformAdminProblemAction,
} from '@/services/platformClient';
import { formatPrice } from '@/data/businesses';
import { hq, hqStyles } from '@/app/admin/_ui';
import {
  ErrBox,
  KpiCard,
  LoadingBlock,
  PageHeader,
  SectionCard,
  StatusPill,
  EnvBanner,
  LiveBadge,
} from '@/app/admin/_components';
import { AdminDrawer } from '@/app/admin/_drawer';
import {
  DELAY_CLASS_LABEL,
  ROOT_CAUSE_OPTIONS,
  type HqProblemLive,
} from '@/services/hqProblems';

export default function AdminProblemsScreen() {
  const { ok, isLoading: gateLoading, isWeb } = useAdminGate();
  const { mode, environmentLabel, isProjection } = useHqMode();
  const params = useLocalSearchParams<{ severity?: string; sla?: string }>();
  const [summary, setSummary] = useState<any>({});
  const [problems, setProblems] = useState<HqProblemLive[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selected, setSelected] = useState<HqProblemLive | null>(null);
  const [msgDraft, setMsgDraft] = useState('');
  const [msgAction, setMsgAction] = useState<string | null>(null);
  const [rootCause, setRootCause] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const token = await getPlatformToken();
      if (!token) {
        setErr('Sem sessão cloud.');
        return;
      }
      const res = await platformAdminProblemsNow(token, {
        hqMode: mode,
        severity: params.severity,
        sla: params.sla,
      });
      if (!res?.ok) {
        setErr((res as any)?.message || 'Falha ao carregar problemas.');
        return;
      }
      setSummary((res as any).summary || {});
      setProblems(((res as any).problems || []) as HqProblemLive[]);
    } finally {
      setLoading(false);
    }
  }, [mode, params.severity, params.sla]);

  useFocusEffect(
    useCallback(() => {
      if (!ok) return;
      void load();
      const id = setInterval(() => void load(), 15000);
      return () => clearInterval(id);
    }, [ok, load])
  );

  const openSolve = (p: HqProblemLive) => {
    setSelected(p);
    setMsgAction(null);
    setMsgDraft('');
    setRootCause('');
    setToast('');
  };

  async function runAction(problemAction: string, message?: string) {
    if (!selected) return;
    setBusy(true);
    setToast('');
    try {
      const token = await getPlatformToken();
      if (!token) return;
      const res = await platformAdminProblemAction(token, {
        orderId: selected.orderId,
        problemAction,
        message,
        rootCause: problemAction === 'resolver' ? rootCause || undefined : undefined,
        hqMode: mode,
      });
      if (!res?.ok) {
        setToast((res as any)?.message || 'Ação falhou.');
        return;
      }
      setToast('Ação registrada.');
      setMsgAction(null);
      await load();
      if (problemAction === 'resolver') setSelected(null);
      else {
        const refreshed = await platformAdminProblemsNow(token, { hqMode: mode });
        const next = ((refreshed as any)?.problems || []).find(
          (x: HqProblemLive) => x.orderId === selected.orderId
        );
        if (next) setSelected(next);
      }
      if (problemAction === 'ver_pedido') {
        router.push(`/admin/orders?q=${selected.orderId}` as any);
      }
    } finally {
      setBusy(false);
    }
  }

  const sevTone = (s: string) =>
    s === 'critica' || s === 'alta' ? 'red' : s === 'media' ? 'amber' : 'blue';

  if (!isWeb || gateLoading) return <LoadingBlock />;
  if (!ok) return null;

  return (
    <>
      <ScrollView
        style={hqStyles.screen}
        contentContainerStyle={hqStyles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <EnvBanner mode={mode} label={environmentLabel} />
        <PageHeader
          title="Central de Problemas"
          lead="Detectar → diagnosticar → agir → acompanhar"
          right={
            summary.open > 0 ? (
              <LiveBadge text={`${summary.open} abertos`} />
            ) : (
              <StatusPill label="Fila limpa" tone="green" />
            )
          }
        />
        <ErrBox message={err} />

        <View style={hqStyles.row}>
          <KpiCard label="Abertos" value={summary.open ?? 0} tone="amber" />
          <KpiCard label="Críticos" value={summary.critical ?? 0} tone="red" />
          <KpiCard label="Em resolução" value={summary.inProgress ?? 0} tone="blue" />
          <KpiCard label="SLA estourado" value={summary.slaBreached ?? 0} tone="red" />
          <KpiCard label="Resolvidos hoje" value={summary.resolvedToday ?? 0} tone="green" />
        </View>

        <SectionCard title="Problemas agora">
          {problems.length === 0 ? (
            <Text style={hqStyles.empty}>
              {isProjection
                ? 'Nenhum atraso detectado no cenário atual (ou limiar não atingido).'
                : 'Nenhum pedido atrasado acima do limiar operacional no momento.'}
            </Text>
          ) : (
            problems.map((p) => (
              <TouchableOpacity key={p.id} style={styles.row} onPress={() => openSolve(p)}>
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={styles.rowTop}>
                    <StatusPill label={p.severity.toUpperCase()} tone={sevTone(p.severity) as any} />
                    <Text style={styles.meta}>{p.overdueMin} min acima do ETA</Text>
                  </View>
                  <Text style={styles.title} numberOfLines={1}>
                    {p.businessName} · {p.customerName}
                  </Text>
                  <Text style={styles.sub} numberOfLines={2}>
                    {DELAY_CLASS_LABEL[p.delayClass] || p.delayClass} · {p.stage} · próximo:{' '}
                    {p.nextOwner} · {formatPrice(p.total)}
                  </Text>
                  {p.slaBreached ? (
                    <Text style={styles.slaBad}>SLA de 1ª ação estourado</Text>
                  ) : (
                    <Text style={styles.slaOk}>SLA restante ~{p.slaRemainingMin} min</Text>
                  )}
                </View>
                <Text style={styles.chev}>›</Text>
              </TouchableOpacity>
            ))
          )}
        </SectionCard>
      </ScrollView>

      <AdminDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Solucionar problema"
        subtitle={selected?.orderId}
        width={480}
      >
        {selected ? (
          <View style={{ gap: 14 }}>
            <Text style={hqStyles.lead}>
              {selected.businessName} · {selected.orderStatus} · atraso {selected.overdueMin} min
            </Text>
            <View style={hqStyles.row}>
              <StatusPill label={selected.severity.toUpperCase()} tone={sevTone(selected.severity) as any} />
              <StatusPill label={selected.status} tone="muted" />
            </View>

            <Text style={hqStyles.h2}>Problema identificado</Text>
            <Text style={styles.body}>
              Pedido {selected.overdueMin} min acima do tempo esperado ({selected.expectedMin} min).
              Idade do pedido: {selected.ageMin} min.
            </Text>

            <Text style={hqStyles.h2}>Causa provável (pelos dados)</Text>
            <Text style={styles.body}>{selected.probableCause}</Text>
            <Text style={styles.evidence}>
              Evidências: {(selected.evidence || []).join(' · ') || '—'}
            </Text>
            <Text style={styles.body}>
              Classificação: {DELAY_CLASS_LABEL[selected.delayClass]} · Responsável próxima etapa:{' '}
              <Text style={{ fontWeight: '800' }}>{selected.nextOwner}</Text>
            </Text>

            <Text style={hqStyles.h2}>Linha do tempo</Text>
            {(selected.timeline || []).map((ev, i) => (
              <View key={i} style={[styles.tl, ev.late && styles.tlLate]}>
                <Text style={[styles.tlTitle, ev.late && styles.tlLateText]}>
                  {ev.late ? '🟠 ' : ev.at && ev.at !== '—' ? '✅ ' : '⚪ '}
                  {ev.label}
                </Text>
                <Text style={styles.tlMeta}>
                  {ev.at}
                  {ev.meta ? ` · ${ev.meta}` : ''}
                </Text>
              </View>
            ))}

            <Text style={hqStyles.h2}>Ações recomendadas</Text>
            {(selected.recommendedActions || []).map((a) => (
              <TouchableOpacity
                key={a.id}
                style={[hqStyles.btnGhost, a.primary && { borderColor: hq.green }]}
                disabled={busy}
                onPress={() => {
                  if (a.draftMessage) {
                    setMsgAction(a.id);
                    setMsgDraft(a.draftMessage);
                    return;
                  }
                  if (a.id === 'resolver') {
                    setMsgAction('resolver');
                    return;
                  }
                  void runAction(a.id);
                }}
              >
                <Text style={hqStyles.btnGhostText}>
                  {a.primary ? '★ ' : ''}
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}

            {selected.case?.history?.length ? (
              <>
                <Text style={hqStyles.h2}>Histórico do caso</Text>
                {selected.case.history.slice(0, 12).map((h, i) => (
                  <View key={i} style={styles.tl}>
                    <Text style={styles.tlTitle}>{h.text}</Text>
                    <Text style={styles.tlMeta}>
                      {h.at}
                      {h.actorEmail ? ` · ${h.actorEmail}` : ''}
                    </Text>
                  </View>
                ))}
              </>
            ) : null}

            {toast ? <Text style={styles.toast}>{toast}</Text> : null}
          </View>
        ) : null}
      </AdminDrawer>

      <Modal
        visible={!!msgAction}
        transparent
        animationType="fade"
        onRequestClose={() => setMsgAction(null)}
      >
        <Pressable style={styles.modalBg} onPress={() => setMsgAction(null)}>
          <Pressable style={[hqStyles.card, styles.modalCard]} onPress={(e) => e.stopPropagation?.()}>
            <Text style={hqStyles.h2}>
              {msgAction === 'resolver' ? 'Encerrar problema' : 'Confirmar mensagem'}
            </Text>
            {msgAction === 'resolver' ? (
              <>
                <Text style={hqStyles.lead}>Causa raiz (obrigatória para aprendizado)</Text>
                <ScrollView style={{ maxHeight: 180 }}>
                  {ROOT_CAUSE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.causeOpt, rootCause === opt && styles.causeOn]}
                      onPress={() => setRootCause(opt)}
                    >
                      <Text style={styles.causeText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <TextInput
                style={[hqStyles.input, { minHeight: 120, textAlignVertical: 'top' }]}
                multiline
                value={msgDraft}
                onChangeText={setMsgDraft}
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={hqStyles.btnGhost} onPress={() => setMsgAction(null)}>
                <Text style={hqStyles.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={hqStyles.btn}
                disabled={busy || (msgAction === 'resolver' && !rootCause)}
                onPress={() => void runAction(msgAction!, msgDraft)}
              >
                <Text style={hqStyles.btnText}>
                  {msgAction === 'resolver' ? 'Encerrar' : 'Enviar'}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: hq.line,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { color: hq.muted, fontSize: 11, fontWeight: '700' },
  title: { color: hq.text, fontWeight: '800', fontSize: 14 },
  sub: { color: hq.muted, fontSize: 12 },
  slaBad: { color: hq.red, fontSize: 11, fontWeight: '800' },
  slaOk: { color: hq.greenDark, fontSize: 11, fontWeight: '700' },
  chev: { color: hq.faint, fontSize: 20, fontWeight: '700' },
  body: { color: hq.text, fontSize: 13, lineHeight: 19 },
  evidence: { color: hq.faint, fontSize: 11 },
  tl: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: hq.line },
  tlLate: { backgroundColor: 'rgba(245, 158, 11, 0.08)', marginHorizontal: -8, paddingHorizontal: 8 },
  tlTitle: { color: hq.text, fontWeight: '700', fontSize: 13 },
  tlLateText: { color: hq.amber || '#d97706' },
  tlMeta: { color: hq.muted, fontSize: 11, marginTop: 2 },
  toast: { color: hq.greenDark, fontWeight: '700', marginTop: 8 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { maxWidth: 520, width: '100%' as any, alignSelf: 'center' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  causeOpt: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: hq.line,
  },
  causeOn: { backgroundColor: hq.greenDim },
  causeText: { color: hq.text, fontWeight: '600' },
});
