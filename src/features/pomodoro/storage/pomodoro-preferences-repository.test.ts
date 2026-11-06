import { describe, expect, it } from 'vitest';

import { IndexedDbError } from '@/core/storage/indexed-db';
import {
  PomodoroPreferencesRepository,
  PomodoroPreferencesStorageError,
  type PomodoroPreferencesStore,
} from './pomodoro-preferences-repository';
import { POMODORO_PREFERENCES_STORAGE_KEY } from './pomodoro-preferences-record';
import type { PomodoroPreferences } from '../domain/pomodoro.types';

const validPreferences: PomodoroPreferences = {
  focusDurationMinutes: 25,
  shortBreakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
};

class MemoryPreferencesStore implements PomodoroPreferencesStore {
  readonly values = new Map<string, unknown>();
  readonly writes: Array<{ key: string; value: unknown }> = [];
  readError?: unknown;
  writeError?: unknown;

  async get<T>(key: string): Promise<T | undefined> {
    if (this.readError !== undefined) {
      throw this.readError;
    }

    return this.values.get(key) as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (this.writeError !== undefined) {
      throw this.writeError;
    }

    this.writes.push({ key, value });
    this.values.set(key, value);
  }
}

describe('PomodoroPreferencesRepository', () => {
  it('returns undefined when no preferences have been saved', async () => {
    const repository = new PomodoroPreferencesRepository(
      new MemoryPreferencesStore(),
    );

    await expect(repository.read()).resolves.toBeUndefined();
  });

  it('saves all three preferences through one store operation', async () => {
    const store = new MemoryPreferencesStore();
    const repository = new PomodoroPreferencesRepository(store);

    await repository.save(validPreferences);

    expect(store.writes).toEqual([
      {
        key: POMODORO_PREFERENCES_STORAGE_KEY,
        value: validPreferences,
      },
    ]);
    await expect(repository.read()).resolves.toEqual(validPreferences);
  });

  it('rejects invalid preferences before writing', async () => {
    const store = new MemoryPreferencesStore();
    const repository = new PomodoroPreferencesRepository(store);

    await expect(
      repository.save({ ...validPreferences, shortBreakDurationMinutes: 0 }),
    ).rejects.toMatchObject({
      name: 'PomodoroPreferencesStorageError',
      code: 'preferences-invalid',
    });
    expect(store.writes).toHaveLength(0);
  });

  it('rejects invalid recovered records instead of returning them', async () => {
    const store = new MemoryPreferencesStore();
    store.values.set(POMODORO_PREFERENCES_STORAGE_KEY, {
      ...validPreferences,
      longBreakDurationMinutes: 181,
    });
    const repository = new PomodoroPreferencesRepository(store);

    await expect(repository.read()).rejects.toMatchObject({
      name: 'PomodoroPreferencesStorageError',
      code: 'record-invalid',
    });
  });

  it('communicates read and write failures without treating data as saved', async () => {
    const store = new MemoryPreferencesStore();
    const existingPreferences = { ...validPreferences, focusDurationMinutes: 20 };
    store.values.set(POMODORO_PREFERENCES_STORAGE_KEY, existingPreferences);
    store.writeError = new Error('quota exceeded');
    const repository = new PomodoroPreferencesRepository(store);

    await expect(repository.save(validPreferences)).rejects.toMatchObject({
      name: 'PomodoroPreferencesStorageError',
      code: 'write-failed',
    });
    expect(store.values.get(POMODORO_PREFERENCES_STORAGE_KEY)).toEqual(
      existingPreferences,
    );

    store.readError = new Error('read unavailable');
    await expect(repository.read()).rejects.toMatchObject({
      name: 'PomodoroPreferencesStorageError',
      code: 'read-failed',
    });
  });

  it('exposes IndexedDB unavailability to the consumer', async () => {
    const store = new MemoryPreferencesStore();
    store.readError = new IndexedDbError(
      'unavailable',
      'IndexedDB is not available.',
    );
    const repository = new PomodoroPreferencesRepository(store);

    await expect(repository.read()).rejects.toMatchObject({
      name: 'PomodoroPreferencesStorageError',
      code: 'unavailable',
    });
  });

  it('exports a typed storage error for callers', () => {
    const error = new PomodoroPreferencesStorageError(
      'record-invalid',
      'Invalid stored preferences.',
    );

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('record-invalid');
  });
});
