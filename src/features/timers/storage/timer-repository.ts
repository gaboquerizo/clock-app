import {
  IndexedDbError,
  openIndexedDb,
  runIndexedDbRequest,
} from '@/core/storage/indexed-db';
import { hasDuplicateTimerId } from '@/features/timers/domain/timer.rules';
import { validateTimer } from '@/features/timers/domain/timer';

import type {
  Timer,
  TimerResult,
} from '@/features/timers/domain/timer.types';

import {
  fromTimerRecord,
  TIMERS_DATABASE_NAME,
  TIMERS_DATABASE_VERSION,
  TIMERS_STORE_NAME,
  toTimerRecord,
} from '@/features/timers/storage/timer-record';

export type TimerStorageErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'read-failed'
  | 'write-failed'
  | 'update-failed'
  | 'delete-failed'
  | 'record-invalid'
  | 'conflict'
  | 'not-found';

export class TimerStorageError extends Error {
  readonly code: TimerStorageErrorCode;
  readonly timerId?: string;

  constructor(
    code: TimerStorageErrorCode,
    message: string,
    options?: { cause?: unknown; timerId?: string },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'TimerStorageError';
    this.code = code;
    this.timerId = options?.timerId;
  }
}

type StorageOperation = 'open' | 'read' | 'write' | 'update' | 'delete';

function mapDatabaseError(
  operation: StorageOperation,
  error: unknown,
  timerId?: string,
): TimerStorageError {
  if (error instanceof TimerStorageError) {
    return error;
  }

  if (error instanceof IndexedDbError && error.code === 'unavailable') {
    return new TimerStorageError(
      'unavailable',
      'Timer storage is not available in this environment.',
      { cause: error, timerId },
    );
  }

  const databaseCause =
    error instanceof IndexedDbError ? error.cause : undefined;
  const databaseCauseName =
    typeof databaseCause === 'object' && databaseCause !== null
      ? Reflect.get(databaseCause, 'name')
      : undefined;

  if (databaseCauseName === 'ConstraintError') {
    return new TimerStorageError(
      'conflict',
      'A timer with the same identity already exists.',
      { cause: error, timerId },
    );
  }

  const code: TimerStorageErrorCode =
    operation === 'open'
      ? 'open-failed'
      : (`${operation}-failed` as TimerStorageErrorCode);

  return new TimerStorageError(
    code,
    `Unable to ${operation} timers in IndexedDB.`,
    { cause: error, timerId },
  );
}

function invalidRecordError(timerId?: string): TimerStorageError {
  return new TimerStorageError(
    'record-invalid',
    'A timer record failed domain validation.',
    { timerId },
  );
}

export class TimerRepository {
  private database?: Promise<IDBDatabase>;

  constructor(private readonly databaseName = TIMERS_DATABASE_NAME) {}

  async list(): Promise<Timer[]> {
    let records: unknown[];

    try {
      const database = await this.getDatabase();
      records = await runIndexedDbRequest<unknown[]>(
        database,
        TIMERS_STORE_NAME,
        'readonly',
        (store) => store.getAll() as IDBRequest<unknown[]>,
      );
    } catch (error) {
      throw mapDatabaseError('read', error);
    }

    return records.map((record) => this.deserialize(record));
  }

  async get(id: string): Promise<Timer | undefined> {
    let record: unknown;

    try {
      const database = await this.getDatabase();
      record = await runIndexedDbRequest<unknown>(
        database,
        TIMERS_STORE_NAME,
        'readonly',
        (store) => store.get(id) as IDBRequest<unknown>,
      );
    } catch (error) {
      throw mapDatabaseError('read', error, id);
    }

    return record === undefined ? undefined : this.deserialize(record, id);
  }

  async create(timer: Timer): Promise<void> {
    const validatedTimer = this.validateForWrite(timer);

    if (!validatedTimer.ok) {
      throw invalidRecordError(timer.id);
    }

    const existingTimers = await this.list();

    if (hasDuplicateTimerId(existingTimers, validatedTimer.value.id)) {
      throw new TimerStorageError(
        'conflict',
        'A timer with the same identity already exists.',
        { timerId: timer.id },
      );
    }

    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<IDBValidKey>(
        database,
        TIMERS_STORE_NAME,
        'readwrite',
        (store) => store.add(toTimerRecord(validatedTimer.value)),
      );
    } catch (error) {
      throw mapDatabaseError('write', error, timer.id);
    }
  }

  async update(timer: Timer): Promise<void> {
    const validatedTimer = this.validateForWrite(timer);

    if (!validatedTimer.ok) {
      throw invalidRecordError(timer.id);
    }

    const existingTimer = await this.get(validatedTimer.value.id);

    if (existingTimer === undefined) {
      throw new TimerStorageError(
        'not-found',
        'The timer to update does not exist.',
        { timerId: timer.id },
      );
    }

    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<IDBValidKey>(
        database,
        TIMERS_STORE_NAME,
        'readwrite',
        (store) => store.put(toTimerRecord(validatedTimer.value)),
      );
    } catch (error) {
      throw mapDatabaseError('update', error, timer.id);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<undefined>(
        database,
        TIMERS_STORE_NAME,
        'readwrite',
        (store) => store.delete(id) as IDBRequest<undefined>,
      );
    } catch (error) {
      throw mapDatabaseError('delete', error, id);
    }
  }

  private validateForWrite(timer: Timer): TimerResult<Timer> {
    return validateTimer(timer);
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.database === undefined) {
      this.database = openIndexedDb({
        name: this.databaseName,
        version: TIMERS_DATABASE_VERSION,
        onUpgrade: (database, oldVersion) => {
          if (oldVersion < 1) {
            database.createObjectStore(TIMERS_STORE_NAME, {
              keyPath: 'id',
            });
          }
        },
      }).catch((error: unknown) => {
        this.database = undefined;
        throw mapDatabaseError('open', error);
      });
    }

    return this.database;
  }

  private deserialize(value: unknown, timerId?: string): Timer {
    const result = fromTimerRecord(value);

    if (!result.ok) {
      throw invalidRecordError(timerId);
    }

    return result.value;
  }
}

export const timerRepository = new TimerRepository();
