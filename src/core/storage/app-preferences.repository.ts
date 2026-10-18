import { openIndexedDb, runIndexedDbRequest } from './indexed-db';

const DATABASE_NAME = 'clock-app-preferences';
const DATABASE_VERSION = 1;
const PREFERENCES_STORE_NAME = 'preferences';

type PreferenceRecord = {
  key: string;
  value: unknown;
};

export class AppPreferencesRepository {
  private database?: Promise<IDBDatabase>;

  async get<T>(key: string): Promise<T | undefined> {
    const database = await this.getDatabase();
    const record = await runIndexedDbRequest<PreferenceRecord | undefined>(
      database,
      PREFERENCES_STORE_NAME,
      'readonly',
      (store) =>
        store.get(key) as IDBRequest<PreferenceRecord | undefined>,
    );

    return record?.value as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const database = await this.getDatabase();

    await runIndexedDbRequest<IDBValidKey>(
      database,
      PREFERENCES_STORE_NAME,
      'readwrite',
      (store) => store.put({ key, value } satisfies PreferenceRecord),
    );
  }

  private getDatabase(): Promise<IDBDatabase> {
    if (this.database === undefined) {
      this.database = openIndexedDb({
        name: DATABASE_NAME,
        version: DATABASE_VERSION,
        onUpgrade: (database, oldVersion) => {
          if (oldVersion < 1) {
            database.createObjectStore(PREFERENCES_STORE_NAME, {
              keyPath: 'key',
            });
          }
        },
      }).catch((error: unknown) => {
        this.database = undefined;
        throw error;
      });
    }

    return this.database;
  }
}

export const appPreferencesRepository = new AppPreferencesRepository();
