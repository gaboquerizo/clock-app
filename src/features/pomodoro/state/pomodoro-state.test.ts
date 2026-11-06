import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';

import { transitionPomodoroCycle } from '@/features/pomodoro/domain/pomodoro';
import { DEFAULT_POMODORO_PREFERENCES } from '@/features/pomodoro/domain/pomodoro-preferences';
import type {
  PomodoroCycle,
  PomodoroPreferences,
  PomodoroResult,
  RunningPomodoroCycle,
} from '@/features/pomodoro/domain/pomodoro.types';
import type {
  PomodoroCycleRepositoryPort,
  PomodoroPreferencesRepositoryPort,
  PomodoroStateController,
} from './pomodoro-state';
import { createPomodoroState } from './pomodoro-state';
import type { PomodoroCycleSnapshot } from '@/features/pomodoro/storage/pomodoro-cycle-record';

const referenceTimestamp = 1_800_000_000_000;
const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

class MemoryCycleRepository implements PomodoroCycleRepositoryPort {
  snapshot: PomodoroCycleSnapshot | undefined;
  readonly updates: PomodoroCycleSnapshot[] = [];
  updateError?: Error;
  readError?: Error;

  async read(): Promise<PomodoroCycleSnapshot | undefined> {
    if (this.readError !== undefined) {
      throw this.readError;
    }

    return this.snapshot;
  }

  async update(snapshot: PomodoroCycleSnapshot): Promise<void> {
    if (this.updateError !== undefined) {
      throw this.updateError;
    }

    this.updates.push(snapshot);
    this.snapshot = snapshot;
  }
}

class MemoryPreferencesRepository
  implements PomodoroPreferencesRepositoryPort
{
  preferences: PomodoroPreferences | undefined;
  readonly saves: PomodoroPreferences[] = [];
  saveError?: Error;
  readError?: Error;

  async read(): Promise<PomodoroPreferences | undefined> {
    if (this.readError !== undefined) {
      throw this.readError;
    }

    return this.preferences;
  }

  async save(preferences: PomodoroPreferences): Promise<void> {
    if (this.saveError !== undefined) {
      throw this.saveError;
    }

    this.saves.push(preferences);
    this.preferences = preferences;
  }
}

function readyCycle(overrides: Partial<PomodoroCycle> = {}): PomodoroCycle {
  return {
    id: 'cycle-one',
    status: 'ready',
    completedFocusCount: 0,
    currentBlock: {
      id: 'focus-one',
      type: 'focus',
      durationMs: 25 * 60_000,
    },
    ...overrides,
  } as PomodoroCycle;
}

function unwrap<T>(result: PomodoroResult<T>): T {
  if (!result.ok) {
    throw new Error(`Unexpected Pomodoro domain error: ${result.error.code}`);
  }

  return result.value;
}

function startCycle(cycle: PomodoroCycle): RunningPomodoroCycle {
  const running = unwrap(
    transitionPomodoroCycle(cycle, {
      type: 'start',
      timestampMs: referenceTimestamp,
    }),
  );

  if (running.status !== 'running') {
    throw new Error('Expected the Pomodoro block to be running.');
  }

  return running;
}

function createHarness(options?: {
  cycle?: PomodoroCycleSnapshot;
  preferences?: PomodoroPreferences;
  now?: () => number;
  updateError?: Error;
  saveError?: Error;
  readError?: Error;
}): {
  controller: PomodoroStateController;
  cycleRepository: MemoryCycleRepository;
  preferencesRepository: MemoryPreferencesRepository;
  setNow(timestampMs: number): void;
} {
  const cycleRepository = new MemoryCycleRepository();
  const preferencesRepository = new MemoryPreferencesRepository();
  cycleRepository.snapshot = options?.cycle;
  cycleRepository.updateError = options?.updateError;
  cycleRepository.readError = options?.readError;
  preferencesRepository.preferences = options?.preferences;
  preferencesRepository.saveError = options?.saveError;
  let timestampMs = referenceTimestamp;
  const controller = createRoot((dispose) => {
    disposers.push(dispose);
    return createPomodoroState({
      cycleRepository,
      preferencesRepository,
      now: options?.now ?? (() => timestampMs),
      createId: (() => {
        let id = 0;
        return () => `generated-${++id}`;
      })(),
    });
  });

  return {
    controller,
    cycleRepository,
    preferencesRepository,
    setNow(value) {
      timestampMs = value;
    },
  };
}

function snapshotFor(
  cycle: PomodoroCycle,
  lastProcessedCompletion: PomodoroCycleSnapshot['lastProcessedCompletion'] = null,
): PomodoroCycleSnapshot {
  return { cycle, lastProcessedCompletion };
}

