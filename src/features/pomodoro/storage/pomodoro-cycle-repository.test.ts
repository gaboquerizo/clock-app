import { beforeEach, describe, expect, it, vi } from 'vitest';

const { openIndexedDbMock, runIndexedDbRequestMock } = vi.hoisted(() => ({
  openIndexedDbMock: vi.fn(),
  runIndexedDbRequestMock: vi.fn(),
}));

vi.mock('@/core/storage/indexed-db', () => ({
  IndexedDbError: class MockIndexedDbError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  openIndexedDb: openIndexedDbMock,
  runIndexedDbRequest: runIndexedDbRequestMock,
}));

import { IndexedDbError } from '@/core/storage/indexed-db';
import {
  PomodoroCycleRepository,
  PomodoroCycleStorageError,
} from './pomodoro-cycle-repository';
import {
  POMODORO_CYCLE_DATABASE_NAME,
  POMODORO_CYCLE_DATABASE_VERSION,
  POMODORO_CYCLE_RECORD_ID,
  POMODORO_CYCLE_STORE_NAME,
  toPomodoroCycleRecord,
  type PomodoroCycleSnapshot,
} from './pomodoro-cycle-record';

const database = {} as IDBDatabase;

const snapshot: PomodoroCycleSnapshot = {
  cycle: {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount: 1,
    currentBlock: {
      id: 'short-break-one',
      type: 'short-break',
      durationMs: 5 * 60_000,
    },
  },
  lastProcessedCompletion: {
    cycleId: 'cycle-one',
    blockExecutionId: 'focus-one',
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  openIndexedDbMock.mockResolvedValue(database);
});

describe('PomodoroCycleRepository', () => {
  it('reads and validates the singleton cycle record', async () => {
    const record = toPomodoroCycleRecord(snapshot);

    if (!record.ok) {
      throw new Error('Unable to create a Pomodoro cycle test record.');
    }

    runIndexedDbRequestMock.mockResolvedValueOnce(record.value);
    const repository = new PomodoroCycleRepository();

    await expect(repository.read()).resolves.toEqual(snapshot);
    expect(openIndexedDbMock).toHaveBeenCalledWith({
      name: POMODORO_CYCLE_DATABASE_NAME,
      version: POMODORO_CYCLE_DATABASE_VERSION,
      onUpgrade: expect.any(Function),
    });
    const openOptions = openIndexedDbMock.mock.calls[0][0] as {
      onUpgrade: (
        database: IDBDatabase,
        oldVersion: number,
        newVersion: number | null,
        transaction: IDBTransaction | null,
      ) => void;
    };
    const createObjectStore = vi.fn().mockReturnValue({});
    openOptions.onUpgrade(
      { createObjectStore } as unknown as IDBDatabase,
      0,
      POMODORO_CYCLE_DATABASE_VERSION,
      null,
    );
    expect(createObjectStore).toHaveBeenCalledWith(
      POMODORO_CYCLE_STORE_NAME,
      { keyPath: 'id' },
    );
    createObjectStore.mockClear();
    openOptions.onUpgrade(
      { createObjectStore } as unknown as IDBDatabase,
      POMODORO_CYCLE_DATABASE_VERSION,
      POMODORO_CYCLE_DATABASE_VERSION,
      null,
    );
    expect(createObjectStore).not.toHaveBeenCalled();
    expect(runIndexedDbRequestMock).toHaveBeenCalledWith(
      database,
      POMODORO_CYCLE_STORE_NAME,
      'readonly',
      expect.any(Function),
    );

    const get = vi.fn().mockReturnValue({});
    const createRequest = runIndexedDbRequestMock.mock.calls[0][3] as (
      store: IDBObjectStore,
    ) => IDBRequest<unknown>;
    createRequest({ get } as unknown as IDBObjectStore);
    expect(get).toHaveBeenCalledWith(POMODORO_CYCLE_RECORD_ID);
  });

  it('writes the cycle and completion receipt in one readwrite request', async () => {
    runIndexedDbRequestMock.mockResolvedValueOnce(POMODORO_CYCLE_RECORD_ID);
    const repository = new PomodoroCycleRepository();

    await expect(repository.update(snapshot)).resolves.toBeUndefined();
    expect(runIndexedDbRequestMock).toHaveBeenCalledTimes(1);
    expect(runIndexedDbRequestMock).toHaveBeenCalledWith(
      database,
      POMODORO_CYCLE_STORE_NAME,
      'readwrite',
      expect.any(Function),
    );

    const put = vi.fn().mockReturnValue({});
    const createRequest = runIndexedDbRequestMock.mock.calls[0][3] as (
      store: IDBObjectStore,
    ) => IDBRequest<IDBValidKey>;
    createRequest({ put } as unknown as IDBObjectStore);

    const record = toPomodoroCycleRecord(snapshot);
    expect(put).toHaveBeenCalledWith(record.ok ? record.value : undefined);
  });

  it('returns undefined when no record exists', async () => {
    runIndexedDbRequestMock.mockResolvedValueOnce(undefined);
    const repository = new PomodoroCycleRepository();

    await expect(repository.read()).resolves.toBeUndefined();
  });

  it('rejects invalid records and invalid state before storage access', async () => {
    runIndexedDbRequestMock.mockResolvedValueOnce({
      id: POMODORO_CYCLE_RECORD_ID,
      status: 'ready',
      cycleId: 'cycle-one',
      completedFocusCount: 5,
      currentBlock: snapshot.cycle.currentBlock,
      lastProcessedCompletion: null,
    });
    const repository = new PomodoroCycleRepository();

    await expect(repository.read()).rejects.toMatchObject({
      name: 'PomodoroCycleStorageError',
      code: 'record-invalid',
    });
    await expect(
      repository.update({
        ...snapshot,
        cycle: { ...snapshot.cycle, completedFocusCount: 5 },
      }),
    ).rejects.toMatchObject({
      name: 'PomodoroCycleStorageError',
      code: 'record-invalid',
    });
    expect(runIndexedDbRequestMock).toHaveBeenCalledTimes(1);
  });

  it('maps IndexedDB failures into errors for the consumer', async () => {
    openIndexedDbMock.mockRejectedValueOnce(
      new IndexedDbError('unavailable', 'IndexedDB unavailable.'),
    );
    const repository = new PomodoroCycleRepository();

    await expect(repository.read()).rejects.toMatchObject({
      name: 'PomodoroCycleStorageError',
      code: 'unavailable',
    });

    openIndexedDbMock.mockResolvedValueOnce(database);
    runIndexedDbRequestMock.mockRejectedValueOnce(new Error('read failure'));
    const anotherRepository = new PomodoroCycleRepository();

    await expect(anotherRepository.read()).rejects.toMatchObject({
      name: 'PomodoroCycleStorageError',
      code: 'read-failed',
    });
    expect(new PomodoroCycleStorageError('update-failed', 'Failure')).toBeInstanceOf(
      Error,
    );
  });
});
