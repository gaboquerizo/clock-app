import { describe, expect, it } from 'vitest';

import { transitionPomodoroCycle } from '../domain/pomodoro';
import type {
  PomodoroCycle,
  PomodoroResult,
  RunningPomodoroCycle,
} from '../domain/pomodoro.types';
import {
  fromPomodoroCycleRecord,
  POMODORO_CYCLE_RECORD_ID,
  toPomodoroCycleRecord,
  type PomodoroCycleSnapshot,
} from './pomodoro-cycle-record';

const timestampMs = 1_800_000_000_000;

function readySnapshot(): PomodoroCycleSnapshot {
  return {
    cycle: {
      id: 'cycle-one',
      status: 'ready',
      completedFocusCount: 0,
      currentBlock: {
        id: 'focus-one',
        type: 'focus',
        durationMs: 25 * 60_000,
      },
    },
    lastProcessedCompletion: null,
  };
}

function unwrap<T>(result: PomodoroResult<T>): T {
  if (!result.ok) {
    throw new Error(`Unexpected Pomodoro domain error: ${result.error.code}`);
  }

  return result.value;
}

function runningCycle(cycle: PomodoroCycle): RunningPomodoroCycle {
  const running = unwrap(
    transitionPomodoroCycle(cycle, { type: 'start', timestampMs }),
  );

  if (running.status !== 'running') {
    throw new Error('Expected the Pomodoro cycle to be running.');
  }

  return running;
}

function readyRecord() {
  const result = toPomodoroCycleRecord(readySnapshot());

  if (!result.ok) {
    throw new Error('Unable to create a valid Pomodoro cycle record.');
  }

  return result.value;
}

describe('Pomodoro cycle record mapping', () => {
  it.each(['ready', 'running', 'paused'] as const)(
    'round trips a valid %s cycle state',
    (status) => {
      let cycle: PomodoroCycle = readySnapshot().cycle;

      if (status !== 'ready') {
        const running = runningCycle(cycle);
        cycle =
          status === 'running'
            ? running
            : unwrap(
                transitionPomodoroCycle(running, {
            type: 'pause',
            timestampMs: timestampMs + 60_000,
                }),
              );
      }

      const snapshot: PomodoroCycleSnapshot = {
        cycle,
        lastProcessedCompletion: {
          cycleId: 'cycle-zero',
          blockExecutionId: 'previous-block',
        },
      };
      const record = toPomodoroCycleRecord(snapshot);

      expect(record).toMatchObject({ ok: true });
      expect(record.ok && fromPomodoroCycleRecord(record.value)).toEqual({
        ok: true,
        value: snapshot,
      });
    },
  );

  it('serializes temporal fields according to the cycle state', () => {
    const ready = toPomodoroCycleRecord(readySnapshot());
    const running = toPomodoroCycleRecord({
      ...readySnapshot(),
      cycle: runningCycle(readySnapshot().cycle),
    });

    expect(ready).toMatchObject({
      ok: true,
      value: { id: POMODORO_CYCLE_RECORD_ID, status: 'ready' },
    });
    expect(running).toMatchObject({
      ok: true,
      value: { status: 'running', startedAt: timestampMs },
    });
    expect(ready.ok && 'endsAt' in ready.value).toBe(false);
  });

  it('round trips metadata for a recovered completion', () => {
    const scheduledAt = timestampMs + 25 * 60_000;
    const snapshot: PomodoroCycleSnapshot = {
      ...readySnapshot(),
      lastProcessedCompletion: {
        cycleId: 'cycle-one',
        blockExecutionId: 'focus-one',
        recovery: {
          blockType: 'focus',
          completedAt: scheduledAt,
          scheduledAt,
          observedAt: scheduledAt + 5_000,
        },
      },
    };
    const record = toPomodoroCycleRecord(snapshot);

    expect(record).toMatchObject({ ok: true });
    expect(record.ok && fromPomodoroCycleRecord(record.value)).toEqual({
      ok: true,
      value: snapshot,
    });
  });

  it('rejects recovery receipts with inconsistent completion timestamps', () => {
    const scheduledAt = timestampMs + 25 * 60_000;
    const snapshot: PomodoroCycleSnapshot = {
      ...readySnapshot(),
      lastProcessedCompletion: {
        cycleId: 'cycle-one',
        blockExecutionId: 'focus-one',
        recovery: {
          blockType: 'focus',
          completedAt: scheduledAt,
          scheduledAt,
          observedAt: scheduledAt + 1,
        },
      },
    };
    const validRecord = toPomodoroCycleRecord(snapshot);

    if (!validRecord.ok) {
      throw new Error('Expected the recovery receipt to be valid.');
    }

    expect(
      toPomodoroCycleRecord({
        ...snapshot,
        lastProcessedCompletion: {
          ...snapshot.lastProcessedCompletion!,
          recovery: {
            ...snapshot.lastProcessedCompletion!.recovery!,
            completedAt: scheduledAt - 1,
          },
        },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-record' } });

    expect(
      fromPomodoroCycleRecord({
        ...validRecord.value,
        lastProcessedCompletion: {
          ...snapshot.lastProcessedCompletion!,
          recovery: {
            ...snapshot.lastProcessedCompletion!.recovery!,
            observedAt: scheduledAt - 1,
          },
        },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-record' } });
  });

  it('rejects malformed cycle data and completion receipts', () => {
    const snapshot = readySnapshot();

    expect(
      toPomodoroCycleRecord({
        ...snapshot,
        cycle: { ...snapshot.cycle, completedFocusCount: 5 },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-record' } });
    expect(
      toPomodoroCycleRecord({
        ...snapshot,
        lastProcessedCompletion: {
          cycleId: 'cycle-one',
          blockExecutionId: ' ',
        },
      }),
    ).toEqual({ ok: false, error: { code: 'invalid-record' } });
  });

  it.each([
    { ...readyRecord(), id: 'other' },
    {
      ...readyRecord(),
      currentBlock: { ...readySnapshot().cycle.currentBlock, durationMs: 0 },
    },
    {
      ...readyRecord(),
      lastProcessedCompletion: { cycleId: 'cycle-one', blockExecutionId: '' },
    },
  ])('rejects invalid persisted records', (record) => {
    expect(fromPomodoroCycleRecord(record)).toEqual({
      ok: false,
      error: { code: 'invalid-record' },
    });
  });
});
