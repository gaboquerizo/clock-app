import { createStore } from 'solid-js/store';

import {
  createTimer,
  transitionTimer,
  updateTimer,
  validateTimer,
} from '@/features/timers/domain/timer';
import { hasDuplicateTimerId } from '@/features/timers/domain/timer.rules';

import type {
  CreateTimerInput,
  Timer,
  TimerDomainError,
  TimerResult,
  TimerTransition,
  UpdateTimerInput,
} from '@/features/timers/domain/timer.types';

import {
  TimerStorageError,
  timerRepository,
} from '@/features/timers/storage/timer-repository';

export type TimersStateStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'error';

export type TimersOperation =
  | 'load'
  | 'create'
  | 'update'
  | 'remove'
  | TimerTransition;

export type TimersStateError = {
  operation: TimersOperation;
  code: string;
  message: string;
  cause?: unknown;
};

export type TimersState = {
  timers: Timer[];
  status: TimersStateStatus;
  error: TimersStateError | undefined;
};

export type TimerRepositoryPort = {
  list(): Promise<Timer[]>;
  create(timer: Timer): Promise<void>;
  update(timer: Timer): Promise<void>;
  remove(id: string): Promise<void>;
};

export type CreateTimerParams = Omit<CreateTimerInput, 'id' | 'createdAt'>;

export type TimersStateOptions = {
  cancelScheduledExecution?: (timerId: string) => void;
  repository?: TimerRepositoryPort;
  now?: () => number;
  createId?: () => string;
};

export type TimersActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: TimersStateError };

export type TimersActions = {
  load(): Promise<TimersActionResult<Timer[]>>;
  create(input: CreateTimerParams): Promise<TimersActionResult<Timer>>;
  update(
    id: string,
    input: UpdateTimerInput,
  ): Promise<TimersActionResult<Timer>>;
  remove(id: string): Promise<TimersActionResult<void>>;
  start(id: string): Promise<TimersActionResult<Timer>>;
  pause(id: string): Promise<TimersActionResult<Timer>>;
  resume(id: string): Promise<TimersActionResult<Timer>>;
  restart(id: string): Promise<TimersActionResult<Timer>>;
  clearError(): void;
};

export type TimersStateController = {
  state: TimersState;
  actions: TimersActions;
};

function defaultCreateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createStorageError(
  operation: TimersOperation,
  error: unknown,
): TimersStateError {
  if (error instanceof TimerStorageError) {
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
    message: `Unable to ${operation} timers.`,
    cause: error,
  };
}

function createDomainError(
  operation: TimersOperation,
  error: TimerDomainError,
): TimersStateError {
  return {
    operation,
    code: error.code,
    message: `Timer operation rejected: ${error.code}.`,
    cause: error,
  };
}

export function createTimersState(
  options: TimersStateOptions = {},
): TimersStateController {
  const repository = options.repository ?? timerRepository;
  const cancelScheduledExecution =
    options.cancelScheduledExecution ?? (() => undefined);
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? defaultCreateId;
  const [state, setState] = createStore<TimersState>({
    timers: [],
    status: 'idle',
    error: undefined,
  });
  let hasLoaded = false;
  let operationQueue: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = operationQueue.then(operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const setError = <T>(error: TimersStateError): TimersActionResult<T> => {
    setState({ status: 'error', error });
    return { ok: false, error };
  };

  const runDomainMutation = async <T>(
    operation: Exclude<TimersOperation, 'load'>,
    mutation: () => Promise<TimerResult<T>>,
  ): Promise<TimersActionResult<T>> => {
    return enqueue(async () => {
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
    });
  };

  const replaceTimer = (timer: Timer) => {
    setState('timers', (timers) =>
      timers.map((currentTimer) =>
        currentTimer.id === timer.id ? timer : currentTimer,
      ),
    );
  };

  const actions: TimersActions = {
    load() {
      return enqueue(async () => {
        setState({ status: 'loading', error: undefined });

        try {
          const records = await repository.list();
          const timers: Timer[] = [];

          for (const record of records) {
            const result = validateTimer(record);

            if (!result.ok) {
              return setError(createDomainError('load', result.error));
            }

            if (hasDuplicateTimerId(timers, result.value.id)) {
              return setError(
                createDomainError('load', {
                  code: 'duplicate-id',
                  field: 'id',
                }),
              );
            }

            timers.push(result.value);
          }

          hasLoaded = true;
          setState({ timers, status: 'ready', error: undefined });
          return { ok: true, value: timers };
        } catch (error) {
          return setError(createStorageError('load', error));
        }
      });
    },

    create(input) {
      return runDomainMutation('create', async () => {
        const result = createTimer(
          {
            id: createId(),
            durationMs: input.durationMs,
            label: input.label,
            createdAt: now(),
          },
          state.timers,
        );

        if (!result.ok) {
          return result;
        }

        await repository.create(result.value);
        setState('timers', (timers) => [...timers, result.value]);
        return result;
      });
    },

    update(id, input) {
      return runDomainMutation('update', async () => {
        const currentTimer = state.timers.find((timer) => timer.id === id);

        if (currentTimer === undefined) {
          return { ok: false, error: { code: 'not-found' } };
        }

        const result = updateTimer(currentTimer, input, now());

        if (!result.ok) {
          return result;
        }

        await repository.update(result.value);
        replaceTimer(result.value);
        return result;
      });
    },

    remove(id) {
      return runDomainMutation('remove', async () => {
        const currentTimer = state.timers.find((timer) => timer.id === id);

        if (currentTimer === undefined) {
          return { ok: false, error: { code: 'not-found' } };
        }

        await repository.remove(id);
        cancelScheduledExecution(id);
        setState('timers', (timers) =>
          timers.filter((timer) => timer.id !== id),
        );
        return { ok: true, value: undefined };
      });
    },

    start(id) {
      return transition('start', id);
    },

    pause(id) {
      return transition('pause', id);
    },

    resume(id) {
      return transition('resume', id);
    },

    restart(id) {
      return transition('restart', id);
    },

    clearError() {
      setState({ error: undefined });

      if (state.status === 'error') {
        setState('status', hasLoaded ? 'ready' : 'idle');
      }
    },
  };

  function transition(
    operation: TimerTransition,
    id: string,
  ): Promise<TimersActionResult<Timer>> {
    return runDomainMutation(operation, async () => {
      const currentTimer = state.timers.find((timer) => timer.id === id);

      if (currentTimer === undefined) {
        return { ok: false, error: { code: 'not-found' } };
      }

      const result = transitionTimer(currentTimer, operation, now());

      if (!result.ok) {
        return result;
      }

      await repository.update(result.value);
      replaceTimer(result.value);
      return result;
    });
  }

  return { state, actions };
}
