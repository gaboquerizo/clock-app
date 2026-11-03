import { createMemo, type Accessor } from 'solid-js';
import { createStore } from 'solid-js/store';

import {
  createStopwatch,
  getStopwatchElapsedMs,
  recordStopwatchLap,
  transitionStopwatch,
} from '@/features/stopwatch/domain/stopwatch';
import { selectStopwatchLapRanking } from '@/features/stopwatch/domain/stopwatch-lap-ranking';
import { validateStopwatch } from '@/features/stopwatch/domain/stopwatch.rules';

import type {
  Stopwatch,
  StopwatchDomainError,
  StopwatchElapsedMs,
  StopwatchResult,
  StopwatchTimestampMs,
} from '@/features/stopwatch/domain/stopwatch.types';
import type { StopwatchLapRanking } from '@/features/stopwatch/domain/stopwatch-lap-ranking';

import {
  StopwatchStorageError,
  stopwatchRepository,
} from '@/features/stopwatch/storage/stopwatch-repository';

export type StopwatchStateStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'error';

export type StopwatchOperation =
  | 'load'
  | 'start'
  | 'pause'
  | 'resume'
  | 'record-lap'
  | 'reset';

export type StopwatchStateError = {
  operation: StopwatchOperation;
  code: string;
  message: string;
  cause?: unknown;
};

export type StopwatchFeatureState = {
  stopwatch: Stopwatch;
  status: StopwatchStateStatus;
  error: StopwatchStateError | undefined;
};

export type StopwatchRepositoryPort = {
  read(): Promise<Stopwatch | undefined>;
  update(stopwatch: Stopwatch): Promise<void>;
};

export type StopwatchStateOptions = {
  repository?: StopwatchRepositoryPort;
  now?: () => StopwatchTimestampMs;
};

export type StopwatchActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: StopwatchStateError };

export type StopwatchActions = {
  load(): Promise<StopwatchActionResult<Stopwatch>>;
  start(): Promise<StopwatchActionResult<Stopwatch>>;
  pause(): Promise<StopwatchActionResult<Stopwatch>>;
  resume(): Promise<StopwatchActionResult<Stopwatch>>;
  recordLap(): Promise<StopwatchActionResult<Stopwatch>>;
  reset(): Promise<StopwatchActionResult<Stopwatch>>;
  clearError(): void;
};

export type StopwatchSelectors = {
  elapsedAt(timestampMs: StopwatchTimestampMs):
    StopwatchResult<StopwatchElapsedMs>;
  lapRanking: Accessor<StopwatchLapRanking | undefined>;
};

export type StopwatchStateController = {
  state: StopwatchFeatureState;
  actions: StopwatchActions;
  selectors: StopwatchSelectors;
};

function createStorageError(
  operation: StopwatchOperation,
  error: unknown,
): StopwatchStateError {
  if (error instanceof StopwatchStorageError) {
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
    message: `Unable to ${operation} Stopwatch.`,
    cause: error,
  };
}

function createDomainError(
  operation: StopwatchOperation,
  error: StopwatchDomainError,
): StopwatchStateError {
  return {
    operation,
    code: error.code,
    message: `Stopwatch operation rejected: ${error.code}.`,
    cause: error,
  };
}

export function createStopwatchState(
  options: StopwatchStateOptions = {},
): StopwatchStateController {
  const repository = options.repository ?? stopwatchRepository;
  const now = options.now ?? (() => Date.now());
  const [state, setState] = createStore<StopwatchFeatureState>({
    stopwatch: createStopwatch(),
    status: 'idle',
    error: undefined,
  });
  const lapRanking = createMemo(() =>
    selectStopwatchLapRanking(state.stopwatch.laps),
  );
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

  const setError = <T>(
    error: StopwatchStateError,
  ): StopwatchActionResult<T> => {
    setState({ status: 'error', error });
    return { ok: false, error };
  };

  const loadWithinQueue = async (): Promise<StopwatchActionResult<Stopwatch>> => {
    if (hasLoaded) {
      setState({ status: 'ready', error: undefined });
      return { ok: true, value: state.stopwatch };
    }

    setState({ status: 'loading', error: undefined });

    try {
      const storedStopwatch = await repository.read();
      const result = validateStopwatch(storedStopwatch ?? createStopwatch());

      if (!result.ok) {
        return setError(createDomainError('load', result.error));
      }

      hasLoaded = true;
      setState({
        stopwatch: result.value,
        status: 'ready',
        error: undefined,
      });
      return { ok: true, value: result.value };
    } catch (error) {
      return setError(createStorageError('load', error));
    }
  };

  const persistMutation = async <T extends Stopwatch>(
    operation: Exclude<StopwatchOperation, 'load'>,
    mutate: (stopwatch: Stopwatch) => StopwatchResult<T>,
  ): Promise<StopwatchActionResult<T>> =>
    enqueue(async () => {
      if (!hasLoaded) {
        const loaded = await loadWithinQueue();

        if (!loaded.ok) {
          return { ok: false, error: loaded.error };
        }
      }

      setState({ status: 'saving', error: undefined });

      try {
        const result = mutate(state.stopwatch);

        if (!result.ok) {
          return setError(createDomainError(operation, result.error));
        }

        await repository.update(result.value);
        setState({
          stopwatch: result.value,
          status: 'ready',
          error: undefined,
        });
        return { ok: true, value: result.value };
      } catch (error) {
        return setError(createStorageError(operation, error));
      }
    });

  const actions: StopwatchActions = {
    load() {
      return enqueue(loadWithinQueue);
    },

    start() {
      return persistMutation('start', (stopwatch) =>
        transitionStopwatch(stopwatch, { type: 'start', timestampMs: now() }),
      );
    },

    pause() {
      return persistMutation('pause', (stopwatch) =>
        transitionStopwatch(stopwatch, { type: 'pause', timestampMs: now() }),
      );
    },

    resume() {
      return persistMutation('resume', (stopwatch) =>
        transitionStopwatch(stopwatch, {
          type: 'resume',
          timestampMs: now(),
        }),
      );
    },

    recordLap() {
      return persistMutation('record-lap', (stopwatch) =>
        recordStopwatchLap(stopwatch, {
          type: 'record-lap',
          timestampMs: now(),
        }),
      );
    },

    reset() {
      return persistMutation('reset', (stopwatch) =>
        transitionStopwatch(stopwatch, { type: 'reset' }),
      );
    },

    clearError() {
      setState({
        status: hasLoaded ? 'ready' : 'idle',
        error: undefined,
      });
    },
  };

  const selectors: StopwatchSelectors = {
    elapsedAt(timestampMs) {
      return getStopwatchElapsedMs(state.stopwatch, timestampMs);
    },
    lapRanking,
  };

  return { state, actions, selectors };
}
