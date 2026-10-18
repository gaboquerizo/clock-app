import { describe, expect, it } from 'vitest';

import { createAlarm } from './alarm';
import {
  getNextAlarmActivationAt,
  reconcileAlarm,
} from './alarm-scheduling';
import type { Alarm } from './alarm.types';

const localTime = (day: number, hours: number, minutes: number) =>
  new Date(2026, 0, day, hours, minutes).getTime();

function makeAlarm(): Alarm {
  const createdAt = localTime(15, 6, 0);
  const result = createAlarm({
    id: 'alarm-one',
    time: '07:30',
    order: 0,
    createdAt,
  });

  if (!result.ok) {
    throw new Error(`Unable to create test alarm: ${result.error.code}`);
  }

  return result.value;
}

describe('alarm scheduling rules', () => {
  it('calculates the next occurrence later on the same local day', () => {
    const result = getNextAlarmActivationAt('07:30', localTime(15, 6, 45));

    expect(result).toEqual({ ok: true, value: localTime(15, 7, 30) });
  });

  it.each([localTime(15, 7, 30), localTime(15, 8, 0)])(
    'moves an equal or passed occurrence to the next day from %s',
    (referenceTimestamp) => {
      const result = getNextAlarmActivationAt('07:30', referenceTimestamp);

      expect(result).toEqual({ ok: true, value: localTime(16, 7, 30) });
    },
  );

  it('rejects invalid times and reference timestamps', () => {
    expect(getNextAlarmActivationAt('24:00', localTime(15, 6, 0))).toEqual({
      ok: false,
      error: { code: 'invalid-time' },
    });
    expect(getNextAlarmActivationAt('07:30', Number.NaN)).toEqual({
      ok: false,
      error: { code: 'invalid-timestamp' },
    });
  });

  it('marks a past occurrence as skipped during recovery', () => {
    const alarm = {
      ...makeAlarm(),
      nextActivationAt: localTime(15, 7, 30),
    };
    const reconciled = reconcileAlarm(
      alarm,
      localTime(15, 7, 31),
      'recovery',
    );

    expect(reconciled).toMatchObject({
      ok: true,
      value: {
        enabled: false,
        status: 'skipped',
        nextActivationAt: undefined,
        skippedAt: localTime(15, 7, 31),
      },
    });
  });

  it('marks a due occurrence as triggered when activation was running', () => {
    const alarm = {
      ...makeAlarm(),
      nextActivationAt: localTime(15, 7, 30),
    };
    const reconciled = reconcileAlarm(
      alarm,
      localTime(15, 7, 31),
      'activation',
    );

    expect(reconciled).toMatchObject({
      ok: true,
      value: {
        enabled: false,
        status: 'triggered',
        nextActivationAt: undefined,
        triggeredAt: localTime(15, 7, 31),
      },
    });
  });

  it('rebuilds a stale timestamp when the local time zone no longer matches', () => {
    const alarm = {
      ...makeAlarm(),
      nextActivationAt: localTime(15, 6, 30),
    };
    const reconciled = reconcileAlarm(
      alarm,
      localTime(15, 6, 45),
      'recovery',
    );

    expect(reconciled).toMatchObject({
      ok: true,
      value: {
        enabled: true,
        status: 'scheduled',
        nextActivationAt: localTime(15, 7, 30),
      },
    });
  });
});
