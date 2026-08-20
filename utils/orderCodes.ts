/** Gera par de códigos distintos (retirada ≠ entrega). */
export function generateOrderVerificationCodes(): {
  pickupCode: string;
  deliveryCode: string;
} {
  const one = () => String(Math.floor(1000 + Math.random() * 9000));
  const pickupCode = one();
  let deliveryCode = one();
  let guard = 0;
  while (deliveryCode === pickupCode && guard < 20) {
    deliveryCode = one();
    guard += 1;
  }
  if (deliveryCode === pickupCode) {
    deliveryCode = pickupCode === '9999' ? '1000' : String(Number(pickupCode) + 1).padStart(4, '0');
  }
  return { pickupCode, deliveryCode };
}

export function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 4);
}
