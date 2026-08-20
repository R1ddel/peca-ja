/**
 * Persistência de sync na nuvem (API Expo / host do Metro).
 * Arquivos em .data/merchant-cloud/ — compartilhado entre aparelhos no mesmo host.
 */
import { promises as fs } from 'fs';
import path from 'path';

type CloudRecord = {
  applicationId: string;
  token: string;
  updatedAt: string;
  payload: unknown;
};

const memory = new Map<string, CloudRecord>();

function dataDir(): string {
  return path.join(process.cwd(), '.data', 'merchant-cloud');
}

function fileFor(applicationId: string): string {
  const safe = applicationId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return path.join(dataDir(), `${safe}.json`);
}

async function ensureDir() {
  await fs.mkdir(dataDir(), { recursive: true });
}

export async function saveCloudSync(
  applicationId: string,
  token: string,
  payload: unknown
): Promise<CloudRecord> {
  const record: CloudRecord = {
    applicationId,
    token,
    updatedAt: new Date().toISOString(),
    payload,
  };
  memory.set(applicationId, record);
  try {
    await ensureDir();
    await fs.writeFile(fileFor(applicationId), JSON.stringify(record), 'utf8');
  } catch (err) {
    console.warn('[cloud-sync] fs write failed, using memory only', err);
  }
  return record;
}

export async function loadCloudSync(
  applicationId: string
): Promise<CloudRecord | null> {
  const mem = memory.get(applicationId);
  if (mem) return mem;
  try {
    const raw = await fs.readFile(fileFor(applicationId), 'utf8');
    const parsed = JSON.parse(raw) as CloudRecord;
    if (parsed?.applicationId) {
      memory.set(applicationId, parsed);
      return parsed;
    }
  } catch {
    /* missing */
  }
  return null;
}

export function tokensMatch(stored: string, provided: string): boolean {
  return !!stored && !!provided && stored === provided;
}
