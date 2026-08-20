/**
 * Define a URL pública da API em eas.json + .env (EXPO_PUBLIC_API_URL).
 * Uso: node scripts/set-api-url.js https://seu-dominio.up.railway.app
 */
const fs = require('fs');
const path = require('path');

const url = String(process.argv[2] || '')
  .trim()
  .replace(/\/$/, '');

if (!url || !/^https?:\/\//i.test(url)) {
  console.error('Uso: node scripts/set-api-url.js https://seu-dominio.up.railway.app');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const easPath = path.join(root, 'eas.json');
const eas = JSON.parse(fs.readFileSync(easPath, 'utf8'));

for (const profile of ['preview', 'production']) {
  if (!eas.build[profile]) continue;
  eas.build[profile].env = {
    ...(eas.build[profile].env || {}),
    EXPO_PUBLIC_USE_FLEET_SERVER: '1',
    EXPO_PUBLIC_API_URL: url,
  };
}
fs.writeFileSync(easPath, JSON.stringify(eas, null, 2) + '\n');
console.log('eas.json →', url);

const envPath = path.join(root, '.env');
let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
const line = `EXPO_PUBLIC_API_URL=${url}`;
if (/^EXPO_PUBLIC_API_URL=/m.test(env)) {
  env = env.replace(/^EXPO_PUBLIC_API_URL=.*$/m, line);
} else {
  env = env.trimEnd() + `\n${line}\n`;
}
if (!/^EXPO_PUBLIC_USE_FLEET_SERVER=/m.test(env)) {
  env += 'EXPO_PUBLIC_USE_FLEET_SERVER=1\n';
} else {
  env = env.replace(/^EXPO_PUBLIC_USE_FLEET_SERVER=.*$/m, 'EXPO_PUBLIC_USE_FLEET_SERVER=1');
}
fs.writeFileSync(envPath, env);
console.log('.env → EXPO_PUBLIC_API_URL definido');
console.log('Privacidade:', `${url}/privacy`);
console.log('Health:', `${url}/health`);
