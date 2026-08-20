import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useOrders } from '@/context/OrdersContext';
import { useReviews } from '@/context/ReviewsContext';
import { theme } from '@/constants/theme';
import { BusinessReview, Order } from '@/types';
import { getSimulatedCityLabel } from '@/utils/demoLocation';

type Props = {
  businessId: string;
  businessName: string;
};

function formatReviewDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

function Stars({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          disabled={!onChange}
          onPress={() => onChange?.(n)}
          hitSlop={8}
        >
          <Ionicons
            name={n <= value ? 'star' : 'star-outline'}
            size={size}
            color={theme.colors.accent}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewCard({ review }: { review: BusinessReview }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{review.userName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewName}>{review.userName}</Text>
          <Text style={styles.reviewDate}>{formatReviewDate(review.createdAt)}</Text>
        </View>
        <Stars value={review.rating} size={14} />
      </View>
      <Text style={styles.reviewComment}>{review.comment}</Text>
      {typeof review.driverRating === 'number' ? (
        <Text style={styles.driverRateLine}>
          Entregador
          {review.driverName ? ` (${review.driverName})` : ''}: {review.driverRating}★
        </Text>
      ) : null}
    </View>
  );
}

export function BusinessReviewsPanel({ businessId, businessName }: Props) {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { getReviewsForBusiness, getAverageForBusiness, hasReviewedOrder, addReview } =
    useReviews();

  const reviews = getReviewsForBusiness(businessId);
  const { average, count } = getAverageForBusiness(businessId);

  const reviewableOrders = useMemo(() => {
    if (!user) return [] as Order[];
    return orders.filter(
      (o) =>
        o.userId === user.id &&
        o.businessId === businessId &&
        o.status === 'entregue' &&
        !hasReviewedOrder(o.id)
    );
  }, [orders, user, businessId, hasReviewedOrder]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [driverRating, setDriverRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeOrderId = selectedOrderId ?? reviewableOrders[0]?.id ?? null;
  const activeOrder = reviewableOrders.find((o) => o.id === activeOrderId);

  async function handleSubmit() {
    if (!user) {
      Alert.alert('Entre na conta', 'Faça login para avaliar um pedido.');
      return;
    }
    if (!activeOrderId || !activeOrder) {
      Alert.alert(
        'Sem pedido para avaliar',
        `Peça em ${businessName} e, após a entrega, volte aqui para avaliar.`
      );
      return;
    }

    setSubmitting(true);
    const result = await addReview({
      businessId,
      orderId: activeOrderId,
      userId: user.id,
      userName: user.name,
      rating,
      comment,
      driverRating,
      driverId: activeOrder.driverId,
      driverName: activeOrder.driverName,
    });
    setSubmitting(false);

    if (!result.success) {
      Alert.alert('Não foi possível avaliar', result.error ?? 'Tente novamente.');
      return;
    }

    setComment('');
    setRating(5);
    setDriverRating(5);
    setSelectedOrderId(null);
    Alert.alert('Obrigado!', 'Avaliação da loja e do entregador publicada.');
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.summary}>
        <View style={styles.summaryScore}>
          <Text style={styles.summaryNumber}>{average > 0 ? average.toFixed(1) : '—'}</Text>
          <Stars value={Math.round(average)} size={16} />
          <Text style={styles.summaryCount}>
            {count} {count === 1 ? 'avaliação' : 'avaliações'}
          </Text>
        </View>
        <Text style={styles.summaryHint}>
          Avalie com base no pedido entregue. Sua nota ajuda outros clientes de{' '}
          {getSimulatedCityLabel()}.
        </Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Avaliar meu pedido</Text>

        {!user ? (
          <Text style={styles.formEmpty}>Entre na sua conta para avaliar.</Text>
        ) : reviewableOrders.length === 0 ? (
          <Text style={styles.formEmpty}>
            Você ainda não tem pedido entregue neste comércio para avaliar. Faça um pedido e
            volte depois da entrega.
          </Text>
        ) : (
          <>
            <Text style={styles.fieldLabel}>Pedido</Text>
            <View style={styles.orderChips}>
              {reviewableOrders.map((o) => {
                const active = o.id === activeOrderId;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={[styles.orderChip, active && styles.orderChipActive]}
                    onPress={() => setSelectedOrderId(o.id)}
                  >
                    <Text style={[styles.orderChipText, active && styles.orderChipTextActive]}>
                      #{o.id}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Nota da loja</Text>
            <Stars value={rating} onChange={setRating} size={28} />

            <Text style={[styles.fieldLabel, { marginTop: theme.spacing.md }]}>
              Nota do entregador
              {activeOrder?.driverName ? ` · ${activeOrder.driverName}` : ''}
            </Text>
            <Stars value={driverRating} onChange={setDriverRating} size={28} />

            <Text style={[styles.fieldLabel, { marginTop: theme.spacing.md }]}>Comentário</Text>
            <TextInput
              style={styles.input}
              placeholder="Como foi a comida, a embalagem e a entrega?"
              placeholderTextColor={theme.colors.textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={400}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.85}
            >
              <Ionicons name="star" size={18} color={theme.colors.white} />
              <Text style={styles.submitText}>
                {submitting ? 'Enviando...' : 'Publicar avaliação'}
              </Text>
            </TouchableOpacity>

            {activeOrderId ? (
              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() =>
                  router.push({
                    pathname: '/order/report-driver' as any,
                    params: { orderId: activeOrderId },
                  })
                }
              >
                <Text style={styles.reportBtnText}>
                  Denunciar delito do entregador (com provas)
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      <Text style={styles.listTitle}>O que os clientes dizem</Text>
      {reviews.length === 0 ? (
        <Text style={styles.formEmpty}>Ainda não há avaliações neste comércio.</Text>
      ) : (
        reviews.map((r) => <ReviewCard key={r.id} review={r} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing.md },
  summary: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  summaryScore: { alignItems: 'flex-start', gap: 6, marginBottom: theme.spacing.sm },
  summaryNumber: {
    fontSize: theme.fontSize.hero,
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
  },
  summaryCount: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  summaryHint: { fontSize: theme.fontSize.sm, color: theme.colors.textMuted, lineHeight: 20 },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  formTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  formEmpty: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  orderChips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  orderChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  orderChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  orderChipText: { fontSize: theme.fontSize.sm, color: theme.colors.textSecondary },
  orderChipTextActive: { color: theme.colors.primaryDark, fontWeight: theme.fontWeight.semibold },
  starsRow: { flexDirection: 'row', gap: 4 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
    marginBottom: theme.spacing.md,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  reportBtn: {
    marginTop: theme.spacing.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  reportBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  listTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  reviewCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, marginBottom: 8 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: theme.colors.primaryDark,
    fontWeight: theme.fontWeight.bold,
    fontSize: theme.fontSize.md,
  },
  reviewMeta: { flex: 1 },
  reviewName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
  },
  reviewDate: { fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 1 },
  reviewComment: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  driverRateLine: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#6D28D9',
  },
});
