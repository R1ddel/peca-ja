/**
 * Valida DATABASE_URL / FLEET_DATABASE_URL e cria schema (fleet + platform).
 */
import 'dotenv/config';
import postgres from 'postgres';
import { ensureFleetSchema, getFleetDatabaseUrl } from '../services/fleetDb';
import { loadPlatformState, platformPersistenceMode } from '../services/platformStore';

async function main() {
  const url = getFleetDatabaseUrl();
  if (!url) {
    console.error(
      'Sem DATABASE_URL / FLEET_DATABASE_URL / PLATFORM_DATABASE_URL no .env\n' +
        'Crie um projeto no Neon (https://console.neon.tech) e cole a connection string.'
    );
    process.exit(1);
  }

  const masked = url.replace(/:[^:@/]+@/, ':****@');
  console.log('Conectando:', masked);

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    prepare: false,
    ssl: 'require',
  });

  try {
    const rows = await sql`select now() as now, current_database() as db`;
    console.log('Postgres OK ·', rows[0]?.db, '·', rows[0]?.now);

    await ensureFleetSchema();
    console.log('Schema frota OK (fleet_state)');

    // Dispara criação do platform_state
    await loadPlatformState();
    console.log('Schema plataforma OK · mode=', platformPersistenceMode());

    console.log('\nPronto. Use no Railway:');
    console.log('  DATABASE_URL=<mesma URL>');
    console.log('  FLEET_DATABASE_URL=<mesma URL>  (opcional se DATABASE_URL já estiver)');
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  console.error('Falha:', e?.message || e);
  process.exit(1);
});
