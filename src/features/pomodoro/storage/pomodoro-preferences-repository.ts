import { appPreferencesRepository } from '@/core/storage/app-preferences.repository';
import { IndexedDbError } from '@/core/storage/indexed-db';
import { validatePomodoroPreferences } from '../domain/pomodoro-preferences';
import type { PomodoroPreferences } from '../domain/pomodoro.types';
import {
  fromPomodoroPreferencesRecord,
  POMODORO_PREFERENCES_STORAGE_KEY,
  toPomodoroPreferencesRecord,
} from './pomodoro-preferences-record';

export type PomodoroPreferencesStorageErrorCode =
  | 'unavailable'
  | 'read-failed'
  | 'write-failed'
  | 'record-invalid'
  | 'preferences-invalid';

export class PomodoroPreferencesStorageError extends Error {
  readonly code: PomodoroPreferencesStorageErrorCode;

  constructor(
    code: PomodoroPreferencesStorageErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'PomodoroPreferencesStorageError';
    this.code = code;
  }
}

export type PomodoroPreferencesStore = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
};

function mapStorageError(
  operation: 'read' | 'write',
  error: unknown,
): PomodoroPreferencesStorageError {
  if (error instanceof PomodoroPreferencesStorageError) {
    return error;
  }

  if (error instanceof IndexedDbError && error.code === 'unavailable') {
    return new PomodoroPreferencesStorageError(
      'unavailable',
      'Pomodoro preferences storage is not available in this environment.',
      { cause: error },
    );
  }

  return new PomodoroPreferencesStorageError(
    operation === 'read' ? 'read-failed' : 'write-failed',
    `Unable to ${operation} Pomodoro preferences.`,
    { cause: error },
  );
}

export class PomodoroPreferencesRepository {
  constructor(
    private readonly store: PomodoroPreferencesStore = appPreferencesRepository,
  ) {}

  async read(): Promise<PomodoroPreferences | undefined> {
    let record: unknown;

    try {
      record = await this.store.get<unknown>(POMODORO_PREFERENCES_STORAGE_KEY);
    } catch (error) {
      throw mapStorageError('read', error);
    }

    if (record === undefined) {
      return undefined;
    }

    const preferences = fromPomodoroPreferencesRecord(record);

    if (!preferences.ok) {
      throw new PomodoroPreferencesStorageError(
        'record-invalid',
        'Stored Pomodoro preferences failed domain validation.',
      );
    }

    return preferences.value;
  }

  async save(preferences: PomodoroPreferences): Promise<void> {
    const validation = validatePomodoroPreferences(preferences);

    if (!validation.ok) {
      throw new PomodoroPreferencesStorageError(
        'preferences-invalid',
        'Pomodoro preferences failed domain validation.',
      );
    }

    try {
      await this.store.set(
        POMODORO_PREFERENCES_STORAGE_KEY,
        toPomodoroPreferencesRecord(validation.value),
      );
    } catch (error) {
      throw mapStorageError('write', error);
    }
  }
}

export const pomodoroPreferencesRepository =
  new PomodoroPreferencesRepository();
