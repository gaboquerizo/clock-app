import {
  IndexedDbError,
  openIndexedDb,
  runIndexedDbRequest,
} from '@/core/storage/indexed-db';
import {
  fromPomodoroCycleRecord,
  POMODORO_CYCLE_DATABASE_NAME,
  POMODORO_CYCLE_DATABASE_VERSION,
  POMODORO_CYCLE_RECORD_ID,
  POMODORO_CYCLE_STORE_NAME,
  toPomodoroCycleRecord,
  type PomodoroCycleSnapshot,
  type PomodoroCycleRecord,
} from './pomodoro-cycle-record';

export type PomodoroCycleStorageErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'read-failed'
  | 'update-failed'
  | 'record-invalid';

export class PomodoroCycleStorageError extends Error {
  readonly code: PomodoroCycleStorageErrorCode;

  constructor(
    code: PomodoroCycleStorageErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'PomodoroCycleStorageError';
    this.code = code;
  }
}

type StorageOperation = 'open' | 'read' | 'update';

function mapDatabaseError(
  operation: StorageOperation,
  error: unknown,
): PomodoroCycleStorageError {
  if (error instanceof PomodoroCycleStorageError) {
    return error;
  }

  if (error instanceof IndexedDbError && error.code === 'unavailable') {
    return new PomodoroCycleStorageError(
      'unavailable',
      'Pomodoro cycle storage is not available in this environment.',
      { cause: error },
    );
  }

  const code: PomodoroCycleStorageErrorCode =
    operation === 'open'
      ? 'open-failed'
      : operation === 'read'
        ? 'read-failed'
        : 'update-failed';

  return new PomodoroCycleStorageError(
    code,
    `Unable to ${operation} the Pomodoro cycle in IndexedDB.`,
    { cause: error },
  );
}

function invalidRecordError(): PomodoroCycleStorageError {
  return new PomodoroCycleStorageError(
    'record-invalid',
    'The stored Pomodoro cycle record failed validation.',
  );
}

export class PomodoroCycleRepository {
  private database?: Promise<IDBDatabase>;

  constructor(
    private readonly databaseName = POMODORO_CYCLE_DATABASE_NAME,
  ) {}

  async read(): Promise<PomodoroCycleSnapshot | undefined> {
    let record: unknown;

    try {
      const database = await this.getDatabase();
      record = await runIndexedDbRequest<unknown>(
        database,
        POMODORO_CYCLE_STORE_NAME,
        'readonly',
        (store) => store.get(POMODORO_CYCLE_RECORD_ID) as IDBRequest<unknown>,
      );
    } catch (error) {
      throw mapDatabaseError('read', error);
    }

    if (record === undefined) {
      return undefined;
    }

    const result = fromPomodoroCycleRecord(record);

    if (!result.ok) {
      throw invalidRecordError();
    }

    return result.value;
  }

  async update(snapshot: PomodoroCycleSnapshot): Promise<void> {
    const result = toPomodoroCycleRecord(snapshot);

    if (!result.ok) {
      throw invalidRecordError();
    }

    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<IDBValidKey>(
        database,
        POMODORO_CYCLE_STORE_NAME,
        'readwrite',
        (store) => store.put(result.value satisfies PomodoroCycleRecord),
      );
    } catch (error) {
      throw mapDatabaseError('update', error);
    }
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.database === undefined) {
      this.database = openIndexedDb({
        name: this.databaseName,
        version: POMODORO_CYCLE_DATABASE_VERSION,
        onUpgrade: (database, oldVersion) => {
          if (oldVersion < 1) {
            database.createObjectStore(POMODORO_CYCLE_STORE_NAME, {
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

export const pomodoroCycleRepository = new PomodoroCycleRepository();
