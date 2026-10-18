import { describe, expect, it } from 'vitest';

import { createAlarm, transitionAlarm } from '../domain/alarm';
import type { Alarm } from '../domain/alarm.types';
import { fromAlarmRecord, toAlarmRecord } from './alarm-record';

function makeAlarm(): Alarm {
  const createdAt = new Date(2026, 0, 15, 6, 0).getTime();
  const result = createAlarm({
    id: 'alarm-one',
    time: '07:30',
    label: 'Morning',
    order: 2,
    createdAt,
  });

  if (!result.ok) {
    throw new Error(`Unable to create test alarm: ${result.error.code}`);
  }

  return result.value;
}

describe('alarm record mapping', () => {
  it('maps a domain alarm to its persistent record', () => {
    const alarm = makeAlarm();

    expect(toAlarmRecord(alarm)).toEqual({
      id: alarm.id,
      time: alarm.time,
      label: alarm.label,
      enabled: alarm.enabled,
      status: alarm.status,
      order: alarm.order,
      createdAt: alarm.createdAt,
      updatedAt: alarm.updatedAt,
      nextActivationAt: alarm.nextActivationAt,
    });
  });

  it('restores a valid persisted record as a domain alarm', () => {
    const alarm = makeAlarm();

    expect(fromAlarmRecord(toAlarmRecord(alarm))).toEqual({
      ok: true,
      value: alarm,
    });
  });

  it.each(['trigger', 'skip'] as const)(
    'round-trips the %s lifecycle timestamp',
    (transition) => {
      const alarm = makeAlarm();
      const result = transitionAlarm(
        alarm,
        transition,
        alarm.nextActivationAt as number,
      );

      if (!result.ok) {
        throw new Error(`Unable to transition test alarm: ${result.error.code}`);
      }

      expect(fromAlarmRecord(toAlarmRecord(result.value))).toEqual(result);
    },
  );

  it('rejects invalid persisted data instead of trusting the record', () => {
    const record = { ...toAlarmRecord(makeAlarm()), time: '25:00' };

    expect(fromAlarmRecord(record)).toEqual({
      ok: false,
      error: { code: 'invalid-time', field: 'time' },
    });
  });
});
