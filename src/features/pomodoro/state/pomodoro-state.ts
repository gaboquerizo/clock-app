import { createMemo, type Accessor } from 'solid-js';
import { createStore } from 'solid-js/store';

import { advancePomodoroCycle } from '@/features/pomodoro/domain/pomodoro-cycle-sequence';
import {
  applyPomodoroPreferencesToCycle,
  assignPomodoroBlockDuration,
} from '@/features/pomodoro/domain/pomodoro-duration-assignment';
import { validatePomodoroCycle } from '@/features/pomodoro/domain/pomodoro.rules';
import {
  DEFAULT_POMODORO_PREFERENCES,
  validatePomodoroPreferences,
} from '@/features/pomodoro/domain/pomodoro-preferences';
import { resetPomodoroBlock, resetPomodoroCycle } from '@/features/pomodoro/domain/pomodoro-reset';
import { transitionPomodoroCycle } from '@/features/pomodoro/domain/pomodoro';
import {
  isValidPomodoroBlockExecutionId,
  isValidPomodoroBlockType,
  isValidPomodoroCycleId,
  isValidPomodoroTimestampMs,
} from '@/features/pomodoro/domain/pomodoro.rules';
import type {
  PomodoroBlockCompletedEvent,
  PomodoroBlockExecution,
  PomodoroCycle,
  PomodoroCycleId,
  PomodoroDomainErrorCode,
  PomodoroPreferences,
  PomodoroResult,
  PomodoroTimestampMs,
} from '@/features/pomodoro/domain/pomodoro.types';
import {
  PomodoroCycleStorageError,
  pomodoroCycleRepository,
} from '@/features/pomodoro/storage/pomodoro-cycle-repository';
import type {
  PomodoroCompletionReceipt,
  PomodoroCycleSnapshot,
} from '@/features/pomodoro/storage/pomodoro-cycle-record';
import {
  PomodoroPreferencesStorageError,
  pomodoroPreferencesRepository,
} from '@/features/pomodoro/storage/pomodoro-preferences-repository';

export type PomodoroStateStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'saving'
  | 'error';

export type PomodoroOperation =
  | 'load'
  | 'start'
  | 'pause'
  | 'resume'
  | 'reset-block'
  | 'reset-cycle'
  | 'complete-block'
  | 'save-preferences';

export type PomodoroStateError = {
  operation: PomodoroOperation;
  code: string;
  message: string;
  cause?: unknown;
};

export type PomodoroFeatureState = {
  cycle: PomodoroCycle | undefined;
  preferences: PomodoroPreferences;
  status: PomodoroStateStatus;
  error: PomodoroStateError | undefined;
};

export type PomodoroCycleProgress = {
  completedFocusCount: number;
  totalFocusCount: 4;
};

export type PomodoroCycleRepositoryPort = {
  read(): Promise<PomodoroCycleSnapshot | undefined>;
  update(snapshot: PomodoroCycleSnapshot): Promise<void>;
};

export type PomodoroPreferencesRepositoryPort = {
  read(): Promise<PomodoroPreferences | undefined>;
  save(preferences: PomodoroPreferences): Promise<void>;
};

export type PomodoroStateOptions = {
  cycleRepository?: PomodoroCycleRepositoryPort;
  preferencesRepository?: PomodoroPreferencesRepositoryPort;
  now?: () => PomodoroTimestampMs;
  createId?: () => string;
};

export type PomodoroActionResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PomodoroStateError };

export type PomodoroActions = {
  load(): Promise<PomodoroActionResult<PomodoroCycle>>;
  start(): Promise<PomodoroActionResult<PomodoroCycle>>;
  pause(): Promise<PomodoroActionResult<PomodoroCycle>>;
  resume(): Promise<PomodoroActionResult<PomodoroCycle>>;
  resetBlock(): Promise<PomodoroActionResult<PomodoroCycle>>;
  resetCycle(): Promise<PomodoroActionResult<PomodoroCycle>>;
  completeBlock(
    event: PomodoroBlockCompletedEvent,
  ): Promise<PomodoroActionResult<PomodoroCycle>>;
  savePreferences(
    preferences: PomodoroPreferences,
  ): Promise<PomodoroActionResult<PomodoroPreferences>>;
  clearError(): void;
};

export type PomodoroSelectors = {
  currentBlock: Accessor<PomodoroBlockExecution | undefined>;
  cycleProgress: Accessor<PomodoroCycleProgress>;
};

export type PomodoroStateController = {
  state: PomodoroFeatureState;
  actions: PomodoroActions;
  selectors: PomodoroSelectors;
};

function defaultCreateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createStorageError(
  operation: PomodoroOperation,
  error: unknown,
): PomodoroStateError {
  if (
    error instanceof PomodoroCycleStorageError ||
    error instanceof PomodoroPreferencesStorageError
  ) {
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
    message: `Unable to ${operation} Pomodoro.`,
    cause: error,
  };
}

