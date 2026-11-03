import {
  IndexedDbError,
  openIndexedDb,
  runIndexedDbRequest,
} from '@/core/storage/indexed-db';
import { validateStopwatch } from '@/features/stopwatch/domain/stopwatch.rules';
import type { Stopwatch } from '@/features/stopwatch/domain/stopwatch.types';
import {
  fromStopwatchRecord,
  STOPWATCH_DATABASE_NAME,
  STOPWATCH_DATABASE_VERSION,
  STOPWATCH_RECORD_ID,
  STOPWATCH_STORE_NAME,
  toStopwatchRecord,
} from '@/features/stopwatch/storage/stopwatch-record';

export type StopwatchStorageErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'read-failed'
  | 'update-failed'
  | 'record-invalid';

export class StopwatchStorageError extends Error {
  readonly code: StopwatchStorageErrorCode;

  constructor(
    code: StopwatchStorageErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'StopwatchStorageError';
    this.code = code;
  }
}

type StorageOperation = 'open' | 'read' | 'update';

function mapDatabaseError(
  operation: StorageOperation,
  error: unknown,
): StopwatchStorageError {
  if (error instanceof StopwatchStorageError) {
    return error;
  }

  if (error instanceof IndexedDbError && error.code === 'unavailable') {
    return new StopwatchStorageError(
      'unavailable',
      'Stopwatch storage is not available in this environment.',
      { cause: error },
    );
  }

  const code: StopwatchStorageErrorCode =
    operation === 'open'
      ? 'open-failed'
      : (`${operation}-failed` as StopwatchStorageErrorCode);

  return new StopwatchStorageError(
    code,
    `Unable to ${operation} Stopwatch state in IndexedDB.`,
    { cause: error },
  );
}

function invalidRecordError(): StopwatchStorageError {
  return new StopwatchStorageError(
    'record-invalid',
    'The stored Stopwatch record failed domain validation.',
  );
}

export class StopwatchRepository {
  private database?: Promise<IDBDatabase>;

  constructor(private readonly databaseName = STOPWATCH_DATABASE_NAME) {}

  async read(): Promise<Stopwatch | undefined> {
    let record: unknown;

    try {
      const database = await this.getDatabase();
      record = await runIndexedDbRequest<unknown>(
        database,
        STOPWATCH_STORE_NAME,
        'readonly',
        (store) => store.get(STOPWATCH_RECORD_ID) as IDBRequest<unknown>,
      );
    } catch (error) {
      throw mapDatabaseError('read', error);
    }

    if (record === undefined) {
      return undefined;
    }

    const result = fromStopwatchRecord(record);

    if (!result.ok) {
      throw invalidRecordError();
    }

    return result.value;
  }

  async update(stopwatch: Stopwatch): Promise<void> {
    const result = validateStopwatch(stopwatch);

    if (!result.ok) {
      throw invalidRecordError();
    }

    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<IDBValidKey>(
        database,
        STOPWATCH_STORE_NAME,
        'readwrite',
        (store) => store.put(toStopwatchRecord(result.value)),
      );
    } catch (error) {
      throw mapDatabaseError('update', error);
    }
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.database === undefined) {
      this.database = openIndexedDb({
        name: this.databaseName,
        version: STOPWATCH_DATABASE_VERSION,
        onUpgrade: (database, oldVersion) => {
          if (oldVersion < 1) {
            database.createObjectStore(STOPWATCH_STORE_NAME, {
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
}

export const stopwatchRepository = new StopwatchRepository();
