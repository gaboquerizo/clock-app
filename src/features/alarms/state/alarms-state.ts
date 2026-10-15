import { createStore } from 'solid-js/store';

import {
  createAlarm,
  transitionAlarm,
  updateAlarm,
} from '../domain/alarm';
import type {
  Alarm,
  AlarmDomainError,
  AlarmResult,
  AlarmTransition,
  UpdateAlarmInput,
} from '../domain/alarm.types';
import {
  AlarmRepository,
  AlarmStorageError,
} from '../storage/alarm-repository';

export type AlarmsStateStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'error';

export type AlarmsOperation =
  | 'load'
  | 'create'
  | 'update'
  | 'remove'
  | 'enable'
  | 'disable';

export type AlarmsStateError = {
  operation: AlarmsOperation;
  code: string;
  message: string;
  cause?: unknown;
};

export type AlarmsState = {
  alarms: Alarm[];
  status: AlarmsStateStatus;
  error: AlarmsStateError | undefined;
};

export type AlarmRepositoryPort = {
  list(): Promise<Alarm[]>;
  create(alarm: Alarm): Promise<void>;
  update(alarm: Alarm): Promise<void>;
  remove(id: string): Promise<void>;
};

export type CreateAlarmParams = {
  time: string;
  label?: string;
};

export type AlarmsStateOptions = {
  repository?: AlarmRepositoryPort;
  now?: () => number;
  createId?: () => string;
};

export type AlarmsActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: AlarmsStateError };

export type AlarmsActions = {
  load(): Promise<AlarmsActionResult<Alarm[]>>;
  create(input: CreateAlarmParams): Promise<AlarmsActionResult<Alarm>>;
  update(
    id: string,
    input: UpdateAlarmInput,
  ): Promise<AlarmsActionResult<Alarm>>;
  remove(id: string): Promise<AlarmsActionResult<void>>;
  enable(id: string): Promise<AlarmsActionResult<Alarm>>;
  disable(id: string): Promise<AlarmsActionResult<Alarm>>;
  clearError(): void;
};

export type AlarmsStateController = {
  state: AlarmsState;
  actions: AlarmsActions;
};

function defaultCreateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function sortAlarms(alarms: readonly Alarm[]): Alarm[] {
  return [...alarms].sort((first, second) => {
    if (first.order !== second.order) {
      return first.order - second.order;
    }

    return first.time.localeCompare(second.time);
  });
}

function nextAlarmOrder(alarms: readonly Alarm[]): number {
  return alarms.reduce(
    (highestOrder, alarm) => Math.max(highestOrder, alarm.order),
    -1,
  ) + 1;
}

function createStorageError(
  operation: AlarmsOperation,
  error: unknown,
): AlarmsStateError {
  if (error instanceof AlarmStorageError) {
    return {
      operation,
      code: error.code,
      message: error.message,
      cause: error,
    };
  }

  if (error instanceof Error) {
    return {
      operation,
      code: 'unknown',
      message: error.message,
      cause: error,
    };
  }

  return {
    operation,
    code: 'unknown',
    message: `Unable to ${operation} alarms.`,
    cause: error,
  };
}

function createDomainError(
  operation: AlarmsOperation,
  error: AlarmDomainError,
): AlarmsStateError {
  return {
    operation,
    code: error.code,
    message: `Alarm operation rejected: ${error.code}.`,
    cause: error,
  };
}

export function createAlarmsState(
  options: AlarmsStateOptions = {},
): AlarmsStateController {
  const repository = options.repository ?? new AlarmRepository();
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? defaultCreateId;
  const [state, setState] = createStore<AlarmsState>({
    alarms: [],
    status: 'idle',
    error: undefined,
  });

  const setError = (error: AlarmsStateError) => {
    setState({ status: 'error', error });
    return { ok: false, error } as const;
  };

  const runMutation = async <T>(
    operation: Exclude<AlarmsOperation, 'load'>,
    mutation: () => Promise<T>,
  ): Promise<AlarmsActionResult<T>> => {
    setState({ status: 'saving', error: undefined });

    try {
      const value = await mutation();
      setState({ status: 'ready', error: undefined });
      return { ok: true, value };
    } catch (error) {
      return setError(createStorageError(operation, error));
    }
  };

  const runDomainMutation = async <T>(
    operation: Exclude<AlarmsOperation, 'load'>,
    mutation: () => Promise<AlarmResult<T>>,
  ): Promise<AlarmsActionResult<T>> => {
    setState({ status: 'saving', error: undefined });

    try {
      const result = await mutation();

      if (!result.ok) {
        return setError(createDomainError(operation, result.error));
      }

      setState({ status: 'ready', error: undefined });
      return result;
    } catch (error) {
      return setError(createStorageError(operation, error));
    }
  };

  const replaceAlarm = (alarm: Alarm) => {
    setState('alarms', (alarms) =>
      sortAlarms(
        alarms.map((currentAlarm) =>
          currentAlarm.id === alarm.id ? alarm : currentAlarm,
        ),
      ),
    );
  };

  const actions: AlarmsActions = {
    async load() {
      setState({ status: 'loading', error: undefined });

      try {
        const alarms = sortAlarms(await repository.list());
        setState({ alarms, status: 'ready', error: undefined });
        return { ok: true, value: alarms };
      } catch (error) {
        return setError(createStorageError('load', error));
      }
    },

    create(input) {
      return runDomainMutation('create', async () => {
        const timestamp = now();
        const result = createAlarm(
          {
            id: createId(),
            time: input.time,
            label: input.label,
            order: nextAlarmOrder(state.alarms),
            createdAt: timestamp,
          },
          state.alarms,
        );

        if (!result.ok) {
          return result;
        }

        await repository.create(result.value);
        setState('alarms', sortAlarms([...state.alarms, result.value]));
        return result;
      });
    },

    update(id, input) {
      return runDomainMutation('update', async () => {
        const currentAlarm = state.alarms.find((alarm) => alarm.id === id);

        if (currentAlarm === undefined) {
          return {
            ok: false,
            error: { code: 'not-found' },
          };
        }

        const result = updateAlarm(
          currentAlarm,
          input,
          state.alarms,
          now(),
        );

        if (!result.ok) {
          return result;
        }

        await repository.update(result.value);
        replaceAlarm(result.value);
        return result;
      });
    },

    remove(id) {
      return runMutation('remove', async () => {
        await repository.remove(id);
        setState('alarms', (alarms) =>
          alarms.filter((alarm) => alarm.id !== id),
        );
      });
    },

    enable(id) {
      return changeEnabledState('enable', id);
    },

    disable(id) {
      return changeEnabledState('disable', id);
    },

    clearError() {
      setState({ error: undefined });
      if (state.status === 'error') {
        setState('status', 'ready');
      }
    },
  };

  function changeEnabledState(
    operation: Extract<AlarmsOperation, 'enable' | 'disable'>,
    id: string,
  ): Promise<AlarmsActionResult<Alarm>> {
    return runDomainMutation(operation, async () => {
      const currentAlarm = state.alarms.find((alarm) => alarm.id === id);

      if (currentAlarm === undefined) {
        return {
          ok: false,
          error: { code: 'not-found' },
        };
      }

      const transition: AlarmTransition = operation;
      const result = transitionAlarm(currentAlarm, transition, now());

      if (!result.ok) {
        return result;
      }

      await repository.update(result.value);
      replaceAlarm(result.value);
      return result;
    });
  }

  return { state, actions };
}
