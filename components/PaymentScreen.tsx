import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import {
  PixCharge,
  PaymentError,
  PaymentSplit,
  createPixCharge,
  cancelPixCharge,
  pollPixUntilPaid,
  CreatePixChargeInput,
  verifyPixPayment,
} from '@/services/payment';

type PaymentScreenProps = {
  visible: boolean;
  chargeInput: CreatePixChargeInput | null;
  onClose: () => void;
  onPaid: (charge: PixCharge) => void;
  /** Assinatura de plano: sem split pedido/entregador (visual de banco de pedido). */
  variant?: 'order' | 'subscription';
};

function formatRemaining(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PaymentScreen({
  visible,
  chargeInput,
  onClose,
  onPaid,
  variant = 'order',
}: PaymentScreenProps) {
  const isSubscription = variant === 'subscription';
  const [loading, setLoading] = useState(false);
  const [charge, setCharge] = useState<PixCharge | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<{ stop: () => void } | null>(null);
  const paidHandled = useRef(false);

  const remainingMs = useMemo(() => {
    if (!charge?.expiresAt) return 0;
    return new Date(charge.expiresAt).getTime() - now;
  }, [charge?.expiresAt, now]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => {
    if (!visible || !chargeInput) {
      cleanup();
      setCharge(null);
      setError(null);
      setCopied(false);
      setConfirming(false);
      paidHandled.current = false;
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const created = await createPixCharge(chargeInput);
        if (cancelled) return;
        setCharge(created);
        // Polling contínuo: confirma só quando o Mercado Pago marcar paid
        startPolling(created.id);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof PaymentError
            ? err.message
            : 'Não foi possível gerar o QR Code Pix.';
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, chargeInput?.orderDraftId]);

  function cleanup() {
    pollRef.current?.stop();
    pollRef.current = null;
  }

  function startPolling(chargeId: string) {
    cleanup();
    pollRef.current = pollPixUntilPaid(
      chargeId,
      (updated) => {
        setCharge((prev) => (prev ? { ...prev, ...updated } : updated));
        if (updated.status === 'paid' && !paidHandled.current) {
          paidHandled.current = true;
          setConfirming(true);
          cleanup();
          setTimeout(() => {
            onPaid(updated);
          }, 900);
        }
        if (updated.status === 'expired' || updated.status === 'failed') {
          cleanup();
        }
      },
      (err) => {
        setError(err.message);
      }
    );
  }

  function markPaidAndFinish(updated: PixCharge) {
    if (paidHandled.current) return;
    paidHandled.current = true;
    setConfirming(true);
    cleanup();
    // Breve feedback visual → cria pedido e abre acompanhamento
    setTimeout(() => onPaid(updated), 900);
  }

  async function handleVerifyNow() {
    if (!charge?.id || confirming) return;
    setChecking(true);
    setError(null);
    try {
      // Só o gateway (Mercado Pago) confirma — sem “Já paguei” na confiança
      const updated = await verifyPixPayment(charge.id);
      setCharge((prev) => (prev ? { ...prev, ...updated } : updated));

      if (updated.status === 'paid') {
        markPaidAndFinish(updated);
      } else if (updated.status === 'awaiting_payment' || updated.status === 'pending') {
        Alert.alert(
          'Aguardando o banco',
          'Ainda não recebemos a confirmação do Pix pelo Mercado Pago. Se você já pagou, aguarde alguns segundos — o app verifica sozinho.'
        );
      } else if (updated.status === 'expired') {
        Alert.alert('Pix expirado', 'Gere um novo QR Code para pagar.');
      } else if (updated.status === 'failed') {
        Alert.alert('Pagamento não aprovado', 'Tente gerar um novo Pix.');
      }
    } catch (err) {
      const message =
        err instanceof PaymentError ? err.message : 'Não foi possível verificar o pagamento.';
      setError(message);
      Alert.alert('Pagamento não confirmado', message);
    } finally {
      setChecking(false);
    }
  }

  async function handleCopy() {
    if (!charge?.copyPaste) return;
    try {
      await Clipboard.setStringAsync(charge.copyPaste);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      Alert.alert('Erro', 'Não foi possível copiar o código Pix.');
    }
  }

  async function handleClose() {
    cleanup();
    if (charge?.id && charge.status !== 'paid') {
      try {
        await cancelPixCharge(charge.id);
      } catch {
        // ignore
      }
    }
    onClose();
  }

  async function handleRetry() {
    if (!chargeInput) return;
    setError(null);
    setLoading(true);
    paidHandled.current = false;
    setConfirming(false);
    try {
      const created = await createPixCharge({
        ...chargeInput,
        orderDraftId: `draft_${Date.now()}`,
      });
      setCharge(created);
      startPolling(created.id);
    } catch (err) {
      const message =
        err instanceof PaymentError ? err.message : 'Falha ao regenerar o Pix.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const isLiveMp = charge?.provider === 'mercadopago';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {isSubscription ? 'Assinatura Peça Já' : 'Pagamento Pix'}
              </Text>
              <Text style={styles.subtitle}>
                {isSubscription
                  ? isLiveMp
                    ? 'Plano liberado só após o banco confirmar o Pix'
                    : 'Peça Já · assinatura com Pix'
                  : isLiveMp
                    ? 'Confirmação automática pelo banco via Mercado Pago'
                    : 'Peça Já · Pix seguro'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {loading && (
              <View style={styles.centerBox}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.centerText}>Gerando QR Code Pix dinâmico...</Text>
              </View>
            )}

            {!loading && error && !charge && (
              <View style={styles.centerBox}>
                <Ionicons name="cloud-offline-outline" size={48} color={theme.colors.error} />
                <Text style={styles.errorTitle}>Pix com confirmação automática</Text>
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
                  <Text style={styles.retryText}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}

            {!loading && charge && confirming && (
              <View style={styles.centerBox}>
                <View style={styles.successCircle}>
                  <Ionicons name="checkmark" size={40} color={theme.colors.white} />
                </View>
                <Text style={styles.successTitle}>Pagamento confirmado!</Text>
                <Text style={styles.centerText}>
                  {isSubscription
                    ? 'Pagamento do plano confirmado. Seguindo ao termo…'
                    : 'Abrindo o acompanhamento do pedido...'}
                </Text>
              </View>
            )}

            {!loading && charge && !confirming && (
              <>
                <View style={styles.amountCard}>
                  <Text style={styles.amountLabel}>Total a pagar</Text>
                  <Text style={styles.amountValue}>{formatPrice(charge.amount)}</Text>
                  {charge.amount <= 0.01 && (
                    <Text style={styles.testAmountNote}>Modo teste · R$ 0,01</Text>
                  )}
                  <View style={styles.timerRow}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={remainingMs < 60_000 ? theme.colors.error : theme.colors.accent}
                    />
                    <Text
                      style={[
                        styles.timerText,
                        remainingMs < 60_000 && { color: theme.colors.error },
                      ]}
                    >
                      Expira em {formatRemaining(remainingMs)}
                    </Text>
                  </View>
                  {charge.status === 'expired' && (
                    <Text style={styles.expiredNote}>QR Code expirado. Gere um novo Pix.</Text>
                  )}
                </View>

                <View style={styles.qrCard}>
                  <View style={styles.qrImage}>
                    <QRCode value={charge.copyPaste} size={220} />
                  </View>
                  <Text style={styles.qrHint}>Escaneie com o app do seu banco</Text>
                  <View style={styles.listening}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                    <Text style={styles.listeningText}>
                      Aguardando o banco confirmar o pagamento...
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.copyBtn, copied && styles.copyBtnDone]}
                  onPress={handleCopy}
                  activeOpacity={0.9}
                  disabled={charge.status === 'expired'}
                >
                  <Ionicons
                    name={copied ? 'checkmark-circle' : 'copy-outline'}
                    size={20}
                    color={copied ? theme.colors.primaryDark : theme.colors.white}
                  />
                  <Text style={[styles.copyText, copied && styles.copyTextDone]}>
                    {copied ? 'Código copiado!' : 'Copiar código Pix'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={handleVerifyNow}
                  activeOpacity={0.9}
                  disabled={charge.status === 'expired' || checking}
                >
                  {checking ? (
                    <ActivityIndicator color={theme.colors.primaryDark} />
                  ) : (
                    <Ionicons name="refresh" size={18} color={theme.colors.primaryDark} />
                  )}
                  <Text style={styles.verifyText}>
                    {checking ? 'Consultando o banco...' : 'Atualizar status do pagamento'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.copyPreview} numberOfLines={2}>
                  {charge.copyPaste}
                </Text>

                {!isSubscription && <SplitBreakdown split={charge.split} />}

                {charge.status === 'expired' && (
                  <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.85}>
                    <Text style={styles.retryText}>Gerar novo Pix</Text>
                  </TouchableOpacity>
                )}

                {!!error && <Text style={styles.pollError}>{error}</Text>}

                <Text style={styles.devHint}>
                  {isLiveMp
                    ? 'O pedido só confirma quando o banco aprovar o Pix no Mercado Pago. Não é possível confirmar manualmente.'
                    : 'Aguardando confirmação automática do pagamento.'}
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SplitBreakdown({ split }: { split: PaymentSplit }) {
  return (
    <View style={styles.splitCard}>
      <Text style={styles.splitTitle}>Divisão do pagamento (split)</Text>
      <SplitRow
        icon="phone-portrait-outline"
        label="Taxa Peça Já (plataforma)"
        value={formatPrice(split.platformAmount)}
        tone="platform"
      />
      <SplitRow
        icon="storefront-outline"
        label="Comerciante"
        value={formatPrice(split.merchantAmount)}
        tone="merchant"
      />
      <SplitRow
        icon="bicycle-outline"
        label="Entregador"
        value={formatPrice(split.driverAmount)}
        tone="driver"
      />
      <View style={styles.splitDivider} />
      <SplitRow
        icon="wallet-outline"
        label="Total do cliente"
        value={formatPrice(split.customerTotal)}
        bold
      />
    </View>
  );
}

function SplitRow({
  icon,
  label,
  value,
  bold,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'platform' | 'merchant' | 'driver';
}) {
  const color =
    tone === 'platform'
      ? theme.colors.primary
      : tone === 'merchant'
        ? theme.colors.secondary
        : tone === 'driver'
          ? theme.colors.accent
          : theme.colors.text;

  return (
    <View style={styles.splitRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.splitLabel, bold && styles.splitBold]}>{label}</Text>
      <Text style={[styles.splitValue, bold && styles.splitBold, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: '92%',
    paddingBottom: theme.spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  centerBox: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.sm,
  },
  centerText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontSize: theme.fontSize.sm,
    lineHeight: 20,
    paddingHorizontal: theme.spacing.md,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.primaryDark,
    marginTop: theme.spacing.md,
  },
  amountCard: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  amountLabel: { color: 'rgba(255,255,255,0.7)', fontSize: theme.fontSize.sm },
  amountValue: {
    color: theme.colors.white,
    fontSize: theme.fontSize.hero,
    fontWeight: theme.fontWeight.extrabold,
    marginTop: 4,
  },
  testAmountNote: {
    marginTop: 6,
    color: theme.colors.accent,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
  },
  timerText: {
    color: theme.colors.accent,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.sm,
  },
  expiredNote: {
    color: theme.colors.errorLight,
    marginTop: theme.spacing.sm,
    fontSize: theme.fontSize.xs,
  },
  qrCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    marginBottom: theme.spacing.md,
  },
  qrImage: {
    width: 220,
    height: 220,
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  qrHint: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  listening: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
  },
  listeningText: {
    color: theme.colors.primaryDark,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
  },
  copyBtnDone: {
    backgroundColor: theme.colors.primaryLight,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.sm,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  verifyText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  copyText: {
    color: theme.colors.white,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  copyTextDone: {
    color: theme.colors.primaryDark,
  },
  copyPreview: {
    marginTop: theme.spacing.sm,
    fontSize: 11,
    color: theme.colors.textMuted,
    lineHeight: 16,
  },
  splitCard: {
    marginTop: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  splitTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: 10,
  },
  splitLabel: { flex: 1, color: theme.colors.textSecondary, fontSize: theme.fontSize.sm },
  splitValue: { fontWeight: theme.fontWeight.semibold, fontSize: theme.fontSize.sm },
  splitBold: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  splitDivider: {
    height: 1,
    backgroundColor: theme.colors.borderLight,
    marginVertical: theme.spacing.sm,
  },
  retryBtn: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primaryMuted,
  },
  retryText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.bold,
  },
  pollError: {
    marginTop: theme.spacing.sm,
    color: theme.colors.error,
    fontSize: theme.fontSize.xs,
    textAlign: 'center',
  },
  devHint: {
    marginTop: theme.spacing.lg,
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
