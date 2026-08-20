/** Política de Privacidade — servida em GET /privacy. */

export const PRIVACY_POLICY_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Política de Privacidade — Peça Já</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: Georgia, "Times New Roman", serif; max-width: 40rem; margin: 2rem auto; padding: 0 1.25rem; line-height: 1.55; color: #1a1a1a; background: #faf8f5; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2 { font-size: 1.15rem; margin-top: 1.75rem; }
    .meta { color: #555; font-size: 0.95rem; margin-bottom: 1.5rem; }
    a { color: #0b6b45; }
  </style>
</head>
<body>
  <h1>Política de Privacidade</h1>
  <p class="meta">Peça Já · Atualizado em agosto de 2026</p>

  <p>O Peça Já (“nós”, “aplicativo”) é um serviço de pedidos e entregas locais. Esta política explica quais dados coletamos, para que usamos e como você pode exercer seus direitos (LGPD).</p>

  <h2>1. Dados que coletamos</h2>
  <ul>
    <li><strong>Conta:</strong> nome, e-mail, telefone, endereço e senha (armazenada de forma criptografada).</li>
    <li><strong>Pedidos:</strong> itens, valores, status, códigos de retirada/entrega e histórico necessário à operação.</li>
    <li><strong>Localização:</strong> quando você autoriza, para mostrar comércios próximos e estimar entregas.</li>
    <li><strong>Pagamentos:</strong> processados pelo Mercado Pago. Não armazenamos número completo de cartão. Dados de Pix (chave/documento) do comerciante ou entregador só para saques autorizados.</li>
    <li><strong>Dispositivo:</strong> token de notificação push (quando permitido) para avisos de pedido.</li>
    <li><strong>Foto de perfil:</strong> se você enviar pela câmera ou galeria.</li>
  </ul>

  <h2>2. Finalidades</h2>
  <ul>
    <li>Criar e autenticar sua conta;</li>
    <li>Processar pedidos, pagamentos, entregas e saques;</li>
    <li>Comunicar status do pedido e suporte;</li>
    <li>Prevenir fraude e cumprir obrigações legais;</li>
    <li>Melhorar o serviço com base em uso agregado.</li>
  </ul>

  <h2>3. Compartilhamento</h2>
  <p>Compartilhamos dados somente com:</p>
  <ul>
    <li>Comércios e entregadores envolvidos no seu pedido (dados necessários à entrega);</li>
    <li>Mercado Pago (pagamentos e saques);</li>
    <li>Provedores de infraestrutura (hospedagem/banco), sob contrato;</li>
    <li>Autoridades, quando exigido por lei.</li>
  </ul>
  <p>Não vendemos seus dados pessoais.</p>

  <h2>4. Retenção e segurança</h2>
  <p>Mantemos os dados pelo tempo necessário à operação, obrigações legais e defesa de direitos. Usamos HTTPS, controle de sessão e acesso restrito aos servidores.</p>

  <h2>5. Seus direitos (LGPD)</h2>
  <p>Você pode solicitar acesso, correção, exclusão, portabilidade ou oposição ao tratamento, conforme a lei. Contato: pelo e-mail de suporte informado na ficha do app na Play Store ou pelo canal de suporte dentro do aplicativo.</p>

  <h2>6. Crianças</h2>
  <p>O aplicativo não se destina a menores de 13 anos. Não coletamos dados de crianças de forma consciente.</p>

  <h2>7. Alterações</h2>
  <p>Podemos atualizar esta política. A versão vigente estará sempre em <code>/privacy</code> neste domínio da API e/ou no link da loja.</p>
</body>
</html>`;