function createDomainError(
  operation: PomodoroOperation,
  code: PomodoroDomainErrorCode | 'invalid-preferences' | 'record-invalid',
): PomodoroStateError {
  return {
    operation,
    code,
    message: `Pomodoro operation rejected: ${code}.`,
  };
}

function isValidCompletionReceipt(
  value: unknown,
): value is PomodoroCompletionReceipt | null {
  if (value === null) {
    return true;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const receipt = value as Record<string, unknown>;

  return (
    isValidPomodoroCycleId(receipt.cycleId) &&
    isValidPomodoroBlockExecutionId(receipt.blockExecutionId)
  );
}

function isValidCompletionEvent(
  value: PomodoroBlockCompletedEvent,
): boolean {
  return (
    value.type === 'block-completed' &&
    isValidPomodoroCycleId(value.cycleId) &&
    isValidPomodoroBlockExecutionId(value.blockExecutionId) &&
    isValidPomodoroBlockType(value.blockType) &&
    isValidPomodoroTimestampMs(value.completedAt)
  );
}

export function createPomodoroState(
  options: PomodoroStateOptions = {},
): PomodoroStateController {
  const cycleRepository = options.cycleRepository ?? pomodoroCycleRepository;
  const preferencesRepository =
    options.preferencesRepository ?? pomodoroPreferencesRepository;
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? defaultCreateId;
  const [state, setState] = createStore<PomodoroFeatureState>({
    cycle: undefined,
    preferences: { ...DEFAULT_POMODORO_PREFERENCES },
    status: 'idle',
    error: undefined,
  });
  const currentBlock = createMemo(() => state.cycle?.currentBlock);
  const cycleProgress = createMemo<PomodoroCycleProgress>(() => ({
    completedFocusCount: state.cycle?.completedFocusCount ?? 0,
    totalFocusCount: 4,
  }));

  let hasLoaded = false;
  let lastProcessedCompletion: PomodoroCompletionReceipt | null = null;
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
    error: PomodoroStateError,
  ): PomodoroActionResult<T> => {
    setState({ status: 'error', error });
    return { ok: false, error };
  };

  const createInitialCycle = (
    preferences: PomodoroPreferences,
  ): PomodoroResult<PomodoroCycle> => {
    const duration = assignPomodoroBlockDuration('focus', preferences);

    if (!duration.ok) {
      return duration;
    }

    return validatePomodoroCycle({
      id: createId(),
      status: 'ready',
      completedFocusCount: 0,
      currentBlock: {
        id: createId(),
        type: 'focus',
        durationMs: duration.value,
      },
    });
  };

  const loadWithinQueue = async (): Promise<
    PomodoroActionResult<PomodoroCycle>
  > => {
    if (hasLoaded && state.cycle !== undefined) {
      return { ok: true, value: state.cycle };
    }

    setState({ status: 'loading', error: undefined });

    try {
      const [storedPreferences, storedSnapshot] = await Promise.all([
        preferencesRepository.read(),
        cycleRepository.read(),
      ]);
      const preferencesResult = validatePomodoroPreferences(
        storedPreferences ?? DEFAULT_POMODORO_PREFERENCES,
      );

      if (!preferencesResult.ok) {
        return setError(createDomainError('load', 'invalid-preferences'));
      }

      const preferences = preferencesResult.value;
      let snapshot: PomodoroCycleSnapshot;

      if (storedSnapshot === undefined) {
        const initialCycle = createInitialCycle(preferences);

        if (!initialCycle.ok) {
          return setError(
            createDomainError('load', initialCycle.error.code),
          );
        }

        snapshot = {
          cycle: initialCycle.value,
          lastProcessedCompletion: null,
        };
        await cycleRepository.update(snapshot);
      } else {
        const cycleResult = validatePomodoroCycle(storedSnapshot.cycle);

        if (
          !cycleResult.ok ||
          !isValidCompletionReceipt(storedSnapshot.lastProcessedCompletion)
        ) {
          return setError(createDomainError('load', 'record-invalid'));
        }

        const preparedCycle = applyPomodoroPreferencesToCycle(
          cycleResult.value,
          preferences,
        );

        if (!preparedCycle.ok) {
          return setError(
            createDomainError('load', preparedCycle.error.code),
          );
        }

        snapshot = {
          cycle: preparedCycle.value,
          lastProcessedCompletion: storedSnapshot.lastProcessedCompletion,
        };
      }

      hasLoaded = true;
      lastProcessedCompletion = snapshot.lastProcessedCompletion;
      setState({
        cycle: snapshot.cycle,
        preferences,
        status: 'ready',
        error: undefined,
      });
      return { ok: true, value: snapshot.cycle };
    } catch (error) {
      return setError(createStorageError('load', error));
    }
  };

  const ensureLoaded = async (): Promise<
    PomodoroActionResult<PomodoroCycle>
  > => {
    if (hasLoaded && state.cycle !== undefined) {
      return { ok: true, value: state.cycle };
    }

    return loadWithinQueue();
  };

  const persistCycle = async (
    operation: PomodoroOperation,
    cycle: PomodoroCycle,
    completionReceipt: PomodoroCompletionReceipt | null =
      lastProcessedCompletion,
  ): Promise<PomodoroActionResult<PomodoroCycle>> => {
    setState({ status: 'saving', error: undefined });

    try {
      const snapshot: PomodoroCycleSnapshot = {
        cycle,
        lastProcessedCompletion: completionReceipt,
      };
      await cycleRepository.update(snapshot);
      lastProcessedCompletion = completionReceipt;
      setState({ cycle, status: 'ready', error: undefined });
      return { ok: true, value: cycle };
    } catch (error) {
      return setError(createStorageError(operation, error));
    }
  };

  const runCycleMutation = (
    operation: PomodoroOperation,
    mutate: (cycle: PomodoroCycle) => PomodoroResult<PomodoroCycle>,
  ): Promise<PomodoroActionResult<PomodoroCycle>> =>
    enqueue(async () => {
      const loaded = await ensureLoaded();

      if (!loaded.ok) {
        return loaded;
      }

      const result = mutate(loaded.value);

      if (!result.ok) {
        return setError(createDomainError(operation, result.error.code));
      }

      return persistCycle(operation, result.value);
    });

  const actions: PomodoroActions = {
    load() {
      return enqueue(loadWithinQueue);
    },

    start() {
      return runCycleMutation('start', (cycle) =>
        transitionPomodoroCycle(cycle, { type: 'start', timestampMs: now() }),
      );
    },

    pause() {
      return runCycleMutation('pause', (cycle) =>
        transitionPomodoroCycle(cycle, { type: 'pause', timestampMs: now() }),
      );
    },

    resume() {
      return runCycleMutation('resume', (cycle) =>
        transitionPomodoroCycle(cycle, {
          type: 'resume',
          timestampMs: now(),
        }),
      );
    },

    resetBlock() {
      return runCycleMutation('reset-block', (cycle) =>
        resetPomodoroBlock(cycle, createId()),
      );
    },

    resetCycle() {
      return runCycleMutation('reset-cycle', (cycle) =>
        resetPomodoroCycle(cycle, {
          nextCycleId: createId() as PomodoroCycleId,
          nextBlockExecutionId: createId(),
          preferences: state.preferences,
        }),
      );
    },

    completeBlock(event) {
      return enqueue(async () => {
        const loaded = await ensureLoaded();

        if (!loaded.ok) {
          return loaded;
        }

        if (
          isValidCompletionEvent(event) &&
          lastProcessedCompletion?.cycleId === event.cycleId &&
          lastProcessedCompletion.blockExecutionId === event.blockExecutionId
        ) {
          return { ok: true, value: loaded.value };
        }

        const cycle = loaded.value;
        const nextBlockExecutionId = createId();
        const nextCycleId =
          cycle.currentBlock.type === 'long-break'
            ? (createId() as PomodoroCycleId)
            : undefined;
        const result = advancePomodoroCycle(cycle, {
          event,
          nextBlockExecutionId,
          ...(nextCycleId === undefined ? {} : { nextCycleId }),
          preferences: state.preferences,
        });

        if (!result.ok) {
          return setError(
            createDomainError('complete-block', result.error.code),
          );
        }

        return persistCycle('complete-block', result.value, {
          cycleId: event.cycleId,
          blockExecutionId: event.blockExecutionId,
        });
      });
    },

    savePreferences(preferences) {
      return enqueue(async () => {
        const loaded = await ensureLoaded();

        if (!loaded.ok) {
          return loaded;
        }

        const validation = validatePomodoroPreferences(preferences);

        if (!validation.ok) {
          return setError(
            createDomainError('save-preferences', 'invalid-preferences'),
          );
        }

        const updatedCycle = applyPomodoroPreferencesToCycle(
          loaded.value,
          validation.value,
        );

        if (!updatedCycle.ok) {
          return setError(
            createDomainError('save-preferences', updatedCycle.error.code),
          );
        }

        setState({ status: 'saving', error: undefined });

        try {
          await preferencesRepository.save(validation.value);
          setState({
            cycle: updatedCycle.value,
            preferences: validation.value,
            status: 'ready',
            error: undefined,
          });
          return { ok: true, value: validation.value };
        } catch (error) {
          return setError(createStorageError('save-preferences', error));
        }
      });
    },

    clearError() {
      setState({
        status: hasLoaded ? 'ready' : 'idle',
        error: undefined,
      });
    },
  };

  const selectors: PomodoroSelectors = {
    currentBlock,
    cycleProgress,
  };

  return { state, actions, selectors };
}
