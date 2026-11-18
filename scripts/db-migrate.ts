/**
 * Runner de migrations SQL versionadas (F0).
 *
 * Uso:
 *   npm run db:migrate:status   # lista aplicadas / pendentes (conecta)
 *   npm run db:migrate          # aplica pendentes
 *   npm run db:migrate -- --dry-run
 *
 * NÃO rode contra produção sem aprovação explícita.
 * Connection string: DATABASE_URL | FLEET_DATABASE_URL | PLATFORM_DATABASE_URL
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import postgres from 'postgres';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

function resolveDatabaseUrl(): string | null {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.FLEET_DATABASE_URL?.trim() ||
    process.env.PLATFORM_DATABASE_URL?.trim() ||
    null
  );
}

function maskUrl(url: string): string {
  return url.replace(/:[^:@/]+@/, ':****@');
}

function listMigrationFiles(): string[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/i.test(f))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function readMigration(file: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
}

type Sql = ReturnType<typeof postgres>;

async function ensureMigrationsTable(sql: Sql): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

async function appliedIds(sql: Sql): Promise<Set<string>> {
  const rows = await sql`SELECT id FROM schema_migrations ORDER BY id`;
  return new Set((rows as { id: string }[]).map((r) => r.id));
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const statusOnly = args.includes('--status') || process.env.npm_lifecycle_event === 'db:migrate:status';

  const files = listMigrationFiles();
  if (!files.length) {
    console.log('Nenhum arquivo migrations/*.sql encontrado.');
  }

  const url = resolveDatabaseUrl();
  if (!url) {
    console.error(
      'Sem DATABASE_URL / FLEET_DATABASE_URL / PLATFORM_DATABASE_URL.\n' +
        'Configure no .env local (nunca commite valores).'
    );
    console.log('\nArquivos no disco:');
    for (const f of files) console.log(' -', f);
    process.exit(statusOnly ? 0 : 1);
  }

  console.log('DB:', maskUrl(url));
  if (dryRun) console.log('Modo: dry-run (não aplica)');

  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    prepare: false,
    ssl:
      url.includes('supabase') || url.includes('sslmode=require') ? 'require' : undefined,
  });

  try {
    await ensureMigrationsTable(sql);
    const done = await appliedIds(sql);
    const pending = files.filter((f) => !done.has(f));

    console.log(`Aplicadas: ${done.size} · Pendentes: ${pending.length}`);
    for (const f of files) {
      console.log(done.has(f) ? `  [ok]  ${f}` : `  [..]  ${f}`);
    }

    if (statusOnly) return;

    if (!pending.length) {
      console.log('Nada a aplicar.');
      return;
    }

    for (const file of pending) {
      const body = readMigration(file).trim();
      if (!body) {
        console.log(`Pulando vazio: ${file}`);
        continue;
      }
      console.log(`${dryRun ? 'Dry-run' : 'Aplicando'}: ${file}`);
      if (dryRun) continue;

      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`INSERT INTO schema_migrations (id) VALUES (${file})`;
      });
      console.log(`  → aplicada ${file}`);
    }
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  console.error('Falha db:migrate:', String((e as Error)?.message || e).slice(0, 300));
  process.exit(1);
});