describe('Pomodoro state controller', () => {
  it('creates and persists one ready focus cycle when no cycle exists', async () => {
    const { controller, cycleRepository } = createHarness();
    const result = await controller.actions.load();

    expect(result).toMatchObject({ ok: true });
    expect(controller.state).toMatchObject({
      status: 'ready',
      preferences: DEFAULT_POMODORO_PREFERENCES,
      cycle: {
        id: 'generated-1',
        status: 'ready',
        completedFocusCount: 0,
        currentBlock: {
          id: 'generated-2',
          type: 'focus',
          durationMs: 25 * 60_000,
        },
      },
    });
    expect(cycleRepository.updates).toHaveLength(1);
    expect(cycleRepository.snapshot?.lastProcessedCompletion).toBeNull();
    expect(controller.selectors.currentBlock()).toEqual(
      controller.state.cycle?.currentBlock,
    );
    expect(controller.selectors.cycleProgress()).toEqual({
      completedFocusCount: 0,
      totalFocusCount: 4,
    });
  });

  it('restores a ready cycle and applies stored preferences to its prepared block', async () => {
    const storedPreferences = {
      focusDurationMinutes: 35,
      shortBreakDurationMinutes: 7,
      longBreakDurationMinutes: 20,
    };
    const storedCycle = readyCycle();
    const { controller, cycleRepository } = createHarness({
      cycle: snapshotFor(storedCycle),
      preferences: storedPreferences,
    });

    await controller.actions.load();

    expect(controller.state.cycle?.currentBlock.durationMs).toBe(
      35 * 60_000,
    );
    expect(controller.state.preferences).toEqual(storedPreferences);
    expect(cycleRepository.updates).toHaveLength(0);
  });

  it.each(['running', 'paused'] as const)(
    'preserves the assigned duration when restoring a %s block',
    async (status) => {
      const running = startCycle(readyCycle());
      const cycle =
        status === 'running'
          ? running
          : unwrap(
              transitionPomodoroCycle(running, {
                type: 'pause',
                timestampMs: referenceTimestamp + 5 * 60_000,
              }),
            );
      const { controller } = createHarness({
        cycle: snapshotFor(cycle),
        preferences: {
          focusDurationMinutes: 40,
          shortBreakDurationMinutes: 7,
          longBreakDurationMinutes: 20,
        },
      });

      await controller.actions.load();

      expect(controller.state.cycle?.currentBlock.durationMs).toBe(
        25 * 60_000,
      );
      expect(controller.state.cycle?.status).toBe(status);
    },
  );

  it('starts, pauses, and resumes with absolute timestamps and persisted state', async () => {
    const { controller, cycleRepository, setNow } = createHarness();
    await controller.actions.load();

    const started = await controller.actions.start();
    expect(started).toMatchObject({
      ok: true,
      value: {
        status: 'running',
        startedAt: referenceTimestamp,
        endsAt: referenceTimestamp + 25 * 60_000,
      },
    });

    setNow(referenceTimestamp + 5 * 60_000);
    const paused = await controller.actions.pause();
    expect(paused).toMatchObject({
      ok: true,
      value: { status: 'paused', remainingMs: 20 * 60_000 },
    });

    setNow(referenceTimestamp + 60 * 60_000);
    const resumed = await controller.actions.resume();
    expect(resumed).toMatchObject({
      ok: true,
      value: {
        status: 'running',
        startedAt: referenceTimestamp + 60 * 60_000,
        endsAt: referenceTimestamp + 80 * 60_000,
      },
    });
    expect(cycleRepository.updates).toHaveLength(4);
  });

  it('resets the current block while retaining its assigned duration and progress', async () => {
    const current: PomodoroCycle = {
      id: 'cycle-one',
      status: 'paused',
      completedFocusCount: 2,
      currentBlock: {
        id: 'short-break-one',
        type: 'short-break',
        durationMs: 5 * 60_000,
      },
      remainingMs: 2 * 60_000,
    };
    const { controller } = createHarness({ cycle: snapshotFor(current) });
    await controller.actions.load();

    const result = await controller.actions.resetBlock();

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: 'cycle-one',
        status: 'ready',
        completedFocusCount: 2,
        currentBlock: {
          id: 'generated-1',
          type: 'short-break',
          durationMs: 5 * 60_000,
        },
      },
    });
  });

  it('resets the full cycle using current preferences and a new cycle identity', async () => {
    const current: PomodoroCycle = {
      id: 'cycle-one',
      status: 'paused',
      completedFocusCount: 4,
      currentBlock: {
        id: 'long-break-one',
        type: 'long-break',
        durationMs: 15 * 60_000,
      },
      remainingMs: 3 * 60_000,
    };
    const currentPreferences = {
      focusDurationMinutes: 45,
      shortBreakDurationMinutes: 8,
      longBreakDurationMinutes: 22,
    };
    const { controller } = createHarness({
      cycle: snapshotFor(current),
      preferences: currentPreferences,
    });
    await controller.actions.load();

    const result = await controller.actions.resetCycle();

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: 'generated-1',
        status: 'ready',
        completedFocusCount: 0,
        currentBlock: {
          id: 'generated-2',
          type: 'focus',
          durationMs: 45 * 60_000,
        },
      },
    });
  });

  it('updates only the prepared block when new preferences are saved', async () => {
    const { controller, cycleRepository, preferencesRepository } =
      createHarness();
    await controller.actions.load();
    const updatedPreferences = {
      focusDurationMinutes: 40,
      shortBreakDurationMinutes: 8,
      longBreakDurationMinutes: 20,
    };

    const result = await controller.actions.savePreferences(updatedPreferences);

    expect(result).toEqual({ ok: true, value: updatedPreferences });
    expect(controller.state.preferences).toEqual(updatedPreferences);
    expect(controller.state.cycle?.currentBlock.durationMs).toBe(
      40 * 60_000,
    );
    expect(preferencesRepository.saves).toEqual([updatedPreferences]);
    expect(cycleRepository.updates).toHaveLength(1);
  });

  it.each(['running', 'paused'] as const)(
    'keeps the assigned duration of a %s cycle when preferences change',
    async (status) => {
      const running = startCycle(readyCycle());
      const cycle =
        status === 'running'
          ? running
          : unwrap(
              transitionPomodoroCycle(running, {
                type: 'pause',
                timestampMs: referenceTimestamp + 1_000,
              }),
            );
      const { controller } = createHarness({ cycle: snapshotFor(cycle) });
      await controller.actions.load();

      await controller.actions.savePreferences({
        focusDurationMinutes: 40,
        shortBreakDurationMinutes: 7,
        longBreakDurationMinutes: 20,
      });

      expect(controller.state.cycle?.status).toBe(status);
      expect(controller.state.cycle?.currentBlock.durationMs).toBe(
        25 * 60_000,
      );
    },
  );

  it('does not confirm preferences in memory when saving fails', async () => {
    const currentPreferences = { ...DEFAULT_POMODORO_PREFERENCES };
    const { controller } = createHarness({
      preferences: currentPreferences,
      saveError: new Error('write failed'),
    });
    await controller.actions.load();
    const currentCycle = controller.state.cycle;
    const result = await controller.actions.savePreferences({
      focusDurationMinutes: 50,
      shortBreakDurationMinutes: 9,
      longBreakDurationMinutes: 25,
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'unknown' } });
    expect(controller.state.preferences).toEqual(currentPreferences);
    expect(controller.state.cycle).toEqual(currentCycle);
    expect(controller.state.status).toBe('error');
  });

  it('advances a completed block once and persists its completion receipt', async () => {
    const { controller, cycleRepository } = createHarness();
    await controller.actions.load();
    const started = await controller.actions.start();

    if (!started.ok || started.value.status !== 'running') {
      throw new Error('Expected the focus block to be running.');
    }

    const event = {
      type: 'block-completed' as const,
      cycleId: started.value.id,
      blockExecutionId: started.value.currentBlock.id,
      blockType: started.value.currentBlock.type,
      completedAt: started.value.endsAt,
    };
    const completed = await controller.actions.completeBlock(event);

    expect(completed).toMatchObject({
      ok: true,
      value: {
        status: 'ready',
        completedFocusCount: 1,
        currentBlock: { type: 'short-break' },
      },
    });
    expect(cycleRepository.snapshot?.lastProcessedCompletion).toEqual({
      cycleId: event.cycleId,
      blockExecutionId: event.blockExecutionId,
    });

    const updateCount = cycleRepository.updates.length;
    const duplicate = await controller.actions.completeBlock(event);

    expect(duplicate).toEqual(completed);
    expect(cycleRepository.updates).toHaveLength(updateCount);
  });

  it('deduplicates a completion event after restoring the controller', async () => {
    const { controller, cycleRepository, preferencesRepository } =
      createHarness();
    await controller.actions.load();
    const started = await controller.actions.start();

    if (!started.ok || started.value.status !== 'running') {
      throw new Error('Expected the focus block to be running.');
    }

    const event = {
      type: 'block-completed' as const,
      cycleId: started.value.id,
      blockExecutionId: started.value.currentBlock.id,
      blockType: started.value.currentBlock.type,
      completedAt: started.value.endsAt,
    };
    await controller.actions.completeBlock(event);
    const updateCount = cycleRepository.updates.length;
    const restoredController = createRoot((dispose) => {
      disposers.push(dispose);
      return createPomodoroState({
        cycleRepository,
        preferencesRepository,
        createId: () => 'unused-id',
      });
    });
    await restoredController.actions.load();

    const duplicate = await restoredController.actions.completeBlock(event);

    expect(duplicate).toMatchObject({
      ok: true,
      value: {
        status: 'ready',
        completedFocusCount: 1,
        currentBlock: { type: 'short-break' },
      },
    });
    expect(cycleRepository.updates).toHaveLength(updateCount);
  });

  it('exposes storage errors and leaves the cycle unconfirmed on failed update', async () => {
    const { controller } = createHarness({
      cycle: snapshotFor(readyCycle()),
      updateError: new Error('cycle write failed'),
    });
    await controller.actions.load();
    const originalCycle = controller.state.cycle;
    const result = await controller.actions.start();

    expect(result).toMatchObject({
      ok: false,
      error: { operation: 'start', code: 'unknown' },
    });
    expect(controller.state.cycle).toEqual(originalCycle);
    expect(controller.state.status).toBe('error');
  });
});
