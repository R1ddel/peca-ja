import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Image,
  TouchableOpacity,
  Pressable,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem } from '@/types';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import { customerUnitPrice } from '@/constants/pricing';

type Props = {
  visible: boolean;
  item: MenuItem | null;
  onClose: () => void;
  onAdd?: () => void;
  disabled?: boolean;
};

const { width: SCREEN_W } = Dimensions.get('window');
const GALLERY_H = Math.min(320, SCREEN_W * 0.72);

export function MenuItemDetailModal({ visible, item, onClose, onAdd, disabled }: Props) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const images = useMemo(() => {
    if (!item) return [];
    if (item.images?.length) return item.images;
    return item.image ? [item.image] : [];
  }, [item]);

  useEffect(() => {
    if (!visible) return;
    setPage(0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: 0, animated: false });
    });
  }, [visible, item?.id]);

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const x = e.nativeEvent.contentOffset.x;
    const next = Math.round(x / SCREEN_W);
    setPage(Math.max(0, Math.min(next, images.length - 1)));
  }

  if (!item) return null;

  const merchantPrice = item.promo ?? item.price;
  const price = customerUnitPrice(merchantPrice);
  const details = item.details?.trim() || item.description;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.galleryWrap}>
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onScrollEnd}
              decelerationRate="fast"
            >
              {images.map((uri, i) => (
                <Image
                  key={`${item.id}-g-${i}`}
                  source={{ uri }}
                  style={{ width: SCREEN_W, height: GALLERY_H }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>

            {images.length > 1 && (
              <View style={styles.dots}>
                {images.map((_, i) => (
                  <View key={`dot-${i}`} style={[styles.dot, i === page && styles.dotActive]} />
                ))}
              </View>
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              accessibilityLabel="Fechar"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={theme.colors.white} />
            </TouchableOpacity>

            {images.length > 1 && (
              <View style={styles.photoCount}>
                <Ionicons name="images-outline" size={12} color={theme.colors.white} />
                <Text style={styles.photoCountText}>
                  {page + 1}/{images.length}
                </Text>
              </View>
            )}
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.titleRow}>
              <Text style={styles.name}>{item.name}</Text>
              {item.popular && (
                <View style={styles.popularBadge}>
                  <Ionicons name="flame" size={11} color="#fff" />
                  <Text style={styles.popularText}>Popular</Text>
                </View>
              )}
            </View>

            <Text style={styles.category}>{item.category}</Text>

            <View style={styles.priceRow}>
              {item.promo != null ? (
                <>
                  <Text style={styles.price}>{formatPrice(price)}</Text>
                  <Text style={styles.oldPrice}>{formatPrice(customerUnitPrice(item.price))}</Text>
                </>
              ) : (
                <Text style={styles.price}>{formatPrice(price)}</Text>
              )}
            </View>

            <Text style={styles.sectionLabel}>Sobre o produto</Text>
            <Text style={styles.details}>{details}</Text>

            {images.length > 1 && (
              <Text style={styles.hint}>Deslize as fotos para ver outros ângulos.</Text>
            )}
          </ScrollView>

          <View style={styles.footer}>
            {onAdd && !disabled ? (
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => {
                  onAdd();
                  onClose();
                }}
                activeOpacity={0.9}
              >
                <Ionicons name="add" size={20} color={theme.colors.white} />
                <Text style={styles.addBtnText}>Pedir · {formatPrice(price)}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.closeOnlyBtn} onPress={onClose} activeOpacity={0.9}>
                <Text style={styles.closeOnlyText}>Fechar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginTop: 8,
    marginBottom: 4,
    zIndex: 2,
  },
  galleryWrap: {
    position: 'relative',
    backgroundColor: theme.colors.borderLight,
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    backgroundColor: theme.colors.white,
    width: 18,
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCount: {
    position: 'absolute',
    top: 14,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  photoCountText: {
    color: theme.colors.white,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
  },
  body: { maxHeight: 280 },
  bodyContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    gap: 2,
  },
  popularText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
  },
  category: {
    marginTop: 4,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  price: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  oldPrice: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  sectionLabel: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 6,
  },
  details: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
  },
  hint: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.xs,
    color: theme.colors.textMuted,
  },
  footer: {
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderLight,
    backgroundColor: theme.colors.surface,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
  },
  addBtnText: {
    color: theme.colors.white,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
  },
  closeOnlyBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
  },
  closeOnlyText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});
