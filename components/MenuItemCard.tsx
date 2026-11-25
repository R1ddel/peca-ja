import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MenuItem } from '@/types';
import { theme } from '@/constants/theme';
import { formatPrice } from '@/data/businesses';
import { customerUnitPrice } from '@/constants/pricing';

interface MenuItemCardProps {
  item: MenuItem;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  disabled?: boolean;
  hasAddons?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** Toque na foto → galeria + detalhes. */
  onPressImage?: () => void;
}

export function MenuItemCard({
  item,
  quantity,
  onAdd,
  onRemove,
  disabled,
  hasAddons,
  favorite,
  onToggleFavorite,
  onPressImage,
}: MenuItemCardProps) {
  const merchantPrice = item.promo ?? item.price;
  const price = customerUnitPrice(merchantPrice);
  const hasGallery = (item.images?.length ?? 0) > 1;

  return (
    <View style={[styles.card, disabled && styles.disabled]}>
      <TouchableOpacity
        style={styles.imageWrap}
        onPress={onPressImage}
        activeOpacity={onPressImage ? 0.85 : 1}
        disabled={!onPressImage}
        accessibilityRole="button"
        accessibilityLabel={`Ver fotos e detalhes de ${item.name}`}
      >
        <Image source={{ uri: item.image }} style={styles.image} />
        {hasGallery && (
          <View style={styles.galleryHint}>
            <Ionicons name="images-outline" size={12} color={theme.colors.white} />
          </View>
        )}
        {onToggleFavorite && (
          <TouchableOpacity
            style={styles.favBtn}
            onPress={onToggleFavorite}
            hitSlop={8}
            accessibilityLabel={favorite ? 'Remover dos favoritos' : 'Favoritar prato'}
          >
            <Ionicons
              name={favorite ? 'heart' : 'heart-outline'}
              size={16}
              color={favorite ? theme.colors.error : theme.colors.white}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          {item.popular && (
            <View style={styles.popularBadge}>
              <Ionicons name="flame" size={10} color="#fff" />
              <Text style={styles.popularText}>Popular</Text>
            </View>
          )}
        </View>
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
        {hasAddons && (
          <Text style={styles.addonsHint}>Personalize com adicionais</Text>
        )}
        <View style={styles.footer}>
          <View style={styles.priceRow}>
            {item.promo ? (
              <>
                <Text style={styles.promoPrice}>{formatPrice(price)}</Text>
                <Text style={styles.oldPrice}>{formatPrice(customerUnitPrice(item.price))}</Text>
              </>
            ) : (
              <Text style={styles.price}>{formatPrice(price)}</Text>
            )}
          </View>

          {!disabled && (
            quantity > 0 ? (
              <View style={styles.quantityControl}>
                <TouchableOpacity onPress={onRemove} style={styles.qtyButton}>
                  <Ionicons name="remove" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
                <Text style={styles.qtyText}>{quantity}</Text>
                <TouchableOpacity onPress={onAdd} style={[styles.qtyButton, styles.qtyButtonAdd]}>
                  <Ionicons name="add" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={onAdd} style={styles.addButton}>
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
            )
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    ...theme.shadow.soft,
  },
  disabled: {
    opacity: 0.6,
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.borderLight,
  },
  galleryHint: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginLeft: theme.spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  name: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B35',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
    gap: 2,
  },
  popularText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: theme.fontWeight.bold,
  },
  description: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginVertical: 4,
    lineHeight: 18,
  },
  addonsHint: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.primary,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  price: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  promoPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary,
  },
  oldPrice: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonAdd: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  qtyText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text,
    minWidth: 20,
    textAlign: 'center',
  },
});
