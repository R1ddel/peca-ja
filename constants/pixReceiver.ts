/**
 * Recebedor Pix estático (QR no app).
 * Prefira variáveis de servidor; no app mobile use EXPO_PUBLIC_* só se o QR for gerado no client.
 * Nunca commitar chave/nome reais no código-fonte.
 */
const envKey = (
  process.env.PIX_RECEIVER_KEY ||
  process.env.EXPO_PUBLIC_PIX_RECEIVER_KEY ||
  ''
).trim();
const envName = (
  process.env.PIX_RECEIVER_NAME ||
  process.env.EXPO_PUBLIC_PIX_RECEIVER_NAME ||
  ''
).trim();
const envCity = (
  process.env.PIX_RECEIVER_CITY ||
  process.env.EXPO_PUBLIC_PIX_RECEIVER_CITY ||
  ''
).trim();

export const PIX_RECEIVER = {
  key: envKey,
  merchantName: (envName || 'PECA JA').slice(0, 25),
  merchantCity: (envCity || 'Brasil').slice(0, 15),
  referencePayload: (
    process.env.PIX_RECEIVER_PAYLOAD ||
    process.env.EXPO_PUBLIC_PIX_RECEIVER_PAYLOAD ||
    ''
  ).trim(),
  txid: (
    process.env.PIX_RECEIVER_TXID ||
    process.env.EXPO_PUBLIC_PIX_RECEIVER_TXID ||
    'pecaja'
  ).trim(),
} as const;

export function isPixReceiverConfigured(): boolean {
  return Boolean(PIX_RECEIVER.key);
}
