import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { KeyboardScreen } from '@/components/KeyboardScreen';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import {
  DriverApplication,
  resolveDriverApplication,
  updateDriverApplication,
  partnerStatusLabel,
} from '@/utils/partners';
import {
  driverFleetId,
  getDriverOnline,
  setDriverOnline,
} from '@/utils/driverOps';
import { clearDriverSession, clearRememberedDriverLogin } from '@/utils/driverSession';
import { confirmReloadApp } from '@/utils/reloadApp';
import { theme } from '@/constants/theme';

const VEHICLES = ['Moto', 'Bicicleta', 'Carro', 'A pé'] as const;
type VehicleType = (typeof VEHICLES)[number];

function normalizeVehicleType(value?: string | null): VehicleType {
  const v = (value || '').trim();
  if ((VEHICLES as readonly string[]).includes(v)) return v as VehicleType;
  const lower = v.toLowerCase();
  if (lower.includes('bike') || lower.includes('bicicleta')) return 'Bicicleta';
  if (lower.includes('carro') || lower.includes('car')) return 'Carro';
  if (lower.includes('pé') || lower.includes('pe') || lower.includes('foot')) return 'A pé';
  return 'Moto';
}

export default function DriverSettingsScreen() {
  const { user } = useAuth();
  const [app, setApp] = useState<DriverApplication | null>(null);
  const [online, setOnline] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('Moto');
  const [plate, setPlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  const needsMotor = vehicleType === 'Moto' || vehicleType === 'Carro';

  const vehicleChanged = useMemo(() => {
    if (!app) return false;
    return normalizeVehicleType(app.vehicleType || app.vehicle) !== vehicleType;
  }, [app, vehicleType]);

  const refresh = useCallback(async () => {
    const found = await resolveDriverApplication(user?.email);
    setApp(found);
    if (found) {
      setName(found.name);
      setPhone(found.phone);
      setVehicleType(normalizeVehicleType(found.vehicleType || found.vehicle));
      setPlate(found.plate || '');
      setVehicleBrand(found.vehicleBrand || '');
      setVehicleModel(found.vehicleModel || '');
      setVehicleYear(found.vehicleYear || '');
      setVehicleColor(found.vehicleColor || '');
      setBio(found.bio || found.notes || '');
      if (found.status === 'approved') {
        setOnline(await getDriverOnline(driverFleetId(found)));
      }
    }
  }, [user?.email]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  function selectVehicle(next: VehicleType) {
    setVehicleType(next);
    if (next === 'Bicicleta' || next === 'A pé') {
      // Mantém dados antigos no state só se o usuário voltar — limpa campos obrigatórios de motor.
      setPlate('');
      setVehicleBrand('');
      setVehicleModel('');
      setVehicleYear('');
      setVehicleColor('');
    }
  }

  async function toggleOnline(v: boolean) {
    if (!app) return;
    setOnline(v);
    await setDriverOnline(driverFleetId(app), v);
  }

  async function save() {
    if (!app) return;

    if (needsMotor) {
      if (!plate.trim()) {
        Alert.alert('Veículo', 'Informe a placa do novo veículo.');
        return;
      }
      if (!vehicleBrand.trim() || !vehicleModel.trim()) {
        Alert.alert('Veículo', 'Informe marca e modelo.');
        return;
      }
    }

    setSaving(true);
    try {
      const updated = await updateDriverApplication(app.id, {
        name,
        phone,
        bio,
        photoUrl: user?.photoUrl || app.photoUrl,
        vehicle: vehicleType,
        vehicleType,
        plate: needsMotor ? plate : '',
        vehicleBrand: needsMotor ? vehicleBrand : '',
        vehicleModel: needsMotor ? vehicleModel : '',
        vehicleYear: needsMotor ? vehicleYear : '',
        vehicleColor: needsMotor ? vehicleColor : '',
      });
      if (updated) setApp(updated);
      Alert.alert(
        'Ajustes',
        vehicleChanged
          ? `Meio de transporte atualizado para ${vehicleType}.`
          : 'Dados salvos.'
      );
    } catch (e: any) {
      Alert.alert('Ajustes', e?.message ?? 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function logoutDriver() {
    await clearDriverSession();
    router.replace('/driver/login' as any);
  }

  async function forgetSavedLogin() {
    await clearRememberedDriverLogin();
    Alert.alert('Login salvo', 'E-mail e senha não serão mais preenchidos automaticamente.');
  }

  if (!app) {
    return (
      <MobileShell style={styles.screen}>
        <BackHeader title="Ajustes" fallbackHref="/driver" />
        <Text style={styles.missing}>Nenhuma candidatura encontrada.</Text>
      </MobileShell>
    );
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Ajustes" fallbackHref="/driver" />
      <KeyboardScreen contentContainerStyle={styles.content}>
        <View style={styles.status}>
          <Text style={styles.statusLbl}>Conta</Text>
          <Text style={styles.statusVal}>{partnerStatusLabel(app)}</Text>
          <Text style={styles.email}>{app.email}</Text>
          {app.termsStatus === 'accepted' ? (
            <Text style={styles.termsOk}>Termo de responsabilidade aceito</Text>
          ) : (
            <TouchableOpacity
              onPress={() =>
                router.push({ pathname: '/driver/terms' as any, params: { id: app.id } })
              }
            >
              <Text style={styles.termsPend}>Assinar termo →</Text>
            </TouchableOpacity>
          )}
        </View>

        {app.status === 'approved' ? (
          <View style={styles.onlineCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.onlineTitle}>Disponível para corridas</Text>
              <Text style={styles.onlineSub}>
                {online ? 'Você aparece nas corridas disponíveis' : 'Offline — não recebe novas'}
              </Text>
            </View>
            <Switch
              value={online}
              onValueChange={(v) => void toggleOnline(v)}
              trackColor={{ false: '#CBD5E1', true: '#C4B5FD' }}
              thumbColor={online ? '#7C3AED' : '#f4f4f5'}
            />
          </View>
        ) : null}

        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} />

        <Text style={styles.label}>Telefone</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Text style={styles.label}>Sobre você (perfil público)</Text>
        <Text style={styles.vehicleHint}>
          Aparece para o cliente e a loja quando você aceita a corrida.
          {user?.photoUrl
            ? ' Sua foto do app Peça Já também entra no pedido.'
            : ' Coloque uma foto no perfil do app Peça Já para aparecer no pedido.'}
        </Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Ex.: Motoboy há 3 anos, entregas rápidas e com cuidado."
          placeholderTextColor={theme.colors.textMuted}
          multiline
          textAlignVertical="top"
          maxLength={180}
        />

        <View style={styles.vehicleCard}>
          <View style={styles.vehicleHead}>
            <Ionicons name="bicycle" size={20} color="#7C3AED" />
            <Text style={styles.vehicleTitle}>Meio de transporte</Text>
          </View>
          <Text style={styles.vehicleHint}>
            Troque se comprar outro veículo ou mudar o jeito de entregar.
          </Text>

          <View style={styles.vehicleRow}>
            {VEHICLES.map((v) => {
              const on = vehicleType === v;
              return (
                <TouchableOpacity
                  key={v}
                  style={[styles.vehicleChip, on && styles.vehicleChipOn]}
                  onPress={() => selectVehicle(v)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.vehicleChipText, on && styles.vehicleChipTextOn]}>
                    {v}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {vehicleChanged ? (
            <Text style={styles.changedHint}>
              Novo tipo: {vehicleType}. Preencha os dados e salve.
            </Text>
          ) : null}

          {needsMotor ? (
            <>
              <Text style={styles.label}>Placa</Text>
              <TextInput
                style={styles.input}
                value={plate}
                onChangeText={setPlate}
                autoCapitalize="characters"
                placeholder="ABC1D23"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.label}>Marca</Text>
              <TextInput
                style={styles.input}
                value={vehicleBrand}
                onChangeText={setVehicleBrand}
                placeholder="Honda, Yamaha…"
                placeholderTextColor={theme.colors.textMuted}
              />

              <Text style={styles.label}>Modelo</Text>
              <TextInput
                style={styles.input}
                value={vehicleModel}
                onChangeText={setVehicleModel}
                placeholder="CG 160, Pop…"
                placeholderTextColor={theme.colors.textMuted}
              />

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Ano</Text>
                  <TextInput
                    style={styles.input}
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    keyboardType="number-pad"
                    placeholder="2022"
                    placeholderTextColor={theme.colors.textMuted}
                    maxLength={4}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Cor</Text>
                  <TextInput
                    style={styles.input}
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                    placeholder="Vermelha"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.softNote}>
              Para {vehicleType.toLowerCase()}, placa e CNH não são exigidas neste painel.
            </Text>
          )}
        </View>

        {app.cnhNumber ? (
          <Text style={styles.cnh}>
            CNH {app.cnhNumber} · cat. {app.cnhCategory || '—'}
            {needsMotor
              ? ''
              : ' · mantida no cadastro (pode ser pedida se voltar para moto/carro)'}
          </Text>
        ) : needsMotor ? (
          <Text style={styles.cnhWarn}>
            Sem CNH no cadastro. Se o suporte pedir, atualize pelo canal de suporte Peça Já.
          </Text>
        ) : null}

        <Button title="Salvar alterações" onPress={() => void save()} loading={saving} size="lg" />

        <TouchableOpacity style={styles.link} onPress={confirmReloadApp}>
          <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.linkText}>Recarregar app</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => router.push('/driver/wallet/pix' as any)}
        >
          <Ionicons name="qr-code-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.linkText}>Chave Pix / saque</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.link}
          onPress={() => router.push('/driver/wallet' as any)}
        >
          <Ionicons name="wallet-outline" size={20} color={theme.colors.primary} />
          <Text style={styles.linkText}>Carteira de ganhos</Text>
        </TouchableOpacity>

        <Button
          title="Sair do painel"
          variant="outline"
          onPress={() => void logoutDriver()}
          style={{ marginTop: 16 }}
        />
        <Button
          title="Esquecer login salvo"
          variant="ghost"
          onPress={() => void forgetSavedLogin()}
          style={{ marginTop: 4 }}
        />
      </KeyboardScreen>
    </MobileShell>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: 16, gap: 8, paddingBottom: 40 },
  missing: { textAlign: 'center', marginTop: 40, color: theme.colors.textMuted },
  status: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 8,
  },
  statusLbl: { fontSize: 11, color: theme.colors.textMuted },
  statusVal: { fontSize: 18, fontWeight: '800', color: '#7C3AED', marginTop: 2 },
  email: { color: theme.colors.textSecondary, marginTop: 4, fontSize: 13 },
  termsOk: { color: '#059669', fontSize: 12, fontWeight: '600', marginTop: 6 },
  termsPend: { color: '#B45309', fontSize: 12, fontWeight: '700', marginTop: 6 },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
  },
  onlineTitle: { fontWeight: '700', color: theme.colors.text },
  onlineSub: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 8 },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
  },
  bioInput: {
    minHeight: 88,
    marginBottom: 4,
  },
  vehicleCard: {
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 4,
  },
  vehicleHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  vehicleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.text,
  },
  vehicleHint: {
    fontSize: 12,
    color: theme.colors.textMuted,
    lineHeight: 17,
    marginBottom: 8,
  },
  vehicleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  vehicleChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  vehicleChipOn: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  vehicleChipText: {
    fontWeight: '700',
    color: theme.colors.text,
    fontSize: 13,
  },
  vehicleChipTextOn: { color: '#fff' },
  changedHint: {
    marginTop: 6,
    marginBottom: 2,
    color: '#7C3AED',
    fontSize: 12,
    fontWeight: '700',
  },
  softNote: {
    marginTop: 8,
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  row2: { flexDirection: 'row', gap: 10 },
  cnh: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4, marginBottom: 4 },
  cnhWarn: {
    color: '#B45309',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 4,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    marginTop: 4,
  },
  linkText: { color: theme.colors.text, fontWeight: '600' },
});
