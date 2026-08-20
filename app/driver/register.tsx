import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { BackHeader } from '@/components/BackHeader';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { MobileShell } from '@/components/MobileShell';
import { useAuth } from '@/context/AuthContext';
import {
  DRIVER_TERMS_TITLE,
  DRIVER_TERMS_VERSION,
  buildDriverTermsBody,
} from '@/constants/driverTerms';
import { acceptDriverTerms, submitDriverApplication } from '@/utils/partners';
import { setDriverSession } from '@/utils/driverSession';
import { theme } from '@/constants/theme';

const VEHICLES = ['Moto', 'Bicicleta', 'Carro', 'A pé'] as const;
const CNH_CATS = ['A', 'AB', 'ACC', 'B', 'C', 'D', 'E'];

export default function DriverRegisterScreen() {
  const { user, register, login } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [document, setDocument] = useState('');
  const [city, setCity] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [vehicleType, setVehicleType] = useState<(typeof VEHICLES)[number]>('Moto');
  const [plate, setPlate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [renavam, setRenavam] = useState('');
  const [cnhNumber, setCnhNumber] = useState('');
  const [cnhCategory, setCnhCategory] = useState('A');
  const [cnhExpiry, setCnhExpiry] = useState('');
  const [notes, setNotes] = useState('');

  const [readOk, setReadOk] = useState(false);
  const [agree, setAgree] = useState(false);
  const [liabilityOk, setLiabilityOk] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const needsMotor = vehicleType === 'Moto' || vehicleType === 'Carro';
  const needsCnh = vehicleType === 'Moto' || vehicleType === 'Carro';

  const termsBody = useMemo(
    () =>
      buildDriverTermsBody({
        name: name.trim() || 'Entregador',
        document,
        vehicleType,
        plate,
        city,
      }),
    [name, document, vehicleType, plate, city]
  );

  function validateStep1(): string | null {
    if (!name.trim() || !email.trim() || !phone.trim()) return 'Preencha nome, e-mail e telefone.';
    if (password.length < 4) return 'Senha com pelo menos 4 caracteres.';
    if (password !== password2) return 'As senhas não coincidem.';
    if (document.replace(/\D/g, '').length !== 11) return 'CPF inválido.';
    if (!city.trim()) return 'Informe a cidade.';
    return null;
  }

  function validateStep2(): string | null {
    if (needsMotor) {
      if (!plate.trim()) return 'Informe a placa.';
      if (!vehicleBrand.trim() || !vehicleModel.trim()) return 'Informe marca e modelo.';
    }
    if (needsCnh) {
      if (!cnhNumber.trim()) return 'Informe o número da CNH.';
      if (!cnhCategory.trim()) return 'Informe a categoria da CNH.';
    }
    return null;
  }

  function goToStep(target: 1 | 2 | 3) {
    if (target === step) return;
    if (target > step) {
      if (target >= 2) {
        const err1 = validateStep1();
        if (err1) {
          setError(err1);
          setStep(1);
          return;
        }
      }
      if (target >= 3) {
        const err2 = validateStep2();
        if (err2) {
          setError(err2);
          setStep(2);
          return;
        }
      }
    }
    setError('');
    setStep(target);
  }

  function goStep2() {
    goToStep(2);
  }

  function goStep3() {
    goToStep(3);
  }

  async function handleSubmit() {
    if (!readOk || !agree || !liabilityOk) {
      setError('Leia o termo e marque todas as confirmações.');
      return;
    }
    if (document.replace(/\D/g, '').length !== 11) {
      setError('CPF inválido para assinatura do termo.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await submitDriverApplication({
        name,
        email,
        phone,
        password,
        document,
        city,
        birthDate,
        cnhNumber: needsCnh ? cnhNumber : '',
        cnhCategory: needsCnh ? cnhCategory : '',
        cnhExpiry,
        vehicleType,
        plate,
        vehicleBrand,
        vehicleModel,
        vehicleYear,
        vehicleColor,
        renavam,
        notes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      const authLogin = await login(email.trim().toLowerCase(), password);
      if (!authLogin.success) {
        await register({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          address: city.trim(),
        });
      }

      await setDriverSession({
        applicationId: result.application.id,
        email: result.application.email,
        loggedAt: new Date().toISOString(),
      });

      const accepted = await acceptDriverTerms(result.application.id, {
        method: 'aceite_eletronico',
        signerName: name.trim(),
        signerDocument: document,
      });
      if (!accepted) {
        setError('Cadastro criado, mas o termo não foi registrado. Abra o painel e assine.');
        router.replace({
          pathname: '/driver/terms' as any,
          params: { id: result.application.id },
        });
        return;
      }

      router.replace('/driver' as any);
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileShell style={styles.screen}>
      <BackHeader title="Cadastro entregador" fallbackHref="/driver/login" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.steps}>
            <TouchableOpacity
              style={[styles.stepPill, step === 1 && styles.stepOn]}
              onPress={() => goToStep(1)}
              activeOpacity={0.85}
            >
              <Text style={[styles.stepPillText, step === 1 && styles.stepOnText]}>
                1 · Dados
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepPill, step === 2 && styles.stepOn]}
              onPress={() => goToStep(2)}
              activeOpacity={0.85}
            >
              <Text style={[styles.stepPillText, step === 2 && styles.stepOnText]}>
                2 · Veículo / CNH
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.stepPill, step === 3 && styles.stepOn]}
              onPress={() => goToStep(3)}
              activeOpacity={0.85}
            >
              <Text style={[styles.stepPillText, step === 3 && styles.stepOnText]}>
                3 · Termo
              </Text>
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {step === 1 ? (
            <>
              <Text style={styles.lead}>
                Passo 1 de 3 — crie o login do painel. Em seguida: veículo/CNH e termo de
                responsabilidade.
              </Text>
              <Input
                label="Nome completo *"
                placeholder="Seu nome"
                icon="person-outline"
                value={name}
                onChangeText={setName}
              />
              <Input
                label="E-mail *"
                placeholder="seu@email.com"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Senha do painel *"
                placeholder="Mín. 4 caracteres"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Input
                label="Confirmar senha *"
                placeholder="Repita a senha"
                icon="lock-closed-outline"
                value={password2}
                onChangeText={setPassword2}
                secureTextEntry
              />
              <Input
                label="WhatsApp / telefone *"
                placeholder="(75) 99999-9999"
                icon="call-outline"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="CPF *"
                placeholder="Somente números"
                icon="document-text-outline"
                value={document}
                onChangeText={setDocument}
                keyboardType="number-pad"
              />
              <Input
                label="Cidade de atuação *"
                placeholder="Ex.: Vale do Capão"
                icon="location-outline"
                value={city}
                onChangeText={setCity}
              />
              <Input
                label="Data de nascimento"
                placeholder="DD/MM/AAAA"
                icon="calendar-outline"
                value={birthDate}
                onChangeText={setBirthDate}
              />
              <Button title="Continuar — veículo / CNH" onPress={goStep2} size="lg" style={styles.submit} />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={styles.lead}>
                Passo 2 de 3 — veículo e CNH. Depois você lê e assina o termo de responsabilidade.
              </Text>

              <Text style={styles.label}>Tipo de veículo *</Text>
              <View style={styles.chips}>
                {VEHICLES.map((v) => {
                  const on = vehicleType === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setVehicleType(v)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{v}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {needsMotor ? (
                <>
                  <Input
                    label="Placa *"
                    placeholder="ABC1D23"
                    icon="car-outline"
                    value={plate}
                    onChangeText={setPlate}
                    autoCapitalize="characters"
                  />
                  <Input
                    label="Marca *"
                    placeholder="Honda, Yamaha…"
                    icon="construct-outline"
                    value={vehicleBrand}
                    onChangeText={setVehicleBrand}
                  />
                  <Input
                    label="Modelo *"
                    placeholder="CG 160, Factor…"
                    icon="bicycle-outline"
                    value={vehicleModel}
                    onChangeText={setVehicleModel}
                  />
                  <Input
                    label="Ano"
                    placeholder="2022"
                    icon="calendar-outline"
                    value={vehicleYear}
                    onChangeText={setVehicleYear}
                    keyboardType="number-pad"
                  />
                  <Input
                    label="Cor"
                    placeholder="Vermelha"
                    icon="color-palette-outline"
                    value={vehicleColor}
                    onChangeText={setVehicleColor}
                  />
                  <Input
                    label="RENAVAM"
                    placeholder="Opcional"
                    icon="document-outline"
                    value={renavam}
                    onChangeText={setRenavam}
                    keyboardType="number-pad"
                  />
                </>
              ) : null}

              {needsCnh ? (
                <>
                  <Input
                    label="Número da CNH *"
                    placeholder="Registro da habilitação"
                    icon="card-outline"
                    value={cnhNumber}
                    onChangeText={setCnhNumber}
                    keyboardType="number-pad"
                  />
                  <Text style={styles.label}>Categoria da CNH *</Text>
                  <View style={styles.chips}>
                    {CNH_CATS.map((c) => {
                      const on = cnhCategory === c;
                      return (
                        <TouchableOpacity
                          key={c}
                          style={[styles.chip, on && styles.chipOn]}
                          onPress={() => setCnhCategory(c)}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Input
                    label="Validade da CNH"
                    placeholder="DD/MM/AAAA"
                    icon="calendar-outline"
                    value={cnhExpiry}
                    onChangeText={setCnhExpiry}
                  />
                </>
              ) : (
                <Text style={styles.soft}>
                  Para bicicleta / a pé, CNH não é obrigatória neste cadastro.
                </Text>
              )}

              <Input
                label="Observações"
                placeholder="Disponibilidade, bairros… (opcional)"
                icon="chatbubble-outline"
                value={notes}
                onChangeText={setNotes}
              />

              <Button
                title="Continuar — termo de responsabilidade"
                onPress={goStep3}
                size="lg"
                style={styles.submit}
              />
              <Button title="Voltar" variant="outline" onPress={() => setStep(1)} />
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={styles.lead}>
                Passo 3 de 3 — leia o termo e confirme. Só depois o cadastro é finalizado.
              </Text>

              <View style={styles.banner}>
                <Ionicons name="shield-checkmark" size={22} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>{DRIVER_TERMS_TITLE}</Text>
                  <Text style={styles.bannerSub}>Versão {DRIVER_TERMS_VERSION}</Text>
                </View>
              </View>

              <View style={styles.warn}>
                <Ionicons name="warning" size={18} color="#B45309" />
                <Text style={styles.warnText}>
                  Acidentes, multas, danos ao pedido e condutas na rua são de responsabilidade do
                  entregador — não do Peça Já.
                </Text>
              </View>

              <ScrollView style={styles.termsBox} nestedScrollEnabled>
                <Text style={styles.termsText}>{termsBody}</Text>
              </ScrollView>

              <CheckRow
                checked={readOk}
                onPress={() => setReadOk((v) => !v)}
                label="Li integralmente o Termo de Responsabilidade e Isenção."
              />
              <CheckRow
                checked={agree}
                onPress={() => setAgree((v) => !v)}
                label="Concordo com todas as cláusulas e com a natureza autônoma da relação (sem vínculo empregatício)."
              />
              <CheckRow
                checked={liabilityOk}
                onPress={() => setLiabilityOk((v) => !v)}
                label="Declaro que o Peça Já não responde por minhas ações, omissões, acidentes ou ilícitos no exercício das entregas, e que assumo esses riscos."
              />

              <Text style={styles.signMeta}>
                Assinatura: {name.trim() || '—'} · CPF {document.replace(/\D/g, '') || '—'}
              </Text>

              <Button
                title="Aceitar termo e criar conta"
                onPress={() => void handleSubmit()}
                loading={loading}
                size="lg"
                disabled={!readOk || !agree || !liabilityOk}
                style={styles.submit}
              />
              <Button title="Voltar" variant="outline" onPress={() => setStep(2)} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </MobileShell>
  );
}

function CheckRow({
  checked,
  onPress,
  label,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
}) {
  return (
    <TouchableOpacity style={styles.checkRow} onPress={onPress} activeOpacity={0.85}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? '#7C3AED' : theme.colors.textMuted}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  stepPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  stepPillText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  stepOn: {
    backgroundColor: '#EDE9FE',
    borderColor: '#C4B5FD',
  },
  stepOnText: {
    color: '#6D28D9',
  },
  lead: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    marginBottom: theme.spacing.md,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: 4,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing.md },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipOn: {
    backgroundColor: '#EDE9FE',
    borderColor: '#7C3AED',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.colors.textMuted },
  chipTextOn: { color: '#6D28D9' },
  soft: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 10, lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: { color: theme.colors.error, fontSize: theme.fontSize.sm, flex: 1 },
  submit: { marginTop: theme.spacing.sm, marginBottom: 8 },
  banner: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#4C1D95',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 13, lineHeight: 18 },
  bannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 4 },
  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  warnText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17, fontWeight: '600' },
  termsBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    maxHeight: 280,
    marginBottom: 14,
  },
  termsText: {
    fontSize: 12,
    color: theme.colors.text,
    lineHeight: 18,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  checkRow: { flexDirection: 'row', gap: 10, marginBottom: 12, alignItems: 'flex-start' },
  checkLabel: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 19 },
  signMeta: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 8,
    fontWeight: '600',
  },
});
