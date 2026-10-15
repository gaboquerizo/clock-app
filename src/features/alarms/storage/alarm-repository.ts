import {
  IndexedDbError,
  openIndexedDb,
  runIndexedDbRequest,
} from '../../../core/storage/indexed-db';
import {
  hasDuplicateAlarmId,
  hasDuplicateAlarmTime,
  validateAlarm,
} from '../domain/alarm.rules';
import type { Alarm, AlarmResult } from '../domain/alarm.types';
import {
  ALARMS_DATABASE_NAME,
  ALARMS_DATABASE_VERSION,
  ALARMS_STORE_NAME,
  fromAlarmRecord,
  type AlarmRecord,
  toAlarmRecord,
} from './alarm-record';

export type AlarmStorageErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'read-failed'
  | 'write-failed'
  | 'update-failed'
  | 'delete-failed'
  | 'record-invalid'
  | 'conflict'
  | 'not-found';

export class AlarmStorageError extends Error {
  readonly code: AlarmStorageErrorCode;
  readonly alarmId?: string;

  constructor(
    code: AlarmStorageErrorCode,
    message: string,
    options?: { cause?: unknown; alarmId?: string },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AlarmStorageError';
    this.code = code;
    this.alarmId = options?.alarmId;
  }
}

function mapDatabaseError(
  operation: 'open' | 'read' | 'write' | 'update' | 'delete',
  error: unknown,
  alarmId?: string,
): AlarmStorageError {
  if (error instanceof AlarmStorageError) {
    return error;
  }

  if (error instanceof IndexedDbError && error.code === 'unavailable') {
    return new AlarmStorageError(
      'unavailable',
      'Alarm storage is not available in this environment.',
      { cause: error, alarmId },
    );
  }

  const databaseCause =
    error instanceof IndexedDbError ? error.cause : undefined;

  if (
    databaseCause instanceof DOMException &&
    databaseCause.name === 'ConstraintError'
  ) {
    return new AlarmStorageError(
      'conflict',
      'An alarm conflicts with an existing persisted record.',
      { cause: error, alarmId },
    );
  }

  const code: AlarmStorageErrorCode =
    operation === 'open'
      ? 'open-failed'
      : (`${operation}-failed` as AlarmStorageErrorCode);

  return new AlarmStorageError(
    code,
    `Unable to ${operation} alarms in IndexedDB.`,
    { cause: error, alarmId },
  );
}

function invalidRecordError(alarmId?: string): AlarmStorageError {
  return new AlarmStorageError(
    'record-invalid',
    'An alarm record failed domain validation.',
    { alarmId },
  );
}

export class AlarmRepository {
  private database?: Promise<IDBDatabase>;
  private readonly databaseName: string;

  constructor(databaseName = ALARMS_DATABASE_NAME) {
    this.databaseName = databaseName;
  }

  async list(): Promise<Alarm[]> {
    let records: AlarmRecord[];

    try {
      const database = await this.getDatabase();
      records = await runIndexedDbRequest<AlarmRecord[]>(
        database,
        ALARMS_STORE_NAME,
        'readonly',
        (store) => store.getAll() as IDBRequest<AlarmRecord[]>,
      );
    } catch (error) {
      throw mapDatabaseError('read', error);
    }

    return records.map((record) => this.deserialize(record));
  }

  async get(id: string): Promise<Alarm | undefined> {
    let record: AlarmRecord | undefined;

    try {
      const database = await this.getDatabase();
      record = await runIndexedDbRequest<AlarmRecord | undefined>(
        database,
        ALARMS_STORE_NAME,
        'readonly',
        (store) => store.get(id) as IDBRequest<AlarmRecord | undefined>,
      );
    } catch (error) {
      throw mapDatabaseError('read', error, id);
    }

    return record === undefined ? undefined : this.deserialize(record, id);
  }

  async create(alarm: Alarm): Promise<void> {
    const validatedAlarm = this.validateForWrite(alarm);

    if (!validatedAlarm.ok) {
      throw invalidRecordError(alarm.id);
    }

    const existingAlarms = await this.list();

    if (hasDuplicateAlarmId(existingAlarms, validatedAlarm.value.id)) {
      throw new AlarmStorageError(
        'conflict',
        'An alarm with the same identity already exists.',
        { alarmId: alarm.id },
      );
    }

    if (hasDuplicateAlarmTime(existingAlarms, validatedAlarm.value.time)) {
      throw new AlarmStorageError(
        'conflict',
        'An alarm with the same configured time already exists.',
        { alarmId: alarm.id },
      );
    }

    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<IDBValidKey>(
        database,
        ALARMS_STORE_NAME,
        'readwrite',
        (store) => store.add(toAlarmRecord(validatedAlarm.value)),
      );
    } catch (error) {
      throw mapDatabaseError('write', error, alarm.id);
    }
  }

  async update(alarm: Alarm): Promise<void> {
    const validatedAlarm = this.validateForWrite(alarm);

    if (!validatedAlarm.ok) {
      throw invalidRecordError(alarm.id);
    }

    const existingAlarm = await this.get(validatedAlarm.value.id);

    if (existingAlarm === undefined) {
      throw new AlarmStorageError(
        'not-found',
        'The alarm to update does not exist.',
        { alarmId: alarm.id },
      );
    }

    const existingAlarms = await this.list();

    if (
      hasDuplicateAlarmTime(
        existingAlarms,
        validatedAlarm.value.time,
        validatedAlarm.value.id,
      )
    ) {
      throw new AlarmStorageError(
        'conflict',
        'An alarm with the same configured time already exists.',
        { alarmId: alarm.id },
      );
    }

    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<IDBValidKey>(
        database,
        ALARMS_STORE_NAME,
        'readwrite',
        (store) => store.put(toAlarmRecord(validatedAlarm.value)),
      );
    } catch (error) {
      throw mapDatabaseError('update', error, alarm.id);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const database = await this.getDatabase();
      await runIndexedDbRequest<undefined>(
        database,
        ALARMS_STORE_NAME,
        'readwrite',
        (store) => store.delete(id) as IDBRequest<undefined>,
      );
    } catch (error) {
      throw mapDatabaseError('delete', error, id);
    }
  }

  private validateForWrite(alarm: Alarm): AlarmResult<Alarm> {
    return validateAlarm(alarm);
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.database === undefined) {
      this.database = openIndexedDb({
        name: this.databaseName,
        version: ALARMS_DATABASE_VERSION,
        onUpgrade: (database, oldVersion) => {
          if (oldVersion < 1) {
            const store = database.createObjectStore(ALARMS_STORE_NAME, {
              keyPath: 'id',
            });

            store.createIndex('time', 'time', { unique: true });
            store.createIndex('order', 'order', { unique: false });
          }
        },
      }).catch((error: unknown) => {
        throw mapDatabaseError('open', error);
      });
    }

    return this.database as Promise<IDBDatabase>;
  }

  private deserialize(record: AlarmRecord, alarmId = record.id): Alarm {
    const alarm = fromAlarmRecord(record);

    if (!alarm.ok) {
      throw invalidRecordError(alarmId);
    }

    return alarm.value;
  }
}
