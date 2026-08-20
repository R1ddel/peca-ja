/**
 * Endereços de entrega salvos no aparelho (sem backend).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@pecaja_addresses';
const MAX = 5;

export type SavedAddress = {
  id: string;
  label: string;
  line: string;
  isDefault?: boolean;
  createdAt: string;
};

export async function loadAddresses(): Promise<SavedAddress[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveAll(list: SavedAddress[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  return list.slice(0, MAX);
}

export async function upsertAddress(input: {
  id?: string;
  label: string;
  line: string;
  makeDefault?: boolean;
}): Promise<SavedAddress[]> {
  const label = input.label.trim() || 'Endereço';
  const line = input.line.trim();
  if (!line) return loadAddresses();

  const list = await loadAddresses();
  const now = new Date().toISOString();
  let next: SavedAddress[];

  if (input.id) {
    next = list.map((a) =>
      a.id === input.id ? { ...a, label, line } : a
    );
  } else {
    const dup = list.find((a) => a.line.toLowerCase() === line.toLowerCase());
    if (dup) {
      next = list.map((a) => (a.id === dup.id ? { ...a, label } : a));
    } else {
      next = [
        {
          id: `addr_${Date.now()}`,
          label,
          line,
          createdAt: now,
        },
        ...list,
      ];
    }
  }

  if (input.makeDefault) {
    const targetLine = line.toLowerCase();
    next = next.map((a) => ({
      ...a,
      isDefault: a.line.toLowerCase() === targetLine,
    }));
  }

  return saveAll(next);
}

export async function setDefaultAddress(id: string): Promise<SavedAddress[]> {
  const list = await loadAddresses();
  return saveAll(list.map((a) => ({ ...a, isDefault: a.id === id })));
}

export async function removeAddress(id: string): Promise<SavedAddress[]> {
  const list = await loadAddresses();
  return saveAll(list.filter((a) => a.id !== id));
}

export function getDefaultAddress(list: SavedAddress[]): SavedAddress | null {
  return list.find((a) => a.isDefault) ?? list[0] ?? null;
}
