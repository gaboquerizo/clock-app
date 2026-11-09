import { createRoot } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';

import { createScheduler } from '@/core/time/scheduler';
import type { PomodoroCycle } from '@/features/pomodoro/domain/pomodoro.types';
import type { PomodoroCycleSnapshot } from '@/features/pomodoro/storage/pomodoro-cycle-record';
import { createPomodoroState } from './pomodoro-state';
import type {
  PomodoroCycleRepositoryPort,
  PomodoroPreferencesRepositoryPort,
} from './pomodoro-state';
import { createPomodoroRuntime } from './pomodoro-runtime';

const scheduledAt = 1_800_000_000_000;
const observedAt = scheduledAt + 5_000;
const disposers: Array<() => void> = [];

afterEach(() => {
  for (const dispose of disposers.splice(0)) {
    dispose();
  }
});

class MemoryCycleRepository implements PomodoroCycleRepositoryPort {
  snapshot: PomodoroCycleSnapshot | undefined;
  readonly updates: PomodoroCycleSnapshot[] = [];

  async read(): Promise<PomodoroCycleSnapshot | undefined> {
    return this.snapshot;
  }

  async update(snapshot: PomodoroCycleSnapshot): Promise<void> {
    this.snapshot = snapshot;
    this.updates.push(snapshot);
  }
}

class MemoryPreferencesRepository implements PomodoroPreferencesRepositoryPort {
  async read() {
    return undefined;
  }

  async save(): Promise<void> {}
}

function expiredRunningCycle(): PomodoroCycle {
  return {
    id: 'cycle-recovery',
    status: 'running',
    completedFocusCount: 0,
    currentBlock: {
      id: 'focus-recovered',
      type: 'focus',
      durationMs: 25 * 60_000,
    },
    startedAt: scheduledAt - 25 * 60_000,
    endsAt: scheduledAt,
  };
}

describe('Pomodoro runtime recovery', () => {
  it('processes an expired block once and persists its recovery receipt', async () => {
    const cycleRepository = new MemoryCycleRepository();
    const preferencesRepository = new MemoryPreferencesRepository();
    const expiredCycle = expiredRunningCycle();
    cycleRepository.snapshot = {
      cycle: expiredCycle,
      lastProcessedCompletion: null,
    };

    let id = 0;
    const controller = createRoot((dispose) => {
      disposers.push(dispose);
      return createPomodoroState({
        cycleRepository,
        preferencesRepository,
        now: () => observedAt,
        createId: () => `generated-${++id}`,
      });
    });
    const scheduler = createScheduler({ now: () => observedAt });
    const runtime = createPomodoroRuntime(controller, {
      scheduler,
      now: () => observedAt,
    });
    const events: Array<{
      cycleId: string;
      blockExecutionId: string;
      blockType: string;
      completedAt: number;
      scheduledAt: number;
      observedAt: number;
      reason: string;
    }> = [];
    let completion:
      | ReturnType<typeof controller.actions.completeBlock>
      | undefined;

    const unsubscribe = runtime.subscribe((event) => {
      events.push(event);
      completion = controller.actions.completeBlock(event, {
        reason: event.reason,
        scheduledAt: event.scheduledAt,
        observedAt: event.observedAt,
      });
    });

    await runtime.start();
    await completion;

    expect(events).toEqual([
      {
        type: 'block-completed',
        cycleId: 'cycle-recovery',
        blockExecutionId: 'focus-recovered',
        blockType: 'focus',
        completedAt: scheduledAt,
        scheduledAt,
        observedAt,
        reason: 'recovery',
      },
    ]);
    expect(controller.state.cycle).toMatchObject({
      status: 'ready',
      completedFocusCount: 1,
      currentBlock: { type: 'short-break', id: 'generated-1' },
    });
    expect(cycleRepository.snapshot?.lastProcessedCompletion).toEqual({
      cycleId: 'cycle-recovery',
      blockExecutionId: 'focus-recovered',
      recovery: {
        blockType: 'focus',
        completedAt: scheduledAt,
        scheduledAt,
        observedAt,
      },
    });
    expect(cycleRepository.updates).toHaveLength(1);

    runtime.sync(expiredCycle, 'ready');
    runtime.sync(expiredCycle, 'ready');
    await scheduler.reconcile(observedAt);

    expect(events).toHaveLength(1);
    expect(cycleRepository.updates).toHaveLength(1);
    expect(controller.state.cycle?.completedFocusCount).toBe(1);

    unsubscribe();
    runtime.stop();
  });
});
