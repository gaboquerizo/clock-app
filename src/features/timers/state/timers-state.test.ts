import { describe, expect, it } from 'vitest';

import { createTimer } from '@/features/timers/domain/timer';
import type { Timer } from '@/features/timers/domain/timer.types';
import { TimerStorageError } from '@/features/timers/storage/timer-repository';

import {
  createTimersState,
  type TimerRepositoryPort,
} from '@/features/timers/state/timers-state';

const referenceTimestamp = 1_800_000_000_000;

function makeTimer(
  id = 'timer-one',
  durationMs = 60_000,
): Timer {
  const result = createTimer({
    id,
    durationMs,
    label: 'Focus',
    createdAt: referenceTimestamp,
  });

  if (!result.ok) {
    throw new Error(`Unable to create test timer: ${result.error.code}`);
  }

  return result.value;
}

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
        if (records.some((record) => record.id === timer.id)) {
          throw new TimerStorageError(
            'conflict',
            'A timer with the same identity already exists.',
            { timerId: timer.id },
          );
        }

        records.push(timer);
      },
      async update(timer) {
        const index = records.findIndex((record) => record.id === timer.id);

        if (index < 0) {
          throw new TimerStorageError(
            'not-found',
            'The timer to update does not exist.',
            { timerId: timer.id },
          );
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

describe('Timers state', () => {
  it('restores persisted timers into a reactive feature-local collection', async () => {
    const storedTimer = makeTimer();
    const { repository } = createMemoryRepository([storedTimer]);
    const controller = createTimersState({ repository });

    expect(controller.state.status).toBe('idle');
    const result = await controller.actions.load();

    expect(result).toEqual({ ok: true, value: [storedTimer] });
    expect(controller.state).toMatchObject({
      timers: [storedTimer],
      status: 'ready',
      error: undefined,
    });
  });

  it('does not expose a new timer in memory before persistence succeeds', async () => {
    const { records, repository } = createMemoryRepository();
    let finishCreate: (() => void) | undefined;
    repository.create = async (timer) => {
      await new Promise<void>((resolve) => {
        finishCreate = () => {
          records.push(timer);
          resolve();
        };
      });
    };
    const controller = createTimersState({
      repository,
      now: () => referenceTimestamp,
      createId: () => 'created-timer',
    });

    const pending = controller.actions.create({
      durationMs: 45_000,
      label: 'Short break',
    });

    await Promise.resolve();
    expect(controller.state.status).toBe('saving');
    expect(controller.state.timers).toEqual([]);
    finishCreate?.();

    await expect(pending).resolves.toMatchObject({ ok: true });
    expect(controller.state.timers).toEqual([
      {
        id: 'created-timer',
        durationMs: 45_000,
        label: 'Short break',
        status: 'ready',
        remainingMs: 45_000,
        createdAt: referenceTimestamp,
        updatedAt: referenceTimestamp,
      },
    ]);
    expect(records).toEqual(controller.state.timers);
  });

  it('persists each playback transition and preserves timer identity', async () => {
    const { records, repository } = createMemoryRepository();
    const controller = createTimersState({
      repository,
      now: () => referenceTimestamp + 1_000,
      createId: () => 'independent-timer',
    });

    await controller.actions.load();
    const created = await controller.actions.create({
      durationMs: 60_000,
      label: 'Focus',
    });
    expect(created.ok).toBe(true);

    const started = await controller.actions.start('independent-timer');
    expect(started).toMatchObject({
      ok: true,
      value: { status: 'running', endsAt: referenceTimestamp + 61_000 },
    });
    expect(records[0]).toEqual(controller.state.timers[0]);

    const paused = await controller.actions.pause('independent-timer');
    expect(paused).toMatchObject({
      ok: true,
      value: { status: 'paused', remainingMs: 60_000 },
    });
    expect(records[0]).toEqual(controller.state.timers[0]);

    const resumed = await controller.actions.resume('independent-timer');
    expect(resumed).toMatchObject({ ok: true, value: { status: 'running' } });
    expect(records[0]).toEqual(controller.state.timers[0]);

    const restarted = await controller.actions.restart('independent-timer');
    expect(restarted).toMatchObject({
      ok: true,
      value: {
        id: 'independent-timer',
        status: 'running',
        remainingAtStartMs: 60_000,
      },
    });
    expect(records[0]).toEqual(controller.state.timers[0]);
  });

  it('serializes concurrent transitions for the same timer', async () => {
    const { records, repository } = createMemoryRepository();
    const controller = createTimersState({
      repository,
      now: () => referenceTimestamp + 1_000,
      createId: () => 'queued-timer',
    });

    await controller.actions.load();
    await controller.actions.create({ durationMs: 60_000 });

    const firstStart = controller.actions.start('queued-timer');
    const secondStart = controller.actions.start('queued-timer');

    await expect(firstStart).resolves.toMatchObject({
      ok: true,
      value: { status: 'running' },
    });
    await expect(secondStart).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-transition' },
    });
    expect(records[0]?.status).toBe('running');
    expect(controller.state.timers[0]?.status).toBe('running');
  });

  it('updates timer configuration by resetting to ready and then removes it', async () => {
    const { records, repository } = createMemoryRepository([makeTimer()]);
    const controller = createTimersState({
      repository,
      now: () => referenceTimestamp + 5_000,
    });

    await controller.actions.load();
    await controller.actions.start('timer-one');
    const updated = await controller.actions.update('timer-one', {
      durationMs: 120_000,
      label: 'Deep work',
    });

    expect(updated).toMatchObject({
      ok: true,
      value: {
        id: 'timer-one',
        durationMs: 120_000,
        label: 'Deep work',
        status: 'ready',
        remainingMs: 120_000,
      },
    });
    expect(records[0]).toEqual(controller.state.timers[0]);

    const removed = await controller.actions.remove('timer-one');
    expect(removed).toEqual({ ok: true, value: undefined });
    expect(records).toEqual([]);
    expect(controller.state.timers).toEqual([]);
  });

  it('invalidates the scheduled execution after a successful removal', async () => {
    const { repository } = createMemoryRepository([makeTimer()]);
    const invalidatedTimerIds: string[] = [];
    const controller = createTimersState({
      repository,
      cancelScheduledExecution: (timerId) => {
        invalidatedTimerIds.push(timerId);
      },
    });

    await controller.actions.load();
    const result = await controller.actions.remove('timer-one');

    expect(result).toEqual({ ok: true, value: undefined });
    expect(invalidatedTimerIds).toEqual(['timer-one']);
    expect(controller.state.timers).toEqual([]);
  });

  it('keeps a failed removal and its schedule intact', async () => {
    const timer = makeTimer();
    const { repository } = createMemoryRepository([timer]);
    const invalidatedTimerIds: string[] = [];
    repository.remove = async () => {
      throw new TimerStorageError('delete-failed', 'Storage unavailable.', {
        timerId: timer.id,
      });
    };
    const controller = createTimersState({
      repository,
      cancelScheduledExecution: (timerId) => {
        invalidatedTimerIds.push(timerId);
      },
    });

    await controller.actions.load();
    const result = await controller.actions.remove(timer.id);

    expect(result).toMatchObject({
      ok: false,
      error: { operation: 'remove', code: 'delete-failed' },
    });
    expect(invalidatedTimerIds).toEqual([]);
    expect(controller.state.timers).toEqual([timer]);
  });

  it('keeps the in-memory timer unchanged when persistence fails', async () => {
    const timer = makeTimer();
    const { repository } = createMemoryRepository([timer]);
    repository.update = async () => {
      throw new TimerStorageError('update-failed', 'Storage unavailable.', {
        timerId: timer.id,
      });
    };
    const controller = createTimersState({
      repository,
      now: () => referenceTimestamp + 1_000,
    });

    await controller.actions.load();
    const result = await controller.actions.start(timer.id);

    expect(result).toMatchObject({
      ok: false,
      error: { operation: 'start', code: 'update-failed' },
    });
    expect(controller.state.timers).toEqual([timer]);
    expect(controller.state.status).toBe('error');

    controller.actions.clearError();
    expect(controller.state.error).toBeUndefined();
    expect(controller.state.status).toBe('ready');
  });

  it('rejects duplicate identities and missing timers without persisting', async () => {
    const { records, repository } = createMemoryRepository([makeTimer()]);
    const controller = createTimersState({
      repository,
      now: () => referenceTimestamp + 1_000,
      createId: () => 'timer-one',
    });

    await controller.actions.load();
    expect(
      await controller.actions.create({ durationMs: 30_000 }),
    ).toMatchObject({ ok: false, error: { code: 'duplicate-id' } });
    expect(await controller.actions.remove('missing')).toMatchObject({
      ok: false,
      error: { code: 'not-found' },
    });
    expect(records).toEqual([makeTimer()]);
  });

  it('does not replace the current collection when stored data is invalid', async () => {
    const validTimer = makeTimer();
    const invalidTimer = {
      ...makeTimer('invalid-timer'),
      durationMs: 0,
    } as unknown as Timer;
    const { repository } = createMemoryRepository([validTimer]);
    const controller = createTimersState({ repository });

    await controller.actions.load();
    repository.list = async () => [validTimer, invalidTimer];
    const result = await controller.actions.load();

    expect(result).toMatchObject({
      ok: false,
      error: { operation: 'load', code: 'invalid-duration' },
    });
    expect(controller.state.timers).toEqual([validTimer]);
  });
});
