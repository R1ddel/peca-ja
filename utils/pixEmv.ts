import { PIX_RECEIVER } from '@/constants/pixReceiver';

/** TLV EMV: ID (2) + length (2) + value */
function tlv(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — padrão Pix BR Code. */
export function crc16Pix(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatPixAmount(amount: number): string {
  const safe = Math.max(0.01, Math.round(amount * 100) / 100);
  return safe.toFixed(2);
}

/**
 * Monta Pix Copia e Cola (EMV) para a conta do recebedor com o valor do pedido.
 */
export function buildReceiverPixPayload(amount: number): string {
  if (!PIX_RECEIVER.key) {
    throw new Error(
      'Pix não configurado. Defina PIX_RECEIVER_KEY (ou EXPO_PUBLIC_PIX_RECEIVER_KEY) no ambiente.'
    );
  }
  const guis = tlv('00', 'br.gov.bcb.pix') + tlv('01', PIX_RECEIVER.key);
  const merchantAccount = tlv('26', guis);

  const additional = tlv('05', PIX_RECEIVER.txid.slice(0, 25));
  const additionalData = tlv('62', additional);

  const name = PIX_RECEIVER.merchantName.slice(0, 25);
  const city = PIX_RECEIVER.merchantCity.slice(0, 15);

  const body =
    '000201' +
    merchantAccount +
    tlv('52', '0000') +
    tlv('53', '986') +
    tlv('54', formatPixAmount(amount)) +
    tlv('58', 'BR') +
    tlv('59', name) +
    tlv('60', city) +
    additionalData +
    '6304';

  return body + crc16Pix(body);
}

/** Confere se o CRC do payload de referência está válido (smoke). */
export function isValidPixPayload(payload: string): boolean {
  if (!payload || payload.length < 20) return false;
  const withoutCrc = payload.slice(0, -4);
  const given = payload.slice(-4).toUpperCase();
  if (!payload.includes('6304')) return false;
  const base = payload.includes('6304')
    ? payload.slice(0, payload.lastIndexOf('6304') + 4)
    : withoutCrc;
  return crc16Pix(base) === given;
}
