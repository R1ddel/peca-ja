import 'dotenv/config';
import { handlePlatformAction } from '../services/platformEngine';
import { platformPersistenceMode } from '../services/platformStore';

async function main() {
  console.log('persistence=', platformPersistenceMode());
  const health = await handlePlatformAction({ action: 'health' });
  console.log('health', health);

  const email = `teste_${Date.now()}@pecaja.local`;
  const reg = await handlePlatformAction({
    action: 'register',
    name: 'Teste Plataforma',
    email,
    phone: '11999999999',
    password: 'senha123',
    address: 'Mucugê',
  });
  console.log('register', reg.ok, reg.user?.email || reg.message);

  const login = await handlePlatformAction({
    action: 'login',
    email,
    password: 'senha123',
  });
  console.log('login', login.ok, !!login.token);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
