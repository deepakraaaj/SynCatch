import { isTauri } from '@tauri-apps/api/core';

export const DATABASE_PATH = 'sqlite:mission-control.db';

export interface SqlDatabase {
  execute: (query: string, bindValues?: unknown[]) => Promise<unknown>;
  select: <T>(query: string, bindValues?: unknown[]) => Promise<T[]>;
}

let databasePromise: Promise<SqlDatabase> | null = null;

export async function getSqlDatabase() {
  if (!isTauri()) {
    throw new Error('SQLite is only available inside the Tauri app.');
  }

  if (!databasePromise) {
    databasePromise = import('@tauri-apps/plugin-sql').then(({ default: Database }) =>
      Database.load(DATABASE_PATH),
    );
  }

  return databasePromise;
}
