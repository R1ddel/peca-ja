/**
 * Envio de código de reset — o token NUNCA vai na resposta HTTP.
 * Sem RESEND_API_KEY o pedido ainda responde 200 genérico e só loga o hash do e-mail.
 */
import { emailKey } from '@/services/platformCrypto';

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const key = (process.env.RESEND_API_KEY || '').trim();
  const from = (process.env.RESET_MAIL_FROM || 'Peça Já <nao-responda@pecaja.app>').trim();
  if (!key) {
    console.error('[mail] RESEND_API_KEY ausente; reset não enviado.', emailKey(email));
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Código para redefinir sua senha — Peça Já',
        text:
          `Seu código de recuperação é: ${token}\n\n` +
          `Ele vale 15 minutos e só pode ser usado uma vez.\n` +
          `Se você não pediu isso, ignore este e-mail.`,
      }),
    });
    if (!res.ok) {
      console.error('[mail] Resend falhou', res.status, emailKey(email));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[mail] Falha de envio', emailKey(email), (err as { message?: string })?.message);
    return false;
  }
}
