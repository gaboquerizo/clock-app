export type IndexedDbErrorCode =
  | 'unavailable'
  | 'open-failed'
  | 'upgrade-failed'
  | 'blocked'
  | 'request-failed'
  | 'transaction-failed'
  | 'transaction-aborted';

export class IndexedDbError extends Error {
  readonly code: IndexedDbErrorCode;

  constructor(code: IndexedDbErrorCode, message: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'IndexedDbError';
    this.code = code;
  }
}

export type IndexedDbUpgradeHandler = (
  database: IDBDatabase,
  oldVersion: number,
  newVersion: number | null,
  transaction: IDBTransaction | null,
) => void;

export type OpenIndexedDbOptions = {
  name: string;
  version: number;
  onUpgrade: IndexedDbUpgradeHandler;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function openIndexedDb(
  options: OpenIndexedDbOptions,
): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(
      new IndexedDbError(
        'unavailable',
        'IndexedDB is not available in this environment.',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let request: IDBOpenDBRequest;

    const rejectOnce = (error: IndexedDbError) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    try {
      request = indexedDB.open(options.name, options.version);
    } catch (error) {
      rejectOnce(
        new IndexedDbError(
          'open-failed',
          getErrorMessage(error, 'Unable to open IndexedDB.'),
          error,
        ),
      );
      return;
    }

    request.onupgradeneeded = (event) => {
      try {
        const versionEvent = event as IDBVersionChangeEvent;

        options.onUpgrade(
          request.result,
          versionEvent.oldVersion,
          versionEvent.newVersion,
          request.transaction,
        );
      } catch (error) {
        request.transaction?.abort();
        rejectOnce(
          new IndexedDbError(
            'upgrade-failed',
            getErrorMessage(error, 'Unable to upgrade IndexedDB.'),
            error,
          ),
        );
      }
    };

    request.onerror = () => {
      rejectOnce(
        new IndexedDbError(
          'open-failed',
          getErrorMessage(request.error, 'Unable to open IndexedDB.'),
          request.error,
        ),
      );
    };

    request.onblocked = () => {
      rejectOnce(
        new IndexedDbError(
          'blocked',
          'IndexedDB upgrade is blocked by another open connection.',
        ),
      );
    };

    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }

      const database = request.result;
      database.onversionchange = () => database.close();
      settled = true;
      resolve(database);
    };
  });
}

export function runIndexedDbRequest<T>(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  createRequest: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let requestCompleted = false;
    let settled = false;
    let requestResult: T;
    let transaction: IDBTransaction;

    const rejectOnce = (error: IndexedDbError) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    };

    try {
      transaction = database.transaction(storeName, mode);
      const request = createRequest(transaction.objectStore(storeName));

      request.onsuccess = () => {
        requestCompleted = true;
        requestResult = request.result;
      };

      request.onerror = () => {
        rejectOnce(
          new IndexedDbError(
            'request-failed',
            getErrorMessage(request.error, 'IndexedDB request failed.'),
            request.error,
          ),
        );
      };

      transaction.oncomplete = () => {
        if (!requestCompleted) {
          rejectOnce(
            new IndexedDbError(
              'transaction-failed',
              'IndexedDB transaction completed without a request result.',
            ),
          );
          return;
        }

        if (!settled) {
          settled = true;
          resolve(requestResult);
        }
      };

      transaction.onerror = () => {
        rejectOnce(
          new IndexedDbError(
            'transaction-failed',
            getErrorMessage(
              transaction.error,
              'IndexedDB transaction failed.',
            ),
            transaction.error,
          ),
        );
      };

      transaction.onabort = () => {
        rejectOnce(
          new IndexedDbError(
            'transaction-aborted',
            'IndexedDB transaction was aborted.',
            transaction.error,
          ),
        );
      };
    } catch (error) {
      rejectOnce(
        new IndexedDbError(
          'transaction-failed',
          getErrorMessage(error, 'Unable to start IndexedDB transaction.'),
          error,
        ),
      );
    }
  });
}
