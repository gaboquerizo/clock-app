import { afterEach, describe, expect, it, vi } from 'vitest';

import { createScheduler } from '@/core/time/scheduler';
import { createTimersState, type TimerRepositoryPort } from './timers-state';
import { createTimersRuntime, type TimersRuntime } from './timers-runtime';
import type { Timer } from '@/features/timers/domain/timer.types';

const referenceTimestamp = 1_800_000_000_000;

function createMemoryRepository(initialTimers: Timer[] = []): {
  records: Timer[];
  repository: TimerRepositoryPort;
} {
  const records = [...initialTimers];

  return {
    records,
    repository: {
      async list() {
        return [...records];
      },
      async create(timer) {
        records.push(timer);
      },
      async update(timer) {
        const index = records.findIndex((record) => record.id === timer.id);

        if (index < 0) {
          throw new Error(`Missing timer ${timer.id}.`);
        }

        records[index] = timer;
      },
      async remove(id) {
        const index = records.findIndex((record) => record.id === id);

        if (index >= 0) {
          records.splice(index, 1);
        }
      },
    },
  };
}

async function flushMicrotasks() {
  for (let turn = 0; turn < 8; turn += 1) {
    await Promise.resolve();
  }
}

describe('Timers runtime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules independent running timers and emits each completion once', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(referenceTimestamp);

    const firstTimer: Timer = {
      id: 'short-timer',
      durationMs: 2_000,
      label: 'Short',
      status: 'running',
      startedAt: referenceTimestamp,
      endsAt: referenceTimestamp + 2_000,
      remainingAtStartMs: 2_000,
      createdAt: referenceTimestamp,
      updatedAt: referenceTimestamp,
    };
    const secondTimer: Timer = {
      ...firstTimer,
      id: 'long-timer',
      durationMs: 5_000,
      label: 'Long',
      endsAt: referenceTimestamp + 5_000,
      remainingAtStartMs: 5_000,
    };
    const { records, repository } = createMemoryRepository([
      firstTimer,
      secondTimer,
    ]);
    const scheduler = createScheduler();
    const controller = createTimersState({ repository });
    const runtime = createTimersRuntime(controller, { scheduler });
    const completions: string[] = [];
    const unsubscribe = runtime.subscribe(({ timer }) => {
      completions.push(timer.id);
    });

    scheduler.start();
    await runtime.start();
    await vi.advanceTimersByTimeAsync(2_000);
    await flushMicrotasks();

    expect(controller.state.timers).toEqual([
      expect.objectContaining({ id: 'short-timer', status: 'completed' }),
      expect.objectContaining({ id: 'long-timer', status: 'running' }),
    ]);
    expect(records[0]?.status).toBe('completed');
    expect(completions).toEqual(['short-timer']);

    await vi.advanceTimersByTimeAsync(3_000);
    await flushMicrotasks();

    expect(controller.state.timers.every((timer) => timer.status === 'completed'))
      .toBe(true);
    expect(completions).toEqual(['short-timer', 'long-timer']);

    unsubscribe();
    runtime.stop();
    scheduler.stop();
  });

  it('updates deadlines after pause and restart and cancels a removed timer', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(referenceTimestamp);

    const { repository } = createMemoryRepository();
    const scheduler = createScheduler();
    let runtime: TimersRuntime | undefined;
    const controller = createTimersState({
      repository,
      now: () => Date.now(),
      cancelScheduledExecution: (timerId) => runtime?.cancel(timerId),
      createId: () => 'controlled-timer',
    });
    runtime = createTimersRuntime(controller, { scheduler });
    const completions: string[] = [];
    runtime.subscribe(({ timer }) => {
      completions.push(timer.id);
    });

    scheduler.start();
    await runtime.start();
    await controller.actions.create({ durationMs: 10_000 });
    runtime.sync();
    await controller.actions.start('controlled-timer');
    runtime.sync();

    await vi.advanceTimersByTimeAsync(3_000);
    await controller.actions.pause('controlled-timer');
    runtime.sync();
    await vi.advanceTimersByTimeAsync(10_000);
    await flushMicrotasks();
    expect(completions).toEqual([]);

    await controller.actions.resume('controlled-timer');
    runtime.sync();
    await vi.advanceTimersByTimeAsync(2_000);
    await controller.actions.restart('controlled-timer');
    runtime.sync();
    await vi.advanceTimersByTimeAsync(9_000);
    await flushMicrotasks();
    expect(completions).toEqual([]);

    await vi.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();
    expect(completions).toEqual(['controlled-timer']);

    await controller.actions.create({ durationMs: 1_000 });
    runtime.sync();
    await controller.actions.start('controlled-timer');
    runtime.sync();
    await controller.actions.remove('controlled-timer');
    await vi.advanceTimersByTimeAsync(2_000);
    await flushMicrotasks();
    expect(completions).toEqual(['controlled-timer']);

    runtime.stop();
    scheduler.stop();
  });
});
