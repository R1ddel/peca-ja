/**
 * Imprime QR do Expo Go no terminal (LAN).
 * Uso: npm run qr
 */
const os = require('os');
const QRCode = require('qrcode');

function lanIp() {
  const ifaces = os.networkInterfaces();
  for (const list of Object.values(ifaces)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (
          net.address.startsWith('192.168.') ||
          net.address.startsWith('10.')
        ) {
          return net.address;
        }
      }
    }
  }
  for (const list of Object.values(ifaces)) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const port = process.env.EXPO_PORT || '8081';
const host = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || lanIp();
const url = `exp://${host}:${port}`;

QRCode.toString(url, { type: 'terminal', small: true }, (err, str) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('\nEscaneie no Expo Go (mesma Wi-Fi do PC):\n');
  console.log(str);
  console.log(url);
  console.log('');
});

QRCode.toFile(
  'pecaja-expo-qr.png',
  url,
  { width: 480, margin: 2 },
  (err) => {
    if (!err) console.log('Também salvo em: pecaja-expo-qr.png\n');
  }
);
