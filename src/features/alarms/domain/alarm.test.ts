import { describe, expect, it } from 'vitest';

import { createAlarm, transitionAlarm, updateAlarm } from './alarm';
import { isValidAlarmTime } from './alarm.rules';
import type { Alarm } from './alarm.types';

const localTime = (day: number, hours: number, minutes: number) =>
  new Date(2026, 0, day, hours, minutes).getTime();

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  const createdAt = localTime(15, 6, 0);
  const result = createAlarm({
    id: 'alarm-one',
    time: '07:30',
    label: 'Morning',
    order: 0,
    createdAt,
  });

  if (!result.ok) {
    throw new Error(`Unable to create test alarm: ${result.error.code}`);
  }

  return { ...result.value, ...overrides };
}

describe('alarm domain rules', () => {
  it.each(['00:00', '07:30', '23:59'])('accepts valid time %s', (time) => {
    expect(isValidAlarmTime(time)).toBe(true);
  });

  it.each(['24:00', '7:30', '12:60', ''])('rejects invalid time %s', (time) => {
    expect(isValidAlarmTime(time)).toBe(false);
  });

  it('creates an enabled alarm with a normalized label and absolute activation', () => {
    const createdAt = localTime(15, 6, 0);
    const result = createAlarm({
      id: 'alarm-one',
      time: '07:30',
      label: '  Morning  ',
      order: 0,
      createdAt,
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        id: 'alarm-one',
        time: '07:30',
        label: 'Morning',
        enabled: true,
        status: 'scheduled',
        createdAt,
        updatedAt: createdAt,
        nextActivationAt: localTime(15, 7, 30),
      },
    });
  });

  it('allows an empty label', () => {
    const result = createAlarm({
      id: 'alarm-one',
      time: '07:30',
      label: '   ',
      order: 0,
      createdAt: localTime(15, 6, 0),
    });

    expect(result.ok && result.value.label).toBe('');
  });

  it('rejects an alarm with a duplicate configured time', () => {
    const existingAlarm = makeAlarm();
    const result = createAlarm(
      {
        id: 'alarm-two',
        time: existingAlarm.time,
        order: 1,
        createdAt: localTime(15, 6, 0),
      },
      [existingAlarm],
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'duplicate-time' },
    });
  });

  it('rejects editing an alarm to another alarm\'s configured time', () => {
    const alarm = makeAlarm();
    const otherResult = createAlarm({
      id: 'alarm-two',
      time: '08:30',
      order: 1,
      createdAt: localTime(15, 6, 0),
    });

    if (!otherResult.ok) {
      throw new Error(`Unable to create test alarm: ${otherResult.error.code}`);
    }

    const result = updateAlarm(
      alarm,
      { time: otherResult.value.time, label: alarm.label },
      [alarm, otherResult.value],
      localTime(15, 6, 15),
    );

    expect(result).toEqual({
      ok: false,
      error: { code: 'duplicate-time' },
    });
  });

  it('rejects invalid time and label values during creation', () => {
    const invalidTime = createAlarm({
      id: 'alarm-one',
      time: '25:00',
      order: 0,
      createdAt: localTime(15, 6, 0),
    });
    const invalidLabel = createAlarm({
      id: 'alarm-one',
      time: '07:30',
      label: 'x'.repeat(101),
      order: 0,
      createdAt: localTime(15, 6, 0),
    });

    expect(invalidTime).toMatchObject({
      ok: false,
      error: { code: 'invalid-time', field: 'time' },
    });
    expect(invalidLabel).toMatchObject({
      ok: false,
      error: { code: 'invalid-label', field: 'label' },
    });
  });

  it('disables and re-enables an alarm using the controlled timestamp', () => {
    const alarm = makeAlarm();
    const disabled = transitionAlarm(alarm, 'disable', localTime(15, 6, 30));

    expect(disabled).toMatchObject({
      ok: true,
      value: {
        enabled: false,
        status: 'scheduled',
        nextActivationAt: undefined,
        updatedAt: localTime(15, 6, 30),
      },
    });

    if (!disabled.ok) {
      throw new Error('Expected the disable transition to succeed.');
    }

    const enabled = transitionAlarm(
      disabled.value,
      'enable',
      localTime(15, 6, 45),
    );

    expect(enabled).toMatchObject({
      ok: true,
      value: {
        enabled: true,
        status: 'scheduled',
        nextActivationAt: localTime(15, 7, 30),
        updatedAt: localTime(15, 6, 45),
      },
    });
  });

  it('marks an activated one-shot alarm as triggered and disabled', () => {
    const alarm = makeAlarm();
    const activated = transitionAlarm(
      alarm,
      'trigger',
      alarm.nextActivationAt as number,
    );

    expect(activated).toMatchObject({
      ok: true,
      value: {
        enabled: false,
        status: 'triggered',
        nextActivationAt: undefined,
        triggeredAt: alarm.nextActivationAt,
      },
    });
  });
});
