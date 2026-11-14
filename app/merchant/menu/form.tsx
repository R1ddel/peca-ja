import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  Alert,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import { resolveOperatorMerchantContext } from '@/utils/merchantStores';
import {
  getShopByApplicationId,
  newMenuItemId,
  upsertMenuItem,
} from '@/utils/merchantShop';
import { PLATFORM_FEE_MERCHANT_NOTICE } from '@/constants/pricing';
import { categoryConfig, theme } from '@/constants/theme';
import { classifyMenuSection, menuSectionsFor } from '@/utils/menuSections';
import {
  isCatalogMenuPhoto,
  MENU_ITEM_FALLBACK_PHOTO,
  suggestMenuItemPhotos,
} from '@/utils/menuItemPhotoSuggest';
import { MenuAddonGroup, MenuItem } from '@/types';

type DraftOption = { id: string; name: string; price: string };
type DraftGroup = {
  id: string;
  name: string;
  required: boolean;
  maxSelect: string;
  options: DraftOption[];
};

function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function MerchantMenuFormScreen() {
  const { itemId } = useLocalSearchParams<{ itemId?: string }>();
  const { user } = useAuth();
  const [appId, setAppId] = useState<string | null>(null);
  const [shopCategory, setShopCategory] = useState<string | null>(null);
  const [sectionLocked, setSectionLocked] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [category, setCategory] = useState('Destaques');
  const [price, setPrice] = useState('');
  const [image, setImage] = useState(MENU_ITEM_FALLBACK_PHOTO);
  /** true = loja escolheu foto da galeria; não sobrescrever pela sugestão. */
  const [ownPhoto, setOwnPhoto] = useState(false);
  const [suggestPick, setSuggestPick] = useState(0);
  const [popular, setPopular] = useState(false);
  const [convenience, setConvenience] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(itemId ?? null);
  const [addonGroups, setAddonGroups] = useState<DraftGroup[]>([]);

  const photoSuggestion = useMemo(
    () => suggestMenuItemPhotos(name, category),
    [name, category]
  );

  useFocusEffect(
    useCallback(() => {
      void (async () => {
        const { app, shop: foundShop } = await resolveOperatorMerchantContext(user?.email);
        if (!app) return;
        setAppId(app.id);
        const shop = foundShop ?? (await getShopByApplicationId(app.id));
        if (shop) setShopCategory(shop.category);
        if (!itemId) {
          setOwnPhoto(false);
          setSuggestPick(0);
          setImage(MENU_ITEM_FALLBACK_PHOTO);
          return;
        }
        const item = shop?.menu.find((m) => m.id === itemId);
        if (!item) return;
        setEditId(item.id);
        setName(item.name);
        setDescription(item.description);
        setDetails(item.details || '');
        setCategory(item.category);
        setPrice(String(item.price).replace('.', ','));
        setImage(item.image);
        setOwnPhoto(!isCatalogMenuPhoto(item.image));
        setSuggestPick(0);
        setPopular(!!item.popular);
        setConvenience(!!item.convenience);
        setAddonGroups(
          (item.addonGroups ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            required: !!g.required,
            maxSelect: String(g.maxSelect ?? 1),
            options: g.options.map((o) => ({
              id: o.id,
              name: o.name,
              price: String(o.price).replace('.', ','),
            })),
          }))
        );
      })();
    }, [user?.email, itemId])
  );

  useEffect(() => {
    if (sectionLocked || !shopCategory) return;
    const next = classifyMenuSection(shopCategory, { name, description, details });
    if (name.trim() && next !== category) setCategory(next);
  }, [name, description, details, shopCategory, sectionLocked, category]);

  useEffect(() => {
    setSuggestPick(0);
  }, [photoSuggestion.key]);

  useEffect(() => {
    if (ownPhoto) return;
    const next = photoSuggestion.photos[suggestPick] ?? photoSuggestion.primary;
    setImage(next);
  }, [ownPhoto, photoSuggestion.photos, photoSuggestion.primary, suggestPick]);

  function addGroup() {
    setAddonGroups((prev) => [
      ...prev,
      {
        id: newId('grp'),
        name: 'Adicionais',
        required: false,
        maxSelect: '1',
        options: [{ id: newId('opt'), name: '', price: '0' }],
      },
    ]);
  }

  function updateGroup(id: string, patch: Partial<DraftGroup>) {
    setAddonGroups((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  }

  function removeGroup(id: string) {
    setAddonGroups((prev) => prev.filter((g) => g.id !== id));
  }

  function addOption(groupId: string) {
    setAddonGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: [...g.options, { id: newId('opt'), name: '', price: '0' }],
            }
          : g
      )
    );
  }

  function updateOption(groupId: string, optId: string, patch: Partial<DraftOption>) {
    setAddonGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              options: g.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)),
            }
          : g
      )
    );
  }

  function removeOption(groupId: string, optId: string) {
    setAddonGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.filter((o) => o.id !== optId) }
          : g
      )
    );
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Fotos', 'Permita o acesso à galeria para adicionar fotos do produto.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      // allowsEditing trava o retorno em vários Android/Expo Go
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setImage(result.assets[0].uri);
      setOwnPhoto(true);
    }
  }

  function useAppSuggestion() {
    setOwnPhoto(false);
    setSuggestPick(0);
    setImage(photoSuggestion.primary);
  }

  async function save() {
    if (!appId) return;
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Nome', 'Informe o nome do item.');
      return;
    }
    const parsed = Number(price.replace(',', '.'));
    if (!parsed || parsed <= 0) {
      Alert.alert('Preço', 'Informe um preço válido.');
      return;
    }

    const groups: MenuAddonGroup[] = [];
    for (const g of addonGroups) {
      const gName = g.name.trim();
      if (!gName) continue;
      const options = g.options
        .map((o) => ({
          id: o.id,
          name: o.name.trim(),
          price: Math.max(0, Number(o.price.replace(',', '.')) || 0),
        }))
        .filter((o) => o.name.length > 0);
      if (!options.length) continue;
      const maxSelect = Math.max(1, Number(g.maxSelect) || 1);
      groups.push({
        id: g.id,
        name: gName,
        required: g.required,
        maxSelect,
        options,
      });
    }

    setSaving(true);
    try {
      const item: MenuItem = {
        id: editId || newMenuItemId(),
        name: trimmed,
        description: description.trim() || trimmed,
        details: details.trim() || undefined,
        price: Math.round(parsed * 100) / 100,
        image,
        images: [image],
        category: sectionLocked
          ? category.trim() || 'Outros'
          : classifyMenuSection(shopCategory, {
              name: trimmed,
              description: description.trim(),
              details: details.trim(),
            }),
        popular,
        convenience,
        addonGroups: groups.length ? groups : undefined,
      };
      const updated = await upsertMenuItem(appId, item);
      if (!updated) {
        Alert.alert('Erro', 'Não foi possível salvar o item.');
        return;
      }
      router.back();
    } finally {
      setSaving(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader
        title={editId ? 'Editar item' : 'Novo item'}
        fallbackHref="/merchant/menu"
      />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <Label>Nome *</Label>
        <Field value={name} onChangeText={setName} placeholder="Ex.: Feijoada, Pizza de calabresa" />

        <Label>Foto do item</Label>
        <Text style={styles.photoHint}>
          {ownPhoto
            ? 'Você escolheu a foto da loja. Pode voltar à sugestão do app a qualquer momento.'
            : name.trim()
              ? photoSuggestion.matched
                ? `Sugestão pelo nome: ${photoSuggestion.label}. Toque numa miniatura ou envie a foto da loja.`
                : 'Não reconhecemos o prato pelo nome — foto genérica. Envie a da loja se tiver.'
              : 'Digite o nome para sugerirmos uma foto. Sem foto da loja, usamos a sugestão.'}
        </Text>

        <TouchableOpacity style={styles.photo} onPress={() => void pickImage()} activeOpacity={0.9}>
          <Image source={{ uri: image }} style={styles.photoImg} />
          <View style={styles.photoBadge}>
            <Ionicons name="camera" size={16} color="#fff" />
            <Text style={styles.photoBadgeText}>
              {ownPhoto ? 'Trocar minha foto' : 'Usar foto da loja'}
            </Text>
          </View>
          {!ownPhoto && (
            <View style={styles.suggestBadge}>
              <Ionicons name="sparkles" size={12} color="#fff" />
              <Text style={styles.suggestBadgeText}>Sugestão</Text>
            </View>
          )}
        </TouchableOpacity>

        {!ownPhoto && photoSuggestion.photos.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestRow}
          >
            {photoSuggestion.photos.map((uri, i) => {
              const on = i === suggestPick;
              return (
                <TouchableOpacity
                  key={`${photoSuggestion.key}-${i}`}
                  style={[styles.suggestThumbWrap, on && styles.suggestThumbOn]}
                  onPress={() => setSuggestPick(i)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri }} style={styles.suggestThumb} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        ) : null}

        {ownPhoto ? (
          <TouchableOpacity style={styles.suggestBack} onPress={useAppSuggestion} activeOpacity={0.85}>
            <Ionicons name="images-outline" size={16} color={theme.colors.primary} />
            <Text style={styles.suggestBackText}>
              Usar sugestão do app
              {photoSuggestion.matched ? ` (${photoSuggestion.label})` : ''}
            </Text>
          </TouchableOpacity>
        ) : null}

        <Label>Seção do cardápio</Label>
        <Text style={styles.sectionHint}>
          {name.trim()
            ? `Entra automaticamente em ${category}. Toque só se quiser corrigir.`
            : 'A seção é escolhida pelo nome do produto.'}
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sectionRow}
        >
          {menuSectionsFor(shopCategory).map((section) => {
            const on = section === category;
            return (
              <TouchableOpacity
                key={section}
                style={[styles.sectionChip, on && styles.sectionChipOn]}
                onPress={() => {
                  setSectionLocked(true);
                  setCategory(section);
                }}
              >
                <Text style={[styles.sectionChipText, on && styles.sectionChipTextOn]}>{section}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Label>Preço (R$) *</Label>
        <Field
          value={price}
          onChangeText={setPrice}
          placeholder="19,90"
          keyboardType="decimal-pad"
        />
        <View style={styles.feeNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.primary} />
          <Text style={styles.feeNoteText}>{PLATFORM_FEE_MERCHANT_NOTICE}</Text>
        </View>

        <Label>Descrição curta</Label>
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="O que o cliente vê no cardápio"
          multiline
        />

        <Label>Detalhes (opcional)</Label>
        <Field
          value={details}
          onChangeText={setDetails}
          placeholder="Ingredientes, porção…"
          multiline
        />

        <TouchableOpacity
          style={styles.check}
          onPress={() => setPopular((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={popular ? 'checkbox' : 'square-outline'}
            size={22}
            color={theme.colors.primary}
          />
          <Text style={styles.checkText}>Marcar como popular / destaque</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.check}
          onPress={() => setConvenience((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={convenience ? 'checkbox' : 'square-outline'}
            size={22}
            color={categoryConfig.conveniencia.color}
          />
          <Text style={styles.checkText}>Vender na Conveniência</Text>
        </TouchableOpacity>
        <Text style={styles.convHint}>
          Aparece no hub Conveniência do app (água, snacks, utilidades…), mesmo
          se sua loja for mercado, farmácia ou restaurante.
        </Text>

        <View style={styles.addonsHead}>
          <Text style={styles.addonsTitle}>Adicionais / variantes</Text>
          <TouchableOpacity onPress={addGroup} activeOpacity={0.85}>
            <Text style={styles.addonsAdd}>+ Grupo</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.addonsHint}>
          Ex.: ponto da carne, bebida, extras. O cliente escolhe no pedido.
        </Text>

        {addonGroups.map((g) => (
          <View key={g.id} style={styles.groupCard}>
            <View style={styles.groupTop}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={g.name}
                onChangeText={(text) => updateGroup(g.id, { name: text })}
                placeholder="Nome do grupo"
                placeholderTextColor={theme.colors.textMuted}
              />
              <TouchableOpacity onPress={() => removeGroup(g.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.error} />
              </TouchableOpacity>
            </View>
            <View style={styles.groupMeta}>
              <TouchableOpacity
                style={styles.check}
                onPress={() => updateGroup(g.id, { required: !g.required })}
              >
                <Ionicons
                  name={g.required ? 'checkbox' : 'square-outline'}
                  size={18}
                  color={theme.colors.primary}
                />
                <Text style={styles.checkText}>Obrigatório</Text>
              </TouchableOpacity>
              <View style={styles.maxRow}>
                <Text style={styles.maxLabel}>Máx.</Text>
                <TextInput
                  style={styles.maxInput}
                  value={g.maxSelect}
                  onChangeText={(maxSelect) => updateGroup(g.id, { maxSelect })}
                  keyboardType="number-pad"
                  placeholderTextColor={theme.colors.textMuted}
                />
              </View>
            </View>
            {g.options.map((o) => (
              <View key={o.id} style={styles.optRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={o.name}
                  onChangeText={(text) => updateOption(g.id, o.id, { name: text })}
                  placeholder="Opção"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <TextInput
                  style={styles.optPrice}
                  value={o.price}
                  onChangeText={(p) => updateOption(g.id, o.id, { price: p })}
                  placeholder="0"
                  keyboardType="decimal-pad"
                  placeholderTextColor={theme.colors.textMuted}
                />
                <TouchableOpacity onPress={() => removeOption(g.id, o.id)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={theme.colors.textMuted} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={() => addOption(g.id)} style={styles.addOpt}>
              <Text style={styles.addOptText}>+ Opção</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Button title="Salvar no cardápio" onPress={() => void save()} loading={saving} size="lg" />
      </KeyboardScreen>
    </MobileShell>
  );
}

function Label({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      {...props}
      style={[styles.input, props.multiline && styles.inputMulti, props.style]}
      placeholderTextColor={theme.colors.textMuted}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  photoHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: 8,
    lineHeight: 18,
  },
  photo: {
    height: 160,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.borderLight,
  },
  photoImg: { width: '100%', height: '100%' },
  photoBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  photoBadgeText: { color: '#fff', fontSize: 12, fontWeight: theme.fontWeight.semibold },
  suggestBadge: {
    position: 'absolute',
    left: 10,
    top: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  suggestBadgeText: { color: '#fff', fontSize: 11, fontWeight: theme.fontWeight.semibold },
  suggestRow: { gap: 8, paddingBottom: 8 },
  suggestThumbWrap: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  suggestThumbOn: { borderColor: theme.colors.primary },
  suggestThumb: { width: 64, height: 64, backgroundColor: theme.colors.borderLight },
  suggestBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
    paddingVertical: 8,
  },
  suggestBackText: {
    color: theme.colors.primary,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  sectionHint: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    marginBottom: 8,
    lineHeight: 18,
  },
  sectionRow: { gap: 8, paddingBottom: 4 },
  sectionChip: {
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.surface,
  },
  sectionChipOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  sectionChipText: {
    color: theme.colors.text,
    fontWeight: theme.fontWeight.bold,
    fontSize: 13,
  },
  sectionChipTextOn: { color: '#fff' },
  feeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: -4,
    marginBottom: theme.spacing.md,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
  },
  feeNoteText: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 17,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    marginBottom: 4,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: theme.spacing.sm,
  },
  checkText: { color: theme.colors.text, fontSize: theme.fontSize.sm },
  convHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
    marginBottom: theme.spacing.sm,
    marginTop: -4,
  },
  addonsHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  addonsTitle: {
    fontWeight: theme.fontWeight.extrabold,
    color: theme.colors.text,
    fontSize: 15,
  },
  addonsAdd: { color: theme.colors.primary, fontWeight: theme.fontWeight.bold },
  addonsHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  groupCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  groupTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  maxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  maxLabel: { color: theme.colors.textMuted, fontSize: 12 },
  maxInput: {
    width: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
    color: theme.colors.text,
  },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optPrice: {
    width: 64,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 10,
    paddingVertical: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.background,
  },
  addOpt: { paddingVertical: 4 },
  addOptText: { color: theme.colors.primary, fontWeight: theme.fontWeight.semibold },
});
